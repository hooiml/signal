import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
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
const screenshotDir = arg('--screenshot-dir', path.join('.tmp', 'portfolio-transaction-reconciliation-qa'));
const holdingsKey = 'signal-portfolio-holdings-v1';
const transactionsKey = 'signal-portfolio-transactions-v1';
const queueKey = 'signal-research-workflow-queue-v1';
const privateMarker = 'PRIVATE-RECONCILIATION-MARKER';
const failures = [];

const holdingsSnapshot = {
    version: 1,
    updatedAt: '2026-07-30T02:00:00.000Z',
    holdings: [
        {
            accountLabel: privateMarker,
            symbol: 'MSFT',
            market: 'US',
            quantity: 10,
            averageCost: 400,
            currency: 'USD',
            importedAt: '2026-07-30T02:00:00.000Z',
            provenanceLabel: 'QA holdings',
        },
        {
            accountLabel: privateMarker,
            symbol: '1155.KL',
            market: 'MY',
            quantity: 100,
            averageCost: 9,
            currency: 'MYR',
            importedAt: '2026-07-30T02:00:00.000Z',
            provenanceLabel: 'QA holdings',
        },
    ],
    cashBalances: [
        {
            accountLabel: privateMarker,
            currency: 'USD',
            balance: 1000,
            importedAt: '2026-07-30T02:00:00.000Z',
            provenanceLabel: 'QA holdings',
        },
        {
            accountLabel: privateMarker,
            currency: 'MYR',
            balance: 500,
            importedAt: '2026-07-30T02:00:00.000Z',
            provenanceLabel: 'QA holdings',
        },
    ],
};
const transaction = (id, accountLabel, type, occurredOn, amount, currency, security = {}) => ({
    id,
    accountLabel,
    type,
    occurredOn,
    market: security.market ?? null,
    symbol: security.symbol ?? null,
    quantity: security.quantity ?? null,
    amount,
    currency,
    importedAt: '2026-07-30T03:00:00.000Z',
    provenanceLabel: 'QA transactions',
});
const transactionsSnapshot = {
    version: 1,
    updatedAt: '2026-07-30T03:00:00.000Z',
    transactions: [
        transaction('buy-msft', privateMarker, 'buy', '2026-07-01', 4800, 'USD', { market: 'US', symbol: 'MSFT', quantity: 12 }),
        transaction('sell-msft', privateMarker, 'sell', '2026-07-02', 900, 'USD', { market: 'US', symbol: 'MSFT', quantity: 2 }),
        transaction('div-msft', privateMarker, 'dividend', '2026-07-03', 15, 'USD', { market: 'US', symbol: 'MSFT' }),
        transaction('fee-msft', privateMarker, 'fee', '2026-07-03', 5, 'USD', { market: 'US', symbol: 'MSFT' }),
        transaction('deposit-main', privateMarker, 'deposit', '2026-07-01', 5000, 'USD'),
        transaction('withdraw-main', privateMarker, 'withdrawal', '2026-07-04', 100, 'USD'),
        transaction('deposit-b', 'Account B', 'deposit', '2026-07-01', 200, 'MYR'),
        transaction('buy-closed', 'Account C', 'buy', '2026-07-01', 100, 'USD', { market: 'US', symbol: 'AAPL', quantity: 1 }),
        transaction('sell-closed', 'Account C', 'sell', '2026-07-02', 100, 'USD', { market: 'US', symbol: 'AAPL', quantity: 1 }),
    ],
};
const holdingsJson = JSON.stringify(holdingsSnapshot);
const transactionsJson = JSON.stringify(transactionsSnapshot);
const unsafeTransactionsJson = JSON.stringify({
    ...transactionsSnapshot,
    transactions: [
        transaction('unsafe-precision', privateMarker, 'deposit', '2026-07-01', 100000000000000, 'USD'),
    ],
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
        if (candidate.includes(privateMarker)) privateRequests.push(candidate);
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

const seedContext = async (context, { holdings = holdingsJson, transactions = transactionsJson } = {}) => {
    await context.addInitScript(({ holdingsStorageKey, transactionStorageKey, holdingsValue, transactionsValue }) => {
        if (holdingsValue !== null) localStorage.setItem(holdingsStorageKey, holdingsValue);
        if (transactionsValue !== null) localStorage.setItem(transactionStorageKey, transactionsValue);
    }, {
        holdingsStorageKey: holdingsKey,
        transactionStorageKey: transactionsKey,
        holdingsValue: holdings,
        transactionsValue: transactions,
    });
};

const openPortfolio = async (context) => {
    const page = await context.newPage();
    const issues = [];
    const privateRequests = [];
    const researchMutations = [];
    await installRoutes(page, issues, privateRequests, researchMutations);
    await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
    const region = page.getByRole('region', { name: 'Compare transaction history with the holdings snapshot' });
    await region.waitFor({ state: 'visible', timeout });
    return { page, region, issues, privateRequests, researchMutations };
};

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 960 } });
        await seedContext(context);
        try {
            const { page, region, issues, privateRequests, researchMutations } = await openPortfolio(context);
            const positionTable = region.getByRole('table', { name: 'Position quantity comparison' });
            const msftRow = positionTable.getByRole('row').filter({ hasText: 'US:MSFT' });
            await msftRow.getByText('Match', { exact: true }).waitFor({ state: 'visible', timeout });
            await msftRow.getByText('10', { exact: true }).first().waitFor({ state: 'visible', timeout });
            const maybankRow = positionTable.getByRole('row').filter({ hasText: 'MY:1155.KL' });
            await maybankRow.getByText('Opening history needed', { exact: true }).waitFor({ state: 'visible', timeout });
            const closedRow = positionTable.getByRole('row').filter({ hasText: 'US:AAPL' });
            await closedRow.getByText('Closed / zero derived', { exact: true }).waitFor({ state: 'visible', timeout });
            if (await msftRow.getByRole('button', { name: /Queue .* reconciliation review/ }).count() !== 0) {
                throw new Error(`${width}: matching position exposed a reconciliation Queue action`);
            }
            if (await closedRow.getByRole('button', { name: /Queue .* reconciliation review/ }).count() !== 0) {
                throw new Error(`${width}: closed position exposed a reconciliation Queue action`);
            }

            if (width === 1280) {
                const queueReview = maybankRow.getByRole('button', { name: 'Queue 1155.KL reconciliation review' });
                await queueReview.click();
                await region.getByText('MAYBANK reconciliation review added to the Queue.').waitFor({ state: 'visible', timeout });
                await queueReview.click();
                await region.getByText('MAYBANK already has a reconciliation review in the Queue.').waitFor({ state: 'visible', timeout });
                const tasks = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '[]'), queueKey);
                const reconciliationTasks = tasks.filter((task) => task.source === 'portfolio-reconciliation');
                if (reconciliationTasks.length !== 1
                    || reconciliationTasks[0]?.symbol !== 'MAYBANK'
                    || reconciliationTasks[0]?.templateId !== 'thesis-challenge') {
                    throw new Error('1280: reconciliation Queue action did not create one exact connected task');
                }
                const taskKeys = Object.keys(reconciliationTasks[0] ?? {}).sort().join(',');
                if (taskKeys !== 'completedAt,createdAt,dedupeKey,dueAt,id,source,symbol,templateId') {
                    throw new Error(`1280: reconciliation Queue task contains unexpected fields (${taskKeys})`);
                }
                const queuePayload = JSON.stringify(reconciliationTasks);
                for (const privateValue of [privateMarker, 'QA holdings', 'QA transactions']) {
                    if (queuePayload.includes(privateValue)) throw new Error(`1280: Queue task leaked private reconciliation data (${privateValue})`);
                }
                await page.goto(`${baseUrl}/research?workspace=queue`, { waitUntil: 'domcontentloaded', timeout });
                const queueRegion = page.getByTestId('research-workflow-queue');
                await queueRegion.getByText('MAYBANK · Thesis challenge').waitFor({ state: 'visible', timeout });
                await queueRegion.getByText('Portfolio reconciliation', { exact: true }).waitFor({ state: 'visible', timeout });
                if (await queueRegion.getByText('MAYBANK · Thesis challenge').count() !== 1) {
                    throw new Error('1280: reconciliation-to-Queue handoff rendered duplicate pending reviews');
                }
                await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
                await region.waitFor({ state: 'visible', timeout });
            }

            const cashTable = region.getByRole('table', { name: 'Cash comparison by exact account and currency' });
            const mainUsdRow = cashTable.getByRole('row').filter({ hasText: privateMarker }).filter({ hasText: 'USD' });
            await mainUsdRow.getByText(/\$1,010\.00/).waitFor({ state: 'visible', timeout });
            await mainUsdRow.getByText(/-\$10\.00/).waitFor({ state: 'visible', timeout });
            await mainUsdRow.getByText('Difference', { exact: true }).waitFor({ state: 'visible', timeout });
            const accountBRow = cashTable.getByRole('row').filter({ hasText: 'Account B' });
            await accountBRow.getByText(/MYR\s*200\.00/).waitFor({ state: 'visible', timeout });
            await accountBRow.getByText('Transactions only', { exact: true }).waitFor({ state: 'visible', timeout });

            await region.getByText(/2026-07-01 to 2026-07-04/).waitFor({ state: 'visible', timeout });
            await region.getByText(/Splits, mergers, transfers, reinvestments/).waitFor({ state: 'visible', timeout });
            const stored = await page.evaluate(({ holdingsStorageKey, transactionStorageKey }) => ({
                holdings: localStorage.getItem(holdingsStorageKey),
                transactions: localStorage.getItem(transactionStorageKey),
            }), { holdingsStorageKey: holdingsKey, transactionStorageKey: transactionsKey });
            if (stored.holdings !== holdingsJson) throw new Error(`${width}: reconciliation mutated holdings storage`);
            if (stored.transactions !== transactionsJson) throw new Error(`${width}: reconciliation mutated transaction storage`);
            if (privateRequests.length > 0) throw new Error(`${width}: private reconciliation data entered a network request`);
            if (researchMutations.length > 0) throw new Error(`${width}: reconciliation mutated research`);
            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${width}: reconciliation surface overflows by ${overflow}px`);
            if (issues.length > 0) throw new Error(`${width}: ${issues.join(' | ')}`);
            await region.screenshot({ path: path.join(screenshotDir, `portfolio-reconciliation-${width}.png`) });
            console.log(`PASS portfolio transaction reconciliation ${width}px`);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    for (const scenario of [
        {
            name: 'empty',
            holdings: null,
            transactions: null,
            expected: 'Import a holdings snapshot and a transaction history above.',
        },
        {
            name: 'missing-holdings',
            holdings: null,
            transactions: transactionsJson,
            expected: 'Import a holdings snapshot above. The transaction history remains unchanged.',
        },
        {
            name: 'missing-transactions',
            holdings: holdingsJson,
            transactions: null,
            expected: 'Import a transaction history above. The holdings snapshot remains unchanged.',
        },
        {
            name: 'invalid-transactions',
            holdings: holdingsJson,
            transactions: '{"version":1,"transactions":"bad"}',
            expected: 'Saved transaction data is invalid',
        },
        {
            name: 'unsafe-precision',
            holdings: holdingsJson,
            transactions: unsafeTransactionsJson,
            expected: 'Cash amount exceeds safe reconciliation precision.',
        },
    ]) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await seedContext(context, scenario);
        try {
            const { region, issues } = await openPortfolio(context);
            await region.getByText(scenario.expected, { exact: scenario.name !== 'invalid-transactions' }).waitFor({ state: 'visible', timeout });
            if (issues.length > 0) throw new Error(`${scenario.name}: ${issues.join(' | ')}`);
            console.log(`PASS portfolio transaction reconciliation ${scenario.name}`);
        } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
        } finally {
            await context.close();
        }
    }

    const refreshContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await seedContext(refreshContext);
    try {
        const { page, region, issues } = await openPortfolio(refreshContext);
        await page.evaluate(({ key, snapshot }) => {
            const changed = {
                ...snapshot,
                updatedAt: '2026-07-30T05:00:00.000Z',
                holdings: snapshot.holdings.map((holding) =>
                    holding.symbol === 'MSFT' ? { ...holding, quantity: 11 } : holding),
            };
            localStorage.setItem(key, JSON.stringify(changed));
            window.dispatchEvent(new CustomEvent('signal:portfolio-holdings-change'));
        }, { key: holdingsKey, snapshot: holdingsSnapshot });
        const row = region.getByRole('table', { name: 'Position quantity comparison' })
            .getByRole('row').filter({ hasText: 'US:MSFT' });
        await row.getByText('Difference', { exact: true }).waitFor({ state: 'visible', timeout });
        await row.getByText('1', { exact: true }).waitFor({ state: 'visible', timeout });
        if (issues.length > 0) throw new Error(`same-tab-refresh: ${issues.join(' | ')}`);
        console.log('PASS portfolio transaction reconciliation same-tab-refresh');
    } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
    } finally {
        await refreshContext.close();
    }

    const queueUnavailableContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await seedContext(queueUnavailableContext);
    try {
        const { page, region, issues } = await openPortfolio(queueUnavailableContext);
        await page.evaluate((key) => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function setItem(candidate, value) {
                if (candidate === key) throw new Error('Queue storage unavailable for QA');
                return original.call(this, candidate, value);
            };
        }, queueKey);
        const row = region.getByRole('table', { name: 'Position quantity comparison' })
            .getByRole('row').filter({ hasText: 'MY:1155.KL' });
        await row.getByRole('button', { name: 'Queue 1155.KL reconciliation review' }).click();
        await region.getByText('The Research Queue is unavailable in this browser.').waitFor({ state: 'visible', timeout });
        if (issues.length > 0) throw new Error(`queue-storage-unavailable: ${issues.join(' | ')}`);
        console.log('PASS portfolio transaction reconciliation Queue storage-unavailable');
    } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
    } finally {
        await queueUnavailableContext.close();
    }

    const unavailableContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await unavailableContext.addInitScript((key) => {
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function getItem(candidate) {
            if (candidate === key) throw new Error('Storage unavailable for QA');
            return original.call(this, candidate);
        };
    }, transactionsKey);
    try {
        const { region, issues } = await openPortfolio(unavailableContext);
        await region.getByRole('alert').getByText(/Browser storage is unavailable/).waitFor({ state: 'visible', timeout });
        if (issues.length > 0) throw new Error(`storage-unavailable: ${issues.join(' | ')}`);
        console.log('PASS portfolio transaction reconciliation storage-unavailable');
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
    console.log('Portfolio transaction reconciliation QA passed.');
}
