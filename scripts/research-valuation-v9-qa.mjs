import { chromium } from 'playwright';

const baseUrl = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const record = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned', inBuyZone: false,
    status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium', whyInterested: '', bullCase: '', bearCase: '', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
    checklist: {}, monitoringRules: {}, acceptedEvidence: [], documentEvidence: { version: 1, migrationState: 'current', citations: [] }, factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: { decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null, benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null, priorOutcome: 'unresolved', outcomeNote: '' },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null }, reviewHistory: [], lastReviewedAt: '2026-08-20', updatedAt: '2026-08-20T00:00:00.000Z', revision: 1,
};
const snapshot = {
    symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-29T12:00:00.000Z', benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null, returnBasis: null, status: 'unavailable' },
    quote: { name: 'Microsoft', currency: 'USD', price: 420, dailyChangePercent: -1.2 }, fundamentals: { revenueGrowthPercent: 12, grossMarginPercent: null, operatingMarginPercent: null, freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null, annualNetIncome: null, reportingPeriod: null, shareChangePercent: null, source: null, history: [] },
    valuation: { marketCap: null, priceEarnings: 31, priceSales: null, freeCashFlowYieldPercent: null, netCash: null, reportingPeriod: null, source: null }, technicals: { ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null, averageVolume20: null, support: null, resistance: null }, chart: { interval: '1d', points: [] }, sources: ['fixture'], warnings: [],
};
const blankPlan = {
    ticker: 'MSFT', currentEps: null, years: 5, annualDiscountRatePct: 10,
    scenarios: [
        { id: 'bear', label: 'Bear', currentEps: 1, epsCagrPct: 4, terminalPe: 20, years: 5, annualDiscountRatePct: 10 },
        { id: 'base', label: 'Base', currentEps: 1, epsCagrPct: 10, terminalPe: 25, years: 5, annualDiscountRatePct: 10 },
        { id: 'bull', label: 'Bull', currentEps: 1, epsCagrPct: 16, terminalPe: 30, years: 5, annualDiscountRatePct: 10 },
    ],
    updatedAt: '2026-08-29T12:00:00.000Z',
};
let savedPlan = null;

const runViewport = async (browser, viewport) => {
    const context = await browser.newContext({ viewport, colorScheme: 'dark' });
    const page = await context.newPage();
    const blocking = [];
    page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
    page.on('console', (message) => { if (message.type() === 'error') blocking.push(`console: ${message.text()}`); });
    await page.route('**/api/**', async (route) => {
        const request = route.request(); const url = new URL(request.url());
        const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (url.pathname === '/api/research/watchlist') return json({ success: true, data: [record], archivedSymbols: [] });
        if (url.pathname === '/api/research/inbox') return json({ success: true, data: { generatedAt: snapshot.fetchedAt, monitoredCount: 1, items: [], warnings: [] } });
        if (url.pathname.startsWith('/api/research/symbol/')) return json({ success: true, data: snapshot });
        if (url.pathname.startsWith('/api/research/memory/')) return request.method() === 'GET' ? json({ success: true, data: [] }) : json({ success: true, data: request.postDataJSON() }, 201);
        if (url.pathname.startsWith('/api/research/expectations/')) return json({ success: true, data: [] });
        if (url.pathname.startsWith('/api/research/valuation-plan/')) {
            if (request.method() === 'GET') return json({ success: true, data: savedPlan ?? blankPlan });
            savedPlan = request.postDataJSON(); return json({ success: true, data: savedPlan });
        }
        if (url.pathname === '/api/research/quotes') return json({ success: true, data: { fetchedAt: snapshot.fetchedAt, items: [] } });
        if (url.pathname.startsWith('/api/research/chart/') || url.pathname.startsWith('/api/research/quote/')) return json({ success: true, data: { chart: { interval: '1d', points: [] }, quote: snapshot.quote } });
        if (url.pathname.startsWith('/api/signals/')) return json({ success: false, error: 'not needed in valuation QA' }, 503);
        return json({ success: true, data: {} });
    });

    await page.goto(`${baseUrl}/research?ticker=MSFT`, { waitUntil: 'domcontentloaded' });
    const panel = page.getByTestId('valuation-reasoning-v9');
    await panel.waitFor({ state: 'visible', timeout: 30000 });
    check((await panel.textContent())?.includes('Market price') && (await panel.textContent())?.includes('$420'), `${viewport.width}: provider market price should be visible`);
    check((await panel.textContent())?.includes('Enter a current EPS supported by your source'), `${viewport.width}: explicit EPS evidence gap should be disclosed`);

    const eps = panel.getByLabel('Current EPS');
    await eps.fill('12');
    await panel.getByLabel('Base EPS CAGR percent').fill('12');
    await panel.getByLabel('Base terminal PE').fill('26');
    check((await panel.textContent())?.includes('Market-implied EPS CAGR:'), `${viewport.width}: implied growth should appear after EPS input`);
    check((await panel.textContent())?.includes('scenario value'), `${viewport.width}: scenario comparison should appear`);

    await eps.fill('');
    check((await panel.textContent())?.includes('Enter a current EPS supported by your source'), `${viewport.width}: clearing EPS should return to evidence-gap state without crashing`);
    await eps.fill('12');
    await panel.getByRole('button', { name: 'Save assumptions' }).click();
    await panel.getByText('Valuation assumptions saved.').waitFor({ state: 'visible' });
    check(savedPlan?.ticker === 'MSFT' && savedPlan?.currentEps === 12, `${viewport.width}: save contract should preserve explicit EPS`);
    check(savedPlan?.scenarios?.[1]?.terminalPe === 26, `${viewport.width}: save contract should preserve Base terminal P/E`);

    const saveBox = await panel.getByRole('button', { name: 'Save assumptions' }).boundingBox();
    check(Boolean(saveBox && saveBox.height >= 40), `${viewport.width}: save assumptions needs a usable touch target`);
    const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
    check(overflow <= 1, `${viewport.width}: page has ${overflow}px horizontal overflow`);
    check(blocking.length === 0, `${viewport.width}: browser errors: ${blocking.join(' | ')}`);
    await context.close();
};

const browser = await chromium.launch({ headless: true });
try {
    await runViewport(browser, { width: 1280, height: 900 });
    savedPlan = null;
    await runViewport(browser, { width: 375, height: 812 });
} finally { await browser.close(); }
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log('research valuation v9 browser QA: ok');
