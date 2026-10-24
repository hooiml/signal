import { switchWatchlistStock } from './qa-watchlist-switch.mjs';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

// Browser QA against an existing Signal server. Fixture suites isolate owner
// data; the final smoke explicitly reads public US/MY chart data from the API.
const base = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const output = `.tmp/research-chart-v8-qa/${Date.now()}`;
const realOutput = `.tmp/chart-real-data/research-chart-v8-${Date.now()}`;
const guestStorageKey = 'signal.guest-research.v1';
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };

const makePoints = (symbol, count = 320) => Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, 1 + index)).toISOString().slice(0, 10);
    const basePrice = (symbol === 'MAYBANK' ? 9 : 180) + index * (symbol === 'MAYBANK' ? 0.004 : 0.16) + Math.sin(index / 8) * 2;
    return {
        time: date, open: basePrice - 0.3, high: basePrice + 1.2, low: basePrice - 1.1, close: basePrice,
        volume: 1_000_000 + index * 100, ma50: basePrice - 1, ma200: basePrice - 3,
        ema20: basePrice - 0.4, ema50: basePrice - 1.2, sma200: basePrice - 3,
        averageVolume20: 1_100_000, rsi14: 48 + Math.sin(index / 11) * 18,
        macd: 0.5 + Math.sin(index / 13), macdSignal: 0.3 + Math.sin(index / 13) * 0.8,
        macdHistogram: 0.2 + Math.sin(index / 13) * 0.2, atr14: 2.1, atrPercent14: 1.1,
        anchoredVwap: basePrice - 0.5, adx14: 24 + Math.sin(index / 17) * 8,
        plusDi14: 27, minusDi14: 18, supertrend: basePrice - 2, supertrendDirection: 1,
    };
});

const snapshotFor = (symbol, market) => {
    const payload = structuredClone(researchSnapshotFixture);
    payload.data.symbol = symbol;
    payload.data.market = market;
    payload.data.fetchedAt = '2026-10-20T12:00:00.000Z';
    payload.data.quote = {
        name: symbol === 'MAYBANK' ? 'Maybank fixture security' : `${symbol} fixture security`,
        currency: market === 'MY' ? 'MYR' : 'USD', price: market === 'MY' ? 10.75 : 201.5, dailyChangePercent: 0.6,
    };
    payload.data.fundamentals = {
        ...payload.data.fundamentals,
        annualRevenue: 250_000_000_000,
        revenueGrowthPercent: 8.7,
        annualNetIncome: 50_000_000_000,
        freeCashFlow: 45_000_000_000,
        grossMarginPercent: 40,
        operatingMarginPercent: 25,
        reportingPeriod: '2025-12-31',
        source: 'Yahoo Finance',
        history: [
            { reportingPeriod: '2025-12-31', currency: market === 'MY' ? 'MYR' : 'USD', source: 'Yahoo Finance', annualRevenue: 250_000_000_000, revenueGrowthPercent: 8.7, grossMarginPercent: 40, operatingMarginPercent: 25, annualNetIncome: 50_000_000_000, freeCashFlow: 45_000_000_000, debt: null, cash: null, shares: null, shareChangePercent: null },
            { reportingPeriod: '2024-12-31', currency: market === 'MY' ? 'MYR' : 'USD', source: 'Yahoo Finance', annualRevenue: 230_000_000_000, revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null, annualNetIncome: 45_000_000_000, freeCashFlow: 40_000_000_000, debt: null, cash: null, shares: null, shareChangePercent: null },
        ],
    };
    payload.data.sources = ['Synthetic QA fixture'];
    payload.data.warnings = ['Synthetic QA values are for layout testing only; they are not provider data.'];
    payload.data.chart.points = makePoints(symbol, 90);
    payload.data.technicals = { ma50: 199, ma200: 190, rsi14: 56, macd: 1.2, low52Week: 170, high52Week: 220, averageVolume20: 1_100_000, support: 195, resistance: 215 };
    return payload;
};

const chartFor = (symbol, market) => ({
    success: true,
    data: { symbol, market, fetchedAt: '2026-10-20T12:00:00.000Z', chart: { interval: '1d', points: makePoints(symbol) } },
});

const ownerFixture = await researchReadFixture();
const ownerResponse = await ownerFixture.route.GET();
assert.equal(ownerResponse.status, 200, 'isolated owner record fixture should be valid');
const ownerRecords = (await ownerResponse.json()).data;
const guestRecords = [
    { symbol: 'AAPL', market: 'US', companyName: 'Fixture Apple', notes: 'QA note retained across tabs.' },
    { symbol: 'MAYBANK', market: 'MY', companyName: 'Fixture Maybank', notes: 'QA Malaysia note.' },
];
const browser = await chromium.launch({ headless: true });
await mkdir(output, { recursive: true });

async function runMode(mode, viewport) {
    const context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(({ key, records }) => localStorage.setItem(key, JSON.stringify({
        version: 1, guestId: '29a44aab-3621-4c56-a891-8212a9c2f372', records,
    })), { key: guestStorageKey, records: guestRecords });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const apiRequests = [];
    const forbiddenOwnerReads = [];
    const mutations = [];
    const errors = [];
    let chartMode = 'ready';
    let failChartOnce = false;
    let delayedSymbol = null;
    let releaseDelayed;
    let notifyChartStarted;
    const chartStarted = new Promise(resolve => { notifyChartStarted = resolve; });
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`); });
    await page.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        apiRequests.push({ path: url.pathname, search: url.search, method: request.method() });
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (request.method() !== 'GET') {
            mutations.push(`${request.method()} ${url.pathname}`);
            return route.abort();
        }
        if (url.pathname === '/api/owner/session') return json({ success: true, data: { unlocked: mode === 'owner' } });
        if (url.pathname === '/api/research/watchlist') {
            if (mode !== 'owner') forbiddenOwnerReads.push(url.pathname);
            return json({ success: true, data: mode === 'owner' ? ownerRecords : [], archivedSymbols: [] });
        }
        if (url.pathname.startsWith('/api/research/symbol/')) {
            const symbol = url.pathname.split('/').at(-1);
            const market = url.searchParams.get('market') ?? 'US';
            return json(snapshotFor(symbol, market));
        }
        if (url.pathname.startsWith('/api/research/chart/')) {
            const symbol = url.pathname.split('/').at(-1);
            const market = url.searchParams.get('market');
            const isDelayed = delayedSymbol === symbol;
            if (isDelayed) {
                notifyChartStarted();
                await new Promise(resolve => { releaseDelayed = resolve; });
            }
            if (chartMode === 'error' || failChartOnce) {
                failChartOnce = false;
                return json({ success: false, error: 'QA chart fixture unavailable.' }, 502);
            }
            if (chartMode === 'empty') return json({ success: true, data: { symbol, market, fetchedAt: '2026-10-20T12:00:00.000Z', chart: { interval: '1d', points: [] } } });
            if (chartMode === 'mismatch') return json(chartFor(symbol === 'AAPL' ? 'MAYBANK' : 'AAPL', market === 'US' ? 'MY' : 'US'));
            const response = json(chartFor(symbol, market));
            return isDelayed ? response.catch(() => {}) : response;
        }
        return json({ success: true, data: {} });
    });

    const visibleChartTab = page.getByRole('tab', { name: 'Chart & technicals', exact: true });
    const go = async (query = '?ticker=AAPL&market=US') => {
        const response = await page.goto(`${base}/research-v8${query}`, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        const dismiss = page.getByRole('button', { name: 'Dismiss notice', exact: true });
        if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
        await page.getByRole('tablist', { name: 'Research investigation' }).waitFor({ state: 'visible' });
    };
    const waitChartResponse = async (symbol, market) => page.waitForResponse(response => {
        const url = new URL(response.url());
        return url.pathname === `/api/research/chart/${symbol}` && url.searchParams.get('market') === market && response.request().method() === 'GET';
    });
    const openChart = async (symbol, market) => {
        const responsePromise = waitChartResponse(symbol, market);
        await visibleChartTab.click();
        return responsePromise;
    };
    const geometry = async name => {
        const result = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
        assert.ok(result.scrollWidth <= result.viewport + 1, `${name}: horizontal overflow ${JSON.stringify(result)}`);
        checks.push(`${mode} ${name}`);
    };

    try {
        await go();
        await page.getByTestId('selected-security-identity').waitFor({ state: 'visible' });
        check(`${mode} ${viewport.width}: initial selected ticker matches the URL`, await page.getByTestId('selected-security-identity').getAttribute('data-symbol') === 'AAPL');
        check(`${mode} ${viewport.width}: chart stays lazy until its tab is opened`, apiRequests.filter(item => item.path.startsWith('/api/research/chart/')).length === 0);
        await openChart('AAPL', 'US');
        await page.getByTestId('research-chart-explorer').waitFor({ state: 'visible' });
        const chartRequests = apiRequests.filter(item => item.path === '/api/research/chart/AAPL');
        check(`${mode} ${viewport.width}: chart uses the symbol endpoint and US market`, chartRequests.length === 1 && chartRequests[0].search === '?market=US');
        check(`${mode} ${viewport.width}: chart renders returned fixture history`, await page.getByTestId('research-chart-explorer').getAttribute('aria-label').then(label => label.includes('AAPL')));
        await page.screenshot({ path: `${output}/${mode}-${viewport.width}-chart.png`, fullPage: true });
        await geometry(`chart viewport ${viewport.width}`);

        if (viewport.width >= 900) {
            const macd = page.getByRole('group', { name: 'Momentum indicator' }).getByRole('button', { name: 'MACD', exact: true });
            await macd.click();
            check(`${mode} ${viewport.width}: MACD control selects its indicator`, await macd.getAttribute('aria-pressed') === 'true');
        } else {
            await page.getByTestId('research-chart-mobile-settings').locator('summary').click();
            const indicator = page.getByRole('combobox', { name: /^Indicator/ });
            await indicator.selectOption('MACD');
            check(`${mode} ${viewport.width}: mobile MACD control selects its indicator`, await indicator.inputValue() === 'MACD');
        }
        check(`${mode} ${viewport.width}: dark theme is applied`, await page.locator('html').getAttribute('data-v8-theme') === 'dark');

        const benchmarkSymbol = 'VOO';
        const benchmarkName = viewport.width >= 900 ? 'Relative strength vs S&P 500 (VOO)' : 'Show relative strength vs S&P 500 (VOO)';
        const benchmarkToggle = page.getByRole('button', { name: benchmarkName, exact: true });
        const benchmarkResponse = waitChartResponse(benchmarkSymbol, 'US');
        await benchmarkToggle.click();
        assert.equal((await benchmarkResponse).status(), 200);
        check(`${mode} ${viewport.width}: optional US benchmark uses VOO`, apiRequests.some(item => item.path === '/api/research/chart/VOO' && item.search === '?market=US'));

        // Check keyboard navigation and the tab-to-panel accessibility relationship.
        await page.getByRole('tabpanel', { name: 'Chart & technicals', exact: true }).waitFor({ state: 'visible' });
        check(`${mode} ${viewport.width}: selected tab names its panel`,
            await page.getByRole('tabpanel', { name: 'Chart & technicals', exact: true }).isVisible());
        await visibleChartTab.focus();
        await page.keyboard.press('ArrowRight');
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Financials');
        check(`${mode} ${viewport.width}: ArrowRight selects the next tab`, true);
        await page.getByRole('tab', { name: 'Financials', exact: true }).focus();
        await page.keyboard.press('Home');
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Overview');
        check(`${mode} ${viewport.width}: Home selects the first tab`, true);
        await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
        await page.keyboard.press('End');
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Valuation');
        check(`${mode} ${viewport.width}: End selects the last visible tab`, true);
        const keyboardChartResponse = waitChartResponse('AAPL', 'US');
        await visibleChartTab.click();
        await keyboardChartResponse;
        await page.getByRole('tabpanel', { name: 'Chart & technicals', exact: true }).waitFor({ state: 'visible' });

        await page.getByRole('tab', { name: 'Financials', exact: true }).click();
        const financialGroups = page.getByRole('tabpanel').locator('dl').first();
        await financialGroups.waitFor({ state: 'visible' });
        const financialColumns = await financialGroups.evaluate(element => ({
            display: getComputedStyle(element).display,
            columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
            groups: [...element.children].map(group => ({
                display: getComputedStyle(group).display,
                columns: getComputedStyle(group).gridTemplateColumns.split(' ').filter(Boolean).length,
            })),
        }));
        check(`${mode} ${viewport.width}: financial summary uses ${viewport.width >= 901 ? 'three' : 'one'} column(s)`,
            financialColumns.display === 'grid' && financialColumns.columns === (viewport.width >= 901 ? 3 : 1)
                && financialColumns.groups.length === 3
                && financialColumns.groups.every(group => group.display === 'grid' && group.columns === 1));
        await page.screenshot({ path: `${output}/${mode}-${viewport.width}-financials.png`, fullPage: true });

        // Test error and recovery in a fresh page load so the first request is deterministic.
        chartMode = 'error';
        const failedPromise = waitChartResponse('AAPL', 'US');
        await go('?ticker=AAPL&market=US&tab=chart');
        const failed = await failedPromise;
        assert.equal(failed.status(), 502);
        await page.getByRole('button', { name: 'Retry' }).waitFor({ state: 'visible' });
        check(`${mode} ${viewport.width}: chart failure offers retry`, true);
        chartMode = 'ready';
        const retryResponse = waitChartResponse('AAPL', 'US');
        await page.getByRole('button', { name: 'Retry' }).click();
        assert.equal((await retryResponse).status(), 200);
        await page.getByTestId('research-chart-explorer').waitFor({ state: 'visible' });
        check(`${mode} ${viewport.width}: chart retry recovers`, true);

        if (mode === 'guest') {
            await page.getByRole('tab', { name: 'Overview', exact: true }).click();
            const note = page.getByLabel('Personal note for AAPL', { exact: true });
            await note.waitFor({ state: 'visible' });
            check(`guest ${viewport.width}: seeded note is available`, await note.inputValue() === 'QA note retained across tabs.');
            await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).click();
            await note.waitFor({ state: 'visible' });
            check(`guest ${viewport.width}: saved note remains visible across tabs`, await note.inputValue() === 'QA note retained across tabs.');

            // Switch to Malaysia and verify the market is part of the chart request key.
            await page.goto(`${base}/research-v8?ticker=MAYBANK&market=MY`, { waitUntil: 'domcontentloaded' });
            await page.getByRole('tablist', { name: 'Research investigation' }).waitFor({ state: 'visible' });
            await openChart('MAYBANK', 'MY');
            await page.getByTestId('research-chart-explorer').waitFor({ state: 'visible' });
            check(`guest ${viewport.width}: Malaysia chart request uses MY`, apiRequests.some(item => item.path === '/api/research/chart/MAYBANK' && item.search === '?market=MY'));
            const malaysiaBenchmarkName = viewport.width >= 900 ? 'Relative strength vs FBM KLCI' : 'Show relative strength vs FBM KLCI';
            if (viewport.width < 900) await page.getByTestId('research-chart-mobile-settings').locator('summary').click();
            const malaysiaBenchmarkResponse = waitChartResponse('KLCI', 'MY');
            await page.getByRole('button', { name: malaysiaBenchmarkName, exact: true }).click();
            assert.equal((await malaysiaBenchmarkResponse).status(), 200);
            check(`guest ${viewport.width}: optional Malaysia benchmark uses KLCI alias`, apiRequests.some(item => item.path === '/api/research/chart/KLCI' && item.search === '?market=MY'));
            check(`guest ${viewport.width}: guest data never calls owner watchlist`, forbiddenOwnerReads.length === 0);

            // Empty provider history stays empty, and a response for another identity is rejected.
            chartMode = 'empty';
            const emptyMalaysia = waitChartResponse('MAYBANK', 'MY');
            await page.getByRole('tab', { name: 'Overview', exact: true }).click();
            await switchWatchlistStock(page, 'MY:MAYBANK');
            await page.waitForFunction(() => {
                const identity = document.querySelector('[data-testid="selected-security-identity"]');
                return identity?.getAttribute('data-symbol') === 'MAYBANK' && identity.getAttribute('data-market') === 'MY';
            });
            await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).click();
            assert.equal((await emptyMalaysia).status(), 200);
            await page.getByRole('button', { name: 'Retry chart history', exact: true }).waitFor({ state: 'visible' });
            check(`guest ${viewport.width}: empty chart response shows no invented history`, await page.getByTestId('research-chart-explorer').count() === 0);
            chartMode = 'mismatch';
            const mismatchMalaysia = waitChartResponse('MAYBANK', 'MY');
            await page.getByRole('button', { name: 'Retry chart history', exact: true }).click();
            assert.equal((await mismatchMalaysia).status(), 200);
            await page.getByRole('button', { name: 'Retry', exact: true }).waitFor({ state: 'visible' });
            check(`guest ${viewport.width}: chart response for another identity is rejected`,
                (await page.getByTestId('research-chart-explorer').getAttribute('aria-label')).includes('MAYBANK'));
            chartMode = 'ready';
            const restoredMalaysia = waitChartResponse('MAYBANK', 'MY');
            await page.getByRole('button', { name: 'Retry', exact: true }).click();
            assert.equal((await restoredMalaysia).status(), 200);
            await page.getByTestId('research-chart-explorer').waitFor({ state: 'visible' });
            check(`guest ${viewport.width}: retry restores valid Malaysia history`, (await page.getByTestId('research-chart-explorer').getAttribute('aria-label')).includes('MAYBANK'));

            // Trigger a delayed request, then change securities using the in-page switcher.
            await page.getByRole('tab', { name: 'Overview', exact: true }).click();
            await switchWatchlistStock(page, 'US:AAPL');
            await page.waitForFunction(() => {
                const identity = document.querySelector('[data-testid="selected-security-identity"]');
                return identity?.getAttribute('data-symbol') === 'AAPL' && identity.getAttribute('data-market') === 'US';
            });
            delayedSymbol = 'AAPL';
            await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).click();
            await chartStarted;
            const selectedMalaysiaChart = waitChartResponse('MAYBANK', 'MY');
            await switchWatchlistStock(page, 'MY:MAYBANK');
            await page.waitForFunction(() => document.querySelector('[data-testid="selected-security-identity"]')?.getAttribute('data-symbol') === 'MAYBANK');
            assert.equal((await selectedMalaysiaChart).status(), 200);
            await page.getByTestId('research-chart-explorer').waitFor({ state: 'visible' });
            releaseDelayed?.();
            delayedSymbol = null;
            await page.waitForTimeout(200); // Allow the now-aborted request handler to settle.
            check(`guest ${viewport.width}: late US response does not replace selected Malaysia chart`, (await page.getByTestId('research-chart-explorer').getAttribute('aria-label')).includes('MAYBANK'));
        } else {
            check(`owner ${viewport.width}: isolated fixture record is visible`, await page.getByRole('article', { name: 'AAPL research' }).count() === 1);
            check(`owner ${viewport.width}: guest note fixture is not exposed`, await page.getByLabel(/Personal note for/).count() === 0 && !await page.getByText('QA note retained across tabs.', { exact: true }).count());
        }

        // The selected tab should survive a direct URL load and browser reload.
        await go('?ticker=AAPL&market=US&tab=chart');
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Chart & technicals');
        check(`${mode} ${viewport.width}: chart tab restores from URL`, await visibleChartTab.getAttribute('aria-selected') === 'true');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('tablist', { name: 'Research investigation' }).waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() === 'Chart & technicals');
        check(`${mode} ${viewport.width}: chart tab survives reload`, await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).getAttribute('aria-selected') === 'true');
        check(`${mode} ${viewport.width}: no owner data writes were sent`, mutations.length === 0);
        check(`${mode} ${viewport.width}: no browser runtime errors`, errors.length === 0);
    } finally {
        await context.close();
    }
}

async function alignFinancialSummary(page, summary, label) {
    await summary.evaluate(element => element.scrollIntoView({ block: 'start' }));
    const revenueLabel = summary.getByText('Annual revenue', { exact: true });
    const tablist = page.getByRole('tablist', { name: 'Research investigation' });
    const [labelTop, tabsBottom] = await Promise.all([
        revenueLabel.evaluate(element => element.getBoundingClientRect().top),
        tablist.evaluate(element => element.getBoundingClientRect().bottom),
    ]);
    await page.evaluate(offset => window.scrollBy(0, offset), labelTop - tabsBottom - 16);
    await page.waitForFunction(() => {
        const label = [...document.querySelectorAll('[role="tabpanel"] dt, [role="tabpanel"] dd')].find(element => element.textContent?.trim() === 'Annual revenue');
        const tabs = document.querySelector('[role="tablist"][aria-label="Research investigation"]');
        return label && tabs && label.getBoundingClientRect().top >= tabs.getBoundingClientRect().bottom + 15;
    });
    const [alignedLabelTop, alignedTabsBottom] = await Promise.all([
        revenueLabel.evaluate(element => element.getBoundingClientRect().top),
        tablist.evaluate(element => element.getBoundingClientRect().bottom),
    ]);
    check(`${label}: Annual revenue label clears sticky tabs`, alignedLabelTop >= alignedTabsBottom + 15);
}

async function runFinancialCapture(mode, symbol, market, viewport) {
    const context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    const writes = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    if (mode === 'fixture') {
        await page.route('**/api/**', async route => {
            const request = route.request();
            const url = new URL(request.url());
            if (request.method() !== 'GET') {
                writes.push(`${request.method()} ${url.pathname}`);
                return route.abort();
            }
            const body = url.pathname === '/api/owner/session'
                ? { success: true, data: { unlocked: false } }
                : url.pathname.startsWith('/api/research/symbol/')
                    ? snapshotFor(symbol, market)
                    : { success: true, data: [] };
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        });
    } else {
        page.on('request', request => { if (request.method() !== 'GET') writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
    }
    try {
        const response = await page.goto(`${base}/research-v8?ticker=${encodeURIComponent(symbol)}&market=${market}`, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.getByTestId('selected-security-identity').waitFor({ state: 'visible' });
        if (mode === 'real') {
            await page.waitForFunction(() => {
                const status = document.querySelector('[aria-label="Provider data status"] [role="status"]')?.textContent?.trim();
                return Boolean(status) && !status.startsWith('Loading provider data');
            }, null, { timeout: 60000 });
        }
        await page.getByRole('tab', { name: 'Financials', exact: true }).click();
        const summary = page.getByRole('tabpanel').locator('dl').first();
        await summary.waitFor({ state: 'visible' });
        await page.waitForFunction(() => document.querySelector('[role="tabpanel"] dl dt')?.textContent?.trim() === 'Annual revenue');
        assert.equal(await summary.locator(':scope > div').count(), 3);
        if (mode === 'fixture') {
            for (const value of ['USD 250 billion', 'USD 50 billion', 'USD 45 billion']) {
                check(`fixture ${viewport.width}: populated synthetic financial value ${value}`, await summary.getByText(value, { exact: true }).isVisible());
            }
            check(`fixture ${viewport.width}: synthetic values disclose their source`, await page.getByText('Provider sources: Synthetic QA fixture', { exact: true }).isVisible());
            const disclosure = summary.locator(':scope > div').first().locator('details');
            await disclosure.locator('summary').click();
            check(`fixture ${viewport.width}: annual amount disclosure opens with period and source`, await disclosure.evaluate(element => element.open) && await disclosure.getByText(/annual period ended/).count() > 0 && await disclosure.getByText(/Yahoo Finance/).count() > 0);
            await disclosure.locator('summary').click();
        }
        const columnCount = await summary.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
        assert.equal(columnCount, viewport.width >= 901 ? 3 : 1, `${viewport.width}px financial layout`);
        await alignFinancialSummary(page, summary, `${mode} ${symbol}/${market} ${viewport.width}`);
        const directory = mode === 'fixture' ? output : realOutput;
        await mkdir(directory, { recursive: true });
        const screenshot = `${directory}/${mode}-${symbol}-${market}-${viewport.width}-financials.png`;
        await page.screenshot({ path: screenshot, fullPage: false });
        assert.equal(writes.length, 0, 'financial capture must not write data');
        assert.deepEqual(errors, [], 'financial capture browser errors');
        return { mode, symbol, market, viewport: viewport.width, columns: columnCount, screenshot, writes, errors };
    } finally {
        await context.close();
    }
}

async function runResponsiveChartSmoke(viewport) {
    const context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    const writes = [];
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(`console: ${message.text()}`); });
    await page.route('**/api/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (request.method() !== 'GET') {
            writes.push(`${request.method()} ${url.pathname}`);
            return route.abort();
        }
        const body = url.pathname === '/api/owner/session'
            ? { success: true, data: { unlocked: false } }
            : url.pathname.startsWith('/api/research/symbol/')
                ? snapshotFor(url.pathname.split('/').at(-1), url.searchParams.get('market') ?? 'US')
                : url.pathname.startsWith('/api/research/chart/')
                    ? chartFor(url.pathname.split('/').at(-1), url.searchParams.get('market'))
                    : { success: true, data: [] };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    try {
        const response = await page.goto(`${base}/research-v8?ticker=AAPL&market=US`, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200);
        await page.getByTestId('selected-security-identity').waitFor({ state: 'visible' });
        const chartResponse = page.waitForResponse(result => new URL(result.url()).pathname === '/api/research/chart/AAPL');
        await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).click();
        assert.equal((await chartResponse).status(), 200);
        const explorer = page.getByTestId('research-chart-explorer');
        await explorer.waitFor({ state: 'visible' });

        if (viewport.width >= 900) {
            const clean = page.getByRole('group', { name: 'Chart setup' }).getByRole('button', { name: 'clean', exact: true });
            check(`responsive ${viewport.width}: Clean setup starts selected`, await clean.getAttribute('aria-pressed') === 'true');
            await page.getByRole('group', { name: 'Chart setup' }).getByRole('button', { name: 'trend', exact: true }).click();
            check(`responsive ${viewport.width}: Trend exposes Supertrend`, await page.getByText(/Supertrend: green up/).isVisible());
            await page.getByRole('group', { name: 'Momentum indicator' }).getByRole('button', { name: 'ADX', exact: true }).click();
            check(`responsive ${viewport.width}: ADX control selects its indicator`, await page.getByRole('group', { name: 'Momentum indicator' }).getByRole('button', { name: 'ADX', exact: true }).getAttribute('aria-pressed') === 'true');
            await page.getByRole('group', { name: 'Chart setup' }).getByRole('button', { name: 'levels', exact: true }).click();
            await page.getByRole('button', { name: 'Swing low', exact: true }).click();
            check(`responsive ${viewport.width}: Levels selects swing-low VWAP`, await page.getByRole('button', { name: 'Swing low', exact: true }).getAttribute('aria-pressed') === 'true');
            check(`responsive ${viewport.width}: estimated volume profile is available on desktop`, await page.getByRole('complementary', { name: 'Estimated visible-range volume profile' }).isVisible());
            const controlGeometry = await page.getByRole('group', { name: 'Chart setup' }).evaluate(group => {
                const parent = group.getBoundingClientRect();
                const buttons = [...group.querySelectorAll('button')].map(button => button.getBoundingClientRect());
                return { parent, buttons };
            });
            check(`responsive ${viewport.width}: setup controls share a baseline and fit their group`,
                controlGeometry.buttons.every(rect => Math.abs(rect.top - controlGeometry.buttons[0].top) <= 1 && Math.abs(rect.height - controlGeometry.buttons[0].height) <= 1)
                && controlGeometry.buttons.every(rect => rect.left >= controlGeometry.parent.left && rect.right <= controlGeometry.parent.right));
        } else {
            const mobileRange = page.getByTestId('research-chart-mobile-controls').getByRole('group', { name: 'Chart range' });
            await mobileRange.getByRole('button', { name: '3M', exact: true }).click();
            check(`responsive ${viewport.width}: mobile range change selects 3M`, await mobileRange.getByRole('button', { name: '3M', exact: true }).getAttribute('aria-pressed') === 'true');
            const settings = page.getByTestId('research-chart-mobile-settings');
            await settings.locator('summary').click();
            const setup = settings.getByRole('combobox', { name: /^Setup/ });
            const indicator = settings.getByRole('combobox', { name: /^Indicator/ });
            await setup.selectOption('trend');
            check(`responsive ${viewport.width}: mobile Trend exposes Supertrend`, await page.getByText(/Supertrend: green up/).isVisible());
            await indicator.selectOption('ADX');
            check(`responsive ${viewport.width}: mobile ADX control selects its indicator`, await indicator.inputValue() === 'ADX');
            await setup.selectOption('levels');
            const anchor = settings.getByRole('combobox', { name: /^Anchored VWAP/ });
            await anchor.selectOption('swing-low');
            check(`responsive ${viewport.width}: mobile Levels selects swing-low VWAP`, await anchor.inputValue() === 'swing-low');
            check(`responsive ${viewport.width}: estimated volume profile stays hidden on mobile`, !(await page.getByRole('complementary', { name: 'Estimated visible-range volume profile' }).isVisible().catch(() => false)));
            const controlGeometry = await settings.evaluate(element => {
                const details = element.getBoundingClientRect();
                const rows = [...element.querySelectorAll('label')].map(label => {
                    const labelBox = label.getBoundingClientRect();
                    const selectBox = label.querySelector('select').getBoundingClientRect();
                    return { labelBox, selectBox };
                });
                return { details, rows };
            });
            check(`responsive ${viewport.width}: mobile labels and selects retain vertical geometry`,
                controlGeometry.rows.length >= 3 && controlGeometry.rows.every(({ labelBox, selectBox }) =>
                    selectBox.height >= 40 && selectBox.left >= labelBox.left && selectBox.right <= labelBox.right && selectBox.top > labelBox.top
                    && labelBox.left >= controlGeometry.details.left && labelBox.right <= controlGeometry.details.right));
        }

        const slider = page.getByTestId('research-chart-slider');
        await explorer.focus();
        await explorer.press('Home');
        check(`responsive ${viewport.width}: chart Home selects first trading day`, await slider.inputValue() === '0');
        await explorer.press('End');
        check(`responsive ${viewport.width}: chart End selects latest trading day`, await slider.inputValue() === await slider.getAttribute('max'));
        const guide = page.getByTestId('indicator-guide');
        check(`responsive ${viewport.width}: indicator guide begins collapsed`, !(await guide.evaluate(element => element.open)));
        await guide.locator('summary').focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.querySelector('[data-testid="indicator-guide"]')?.open === true);
        check(`responsive ${viewport.width}: indicator guide opens by keyboard`, await guide.evaluate(element => element.open));
        const bounds = await page.evaluate(() => {
            const panel = document.querySelector('[role="tabpanel"]');
            const chart = document.querySelector('[data-testid="research-chart-explorer"]');
            const parent = panel.getBoundingClientRect();
            const child = chart.getBoundingClientRect();
            return { width: innerWidth, scrollWidth: document.documentElement.scrollWidth, parent: { left: parent.left, right: parent.right }, child: { left: child.left, right: child.right } };
        });
        check(`responsive ${viewport.width}: chart stays inside the panel without document overflow`,
            bounds.scrollWidth <= bounds.width + 1 && bounds.child.left >= bounds.parent.left - 1 && bounds.child.right <= bounds.parent.right + 1);
        await explorer.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${output}/guest-${viewport.width}-chart-controls.png`, fullPage: false });

        await page.getByRole('tab', { name: 'Financials', exact: true }).click();
        const financialSummary = page.getByRole('tabpanel').locator('dl').first();
        await financialSummary.waitFor({ state: 'visible' });
        const financialLayout = await financialSummary.evaluate(element => ({
            columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
            groups: [...element.children].map(group => group.getBoundingClientRect()),
        }));
        check(`responsive ${viewport.width}: Financials cards fit the intended columns`,
            financialLayout.columns === (viewport.width >= 901 ? 3 : 1) && financialLayout.groups.length === 3
                && (viewport.width >= 901
                    ? financialLayout.groups.every(rect => Math.abs(rect.top - financialLayout.groups[0].top) <= 1)
                        && financialLayout.groups[1].left >= financialLayout.groups[0].right
                        && financialLayout.groups[2].left >= financialLayout.groups[1].right
                    : financialLayout.groups.every((rect, index, all) => index === 0 || rect.top >= all[index - 1].bottom - 1)));
        await alignFinancialSummary(page, financialSummary, `responsive ${viewport.width}`);
        await page.screenshot({ path: `${output}/guest-${viewport.width}-financials.png`, fullPage: false });
        check(`responsive ${viewport.width}: no API writes or browser errors`, writes.length === 0 && errors.length === 0);
    } finally {
        await context.close();
    }
}

async function runRealProviderSmoke(symbol, market, viewport) {
    const context = await browser.newContext({ viewport, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    const writes = [];
    const errors = [];
    const payloadDirectory = realOutput;
    await mkdir(payloadDirectory, { recursive: true });
    page.on('request', request => { if (request.method() !== 'GET') writes.push(`${request.method()} ${new URL(request.url()).pathname}`); });
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('response', response => { if (new URL(response.url()).pathname.startsWith('/api/') && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    try {
        const response = await page.goto(`${base}/research-v8?ticker=${encodeURIComponent(symbol)}&market=${market}`, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200, `${symbol}/${market} page should load`);
        const notice = page.getByRole('button', { name: 'Dismiss notice', exact: true });
        if (await notice.isVisible().catch(() => false)) await notice.click();
        await page.getByTestId('selected-security-identity').waitFor({ state: 'visible' });
        await page.waitForFunction(({ symbol, market }) => {
            const identity = document.querySelector('[data-testid="selected-security-identity"]');
            return identity?.getAttribute('data-symbol') === symbol && identity.getAttribute('data-market') === market;
        }, { symbol, market });
        const chartResponse = page.waitForResponse(result => {
            const url = new URL(result.url());
            return url.pathname === `/api/research/chart/${symbol}` && url.searchParams.get('market') === market;
        });
        await page.getByRole('tab', { name: 'Chart & technicals', exact: true }).click();
        const chart = await chartResponse;
        assert.equal(chart.status(), 200, `${symbol}/${market} chart endpoint should return data`);
        const body = await chart.json();
        assert.equal(body.success, true, `${symbol}/${market} chart response should succeed`);
        assert.equal(body.data.symbol, symbol);
        assert.equal(body.data.market, market);
        assert.ok(body.data.chart.points.length > 100, `${symbol}/${market} should return substantial real history`);
        await page.getByTestId('research-chart-explorer').waitFor({ state: 'visible' });
        const chartLabel = await page.getByTestId('research-chart-explorer').getAttribute('aria-label');
        assert.ok(chartLabel.includes(symbol), `${symbol}/${market} chart should identify the selected security`);
        if (viewport.width >= 900) {
            await page.getByRole('group', { name: 'Momentum indicator' }).getByRole('button', { name: 'MACD', exact: true }).click();
        } else {
            await page.getByTestId('research-chart-mobile-settings').locator('summary').click();
            await page.getByRole('combobox', { name: /^Indicator/ }).selectOption('MACD');
        }
        await page.getByTestId('research-chart-explorer').scrollIntoViewIfNeeded();
        const tag = `${symbol}-${market}-${viewport.width}`;
        const chartScreenshot = `${payloadDirectory}/${tag}-chart.png`;
        await page.screenshot({ path: chartScreenshot, fullPage: false });
        const payloadPath = `${payloadDirectory}/${tag}-chart-response.json`;
        await writeFile(payloadPath, JSON.stringify(body, null, 2));

        await page.getByRole('tab', { name: 'Financials', exact: true }).click();
        const summary = page.getByRole('tabpanel').locator('dl').first();
        await summary.waitFor({ state: 'visible' });
        await alignFinancialSummary(page, summary, `real provider ${symbol}/${market} ${viewport.width}`);
        assert.equal(await summary.locator(':scope > div').count(), 3, `${symbol}/${market} financial cards should render`);
        const financialScreenshot = `${payloadDirectory}/${tag}-financials.png`;
        await page.screenshot({ path: financialScreenshot, fullPage: false });
        assert.equal(writes.length, 0, `${symbol}/${market} real-data smoke must be read-only`);
        assert.deepEqual(errors, [], `${symbol}/${market} API and browser errors`);
        checks.push(`real provider ${tag}: ${body.data.chart.points.length} chart observations, MACD and financial cards`);
        return { symbol, market, viewport: viewport.width, points: body.data.chart.points.length, payload: payloadPath, screenshots: [chartScreenshot, financialScreenshot], writes, errors };
    } finally {
        await context.close();
    }
}

try {
    if (process.env.SIGNAL_QA_FINANCIALS_ONLY === '1') {
        const captures = [];
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            captures.push(await runFinancialCapture('fixture', 'AAPL', 'US', viewport));
            captures.push(await runFinancialCapture('real', 'AAPL', 'US', viewport));
            captures.push(await runFinancialCapture('real', '5347', 'MY', viewport));
        }
        await writeFile(`${output}/financial-captures.json`, JSON.stringify({ status: 'pass', base, captures }, null, 2));
        console.log(JSON.stringify({ status: 'pass', financialCaptures: captures.length, output, realOutput }));
    } else {
        await runMode('guest', { width: 1440, height: 1000 });
        await runMode('guest', { width: 390, height: 844 });
        await runMode('owner', { width: 1440, height: 1000 });
        await runMode('owner', { width: 390, height: 844 });
        for (const width of [1280, 768, 375]) await runResponsiveChartSmoke({ width, height: width < 500 ? 812 : 900 });
        const realRuns = [];
        for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
            realRuns.push(await runRealProviderSmoke('AAPL', 'US', viewport));
            realRuns.push(await runRealProviderSmoke('5347', 'MY', viewport));
        }
        await writeFile(`${realOutput}/research-chart-v8-qa-index.json`, JSON.stringify({ status: 'pass', base, realRuns }, null, 2));
        await writeFile(`${output}/report.json`, JSON.stringify({ status: 'pass', base, checks, realRuns, output }, null, 2));
        console.log(JSON.stringify({ status: 'pass', checks: checks.length, output }));
    }
} catch (error) {
    await writeFile(`${output}/failure.json`, JSON.stringify({ status: 'failed', checks, error: error.message }, null, 2));
    throw error;
} finally {
    await browser.close();
}
