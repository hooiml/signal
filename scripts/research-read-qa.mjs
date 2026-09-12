import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Fixture QA requires a local server');
const output = `.tmp/research-read-qa/${Date.now()}`;
await mkdir(output, { recursive: true });
const fixture = researchReadFixture();
const apple = fixture.getRows()[0];
const microsoft = { ...apple, symbol: 'MSFT', company_name: 'Fixture Microsoft', revision: 9 };
fixture.setRows([apple, microsoft]);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
const checks = [], errors = [], unexpected = [];
page.on('pageerror', error => errors.push(error.message));
let providerMode = 'ready';
let holdWatchlist = false, releaseWatchlist;
let signalWatchlistArrival;
const watchlistArrived = new Promise(resolve => { signalWatchlistArrival = resolve; });
await context.route('**/api/**', async intercepted => {
    const request = intercepted.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') { unexpected.push(request.method()); return intercepted.abort(); }
    if (url.pathname === '/api/research/watchlist') {
        if (holdWatchlist) await new Promise(resolve => { releaseWatchlist = resolve; signalWatchlistArrival(); });
        const savedError = console.error;
        try {
            console.error = () => {};
            const response = await fixture.route.GET();
            return await intercepted.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
        } finally { console.error = savedError; }
    }
    if (url.pathname.startsWith('/api/research/symbol/')) {
        if (providerMode === 'error') return intercepted.fulfill({ status: 500, json: { success: false, error: 'Fixture provider failure' } });
        const payload = structuredClone(researchSnapshotFixture);
        payload.data.symbol = providerMode === 'mismatch' ? 'WRONG' : url.pathname.split('/').at(-1);
        payload.data.quote.price = providerMode === 'partial' ? null : payload.data.symbol === 'MSFT' ? 420 : 200;
        return intercepted.fulfill({ json: payload });
    }
    unexpected.push(url.pathname);
    return intercepted.abort();
});
const waitFor = async (condition, label) => { await condition(); checks.push(label); };
const openSaved = () => page.getByRole('button', { name: /^Saved securities/ }).click();
const closeSaved = () => page.getByRole('button', { name: 'Close research panel' }).click();
const quote = value => page.getByTestId('research-price').filter({ hasText: value }).waitFor();
try {
    holdWatchlist = true;
    await page.goto(`${base}/research-v8`, { waitUntil: 'domcontentloaded' });
    await waitFor(() => page.getByText('Refreshing saved research…', { exact: true }).waitFor(), 'Pending saved research is visible');
    let requestDeadline;
    try {
        await Promise.race([watchlistArrived, new Promise((_, reject) => {
            requestDeadline = setTimeout(() => reject(new Error('Watchlist request was not issued')), 10000);
        })]);
    } finally { clearTimeout(requestDeadline); }
    holdWatchlist = false; releaseWatchlist();
    await waitFor(() => quote('USD 200'), 'Default saved identity and provider quote');
    await openSaved();
    assert.equal(await page.getByRole('region', { name: 'Saved watchlist' }).getByRole('button').count(), 2);
    await page.getByRole('region', { name: 'Saved watchlist' }).getByRole('button', { name: /MSFT/ }).click();
    await waitFor(() => quote('USD 420'), 'Saved securities dialog selects matching company');
    assert.equal(new URL(page.url()).searchParams.get('ticker'), 'MSFT');
    fixture.setRows([apple, { ...microsoft, company_name: 'Fixture Microsoft revised', revision: 10 }]);
    await openSaved();
    await page.getByRole('button', { name: 'Reload saved research', exact: true }).click();
    await waitFor(() => page.getByRole('heading', { name: 'Fixture Microsoft revised', exact: true }).waitFor(), 'Reload displays revised saved record');
    await closeSaved();
    fixture.setFailure({ match: 'SELECT *', message: 'Fixture database unavailable' });
    await openSaved();
    await page.getByRole('button', { name: 'Reload saved research', exact: true }).click();
    await waitFor(() => page.getByText(/The previously loaded records remain visible/).waitFor(), 'Read failure retains record with warning');
    await closeSaved();
    assert.equal(await page.getByRole('heading', { name: 'Fixture Microsoft revised', exact: true }).count(), 1);
    fixture.setFailure(null);
    for (const mode of ['partial', 'error', 'mismatch']) {
        providerMode = mode;
        await page.goto(`${base}/research-v8?ticker=AAPL`, { waitUntil: 'domcontentloaded' });
        await waitFor(() => page.getByText('Fixture saved thesis', { exact: true }).waitFor(), `${mode}: saved research remains visible`);
        if (mode === 'partial') await waitFor(() => quote('Unavailable'), 'Missing quote remains unavailable');
        else await waitFor(() => page.getByRole('button', { name: 'Retry provider data', exact: true }).waitFor(), `${mode}: provider failure is visible`);
    }
    providerMode = 'ready';
    await page.goto(`${base}/research-v8?ticker=UNKNOWN`, { waitUntil: 'domcontentloaded' });
    await waitFor(() => page.getByRole('alert').filter({ hasText: 'No saved research found for UNKNOWN' }).waitFor(), 'Invalid explicit selection is not substituted');
    fixture.setArchived([{ symbol: 'MSFT' }]);
    await page.goto(`${base}/research-v8?ticker=MSFT`, { waitUntil: 'domcontentloaded' });
    await waitFor(() => page.getByRole('alert').filter({ hasText: 'No saved research found for MSFT' }).waitFor(), 'Archived security is excluded');
    fixture.setRows([]);
    await page.goto(`${base}/research-v8`, { waitUntil: 'domcontentloaded' });
    await waitFor(() => page.getByRole('heading', { name: 'Your research starts here.' }).waitFor(), 'Empty saved list remains explicit');
    assert.ok(fixture.calls.every(query => query.startsWith('SELECT ')), 'All observed Research reads are SELECT-only');
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    console.log(`Research read browser QA passed: ${checks.length} checks, zero DDL, zero unexpected API calls.`);
} finally {
    releaseWatchlist?.();
    await writeFile(`${output}/report.json`, JSON.stringify({ base, dataMode: 'synthetic SQL and providers', checks, errors, unexpected, sqlCount: fixture.calls.length }, null, 2));
    await browser.close();
}
