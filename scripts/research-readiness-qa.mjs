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
    ? [{ width: Number(requestedViewport), height: 900 }]
    : [{ width: 1280, height: 900 }, { width: 768, height: 900 }, { width: 375, height: 812 }];
const timeout = 15_000;
const artifactDirectory = path.resolve('.tmp', 'research-readiness-qa', new Date().toISOString().replace(/[.:]/g, '-'));
await mkdir(artifactDirectory, { recursive: true });

const checklist = {
    understandBusiness: false, revenueGrowingOrStable: false, marginsHealthyOrImproving: false,
    debtManageable: false, freeCashFlowPositiveOrImproving: false, valuationReasonable: false,
    catalystOrCompoundingReason: false, downsideAcceptable: false, betterThanCashOrIndex: false,
};
const record = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned', inBuyZone: false,
    status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium',
    whyInterested: '', bullCase: '', bearCase: '', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
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
    reviewHistory: [], lastReviewedAt: '2026-07-20', updatedAt: '2026-07-26T00:00:00.000Z', revision: 1,
};
const snapshot = {
    symbol: 'MSFT', market: 'US', fetchedAt: '2026-07-31T08:00:00.000Z',
    benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null, returnBasis: null, status: 'unavailable' },
    quote: { name: 'Microsoft', currency: 'USD', price: 425, dailyChangePercent: 0.5 },
    fundamentals: { revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null, freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null, source: null, history: [] },
    valuation: { marketCap: null, priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null, netCash: null, reportingPeriod: null, source: null },
    technicals: { ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null, averageVolume20: null, support: null, resistance: null },
    chart: { interval: '1d', points: [] }, sources: ['Yahoo Finance'], warnings: [],
};
const policy = { version: 1, maxSingleAllocationPercent: 20, maxSectorAllocationPercent: 35, minEvidenceCoveragePercent: 40, maxReviewAgeDays: 90, requireFairOrCheapForReady: true };
const failures = [];
const baseOrigin = new URL(baseUrl).origin;

const openResearch = async (page) => {
    await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT`, { waitUntil: 'domcontentloaded', timeout });
    await page.getByTestId('research-readiness-strip').waitFor({ state: 'visible', timeout });
};

const expectDestination = async (page, buttonTestId, destination) => {
    await openResearch(page);
    await page.getByTestId('research-readiness-details').locator('summary').click();
    await page.getByTestId(buttonTestId).click();
    await page.waitForURL((url) => url.searchParams.get('workspace') === destination.workspace
        && (!destination.tab || url.searchParams.get('tab') === destination.tab)
        && (!destination.review || url.searchParams.get('review') === destination.review), { timeout });
};

const browser = await chromium.launch({ headless: true });
try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        await context.addInitScript((savedPolicy) => localStorage.setItem('signal-investment-policy-v1', JSON.stringify(savedPolicy)), policy);
        const page = await context.newPage();
        const blocking = [];
        const mutations = [];
        page.on('console', (message) => { if (message.type() === 'error') blocking.push(`console: ${message.text()}`); });
        page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
        page.on('requestfailed', (request) => {
            if (!request.failure()?.errorText.includes('ERR_ABORTED')) blocking.push(`requestfailed: ${request.method()} ${new URL(request.url()).pathname}`);
        });
        page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin === baseOrigin && response.status() >= 400) blocking.push(`HTTP ${response.status()} ${url.pathname}`);
        });
        await page.route('**/api/research/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (['PATCH', 'PUT', 'DELETE'].includes(request.method())
                || (request.method() === 'POST' && url.pathname.startsWith('/api/research/watchlist'))) mutations.push(`${request.method()} ${url.pathname}`);
            if (url.pathname === '/api/research/watchlist') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [record], archivedSymbols: [] }) });
            if (url.pathname === '/api/research/inbox') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-31T08:00:00.000Z', monitoredCount: 1, items: [], warnings: [] } }) });
            if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: snapshot }) });
            if (url.pathname.startsWith('/api/research/quote/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { quote: snapshot.quote } }) });
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
        });

        try {
            await openResearch(page);
            const strip = page.getByTestId('research-readiness-strip');
            const nextActions = page.getByTestId('research-readiness-next');
            if (await nextActions.count() !== 1) throw new Error('Research must expose exactly one readiness next action');
            await nextActions.getByText('Thesis and checklist').waitFor({ state: 'visible', timeout });
            if (await page.getByTestId('research-readiness-details').getAttribute('open') !== null) throw new Error('readiness details are not collapsed initially');
            await page.getByRole('tab', { name: 'Overview' }).waitFor({ state: 'visible', timeout });
            const nextActionBottom = await nextActions.evaluate((node) => node.getBoundingClientRect().bottom);
            if (nextActionBottom >= viewport.height) throw new Error(`selected decision action starts below the first viewport at ${nextActionBottom}px`);
            if (viewport.width <= 620) {
                const mobileOrder = await page.evaluate(() => {
                    const detail = document.querySelector('#research-detail > header');
                    const action = document.querySelector('[data-testid="research-readiness-next"]');
                    const watchlist = document.querySelector('[data-testid="research-watchlist-owner"]');
                    const box = (element) => element?.getBoundingClientRect() ?? null;
                    return { detail: box(detail), action: box(action), watchlist: box(watchlist) };
                });
                if (!mobileOrder.detail || !mobileOrder.action || !mobileOrder.watchlist) throw new Error('mobile decision/watchlist geometry is incomplete');
                if (mobileOrder.detail.bottom > mobileOrder.watchlist.top + 1 || mobileOrder.action.bottom > mobileOrder.watchlist.top + 1) throw new Error('mobile watchlist appears before the selected decision and next action');
                if (mobileOrder.watchlist.height > 230) throw new Error(`mobile ticker selector is not compact (${mobileOrder.watchlist.height}px)`);
            }
            await nextActions.click();
            await page.waitForURL((url) => url.searchParams.get('tab') === 'overview' && url.searchParams.get('review') === 'edit', { timeout });

            await openResearch(page);
            await page.getByTestId('research-readiness-details').locator('summary').click();
            if (await page.getByTestId('research-readiness-details').locator('button[data-testid^="research-readiness-"]').count() !== 7) throw new Error('not all readiness owners are reachable');
            await page.getByTestId('research-readiness-method').getByText(/Fixed precedence/).waitFor({ state: 'visible', timeout });
            await page.getByTestId('research-readiness-evidence').click();
            await page.waitForURL((url) => url.searchParams.get('workspace') === 'evidence', { timeout });
            await page.getByRole('heading', { name: 'Evidence coverage and freshness' }).waitFor({ state: 'visible', timeout });
            if (await page.getByLabel('Ticker').inputValue() !== 'MSFT') throw new Error('Evidence owner did not preserve the selected ticker');

            await expectDestination(page, 'research-readiness-valuation', { workspace: 'research', tab: 'valuation' });
            await expectDestination(page, 'research-readiness-policy', { workspace: 'policy' });
            await page.getByRole('heading', { name: 'Investment-policy guardrails' }).waitFor({ state: 'visible', timeout });
            if ((await page.locator('#policy-assessment-title + ul h3').first().textContent())?.trim() !== 'MSFT') throw new Error('Policy owner did not prioritize the selected ticker');
            await expectDestination(page, 'research-readiness-triggers', { workspace: 'alerts' });
            await expectDestination(page, 'research-readiness-review', { workspace: 'calendar' });

            await openResearch(page);
            await page.getByTestId('research-readiness-details').locator('summary').click();
            const layout = await page.evaluate(() => ({
                documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                stripOverflow: document.querySelector('[data-testid="research-readiness-strip"]')?.scrollWidth - document.querySelector('[data-testid="research-readiness-strip"]')?.clientWidth,
            }));
            if (layout.documentOverflow > 1 || (layout.stripOverflow ?? 0) > 1) throw new Error(`overflow detected document=${layout.documentOverflow} strip=${layout.stripOverflow}`);
            await strip.screenshot({ path: path.join(artifactDirectory, `readiness-${viewport.width}.png`) });
            if (mutations.length > 0) throw new Error(`readiness navigation emitted mutations: ${mutations.join(', ')}`);
            if (blocking.length > 0) throw new Error(blocking.join(' | '));
            console.log(`PASS Research readiness state, owners, and layout ${viewport.width}px`);
        } catch (error) {
            failures.push(`${viewport.width}px: ${error instanceof Error ? error.message : String(error)}`);
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
    console.log('PASS fixed next-gap precedence, owner navigation, ticker context, mutation safety, and zero blocking browser issues');
    console.log(`Screenshots: ${artifactDirectory}`);
    console.log('Research readiness QA passed.');
}
