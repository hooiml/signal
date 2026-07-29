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
const screenshotDir = arg('--screenshot-dir', path.join('.tmp', 'portfolio-transaction-import-qa'));
const storageKey = 'signal-portfolio-transactions-v1';
const holdingsKey = 'signal-portfolio-holdings-v1';
const privateMarker = 'PRIVATE-TRANSACTION-MARKER';
const rawCsvMarker = 'RAW-CSV-ONLY-MARKER';
const failures = [];

const seededSnapshot = {
    version: 1,
    updatedAt: '2026-07-30T04:00:00.000Z',
    transactions: [{
        id: 'seed-001',
        accountLabel: 'Main account',
        type: 'buy',
        occurredOn: '2026-07-01',
        market: 'US',
        symbol: 'MSFT',
        quantity: 10,
        amount: 4205,
        currency: 'USD',
        importedAt: '2026-07-30T04:00:00.000Z',
        provenanceLabel: 'QA seed',
    }],
};
const seededHoldings = JSON.stringify({
    version: 1,
    updatedAt: '2026-07-30T03:00:00.000Z',
    holdings: [],
    cashBalances: [],
});

const installRoutes = async (page, issues, privateRequests, researchMutations) => {
    page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
    page.on('requestfailed', (request) => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()}`);
    });
    page.on('request', (request) => {
        const candidate = `${request.url()} ${request.postData() ?? ''}`;
        if (candidate.includes(privateMarker) || candidate.includes(rawCsvMarker)) privateRequests.push(candidate);
    });
    await page.route('**/api/research/watchlist**', async (route) => {
        if (route.request().method() !== 'GET') {
            researchMutations.push(`${route.request().method()} ${route.request().url()}`);
            return route.fulfill({ status: 405, contentType: 'application/json', body: '{"error":"Mutation blocked"}' });
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }),
        });
    });
};

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 960 } });
        await context.addInitScript(({ transactionKey, holdingsStorageKey, snapshot, holdings, seed }) => {
            localStorage.setItem(holdingsStorageKey, holdings);
            if (seed) localStorage.setItem(transactionKey, JSON.stringify(snapshot));
        }, {
            transactionKey: storageKey,
            holdingsStorageKey: holdingsKey,
            snapshot: seededSnapshot,
            holdings: seededHoldings,
            seed: width !== 1280,
        });
        const page = await context.newPage();
        const issues = [];
        const privateRequests = [];
        const researchMutations = [];
        await installRoutes(page, issues, privateRequests, researchMutations);
        try {
            await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
            const region = page.getByRole('region', { name: 'Read-only transaction import' });
            await region.waitFor({ state: 'visible', timeout });
            await region.getByRole('button', { name: 'Download transaction template' }).focus();
            if (await page.evaluate(() => document.activeElement?.textContent?.trim()) !== 'Download transaction template') {
                throw new Error(`${width}: template control is not keyboard focusable`);
            }

            if (width === 1280) {
                await region.getByText('No imported transactions yet').waitFor({ state: 'visible', timeout });
                const downloadPromise = page.waitForEvent('download', { timeout });
                await region.getByRole('button', { name: 'Download transaction template' }).click();
                const download = await downloadPromise;
                const downloadPath = await download.path();
                if (!downloadPath) throw new Error('1280: template download did not produce a file');
                const template = await readFile(downloadPath, 'utf8');
                if (!template.startsWith('transaction_id,account_label,type,date,market,symbol,quantity,amount,currency')) {
                    throw new Error('1280: downloaded template does not use the canonical header');
                }

                const fileInput = region.getByLabel('Canonical transaction CSV');
                await fileInput.setInputFiles({
                    name: 'partial.csv',
                    mimeType: 'text/csv',
                    buffer: Buffer.from([
                        'transaction_id,account_label,type,date,market,symbol,quantity,amount,currency',
                        `tx-private,${privateMarker},deposit,2026-07-01,,,,100,USD`,
                        `tx-formula,=HYPERLINK("${rawCsvMarker}"),fee,2026-07-01,,,,10,USD`,
                    ].join('\n')),
                });
                await region.getByText('Partial import: rejected rows will not be saved.').waitFor({ state: 'visible', timeout });
                await region.getByText(/Row 3: Formula-like value is not allowed/).waitFor({ state: 'visible', timeout });
                await region.getByText(/Add 1; skip 0 exact matches/).waitFor({ state: 'visible', timeout });
                await region.getByLabel(/I reviewed the complete preview/).check();
                await region.getByRole('button', { name: 'Save accepted transactions' }).click();
                await region.getByText(/Saved 1 accepted transaction row locally/).waitFor({ state: 'visible', timeout });
                await region.getByText(privateMarker, { exact: true }).waitFor({ state: 'visible', timeout });

                await fileInput.setInputFiles({
                    name: 'conflict.csv',
                    mimeType: 'text/csv',
                    buffer: Buffer.from([
                        'transaction_id,account_label,type,date,market,symbol,quantity,amount,currency',
                        `tx-private,${privateMarker},deposit,2026-07-02,,,,200,USD`,
                    ].join('\n')),
                });
                await region.getByText(/skip 1 exact matches/).waitFor({ state: 'visible', timeout });
                await region.getByLabel('Replace exact matches').check();
                await region.getByText(/replace 1 exact matches/).waitFor({ state: 'visible', timeout });
                const saveButton = region.getByRole('button', { name: 'Save accepted transactions' });
                await region.getByLabel(/I reviewed the complete preview/).check();
                if (!await saveButton.isDisabled()) throw new Error('1280: replacement enabled before separate acknowledgement');
                await region.getByLabel(/I acknowledge that 1 exact matching local transaction/).check();
                await saveButton.click();
                await region.getByText(/Saved 1 accepted transaction row locally/).waitFor({ state: 'visible', timeout });
                await page.reload({ waitUntil: 'domcontentloaded', timeout });
                const restored = page.getByRole('region', { name: 'Read-only transaction import' });
                await restored.getByText('$200.00', { exact: true }).waitFor({ state: 'visible', timeout });
            } else {
                await region.getByText('seed-001', { exact: true }).waitFor({ state: 'visible', timeout });
                await region.getByText('$4,205.00', { exact: true }).waitFor({ state: 'visible', timeout });
            }

            const privacy = await page.evaluate(({ transactionKey, holdingsStorageKey, rawMarker }) => {
                const transactionValue = localStorage.getItem(transactionKey) ?? '';
                return {
                    transactionValue,
                    holdingsValue: localStorage.getItem(holdingsStorageKey),
                    anyRawMarker: Object.values(localStorage).some((value) => value?.includes(rawMarker)),
                };
            }, { transactionKey: storageKey, holdingsStorageKey: holdingsKey, rawMarker: rawCsvMarker });
            if (privacy.holdingsValue !== seededHoldings) throw new Error(`${width}: transaction import mutated holdings storage`);
            if (privacy.anyRawMarker || privacy.transactionValue.includes(rawCsvMarker)) throw new Error(`${width}: raw rejected CSV content was persisted`);
            if (privateRequests.length > 0) throw new Error(`${width}: private transaction content entered a network request`);
            if (researchMutations.length > 0) throw new Error(`${width}: transaction import mutated research`);
            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${width}: transaction import surface overflows by ${overflow}px`);
            if (issues.length > 0) throw new Error(`${width}: ${issues.join(' | ')}`);
            await region.screenshot({ path: path.join(screenshotDir, `portfolio-transactions-${width}.png`) });
            console.log(`PASS portfolio transaction import ${width}px`);
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
    await installRoutes(unavailablePage, unavailableIssues, [], []);
    try {
        await unavailablePage.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
        const region = unavailablePage.getByRole('region', { name: 'Read-only transaction import' });
        await region.getByRole('alert').getByText(/Browser storage is unavailable/).waitFor({ state: 'visible', timeout });
        if (unavailableIssues.length > 0) throw new Error(`storage-unavailable: ${unavailableIssues.join(' | ')}`);
        console.log('PASS portfolio transaction import storage-unavailable');
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
    console.log('Portfolio transaction import QA passed.');
}
