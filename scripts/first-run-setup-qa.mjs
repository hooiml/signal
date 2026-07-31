import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1];
    return args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
};
const baseUrl = arg('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const timeout = Number(arg('--timeout', '15000'));
const widths = arg('--viewport', '1280,768,375').split(',').map(Number);
const screenshotDir = path.resolve(arg('--screenshot-dir', path.join('.tmp', 'first-run-setup-qa')));
const setupKey = 'signal-first-run-setup-v1';
const holdingsKey = 'signal-portfolio-holdings-v1';
const queueKey = 'signal-research-workflow-queue-v1';
const analyticsKey = 'signal-product-analytics-v1';
const failures = [];

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
const monitoringRules = (withRule = false) => ({
    buyZone: true,
    belowMa200: true,
    rsiBelow: 30,
    rsiAbove: null,
    earningsWithinDays: 21,
    reviewAgeDays: 30,
    structuredTriggers: {
        version: 1,
        migrationState: 'current',
        rules: withRule ? [{
            id: 'setup-rule',
            enabled: true,
            purpose: 'opportunity-review',
            metric: 'price',
            operator: 'above',
            threshold: 500,
        }] : [],
    },
});
const decisionJournal = (scheduled = false) => ({
    decision: 'Watch',
    confidence: 'medium',
    observedPrice: 100,
    benchmarkLabel: null,
    benchmarkReturnPercent: null,
    nextReviewAt: scheduled ? '2026-08-30' : null,
    priorReviewId: null,
    priorOutcome: 'unresolved',
    outcomeNote: '',
});
const reviewSnapshot = {
    id: '11111111-1111-4111-8111-111111111111',
    reviewedAt: '2026-07-30T09:00:00.000Z',
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
    monitoringRules: monitoringRules(),
    acceptedEvidence: [],
    documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: decisionJournal(true),
    positionPlan: {
        plannedAllocationPercent: null,
        averageCost: null,
        plannedEntryPrice: null,
        invalidationPrice: null,
    },
};
const recordFixture = (reviewed = false) => ({
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
    monitoringRules: monitoringRules(),
    acceptedEvidence: [],
    documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: decisionJournal(reviewed),
    positionPlan: {
        plannedAllocationPercent: null,
        averageCost: null,
        plannedEntryPrice: null,
        invalidationPrice: null,
    },
    reviewHistory: reviewed ? [reviewSnapshot] : [],
    lastReviewedAt: '2026-07-30',
    updatedAt: '2026-07-30T09:00:00.000Z',
    revision: reviewed ? 2 : 1,
});
const emptySnapshot = (symbol = 'MSFT', market = 'US') => ({
    symbol,
    market,
    fetchedAt: '2026-07-30T09:00:00.000Z',
    benchmark: {
        baselineSymbol: 'VOO',
        baselineName: 'Vanguard S&P 500 ETF',
        period: '1Y',
        candidateReturnPercent: null,
        baselineReturnPercent: null,
        relativeReturnPercent: null,
        returnBasis: null,
        status: market === 'US' ? 'unavailable' : 'not-applicable',
    },
    quote: { name: symbol, currency: market === 'MY' ? 'MYR' : 'USD', price: 100, dailyChangePercent: 0 },
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
    sources: [],
    warnings: ['Deterministic QA fixture.'],
});

const installResearchRoutes = async (page, state, requestLog, issues) => {
    page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
    page.on('requestfailed', (request) => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()}`);
    });
    page.on('request', (request) => {
        if (request.url().includes('/api/')) requestLog.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`);
    });
    await page.route('**/api/research/watchlist**', async (route) => {
        const request = route.request();
        if (request.method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: state.record ? [state.record] : [], archivedSymbols: [] }),
            });
        }
        if (request.method() === 'POST') {
            state.record = recordFixture(false);
            return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.record }) });
        }
        if (request.method() === 'PATCH') {
            state.record = recordFixture(true);
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.record }) });
        }
        return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Unsupported QA mutation.' }) });
    });
    await page.route('**/api/research/quotes', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { fetchedAt: '2026-07-30T09:00:00.000Z', items: [] } }),
    }));
    await page.route('**/api/research/inbox', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-30T09:00:00.000Z', monitoredCount: 0, items: [], warnings: [] } }),
    }));
    await page.route('**/api/research/symbol/**', (route) => {
        const url = new URL(route.request().url());
        const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'MSFT');
        const market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US';
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: emptySnapshot(symbol, market) }) });
    });
    await page.route('**/api/research/assist/**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            success: true,
            data: {
                symbol: 'MSFT',
                market: 'US',
                generatedAt: '2026-07-30T09:00:00.000Z',
                mode: 'evidence',
                findings: [],
                evidence: [],
                warnings: ['Deterministic QA fixture.'],
            },
        }),
    }));
};

const overflow = (page) => page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);

const assertClean = async (page, issues, label) => {
    const extra = await overflow(page);
    if (extra > 1) throw new Error(`${label}: document overflows by ${extra}px`);
    if (issues.length > 0) throw new Error(`${label}: ${issues.join(' | ')}`);
};

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 } });
        const page = await context.newPage();
        const state = { record: null };
        const requestLog = [];
        const issues = [];
        await installResearchRoutes(page, state, requestLog, issues);
        try {
            await page.goto(`${baseUrl}/research`, { waitUntil: 'domcontentloaded', timeout });
            const setup = page.getByTestId('first-run-setup');
            await setup.waitFor({ state: 'visible', timeout });
            await setup.getByRole('heading', { name: 'Reach a first useful review' }).waitFor({ state: 'visible', timeout });
            await page.getByRole('heading', { name: 'Research workspace' }).waitFor({ state: 'attached', timeout });
            if (new URL(page.url()).searchParams.get('workspace') === 'today') {
                throw new Error(`${width}: first-run setup promoted Today before Task 0 was verified`);
            }
            await setup.getByRole('button', { name: 'US market' }).click();
            const stored = JSON.parse(await page.evaluate((key) => localStorage.getItem(key), setupKey));
            if (stored.markets.join(',') !== 'US' || stored.completedSteps.join(',') !== 'markets') {
                throw new Error(`${width}: first launch did not save only the bounded market step`);
            }
            const analytics = await page.evaluate((key) => localStorage.getItem(key), analyticsKey);
            if ((analytics ?? '').includes('first-run') || (analytics ?? '').includes('setup')) {
                throw new Error(`${width}: setup content entered workflow analytics`);
            }
            await assertClean(page, issues, `${width} first launch`);
            await setup.screenshot({ path: path.join(screenshotDir, `first-launch-${width}.png`) });
            console.log(`PASS first launch and responsive setup ${width}px`);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    {
        const workflowWidth = widths[0] ?? 1280;
        const context = await browser.newContext({ viewport: { width: workflowWidth, height: workflowWidth <= 480 ? 812 : 1000 } });
        const page = await context.newPage();
        const state = { record: null };
        const requestLog = [];
        const issues = [];
        await installResearchRoutes(page, state, requestLog, issues);
        try {
            await page.goto(`${baseUrl}/research`, { waitUntil: 'domcontentloaded', timeout });
            let setup = page.getByTestId('first-run-setup');
            await setup.getByRole('button', { name: 'US market' }).click();
            await setup.getByRole('button', { name: 'Add watchlist name' }).click();
            await page.getByLabel('Ticker symbol').fill('MSFT');
            await page.getByLabel('Company name').fill('Microsoft');
            await page.getByRole('button', { name: 'Add', exact: true }).click();
            await setup.getByRole('button', { name: 'Review MSFT' }).waitFor({ state: 'visible', timeout });
            await setup.getByRole('button', { name: 'Review MSFT' }).click();
            await page.waitForURL(/workspace=research.*ticker=MSFT.*review=edit/, { timeout });
            await page.getByLabel('Next review date').fill('2026-08-30');
            const saveResponsePromise = page.waitForResponse((response) =>
                response.request().method() === 'PATCH'
                && response.url().includes('/api/research/watchlist/MSFT'), { timeout });
            await page.getByRole('button', { name: 'Save review' }).click();
            await saveResponsePromise;
            setup = page.getByTestId('first-run-setup');
            await setup.getByText('4/5 steps complete').waitFor({ state: 'visible', timeout });
            await setup.getByRole('button', { name: 'Skip optional step' }).click();
            await page.getByTestId('open-first-run-setup').getByText('Complete').waitFor({ state: 'visible', timeout });
            const beforeReload = await page.evaluate((key) => localStorage.getItem(key), setupKey);
            await page.reload({ waitUntil: 'domcontentloaded', timeout });
            await page.getByTestId('open-first-run-setup').getByText('Complete').waitFor({ state: 'visible', timeout });
            const afterReload = await page.evaluate((key) => localStorage.getItem(key), setupKey);
            if (beforeReload !== afterReload) throw new Error('setup success was not idempotent across reload');
            if (requestLog.some((request) => request.includes('DEMO_SECRET') || request.includes('signal-first-run-setup-v1'))) {
                throw new Error('setup progress or unrelated private markers entered an API request');
            }
            await assertClean(page, issues, 'setup success');
            console.log('PASS setup success, exact review destination, resume, and idempotency');
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    {
        const context = await browser.newContext({ viewport: { width: 768, height: 900 } });
        const queueValue = JSON.stringify([{
            id: '22222222-2222-4222-8222-222222222222',
            symbol: 'MSFT',
            templateId: 'new-idea',
            source: 'manual',
            dedupeKey: null,
            dueAt: null,
            createdAt: '2026-07-30T09:00:00.000Z',
            completedAt: null,
        }]);
        const holdingsValue = JSON.stringify({
            version: 1,
            updatedAt: '2026-07-30T09:00:00.000Z',
            holdings: [],
            cashBalances: [{
                accountLabel: 'Existing account',
                currency: 'USD',
                balance: 10,
                importedAt: '2026-07-30T09:00:00.000Z',
                provenanceLabel: 'Existing data',
            }],
        });
        await context.addInitScript(({ queueKey, queueValue, holdingsKey, holdingsValue }) => {
            localStorage.setItem(queueKey, queueValue);
            localStorage.setItem(holdingsKey, holdingsValue);
        }, { queueKey, queueValue, holdingsKey, holdingsValue });
        const page = await context.newPage();
        const state = { record: recordFixture(false) };
        const requestLog = [];
        const issues = [];
        await installResearchRoutes(page, state, requestLog, issues);
        try {
            await page.goto(`${baseUrl}/research`, { waitUntil: 'domcontentloaded', timeout });
            if (await page.evaluate((key) => localStorage.getItem(key), setupKey) !== null) {
                throw new Error('existing user was automatically assigned setup state');
            }
            if (await page.evaluate((key) => localStorage.getItem(key), queueKey) !== queueValue
                || await page.evaluate((key) => localStorage.getItem(key), holdingsKey) !== holdingsValue) {
                throw new Error('existing Queue or Portfolio data changed on launch');
            }
            await page.getByRole('button', { name: 'Open command palette' }).click();
            await page.getByRole('dialog', { name: 'Signal command palette' })
                .getByRole('option', { name: /Open setup and demo/ })
                .click();
            await page.waitForURL((url) => url.searchParams.get('setup') === '1', { timeout });
            await page.getByTestId('first-run-setup').waitFor({ state: 'visible', timeout });
            if (await page.evaluate((key) => localStorage.getItem(key), setupKey) === null) {
                throw new Error('explicit setup command did not initialize existing-user setup state');
            }
            await page.getByTestId('first-run-setup').getByRole('button', { name: 'Skip for now' }).click();
            await page.getByTestId('open-first-run-setup').getByText('Skipped').waitFor({ state: 'visible', timeout });
            if (await page.evaluate((key) => localStorage.getItem(key), queueKey) !== queueValue
                || await page.evaluate((key) => localStorage.getItem(key), holdingsKey) !== holdingsValue) {
                throw new Error('skip changed existing owner data');
            }
            await assertClean(page, issues, 'existing-user preservation and skip');
            console.log('PASS existing-user preservation and skip');
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    {
        const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
        const queueValue = JSON.stringify([]);
        const holdingsValue = '{corrupt-existing-portfolio';
        await context.addInitScript(({ setupKey, queueKey, queueValue, holdingsKey, holdingsValue }) => {
            localStorage.setItem(setupKey, '{"version":99,"private":"DEMO_SECRET"}');
            localStorage.setItem(queueKey, queueValue);
            localStorage.setItem(holdingsKey, holdingsValue);
        }, { setupKey, queueKey, queueValue, holdingsKey, holdingsValue });
        const page = await context.newPage();
        const state = { record: null };
        const requestLog = [];
        const issues = [];
        await installResearchRoutes(page, state, requestLog, issues);
        try {
            await page.goto(`${baseUrl}/research`, { waitUntil: 'domcontentloaded', timeout });
            const recovery = page.getByTestId('first-run-setup-recovery');
            await recovery.waitFor({ state: 'visible', timeout });
            await recovery.getByRole('button', { name: 'Restart setup safely' }).click();
            await page.getByTestId('first-run-setup').waitFor({ state: 'visible', timeout });
            if (await page.evaluate((key) => localStorage.getItem(key), holdingsKey) !== holdingsValue
                || await page.evaluate((key) => localStorage.getItem(key), queueKey) !== queueValue) {
                throw new Error('setup recovery changed corrupt Portfolio or Queue owner state');
            }
            await page.getByText('Use the existing Portfolio recovery path; setup did not clear it.').waitFor({ state: 'visible', timeout });
            await assertClean(page, issues, 'corrupt setup recovery');
            console.log('PASS corrupt and partial-storage recovery');
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 } });
        const page = await context.newPage();
        const apiRequests = [];
        const issues = [];
        page.on('request', (request) => {
            if (request.url().includes('/api/')) apiRequests.push(request.url());
        });
        page.on('console', (message) => {
            if (message.type() === 'error') issues.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
        try {
            await page.goto(`${baseUrl}/demo`, { waitUntil: 'networkidle', timeout });
            const demo = page.getByTestId('guided-demo');
            await demo.waitFor({ state: 'visible', timeout });
            await demo.getByText('Demo · example data · not live').waitFor({ state: 'visible', timeout });
            const marketTab = demo.getByRole('tab', { name: /Market/ });
            await marketTab.focus();
            await marketTab.press('ArrowRight');
            await demo.getByText('Example saved-review shape · read only').waitFor({ state: 'visible', timeout });
            await demo.getByRole('tab', { name: /Portfolio/ }).click();
            await demo.getByText('Planning boundary').waitFor({ state: 'visible', timeout });
            await demo.getByRole('button', { name: 'Restart demo' }).click();
            await demo.getByText('Example US market posture').waitFor({ state: 'visible', timeout });
            if (apiRequests.length > 0) throw new Error(`${width}: read-only demo made API requests: ${apiRequests.join(', ')}`);
            const persisted = await page.evaluate(({ setupKey, holdingsKey, queueKey }) => ({
                setup: localStorage.getItem(setupKey),
                holdings: localStorage.getItem(holdingsKey),
                queue: localStorage.getItem(queueKey),
            }), { setupKey, holdingsKey, queueKey });
            if (persisted.setup !== null || persisted.holdings !== null || persisted.queue !== null) {
                throw new Error(`${width}: demo wrote real setup, Portfolio, or Queue storage`);
            }
            await assertClean(page, issues, `${width} guided demo`);
            await demo.screenshot({ path: path.join(screenshotDir, `guided-demo-${width}.png`) });
            console.log(`PASS isolated guided demo ${width}px`);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
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
    console.log(`Screenshots: ${screenshotDir}`);
    console.log('First-run setup and guided demo QA passed.');
}
