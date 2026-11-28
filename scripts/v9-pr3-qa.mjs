import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = '.tmp/v9-pr3';
await mkdir(output, { recursive: true });

const cache = new Map();
function loadTs(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = { exports: {} };
    cache.set(absolute, mod);
    const req = id => {
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return loadTs(`${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
    return mod.exports;
}

const { createResearchRecord } = loadTs('src/lib/research/records.ts');
const { researchDocumentContentDigest } = loadTs('src/lib/research/document-evidence.ts');

const marketFixture = marketRequestFixture({
    providerOverrides: {
        fetchVIX: () => ({ price: 24.5, change: 0, observedAt: new Date('2026-11-26T20:00:00Z') }),
        fetchMarketNews: () => [
            { title: 'Fixture market pulse headline', source: 'Reuters', link: 'https://example.test/news', pubDate: '2026-11-26T20:00:00Z' },
        ],
    },
});
const usSignal = await (await marketFixture.route.GET(marketFixture.request('market=US&mode=standard&enableSocial=false'))).json();
const mySignal = await (await marketFixture.route.GET(marketFixture.request('market=MY&mode=standard&enableSocial=false'))).json();

const fixtureTime = new Date('2026-11-28T10:00:00.000Z');
const dayOffset = days => new Date(fixtureTime.getTime() + days * 86400000).toISOString().slice(0, 10);

const baseAapl = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.' });
const baseMsft = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft Corp.' });
const baseMaybank = createResearchRecord({ symbol: '1155', market: 'MY', companyName: 'Malayan Banking Berhad' });

const aaplCitationBase = {
    market: 'US',
    symbol: 'AAPL',
    sourceKind: '10-K',
    publicationDate: '2026-10-30',
    reportingPeriod: 'FY2026',
    title: 'Apple Form 10-K Annual Filing',
    sourceUrl: 'https://www.sec.gov/Archives/edgar/data/320193/example-10k.htm',
    providerLabel: 'SEC EDGAR',
    location: 'Item 7 · Gross Margin',
    excerpt: 'Services net sales increased 14% driven by cloud storage and licensing.',
    captureMethod: 'sec-official',
};

const aaplRecord = {
    ...baseAapl,
    lastReviewedAt: dayOffset(-45),
    whyInterested: 'Services margin compounding with resilient enterprise retention.',
    thesisBreak: 'App Store commission compression narrows services margin.',
    acceptedEvidence: [
        {
            id: 'ev-aapl-1',
            title: 'Services gross margin expansion',
            summary: 'Recurring ecosystem services reached 74% gross margin.',
            target: 'whyInterested',
            tone: 'positive',
            mode: 'evidence',
            acceptedAt: '2026-11-01T00:00:00.000Z',
            sources: [{ id: 'src-1', label: '10-K Segment Mix', value: '74%', source: 'SEC EDGAR', sourceUrl: 'https://sec.gov/example', reportingPeriod: 'FY2026' }],
        },
    ],
    documentEvidence: {
        version: 1,
        migrationState: 'current',
        citations: [
            {
                ...aaplCitationBase,
                id: 'cit-aapl-1',
                capturedAt: '2026-11-01T00:00:00.000Z',
                contentDigest: researchDocumentContentDigest(aaplCitationBase),
            },
        ],
    },
    monitoringRules: {
        ...baseAapl.monitoringRules,
        reviewAgeDays: 30,
        structuredTriggers: {
            version: 1,
            migrationState: 'current',
            rules: [
                {
                    id: 'aapl-pe-trigger',
                    enabled: true,
                    purpose: 'opportunity-review',
                    metric: 'price-earnings',
                    operator: 'below',
                    threshold: 25,
                },
            ],
        },
    },
    decisionJournal: {
        ...baseAapl.decisionJournal,
        nextReviewAt: dayOffset(-2),
    },
};

const msftRecord = {
    ...baseMsft,
    lastReviewedAt: dayOffset(-4),
    whyInterested: 'Azure workload migration and AI productivity attachment.',
    monitoringRules: {
        ...baseMsft.monitoringRules,
        reviewAgeDays: 90,
        structuredTriggers: {
            version: 1,
            migrationState: 'current',
            rules: [
                {
                    id: 'msft-rsi-trigger',
                    enabled: true,
                    purpose: 'opportunity-review',
                    metric: 'rsi14',
                    operator: 'below',
                    threshold: 35,
                },
            ],
        },
    },
    decisionJournal: {
        ...baseMsft.decisionJournal,
        nextReviewAt: dayOffset(45),
    },
};

const maybankRecord = {
    ...baseMaybank,
    lastReviewedAt: dayOffset(-10),
    whyInterested: 'Steady CASA deposit franchise and dividend yield.',
    monitoringRules: {
        ...baseMaybank.monitoringRules,
        reviewAgeDays: 90,
    },
    decisionJournal: {
        ...baseMaybank.decisionJournal,
        nextReviewAt: dayOffset(0),
    },
};

const ownerRecords = [aaplRecord, msftRecord, maybankRecord];

const alertsPayload = {
    success: true,
    data: {
        generatedAt: fixtureTime.toISOString(),
        monitoredCount: ownerRecords.length,
        alerts: [
            {
                id: 'alert-aapl-trigger',
                symbol: 'AAPL',
                kind: 'structured-trigger',
                severity: 'opportunity',
                title: 'Price / earnings below 25',
                detail: 'Observed P/E 23.4 is below your 25 threshold.',
                structuredTrigger: null,
            },
            {
                id: 'alert-1155-ma200',
                symbol: '1155',
                kind: 'market-condition',
                severity: 'watch',
                title: 'Trading below 200-day moving average',
                detail: 'Latest close MYR 9.85 sits 2.1% below MA200.',
                structuredTrigger: null,
            },
        ],
        triggerCoverage: [
            {
                symbol: 'AAPL',
                rule: aaplRecord.monitoringRules.structuredTriggers.rules[0],
                status: 'matched',
                severity: 'opportunity',
                title: 'Price / earnings below 25',
                detail: 'Observed P/E 23.4 is below your 25 threshold.',
                observed: {
                    value: 23.4,
                    label: 'P/E 23.4',
                    observedAt: fixtureTime.toISOString(),
                    source: 'Yahoo Finance',
                    freshness: 'Live',
                },
            },
            {
                symbol: 'MSFT',
                rule: msftRecord.monitoringRules.structuredTriggers.rules[0],
                status: 'not-matched',
                severity: 'opportunity',
                title: 'RSI (14) below 35',
                detail: 'Observed RSI 54.0 is above 35.',
                observed: null,
            },
        ],
        warnings: [],
    },
};

const report = { checks: [], failures: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });

async function runCheck(name, fn) {
    try {
        await fn();
        report.checks.push(name);
        console.log(`PASS ${name}`);
    } catch (error) {
        report.failures.push({ name, error: error.stack || error.message });
        console.error(`FAIL ${name}: ${error.message}`);
    }
}

async function setupContext({ width, theme, owner = true }) {
    const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
    });
    const requests = [];
    await context.addInitScript(({ selectedTheme, isOwner }) => {
        localStorage.setItem('signal-v8-theme-v1', selectedTheme);
        if (!isOwner) {
            localStorage.setItem('signal.guest-research.v1', JSON.stringify({
                version: 1,
                guestId: '11111111-1111-4111-8111-111111111111',
                records: [
                    { symbol: 'AAPL', market: 'US', companyName: 'Apple Inc.', notes: 'Guest local services note' },
                ],
            }));
        }
    }, { selectedTheme: theme, isOwner: owner });

    await context.route('**/*', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        requests.push({ method: req.method(), path: url.pathname, query: url.search, body: req.postData() || '' });

        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ json: { success: true, data: owner ? ownerRecords : [], archivedSymbols: [] } });
        if (url.pathname === '/api/research/alerts' && req.method() === 'POST') return route.fulfill({ json: alertsPayload });
        if (url.pathname === '/api/signals/v2') {
            return route.fulfill({ json: url.searchParams.get('market') === 'MY' ? mySignal : usSignal });
        }
        if (url.pathname === '/api/signals/intraday') {
            return route.fulfill({ json: { success: true, data: { market: url.searchParams.get('market') || 'US', mode: 'standard', enableSocial: false, day: dayOffset(0), entries: [], hasEarlierCaptures: false } } });
        }
        if (url.pathname === '/api/signals/internals') return route.fulfill({ json: { success: true, data: { market: url.searchParams.get('market') || 'US', available: false, updatedAt: null, items: [] } } });
        if (url.pathname === '/api/signals/fear-greed') return route.fulfill({ json: { success: true, data: { available: false, score: null, rating: null, previousClose: null, oneWeekAgo: null, oneMonthAgo: null, updatedAt: null } } });
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const sym = decodeURIComponent(url.pathname.split('/').at(-1) || 'AAPL').toUpperCase();
            const payload = structuredClone(researchSnapshotFixture);
            payload.data.symbol = sym;
            payload.data.market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US';
            payload.data.quote.name = sym === '1155' ? 'Malayan Banking Berhad' : sym === 'MSFT' ? 'Microsoft Corp.' : 'Apple Inc.';
            payload.data.quote.currency = payload.data.market === 'MY' ? 'MYR' : 'USD';
            return route.fulfill({ json: payload });
        }
        if (url.pathname === '/api/research/quotes' && req.method() === 'POST') {
            const items = req.postDataJSON().map(({ symbol, market }) => ({
                success: true,
                data: {
                    symbol,
                    market,
                    providerSymbol: symbol,
                    fetchedAt: fixtureTime.toISOString(),
                    quote: {
                        ...researchSnapshotFixture.data.quote,
                        currency: market === 'MY' ? 'MYR' : 'USD',
                        price: symbol === '1155' ? 9.85 : 228.5,
                        dailyChangePercent: symbol === '1155' ? -0.9 : 1.35,
                    },
                },
            }));
            return route.fulfill({ json: { success: true, data: { fetchedAt: fixtureTime.toISOString(), items } } });
        }
        if (url.pathname.startsWith('/api/research/chart/')) {
            return route.fulfill({ json: { success: true, data: { symbol: 'VOO', market: 'US', fetchedAt: fixtureTime.toISOString(), chart: { interval: '1d', points: researchSnapshotFixture.data.chart.points } } } });
        }
        if (url.pathname.startsWith('/api/research/valuation-plan/')) return route.fulfill({ json: { success: true, data: null } });
        if (url.pathname.startsWith('/api/research/valuation-history/')) return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', market: 'US', observations: [], capabilities: {}, warnings: [] } } });
        if (url.pathname.startsWith('/api/research/filings/')) return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', cik: '0000320193', issuer: 'Apple Inc.', filings: [] } } });
        return route.fulfill({ json: { success: true, data: {} } });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.clock.install({ time: fixtureTime });
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    return { context, page, requests };
}

try {
    // 1. Desktop Owner Flow: Command Palette (routes, local thesis/citation/monitoring search, recent tickers),
    //    Sidebar Due-Review Dots, Topbar Attention Popover (zero unsolicited polls + on-demand scan), Watchlist Triggered Filter.
    const ownerCtx = await setupContext({ width: 1280, theme: 'light', owner: true });
    await runCheck('V9-E5 command palette routes, local thesis/citation/monitoring search, recent tickers & privacy', async () => {
        const { page, requests } = ownerCtx;
        await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
        await page.locator('aside').getByText('Watchlist (3)', { exact: true }).waitFor();

        // Zero unsolicited alerts calls on landing
        assert.equal(requests.filter(r => r.path === '/api/research/alerts').length, 0);

        const openCmd = async () => {
            await page.getByRole('button', { name: /Quick jump/i }).click();
            const dialog = page.getByRole('dialog');
            await dialog.waitFor();
            return dialog;
        };

        // Check expanded V9 static routes
        let dialog = await openCmd();
        for (const label of [
            'Portfolio · Holdings',
            'Portfolio · Factor exposure',
            'Discover · Early trends',
            'Discover · Alerts',
        ]) {
            await dialog.getByText(label, { exact: true }).waitFor();
        }
        await page.screenshot({ path: `${output}/cmd-palette-1280-light.png` });

        // Search authored thesis -> review tab
        const searchCountBefore = requests.length;
        const input = dialog.getByRole('textbox');
        await input.fill('commission compression');
        await dialog.getByText('AAPL · Thesis break').waitFor();
        await dialog.getByText('AAPL · Thesis break').click();
        await page.waitForURL(u => u.searchParams.get('view') === 'research' && u.searchParams.get('ticker') === 'AAPL' && u.searchParams.get('tab') === 'review');

        // Search primary-document citation -> evidence tab
        dialog = await openCmd();
        await dialog.getByRole('textbox').fill('cloud storage and licensing');
        await dialog.getByText(/AAPL · 10-K/).waitFor();
        await dialog.getByText(/AAPL · 10-K/).click();
        await page.waitForURL(u => u.searchParams.get('view') === 'research' && u.searchParams.get('ticker') === 'AAPL' && u.searchParams.get('tab') === 'evidence');

        // Search monitoring rule -> monitoring tab
        dialog = await openCmd();
        await dialog.getByRole('textbox').fill('Price / earnings below 25');
        await dialog.getByText('AAPL · Monitoring rule').waitFor();
        await dialog.getByText('AAPL · Monitoring rule').click();
        await page.waitForURL(u => u.searchParams.get('view') === 'research' && u.searchParams.get('ticker') === 'AAPL' && u.searchParams.get('tab') === 'monitoring');

        // Assert zero network requests carried authored search terms
        const postSearchRequests = requests.slice(searchCountBefore);
        assert.equal(postSearchRequests.filter(r => r.path === '/api/research/search' || r.query.includes('compression') || r.body.includes('compression')).length, 0);

        // Open MSFT via sidebar so recent tickers update, reload, and verify Recent persists locally
        await page.locator('aside').getByRole('button', { name: /MSFT/ }).click();
        await page.waitForURL(u => u.searchParams.get('ticker') === 'MSFT');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
        dialog = await openCmd();
        await dialog.locator('a', { hasText: 'MSFT' }).filter({ hasText: 'Recent' }).waitFor();
        await dialog.getByRole('button', { name: 'Close quick jump' }).click();
    });

    await runCheck('V9-E6 sidebar due dots, topbar attention popover & zero background polling', async () => {
        const { page, requests } = ownerCtx;
        await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
        await page.locator('aside').getByText('Watchlist (3)', { exact: true }).waitFor();

        // AAPL (overdue) and 1155 (due today) have dots; MSFT (due +45d) does NOT
        const aaplRow = page.locator('aside button', { hasText: 'Apple Inc.' });
        const msftRow = page.locator('aside button', { hasText: 'Microsoft Corp.' });
        const maybankRow = page.locator('aside button', { hasText: 'Malayan Banking Berhad' });
        assert.equal(await aaplRow.getByTestId('side-watch-due-dot').count(), 1);
        assert.equal(await aaplRow.getByTestId('side-watch-due-dot').getAttribute('data-status'), 'overdue');
        assert.equal(await msftRow.getByTestId('side-watch-due-dot').count(), 0);
        assert.equal(await maybankRow.getByTestId('side-watch-due-dot').count(), 1);
        assert.equal(await maybankRow.getByTestId('side-watch-due-dot').getAttribute('data-status'), 'today');

        // Zero alerts calls before user clicks "Check alerts now"
        assert.equal(requests.filter(r => r.path === '/api/research/alerts').length, 0);

        const trigger = page.getByTestId('attention-trigger');
        await trigger.getByTestId('attention-dot').waitFor();
        await trigger.click();

        const popover = page.getByTestId('attention-popover');
        await popover.waitFor();
        await popover.getByText('Overdue').waitFor();
        await popover.getByText('Due today').waitFor();
        assert.equal(requests.filter(r => r.path === '/api/research/alerts').length, 0, 'opening popover must not auto-poll alerts');

        // Explicit on-demand scan fires exactly 1 POST /api/research/alerts
        await Promise.all([
            page.waitForResponse(r => new URL(r.url()).pathname === '/api/research/alerts' && r.request().method() === 'POST'),
            popover.getByRole('button', { name: 'Check alerts now' }).click(),
        ]);
        assert.equal(requests.filter(r => r.path === '/api/research/alerts').length, 1);
        await popover.getByText(/Price \/ earnings below 25/).waitFor();
        await popover.getByText(/Trading below 200-day moving average/).waitFor();

        // Escape dismisses popover
        await page.keyboard.press('Escape');
        await popover.waitFor({ state: 'hidden' });

        // Watchlist "Triggered rules" filter reuses already-scanned result with zero duplicate alerts fetch
        await page.goto(`${base}/v9?view=research&tab=watchlist&market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('watchlist-row').first().waitFor();
        assert.equal(await page.getByTestId('watchlist-row').count(), 3);
        const beforeWatchlistFilter = requests.filter(r => r.path === '/api/research/alerts').length;
        const filterBtn = page.getByTestId('watchlist-triggered-filter');
        await Promise.all([
            page.waitForResponse(r => new URL(r.url()).pathname === '/api/research/alerts'),
            filterBtn.click(),
        ]);
        // Note: page.goto reloaded page state, so 1 on-demand scan occurs on Watchlist toggle, and toggling off/on again reuses cached result
        assert.equal(requests.filter(r => r.path === '/api/research/alerts').length, beforeWatchlistFilter + 1);
        assert.equal(await page.getByTestId('watchlist-row').count(), 2);
        const symbols = await page.getByTestId('watchlist-row').evaluateAll(els => els.map(el => el.getAttribute('data-symbol')));
        assert.deepEqual(symbols, ['1155', 'AAPL']);

        await filterBtn.click();
        assert.equal(await page.getByTestId('watchlist-row').count(), 3);
        await filterBtn.click();
        assert.equal(requests.filter(r => r.path === '/api/research/alerts').length, beforeWatchlistFilter + 1, 're-enabling filter reuses current scan');
    });
    await ownerCtx.context.close();

    // 2. Responsive Light & Dark Screenshots across 1280px, 768px, 375px + Popover Overflow Checks
    for (const [width, theme] of [[1280, 'light'], [1280, 'dark'], [768, 'light'], [768, 'dark'], [375, 'light'], [375, 'dark']]) {
        const ctx = await setupContext({ width, theme, owner: true });
        await runCheck(`responsive popover & watchlist geometry ${width} ${theme}`, async () => {
            const { page } = ctx;
            await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
            await page.getByTestId('attention-trigger').getByTestId('attention-dot').waitFor();
            await page.getByTestId('attention-trigger').click();
            const popover = page.getByTestId('attention-popover');
            await popover.waitFor();
            await popover.getByRole('button', { name: 'Check alerts now' }).click();
            await popover.getByText(/Price \/ earnings below 25/).waitFor();
            const box = await popover.boundingBox();
            assert.ok(box && box.x >= 0 && box.x + box.width <= width + 1, `popover within viewport (${width}px): ${JSON.stringify(box)}`);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow');
            await page.screenshot({ path: `${output}/attention-popover-${width}-${theme}.png` });

            await page.keyboard.press('Escape');
            await popover.waitFor({ state: 'hidden' });

            await page.goto(`${base}/v9?view=research&tab=watchlist&market=US`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('watchlist-row').first().waitFor();
            await page.getByTestId('watchlist-triggered-filter').click();
            await page.getByTestId('watchlist-triggered-status').getByText(/Showing stocks with active alerts/).waitFor();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'watchlist no horizontal overflow');
            await page.screenshot({ path: `${output}/watchlist-triggered-${width}-${theme}.png`, fullPage: true });
        });
        await ctx.context.close();
    }

    // 3. Guest workspace & Legacy V8 command palette preservation
    const guestCtx = await setupContext({ width: 1280, theme: 'light', owner: false });
    await runCheck('guest local search & legacy V8 command palette preserved', async () => {
        const { page } = guestCtx;
        await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByTestId('v9-workspace').filter({ visible: true }).waitFor();
        await page.getByTestId('attention-trigger').click();
        await page.getByTestId('attention-popover').getByText('Guest bookmarks have no review schedule.').waitFor();
        await page.keyboard.press('Escape');

        await page.getByRole('button', { name: /Quick jump/i }).click();
        const v9Dialog = page.getByRole('dialog');
        await v9Dialog.getByRole('textbox').fill('local services note');
        await v9Dialog.getByText('AAPL · Notes').waitFor();
        await page.keyboard.press('Escape');

        await page.goto(`${base}/main-v8?market=US`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: /Quick jump/i }).click();
        const v8Dialog = page.getByRole('dialog');
        await v8Dialog.waitFor();
        assert.equal(await v8Dialog.locator('a').count(), 7, 'V8 command palette retains exact 7 static items');
        assert.equal(await v8Dialog.getByText('Portfolio · Holdings').count(), 0);
    });
    await guestCtx.context.close();
} finally {
    await browser.close();
    await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}

if (report.failures.length || report.errors.length) {
    console.error('QA failures/errors:', JSON.stringify({ failures: report.failures, errors: report.errors }, null, 2));
    process.exitCode = 1;
} else {
    console.log(`ALL ${report.checks.length} V9 PR-3 QA checks passed.`);
}
