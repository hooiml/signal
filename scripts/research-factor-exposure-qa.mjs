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
const artifactDirectory = path.resolve('.tmp', 'research-factor-exposure-qa');
const holdingsStorageKey = 'signal-portfolio-holdings-v1';
await mkdir(artifactDirectory, { recursive: true });

const checklist = {
    understandBusiness: false, revenueGrowingOrStable: false, marginsHealthyOrImproving: false,
    debtManageable: false, freeCashFlowPositiveOrImproving: false, valuationReasonable: false,
    catalystOrCompoundingReason: false, downsideAcceptable: false, betterThanCashOrIndex: false,
};
const recordFixture = (symbol, market, companyName) => ({
    symbol, market, companyName, positionState: 'not-owned', inBuyZone: false, status: 'watch',
    targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium',
    whyInterested: `${symbol} protected thesis`, bullCase: 'Protected bull case', bearCase: 'Protected bear case',
    buyTrigger: 'Protected buy trigger', sellTrigger: 'Protected sell trigger', thesisBreak: 'Protected invalidation',
    notes: 'Protected private notes', checklist,
    monitoringRules: {
        buyZone: true, belowMa200: true, rsiBelow: 30, rsiAbove: null,
        earningsWithinDays: 21, reviewAgeDays: 30,
        structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
    },
    acceptedEvidence: [{
        id: `accepted-${symbol}`, title: `${symbol} accepted fact`, summary: 'Private accepted summary',
        target: 'bullCase', tone: 'positive', mode: 'evidence', acceptedAt: '2026-07-20T00:00:00.000Z',
        sources: [{ id: `source-${symbol}`, label: 'Revenue', value: '100', source: 'Issuer', sourceUrl: 'https://example.com/evidence', reportingPeriod: '2026-Q2' }],
    }],
    documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: {
        decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null,
        benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null,
        priorOutcome: 'unresolved', outcomeNote: '',
    },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [],
    lastReviewedAt: '2026-07-20', updatedAt: '2026-07-26T00:00:00.000Z', revision: 1,
});
const holdingsFixture = {
    version: 1,
    updatedAt: '2026-07-26T10:00:00.000Z',
    holdings: [
        { accountLabel: 'Private USD account', symbol: 'MSFT', market: 'US', quantity: 2, averageCost: 90, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'Private factor QA' },
        { accountLabel: 'Private USD account', symbol: 'NVDA', market: 'US', quantity: 1, averageCost: 80, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'Private factor QA' },
        { accountLabel: 'Private USD account', symbol: 'ORCL', market: 'US', quantity: 1, averageCost: 80, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'Private factor QA' },
        { accountLabel: 'Private USD account', symbol: 'AMD', market: 'US', quantity: 3, averageCost: 70, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'Private factor QA' },
        { accountLabel: 'Private MYR account', symbol: '1155.KL', market: 'MY', quantity: 10, averageCost: 8, currency: 'MYR', importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'Private factor QA' },
    ],
    cashBalances: [],
};

const installRoutes = async (page, state, blocking) => {
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        if (message.text().includes('status of 409')) return;
        blocking.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
    page.on('requestfailed', (request) => {
        if ((request.failure()?.errorText ?? '').includes('ERR_ABORTED')) return;
        blocking.push(`requestfailed: ${request.method()} ${new URL(request.url()).pathname}`);
    });
    page.on('response', (response) => {
        if (response.status() < 400) return;
        const pathname = new URL(response.url()).pathname;
        if (response.status() === 409 && state.expectedConflicts > 0) {
            state.expectedConflicts -= 1;
            return;
        }
        blocking.push(`HTTP ${response.status()} ${pathname}`);
    });
    await page.route('**/api/research/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/api/research/watchlist' && request.method() === 'GET') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.records, archivedSymbols: [] }) });
            return;
        }
        if (url.pathname.startsWith('/api/research/watchlist/') && request.method() === 'PATCH') {
            const body = request.postDataJSON();
            state.mutations.push(body);
            if (state.conflictNext) {
                state.conflictNext = false;
                await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: `${body.symbol} changed in another session. Reload it before saving again.` }) });
                return;
            }
            state.records = state.records.map((record) => record.symbol === body.symbol
                ? {
                    ...record,
                    factorAssumptions: body.factorAssumptions,
                    revision: record.revision + 1,
                    updatedAt: new Date().toISOString(),
                }
                : record);
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: state.records.find((record) => record.symbol === body.symbol) }) });
            return;
        }
        if (url.pathname.startsWith('/api/research/quote/')) {
            const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
            const prices = { MSFT: 100, NVDA: null, ORCL: 100, '1155.KL': 10 };
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { quote: { name: symbol, currency: url.searchParams.get('market') === 'MY' ? 'MYR' : 'USD', price: prices[symbol] ?? null, dailyChangePercent: 0 } } }) });
            return;
        }
        if (url.pathname === '/api/research/inbox') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-26T00:00:00.000Z', monitoredCount: state.records.length, items: [], warnings: [] } }) });
            return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });
};

const browser = await chromium.launch({ headless: true });
const report = [];
try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        await context.addInitScript(({ key, holdings }) => {
            localStorage.setItem(key, JSON.stringify(holdings));
        }, { key: holdingsStorageKey, holdings: holdingsFixture });
        const page = await context.newPage();
        const state = {
            records: [
                recordFixture('MSFT', 'US', 'Microsoft'),
                recordFixture('NVDA', 'US', 'Nvidia'),
                recordFixture('ORCL', 'US', 'Oracle'),
                recordFixture('1155.KL', 'MY', 'Maybank'),
            ],
            mutations: [],
            conflictNext: false,
            expectedConflicts: 0,
        };
        const blocking = [];
        await installRoutes(page, state, blocking);
        await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
        const region = page.getByRole('region', { name: 'Portfolio factor-exposure matrix' });
        await region.waitFor({ state: 'visible', timeout });
        await region.getByText('No declared assumptions for these holdings').waitFor({ timeout });
        await region.getByText('Unmatched', { exact: true }).first().waitFor({ timeout });
        await region.getByText(/price unavailable/).first().waitFor({ timeout });

        await region.getByLabel('Factor assumption ticker').selectOption('MSFT');
        await region.getByLabel('Factor direction').selectOption('harmed-when-rises');
        await region.getByLabel('Factor materiality').selectOption('high');
        await region.getByLabel('Factor evidence date').fill('2026-07-25');
        await region.getByLabel('Factor evidence link').selectOption('accepted-MSFT');
        await region.getByLabel('Factor evidence note').fill('Private factor note 9f2c');
        await region.getByRole('button', { name: 'Add to draft' }).click();
        await region.getByRole('button', { name: 'Save factor assumptions' }).click();
        await region.getByText(/Factor assumptions saved with optimistic revision protection/).waitFor({ timeout });
        const firstMutation = state.mutations.at(-1);
        if (firstMutation?.mode !== 'factors'
            || firstMutation?.whyInterested !== 'MSFT protected thesis'
            || firstMutation?.acceptedEvidence?.length !== 1
            || firstMutation?.monitoringRules?.reviewAgeDays !== 30
            || firstMutation?.reviewHistory?.length !== 0) {
            blocking.push('factor save changed or omitted protected research fields');
        }
        await region.getByText(/66\.7% of known USD holding value is explicitly marked harmed when factor rises/i).waitFor({ timeout });
        await region.getByText('Harmed ↑ · High', { exact: true }).waitFor({ timeout });
        await region.getByText('Not declared', { exact: true }).first().waitFor({ timeout });
        await region.getByRole('button', { name: 'Queue concentration review' }).click();
        await region.getByRole('button', { name: 'Queue concentration review' }).click();

        await page.reload({ waitUntil: 'domcontentloaded', timeout });
        const reloaded = page.getByRole('region', { name: 'Portfolio factor-exposure matrix' });
        await reloaded.getByLabel('Factor assumption ticker').selectOption('MSFT');
        const savedAssumption = reloaded.locator('li').filter({ hasText: 'Private factor note 9f2c' });
        await savedAssumption.waitFor({ timeout });
        await savedAssumption.getByRole('button', { name: 'Edit' }).click();
        await reloaded.getByLabel('Factor direction').selectOption('mixed');
        await reloaded.getByRole('button', { name: 'Update staged assumption' }).click();
        state.conflictNext = true;
        state.expectedConflicts = 1;
        await reloaded.getByRole('button', { name: 'Save factor assumptions' }).click();
        await reloaded.getByText(/changed in another session/i).waitFor({ timeout });
        await reloaded.getByRole('button', { name: 'Save factor assumptions' }).click();
        await reloaded.getByText(/Factor assumptions saved with optimistic revision protection/).waitFor({ timeout });
        await reloaded.getByText('Mixed · High', { exact: true }).waitFor({ timeout });
        await reloaded.getByRole('button', { name: 'Remove' }).first().click();
        await reloaded.getByRole('button', { name: 'Save factor assumptions' }).click();
        await reloaded.getByText(/Factor assumptions saved with optimistic revision protection/).waitFor({ timeout });
        await reloaded.getByText('No declared assumptions for these holdings').waitFor({ timeout });
        await reloaded.getByRole('button', { name: 'Queue uncovered review' }).first().click();
        await reloaded.getByRole('button', { name: 'Queue uncovered review' }).first().click();

        await reloaded.getByLabel('Factor matrix account filter').selectOption('Private MYR account');
        await reloaded.getByText('Private MYR account · MYR').waitFor({ timeout });
        await reloaded.getByLabel('Factor matrix account filter').selectOption('all');
        await reloaded.getByLabel('Factor matrix currency filter').selectOption('USD');
        await reloaded.getByText('Private USD account · USD').waitFor({ timeout });

        state.records = state.records.map((record) => record.symbol === 'NVDA' ? {
            ...record,
            factorAssumptions: {
                version: 1, migrationState: 'current', assumptions: [{
                    factor: 'ai-data-center-capex', direction: 'benefits-when-rises', materiality: 'high',
                    evidenceNote: 'Orphaned evidence state', evidenceDate: '2026-07-25', evidenceId: 'removed-citation',
                }],
            },
        } : record);
        await page.reload({ waitUntil: 'domcontentloaded', timeout });
        const unavailableLink = page.getByRole('region', { name: 'Portfolio factor-exposure matrix' });
        await unavailableLink.getByText('Benefits ↑ · High', { exact: true }).click();
        await unavailableLink.getByText(/Orphaned evidence state · Evidence link unavailable/).waitFor({ timeout });

        state.records = state.records.map((record) => record.symbol === 'MSFT' ? {
            ...record,
            factorAssumptions: { version: 1, assumptions: [{ factor: 'invented' }] },
        } : record);
        await page.reload({ waitUntil: 'domcontentloaded', timeout });
        const recovery = page.getByRole('region', { name: 'Portfolio factor-exposure matrix' });
        await recovery.getByLabel('Factor assumption ticker').selectOption('MSFT');
        await recovery.getByText(/Malformed persisted factor assumptions were recovered/).waitFor({ timeout });

        const queue = await page.evaluate(() => JSON.parse(localStorage.getItem('signal-research-workflow-queue-v1') ?? '[]'));
        const factorTasks = queue.filter((task) => task.source === 'factor-exposure');
        if (factorTasks.length !== 2) blocking.push(`factor Queue actions did not deduplicate (${factorTasks.length})`);
        const analytics = await page.evaluate(() => Object.entries(localStorage)
            .filter(([key]) => key.includes('analytics')).map(([, value]) => value).join('\n'));
        for (const secret of ['Private factor note 9f2c', 'Private USD account', 'Private MYR account', 'removed-citation']) {
            if (analytics.includes(secret)) blocking.push(`private factor or holdings data leaked into analytics: ${secret}`);
        }
        const overflow = await page.evaluate(() =>
            Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > window.innerWidth + 1);
        if (overflow) blocking.push('document has horizontal overflow');
        await recovery.screenshot({ path: path.join(artifactDirectory, `factor-exposure-${viewport.width}.png`) });
        report.push({ viewport: viewport.width, mutations: state.mutations.length, queueCount: factorTasks.length, overflow, blocking });
        await context.close();
    }

    for (const scenario of ['empty', 'unavailable']) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        if (scenario === 'unavailable') {
            await context.addInitScript((key) => {
                const original = Storage.prototype.getItem;
                Storage.prototype.getItem = function getItem(candidate) {
                    if (candidate === key) throw new Error('Storage unavailable for factor QA');
                    return original.call(this, candidate);
                };
            }, holdingsStorageKey);
        }
        const page = await context.newPage();
        const state = { records: [recordFixture('MSFT', 'US', 'Microsoft')], mutations: [], conflictNext: false, expectedConflicts: 0 };
        const blocking = [];
        await installRoutes(page, state, blocking);
        await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
        const region = page.getByRole('region', { name: 'Portfolio factor-exposure matrix' });
        if (scenario === 'empty') await region.getByText('No imported holdings', { exact: true }).waitFor({ timeout });
        else await region.getByRole('alert').getByText(/Browser storage is unavailable/).waitFor({ timeout });
        report.push({ viewport: scenario, mutations: 0, queueCount: 0, overflow: false, blocking });
        await context.close();
    }
} finally {
    await browser.close();
}

console.log(JSON.stringify({ baseUrl, report, artifactDirectory }, null, 2));
if (report.some((scenario) => scenario.blocking.length > 0)) process.exitCode = 1;
