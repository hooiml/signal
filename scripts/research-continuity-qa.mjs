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
const screenshotDir = arg('--screenshot-dir', path.join('.tmp', 'research-continuity-qa'));
const token = '0123456789abcdef0123456789abcdef';
const passphrase = 'correct horse battery staple';
const failures = [];

await mkdir(screenshotDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 } });
        await context.addInitScript(() => {
            let retained = [];
            try {
                retained = JSON.parse(sessionStorage.getItem('signal-test-notifications') ?? '[]');
            } catch {
                // about:blank has no storage origin; the script runs again on the target origin.
            }
            window.__signalNotifications = retained;
            class TestNotification {
                static permission = 'granted';
                static requestPermission = async () => 'granted';
                constructor(title, options) {
                    window.__signalNotifications.push({ title, body: options?.body ?? '', tag: options?.tag ?? '' });
                    try {
                        sessionStorage.setItem('signal-test-notifications', JSON.stringify(window.__signalNotifications));
                    } catch {
                        // The test still retains the in-document delivery record.
                    }
                }
            }
            Object.defineProperty(window, 'Notification', { configurable: true, value: TestNotification });
        });
        const page = await context.newPage();
        const issues = [];
        const researchMutations = [];
        let remote = { envelope: null, revision: 0, updatedAt: null };
        let forceConflict = false;
        let alertVersion = 1;
        let settingsFailure = false;
        let expectedSyncConflict = false;
        page.on('console', (message) => {
            if (message.type() === 'error'
                && !(settingsFailure && message.text().includes('Failed to load resource'))
                && !(expectedSyncConflict && message.text().includes('Failed to load resource'))) issues.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
        page.on('requestfailed', (request) => {
            if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()}`);
        });
        await page.route('**/api/research/watchlist**', async (route) => {
            if (route.request().method() !== 'GET') {
                researchMutations.push(`${route.request().method()} ${route.request().url()}`);
                return route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Research mutation blocked by continuity QA.' }) });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }),
            });
        });
        await page.route('**/api/research/sync', async (route) => {
            if (route.request().headers().authorization !== `Bearer ${token}`) {
                return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Private sync authorization failed.' }) });
            }
            if (route.request().method() === 'GET') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: remote }) });
            }
            const body = route.request().postDataJSON();
            if (forceConflict || body.expectedRevision !== remote.revision) {
                forceConflict = false;
                return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'The remote sync vault changed. Check it again before replacing the ciphertext.' }) });
            }
            remote = { envelope: body.envelope, revision: remote.revision + 1, updatedAt: '2026-07-26T09:00:00.000Z' };
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: remote }) });
        });
        await page.route('**/api/research/alerts', (route) => route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                data: {
                    generatedAt: `2026-07-26T09:0${alertVersion}:00.000Z`,
                    monitoredCount: 2,
                    alerts: [
                        { symbol: 'MSFT', title: `Risk alert v${alertVersion}`, detail: 'Review the updated risk condition.', severity: 'risk' },
                        { symbol: 'NVDA', title: 'Near buy zone', detail: 'Price is near the saved range.', severity: 'opportunity' },
                    ],
                    warnings: [],
                },
            }),
        }));
        await page.route('**/api/research/notifications/settings', (route) => {
            if (settingsFailure) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Settings unavailable.' }) });
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                    data: {
                        settings: { enabled: false, mode: 'urgent-only', quietHoursEnabled: false, quietHoursStartUtc: 22, quietHoursEndUtc: 7 },
                        configured: false,
                        history: [],
                    },
                }),
            });
        });

        try {
            await page.goto(`${baseUrl}/research?workspace=backup`, { waitUntil: 'domcontentloaded', timeout });
            const sync = page.getByRole('region', { name: 'Private single-user sync vault' });
            await sync.waitFor({ state: 'visible', timeout });
            await sync.getByLabel('Server access token').fill(token);
            await sync.getByLabel('Encryption passphrase').fill(passphrase);
            await sync.getByRole('button', { name: 'Check remote vault' }).click();
            await sync.getByText('The private sync vault is empty.').waitFor({ state: 'visible', timeout });
            await sync.getByRole('button', { name: 'Push encrypted copy' }).click();
            await sync.getByText(/Encrypted \d+ records? to remote snapshot 1\./).waitFor({ state: 'visible', timeout });
            if (!remote.envelope || remote.envelope.includes('Durable enterprise distribution')) throw new Error(`${width}: remote payload exposed research plaintext`);
            const storedValues = await page.evaluate(() => Object.values(localStorage));
            if (storedValues.some((value) => value.includes('0123456789abcdef') || value.includes('correct horse battery staple'))) throw new Error(`${width}: sync secret was persisted in local storage`);

            await sync.getByLabel('Encryption passphrase').fill(passphrase);
            await sync.getByRole('button', { name: 'Pull into import preview' }).click();
            await page.getByRole('heading', { name: 'Import preview' }).waitFor({ state: 'visible', timeout });
            if (!await page.getByLabel(/Add only/).isChecked()) throw new Error(`${width}: pulled import did not default to add-only`);

            if (width === 1280) {
                await sync.getByLabel('Encryption passphrase').fill(passphrase);
                await sync.getByLabel(/I checked remote revision 1/).check();
                forceConflict = true;
                expectedSyncConflict = true;
                await sync.getByRole('button', { name: 'Push encrypted copy' }).click();
                await sync.getByRole('alert').getByText(/remote sync vault changed/i).waitFor({ state: 'visible', timeout });
            }
            await sync.screenshot({ path: path.join(screenshotDir, `private-sync-${width}.png`) });

            await page.goto(`${baseUrl}/research?workspace=alerts`, { waitUntil: 'domcontentloaded', timeout });
            const native = page.getByRole('region', { name: 'This-device native notifications' });
            await native.waitFor({ state: 'visible', timeout });
            await page.getByText('Webhook not configured', { exact: true }).waitFor({ state: 'visible', timeout });
            await native.getByRole('button', { name: 'Enable on this device' }).click();
            try {
                await native.getByText('Native notifications enabled for this browser.').waitFor({ state: 'visible', timeout });
            } catch {
                throw new Error(`${width}: native enable failed: ${(await native.innerText()).replace(/\s+/g, ' ')}`);
            }
            if (await page.evaluate(() => window.__signalNotifications.length) !== 1) throw new Error(`${width}: permission action did not create exactly one test notification`);
            alertVersion = 2;
            await page.reload({ waitUntil: 'domcontentloaded', timeout });
            await page.getByRole('region', { name: 'This-device native notifications' }).waitFor({ state: 'visible', timeout });
            await page.waitForFunction(() => window.__signalNotifications.length === 2, undefined, { timeout });
            const delivered = await page.evaluate(() => window.__signalNotifications);
            if (!delivered[1]?.body.includes('MSFT: Risk alert v2') || delivered[1]?.body.includes('NVDA')) throw new Error(`${width}: risk-only native delivery used the wrong alerts`);
            await page.getByRole('button', { name: 'Disable on this device' }).click();
            alertVersion = 3;
            await page.reload({ waitUntil: 'domcontentloaded', timeout });
            await page.waitForTimeout(250);
            if (await page.evaluate(() => window.__signalNotifications.length) !== 2) throw new Error(`${width}: disabled native delivery emitted another notification`);
            if (width === 1280) {
                settingsFailure = true;
                await page.reload({ waitUntil: 'domcontentloaded', timeout });
                await page.getByText(/Settings unavailable.*Active in-app research alerts remain available/).waitFor({ state: 'visible', timeout });
                await page.getByRole('region', { name: 'This-device native notifications' }).waitFor({ state: 'visible', timeout });
                settingsFailure = false;
            }
            const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth);
            if (overflow > 1) throw new Error(`${width}: continuity surfaces overflow by ${overflow}px`);
            if (researchMutations.length > 0) throw new Error(`${width}: continuity checks mutated research (${researchMutations.join(', ')})`);
            if (issues.length > 0) throw new Error(`${width}: ${issues.join(' | ')}`);
            await page.getByRole('region', { name: 'This-device native notifications' }).screenshot({ path: path.join(screenshotDir, `native-notifications-${width}.png`) });
            console.log(`PASS research continuity ${width}px`);
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
    console.log('Research continuity QA passed.');
}
