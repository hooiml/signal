import { chromium } from 'playwright';

const baseUrl = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const record = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned', inBuyZone: false,
    status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium', whyInterested: '',
    bullCase: 'Cloud growth remains durable.', bearCase: 'Expectations become too demanding.', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
    checklist: {}, monitoringRules: {}, acceptedEvidence: [], documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: { decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null, benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null, priorOutcome: 'unresolved', outcomeNote: '' },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [], lastReviewedAt: '2026-08-20', updatedAt: '2026-08-20T00:00:00.000Z', revision: 1,
};
const snapshot = {
    symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-29T12:00:00.000Z',
    benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null, returnBasis: null, status: 'unavailable' },
    quote: { name: 'Microsoft', currency: 'USD', price: 420, dailyChangePercent: -1.2 },
    fundamentals: { revenueGrowthPercent: 12, grossMarginPercent: null, operatingMarginPercent: null, freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null, source: null, history: [] },
    valuation: { marketCap: null, priceEarnings: 31, priceSales: null, freeCashFlowYieldPercent: null, netCash: null, reportingPeriod: null, source: null },
    technicals: { ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null, averageVolume20: null, support: null, resistance: null },
    chart: { interval: '1d', points: [] }, sources: ['fixture'], warnings: [],
};
let savedEvent = null;

const runViewport = async (browser, viewport) => {
    const context = await browser.newContext({ viewport, colorScheme: 'dark' });
    const page = await context.newPage();
    const blocking = [];
    page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') blocking.push(`console: ${message.text()}`); });
    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/api/research/watchlist') return json({ success: true, data: [record], archivedSymbols: [] });
        if (url.pathname === '/api/research/inbox') return json({ success: true, data: { generatedAt: snapshot.fetchedAt, monitoredCount: 1, items: [], warnings: [] } });
        if (url.pathname.startsWith('/api/research/symbol/')) return json({ success: true, data: snapshot });
        if (url.pathname.startsWith('/api/research/memory/')) {
            if (request.method() === 'GET') return json({ success: true, data: [] });
            return json({ success: true, data: request.postDataJSON() }, 201);
        }
        if (url.pathname.startsWith('/api/research/expectations/')) {
            if (request.method() === 'GET') return json({ success: true, data: savedEvent ? [savedEvent] : [] });
            if (request.method() === 'POST') {
                savedEvent = request.postDataJSON();
                return json({ success: true, data: savedEvent }, 201);
            }
        }
        if (url.pathname === '/api/research/quotes') return json({ success: true, data: { fetchedAt: snapshot.fetchedAt, items: [] } });
        if (url.pathname.startsWith('/api/research/chart/') || url.pathname.startsWith('/api/research/quote/')) return json({ success: true, data: { chart: { interval: '1d', points: [] }, quote: snapshot.quote } });
        if (url.pathname.startsWith('/api/signals/')) return json({ success: false, error: 'not needed in expectation QA' }, 503);
        return json({ success: true, data: {} });
    });

    await page.goto(`${baseUrl}/research?ticker=MSFT`, { waitUntil: 'domcontentloaded' });
    const panel = page.getByTestId('expectation-reality');
    await panel.waitFor({ state: 'visible', timeout: 30000 });
    const anchor = page.getByTestId('since-last-visit');
    check(await anchor.isVisible(), `${viewport.width}: Since last visit anchor should remain visible`);
    const order = await page.evaluate(() => {
        const sinceLastVisit = document.querySelector('[data-testid="since-last-visit"]');
        const expectation = document.querySelector('[data-testid="expectation-reality"]');
        return Boolean(sinceLastVisit && expectation && (sinceLastVisit.compareDocumentPosition(expectation) & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    check(order, `${viewport.width}: Expectation panel must follow Since last visit in the Research utility flow`);

    await panel.getByLabel('Event title').fill('Q1 earnings');
    await panel.getByLabel('Revenue expected').fill('68.4');
    await panel.getByLabel('Revenue actual').fill('69.1');
    await panel.getByLabel('EPS expected').fill('3.12');
    await panel.getByLabel('EPS actual').fill('3.21');
    await panel.getByLabel('Expected narrative').fill('Azure growth and forward guidance matter more than the headline EPS number.');
    await panel.getByLabel('Actual narrative').fill('Revenue and EPS beat, but the market focused on a weaker key growth metric.');
    await panel.getByLabel('Stock reaction percent').fill('-4.5');
    await panel.getByRole('button', { name: 'Save review' }).click();
    await panel.getByText('Expectation review saved.').waitFor({ state: 'visible' });
    check((await panel.textContent())?.includes('Primary result: BEAT'), `${viewport.width}: primary outcome should classify as beat`);
    check((await panel.textContent())?.includes('Headline results were positive, but the stock reaction was negative.'), `${viewport.width}: divergence explanation should be visible`);
    check(savedEvent?.ticker === 'MSFT' && savedEvent?.metrics?.[0]?.expected === 68.4, `${viewport.width}: save contract should preserve expectation values`);

    const saveBox = await panel.getByRole('button', { name: 'Save review' }).boundingBox();
    check(Boolean(saveBox && saveBox.height >= 40), `${viewport.width}: save control should have a usable touch target`);
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    check(overflow <= 1, `${viewport.width}: page has ${overflow}px horizontal overflow`);
    check(blocking.length === 0, `${viewport.width}: browser errors: ${blocking.join(' | ')}`);
    await context.close();
};

const browser = await chromium.launch({ headless: true });
try {
    await runViewport(browser, { width: 1280, height: 900 });
    savedEvent = null;
    await runViewport(browser, { width: 375, height: 812 });
} finally {
    await browser.close();
}

if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
}
console.log('research expectation v8 browser QA: ok');
