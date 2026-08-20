import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const argument = (name, fallback = null) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
};
const baseUrl = argument('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const timeout = Number(argument('--timeout', '20000'));
const baseOrigin = new URL(baseUrl).origin;
const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
];
const themes = ['light', 'dark'];
const artifactDirectory = path.resolve('.tmp', 'v7-phase2-interaction-qa', new Date().toISOString().replace(/[.:]/g, '-'));
await mkdir(artifactDirectory, { recursive: true });

const marketResponse = await fetch(`${baseUrl}/api/signals/v2?market=US&mode=standard&enableSocial=true`, {
    signal: AbortSignal.timeout(Math.max(timeout, 90000)),
}).then((response) => response.json());
if (!marketResponse?.success || !marketResponse.data) throw new Error('Unable to obtain a valid local Market fixture.');

const isoDate = (index) => {
    const date = new Date(Date.UTC(2025, 6, 1 + index));
    return date.toISOString().slice(0, 10);
};
const chartPoints = Array.from({ length: 400 }, (_, index) => {
    const base = 120 + index * 0.18 + Math.sin(index / 9) * 4;
    const open = base + Math.sin(index / 3) * 0.7;
    const close = base + Math.cos(index / 4) * 0.8;
    const high = Math.max(open, close) + 1.4;
    const low = Math.min(open, close) - 1.2;
    return {
        time: isoDate(index), open, high, low, close, volume: 1_000_000 + index * 2_500,
        ma50: base - 2, ma200: base - 8, averageVolume20: 1_050_000 + index * 2_200,
        ema20: base - 0.8, ema50: base - 2, sma200: base - 8,
        rsi14: 45 + Math.sin(index / 11) * 12,
        macd: Math.sin(index / 13) * 2, macdSignal: Math.sin((index - 2) / 13) * 1.8,
        macdHistogram: Math.sin(index / 13) * 2 - Math.sin((index - 2) / 13) * 1.8,
        atr14: 2.4, atrPercent14: 1.4, anchoredVwap: base - 1,
        adx14: 20 + Math.abs(Math.sin(index / 15)) * 16,
        plusDi14: 22 + Math.sin(index / 10) * 5, minusDi14: 18 - Math.sin(index / 10) * 5,
        supertrend: base - (Math.sin(index / 18) >= 0 ? 3 : -3),
        supertrendDirection: Math.sin(index / 18) >= 0 ? 1 : -1,
    };
});

const scoreHistory = Array.from({ length: 90 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 4, 23 + index)).toISOString(),
    score: 54 + Math.sin(index / 7) * 12 + index * 0.12,
    tier: marketResponse.data.tier,
    origin: index < 30 ? 'reconstructed' : 'observed',
    coverage_note: index < 30 ? 'Backfilled from the documented historical input set.' : null,
}));

const checklist = {
    understandBusiness: false, revenueGrowingOrStable: false, marginsHealthyOrImproving: false,
    debtManageable: false, freeCashFlowPositiveOrImproving: false, valuationReasonable: false,
    catalystOrCompoundingReason: false, downsideAcceptable: false, betterThanCashOrIndex: false,
};
const record = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned', inBuyZone: false,
    status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium',
    whyInterested: '', bullCase: 'PRIVATE_PHASE2_SENTINEL', bearCase: '', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
    checklist,
    monitoringRules: {
        buyZone: true, belowMa200: true, rsiBelow: 30, rsiAbove: null, earningsWithinDays: 21,
        reviewAgeDays: 30, structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
    },
    acceptedEvidence: [], documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: {
        decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null,
        benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null,
        priorOutcome: 'unresolved', outcomeNote: '',
    },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [], lastReviewedAt: '2026-08-01', updatedAt: '2026-08-01T00:00:00.000Z', revision: 1,
};
const records = [record, { ...record, symbol: 'NVDA', companyName: 'NVIDIA', bullCase: '', decisionJournal: { ...record.decisionJournal, decision: 'Ready' } }];
const snapshot = {
    symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-20T08:00:00.000Z',
    benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null, returnBasis: null, status: 'unavailable' },
    quote: { name: 'Microsoft', currency: 'USD', price: 191.4, dailyChangePercent: 0.5 },
    fundamentals: { revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null, freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null, source: null, history: [] },
    valuation: { marketCap: null, priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null, netCash: null, reportingPeriod: null, source: null },
    technicals: { ma50: 182, ma200: 170, rsi14: 57, macd: 1.4, low52Week: 120, high52Week: 196, averageVolume20: 1_800_000, support: 180, resistance: 196 },
    chart: { interval: '1d', points: chartPoints.slice(-132) }, sources: ['Yahoo Finance'], warnings: [],
};
const policy = { version: 1, maxSingleAllocationPercent: 20, maxSectorAllocationPercent: 35, minEvidenceCoveragePercent: 40, maxReviewAgeDays: 90, requireFairOrCheapForReady: true };

const report = { command: 'npm run qa:v7-phase2', baseUrl, artifactDirectory, scenarios: [], failures: [] };
const check = (condition, message) => { if (!condition) throw new Error(message); };
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const documentOverflow = (page) => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0) - window.innerWidth);
const createState = () => ({
    symbolMode: 'success', symbolDelay: 0, symbolChartEmpty: false,
    chartMode: 'success', benchmarkMode: 'success', chartDelay: 0,
    requestUrls: [], mutations: [], blocking: [], expectedFailures: new Set(),
});

const fixtureSignal = (requestUrl) => {
    const url = new URL(requestUrl);
    const data = structuredClone(marketResponse.data);
    data.market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US';
    data.mode = url.searchParams.get('mode') === 'contrarian' ? 'contrarian' : 'standard';
    data.metadata.score_history = scoreHistory;
    data.metadata.score_delta = { ...data.metadata.score_delta, snapshot_date: scoreHistory.at(-1).date };
    return { success: true, data };
};

const preparePage = async (context, state) => {
    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        if (message.text().startsWith('Failed to load resource:') && state.expectedFailures.size > 0) return;
        state.blocking.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => state.blocking.push(`pageerror: ${error.message}`));
    page.on('request', (request) => state.requestUrls.push(request.url()));
    page.on('requestfailed', (request) => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) state.blocking.push(`requestfailed: ${request.method()} ${request.url()}`);
    });
    page.on('response', (response) => {
        if (response.status() < 400) return;
        const url = new URL(response.url());
        if (url.origin === baseOrigin && !state.expectedFailures.has(url.pathname)) state.blocking.push(`HTTP ${response.status()} ${url.pathname}`);
    });
    await page.route('**/api/signals/v2?**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureSignal(route.request().url())) }));
    await page.route('**/api/research/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (['PATCH', 'PUT', 'DELETE'].includes(request.method()) || (request.method() === 'POST' && url.pathname.startsWith('/api/research/watchlist'))) state.mutations.push(`${request.method()} ${url.pathname}`);
        if (url.pathname === '/api/research/watchlist') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: records, archivedSymbols: [] }) });
        if (url.pathname === '/api/research/inbox') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: snapshot.fetchedAt, monitoredCount: records.length, items: [], warnings: [] } }) });
        if (url.pathname === '/api/research/quotes') {
            const inputs = request.postDataJSON();
            const items = Array.isArray(inputs) ? inputs.map((input) => ({ success: true, data: { symbol: input.symbol, market: input.market, providerSymbol: input.symbol, fetchedAt: snapshot.fetchedAt, quote: { ...snapshot.quote, name: input.symbol === 'NVDA' ? 'NVIDIA' : 'Microsoft' } } })) : [];
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { fetchedAt: snapshot.fetchedAt, items } }) });
        }
        if (url.pathname.startsWith('/api/research/symbol/')) {
            if (state.symbolDelay > 0) await delay(state.symbolDelay);
            if (state.symbolMode === 'failure') {
                state.expectedFailures.add(url.pathname);
                return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Fixture provider failure' }) });
            }
            const symbol = url.pathname.split('/').at(-1) ?? 'MSFT';
            const data = { ...snapshot, symbol, quote: { ...snapshot.quote, name: symbol === 'NVDA' ? 'NVIDIA' : 'Microsoft' }, chart: { interval: '1d', points: state.symbolChartEmpty ? [] : chartPoints.slice(-132) } };
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
        }
        if (url.pathname.startsWith('/api/research/chart/')) {
            if (state.chartDelay > 0) await delay(state.chartDelay);
            const symbol = url.pathname.split('/').at(-1) ?? 'MSFT';
            const mode = symbol === 'VOO' ? state.benchmarkMode : state.chartMode;
            if (mode === 'failure') {
                state.expectedFailures.add(url.pathname);
                return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Fixture history failure' }) });
            }
            const points = mode === 'empty' ? [] : chartPoints.map((point) => symbol === 'VOO' ? { ...point, close: point.close * 0.8, open: point.open * 0.8, high: point.high * 0.8, low: point.low * 0.8 } : point);
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { chart: { interval: '1d', points } } }) });
        }
        if (url.pathname.startsWith('/api/research/quote/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { quote: snapshot.quote } }) });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });
    return page;
};

const initializeTheme = (theme) => async (context) => {
    await context.addInitScript(({ selectedTheme, savedPolicy }) => {
        localStorage.setItem('signal-dashboard-theme-v2', selectedTheme);
        localStorage.setItem('signal-investment-policy-v1', JSON.stringify(savedPolicy));
    }, { selectedTheme: theme, savedPolicy: policy });
};

const exerciseMarketExplorer = async (page, viewport, name, screenshots) => {
    await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
    const explorer = page.getByTestId('market-score-history-explorer');
    await explorer.waitFor({ state: 'visible' });
    await explorer.getByRole('button', { name: 'All', exact: true }).click();
    const slider = explorer.getByTestId('market-score-history-slider');
    const maximum = Number(await slider.getAttribute('max'));
    const latest = await explorer.getByTestId('market-score-history-readout').textContent();
    const chart = explorer.locator('svg[tabindex="0"]:visible');
    await chart.focus();
    await page.keyboard.press('Home');
    if (maximum > 0) check(await explorer.getByTestId('market-score-history-readout').textContent() !== latest, `${name}: Market Home did not move the readout`);
    await page.keyboard.press('ArrowRight');
    check(Number(await slider.inputValue()) === Math.min(1, maximum), `${name}: Market ArrowRight did not advance one point`);
    await page.keyboard.press('End');
    if (viewport.width === 375 && maximum > 0) {
        const bounds = await slider.boundingBox();
        if (bounds) await page.touchscreen.tap(bounds.x + bounds.width * 0.2, bounds.y + bounds.height / 2);
        check(Number(await slider.inputValue()) < maximum, `${name}: Market touch-equivalent control did not select a prior point`);
    } else if (maximum > 0) {
        const bounds = await chart.boundingBox();
        if (bounds) await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + bounds.height * 0.5);
        check(Number(await slider.inputValue()) < maximum, `${name}: Market pointer did not select a prior point`);
    }
    await page.mouse.move(0, 0);
    check(await explorer.getByTestId('market-score-history-readout').textContent() !== latest || maximum === 0, `${name}: Market readout did not persist after exploration`);
    const advancedEvidence = page.getByTestId('market-advanced-evidence');
    await advancedEvidence.locator('summary').first().click();
    const scoreExplanation = advancedEvidence.locator('section[aria-labelledby="score-evidence-title"]');
    const scoreExplanationText = await scoreExplanation.textContent() ?? '';
    check(['Trend', 'Last signal change'].every((label) => scoreExplanationText.includes(label)), `${name}: promoted score history removed existing trend context`);
    check(await documentOverflow(page) <= 1, `${name}: Market document overflow`);
    const screenshot = path.join(artifactDirectory, `${name}-market-score-explorer.png`);
    await explorer.screenshot({ path: screenshot, caret: 'initial' });
    screenshots.push(screenshot);
};

const exerciseResearchExplorer = async (page, state, viewport, theme, name, screenshots) => {
    await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT&tab=chart&future=keep`, { waitUntil: 'domcontentloaded' });
    const readout = page.getByTestId('research-chart-readout');
    await readout.waitFor({ state: 'visible' });
    const cleanReadout = await readout.textContent();
    check(['Open', 'High', 'Low', 'Close', 'Volume', 'EMA20', 'EMA50', 'SMA200', 'RSI (14)', 'Average volume (20d)', 'ATR (14)'].every((label) => cleanReadout.includes(label)), `${name}: clean OHLCV/indicator readout is incomplete`);
    await page.getByRole('group', { name: 'Chart range' }).getByRole('button', { name: '5Y' }).click();
    const slider = page.getByTestId('research-chart-slider');
    await page.waitForFunction(() => {
        const input = document.querySelector('[data-testid="research-chart-slider"]');
        return input instanceof HTMLInputElement && Number(input.max) > 131 && input.value === input.max;
    });
    const chart = page.getByTestId('research-chart-explorer');
    const maximum = Number(await slider.getAttribute('max'));
    await chart.press('Home');
    const homeValue = Number(await slider.inputValue());
    const activeElement = await page.evaluate(() => document.activeElement instanceof HTMLElement ? `${document.activeElement.tagName}:${document.activeElement.dataset.testid ?? document.activeElement.getAttribute('aria-label') ?? ''}` : 'unknown');
    check(homeValue === 0, `${name}: Research Home did not select the first point (value ${homeValue} of ${maximum}; active ${activeElement})`);
    await chart.press('ArrowRight');
    check(Number(await slider.inputValue()) === Math.min(1, maximum), `${name}: Research ArrowRight did not advance one point`);
    await chart.press('End');
    if (viewport.width === 375 && maximum > 0) {
        await page.getByRole('button', { name: 'Previous trading day' }).tap();
        check(Number(await slider.inputValue()) < maximum, `${name}: Research touch-equivalent control did not select a prior point`);
    } else {
        const bounds = await chart.boundingBox();
        if (bounds && maximum > 0) await page.mouse.move(bounds.x + bounds.width * 0.25, bounds.y + bounds.height * 0.35);
        check(Number(await slider.inputValue()) < maximum || maximum === 0, `${name}: Research pointer did not select a prior point`);
    }
    if (viewport.width < 900) {
        const settings = page.getByTestId('research-chart-mobile-settings');
        await settings.locator('summary').click();
        await settings.getByLabel('Setup').selectOption('levels');
        await settings.getByLabel('Indicator').selectOption('MACD');
        await settings.getByLabel('Anchored VWAP').selectOption('swing-low');
        await settings.getByRole('button', { name: /Show relative strength/ }).click();
        await page.getByText(/Relative-strength pane/).waitFor({ state: 'visible' });
        await settings.locator('summary').click();
        const summary = await settings.locator('summary').textContent();
        check(summary.includes('levels') && summary.includes('MACD') && summary.includes('swing low') && summary.includes('S&P 500'), `${name}: mobile Chart summary hid active state`);
        if (viewport.width === 375 && theme === 'light') {
            const tickerSelector = page.getByTestId('research-mobile-ticker-selector');
            await tickerSelector.waitFor({ state: 'visible' });
            const historyBefore = await page.evaluate(() => history.length);
            await tickerSelector.getByRole('button', { name: /Next ticker, NVDA/ }).tap();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA' && url.searchParams.get('future') === 'keep');
            check(await page.evaluate(() => history.length) === historyBefore + 1, `${name}: next ticker did not push history`);
            const picker = page.getByLabel('Ticker picker');
            await picker.selectOption('MSFT');
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'MSFT' && url.searchParams.get('future') === 'keep' && !url.searchParams.has('tab'));
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.getByTestId('research-mobile-ticker-selector').waitFor({ state: 'visible' });
            check(await page.getByLabel('Ticker picker').inputValue() === 'MSFT', `${name}: ticker picker did not restore after reload`);
            await page.goBack();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA');
            await page.goForward();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'MSFT');
            await page.getByRole('tab', { name: 'Chart' }).click();
            await page.getByTestId('research-chart-readout').waitFor({ state: 'visible' });
        }
    } else {
        await page.getByRole('group', { name: 'Chart range' }).getByRole('button', { name: '1M' }).click();
        const setupControls = page.getByRole('group', { name: 'Chart setup' });
        await setupControls.getByRole('button', { name: 'trend' }).click();
        const trendReadout = await readout.textContent();
        check(['EMA50', 'SMA200', 'Supertrend'].every((label) => trendReadout.includes(label)), `${name}: trend overlay readout is incomplete`);
        await setupControls.getByRole('button', { name: 'levels' }).click();
        await page.getByRole('group', { name: 'Momentum indicator' }).getByRole('button', { name: 'MACD' }).click();
        await page.getByRole('button', { name: 'Swing low' }).click();
        await page.getByRole('button', { name: /Relative strength vs/ }).click();
        await page.getByText(/Relative-strength pane/).waitFor({ state: 'visible' });
    }
    const table = page.getByTestId('research-chart-data-table');
    await table.locator('summary').click();
    const rows = table.locator('tbody tr');
    await rows.first().waitFor({ state: 'visible' });
    check(await rows.count() > 1, `${name}: chronological data table is empty`);
    const firstDate = await rows.first().locator('th').textContent();
    const lastDate = await rows.last().locator('th').textContent();
    check(Date.parse(firstDate) <= Date.parse(lastDate), `${name}: chart table is not chronological`);
    await table.locator('summary').click();
    check(await documentOverflow(page) <= 1, `${name}: Research document overflow`);
    const section = page.locator('section[aria-labelledby="research-chart-heading"]');
    const screenshot = path.join(artifactDirectory, `${name}-research-chart-explorer.png`);
    await section.screenshot({ path: screenshot, caret: 'initial' });
    screenshots.push(screenshot);
    check(state.mutations.length === 0, `${name}: explorer emitted Research mutations: ${state.mutations.join(', ')}`);
    check(!state.requestUrls.some((url) => url.includes('PRIVATE_PHASE2_SENTINEL')), `${name}: authored Research content entered a URL`);
};

const browser = await chromium.launch({ headless: true });
try {
    for (const theme of themes) {
        for (const viewport of viewports) {
            const name = `matrix-${theme}-${viewport.name}`;
            const scenario = { name, status: 'failed', screenshots: [] };
            report.scenarios.push(scenario);
            const state = createState();
            const context = await browser.newContext({ viewport, hasTouch: viewport.width === 375 });
            await initializeTheme(theme)(context);
            const page = await preparePage(context, state);
            try {
                await exerciseMarketExplorer(page, viewport, name, scenario.screenshots);
                await exerciseResearchExplorer(page, state, viewport, theme, name, scenario.screenshots);
                check(state.blocking.length === 0, `${name}: ${state.blocking.join(' | ')}`);
                scenario.status = 'passed';
            } catch (error) {
                scenario.error = error instanceof Error ? error.message : String(error);
                report.failures.push(`${name}: ${scenario.error}`);
            } finally {
                await context.close();
            }
        }
    }

    {
        const scenario = { name: 'research-loading-empty-failure-retry-and-retained-data', status: 'failed' };
        report.scenarios.push(scenario);
        const state = createState();
        state.symbolDelay = 500;
        state.chartMode = 'failure';
        state.benchmarkMode = 'failure';
        const context = await browser.newContext({ viewport: viewports[0] });
        await initializeTheme('light')(context);
        const page = await preparePage(context, state);
        try {
            await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT&tab=chart`, { waitUntil: 'domcontentloaded' });
            await page.getByText('Loading live quote and provider facts...').waitFor({ state: 'visible' });
            await page.getByText('Five-year history is unavailable. Shorter ranges remain usable.').waitFor({ state: 'visible' });
            check(await page.getByTestId('research-chart-readout').isVisible(), 'Retained snapshot chart disappeared after history failure');
            state.chartMode = 'success';
            await page.getByRole('button', { name: 'Retry' }).click();
            await page.getByRole('group', { name: 'Chart range' }).getByRole('button', { name: '5Y' }).click();
            await page.waitForFunction(() => Number(document.querySelector('[data-testid="research-chart-slider"]')?.getAttribute('max')) > 131);
            await page.getByRole('button', { name: /Relative strength vs/ }).click();
            await page.getByText(/comparison is unavailable/).waitFor({ state: 'visible' });
            check(await page.getByTestId('research-chart-readout').isVisible(), 'Price chart disappeared after benchmark failure');
            state.benchmarkMode = 'success';
            await page.getByRole('button', { name: 'Retry comparison' }).click();
            await page.getByText(/Relative-strength pane/).waitFor({ state: 'visible' });

            const emptyState = createState();
            emptyState.symbolChartEmpty = true;
            emptyState.chartMode = 'empty';
            const emptyPage = await preparePage(context, emptyState);
            await emptyPage.goto(`${baseUrl}/research?workspace=research&ticker=MSFT&tab=chart`, { waitUntil: 'domcontentloaded' });
            await emptyPage.getByText('Historical chart data is unavailable for this ticker. The saved research and technical summary remain usable.').waitFor({ state: 'visible' });
            await emptyPage.close();

            const failureState = createState();
            failureState.symbolMode = 'failure';
            const failurePage = await preparePage(context, failureState);
            await failurePage.goto(`${baseUrl}/research?workspace=research&ticker=MSFT&tab=chart`, { waitUntil: 'domcontentloaded' });
            await failurePage.getByText(/Live provider data is unavailable. Saved research remains visible./).waitFor({ state: 'visible' });
            check(await failurePage.locator('#research-detail').getByRole('heading', { name: 'MSFT' }).isVisible(), 'Saved ticker identity disappeared after provider failure');
            failureState.symbolMode = 'success';
            await failurePage.getByRole('button', { name: 'Retry' }).click();
            await failurePage.getByTestId('research-chart-readout').waitFor({ state: 'visible' });
            await failurePage.close();
            check(state.blocking.length === 0 && emptyState.blocking.length === 0 && failureState.blocking.length === 0, [...state.blocking, ...emptyState.blocking, ...failureState.blocking].join(' | '));
            scenario.status = 'passed';
        } catch (error) {
            scenario.error = error instanceof Error ? error.message : String(error);
            report.failures.push(`${scenario.name}: ${scenario.error}`);
        } finally {
            await context.close();
        }
    }

    {
        const scenario = { name: 'reduced-motion-and-v6-rollback-isolation', status: 'failed' };
        report.scenarios.push(scenario);
        const state = createState();
        const context = await browser.newContext({ viewport: viewports[2], hasTouch: true, reducedMotion: 'reduce' });
        await initializeTheme('dark')(context);
        await context.addInitScript(() => {
            window.__phase2ScrollBehaviors = [];
            const original = Element.prototype.scrollIntoView;
            Element.prototype.scrollIntoView = function scrollIntoView(options) {
                window.__phase2ScrollBehaviors.push(typeof options === 'object' ? options.behavior ?? 'auto' : 'auto');
                return original.call(this, options);
            };
        });
        const page = await preparePage(context, state);
        try {
            await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT&tab=chart`, { waitUntil: 'domcontentloaded' });
            await page.getByTestId('research-chart-readout').waitFor({ state: 'visible' });
            await page.getByTestId('research-mobile-ticker-selector').getByRole('button', { name: /Next ticker/ }).tap();
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA');
            check((await page.evaluate(() => window.__phase2ScrollBehaviors)).every((behavior) => behavior === 'auto'), 'Reduced motion retained smooth programmatic scrolling');
            await page.goto(`${baseUrl}/main-v6`, { waitUntil: 'domcontentloaded' });
            await page.locator('#market-story-title').waitFor({ state: 'visible' });
            check(await page.getByTestId('market-score-history-explorer').count() === 0, 'Market V6 received the V7 score explorer');
            await page.goto(`${baseUrl}/research-v6?workspace=research&ticker=MSFT&tab=chart`, { waitUntil: 'domcontentloaded' });
            await page.locator('[data-research-chart]').waitFor({ state: 'visible' });
            check(await page.getByTestId('research-chart-readout').count() === 0, 'Research V6 received the V7 chart readout');
            check(await page.getByTestId('research-mobile-ticker-selector').count() === 0, 'Research V6 received the V7 ticker selector');
            check(state.blocking.length === 0, state.blocking.join(' | '));
            scenario.status = 'passed';
        } catch (error) {
            scenario.error = error instanceof Error ? error.message : String(error);
            report.failures.push(`${scenario.name}: ${scenario.error}`);
        } finally {
            await context.close();
        }
    }
} finally {
    await browser.close();
}

report.completedAt = new Date().toISOString();
await writeFile(path.join(artifactDirectory, 'report.json'), JSON.stringify(report, null, 2));
for (const scenario of report.scenarios) console.log(`${scenario.status === 'passed' ? 'PASS' : 'FAIL'} ${scenario.name}${scenario.error ? `: ${scenario.error}` : ''}`);
console.log(`Artifacts: ${artifactDirectory}`);
if (report.failures.length > 0) process.exitCode = 1;
