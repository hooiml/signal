import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1];
    return args.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
};
const baseUrl = arg('--base-url', 'http://127.0.0.1:3000');
const timeout = Number(arg('--timeout', '15000'));
const widths = arg('--viewport', '1280,768,375').split(',').map(Number);
const screenshotDir = arg('--screenshot-dir', path.join('.tmp', 'portfolio-what-if-qa'));
const storageKey = 'signal-portfolio-holdings-v1';
const failures = [];

const seededSnapshot = {
    version: 1,
    updatedAt: '2026-07-26T10:00:00.000Z',
    holdings: [
        {
            accountLabel: 'Main account', symbol: 'MSFT', market: 'US', quantity: 10,
            averageCost: 100, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z',
            provenanceLabel: 'What-if QA',
        },
        {
            accountLabel: 'Main account', symbol: 'UNKNOWN', market: 'US', quantity: 2,
            averageCost: 50, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z',
            provenanceLabel: 'What-if QA',
        },
        {
            accountLabel: 'Malaysia account', symbol: '1155.KL', market: 'MY', quantity: 100,
            averageCost: 8, currency: 'MYR', importedAt: '2026-07-26T10:00:00.000Z',
            provenanceLabel: 'What-if QA',
        },
    ],
    cashBalances: [
        {
            accountLabel: 'Main account', currency: 'USD', balance: 500,
            importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'What-if QA',
        },
        {
            accountLabel: 'Malaysia account', currency: 'MYR', balance: 300,
            importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'What-if QA',
        },
    ],
};

const checklist = {
    understandBusiness: true,
    revenueGrowingOrStable: true,
    marginsHealthyOrImproving: true,
    debtManageable: true,
    freeCashFlowPositiveOrImproving: true,
    valuationReasonable: true,
    catalystOrCompoundingReason: true,
    downsideAcceptable: true,
    betterThanCashOrIndex: true,
};

const researchRecord = {
    symbol: 'MSFT',
    market: 'US',
    companyName: 'Microsoft',
    positionState: 'owned',
    inBuyZone: false,
    status: 'owned',
    targetBuyZone: '',
    valuationState: 'fair',
    thesisStrength: 'high',
    whyInterested: 'QA',
    bullCase: 'QA',
    bearCase: 'QA',
    buyTrigger: 'QA',
    sellTrigger: 'QA',
    thesisBreak: 'QA',
    notes: '',
    checklist,
    monitoringRules: {
        buyZone: true, belowMa200: true, rsiBelow: 30, rsiAbove: null,
        earningsWithinDays: 21, reviewAgeDays: 30,
    },
    acceptedEvidence: [],
    decisionJournal: {
        decision: 'Ready', confidence: 'medium', observedPrice: null, benchmarkLabel: null,
        benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null,
        priorOutcome: 'unresolved', outcomeNote: '',
    },
    positionPlan: {
        plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: 90,
    },
    reviewHistory: [],
    lastReviewedAt: '2026-07-20',
    updatedAt: '2026-07-20T00:00:00.000Z',
    revision: 1,
};

const installRoutes = async (page, issues, mutations, requests) => {
    page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
    page.on('request', (request) => requests.push(`${request.method()} ${request.url()} ${request.postData() ?? ''}`));
    page.on('requestfailed', (request) => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()}`);
    });
    await page.route('**/api/research/watchlist**', async (route) => {
        if (route.request().method() !== 'GET') {
            mutations.push(`${route.request().method()} ${route.request().url()}`);
            return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Mutation blocked by what-if QA.' }) });
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [researchRecord], archivedSymbols: [] }),
        });
    });
    await page.route('**/api/research/quote/**', async (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
            success: true,
            data: { quote: { name: 'QA quote', currency: 'USD', price: 120, dailyChangePercent: 0 } },
        }),
    }));
};

const fillLeg = async (region, index, values) => {
    await region.getByLabel(`Leg ${index} account`).selectOption(values.account);
    await region.getByLabel(`Leg ${index} symbol`).fill(values.symbol);
    await region.getByLabel(`Leg ${index} market`).selectOption(values.market);
    await region.getByLabel(`Leg ${index} currency`).selectOption(values.currency);
    await region.getByLabel(`Leg ${index} side`).selectOption(values.side);
    await region.getByLabel(`Leg ${index} quantity`).fill(String(values.quantity));
    if (values.price !== null) await region.getByLabel(`Leg ${index} assumed price`).fill(String(values.price));
};

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 960 }, acceptDownloads: true });
        await context.addInitScript(({ key, snapshot }) => {
            localStorage.setItem(key, JSON.stringify(snapshot));
        }, { key: storageKey, snapshot: seededSnapshot });
        const page = await context.newPage();
        const issues = [];
        const mutations = [];
        const requests = [];
        await installRoutes(page, issues, mutations, requests);
        try {
            await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
            const region = page.getByRole('region', { name: 'What-if and rebalancing sandbox' });
            await region.waitFor({ state: 'visible', timeout });
            await region.getByText('No hypothetical legs').waitFor({ state: 'visible', timeout });
            await region.getByRole('button', { name: 'Add leg' }).focus();
            if (await page.evaluate(() => document.activeElement?.textContent?.trim()) !== 'Add leg') {
                throw new Error(`${width}: add-leg control is not keyboard focusable`);
            }

            await region.getByRole('button', { name: 'Add leg' }).click();
            await region.getByText('1/20 legs · drafts never auto-resume').waitFor({ state: 'visible', timeout });
            await region.getByText(/Account label must contain|Select an exact account/).first().waitFor({ state: 'visible', timeout });
            await fillLeg(region, 1, {
                account: 'Main account', symbol: 'MSFT', market: 'US', currency: 'USD',
                side: 'buy', quantity: 5, price: null,
            });
            await region.getByText(/Assumed price is required/).waitFor({ state: 'visible', timeout });
            await region.getByLabel('Leg 1 assumed price').fill('110');
            await region.getByText(/cash deficit/i).waitFor({ state: 'visible', timeout });
            await region.getByTestId('portfolio-what-if-summary').waitFor({ state: 'visible', timeout });
            await region.getByText(/Valid illustration · no orders sent/).waitFor({ state: 'visible', timeout });
            await region.getByText(/Buy effect: quantity 10 → 15/).waitFor({ state: 'visible', timeout });

            if (width === 1280) {
                await region.getByLabel('Scenario label (optional, export only)').fill('=QA scenario');
                const downloadPromise = page.waitForEvent('download', { timeout });
                await region.getByRole('button', { name: 'Export CSV' }).click();
                const download = await downloadPromise;
                const file = await download.path();
                if (!file) throw new Error('1280: CSV export did not produce a file');
                const exported = await readFile(file, 'utf8');
                if (!exported.includes('No orders were sent')) throw new Error('1280: export omitted the no-orders notice');
                if (!exported.includes("'=QA scenario")) throw new Error('1280: export did not neutralize a formula-like scenario label');

                await region.getByRole('button', { name: 'Add leg' }).click();
                await fillLeg(region, 2, {
                    account: 'Main account', symbol: 'UNKNOWN', market: 'US', currency: 'USD',
                    side: 'sell', quantity: 3, price: 60,
                });
                await region.getByText(/Sell quantity exceeds the available holding quantity 2/).waitFor({ state: 'visible', timeout });
                if (await region.getByTestId('portfolio-what-if-summary').count()) {
                    throw new Error('1280: invalid basket retained a simulated summary');
                }
                await region.getByRole('button', { name: 'Remove leg 2' }).click();

                const privacyStart = requests.length;
                await region.getByRole('button', { name: 'Add leg' }).click();
                await fillLeg(region, 2, {
                    account: 'Main account', symbol: 'SECRETQA', market: 'US', currency: 'USD',
                    side: 'buy', quantity: 1, price: 123.45,
                });
                await region.getByText(/research unmatched/).waitFor({ state: 'visible', timeout });
                await page.waitForTimeout(250);
                const authoredRequests = requests.slice(privacyStart).join('\n');
                if (authoredRequests.includes('SECRETQA') || authoredRequests.includes('123.45')) {
                    throw new Error('1280: authored scenario content appeared in a network request');
                }
                await region.getByRole('button', { name: 'Remove leg 2' }).click();
            }

            await region.screenshot({ path: path.join(screenshotDir, `portfolio-what-if-${width}.png`) });
            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${width}: what-if surface overflows by ${overflow}px`);
            if (mutations.length > 0) throw new Error(`${width}: sandbox mutated research (${mutations.join(', ')})`);
            const storedBeforeReset = await page.evaluate((key) => localStorage.getItem(key), storageKey);
            if (storedBeforeReset !== JSON.stringify(seededSnapshot)) throw new Error(`${width}: sandbox mutated the accepted holdings snapshot`);

            await region.getByRole('button', { name: 'Reset' }).click();
            await region.getByText(/Scenario reset/).waitFor({ state: 'visible', timeout });
            await region.getByText('No hypothetical legs').waitFor({ state: 'visible', timeout });
            await region.getByRole('button', { name: 'Add leg' }).click();
            await page.reload({ waitUntil: 'domcontentloaded', timeout });
            const reloaded = page.getByRole('region', { name: 'What-if and rebalancing sandbox' });
            await reloaded.getByText('No hypothetical legs').waitFor({ state: 'visible', timeout });
            const storedAfterReload = await page.evaluate((key) => localStorage.getItem(key), storageKey);
            if (storedAfterReload !== JSON.stringify(seededSnapshot)) throw new Error(`${width}: reload changed the accepted holdings snapshot`);
            if (issues.length > 0) throw new Error(`${width}: ${issues.join(' | ')}`);
            console.log(`PASS portfolio what-if ${width}px`);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    const unavailableContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await unavailableContext.addInitScript((key) => {
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function getItem(candidate) {
            if (candidate === key) throw new Error('Storage unavailable for QA');
            return original.call(this, candidate);
        };
    }, storageKey);
    const unavailablePage = await unavailableContext.newPage();
    const unavailableIssues = [];
    const unavailableMutations = [];
    const unavailableRequests = [];
    await installRoutes(unavailablePage, unavailableIssues, unavailableMutations, unavailableRequests);
    try {
        await unavailablePage.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
        const region = unavailablePage.getByRole('region', { name: 'What-if and rebalancing sandbox' });
        await region.getByRole('alert').getByText(/Browser storage is unavailable/).waitFor({ state: 'visible', timeout });
        if (unavailableIssues.length > 0) throw new Error(`storage-unavailable: ${unavailableIssues.join(' | ')}`);
        console.log('PASS portfolio what-if storage-unavailable');
    } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
    } finally {
        await unavailableContext.close();
    }
} finally {
    await browser.close();
}

if (failures.length > 0) {
    failures.forEach((failure) => console.error(`FAIL ${failure}`));
    process.exitCode = 1;
} else {
    console.log(`Screenshots: ${screenshotDir}`);
    console.log('Portfolio what-if QA passed.');
}
