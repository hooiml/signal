import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3101';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'QA uses a local production server.');
const out = '.tmp/my-data-quality';
await mkdir(out, { recursive: true });
const report = { base, capturedAt: new Date().toISOString(), liveResearch: [], browser: [], errors: [] };
const snapshots = new Map();
// Real provider reads: no quote, share count or annual financial fixture in these checks.
for (const symbol of ['5347', '1155', '5183']) {
    const response = await fetch(`${base}/api/research/symbol/${symbol}?market=MY&benchmark=defer`, { signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200, `${symbol}: real Research endpoint`);
    const payload = await response.json();
    assert.equal(payload.success, true);
    const data = payload.data;
    assert.equal(data.market, 'MY');
    assert.ok(data.valuation.shareCount > 0 && data.valuation.shareDate);
    assert.equal(data.valuation.shareSource, 'Yahoo Finance');
    assert.equal(data.valuation.marketCap, data.quote.price * data.valuation.shareCount);
    assert.ok(data.valuation.priceSales > 0, `${symbol}: annual sales ratio is populated`);
    snapshots.set(symbol, payload);
    report.liveResearch.push({ symbol, quote: data.quote.price, quoteDate: data.quote.observedAt,
        annualPeriod: data.fundamentals.reportingPeriod, valuation: data.valuation, warnings: data.warnings });
    await writeFile(`${out}/real-${symbol}.json`, JSON.stringify(payload, null, 2));
}

// Deterministic Market boundary: synthetic source records and isolated SQL, labelled below.
const captured = '2026-09-12T12:00:00.000Z';
const freshNews = [{ title: 'Market QA: earnings grow', source: 'Test fixture', link: 'https://example.com/market', pubDate: captured }];
const fixture = marketRequestFixture({ rawMarketData: { newsItems: freshNews, redditPosts: [], socialEvidenceCapturedAt: captured } });
const marketResponse = await fixture.route.GET(fixture.request('market=MY&mode=standard&enableSocial=true'));
const marketPayload = await marketResponse.json();
assert.equal(marketPayload.success, true);
const browser = await chromium.launch({ headless: true });
try {
    for (const width of process.env.SIGNAL_QA_WIDTH ? [Number(process.env.SIGNAL_QA_WIDTH)] : [1440, 1280, 768, 390, 375]) {
        const context = await browser.newContext({ viewport: { width, height: width >= 1280 ? 1000 : 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.setDefaultTimeout(30000);
        page.on('pageerror', error => report.errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') report.errors.push(`${message.text()} ${message.location().url}`); });
        page.on('requestfailed', request => { if (!/ERR_ABORTED/.test(request.failure()?.errorText || '')) report.errors.push(request.failure()?.errorText); });
        page.on('request', request => assert.equal(request.method(), 'GET', 'QA must not mutate server records.'));
        async function capture(name, scope) {
            await page.evaluate(() => document.fonts.ready);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: overflow at ${width}`);
            const metrics = await page.locator('main dl dt, main dl dd').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => {
                const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right };
            }));
            assert.ok(metrics.every(rect => rect.left >= -1 && rect.right <= width + 1), `${name}: clipped metric text`);
            await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
            await page.screenshot({ path: `${out}/${name}-viewport-${width}.png` });
            report.browser.push({ name, width, scope, metrics });
        }
        await page.goto(`${base}/research-v8?ticker=5347&market=MY&tab=valuation`);
        await page.getByTestId('reported-share-limitation').waitFor();
        await page.locator('summary').filter({ hasText: /^Source notices and limitations/ }).waitFor();
        const panel = page.getByRole('tabpanel');
        assert.ok((await panel.innerText()).includes(snapshots.get('5347').data.valuation.shareCount.toLocaleString('en-US')));
        await panel.getByText('What the ratios mean · exact inputs', { exact: true }).click();
        await capture('real-tenaga-valuation', 'Real Yahoo provider response');
        await page.getByRole('tab', { name: 'Financials', exact: true }).click();
        await page.getByText('Sales before expenses.', { exact: true }).waitFor();
        await capture('real-tenaga-financials', 'Real Yahoo provider response');

        // Explicitly synthetic missing-share boundary; never passed to the application server.
        const missing = structuredClone(snapshots.get('5347'));
        Object.assign(missing.data.valuation, { shareCount: null, shareDate: null, shareSource: null, shareBasis: null, marketCap: null, priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null });
        missing.data.warnings = ['QA fixture: ordinary shares unavailable.'];
        await context.route('**/api/research/symbol/**', route => route.fulfill({ json: missing }));
        await page.goto(`${base}/research-v8?ticker=5347&market=MY&tab=valuation`);
        await page.getByRole('tab', { name: 'Valuation', exact: true }).click();
        await page.getByRole('region', { name: 'Valuation availability' }).getByText('Why these values are unavailable', { exact: true }).click();
        assert.match(await page.getByRole('region', { name: 'Valuation availability' }).innerText(), /diluted average shares are not substituted/);
        assert.equal(await page.getByTestId('reported-share-limitation').count(), 0);
        await capture('fixture-missing-shares', 'Synthetic missing-share boundary');

        await context.route('**/api/signals/**', route => {
            const url = new URL(route.request().url());
            if (url.pathname === '/api/signals/v2') return route.fulfill({ json: marketPayload });
            if (url.pathname === '/api/signals/replay') return route.fulfill({ json: { success: true, data: { market: 'MY', mode: 'standard', enableSocial: true, summaries: [] } } });
            return route.fulfill({ json: { success: true, data: [] } });
        });
        await page.goto(`${base}/main-v8?market=MY`);
        await page.getByTestId('connected-score').waitFor();
        await page.locator('[data-indicator="news"]').click();
        await page.locator('p:visible').filter({ hasText: /1 eligible news items;/ }).first().waitFor();
        await page.locator('p:visible').filter({ hasText: /same 24-hour rule/ }).first().waitFor();
        await capture('fixture-my-news-eligibility', 'Synthetic Market source fixture; no real database');
        await context.close();
    }
    assert.deepEqual(report.errors, []);
} finally {
    await browser.close();
    await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
console.log(`MY data QA passed: ${report.liveResearch.length} real securities; ${report.browser.length} browser states.`);
