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
    : [{ width: 1280, height: 960 }, { width: 768, height: 900 }, { width: 375, height: 812 }];
const timeout = 15_000;
const artifactDirectory = path.resolve(argument('--screenshot-dir', path.join('.tmp', 'historical-valuation-qa')));
await mkdir(artifactDirectory, { recursive: true });

const emptyTechnicals = {
    ma50: null, ma200: null, rsi14: null, macd: null, low52Week: null, high52Week: null,
    averageVolume20: null, support: null, resistance: null,
};
const snapshot = {
    symbol: 'MSFT',
    market: 'US',
    fetchedAt: '2026-07-26T00:00:00.000Z',
    benchmark: {
        baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y',
        candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null,
        returnBasis: null, status: 'unavailable',
    },
    quote: { name: 'Microsoft', currency: 'USD', price: 450, dailyChangePercent: 0.5 },
    fundamentals: {
        revenueGrowthPercent: null, grossMarginPercent: null, operatingMarginPercent: null,
        freeCashFlow: null, debt: null, cash: null, shares: null, annualRevenue: null,
        annualNetIncome: null, reportingPeriod: null, shareChangePercent: null, source: null, history: [],
    },
    valuation: {
        marketCap: null, priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null,
        netCash: null, reportingPeriod: null, source: null,
    },
    technicals: emptyTechnicals,
    chart: { interval: '1d', points: [] },
    sources: ['Yahoo Finance', 'SEC EDGAR'],
    warnings: [],
};
const metric = (value, formula, unavailableReason = null) => ({ value, formula, unavailableReason });
const observation = {
    id: '0000789019-24-000001:2024-02-15',
    fiscalPeriodStart: '2023-01-01',
    fiscalPeriodEnd: '2023-12-31',
    filedAt: '2024-02-15',
    priceDate: '2024-02-16',
    price: 20,
    priceCurrency: 'USD',
    priceConvention: 'First available Yahoo Finance daily close strictly after the SEC filed date, on the provider current split-adjusted basis; reported diluted shares are multiplied by subsequent split factors to use the same basis.',
    reportedDilutedShares: 50,
    splitAdjustmentFactor: 2,
    splitAdjustedShares: 100,
    marketCapitalization: 2_000,
    annualRevenue: 1_000,
    annualNetIncome: 100,
    operatingCashFlow: 150,
    capitalExpenditure: 50,
    freeCashFlow: 100,
    priceEarnings: metric(20, 'split-adjusted close × split-adjusted diluted shares ÷ annual net income'),
    priceSales: metric(2, 'split-adjusted close × split-adjusted diluted shares ÷ annual revenue'),
    freeCashFlowYield: metric(5, '(annual operating cash flow − annual capital expenditure) ÷ market capitalization × 100'),
    form: '10-K',
    accession: '0000789019-24-000001',
    isAmendment: false,
    restatementStatus: 'original',
    filingUrl: 'https://www.sec.gov/Archives/edgar/data/789019/000078901924000001/0000789019-24-000001-index.html',
    facts: [
        ['Revenue', 'RevenueFromContractWithCustomerExcludingAssessedTax', 1_000, 'USD'],
        ['Net income', 'NetIncomeLoss', 100, 'USD'],
        ['Operating cash flow', 'NetCashProvidedByUsedInOperatingActivities', 150, 'USD'],
        ['Capital expenditure', 'PaymentsToAcquirePropertyPlantAndEquipment', 50, 'USD'],
        ['Diluted weighted-average shares', 'WeightedAverageNumberOfDilutedSharesOutstanding', 50, 'shares'],
    ].map(([label, concept, value, unit]) => ({
        label, concept, value, unit, fiscalStart: '2023-01-01', fiscalEnd: '2023-12-31',
        filedAt: '2024-02-15', accession: '0000789019-24-000001',
    })),
    gaps: [],
};
const reportFixture = (mode) => {
    const partialObservation = mode === 'partial' ? {
        ...observation,
        freeCashFlow: null,
        freeCashFlowYield: metric(null, observation.freeCashFlowYield.formula, 'The filing has no accession-aligned annual capital-expenditure fact.'),
        gaps: ['The filing has no accession-aligned annual capital-expenditure fact.'],
    } : observation;
    const observations = mode === 'empty' ? [] : [partialObservation];
    return {
        symbol: 'MSFT',
        market: 'US',
        companyName: 'Microsoft Corp',
        generatedAt: '2026-07-26T00:00:00.000Z',
        observationKind: 'filing observation',
        priceConvention: observation.priceConvention,
        capabilities: {
            historicalPrices: { status: 'available', detail: 'One bounded daily close is available.' },
            periodCorrectFundamentals: {
                status: mode === 'empty' ? 'unavailable' : mode === 'partial' ? 'partial' : 'available',
                detail: mode === 'empty' ? 'No safe accession-aligned SEC annual filing observations were available.' : 'One accession-aligned annual filing observation.',
            },
            analystEstimateRevisions: {
                status: 'unavailable',
                detail: 'Unavailable: no suitable analyst estimate or revision-history provider is connected. Signal scores, news sentiment, and company guidance are not substitutes.',
            },
        },
        observations,
        sources: [
            { name: 'SEC EDGAR Company Facts', url: 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json', detail: 'Official filing facts and dates.' },
            { name: 'Yahoo Finance chart', url: 'https://finance.yahoo.com/quote/MSFT/history/', detail: 'Existing bounded price source.' },
        ],
        warnings: mode === 'partial' ? ['Fixture partial coverage.'] : [],
    };
};

const browser = await chromium.launch({ headless: true });
const failures = [];
const summary = [];
try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        await context.addInitScript(() => {
            localStorage.setItem('signal-portfolio-holdings-v1', JSON.stringify({
                version: 1,
                holdings: [{ accountLabel: 'Private QA account', symbol: 'MSFT', quantity: 77, averageCost: 321, notes: 'private-factor-note' }],
                cashBalances: [{ accountLabel: 'Private QA account', currency: 'USD', balance: 12345 }],
            }));
        });
        const page = await context.newPage();
        const evidence = { blocking: [], privacyLeaks: [], requests: [], researchMutations: [] };
        const privateMarkers = ['Private QA account', '"quantity":77', '"balance":12345', 'private-factor-note'];
        let valuationAttempts = 0;
        page.on('console', (message) => {
            if (viewport.width === 375 && message.text().includes('Failed to load resource')) return;
            if (message.type() === 'error') evidence.blocking.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => evidence.blocking.push(`pageerror: ${error.message}`));
        page.on('requestfailed', (request) => {
            if ((request.failure()?.errorText ?? '').includes('ERR_ABORTED')) return;
            evidence.blocking.push(`requestfailed: ${request.method()} ${request.url()}`);
        });
        page.on('request', (request) => {
            const url = request.url();
            const body = request.postData() ?? '';
            if (privateMarkers.some((marker) => url.includes(marker) || body.includes(marker))) {
                evidence.privacyLeaks.push(`${request.method()} ${url}`);
            }
            if (url.includes('/api/research/valuation-history/')) evidence.requests.push({ method: request.method(), url, body });
            if (/\/api\/research\/watchlist(?:\/|$)/.test(url) && request.method() !== 'GET') {
                evidence.researchMutations.push(`${request.method()} ${url}`);
            }
        });
        await page.route('**/api/research/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.pathname === '/api/research/watchlist') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }) });
            }
            if (url.pathname.startsWith('/api/research/quote/')) {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { quote: snapshot.quote } }) });
            }
            if (url.pathname === '/api/research/symbol/MSFT') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: snapshot }) });
            }
            if (url.pathname === '/api/research/valuation-history/MSFT') {
                valuationAttempts += 1;
                await new Promise((resolve) => setTimeout(resolve, 700));
                if (viewport.width === 375 && valuationAttempts === 1) {
                    return route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Historical valuation providers are unavailable.' }) });
                }
                const mode = viewport.width === 1280 ? 'success' : viewport.width === 768 ? 'partial' : 'empty';
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: reportFixture(mode) }) });
            }
            if (url.pathname === '/api/research/inbox') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-26T00:00:00.000Z', monitoredCount: 0, items: [], warnings: [] } }) });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
        });

        try {
            await page.goto(`${baseUrl}/research?ticker=MSFT&tab=valuation`, { waitUntil: 'domcontentloaded', timeout });
            const workspace = page.getByTestId('historical-valuation');
            await workspace.waitFor({ state: 'visible', timeout });
            await workspace.getByText(/Loading filing-aligned valuation observations/i).waitFor({ timeout });
            if (viewport.width === 375) {
                await workspace.getByRole('alert').waitFor({ timeout });
                await workspace.getByRole('button', { name: 'Retry' }).click();
                await workspace.getByTestId('historical-valuation-empty').waitFor({ timeout });
            } else {
                await workspace.getByRole('table').waitFor({ timeout });
                await workspace.getByText(/Analyst revisions · unavailable/i).waitFor({ timeout });
                await workspace.getByText(/not substitutes/i).waitFor({ timeout });
                await workspace.getByRole('button', { name: 'FCF yield' }).click();
                await workspace.getByText(/FCF yield observations calculable/i).waitFor({ timeout });
                await workspace.getByText(/formula inputs and provenance/i).click();
                await workspace.getByText(/Shares basis/i).waitFor({ timeout });
                if (viewport.width === 768) {
                    await workspace.getByText(/capital-expenditure fact/i).first().waitFor({ timeout });
                    await workspace.getByText(/Fixture partial coverage/i).waitFor({ timeout });
                }
            }
            const overflow = await page.evaluate(() => ({
                documentWidth: document.documentElement.scrollWidth,
                viewportWidth: window.innerWidth,
            }));
            if (overflow.documentWidth > overflow.viewportWidth + 1) evidence.blocking.push(`document overflow ${overflow.documentWidth}/${overflow.viewportWidth}`);
            if (evidence.requests.some((item) => item.method !== 'GET' || item.body !== '')) evidence.blocking.push('historical valuation request was not a body-free GET');
            if (evidence.requests.some((item) => !new URL(item.url).searchParams.get('market'))) evidence.blocking.push('historical valuation request omitted bounded market');
            if (evidence.requests.length !== (viewport.width === 375 ? 2 : 1)) evidence.blocking.push(`unexpected historical valuation request count ${evidence.requests.length}`);
            if (evidence.researchMutations.length > 0) evidence.blocking.push(`research mutation: ${evidence.researchMutations.join(', ')}`);
            if (evidence.privacyLeaks.length > 0) evidence.blocking.push(`privacy leak: ${evidence.privacyLeaks.join(', ')}`);
            await page.screenshot({ path: path.join(artifactDirectory, `historical-valuation-${viewport.width}.png`), fullPage: true });
        } catch (error) {
            evidence.blocking.push(error instanceof Error ? error.message : String(error));
        }
        if (evidence.blocking.length > 0) failures.push(`${viewport.width}px: ${evidence.blocking.join(' | ')}`);
        summary.push({ viewport: viewport.width, requests: evidence.requests.length, blockers: evidence.blocking.length });
        await context.close();
    }
} finally {
    await browser.close();
}

if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log(JSON.stringify({ status: 'passed', summary }, null, 2));
}
