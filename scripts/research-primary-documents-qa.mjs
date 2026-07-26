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
const artifactDirectory = path.resolve('.tmp', 'research-primary-documents-qa');
await mkdir(artifactDirectory, { recursive: true });

const checklist = {
    understandBusiness: false, revenueGrowingOrStable: false, marginsHealthyOrImproving: false,
    debtManageable: false, freeCashFlowPositiveOrImproving: false, valuationReasonable: false,
    catalystOrCompoundingReason: false, downsideAcceptable: false, betterThanCashOrIndex: false,
};
const recordFixture = (symbol, market, companyName) => ({
    symbol, market, companyName, positionState: 'not-owned', inBuyZone: false, status: 'watch',
    targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium',
    whyInterested: `${symbol} private thesis`, bullCase: 'Private bull case', bearCase: 'Private bear case',
    buyTrigger: 'Private buy trigger', sellTrigger: 'Private sell trigger', thesisBreak: 'Private invalidation',
    notes: 'Private authored note', checklist,
    monitoringRules: {
        buyZone: true, belowMa200: true, rsiBelow: 30, rsiAbove: null,
        earningsWithinDays: 21, reviewAgeDays: 30,
        structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
    },
    acceptedEvidence: [],
    documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    decisionJournal: {
        decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null,
        benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null,
        priorOutcome: 'unresolved', outcomeNote: '',
    },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [],
    lastReviewedAt: '2026-07-20', updatedAt: '2026-07-26T00:00:00.000Z', revision: 1,
});

const browser = await chromium.launch({ headless: true });
const report = [];
try {
    for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        let records = [recordFixture('MSFT', 'US', 'Microsoft'), recordFixture('1155', 'MY', 'Maybank')];
        let conflictNext = false;
        let secState = 'result';
        let expectedConflictResponses = 0;
        const mutations = [];
        const blocking = [];
        page.on('console', (message) => {
            if (message.type() !== 'error') return;
            if (message.text().includes('status of 409') || message.text().includes('status of 503')) return;
            blocking.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => blocking.push(`pageerror: ${error.message}`));
        page.on('requestfailed', (request) => {
            const pathname = new URL(request.url()).pathname;
            if (pathname.startsWith('/api/research/quote/') && request.failure()?.errorText.includes('ERR_ABORTED')) return;
            blocking.push(`requestfailed: ${request.method()} ${pathname}`);
        });
        page.on('response', (response) => {
            const url = new URL(response.url());
            if (url.origin !== new URL(baseUrl).origin || response.status() < 400) return;
            if (response.status() === 409 && expectedConflictResponses > 0) {
                expectedConflictResponses -= 1;
                return;
            }
            if (response.status() === 503 && url.pathname.startsWith('/api/research/filings/')) return;
            blocking.push(`HTTP ${response.status()} ${url.pathname}`);
        });
        await page.route('**/api/research/**', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.pathname === '/api/research/watchlist' && request.method() === 'GET') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: records, archivedSymbols: [] }) });
                return;
            }
            if (url.pathname.startsWith('/api/research/watchlist/') && request.method() === 'PATCH') {
                const body = request.postDataJSON();
                mutations.push(body);
                if (conflictNext) {
                    conflictNext = false;
                    await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: `${body.symbol} changed in another session. Reload it before saving again.` }) });
                    return;
                }
                records = records.map((record) => record.symbol === body.symbol
                    ? { ...record, documentEvidence: body.documentEvidence, revision: record.revision + 1, updatedAt: new Date().toISOString() }
                    : record);
                const saved = records.find((record) => record.symbol === body.symbol);
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: saved }) });
                return;
            }
            if (url.pathname === '/api/research/filings/MSFT') {
                if (secState === 'degraded') {
                    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, degraded: true, reason: 'configuration', error: 'Official SEC discovery is unavailable until the operator configures a compliant SEC contact.' }) });
                    return;
                }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {
                    symbol: 'MSFT', cik: '0000789019', issuer: 'Microsoft Corp',
                    filings: secState === 'empty' ? [] : [{
                        accessionNumber: '0000789019-26-000001', form: '10-Q', sourceKind: '10-Q',
                        filingDate: '2026-07-20', reportingPeriod: '2026-06-30',
                        title: 'Microsoft Corp 10-Q filed 2026-07-20',
                        sourceUrl: 'https://www.sec.gov/Archives/edgar/data/789019/000078901926000001/msft-20260630.htm',
                        providerLabel: 'SEC EDGAR',
                    }],
                } }) });
                return;
            }
            if (url.pathname.startsWith('/api/research/quote/')) {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { quote: { name: 'Fixture', currency: 'USD', price: 100, dailyChangePercent: 0 } } }) });
                return;
            }
            if (url.pathname === '/api/research/inbox') {
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-26T00:00:00.000Z', monitoredCount: 2, items: [], warnings: [] } }) });
                return;
            }
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
        });

        await page.goto(`${baseUrl}/research?workspace=filings`, { waitUntil: 'domcontentloaded', timeout });
        await page.getByTestId('primary-document-evidence').waitFor({ timeout });
        await page.getByRole('button', { name: 'Load SEC filings' }).focus();
        await page.keyboard.press('Enter');
        await page.getByText('Microsoft Corp 10-Q filed 2026-07-20').waitFor({ timeout });
        await page.getByRole('button', { name: 'Capture' }).click();
        await page.getByLabel('Section, page, or location').fill('Risk factors, page 42');
        await page.getByLabel('Exact verbatim excerpt').fill('<strong>Literal evidence</strong> Demand may vary.');
        await page.getByRole('button', { name: 'Add to draft' }).click();
        await page.getByText('<strong>Literal evidence</strong> Demand may vary.', { exact: true }).waitFor({ timeout });
        await page.getByRole('button', { name: 'Save citations' }).click();
        await page.getByText(/Document citations saved with optimistic revision protection/).waitFor({ timeout });
        const firstMutation = mutations.at(-1);
        if (firstMutation?.mode !== 'evidence' || firstMutation?.whyInterested !== 'MSFT private thesis'
            || firstMutation?.checklist?.understandBusiness !== false || firstMutation?.decisionJournal?.decision !== 'Watch') {
            blocking.push('evidence save changed or omitted protected research fields');
        }

        await page.reload({ waitUntil: 'domcontentloaded', timeout });
        await page.getByText('<strong>Literal evidence</strong> Demand may vary.', { exact: true }).waitFor({ timeout });
        await page.getByRole('button', { name: 'Edit' }).first().click();
        await page.getByLabel('Exact verbatim excerpt').fill('Changed captured excerpt.');
        await page.getByRole('button', { name: 'Update staged citation' }).click();
        conflictNext = true;
        expectedConflictResponses = 1;
        await page.getByRole('button', { name: 'Save citations' }).click();
        await page.getByText(/changed in another session/i).waitFor({ timeout });
        await page.getByRole('button', { name: 'Save citations' }).click();
        await page.getByText(/Document citations saved with optimistic revision protection/).waitFor({ timeout });
        await page.getByRole('button', { name: /Queue task/ }).click();
        await page.getByRole('button', { name: /Queue task/ }).click();
        const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('signal-research-workflow-queue-v1') ?? '[]'));
        if (queued.length !== 1 || !String(queued[0]?.dedupeKey).startsWith('document:MSFT:')) blocking.push('document Queue task did not deduplicate');

        page.once('dialog', (dialog) => dialog.accept());
        await page.getByRole('button', { name: 'Remove' }).first().click();
        await page.getByRole('button', { name: 'Save citations' }).click();
        await page.getByText(/Document citations saved with optimistic revision protection/).waitFor({ timeout });

        await page.getByLabel('Evidence ticker').selectOption('1155');
        await page.getByText('Malaysia primary-source capture').waitFor({ timeout });
        await page.getByLabel('Title').fill('Maybank quarterly report');
        await page.getByLabel('Canonical HTTPS source URL').fill('https://www.maybank.com/investor-relations/report.pdf');
        await page.getByLabel('Section, page, or location').fill('Quarterly highlights, page 3');
        await page.getByLabel('Exact verbatim excerpt').fill('Manual Bursa or issuer excerpt.');
        await page.getByRole('button', { name: 'Add to draft' }).click();
        await page.getByRole('button', { name: 'Save citations' }).click();
        await page.getByText(/Document citations saved with optimistic revision protection/).waitFor({ timeout });
        await page.getByText(/Manual \/ retrieval unverified/).waitFor({ timeout });

        await page.getByLabel('Evidence ticker').selectOption('MSFT');
        secState = 'degraded';
        await page.getByRole('button', { name: 'Load SEC filings' }).click();
        await page.getByText(/operator configures a compliant SEC contact/).waitFor({ timeout });
        secState = 'empty';
        await page.getByRole('button', { name: 'Load SEC filings' }).click();
        await page.getByText(/No supported recent 10-K/).waitFor({ timeout });
        await page.screenshot({ path: path.join(artifactDirectory, `filings-${viewport.width}.png`), fullPage: true });

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        if (overflow) blocking.push('document has horizontal overflow');
        const analytics = await page.evaluate(() => Object.entries(localStorage)
            .filter(([key]) => key.includes('analytics')).map(([, value]) => value).join('\n'));
        for (const secret of ['MSFT', '1155', 'Literal evidence', 'maybank.com', 'fnv1a32:', 'Risk factors']) {
            if (analytics.includes(secret)) blocking.push(`document evidence leaked into analytics: ${secret}`);
        }
        report.push({ viewport: viewport.width, mutations: mutations.length, queueCount: queued.length, overflow, blocking });
        await context.close();
    }
} finally {
    await browser.close();
}
console.log(JSON.stringify({ baseUrl, report }, null, 2));
if (report.some((scenario) => scenario.blocking.length > 0)) process.exitCode = 1;
