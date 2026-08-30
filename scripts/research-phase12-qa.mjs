import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const argument = (name, fallback = null) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
};

const baseUrl = argument('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const requestedViewport = argument('--viewport');
const viewports = requestedViewport
    ? [{ width: Number(requestedViewport), height: Number(argument('--height', '900')) }]
    : [{ width: 1440, height: 1000 }, { width: 390, height: 844 }];
const timeout = 20_000;
const baseOrigin = new URL(baseUrl).origin;
const artifactDirectory = path.resolve('.tmp', 'research-phase12-qa', new Date().toISOString().replace(/[.:]/g, '-'));
await mkdir(artifactDirectory, { recursive: true });

const checklist = {
    understandBusiness: false,
    revenueGrowingOrStable: false,
    marginsHealthyOrImproving: false,
    debtManageable: false,
    freeCashFlowPositiveOrImproving: false,
    valuationReasonable: false,
    catalystOrCompoundingReason: false,
    downsideAcceptable: false,
    betterThanCashOrIndex: false,
};

const createRecord = (symbol, companyName) => ({
    symbol,
    market: 'US',
    companyName,
    positionState: 'not-owned',
    inBuyZone: false,
    status: 'watch',
    targetBuyZone: '',
    valuationState: 'unknown',
    thesisStrength: 'medium',
    whyInterested: '',
    bullCase: '',
    bearCase: '',
    buyTrigger: '',
    sellTrigger: '',
    thesisBreak: '',
    notes: '',
    checklist,
    monitoringRules: {
        buyZone: true,
        belowMa200: true,
        rsiBelow: 30,
        rsiAbove: null,
        earningsWithinDays: 21,
        reviewAgeDays: 30,
        structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
    },
    acceptedEvidence: [],
    documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: {
        decision: 'Watch',
        confidence: 'medium',
        observedPrice: null,
        benchmarkLabel: null,
        benchmarkReturnPercent: null,
        nextReviewAt: null,
        priorReviewId: null,
        priorOutcome: 'unresolved',
        outcomeNote: '',
    },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [],
    lastReviewedAt: '2026-08-29',
    updatedAt: '2026-08-29T00:00:00.000Z',
    revision: 1,
});

const records = [createRecord('MSFT', 'Microsoft'), createRecord('NVDA', 'NVIDIA')];

const createSnapshot = (symbol) => ({
    symbol,
    market: 'US',
    fetchedAt: '2026-08-30T08:00:00.000Z',
    benchmark: {
        baselineSymbol: 'VOO',
        baselineName: 'Vanguard S&P 500 ETF',
        period: '1Y',
        candidateReturnPercent: null,
        baselineReturnPercent: null,
        relativeReturnPercent: null,
        returnBasis: null,
        status: 'unavailable',
    },
    quote: {
        name: symbol === 'NVDA' ? 'NVIDIA' : symbol === 'VOO' ? 'Vanguard S&P 500 ETF' : 'Microsoft',
        currency: 'USD',
        price: symbol === 'NVDA' ? 182 : symbol === 'VOO' ? 610 : 425,
        dailyChangePercent: 0.5,
    },
    fundamentals: {
        revenueGrowthPercent: null,
        grossMarginPercent: null,
        operatingMarginPercent: null,
        freeCashFlow: null,
        debt: null,
        cash: null,
        shares: null,
        annualRevenue: null,
        annualNetIncome: null,
        reportingPeriod: null,
        shareChangePercent: null,
        source: null,
        history: [],
    },
    valuation: {
        marketCap: null,
        priceEarnings: null,
        priceSales: null,
        freeCashFlowYieldPercent: null,
        netCash: null,
        reportingPeriod: null,
        source: null,
    },
    technicals: {
        ma50: null,
        ma200: null,
        rsi14: null,
        macd: null,
        low52Week: null,
        high52Week: null,
        averageVolume20: null,
        support: null,
        resistance: null,
    },
    chart: { interval: '1d', points: [] },
    sources: ['Yahoo Finance'],
    warnings: [],
});

const failures = [];
const browser = await chromium.launch({ headless: true });

try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const blocking = [];
        const memoryRequests = [];

        page.on('console', (message) => {
            if (message.type() === 'error') blocking.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
        page.on('requestfailed', (request) => {
            if (!request.failure()?.errorText.includes('ERR_ABORTED')) {
                blocking.push(`requestfailed: ${request.method()} ${new URL(request.url()).pathname}`);
            }
        });
        page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin === baseOrigin && response.status() >= 400) blocking.push(`HTTP ${response.status()} ${url.pathname}`);
        });

        await page.route('**/api/research/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.pathname === '/api/research/watchlist') {
                await new Promise((resolve) => setTimeout(resolve, 150));
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: records, archivedSymbols: [] }) });
            }
            if (url.pathname === '/api/research/inbox') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-08-30T08:00:00.000Z', monitoredCount: records.length, items: [], warnings: [] } }) });
            }
            if (url.pathname.startsWith('/api/research/symbol/')) {
                await new Promise((resolve) => setTimeout(resolve, 250));
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: createSnapshot(symbol) }) });
            }
            if (url.pathname.startsWith('/api/research/memory/')) {
                const symbol = decodeURIComponent(url.pathname.split('/').at(-1));
                memoryRequests.push(`${request.method()} ${symbol}`);
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: request.method() === 'GET' ? [] : { saved: true } }) });
            }
            if (url.pathname === '/api/research/quotes') {
                const requested = request.postDataJSON();
                const data = Array.isArray(requested)
                    ? requested.map(({ symbol }) => ({ symbol, success: true, data: { symbol, quote: createSnapshot(symbol).quote } }))
                    : [];
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
        });

        try {
            await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT`, { waitUntil: 'domcontentloaded', timeout });
            const memory = page.getByTestId('research-memory-dock');
            await memory.getByRole('heading', { name: 'MSFT · What changed and what needs review' }).waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Decision Memory did not render exactly once after delayed mounting');
            if (!memoryRequests.includes('GET MSFT') || !memoryRequests.includes('POST MSFT')) throw new Error(`MSFT memory persistence path was incomplete: ${memoryRequests.join(', ')}`);

            const tickerPicker = page.getByTestId('research-mobile-ticker-selector').locator('select');
            await tickerPicker.selectOption('NVDA', { force: true });
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'NVDA', { timeout });
            await memory.getByRole('heading', { name: 'NVDA · What changed and what needs review' }).waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Ticker change created a duplicate Decision Memory surface');
            if (!memoryRequests.includes('GET NVDA') || !memoryRequests.includes('POST NVDA')) throw new Error(`NVDA memory persistence path was incomplete: ${memoryRequests.join(', ')}`);

            if (viewport.width >= 700) {
                await page.getByRole('button', { name: 'Activity', exact: true }).click();
            } else {
                await page.getByLabel('Research section').selectOption('activity');
            }
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'today', { timeout });
            if (await memory.count() !== 0) throw new Error('Decision Memory remained mounted outside the selected-security workspace');
            await page.goBack({ waitUntil: 'domcontentloaded' });
            await memory.getByRole('heading', { name: 'NVDA · What changed and what needs review' }).waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Back navigation duplicated Decision Memory');
            if (new URL(page.url()).searchParams.get('ticker') !== 'NVDA') throw new Error('Back navigation did not preserve the selected ticker');

            await tickerPicker.selectOption('VOO', { force: true });
            await page.waitForURL((url) => url.searchParams.get('ticker') === 'VOO', { timeout });
            await memory.getByText('Save this security to Research before Signal can build persistent decision memory for it.').waitFor({ state: 'visible', timeout });
            if (await memory.count() !== 1) throw new Error('Unsaved state did not retain exactly one Decision Memory surface');

            const layout = await page.evaluate(() => ({
                documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                memoryCount: document.querySelectorAll('[data-testid="research-memory-dock"]').length,
            }));
            if (layout.documentOverflow > 1) throw new Error(`page-level horizontal overflow detected (${layout.documentOverflow}px)`);
            if (layout.memoryCount !== 1) throw new Error(`DOM contains ${layout.memoryCount} Decision Memory surfaces`);
            if (blocking.length > 0) throw new Error(blocking.join(' | '));

            await page.screenshot({ path: path.join(artifactDirectory, `ux-001-${viewport.width}x${viewport.height}.png`), fullPage: true });
            console.log(`PASS UX-001 Decision Memory ${viewport.width}x${viewport.height}`);
        } catch (error) {
            failures.push(`${viewport.width}x${viewport.height}: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            await context.close();
        }
    }
} finally {
    await browser.close();
}

if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Screenshots: ${artifactDirectory}`);
    console.log('Phase 12 Research QA passed.');
}
