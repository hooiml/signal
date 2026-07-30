import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : fallback;
};
const baseUrl = arg('--base-url', 'http://127.0.0.1:3000');
const timeout = Number(arg('--timeout', '15000'));
const widths = arg('--viewport', '1280,768,375').split(',').map(Number);
const screenshotDir = arg('--screenshot-dir', path.join('.tmp', 'portfolio-covered-attribution-qa'));
const holdingsKey = 'signal-portfolio-holdings-v1';
const transactionsKey = 'signal-portfolio-transactions-v1';
const privateMarker = 'PRIVATE-ATTRIBUTION-MARKER';
const failures = [];
const importedAt = '2026-07-30T03:00:00.000Z';

const holdings = {
    version: 1,
    updatedAt: importedAt,
    holdings: [
        { accountLabel: privateMarker, symbol: 'MSFT', market: 'US', quantity: 10, averageCost: 400, currency: 'USD', importedAt, provenanceLabel: 'QA' },
        { accountLabel: privateMarker, symbol: 'UNKNOWN', market: 'US', quantity: 1, averageCost: 10, currency: 'USD', importedAt, provenanceLabel: 'QA' },
        { accountLabel: privateMarker, symbol: '1155.KL', market: 'MY', quantity: 100, averageCost: 9, currency: 'MYR', importedAt, provenanceLabel: 'QA' },
    ],
    cashBalances: [],
};
const tx = (id, type, amount, currency, security = {}) => ({
    id, accountLabel: privateMarker, type, occurredOn: '2026-07-01',
    market: security.market ?? null, symbol: security.symbol ?? null,
    quantity: security.quantity ?? null, amount, currency, importedAt, provenanceLabel: 'QA',
});
const transactions = {
    version: 1,
    updatedAt: importedAt,
    transactions: [
        tx('buy-msft', 'buy', 4000, 'USD', { market: 'US', symbol: 'MSFT', quantity: 10 }),
        tx('buy-unknown', 'buy', 10, 'USD', { market: 'US', symbol: 'UNKNOWN', quantity: 1 }),
        tx('dividend', 'dividend', 15, 'USD', { market: 'US', symbol: 'MSFT' }),
        tx('fee', 'fee', 5, 'USD', { market: 'US', symbol: 'MSFT' }),
        tx('tax', 'tax', 3, 'USD', { market: 'US', symbol: 'MSFT' }),
    ],
};
const holdingsJson = JSON.stringify(holdings);
const transactionsJson = JSON.stringify(transactions);

const prepare = async (context, holdingsValue = holdingsJson, transactionsValue = transactionsJson) => {
    await context.addInitScript(({ hKey, tKey, hValue, tValue }) => {
        if (hValue !== null) localStorage.setItem(hKey, hValue);
        if (tValue !== null) localStorage.setItem(tKey, tValue);
    }, { hKey: holdingsKey, tKey: transactionsKey, hValue: holdingsValue, tValue: transactionsValue });
};

const open = async (context) => {
    const page = await context.newPage();
    const issues = [];
    const leaked = [];
    page.on('console', (message) => { if (message.type() === 'error') issues.push(`console: ${message.text()}`); });
    page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
    page.on('requestfailed', (request) => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()}`);
    });
    page.on('request', (request) => {
        if (`${request.url()} ${request.postData() ?? ''}`.includes(privateMarker)) leaked.push(request.url());
    });
    await page.route('**/api/research/watchlist**', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }),
    }));
    await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
    const region = page.getByRole('region', { name: 'Explain covered portfolio contributions' });
    await region.waitFor({ state: 'visible', timeout });
    return { page, region, issues, leaked };
};

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 960 } });
        await prepare(context);
        try {
            const { page, region, issues, leaked } = await open(context);
            await region.getByRole('region', { name: 'USD covered attribution' }).getByText('1/2 holdings covered').waitFor({ state: 'visible', timeout });
            await region.getByRole('region', { name: 'MYR covered attribution' }).getByText('0/1 holdings covered').waitFor({ state: 'visible', timeout });
            const table = region.getByRole('table', { name: 'Holding-level unrealized price coverage' });
            await table.getByRole('row').filter({ hasText: 'US:MSFT' }).getByText('Covered', { exact: true }).waitFor({ state: 'visible', timeout });
            await table.getByRole('row').filter({ hasText: 'US:UNKNOWN' }).getByText('Current price unavailable', { exact: true }).waitFor({ state: 'visible', timeout });
            await table.getByRole('row').filter({ hasText: 'MY:1155.KL' }).getByText('Transaction history does not reconcile', { exact: true }).waitFor({ state: 'visible', timeout });
            await region.getByText('Realized price').first().waitFor({ state: 'visible', timeout });
            await region.getByText('FX contribution').first().waitFor({ state: 'visible', timeout });
            const stored = await page.evaluate(({ hKey, tKey }) => ({
                holdings: localStorage.getItem(hKey),
                transactions: localStorage.getItem(tKey),
            }), { hKey: holdingsKey, tKey: transactionsKey });
            if (stored.holdings !== holdingsJson || stored.transactions !== transactionsJson) throw new Error(`${width}: attribution mutated source storage`);
            if (leaked.length > 0) throw new Error(`${width}: private attribution data entered a request`);
            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${width}: attribution overflows by ${overflow}px`);
            if (issues.length > 0) throw new Error(`${width}: ${issues.join(' | ')}`);
            await region.screenshot({ path: path.join(screenshotDir, `portfolio-attribution-${width}.png`) });
            console.log(`PASS covered portfolio attribution ${width}px`);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    for (const scenario of [
        { name: 'empty', holdings: null, transactions: null, expected: 'Holdings and transactions are both required' },
        { name: 'invalid', holdings: holdingsJson, transactions: '{"bad":true}', expected: 'Saved transaction data is invalid' },
    ]) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await prepare(context, scenario.holdings, scenario.transactions);
        try {
            const { region, issues } = await open(context);
            await region.getByText(scenario.expected, { exact: scenario.name === 'empty' }).waitFor({ state: 'visible', timeout });
            if (issues.length > 0) throw new Error(`${scenario.name}: ${issues.join(' | ')}`);
            console.log(`PASS covered portfolio attribution ${scenario.name}`);
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
    console.log('Covered portfolio attribution QA passed.');
}
