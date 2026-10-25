import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// V8 Discover (Trending, Early trends, Picker, Calendar, Alerts), Research Peers/Filings, and Market outcomes/exposure.
// Uses an existing Signal server. Seeds fixtures from live read-only responses, then pins every value an
// assertion depends on. Runs as a guest with browser-local records; owner routes are never written.
const base = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const output = `.tmp/v8-modules/qa-${Date.now()}`;
await mkdir(output, { recursive: true });
const live = async path => {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(120000) });
    assert.equal(response.status, 200, `${path} must be readable to seed fixtures`);
    return response.json();
};

const discovery = await live('/api/research/discovery');
const seedSnapshot = await live('/api/research/symbol/AAPL?market=US&benchmark=defer');
const seedQuote = await live('/api/research/quote/VOO?market=US');
const seedSignal = await live('/api/signals/v2?market=US&mode=standard');
assert.ok(discovery.data.candidates.length >= 3 && discovery.data.contenders.length >= 1, 'Discovery seed needs leaders and contenders');
assert.ok(seedSignal.data.metadata.historical_validation, 'Signal seed needs historical validation for outcomes');

// Pinned discovery: ownership on the first three rows, a passing score on the first two, an earnings date on the third.
const inDays = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const ownership = (activity, percent) => ({ activity, institutionalOwnershipPercent: percent, increasedShares: 1000, decreasedShares: 500, reportPeriod: '2026-09-30', buyers: [], source: 'Nasdaq institutional holdings', sourceUrl: 'https://www.nasdaq.com/market-activity/stocks/qa/institutional-holdings' });
const pinnedDiscovery = structuredClone(discovery);
const [first, second, third] = pinnedDiscovery.data.candidates;
first.ownership = ownership('increases-led', 72.4); first.discoveryScore = 88; first.risk = 'low';
second.ownership = ownership('decreases-led', 41.2); second.discoveryScore = 86; second.risk = 'low';
third.ownership = null; third.catalyst = { date: inDays(5), type: 'earnings', timing: 'after-hours', fiscalQuarterEnding: null, epsForecast: null, source: 'Nasdaq earnings calendar' };
const leaderRows = Math.min(10, pinnedDiscovery.data.candidates.length);
const totalRows = leaderRows + Math.min(10, pinnedDiscovery.data.contenders.length);
// Pinned early trends: a Top 20 emerging name, a Top 20 confirmed name, and one outside the Top 20.
const pinnedEarly = [
    { ...structuredClone(first), earlyTrendStage: 'emerging', distanceFromMa50Percent: 3.2 },
    { ...structuredClone(second), earlyTrendStage: 'confirmed', distanceFromMa50Percent: 9.1 },
    { ...structuredClone(third), symbol: 'QAEARLY', name: 'QA Early Trend Inc.', earlyTrendStage: 'emerging', distanceFromMa50Percent: -1.4 },
];
pinnedDiscovery.data.emergingCandidates = pinnedEarly;

const guestRecords = [
    { symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.', notes: '' },
    { symbol: 'MSFT', market: 'US', companyName: 'Microsoft Corporation', notes: '' },
    { symbol: 'KO', market: 'US', companyName: 'Coca-Cola Company', notes: '' },
];
const fundamentals = { AAPL: [8, 46, 31], MSFT: [15, 69, 44], KO: [3, 61, 29] };
const snapshot = symbol => {
    const result = structuredClone(seedSnapshot);
    const [growth, gross, operating] = fundamentals[symbol] ?? [5, 40, 20];
    Object.assign(result.data, { symbol, market: 'US' });
    Object.assign(result.data.quote, { name: guestRecords.find(record => record.symbol === symbol)?.companyName ?? symbol, currency: 'USD', price: symbol === 'MSFT' ? 420.25 : symbol === 'KO' ? 62.5 : 201.5, dailyChangePercent: 0.5 });
    Object.assign(result.data.fundamentals, { revenueGrowthPercent: growth, grossMarginPercent: gross, operatingMarginPercent: operating });
    return result;
};
const classification = { AAPL: ['Technology', 'Consumer Electronics'], MSFT: ['Technology', 'Software—Infrastructure'], KO: ['Consumer Defensive', 'Beverages—Non-Alcoholic'] };
const filingsMode = { value: 'ready' };
const filings = { success: true, data: { symbol: 'AAPL', cik: '0000320193', issuer: 'Apple Inc.', filings: [
    { accessionNumber: '0000320193-26-000105', form: '10-K', sourceKind: 'annual-report', filingDate: '2026-10-30', reportingPeriod: '2026-09-26', title: 'Annual report (10-K)', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000105/qa-10k.htm', providerLabel: 'SEC EDGAR' },
    { accessionNumber: '0000320193-26-000080', form: '8-K', sourceKind: 'current-report', filingDate: '2026-07-31', reportingPeriod: null, title: 'Current report (8-K)', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000080/qa-8k.htm', providerLabel: 'SEC EDGAR' },
] } };
const calendar = { success: true, data: { generatedAt: new Date().toISOString(), rangeDays: 30, timezone: 'UTC', warnings: [], macroEvents: [], events: [
    { id: 'AAPL-earnings-qa', symbol: 'AAPL', market: 'US', type: 'earnings', title: 'Earnings announcement', detail: 'After market close', source: 'Nasdaq earnings calendar', sourceDate: inDays(9), displayDate: inDays(9), timezone: 'UTC', freshness: 'scheduled', urgency: 'upcoming', targetHref: '/research?ticker=AAPL&tab=events' },
] } };
const alerts = { success: true, data: { generatedAt: new Date().toISOString(), monitoredCount: 3, triggerCoverage: [], warnings: [], alerts: [
    { id: 'MSFT-qa-risk', symbol: 'MSFT', kind: 'market-condition', severity: 'risk', title: 'QA price below 200-day average', detail: 'Fixture alert for browser QA.', structuredTrigger: null },
] } };
const signal = structuredClone(seedSignal);
// One volatility driver gives deterministic exposure levels: Technology higher, Consumer Staples lower.
signal.data.metadata.score_drivers = [{ ...seedSignal.data.metadata.score_drivers.find(driver => driver.key === 'vix'), impact: 'negative' }];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
await context.addInitScript(records => {
    if (sessionStorage.getItem('qa-seeded')) return;
    sessionStorage.setItem('qa-seeded', '1');
    localStorage.setItem('signal.guest-research.v1', JSON.stringify({ version: 1, guestId: '00000000-0000-4000-8000-0000000000aa', records }));
    localStorage.removeItem('signal-picker-runs-v1');
}, guestRecords);
const page = await context.newPage();
page.setDefaultTimeout(20000);
const checks = [], errors = [], ownerWrites = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text()); });
await context.route('**/api/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.startsWith('/api/research/watchlist') || path.startsWith('/api/owner/') && request.method() !== 'GET') { ownerWrites.push(`${request.method()} ${path}`); return route.abort(); }
    if (path === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: true, unlocked: false } } });
    if (path === '/api/research/discovery') return route.fulfill({ json: pinnedDiscovery });
    if (path.startsWith('/api/research/symbol/')) return route.fulfill({ json: snapshot(decodeURIComponent(path.split('/').pop())) });
    if (path.startsWith('/api/research/quote/')) { const quote = structuredClone(seedQuote); quote.data.symbol = path.split('/').pop(); return route.fulfill({ json: quote }); }
    if (path === '/api/research/search') { const symbol = url.searchParams.get('q'); const [sector, industry] = classification[symbol] ?? [null, null]; return route.fulfill({ json: { success: true, source: 'Yahoo Finance', data: [{ symbol, name: symbol, market: 'US', exchange: 'NMS', instrumentType: 'EQUITY', sector, industry }] } }); }
    if (path.startsWith('/api/research/filings/')) return filingsMode.value === 'ready' ? route.fulfill({ json: filings })
        : route.fulfill({ status: 503, json: { success: false, degraded: true, reason: 'configuration', error: 'Official SEC discovery is unavailable until the operator configures a compliant SEC contact.' } });
    if (path === '/api/research/calendar') return route.fulfill({ json: calendar });
    if (path === '/api/research/alerts') return route.fulfill({ json: alerts });
    if (path === '/api/signals/v2') return route.fulfill({ json: signal });
    return route.continue();
});
const check = (name, condition, detail = '') => { assert.ok(condition, `${name}${detail ? `: ${detail}` : ''}`); checks.push(name); };
const discover = () => page.getByTestId('research-discover');
const view = name => discover().getByRole('tab', { name, exact: true });
async function overflow(name) {
    const result = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, tabs: (() => { const list = document.querySelector('[aria-label="Discover views"]'); return list ? list.scrollWidth - list.clientWidth : 0; })() }));
    check(name, result.scrollWidth <= result.viewport && result.tabs <= 1, JSON.stringify(result));
}
async function shot(name) { await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); }

try {
    for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 900 });
        // Trending: opened by deep link, ranked rows, holder filings.
        await page.goto(`${base}/research-v8?market=US&discover=trending`, { waitUntil: 'domcontentloaded' });
        const trending = page.getByTestId('research-trending');
        await trending.waitFor();
        // Discover is a <details> on its own and an always-open block inside the Research home tabs.
        check(`Discover open on deep link ${width}`, await discover().evaluate(element => element.tagName !== 'DETAILS' || element.open));
        check(`Trending shows Leaders first ${width}`, await trending.locator('li[data-group]').count() === leaderRows);
        await discover().getByRole('button', { name: `Show ${totalRows - leaderRows} contenders`, exact: true }).click();
        check(`Contenders revealed on request ${width}`, await trending.locator('li[data-group]').count() === totalRows);
        const firstRow = trending.locator('li[data-group]').first();
        check(`First row is the scan leader ${width}`, (await firstRow.innerText()).includes(first.symbol));
        check(`Increases-led holder filings shown ${width}`, (await firstRow.innerText()).includes('Holder filings: increases led · 72% institutional'));
        check(`Decreases-led holder filings shown ${width}`, (await trending.locator('li[data-group]').nth(1).innerText()).includes('Holder filings: decreases led · 41% institutional'));
        check(`Missing holder filings labelled ${width}`, (await trending.locator('li[data-group]').nth(2).innerText()).includes('Holder filings unavailable'));
        await discover().getByText('How this list is built', { exact: true }).click();
        check(`Holder caveat stated ${width}`, (await discover().innerText()).includes('not evidence of current buying'));
        await overflow(`Trending fits ${width}`);
        await shot(`trending-${width}`);

        // Early trends: same scan, emerging before confirmed, Top 20 overlap marked.
        await view('Early trends').click();
        const early = page.getByTestId('research-early-trends');
        await early.waitFor();
        const earlyRows = early.locator('li[data-stage]');
        check(`Early trends lists the scan's early candidates ${width}`, await earlyRows.count() === pinnedEarly.length);
        check(`Emerging stage shown with MA50 distance ${width}`, /Emerging[\s\S]*\+3\.2% vs 50-day avg · also in Trending/.test(await earlyRows.first().innerText()), await earlyRows.first().innerText());
        check(`Confirmed stage shown ${width}`, (await earlyRows.nth(1).innerText()).includes('Confirmed'));
        check(`Names outside the Top 20 are not marked as trending ${width}`, !(await earlyRows.nth(2).innerText()).includes('also in Trending'));
        check(`Early trends URL records view ${width}`, new URL(page.url()).searchParams.get('discover') === 'early');
        await overflow(`Early trends fits ${width}`);
        await shot(`early-trends-${width}`);

        // Picker: rule changes the shortlist; a paper basket persists and can be removed.
        await view('Stock Picker').click();
        const shortlist = page.getByRole('region', { name: 'Picker shortlist' });
        await shortlist.waitFor();
        check(`Picker selects pinned high scorers ${width}`, (await shortlist.innerText()).includes(first.symbol) && (await shortlist.innerText()).includes(second.symbol));
        await discover().getByLabel('Minimum score').selectOption('80');
        await discover().getByLabel('Picks').selectOption('3');
        check(`Picker respects pick count ${width}`, await shortlist.locator('ol > li').count() <= 3);
        await shortlist.getByRole('button', { name: 'Start paper basket' }).click();
        await page.getByText(/Paper basket started with/).waitFor();
        check(`Paper basket saved in browser ${width}`, await page.evaluate(() => JSON.parse(localStorage.getItem('signal-picker-runs-v1') ?? '[]').length === 1));
        const basket = page.getByRole('region', { name: 'Paper baskets' }).locator('details').first();
        await basket.locator('summary').click();
        await basket.getByRole('button', { name: 'Remove basket' }).click();
        check(`Paper basket removable ${width}`, await page.evaluate(() => JSON.parse(localStorage.getItem('signal-picker-runs-v1') ?? '[]').length === 0));
        check(`Picker URL records view ${width}`, new URL(page.url()).searchParams.get('discover') === 'picker');
        await overflow(`Picker fits ${width}`);

        // Calendar: watchlist earnings and Top 20 earnings on the week grid, across the pages in range.
        await view('Calendar').click();
        const grid = page.getByTestId('research-calendar-grid');
        await grid.waitFor();
        await page.waitForFunction(() => !document.body.innerText.includes('Loading watchlist dates'));
        const chips = async kind => {
            const found = [];
            for (let block = 0; block < 4; block++) {
                found.push(...await grid.locator(`[data-kind="${kind}"]`).allTextContents());
                const next = discover().getByRole('button', { name: 'Later weeks' });
                // A 30-day window fits one page and has no paging buttons.
                if (await next.count() === 0 || await next.isDisabled()) break;
                await next.click();
            }
            await discover().getByRole('button', { name: 'Today', exact: true }).click();
            return found;
        };
        check(`Calendar marks watchlist earnings ${width}`, (await chips('earnings')).includes('AAPL'));
        check(`Calendar marks trending earnings ${width}`, (await chips('trending')).includes(third.symbol));
        await overflow(`Calendar fits ${width}`);

        // Alerts: fixture alert, and selecting it opens the reading and leaves Discover.
        await view('Alerts').click();
        await discover().getByText('QA price below 200-day average').waitFor();
        await shot(`alerts-${width}`);
        await discover().getByRole('button', { name: 'MSFT', exact: true }).click();
        await page.waitForURL(url => url.searchParams.get('ticker') === 'MSFT');
        check(`Alert opens the security ${width}`, new URL(page.url()).searchParams.get('market') === 'US');
        check(`Selecting leaves Discover ${width}`, !new URL(page.url()).searchParams.has('discover') && !(await discover().evaluate(element => element.open)));
    }

    // Peers and Filings tabs for a saved security.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}/research-v8?ticker=AAPL&market=US&tab=peers`, { waitUntil: 'domcontentloaded' });
    const peers = page.getByTestId('research-peers');
    await peers.locator('table').waitFor();
    await peers.locator('thead th', { hasText: 'KO' }).waitFor();
    check('Peers default to saved same-market securities', (await peers.getByLabel('Selected peers').innerText()).includes('MSFT') && (await peers.getByLabel('Selected peers').innerText()).includes('KO'));
    const growth = peers.locator('tbody tr', { hasText: 'Revenue growth' });
    check('Peer median uses loaded peers', (await growth.innerText()).includes('9.0%'), await growth.innerText());
    check('Rank vs peers shown', (await growth.innerText()).includes('50%'), await growth.innerText());
    check('Price and trend compared side by side', (await peers.locator('tbody tr').filter({ has: page.getByRole('rowheader', { name: 'Price', exact: true }) }).innerText()).includes('$420.25'));
    await peers.getByLabel('Add a ticker').fill('not a ticker');
    await peers.getByRole('button', { name: 'Add peer' }).click();
    check('Invalid ticker rejected', (await peers.getByRole('alert').innerText()).includes('Enter a ticker'));
    await peers.getByRole('button', { name: 'Remove KO' }).click();
    check('Peer removable and offered again', await peers.getByRole('button', { name: 'Remove KO' }).count() === 0 && await peers.getByRole('button', { name: '+ KO' }).count() === 1);
    await page.getByRole('tab', { name: 'Filings', exact: true }).click();
    const filingList = page.getByTestId('research-filings');
    await filingList.getByText('Annual report (10-K)').waitFor();
    check('Filings link to SEC sources', (await filingList.getByRole('link', { name: /Annual report/ }).getAttribute('href')).startsWith('https://www.sec.gov/'));
    filingsMode.value = 'configuration';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('research-filings').getByRole('alert').waitFor();
    check('Configuration failure offers no Retry', await page.getByTestId('research-filings').getByRole('button', { name: 'Retry' }).count() === 0);
    await page.setViewportSize({ width: 375, height: 900 });
    await page.getByRole('tab', { name: 'Peers', exact: true }).click();
    await page.getByTestId('research-peers').locator('table').waitFor();
    await overflow('Peers table contained on phone');
    await shot('peers-375');

    // Market: outcomes summary and exposure map from guest records.
    for (const width of [1280, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/main-v8?market=US`, { waitUntil: 'domcontentloaded' });
        const outcomes = page.getByTestId('similar-score-outcomes');
        await outcomes.waitFor({ timeout: 45000 });
        check(`Outcomes headline uses current score ${width}`, (await outcomes.innerText()).includes(`After scores like today’s ${signal.data.composite_score}`));
        check(`Outcomes show both horizons ${width}`, await outcomes.getByTestId('similar-score-outcome-7').count() === 1 && await outcomes.getByTestId('similar-score-outcome-30').count() === 1);
        const exposure = page.getByTestId('market-watchlist-exposure');
        await exposure.getByText('Consumer Staples · Beverages—Non-Alcoholic').waitFor();
        const card = symbol => exposure.locator('ul > li', { has: page.getByRole('link', { name: symbol, exact: true }) });
        check(`Technology gets the higher volatility rule ${width}`, (await card('AAPL').innerText()).includes('Higher connection'));
        check(`Yahoo Consumer Defensive maps to Consumer Staples ${width}`, (await card('KO').innerText()).includes('Lower connection'));
        await overflow(`Market modules fit ${width}`);
        await shot(`market-${width}`);
        if (width === 1280) {
            await outcomes.getByRole('button', { name: 'Full historical calibration →' }).click();
            await page.getByTestId('market-calibration').waitFor();
            check('Outcomes link opens History calibration', await page.getByRole('tab', { name: 'History', exact: true }).getAttribute('aria-selected') === 'true');
        }
    }

    check('No owner route was written', ownerWrites.length === 0, ownerWrites.join(', '));
    check('No browser errors', errors.length === 0, errors.join(' | '));
    await writeFile(`${output}/summary.json`, JSON.stringify({ checks }, null, 2));
    console.log(`V8 modules QA passed: ${checks.length} checks. Screenshots in ${output}`);
} catch (error) {
    await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${output}/summary.json`, JSON.stringify({ checks, errors, failure: String(error) }, null, 2));
    throw error;
} finally {
    await browser.close();
}
