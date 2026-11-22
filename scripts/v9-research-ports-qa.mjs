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
const output = '.tmp/v9-research-ports'; await mkdir(output, { recursive: true });
const cache = new Map();
function load(file) {
    const absolute = path.resolve(file); if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = { exports: {} }; cache.set(absolute, mod);
    const require = id => {
        assert.ok(id.startsWith('.') || id.startsWith('@/'));
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load(`${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function('require', 'module', 'exports', code)(require, mod, mod.exports); return mod.exports;
}
const { createResearchRecord } = load('src/lib/research/records.ts');
const pairs = [['ZZZ','US'],['AAPL','US'],['MSFT','US'],['NVDA','US'],['NET','US'],['VOO','US'],['1155','MY'],['5347','MY']];
const records = pairs.map(([symbol, market]) => createResearchRecord({ symbol, market, companyName: `Fixture ${symbol}` }));
records[1] = { ...records[1], decisionJournal: { ...records[1].decisionJournal, nextReviewAt: '2020-01-01' } };
const marketFixture = marketRequestFixture(); const signals = {};
for (const market of ['US','MY']) signals[market] = await (await marketFixture.route.GET(marketFixture.request(`market=${market}&mode=standard&enableSocial=true`))).json();
const report = { checks: [], failures: [], errors: [], requests: [] };
const points = Array.from({ length: 100 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 10000,
    ma50: 100 + i, ma200: 90 + i, ema20: 100 + i, ema50: 99 + i, sma200: 90 + i,
    averageVolume20: 10000, rsi14: 55, macd: 1, macdSignal: .8, macdHistogram: .2,
    atr14: 2, atrPercent14: 1, anchoredVwap: 100 + i, adx14: 25, plusDi14: 27,
    minusDi14: 18, supertrend: 99 + i, supertrendDirection: 1,
}));
function snapshotFor(symbol, market) {
    const data = structuredClone(researchSnapshotFixture.data);
    data.symbol = symbol; data.market = market;
    data.quote.name = `Fixture ${symbol}`; data.quote.currency = market === 'MY' ? 'MYR' : 'USD';
    data.quote.observedAt = symbol === 'MSFT' ? null : '2026-09-10T12:00:00Z';
    const annual = {
        annualRevenue: 250000000000, annualNetIncome: 50000000000, freeCashFlow: 45000000000,
        revenueGrowthPercent: 8.7, grossMarginPercent: 40, operatingMarginPercent: 25,
        reportingPeriod: '2025-12-31', source: 'Yahoo Finance',
    };
    Object.assign(data.fundamentals, annual, { history: [{ ...annual, currency: data.quote.currency,
        debt: null, cash: null, shares: null, shareChangePercent: null }] });
    Object.assign(data.valuation, { priceEarnings: 22, marketCap: 1000000000000,
        reportingPeriod: '2025-12-31', source: 'Yahoo Finance' });
    return { success: true, data };
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined });
async function check(name, run) {
    try { await run(); report.checks.push(name); console.log(`PASS ${name}`); }
    catch (e) { report.failures.push({ name, error: e.stack }); console.error(`FAIL ${name}: ${e.message}`); }
}
async function setup(width, theme, owner = false) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage(); page.setDefaultTimeout(12000); const requests = [];
    page.on('pageerror', e => report.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') report.errors.push(m.text()); });
    page.on('requestfailed', r => { if (!r.failure()?.errorText.includes('ERR_ABORTED')) report.errors.push(`${r.url()}: ${r.failure()?.errorText}`); });
    if (!owner) await context.addInitScript(items => {
        if (sessionStorage.getItem('v9-research-ports-seeded')) return;
        if (localStorage.getItem('signal.guest-research.v1') === null) {
            localStorage.setItem('signal.guest-research.v1', JSON.stringify({
                version: 1, guestId: '11111111-1111-4111-8111-111111111111', records: items,
            }));
        }
        sessionStorage.setItem('v9-research-ports-seeded', '1');
    }, pairs.map(([symbol, market]) => ({ symbol, market, companyName: `Fixture ${symbol}`, notes: '' })));
    await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== new URL(base).origin) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        requests.push({ method: req.method(), path: url.pathname, query: url.search }); report.requests.push(`${req.method()} ${url.pathname}${url.search}`);
        if (url.pathname === '/api/owner/session') return route.fulfill({ json: { success: true, data: { configured: owner, unlocked: owner } } });
        if (url.pathname === '/api/research/watchlist' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: owner ? records : [], archivedSymbols: [] } });
        if (url.pathname === '/api/signals/v2') return route.fulfill({ json: signals[url.searchParams.get('market') || 'US'] });
        if (url.pathname === '/api/signals/intraday') return route.fulfill({ json: { success: true, data: {
            market: url.searchParams.get('market'), mode: url.searchParams.get('mode'),
            enableSocial: url.searchParams.get('enableSocial') === 'true', day: new Date().toISOString().slice(0, 10),
            entries: [], hasEarlierCaptures: false,
        } } });
        if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market: 'US', mode: 'standard', enableSocial: true, summaries: [] } } });
        if (url.pathname === '/api/signals/fear-greed' && req.method() === 'GET') return route.fulfill({ json: { success: true, data: { available: true, score: 31, rating: 'fear', previousClose: 35, oneWeekAgo: 44, oneMonthAgo: 56, updatedAt: '2026-09-12T00:00:00.000Z' } } });
        if (url.pathname === '/api/research/search') {
            const market = url.searchParams.get('market'), symbol = market === 'MY' ? '5347.KL' : 'MSFT';
            return route.fulfill({ json: { success: true, source: 'Yahoo Finance', data: [{
                symbol, name: `Fixture ${symbol}`, market, exchange: market === 'MY' ? 'KLS' : 'NMS',
                instrumentType: 'EQUITY', sector: null, industry: null,
            }] } });
        }
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
            return route.fulfill({ json: snapshotFor(symbol, url.searchParams.get('market')) });
        }
        if (url.pathname.startsWith('/api/research/chart/')) return route.fulfill({ json: { success: true, data: {
            symbol: decodeURIComponent(url.pathname.split('/').at(-1)), market: url.searchParams.get('market'),
            fetchedAt: '2026-09-12T00:00:00Z', chart: { interval: '1d', points },
        } } });
        if (url.pathname.startsWith('/api/research/benchmark/')) return route.fulfill({ json: { success: true, data: researchSnapshotFixture.data.benchmark } });
        if (url.pathname.startsWith('/api/research/filings/')) return route.fulfill({ json: { success: true, data: { symbol: 'AAPL', cik: '0000320193', issuer: 'Fixture Apple', filings: [] } } });
        if (req.method() !== 'GET') report.failures.push({ name: 'unexpected mutation', error: `${req.method()} ${url.pathname}` });
        return route.fulfill({ json: { success: false, error: 'Not in fixture' } });
    });
    return { context, page, requests };
}
try {
    for (const width of [1280,768,375]) for (const theme of ['light','dark']) {
        const { context, page, requests } = await setup(width, theme);
        await check(`guest market/watchlist ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?market=US`, { waitUntil: 'domcontentloaded' });
            await page.getByRole('region', { name: 'Market assessment' }).waitFor();
            assert.equal(requests.filter(r => r.path.startsWith('/api/research/symbol/')).length, 0);
            await page.screenshot({ path: `${output}/home-${width}-${theme}.png` });
            await page.goto(`${base}/v9?view=research&tab=watchlist&market=US`, { waitUntil: 'domcontentloaded' });
            await page.waitForURL(url => url.searchParams.get('tab') === 'watchlist');
            const rows = page.getByTestId('watchlist-row'); await rows.first().waitFor(); assert.equal(await rows.count(), 8);
            assert.equal(requests.filter(r => r.path.startsWith('/api/research/symbol/')).length, 0);
            await page.getByLabel('Sort watchlist').selectOption('symbol');
            assert.deepEqual(await rows.evaluateAll(nodes => nodes.map(n => n.getAttribute('data-symbol'))), ['1155','5347','AAPL','MSFT','NET','NVDA','VOO','ZZZ']);
            await page.locator('select').filter({ has: page.getByRole('option', { name: 'All', exact: true }) }).selectOption('MY'); assert.equal(await rows.count(), 2);
            assert.equal(await page.getByRole('link', { name: /Start review/ }).count(), 0);
            assert.equal(await page.getByRole('button', { name: /Due this week/ }).count(), 0);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
            await page.screenshot({ path: `${output}/watchlist-${width}-${theme}.png` });
        });
        await check(`research detail ${width} ${theme}`, async () => {
            await page.goto(`${base}/v9?view=research&ticker=AAPL&market=US&tab=sources`, { waitUntil: 'domcontentloaded' });
            const panel = page.getByRole('region', { name: 'Sources & coverage' }); await panel.getByText('Quote observed').waitFor();
            await panel.getByText('Provider response retrieved').waitFor(); await panel.getByText('Synthetic QA fixture').waitFor();
            assert.equal(requests.filter(r => r.path.startsWith('/api/research/benchmark/')).length, 0);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
            await page.screenshot({ path: `${output}/sources-${width}-${theme}.png` });
            await page.goto(`${base}/v9?view=research&ticker=AAPL&market=US&tab=technicals`, { waitUntil: 'domcontentloaded' });
            const chart = page.getByTestId('research-technicals'); await chart.getByRole('button', { name: /RSI/i }).first().waitFor();
            await chart.scrollIntoViewIfNeeded();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
            await page.screenshot({ path: `${output}/technicals-${width}-${theme}.png` });
            await page.goto(`${base}/v9?view=research&ticker=AAPL&market=US&tab=financials`, { waitUntil: 'domcontentloaded' });
            const financial = page.getByRole('region', { name: 'Financials & valuation' });
            await financial.getByText(/2025/).first().waitFor(); await financial.scrollIntoViewIfNeeded();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
            if (width === 375) {
                const metric = financial.getByText('Annual revenue', { exact: true }).locator('..');
                const geometry = await metric.evaluate(row => {
                    const label = row.querySelector('dt').getBoundingClientRect();
                    const amount = row.querySelector('dd').getBoundingClientRect();
                    return { row: row.getBoundingClientRect().width, label: label.width, amount: amount.width,
                        labelBottom: label.bottom, amountTop: amount.top };
                });
                assert.ok(geometry.amount >= geometry.row * .7 && geometry.amountTop >= geometry.labelBottom - 1,
                    `Phone financial amount should stack beneath its label: ${JSON.stringify(geometry)}`);
            }
            await page.screenshot({ path: `${output}/financials-${width}-${theme}.png` });
            await financial.getByRole('link', { name: 'Valuation', exact: true }).click();
            await page.waitForURL(url => url.searchParams.get('tab') === 'valuation');
            await financial.getByText(/22/).first().waitFor();
            await page.screenshot({ path: `${output}/valuation-${width}-${theme}.png` });
        });
        await context.close();
    }
    const guest = await setup(1280, 'light');
    await check('lookup US, MY and direct ticker', async () => {
        await guest.page.goto(`${base}/v9?view=research&tab=watchlist&market=US`, { waitUntil: 'domcontentloaded' });
        const lookup = guest.page.getByRole('region', { name: 'Find a security' });
        const input = lookup.getByLabel('Company or ticker');
        await input.fill('Microsoft'); await lookup.getByRole('button', { name: 'Find stock' }).click();
        await lookup.getByRole('button', { name: /Fixture MSFT/ }).click();
        await guest.page.waitForURL(url => url.searchParams.get('ticker') === 'MSFT' && url.searchParams.get('market') === 'US');
        await lookup.getByLabel('Lookup market').selectOption('MY'); await input.fill('Tenaga'); await lookup.getByRole('button', { name: 'Find stock' }).click();
        await lookup.getByRole('button', { name: /Fixture 5347/ }).click();
        await guest.page.waitForURL(url => url.searchParams.get('ticker') === '5347' && url.searchParams.get('market') === 'MY');
        await input.fill('NEWX'); await lookup.getByRole('button', { name: /Read ticker directly/ }).click();
        await guest.page.waitForURL(url => url.searchParams.get('ticker') === 'NEWX');
    });
    await check('guest saved and new ticker drafts survive switching and reload', async () => {
        await guest.page.goto(`${base}/v9?view=research&ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
        const note = guest.page.getByLabel('Research note'); await note.waitFor(); await note.fill('AAPL fixture unsaved draft');
        await guest.page.locator('aside').getByRole('button', { name: /MSFT.*US/ }).click();
        await guest.page.waitForURL(url => url.searchParams.get('ticker') === 'MSFT');
        await guest.page.locator('aside').getByRole('button', { name: /AAPL.*US/ }).click();
        await note.waitFor(); assert.equal(await note.inputValue(), 'AAPL fixture unsaved draft');
        const lookup = guest.page.getByRole('region', { name: 'Find a security' });
        await lookup.getByLabel('Company or ticker').fill('NEWX'); await lookup.getByRole('button', { name: /Read ticker directly/ }).click();
        await guest.page.waitForURL(url => url.searchParams.get('ticker') === 'NEWX');
        await note.waitFor(); await note.fill('NEWX fixture unsaved draft');
        await guest.page.waitForFunction(() => Object.keys(localStorage).some(key => key.includes('.draft.') && localStorage.getItem(key)?.includes('NEWX fixture unsaved draft')));
        await guest.page.reload();
        const recovery = guest.page.getByRole('region', { name: 'Recover unsaved guest notes' });
        await recovery.getByRole('button', { name: 'Restore NEWX draft' }).click();
        await note.waitFor(); await guest.page.waitForFunction(() => document.querySelector('textarea[aria-label="Research note"]')?.value === 'NEWX fixture unsaved draft');
        await recovery.getByRole('button', { name: 'Restore AAPL draft' }).click();
        await guest.page.waitForURL(url => url.searchParams.get('ticker') === 'AAPL');
        await guest.page.waitForFunction(() => document.querySelector('textarea[aria-label="Research note"]')?.value === 'AAPL fixture unsaved draft');
        assert.ok(!guest.requests.some(r => r.method !== 'GET'));
    });
    await check('guest can keep a draft after another tab saves the ticker or note', async () => {
        const url = `${base}/v9?view=research&ticker=RACE&market=US`;
        const first = guest.page;
        const second = await guest.context.newPage();
        second.setDefaultTimeout(12000);
        try {
            await Promise.all([first.goto(url), second.goto(url)]);
            const firstEditor = first.getByRole('region', { name: 'Thesis and note' });
            const secondEditor = second.getByRole('region', { name: 'Thesis and note' });
            const draftText = 'First tab thesis draft';
            const competingText = 'Second tab saved thesis';
            const note = firstEditor.getByRole('textbox');
            const keep = firstEditor.getByRole('button', { name: 'Keep my draft' });
            const update = firstEditor.getByRole('button', { name: 'Update note' });
            await note.fill(draftText);
            await first.waitForFunction(text => Object.keys(localStorage).some(key => key.includes('.draft.') && localStorage.getItem(key)?.includes(text)), draftText);
            await secondEditor.getByRole('button', { name: 'Save to watchlist' }).click();
            await update.click();
            await firstEditor.getByText('No note saved.', { exact: true }).waitFor();
            assert.equal(await note.inputValue(), draftText);
            assert.equal(await secondEditor.getByRole('textbox').inputValue(), '');
            await keep.click();
            await keep.waitFor({ state: 'hidden' });
            assert.equal(await note.inputValue(), draftText);
            assert.equal(await secondEditor.getByRole('textbox').inputValue(), '');

            await secondEditor.getByRole('textbox').fill(competingText);
            await secondEditor.getByRole('button', { name: 'Update note' }).click();
            await secondEditor.getByText('Saved locally in this browser.', { exact: true }).waitFor();
            await update.click();
            await firstEditor.getByText(competingText, { exact: true }).waitFor();
            assert.equal(await note.inputValue(), draftText);
            assert.equal(await secondEditor.getByRole('textbox').inputValue(), competingText);
            await keep.click();
            await first.waitForFunction(({ text, expectedNote }) => Object.keys(localStorage).some(key => {
                if (!key.includes('.draft.')) return false;
                const backup = JSON.parse(localStorage.getItem(key));
                return backup.symbol === 'RACE' && backup.text === text && backup.expectedNote === expectedNote && !backup.expectedUnsaved;
            }), { text: draftText, expectedNote: competingText });
            assert.equal(await secondEditor.getByRole('textbox').inputValue(), competingText);
            await update.click();
            await firstEditor.getByText('Saved locally in this browser.', { exact: true }).waitFor();
            await second.waitForFunction(text => document.querySelector('textarea[aria-label="Research note"]')?.value === text, draftText);
            assert.ok(!guest.requests.some(r => r.method !== 'GET'));
        } finally { await second.close(); }
    });
    await check('chart loads VOO and KLCI only on demand', async () => {
        for (const [ticker, market, benchmark, label] of [['AAPL','US','VOO','S&P 500'],['5347','MY','KLCI','FBM KLCI']]) {
            await guest.page.goto(`${base}/v9?view=research&ticker=${ticker}&market=${market}&tab=technicals`, { waitUntil: 'domcontentloaded' });
            const panel = guest.page.getByTestId('research-technicals'); await panel.waitFor();
            const before = guest.requests.filter(r => r.path === `/api/research/chart/${benchmark}`).length;
            const compare = panel.getByRole('button', { name: new RegExp(`relative strength vs ${label}`, 'i') }).first(); await compare.waitFor();
            const indicator = panel.getByRole('button', { name: /RSI/i }).first(); await indicator.click();
            assert.equal(guest.requests.filter(r => r.path === `/api/research/chart/${benchmark}`).length, before);
            await Promise.all([guest.page.waitForResponse(r => new URL(r.url()).pathname === `/api/research/chart/${benchmark}`), compare.click()]);
            assert.ok(guest.requests.some(r => r.path === `/api/research/chart/${benchmark}` && r.query.includes(`market=${market}`)));
        }
    });
    await check('Financials and valuation navigation stays in V9', async () => {
        await guest.page.goto(`${base}/v9?view=research&ticker=AAPL&market=US&tab=financials`, { waitUntil: 'domcontentloaded' });
        const panel = guest.page.getByRole('region', { name: 'Financials & valuation' }); await panel.waitFor();
        await panel.getByText(/2025/).first().waitFor(); assert.match(await panel.innerText(), /250/); assert.match(await panel.innerText(), /40%/);
        await panel.getByRole('link', { name: 'Valuation', exact: true }).click();
        await guest.page.waitForURL(url => url.searchParams.get('tab') === 'valuation');
        assert.equal(new URL(guest.page.url()).pathname, '/v9');
    });
    await check('missing quote observation stays unavailable', async () => {
        await guest.page.goto(`${base}/v9?view=research&ticker=MSFT&market=US&tab=sources`, { waitUntil: 'domcontentloaded' });
        const panel = guest.page.getByRole('region', { name: 'Sources & coverage' });
        await panel.getByText('Quote observed').waitFor();
        assert.equal(await panel.getByText('Quote observed', { exact: true }).locator('..').locator('dd').innerText(), 'Unavailable');
        assert.match(await panel.innerText(), /Provider response retrieved/);
    });
    await guest.context.close();
    const owner = await setup(1280, 'dark', true);
    await check('owner due link targets the matching V9 review', async () => {
        await owner.page.goto(`${base}/v9?view=research&tab=watchlist&market=US`, { waitUntil: 'domcontentloaded' });
        const link = owner.page.getByRole('link', { name: /Start review for AAPL/ }); await link.waitFor();
        const href = new URL(await link.getAttribute('href'), base); assert.equal(href.pathname, '/v9');
        assert.equal(href.searchParams.get('ticker'), 'AAPL'); assert.equal(href.searchParams.get('market'), 'US'); assert.equal(href.searchParams.get('tab'), 'review');
        await owner.page.getByRole('button', { name: /Due this week/ }).click();
        await owner.page.waitForFunction(() => document.querySelectorAll('[data-testid="watchlist-row"]').length === 1);
        assert.equal(await owner.page.getByTestId('watchlist-row').count(), 1);
        assert.ok(await owner.page.getByTestId('watchlist-row').filter({ has: owner.page.getByRole('link', { name: /Start review for AAPL/ }) }).count());
        assert.ok(!owner.requests.some(r => r.method !== 'GET'));
    });
    await owner.context.close();
    const delayed = await setup(1280, 'dark', true);
    let releaseBenchmark;
    const benchmarkGate = new Promise(resolve => { releaseBenchmark = resolve; });
    let requestedBenchmark;
    const benchmarkRequested = new Promise(resolve => { requestedBenchmark = resolve; });
    await delayed.context.route('**/api/research/benchmark/**', async route => {
        requestedBenchmark();
        await benchmarkGate;
        await route.fulfill({ json: { success: true, data: researchSnapshotFixture.data.benchmark } });
    });
    try {
        await check('owner review editor stays available during delayed benchmark', async () => {
            await delayed.page.goto(`${base}/v9?view=research&ticker=AAPL&market=US&tab=review`, { waitUntil: 'domcontentloaded' });
            await Promise.race([benchmarkRequested, new Promise((_, reject) => setTimeout(() => reject(new Error('Benchmark request not observed')), 12000))]);
            await delayed.page.getByRole('navigation', { name: 'Review steps' }).waitFor();
            assert.ok(await delayed.page.locator('[data-review-step="thesis"] textarea:visible').first().isEnabled());
        });
    } finally { releaseBenchmark(); await delayed.context.close(); }
} finally { await browser.close(); await writeFile(`${output}/report.json`, JSON.stringify(report,null,2)); }
if (report.failures.length || report.errors.length) process.exitCode = 1;
