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
const screenshotDir = arg('--screenshot-dir', path.join('.tmp', 'research-workflow-queue-qa'));
const queueKey = 'signal-research-workflow-queue-v1';
const failures = [];

const task = (id, symbol, source) => ({
    id,
    symbol,
    templateId: 'thesis-challenge',
    source,
    dedupeKey: null,
    dueAt: '2026-07-30',
    createdAt: '2026-07-30T01:00:00.000Z',
    completedAt: null,
});
const queueTasks = [
    task('11111111-1111-4111-8111-111111111111', 'MSFT', 'manual'),
    task('22222222-2222-4222-8222-222222222222', 'MSFT', 'thesis-change'),
    task('33333333-3333-4333-8333-333333333333', 'MAYBANK', 'portfolio-reconciliation'),
    task('44444444-4444-4444-8444-444444444444', 'NVDA', 'market-exposure'),
];
const queueJson = JSON.stringify(queueTasks);

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
            return route.fulfill({
                status: 405,
                contentType: 'application/json',
                body: JSON.stringify({ success: false, error: 'Mutation blocked by Queue QA.' }),
            });
        }
        return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }),
        });
    });
    await page.route('**/api/research/quotes', (route) => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
    }));
};

const openQueue = async (page) => {
    await page.goto(`${baseUrl}/research?workspace=queue`, { waitUntil: 'domcontentloaded', timeout });
    const queue = page.getByTestId('research-workflow-queue');
    await queue.waitFor({ state: 'visible', timeout });
    return queue;
};

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 } });
        await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
            key: queueKey,
            value: queueJson,
        });
        const page = await context.newPage();
        const issues = [];
        const researchMutations = [];
        await installRoutes(page, issues, researchMutations);
        try {
            let queue = await openQueue(page);
            await queue.getByText('Manual', { exact: true }).waitFor({ state: 'visible', timeout });
            if (await queue.getByRole('button', { name: 'Open Manual source' }).count() !== 0) {
                throw new Error(`${width}: manual task exposed a source destination`);
            }
            await queue.getByRole('button', { name: 'Open Portfolio reconciliation source' }).click();
            await page.waitForURL(/workspace=portfolio/, { timeout });
            await page.getByRole('heading', { name: 'Portfolio exposure and risk cockpit' }).waitFor({ state: 'visible', timeout });

            queue = await openQueue(page);
            await queue.getByRole('button', { name: 'Open Thesis change source' }).click();
            await page.waitForURL(/workspace=changes/, { timeout });
            await page.getByRole('heading', { name: 'Thesis-change inbox' }).waitFor({ state: 'visible', timeout });

            queue = await openQueue(page);
            const stored = await page.evaluate((key) => localStorage.getItem(key), queueKey);
            if (stored !== queueJson) throw new Error(`${width}: source navigation mutated Queue tasks`);
            if (researchMutations.length > 0) throw new Error(`${width}: source navigation mutated research`);
            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${width}: Queue source navigation overflows by ${overflow}px`);
            if (issues.length > 0) throw new Error(`${width}: ${issues.join(' | ')}`);
            await queue.screenshot({ path: path.join(screenshotDir, `queue-source-navigation-${width}.png`) });

            if (width === 1280) {
                await queue.getByRole('button', { name: 'Open Market exposure source' }).click({ noWaitAfter: true });
                await page.waitForURL(`${baseUrl}/`, { timeout });
            }
            console.log(`PASS research workflow Queue source navigation ${width}px`);
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
    console.log('Research workflow Queue source navigation QA passed.');
}
