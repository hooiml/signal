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
const screenshotDir = arg('--screenshot-dir', path.join('.tmp', 'portfolio-import-qa'));
const storageKey = 'signal-portfolio-holdings-v1';
const queueStorageKey = 'signal-research-workflow-queue-v1';
const analyticsStorageKey = 'signal-product-analytics-v1';
const failures = [];

const seededSnapshot = {
    version: 1,
    updatedAt: '2026-07-26T10:00:00.000Z',
    holdings: [
        {
            accountLabel: 'Main account', symbol: 'MSFT', market: 'US', quantity: 10,
            averageCost: 420.5, currency: 'USD', importedAt: '2026-07-26T10:00:00.000Z',
            provenanceLabel: 'QA import',
        },
        {
            accountLabel: 'Malaysia account', symbol: 'UNKNOWN', market: 'MY', quantity: 100,
            averageCost: 2.5, currency: 'MYR', importedAt: '2026-07-26T10:00:00.000Z',
            provenanceLabel: 'QA import',
        },
    ],
    cashBalances: [
        {
            accountLabel: 'Main account', currency: 'USD', balance: 2500,
            importedAt: '2026-07-26T10:00:00.000Z', provenanceLabel: 'QA import',
        },
    ],
};

const installRoutes = async (page, issues, researchMutations) => {
    page.on('console', (message) => {
        if (message.type() === 'error') issues.push(`console: ${message.text()}`);
    });
    page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
    page.on('requestfailed', (request) => {
        if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()}`);
    });
    await page.route('**/api/research/watchlist**', async (route) => {
        if (route.request().method() !== 'GET') {
            researchMutations.push(`${route.request().method()} ${route.request().url()}`);
            return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ error: 'Mutation blocked by portfolio QA.' }) });
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }),
        });
    });
    await page.route('**/api/research/quote/**', async (route) => {
        const url = new URL(route.request().url());
        const symbol = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
        const market = url.searchParams.get('market');
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: {
                    quote: {
                        name: null,
                        currency: market === 'MY' ? 'MYR' : 'USD',
                        price: symbol === 'MSFT' ? 450 : null,
                        dailyChangePercent: null,
                    },
                },
            }),
        });
    });
};

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 960 } });
        if (width !== 1280) {
            await context.addInitScript(({ key, snapshot }) => {
                localStorage.setItem(key, JSON.stringify(snapshot));
            }, { key: storageKey, snapshot: seededSnapshot });
        }
        const page = await context.newPage();
        const issues = [];
        const researchMutations = [];
        await installRoutes(page, issues, researchMutations);
        try {
            await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
            const region = page.getByRole('region', { name: 'Read-only holdings snapshot' });
            await region.waitFor({ state: 'visible', timeout });
            await region.getByRole('button', { name: 'Download CSV template' }).focus();
            if (await page.evaluate(() => document.activeElement?.textContent?.trim()) !== 'Download CSV template') {
                throw new Error(`${width}: template control is not keyboard focusable`);
            }

            if (width === 1280) {
                await region.getByText('No imported holdings yet').waitFor({ state: 'visible', timeout });
                const downloadPromise = page.waitForEvent('download', { timeout });
                await region.getByRole('button', { name: 'Download CSV template' }).click();
                const download = await downloadPromise;
                const downloadPath = await download.path();
                if (!downloadPath) throw new Error('1280: template download did not produce a file');
                const template = await readFile(downloadPath, 'utf8');
                if (!template.startsWith('account_label,row_type,symbol,market,quantity,average_cost,currency,cash_balance')) {
                    throw new Error('1280: downloaded template does not use the canonical header');
                }

                const fileInput = region.getByLabel('Canonical CSV');
                await fileInput.setInputFiles({
                    name: 'invalid.csv',
                    mimeType: 'text/csv',
                    buffer: Buffer.from('account_label,symbol,quantity\nMain,MSFT,1'),
                });
                await region.getByRole('alert').getByText(/missing required column market/i).waitFor({ state: 'visible', timeout });

                await fileInput.setInputFiles({
                    name: 'partial.csv',
                    mimeType: 'text/csv',
                    buffer: Buffer.from([
                        'account_label,row_type,symbol,market,quantity,average_cost,currency,cash_balance',
                        '=Formula account,holding,MSFT,US,10,420.5,USD,',
                        'Main,holding,NVDA,US,not-a-number,100,USD,',
                        'Main,cash,,,,,USD,2500',
                    ].join('\n')),
                });
                await region.getByText('Partial import: rejected rows will not be saved.').waitFor({ state: 'visible', timeout });
                await region.getByText('Row 3: Quantity must be a finite number').waitFor({ state: 'visible', timeout });
                await region.getByText(/Add 1 holdings and 1 cash balances; skip 0 matches/).waitFor({ state: 'visible', timeout });
                await region.getByLabel(/I reviewed the complete preview/).check();
                await region.getByRole('button', { name: 'Save accepted snapshot' }).click();
                await region.getByText(/Saved 1 holding row and 1 cash balance locally/).waitFor({ state: 'visible', timeout });
                await region.getByText('=Formula account', { exact: true }).waitFor({ state: 'visible', timeout });
                await region.getByRole('button', { name: 'Exact match' }).waitFor({ state: 'visible', timeout });
                const queueReview = region.getByRole('button', { name: 'Queue MSFT holding review' });
                await queueReview.click();
                await region.getByText('MSFT holding review added to the Queue.').waitFor({ state: 'visible', timeout });
                await queueReview.click();
                await region.getByText('MSFT already has a holding review in the Queue.').waitFor({ state: 'visible', timeout });
                const queuedHoldingReviews = await page.evaluate((key) => {
                    const tasks = JSON.parse(localStorage.getItem(key) ?? '[]');
                    return tasks.filter((task) => task.source === 'portfolio-holdings');
                }, queueStorageKey);
                if (queuedHoldingReviews.length !== 1
                    || queuedHoldingReviews[0]?.symbol !== 'MSFT'
                    || queuedHoldingReviews[0]?.templateId !== 'thesis-challenge') {
                    throw new Error('1280: holding-review Queue action did not create one exact connected task');
                }
                const queueKeys = Object.keys(queuedHoldingReviews[0] ?? {}).sort().join(',');
                if (queueKeys !== 'completedAt,createdAt,dedupeKey,dueAt,id,source,symbol,templateId') {
                    throw new Error(`1280: holding-review Queue task contains unexpected fields (${queueKeys})`);
                }
                const queuePayload = JSON.stringify(queuedHoldingReviews);
                for (const privateValue of ['=Formula account', 'Main account', 'QA import', '420.5']) {
                    if (queuePayload.includes(privateValue)) throw new Error(`1280: Queue task leaked private holding data (${privateValue})`);
                }
                await region.getByText(/\$4,284\.00/).first().waitFor({ state: 'visible', timeout });
                await page.getByText('No planned allocation yet').waitFor({ state: 'visible', timeout });

                await fileInput.setInputFiles({
                    name: 'conflict.csv',
                    mimeType: 'text/csv',
                    buffer: Buffer.from([
                        'account_label,row_type,symbol,market,quantity,average_cost,currency,cash_balance',
                        '=Formula account,holding,MSFT,US,12,410,USD,',
                    ].join('\n')),
                });
                await region.getByText(/skip 1 matches/).waitFor({ state: 'visible', timeout });
                await region.getByLabel('Replace exact matches').check();
                await region.getByText(/replace 1 matches/).waitFor({ state: 'visible', timeout });
                const saveButton = region.getByRole('button', { name: 'Save accepted snapshot' });
                await region.getByLabel(/I reviewed the complete preview/).check();
                if (!await saveButton.isDisabled()) throw new Error('1280: replacement save enabled before separate acknowledgement');
                await region.getByLabel(/I acknowledge that 1 exact matching local row/).check();
                await saveButton.click();
                await region.getByText(/Saved 1 holding row and 0 cash balances locally/).waitFor({ state: 'visible', timeout });
                await page.reload({ waitUntil: 'domcontentloaded', timeout });
                await page.getByRole('region', { name: 'Read-only holdings snapshot' }).getByText('12', { exact: true }).waitFor({ state: 'visible', timeout });
                await page.goto(`${baseUrl}/research?workspace=queue`, { waitUntil: 'domcontentloaded', timeout });
                const queueRegion = page.getByTestId('research-workflow-queue');
                await queueRegion.getByText('MSFT · Thesis challenge').waitFor({ state: 'visible', timeout });
                await queueRegion.getByText('Portfolio holdings', { exact: true }).waitFor({ state: 'visible', timeout });
                if (await queueRegion.getByText('MSFT · Thesis challenge').count() !== 1) {
                    throw new Error('1280: Portfolio-to-Queue handoff rendered duplicate pending reviews');
                }
                await queueRegion.getByRole('button', { name: 'Open Portfolio holdings source' }).click();
                await page.waitForURL((url) => url.searchParams.get('workspace') === 'portfolio', { timeout });
                await page.goto(`${baseUrl}/research?workspace=queue`, { waitUntil: 'domcontentloaded', timeout });
                await page.getByTestId('research-workflow-queue').getByRole('button', { name: 'Start review' }).click();
                await page.waitForURL((url) => url.searchParams.get('ticker') === 'MSFT', { timeout });
                await page.goto(`${baseUrl}/research?workspace=queue`, { waitUntil: 'domcontentloaded', timeout });
                const pendingTask = page.getByTestId('research-workflow-queue').locator('li').filter({ hasText: 'MSFT · Thesis challenge' });
                await pendingTask.getByRole('button', { name: 'Mark complete' }).click();
                await pendingTask.getByText('Completed', { exact: true }).waitFor({ state: 'visible', timeout });
                const analyticsEvents = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{"events":[]}').events, analyticsStorageKey);
                const holdingsFunnel = analyticsEvents.filter((event) => event.source === 'portfolio_holdings');
                const funnelNames = holdingsFunnel.map((event) => event.name).sort().join(',');
                if (funnelNames !== 'workflow_completed,workflow_opened,workflow_queued,workflow_source_opened') {
                    throw new Error(`1280: holdings Queue funnel recorded unexpected actions (${funnelNames})`);
                }
                const analyticsPayload = JSON.stringify(holdingsFunnel);
                for (const privateValue of ['MSFT', '=Formula account', 'Main account', 'QA import', '420.5']) {
                    if (analyticsPayload.includes(privateValue)) throw new Error(`1280: product analytics leaked private holding data (${privateValue})`);
                }
                await page.goto(`${baseUrl}/research?workspace=usage`, { waitUntil: 'domcontentloaded', timeout });
                const funnelTable = page.getByRole('table', { name: 'Portfolio to Queue funnel' });
                const holdingsRow = funnelTable.getByRole('row').filter({ hasText: 'Portfolio holdings' });
                await holdingsRow.waitFor({ state: 'visible', timeout });
                const funnelCells = (await holdingsRow.getByRole('cell').allTextContents()).join('|');
                if (funnelCells !== '1|1|1|1') {
                    throw new Error(`1280: Usage did not render the holdings Queue funnel (${funnelCells})`);
                }
                await page.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
                await region.waitFor({ state: 'visible', timeout });
            } else {
                await region.getByText('Unmatched — kept visible').waitFor({ state: 'visible', timeout });
                await region.getByText('Unavailable', { exact: true }).first().waitFor({ state: 'visible', timeout });
                await region.getByText('Exact match').waitFor({ state: 'visible', timeout });
                await region.getByText(/1 holding value unavailable/).waitFor({ state: 'visible', timeout });
            }

            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${width}: portfolio import surface overflows by ${overflow}px`);
            if (researchMutations.length > 0) throw new Error(`${width}: portfolio import mutated research (${researchMutations.join(', ')})`);
            if (issues.length > 0) throw new Error(`${width}: ${issues.join(' | ')}`);
            await page.getByRole('region', { name: 'Read-only holdings snapshot' }).screenshot({
                path: path.join(screenshotDir, `portfolio-import-${width}.png`),
            });
            console.log(`PASS portfolio import ${width}px`);
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
    await installRoutes(unavailablePage, unavailableIssues, unavailableMutations);
    try {
        await unavailablePage.goto(`${baseUrl}/research?workspace=portfolio`, { waitUntil: 'domcontentloaded', timeout });
        const region = unavailablePage.getByRole('region', { name: 'Read-only holdings snapshot' });
        await region.getByRole('alert').getByText(/Browser storage is unavailable/).waitFor({ state: 'visible', timeout });
        if (unavailableIssues.length > 0) throw new Error(`storage-unavailable: ${unavailableIssues.join(' | ')}`);
        console.log('PASS portfolio import storage-unavailable');
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
    console.log('Portfolio import QA passed.');
}
