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
const artifactDirectory = path.resolve('.tmp', 'research-structured-triggers-qa');
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

const defaultMonitoringRules = () => ({
    buyZone: true,
    belowMa200: true,
    rsiBelow: 30,
    rsiAbove: null,
    earningsWithinDays: 21,
    reviewAgeDays: 30,
    structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
});

const recordFixture = () => ({
    symbol: 'MSFT',
    market: 'US',
    companyName: 'Microsoft',
    positionState: 'not-owned',
    inBuyZone: false,
    status: 'watch',
    targetBuyZone: '95 - 105',
    valuationState: 'fair',
    thesisStrength: 'medium',
    whyInterested: 'Durable enterprise demand.',
    bullCase: 'Cloud growth remains resilient.',
    bearCase: 'Valuation can compress.',
    buyTrigger: 'Evidence improves.',
    sellTrigger: 'Risk changes.',
    thesisBreak: 'Cash flow deteriorates.',
    notes: 'Private authored note.',
    checklist,
    monitoringRules: defaultMonitoringRules(),
    acceptedEvidence: [],
    decisionJournal: {
        decision: 'Watch',
        confidence: 'medium',
        observedPrice: 100,
        benchmarkLabel: null,
        benchmarkReturnPercent: null,
        nextReviewAt: null,
        priorReviewId: null,
        priorOutcome: 'unresolved',
        outcomeNote: '',
    },
    positionPlan: {
        plannedAllocationPercent: null,
        averageCost: null,
        plannedEntryPrice: null,
        invalidationPrice: null,
    },
    reviewHistory: [],
    lastReviewedAt: '2026-07-20',
    updatedAt: '2026-07-26T00:00:00.000Z',
    revision: 1,
});

const snapshotFixture = {
    symbol: 'MSFT',
    market: 'US',
    fetchedAt: '2026-07-26T00:00:00.000Z',
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
    quote: { name: 'Microsoft', currency: 'USD', price: 100, dailyChangePercent: 0 },
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
    warnings: ['Fundamental coverage is degraded in this QA fixture.'],
};

const inboxItem = {
    id: 'MSFT-risk-fixture',
    symbol: 'MSFT',
    kind: 'risk',
    urgency: 'action',
    title: 'Review current conditions',
    detail: 'A deterministic QA attention item.',
    proximity: 'Review now',
    source: 'Research journal',
    eventDate: null,
    structuredTriggerRuleId: null,
};

const triggerEvaluation = (overrides) => ({
    symbol: 'MSFT',
    rule: {
        id: 'qa-price-rule',
        enabled: true,
        purpose: 'thesis-invalidation',
        metric: 'price',
        operator: 'below',
        threshold: 100,
    },
    status: 'matched',
    severity: 'risk',
    title: 'Thesis invalidation review',
    detail: 'Price below 100 USD; observed 95 USD on 2026-07-26 from Yahoo Finance (0 days old).',
    observed: {
        value: 95,
        label: '95 USD',
        observedAt: '2026-07-26T00:00:00.000Z',
        source: 'Yahoo Finance',
        freshness: '0 days old',
    },
    ...overrides,
});

const notificationCenter = {
    success: true,
    data: {
        settings: {
            enabled: true,
            mode: 'daily',
            quietHoursEnabled: false,
            quietHoursStartUtc: 22,
            quietHoursEndUtc: 7,
        },
        configured: false,
        history: [],
    },
};

const browser = await chromium.launch({ headless: true });
const report = [];

try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        let record = recordFixture();
        let conflictNext = false;
        let expectedConflictResponses = 0;
        let expectedConflictConsoleErrors = 0;
        const mutationBodies = [];
        const blocking = [];

        page.on('console', (message) => {
            if (message.type() !== 'error') return;
            if (expectedConflictConsoleErrors > 0 && message.text().includes('status of 409')) {
                expectedConflictConsoleErrors -= 1;
                return;
            }
            blocking.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
        page.on('requestfailed', (request) => blocking.push(`requestfailed: ${request.method()} ${new URL(request.url()).pathname}`));
        page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin === new URL(baseUrl).origin && response.status() >= 400) {
                if (response.status() === 409
                    && url.pathname.startsWith('/api/research/watchlist/')
                    && expectedConflictResponses > 0) {
                    expectedConflictResponses -= 1;
                    return;
                }
                blocking.push(`HTTP ${response.status()} ${url.pathname}`);
            }
        });

        await page.route('**/api/research/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.pathname === '/api/research/watchlist' && request.method() === 'GET') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [record], archivedSymbols: [] }) });
                return;
            }
            if (url.pathname.startsWith('/api/research/watchlist/') && request.method() === 'PATCH') {
                const body = request.postDataJSON();
                mutationBodies.push(body);
                if (conflictNext) {
                    conflictNext = false;
                    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'MSFT changed in another session. Reload it before saving again.' }) });
                    return;
                }
                record = {
                    ...record,
                    monitoringRules: body.monitoringRules,
                    revision: record.revision + 1,
                    updatedAt: new Date().toISOString(),
                };
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: record }) });
                return;
            }
            if (url.pathname === '/api/research/inbox') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                    success: true,
                    data: { generatedAt: '2026-07-26T00:00:00.000Z', monitoredCount: 1, items: [inboxItem], warnings: [] },
                }) });
                return;
            }
            if (url.pathname === '/api/research/alerts') {
                const matched = triggerEvaluation({});
                const unavailable = triggerEvaluation({
                    rule: { ...triggerEvaluation({}).rule, id: 'qa-growth-rule', metric: 'revenue-growth-percent', operator: 'above', threshold: 10 },
                    status: 'unavailable',
                    title: 'Opportunity review',
                    severity: 'opportunity',
                    detail: 'Annual revenue growth above 10% could not be evaluated: the required period-correct provider input is degraded or missing.',
                    observed: null,
                });
                const disabled = triggerEvaluation({
                    rule: { ...triggerEvaluation({}).rule, id: 'qa-rsi-rule', enabled: false, metric: 'rsi14', threshold: 70 },
                    status: 'disabled',
                    detail: 'RSI (14) above 70 RSI points is disabled.',
                    observed: null,
                });
                const active = triggerEvaluation({
                    rule: { ...triggerEvaluation({}).rule, id: 'qa-ma-rule', purpose: 'opportunity-review', metric: 'price-vs-ma50-percent', operator: 'above', threshold: 5 },
                    status: 'not-matched',
                    title: 'Opportunity review',
                    severity: 'opportunity',
                    detail: 'Price vs MA50 above 5%; observed 1% on 2026-07-26 from Yahoo Finance (0 days old).',
                    observed: {
                        value: 1,
                        label: '1%',
                        observedAt: '2026-07-26T00:00:00.000Z',
                        source: 'Yahoo Finance',
                        freshness: '0 days old',
                    },
                });
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                    success: true,
                    data: {
                        generatedAt: '2026-07-26T00:00:00.000Z',
                        monitoredCount: 1,
                        alerts: [{
                            id: 'MSFT-structured-qa-price-rule',
                            symbol: 'MSFT',
                            kind: 'structured-trigger',
                            severity: 'risk',
                            title: matched.title,
                            detail: matched.detail,
                            structuredTrigger: matched,
                        }],
                        triggerCoverage: [matched, active, unavailable, disabled],
                        warnings: ['1 structured trigger is unavailable because required evidence is provider-degraded.'],
                    },
                }) });
                return;
            }
            if (url.pathname === '/api/research/notifications/settings') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(notificationCenter) });
                return;
            }
            if (url.pathname.startsWith('/api/research/quote/')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { quote: { name: 'Microsoft', currency: 'USD', price: 100, dailyChangePercent: 0 } } }) });
                return;
            }
            if (url.pathname.startsWith('/api/research/symbol/')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: snapshotFixture }) });
                return;
            }
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
        });

        await page.goto(`${baseUrl}/research?workspace=research&ticker=MSFT`, { waitUntil: 'domcontentloaded', timeout });
        await page.waitForLoadState('networkidle', { timeout });
        await page.getByTestId('research-overview').locator('summary').click({ timeout });
        await page.getByRole('button', { name: 'Manage MSFT attention items' }).click({ timeout });
        await page.getByText('Monitoring rules', { exact: true }).click({ timeout });
        const editor = page.getByTestId('structured-trigger-editor');
        await editor.waitFor({ state: 'visible', timeout });
        await editor.getByText('No structured review prompts are configured.').waitFor({ timeout });
        await editor.getByRole('button', { name: 'Add rule' }).focus();
        await page.keyboard.press('Enter');
        await editor.getByLabel(/Threshold for Price/).fill('90');
        await editor.getByRole('button', { name: 'Save structured rules' }).focus();
        await page.keyboard.press('Enter');
        await editor.getByText('Structured monitoring rules saved.').waitFor({ timeout });
        await page.screenshot({ path: path.join(artifactDirectory, `editor-saved-${viewport.width}.png`), fullPage: true });

        if (mutationBodies.length !== 1
            || mutationBodies[0].mode !== 'settings'
            || mutationBodies[0].whyInterested !== 'Durable enterprise demand.'
            || mutationBodies[0].notes !== 'Private authored note.'
            || mutationBodies[0].checklist.understandBusiness !== false) {
            blocking.push('settings save changed or omitted protected research fields');
        }

        await page.reload({ waitUntil: 'domcontentloaded', timeout });
        await page.waitForLoadState('networkidle', { timeout });
        await page.getByTestId('research-overview').locator('summary').click({ timeout });
        await page.getByRole('button', { name: 'Manage MSFT attention items' }).click({ timeout });
        await page.getByText('Monitoring rules', { exact: true }).click({ timeout });
        await page.getByTestId('structured-trigger-editor').getByText('1/10 rules').waitFor({ timeout });

        conflictNext = true;
        expectedConflictResponses = 1;
        expectedConflictConsoleErrors = 1;
        await page.getByTestId('structured-trigger-editor').getByLabel(/Threshold for Price/).fill('89');
        await page.getByTestId('structured-trigger-editor').getByRole('button', { name: 'Save structured rules' }).click();
        await page.getByText(/changed in another session/i).waitFor({ timeout });

        await page.goto(`${baseUrl}/research?workspace=alerts`, { waitUntil: 'domcontentloaded', timeout });
        await page.waitForLoadState('networkidle', { timeout });
        const coverage = page.getByTestId('structured-trigger-coverage');
        await coverage.getByText(/Thesis invalidation review/).first().waitFor({ timeout });
        await coverage.getByText('Active', { exact: true }).waitFor({ timeout });
        await coverage.getByText('Unavailable', { exact: true }).waitFor({ timeout });
        await coverage.getByText('Disabled', { exact: true }).waitFor({ timeout });
        await page.getByText('1 structured trigger is unavailable because required evidence is provider-degraded.').waitFor({ timeout });
        const queueButton = page.getByRole('button', { name: 'Queue MSFT Risk review' });
        await queueButton.click();
        await queueButton.click();
        const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('signal-research-workflow-queue-v1') ?? '[]'));
        if (queued.length !== 1 || queued[0]?.dedupeKey !== 'structured-trigger:MSFT:qa-price-rule') {
            blocking.push('matched structured trigger did not deterministically deduplicate in Queue');
        }
        await page.screenshot({ path: path.join(artifactDirectory, `alerts-queue-${viewport.width}.png`), fullPage: true });

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) blocking.push('document has horizontal overflow');
        const analytics = await page.evaluate(() => Object.entries(localStorage)
            .filter(([key]) => key.includes('analytics'))
            .map(([, value]) => value)
            .join('\n'));
        if (analytics.includes('qa-price-rule') || analytics.includes('"threshold":90') || analytics.includes('Private authored note.')) {
            blocking.push('private trigger or authored content leaked into browser analytics');
        }

        report.push({
            viewport: viewport.width,
            savedRevision: record.revision,
            mutationCount: mutationBodies.length,
            queueCount: queued.length,
            overflow,
            blocking,
        });
        await context.close();
    }
} finally {
    await browser.close();
}

console.log(JSON.stringify({ baseUrl, report }, null, 2));
if (report.some((scenario) => scenario.blocking.length > 0)) process.exitCode = 1;
