import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// Fixture-only browser checks for owner lock states, public chart access and the Market
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

for (const row of reconciliation.components) {
    Object.assign(row, {
        previous_timestamp_basis: 'observed', current_timestamp_basis: 'observed', observation_change: 'newer',
        previous_unit: row.key === 'vix' ? 'index points' : '%', current_unit: row.key === 'vix' ? 'index points' : '%',
        previous_retrieved_at: row.previous_observed_at, current_retrieved_at: row.current_observed_at,
    });
}
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const results = [];
try {
    for (const width of [1280, 768, 375]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        let watchlistStatus = 200;
        let saveStatus = 200;
        let watchlistReads = 0;
        let unlocks = 0;
        let queuedWatchlist = null;
        const deferWatchlist = (status) => {
            let release, requested;
            const gate = new Promise(resolve => { release = resolve; });
            const started = new Promise(resolve => { requested = resolve; });
            queuedWatchlist = { status, gate, requested };
            return { release, started };
        };
        const mutations = [];
        await context.route('**/api/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (request.method() !== 'GET' && /^\/api\/research\/(watchlist|backup|notifications\/settings)/.test(url.pathname)) mutations.push(`${request.method()} ${url.pathname}`);
            if (url.pathname === '/api/research/watchlist') {
                if (request.method() === 'POST') {
                    const created = { ...structuredClone(saved), ...request.postDataJSON(), decisionJournal: { ...saved.decisionJournal, decision: 'Not recorded', confidence: 'unrecorded' }, reviewHistory: [] };
                    return saveStatus === 201 ? route.fulfill({ status: 201, json: { success: true, data: created } })
                        : route.fulfill({ status: saveStatus, json: { success: false, code: 'OWNER_ACCESS_REQUIRED' } });
                }
                watchlistReads += 1;
                const held = queuedWatchlist;
                queuedWatchlist = null;
                const status = held?.status ?? watchlistStatus;
                if (held) { held.requested(); await held.gate; }
                return status === 200
                    ? route.fulfill({ json: { success: true, data: [saved], archivedSymbols: [] } })
                    : route.fulfill({ status, json: { success: false, code: status === 401 ? 'OWNER_ACCESS_REQUIRED' : status === 503 ? 'OWNER_ACCESS_UNCONFIGURED' : null } });
            }
            if (url.pathname === '/api/owner/session' && request.method() === 'POST') {
                unlocks += 1; watchlistStatus = 200;
                return route.fulfill({ json: { success: true, data: { configured: true, unlocked: true } } });
            }
            if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({ json: snapshot(decodeURIComponent(url.pathname.split('/').pop())) });
            if (url.pathname.startsWith('/api/research/chart/')) {
                const symbol = decodeURIComponent(url.pathname.split('/').pop());
                return route.fulfill({ json: { success: true, data: { symbol, market: 'US', chart: snapshot(symbol).data.chart } } });
            }
            if (url.pathname === '/api/signals/v2') {
                const fixture = marketRequestFixture();
                const payload = await (await fixture.route.GET(fixture.request(url.search.slice(1)))).json();
                payload.data.metadata.change_reconciliation = reconciliation;
                return route.fulfill({ json: payload });
            }
            return route.fulfill({ status: 404, json: { success: false, error: 'Not part of this fixture.' } });
        });

        // Public chart access does not require a saved security or a workspace handoff.
        await page.goto(`${base}/research-v8?ticker=NVDA&market=US&advanced=1`);
        await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).click();
        await page.getByTestId('research-technicals').getByText('Chart & technicals · NVDA · US.', { exact: false }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get('tab'), 'chart');
        await page.screenshot({ path: `${out}/unsaved-chart-${width}.png`, fullPage: false });

        // The same public tab uses the requested saved security's identity.
        await page.goto(`${base}/research-v8?ticker=${saved.symbol}&market=${saved.market}&advanced=1`);
        await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).click();
        await page.getByTestId('research-technicals').getByText(`Chart & technicals · ${saved.symbol} · ${saved.market}.`, { exact: false }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get('ticker'), saved.symbol);
        assert.equal(new URL(page.url()).searchParams.get('market'), saved.market);

        // A direct link to an unsaved ticker never substitutes another saved company.
        await page.goto(`${base}/research?workspace=research&ticker=NVDA&tab=chart`);
        await page.getByRole('heading', { name: 'NVDA is not saved' }).waitFor();
        assert.equal(new URL(page.url()).searchParams.get('ticker'), 'NVDA', 'unsaved ticker stays in the URL');
        await page.screenshot({ path: `${out}/unsaved-workspace-${width}.png`, fullPage: false });

        // Unlock retains the complete reading, including the market, tab, depth and fragment.
        watchlistStatus = 401;
        const returnPath = '/research-v8?ticker=NVDA&market=US&tab=financials&advanced=1&from=market#evidence';
        await page.goto(base + returnPath);
        const unlock = page.getByRole('link', { name: 'Unlock Signal', exact: true }).first();
        await unlock.waitFor();
        assert.equal(new URL(await unlock.getAttribute('href'), base).searchParams.get('next'), returnPath);
        await unlock.click();
        // Unlock is a static page: wait for its scripts before filling controlled input.
        await page.waitForLoadState('networkidle');
        await page.getByLabel('Access secret').fill('fixture-secret-not-used-in-production');
        await page.getByRole('button', { name: 'Unlock', exact: true }).click();
        await page.waitForURL(base + returnPath);
        await page.getByRole('tab', { name: 'Financials', exact: true }).waitFor();
        assert.equal(await page.getByRole('tab', { name: 'Financials', exact: true }).getAttribute('aria-selected'), 'true');
        assert.equal(unlocks, 1);
        watchlistStatus = 401;
        await page.goto(`${base}/research?workspace=research`);
        await page.getByRole('link', { name: 'Unlock Signal' }).waitFor();

        // A configured-off deployment is unavailable, not an empty or endlessly loading watchlist.
        watchlistStatus = 503;
        const beforeUnconfigured = watchlistReads;
        await page.goto(base + returnPath);
        await page.getByText('Saved research is unavailable because owner access has not been configured', { exact: false }).first().waitFor();
        await page.getByRole('button', { name: /Saved securities · Unavailable/ }).waitFor();
        assert.equal(watchlistReads - beforeUnconfigured, 1, 'configuration failure is not automatically retried');
        assert.equal(await page.getByRole('link', { name: 'Unlock Signal', exact: true }).count(), 0);
        await page.screenshot({ path: `${out}/unconfigured-${width}.png`, fullPage: false });

        // Transport failures offer a local retry, while the public reading stays available.
        watchlistStatus = 500;
        await page.reload();
        const retry = page.getByRole('button', { name: 'Retry saved research', exact: true }).first();
        await retry.waitFor();
        watchlistStatus = 200;
        await retry.click();
        await page.getByRole('button', { name: 'Saved securities · 1', exact: false }).waitFor();

        // A session that expires during Save leaves the reading in place and requires another explicit Save.
        saveStatus = 401;
        await page.getByRole('button', { name: 'Save security', exact: true }).click();
        const unlockSave = page.getByRole('link', { name: 'Unlock to save', exact: true });
        await unlockSave.waitFor();
        assert.equal(new URL(await unlockSave.getAttribute('href'), base).searchParams.get('next'), returnPath);
        assert.equal(page.url(), base + returnPath);
        await page.screenshot({ path: `${out}/save-locked-${width}.png`, fullPage: false });

        // Slow earlier reads cannot overwrite the access state from a newer explicit Save.
        for (const [lateReadStatus, newerSaveStatus] of [[401, 201], [200, 401]]) {
            const held = deferWatchlist(lateReadStatus);
            saveStatus = newerSaveStatus;
            await page.reload();
            await held.started;
            await page.getByRole('button', { name: 'Save security', exact: true }).click();
            const state = newerSaveStatus === 201
                ? page.getByRole('button', { name: 'Saved securities · 1', exact: false })
                : page.getByRole('button', { name: /Saved securities · Locked/ });
            await state.waitFor();
            const response = page.waitForResponse(response => response.url().endsWith('/api/research/watchlist') && response.request().method() === 'GET');
            held.release();
            await (await response).finished();
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            assert.equal(await state.isVisible(), true, `late ${lateReadStatus} read cannot overwrite newer ${newerSaveStatus} save`);
            if (newerSaveStatus === 201) assert.equal(await page.getByRole('link', { name: 'Unlock Signal', exact: true }).count(), 0);
            else assert.equal(await page.getByRole('button', { name: 'Saved securities · 1', exact: false }).count(), 0);
        }

        // Market change accounting sums to the reported delta.
        await page.goto(`${base}/main-v8`);
        const accounting = page.getByRole('region', { name: 'Complete score change accounting' });
        await accounting.waitFor();
        for (const label of ['Input contributions', 'Missing-input fallback', 'Rounding and clamp residual', 'Reported score delta']) {
            await accounting.getByText(label, { exact: true }).waitFor();
        }
        await accounting.locator('summary').filter({ hasText: 'VIX Index' }).click();
        await accounting.getByText('Newer observed reading.', { exact: false }).first().waitFor();
        await page.screenshot({ path: `${out}/market-accounting-${width}.png`, fullPage: true });

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `no horizontal overflow at ${width}px (${overflow}px)`);
        await page.goto(`${base}/unlock`);
        await page.getByLabel('Access secret').waitFor();
        await page.screenshot({ path: `${out}/unlock-${width}.png` });
        assert.deepEqual(errors, [], `no page errors at ${width}px`);
        assert.deepEqual(mutations, Array(3).fill('POST /api/research/watchlist'), `only the three explicit fixture Saves at ${width}px`);
        results.push(width);
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(`Review fixes browser QA passed at ${results.join(', ')}px. Screenshots: ${out}`);
