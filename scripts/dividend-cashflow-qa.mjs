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
const artifactDirectory = path.resolve(argument('--screenshot-dir', path.join('.tmp', 'dividend-cashflow-qa')));
const holdingsKey = 'signal-portfolio-holdings-v1';
const planningKey = 'signal-dividend-cashflow-v1';
const queueKey = 'signal-research-workflow-queue-v1';
const analyticsKey = 'signal-product-analytics-v1';
const privateMarkers = [
    'Private USD account',
    'Private MYR account',
    '"quantity":20',
    '"balance":2500',
    'qa-private-note-7f31',
];
await mkdir(artifactDirectory, { recursive: true });

const isoDate = (offset) => {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
};

const checklist = {
    understandBusiness: false, revenueGrowingOrStable: false, marginsHealthyOrImproving: false,
    debtManageable: false, freeCashFlowPositiveOrImproving: false, valuationReasonable: false,
    catalystOrCompoundingReason: false, downsideAcceptable: false, betterThanCashOrIndex: false,
};
const researchRecord = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned',
    inBuyZone: false, status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium',
    whyInterested: 'Protected thesis', bullCase: 'Protected bull case', bearCase: 'Protected bear case',
    buyTrigger: 'Protected buy trigger', sellTrigger: 'Protected sell trigger', thesisBreak: 'Protected invalidation',
    notes: 'Protected research notes', checklist,
    monitoringRules: {
        buyZone: true, belowMa200: true, rsiBelow: 30, rsiAbove: null,
        earningsWithinDays: 21, reviewAgeDays: 30,
        structuredTriggers: { version: 1, migrationState: 'current', rules: [] },
    },
    acceptedEvidence: [],
    documentEvidence: { version: 1, migrationState: 'current', citations: [] },
    factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: {
        decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null,
        benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null,
        priorOutcome: 'unresolved', outcomeNote: '',
    },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    reviewHistory: [], lastReviewedAt: isoDate(-6), updatedAt: new Date().toISOString(), revision: 1,
};
const malaysiaResearchRecord = {
    ...researchRecord,
    symbol: '1155.KL',
    market: 'MY',
    companyName: 'Maybank',
    whyInterested: 'Protected Malaysia thesis',
};
const holdingsFixture = {
    version: 1,
    updatedAt: `${isoDate(0)}T08:00:00.000Z`,
    holdings: [
        {
            accountLabel: 'Private USD account', symbol: 'MSFT', market: 'US', quantity: 20,
            averageCost: 400, currency: 'USD', importedAt: `${isoDate(0)}T08:00:00.000Z`,
            provenanceLabel: 'QA local snapshot',
        },
        {
            accountLabel: 'Private USD account', symbol: 'UNMATCHED', market: 'US', quantity: 3,
            averageCost: 10, currency: 'USD', importedAt: `${isoDate(0)}T08:00:00.000Z`,
            provenanceLabel: 'QA local snapshot',
        },
        {
            accountLabel: 'Private MYR account', symbol: '1155.KL', market: 'MY', quantity: 100,
            averageCost: 9, currency: 'MYR', importedAt: `${isoDate(0)}T08:00:00.000Z`,
            provenanceLabel: 'QA local snapshot',
        },
    ],
    cashBalances: [
        {
            accountLabel: 'Private USD account', currency: 'USD', balance: 2500,
            importedAt: `${isoDate(0)}T08:00:00.000Z`, provenanceLabel: 'QA local snapshot',
        },
        {
            accountLabel: 'Private MYR account', currency: 'MYR', balance: 700,
            importedAt: `${isoDate(0)}T08:00:00.000Z`, provenanceLabel: 'QA local snapshot',
        },
    ],
};

const dividendDiscovery = {
    success: true,
    data: {
        symbol: 'MSFT',
        market: 'US',
        fetchedAt: new Date().toISOString(),
        provider: 'Nasdaq dividends',
        sourceUrl: 'https://www.nasdaq.com/market-activity/stocks/msft/dividend-history',
        events: [{
            providerEventId: `MSFT:${isoDate(0)}:${isoDate(5)}:${isoDate(10)}:0.91`,
            symbol: 'MSFT',
            market: 'US',
            status: 'declared',
            declarationDate: isoDate(0),
            recordDate: isoDate(5),
            exDate: isoDate(5),
            paymentDate: isoDate(10),
            amountPerShare: 0.91,
            currency: 'USD',
            provider: 'Nasdaq dividends',
            sourceUrl: 'https://www.nasdaq.com/market-activity/stocks/msft/dividend-history',
            fetchedAt: new Date().toISOString(),
        }],
    },
};

const installRoutes = async (page, providerMode, evidence) => {
    page.on('console', (message) => {
        if ((providerMode === 'unavailable' || providerMode === 'error')
            && message.text().includes('Failed to load resource')) return;
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
        if (url.includes('/api/research/dividends/')) evidence.providerRequests.push({ url, body });
        if (privateMarkers.some((marker) => url.includes(marker) || body.includes(marker))) {
            evidence.privacyLeaks.push(`${request.method()} ${url}`);
        }
    });
    await page.route('**/api/research/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/api/research/watchlist' && request.method() === 'GET') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: [researchRecord, malaysiaResearchRecord], archivedSymbols: [] }),
            });
        }
        if (url.pathname === '/api/research/calendar' && request.method() === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        generatedAt: new Date().toISOString(),
                        rangeDays: Number(url.searchParams.get('range') ?? 30),
                        timezone: 'UTC',
                        events: [],
                        macroEvents: [],
                        warnings: [],
                    },
                }),
            });
        }
        if (url.pathname === '/api/research/inbox') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: { generatedAt: new Date().toISOString(), monitoredCount: 1, items: [], warnings: [] },
                }),
            });
        }
        if (url.pathname.startsWith('/api/research/quote/')) {
            const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        symbol,
                        market: url.searchParams.get('market') === 'MY' ? 'MY' : 'US',
                        providerSymbol: symbol,
                        fetchedAt: new Date().toISOString(),
                        quote: {
                            name: symbol,
                            currency: url.searchParams.get('market') === 'MY' ? 'MYR' : 'USD',
                            price: symbol === 'MSFT' ? 450 : null,
                            dailyChangePercent: null,
                        },
                    },
                }),
            });
        }
        if (url.pathname === '/api/research/dividends/MSFT') {
            await new Promise((resolve) => setTimeout(resolve, 1_500));
            if (providerMode === 'unavailable') return route.fulfill({
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, unavailable: true, error: 'No declared Nasdaq dividend metadata is available for this symbol.' }),
            });
            if (providerMode === 'error') return route.fulfill({
                status: 502,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, error: 'Official Nasdaq dividend metadata is temporarily unavailable.' }),
            });
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dividendDiscovery) });
        }
        evidence.unexpectedResearchRequests.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Unexpected QA route.' }) });
    });
};

const browser = await chromium.launch({ headless: true });
const failures = [];
const report = [];
try {
    for (const viewport of viewports) {
        const providerMode = viewport.width === 1280 ? 'success' : viewport.width === 768 ? 'unavailable' : 'error';
        const context = await browser.newContext({ viewport });
        await context.addInitScript(({ holdingsKey: key, holdings }) => {
            localStorage.setItem(key, JSON.stringify(holdings));
        }, { holdingsKey, holdings: holdingsFixture });
        const page = await context.newPage();
        const evidence = {
            blocking: [],
            privacyLeaks: [],
            providerRequests: [],
            unexpectedResearchRequests: [],
        };
        await installRoutes(page, providerMode, evidence);
        try {
            const navigation = page.goto(`${baseUrl}/research?workspace=calendar`, { waitUntil: 'domcontentloaded', timeout });
            const region = page.getByRole('region', { name: 'Dividend and cash-flow calendar' });
            await region.waitFor({ state: 'visible', timeout });
            await region.getByLabel('Dividend cash-flow account').selectOption('Private USD account');
            await region.getByText(/loading declared Nasdaq dividend metadata/i).waitFor({ timeout });
            await navigation;
            await region.getByText(/No dividend or cash-flow events in this exact scope/i).waitFor({ timeout });
            await region.getByText(/UNMATCHED \(US, unmatched\)/).waitFor({ timeout });

            if (providerMode === 'success') {
                await region.getByText(/1 declared event in view/i).waitFor({ timeout });
                await region.getByRole('button', { name: 'Confirm / edit' }).click();
                await region.getByText(/original provider values and source remain frozen as evidence/i).waitFor({ timeout });
                await region.getByLabel(/Notes/).fill('qa-private-note-7f31');
                await region.getByRole('button', { name: 'Save local event' }).click();
                await region.getByText(/Planning event saved at local revision 1/).waitFor({ timeout });
                await region.getByText(/Illustrative gross:/).waitFor({ timeout });
                await region.getByText(/20 shares × USD 0.91 = USD 18.2/).waitFor({ timeout });
                await region.getByRole('button', { name: 'Queue review' }).click();
                await region.getByRole('button', { name: 'Queue review' }).click();

                await region.getByRole('button', { name: 'Add cash flow' }).click();
                await region.getByLabel('Movement').selectOption('contribution');
                await region.getByLabel('Direction').selectOption('inflow');
                await region.getByLabel('Amount').fill('1000');
                await region.getByLabel(/Notes/).fill('Local contribution plan');
                await region.getByRole('button', { name: 'Save local event' }).click();
                await region.getByText(/Planning event saved at local revision 2/).waitFor({ timeout });
                const cashCard = region.locator('[data-dividend-cashflow-event]').filter({ hasText: 'Contribution' });
                await cashCard.getByRole('button', { name: 'Edit' }).click();
                await region.getByLabel('Amount').fill('1200');
                await region.getByRole('button', { name: 'Save local event' }).click();
                await region.getByText(/Planning event saved at local revision 3/).waitFor({ timeout });
                await page.getByLabel('Event type').selectOption('cash-flow');
                if (await region.locator('[data-dividend-cashflow-event]').filter({ hasText: 'MSFT' }).count() !== 0) {
                    throw new Error('1280: cash-flow event filter retained a dividend event');
                }
                await region.locator('[data-dividend-cashflow-event]').filter({ hasText: 'Contribution' }).waitFor({ timeout });
                await page.getByLabel('Event type').selectOption('ALL');

                const dividendCard = region.locator('[data-dividend-cashflow-event]').filter({ hasText: 'MSFT' });
                await dividendCard.getByRole('button', { name: 'Edit' }).click();
                await page.evaluate((key) => {
                    const current = JSON.parse(localStorage.getItem(key));
                    current.revision += 1;
                    current.updatedAt = new Date().toISOString();
                    localStorage.setItem(key, JSON.stringify(current));
                }, planningKey);
                await region.getByRole('button', { name: 'Save local event' }).click();
                await region.getByText(/changed in another tab/i).waitFor({ timeout });
                await page.reload({ waitUntil: 'domcontentloaded', timeout });
                const reloaded = page.getByRole('region', { name: 'Dividend and cash-flow calendar' });
                await reloaded.getByLabel('Dividend cash-flow account').selectOption('Private USD account');
                await reloaded.getByText(/Illustrative gross:/).waitFor({ timeout });
                await reloaded.locator('[data-dividend-cashflow-event]').filter({ hasText: 'Contribution' }).getByRole('button', { name: 'Remove' }).click();
                await reloaded.getByText(/Planning event removed at local revision 5/).waitFor({ timeout });

                const queue = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), queueKey);
                if (queue.length !== 1 || queue[0]?.source !== 'dividend-cashflow') throw new Error('1280: Queue dedupe did not retain exactly one dividend task');
                const storedHoldings = await page.evaluate((key) => localStorage.getItem(key), holdingsKey);
                if (storedHoldings !== JSON.stringify(holdingsFixture)) throw new Error('1280: planning interactions mutated actual holdings or cash');
                const analytics = await page.evaluate((key) => localStorage.getItem(key) ?? '', analyticsKey);
                if (analytics.includes('qa-private-note-7f31') || analytics.includes('Private USD account')) throw new Error('1280: private planning data entered product analytics');
            } else if (providerMode === 'unavailable') {
                await region.getByText(/MSFT · Unavailable/).waitFor({ timeout });
                await region.getByRole('button', { name: 'Enter manually' }).click();
                await region.getByText(/Add dividend event/).waitFor({ timeout });
                await region.getByRole('button', { name: 'Cancel' }).click();
                await region.getByLabel('Dividend cash-flow account').selectOption('Private MYR account');
                await region.getByText(/1155\.KL \(MY, provider unsupported\)/).waitFor({ timeout });
            } else {
                await region.getByText(/MSFT · Provider error/).waitFor({ timeout });
                await region.getByText(/Official Nasdaq dividend metadata is temporarily unavailable/).waitFor({ timeout });
            }

            const providerPaths = evidence.providerRequests.map((item) => new URL(item.url).pathname);
            if (providerPaths.some((pathname) => pathname !== '/api/research/dividends/MSFT')
                || evidence.providerRequests.some((item) => item.body !== '')) {
                throw new Error(`${viewport.width}: provider request included more than the exact ticker path`);
            }
            if (evidence.privacyLeaks.length > 0) throw new Error(`${viewport.width}: private data leaked into requests (${evidence.privacyLeaks.join(', ')})`);
            if (evidence.unexpectedResearchRequests.length > 0) throw new Error(`${viewport.width}: unexpected research requests (${evidence.unexpectedResearchRequests.join(', ')})`);
            if (evidence.blocking.length > 0) throw new Error(`${viewport.width}: ${evidence.blocking.join(' | ')}`);
            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${viewport.width}: dividend calendar overflows by ${overflow}px`);
            await page.getByRole('region', { name: 'Dividend and cash-flow calendar' }).screenshot({
                path: path.join(artifactDirectory, `dividend-cashflow-${viewport.width}.png`),
            });
            report.push({ viewport: viewport.width, providerMode, status: 'pass' });
            console.log(`PASS dividend cash-flow ${viewport.width}px (${providerMode})`);
        } catch (error) {
            const text = await page.getByRole('region', { name: 'Dividend and cash-flow calendar' }).textContent().catch(() => 'region unavailable');
            failures.push(`${error instanceof Error ? error.message : String(error)}\nSTATE ${viewport.width}: ${text?.slice(0, 1200)}\nREQUESTS ${JSON.stringify(evidence.providerRequests)}`);
        } finally {
            await context.close();
        }
    }

    const emptyContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const emptyPage = await emptyContext.newPage();
    const emptyEvidence = { blocking: [], privacyLeaks: [], providerRequests: [], unexpectedResearchRequests: [] };
    await installRoutes(emptyPage, 'success', emptyEvidence);
    try {
        await emptyPage.goto(`${baseUrl}/research?workspace=calendar`, { waitUntil: 'domcontentloaded', timeout });
        await emptyPage.getByRole('region', { name: 'Dividend and cash-flow calendar' }).getByText(/Import an actual holdings or cash snapshot first/).waitFor({ timeout });
        console.log('PASS dividend cash-flow empty holdings');
    } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
    } finally {
        await emptyContext.close();
    }

    const unavailableContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await unavailableContext.addInitScript(({ holdingsKey: holdings, planningKey: planning, fixture }) => {
        localStorage.setItem(holdings, JSON.stringify(fixture));
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function getItem(key) {
            if (key === planning) throw new Error('Storage unavailable for QA');
            return original.call(this, key);
        };
    }, { holdingsKey, planningKey, fixture: holdingsFixture });
    const unavailablePage = await unavailableContext.newPage();
    const unavailableEvidence = { blocking: [], privacyLeaks: [], providerRequests: [], unexpectedResearchRequests: [] };
    await installRoutes(unavailablePage, 'success', unavailableEvidence);
    try {
        await unavailablePage.goto(`${baseUrl}/research?workspace=calendar`, { waitUntil: 'domcontentloaded', timeout });
        await unavailablePage.getByRole('region', { name: 'Dividend and cash-flow calendar' }).getByRole('alert').getByText(/storage is unavailable/i).waitFor({ timeout });
        console.log('PASS dividend cash-flow storage unavailable');
    } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
    } finally {
        await unavailableContext.close();
    }
} finally {
    await browser.close();
}

await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(path.join(artifactDirectory, 'report.json'), JSON.stringify({ report, failures }, null, 2)));
if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Artifacts: ${artifactDirectory}`);
    console.log('Dividend and cash-flow QA passed.');
}
