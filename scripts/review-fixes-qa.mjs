import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// Fixture-only browser checks for owner lock states, the unsaved chart handoff and the Market
// change accounting. Requires an owned local production server; never reads a real database.
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3101';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Fixture QA requires localhost');
const out = '.tmp/review-fixes/browser';
await mkdir(out, { recursive: true });
const saved = (await (await researchReadFixture().route.GET()).json()).data[0];
const snapshot = (symbol) => {
    const result = structuredClone(researchSnapshotFixture);
    Object.assign(result.data, { symbol, market: 'US', fetchedAt: new Date().toISOString() });
    Object.assign(result.data.quote, { name: `Fixture ${symbol}`, currency: 'USD', instrumentType: 'EQUITY', observedAt: '2026-10-02T20:00:00.000Z' });
    result.data.warnings = [];
    return result;
};
const reconciliation = {
    previous_score: 52, current_score: 55, reported_delta: 3, component_delta: 2.6, rounding_residual: 0.4, weights_changed: false,
    neutral_fallback: { previous_missing_weight: 0.1, current_missing_weight: 0.1, previous_points: 5, current_points: 5, delta: 0 },
    model_version: { previous: '2.0.0', current: '2.0.0', changed: false },
    components: [
        { key: 'vix', name: 'VIX Index', status: 'changed', previous_score: 40, current_score: 44, previous_weight: 0.6, current_weight: 0.6, previous_raw_value: 22, current_raw_value: 20, previous_observed_at: '2026-10-20T20:00:00.000Z', current_observed_at: '2026-10-21T20:00:00.000Z', new_observation: true, score_effect: 2.4, weight_effect: 0, delta: 2.4 },
        { key: 'aaii', name: 'AAII Sentiment', status: 'changed', previous_score: 60, current_score: 61, previous_weight: 0.2, current_weight: 0.2, previous_raw_value: 35, current_raw_value: 36, previous_observed_at: '2026-10-09T00:00:00.000Z', current_observed_at: '2026-10-16T00:00:00.000Z', new_observation: true, score_effect: 0.2, weight_effect: 0, delta: 0.2 },
    ],
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const width of [1280, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        let watchlistStatus = 200;
        const mutations = [];
        await context.route('**/api/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (request.method() !== 'GET' && /^\/api\/research\/(watchlist|backup|notifications\/settings)/.test(url.pathname)) mutations.push(`${request.method()} ${url.pathname}`);
            if (url.pathname === '/api/research/watchlist') {
                return watchlistStatus === 200
                    ? route.fulfill({ json: { success: true, data: [saved], archivedSymbols: [] } })
                    : route.fulfill({ status: 401, json: { success: false, error: 'Unlock Signal to access saved research.', code: 'OWNER_ACCESS_REQUIRED' } });
            }
            if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({ json: snapshot(decodeURIComponent(url.pathname.split('/').pop())) });
            if (url.pathname === '/api/signals/v2') {
                const fixture = marketRequestFixture();
                const payload = await (await fixture.route.GET(fixture.request(url.search.slice(1)))).json();
                payload.data.metadata.change_reconciliation = reconciliation;
                return route.fulfill({ json: payload });
            }
            return route.fulfill({ status: 404, json: { success: false, error: 'Not part of this fixture.' } });
        });

        // An unsaved security offers no full-chart handoff and explains why.
        await page.goto(`${base}/research-v8?ticker=NVDA&market=US&advanced=1`);
        await page.getByText('Full chart & technicals open from saved research', { exact: false }).waitFor();
        assert.equal(await page.getByRole('link', { name: /Open full chart/ }).count(), 0, 'unsaved security has no chart link');
        await page.screenshot({ path: `${out}/unsaved-chart-${width}.png`, fullPage: false });

        // The saved security's chart link carries its own ticker and market.
        await page.goto(`${base}/research-v8?ticker=${saved.symbol}&market=${saved.market}&advanced=1`);
        const chartLink = page.getByRole('link', { name: /Open full chart/ });
        await chartLink.waitFor();
        const href = new URL(await chartLink.getAttribute('href'), base);
        assert.equal(href.searchParams.get('ticker'), saved.symbol);
        assert.equal(href.searchParams.get('market'), saved.market);

        // A direct link to an unsaved ticker never substitutes another saved company.
        await page.goto(`${base}/research?workspace=research&ticker=NVDA&tab=chart`);
        await page.getByRole('heading', { name: 'NVDA is not saved' }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get('ticker'), 'NVDA', 'unsaved ticker stays in the URL');
        await page.screenshot({ path: `${out}/unsaved-workspace-${width}.png`, fullPage: false });

        // Locked saved research points to the unlock page.
        watchlistStatus = 401;
        await page.goto(`${base}/research-v8`);
        await page.getByRole('link', { name: 'Unlock Signal' }).first().waitFor();
        await page.goto(`${base}/research?workspace=research`);
        await page.getByRole('link', { name: 'Unlock Signal' }).waitFor();
        watchlistStatus = 200;

        // Market change accounting sums to the reported delta.
        await page.goto(`${base}/main-v8`);
        const accounting = page.getByRole('region', { name: 'Complete score change accounting' });
        await accounting.waitFor();
        for (const label of ['Component contributions', 'Neutral fallback for missing inputs', 'Rounding and clamp residual', 'Reported score delta']) {
            await accounting.getByText(label, { exact: true }).waitFor();
        }
        await accounting.getByText('VIX Index · Changed', { exact: false }).click();
        await accounting.getByText('New observation', { exact: false }).first().waitFor();
        await page.screenshot({ path: `${out}/market-accounting-${width}.png`, fullPage: true });

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `no horizontal overflow at ${width}px (${overflow}px)`);
        await page.goto(`${base}/unlock`);
        await page.getByLabel('Access secret').waitFor();
        await page.screenshot({ path: `${out}/unlock-${width}.png` });
        assert.deepEqual(errors, [], `no page errors at ${width}px`);
        assert.deepEqual(mutations, [], `no saved-state mutations at ${width}px`);
        results.push(width);
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(`Review fixes browser QA passed at ${results.join(', ')}px. Screenshots: ${out}`);
