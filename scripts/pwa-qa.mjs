import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const timeout = 15_000;
const artifactDirectory = path.resolve('.tmp', 'pwa-qa', new Date().toISOString().replace(/[.:]/g, '-'));
await mkdir(artifactDirectory, { recursive: true });

const freePort = await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        server.close(() => resolve(address.port));
    });
});
const baseUrl = `http://127.0.0.1:${freePort}`;
const server = spawn(process.execPath, [
    path.resolve('node_modules', 'next', 'dist', 'bin', 'next'),
    'start',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(freePort),
], { cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

const waitForServer = async () => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${baseUrl}/offline`);
            if (response.ok) return;
        } catch {
            // The production server is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`Production server did not start.\n${serverOutput}`);
};

const report = { baseUrl, scenarios: [], console: [], expectedConsole: [], failedRequests: [], subscriptionRequests: [] };
const browser = await chromium.launch({ headless: true });
try {
    await waitForServer();
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        serviceWorkers: 'allow',
    });
    await context.addInitScript(() => {
        window.__signalQaPermission = 'default';
        window.__signalQaPermissionResult = 'granted';
        window.__signalQaPermissionCalls = 0;
        window.__signalQaSubscribed = false;
        const p256dh = btoa(String.fromCharCode(4, ...Array.from({ length: 64 }, (_, index) => index + 1)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const auth = btoa(String.fromCharCode(...Array.from({ length: 16 }, (_, index) => index + 11)))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const fakeSubscription = {
            endpoint: 'https://fcm.googleapis.com/fcm/send/browser-qa-capability',
            expirationTime: null,
            toJSON: () => ({
                endpoint: 'https://fcm.googleapis.com/fcm/send/browser-qa-capability',
                expirationTime: null,
                keys: { p256dh, auth },
            }),
            unsubscribe: async () => {
                window.__signalQaSubscribed = false;
                return true;
            },
        };
        if ('Notification' in window) {
            Object.defineProperty(Notification, 'permission', {
                configurable: true,
                get: () => window.__signalQaPermission,
            });
            Notification.requestPermission = async () => {
                window.__signalQaPermissionCalls += 1;
                window.__signalQaPermission = window.__signalQaPermissionResult;
                return window.__signalQaPermissionResult;
            };
        }
        if ('ServiceWorkerRegistration' in window) {
            Object.defineProperty(ServiceWorkerRegistration.prototype, 'pushManager', {
                configurable: true,
                get: () => ({
                    getSubscription: async () => window.__signalQaSubscribed ? fakeSubscription : null,
                    subscribe: async () => {
                        window.__signalQaSubscribed = true;
                        return fakeSubscription;
                    },
                }),
            });
        }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(timeout);
    let pushMode = 'configured';
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        if (message.text().includes('ERR_INTERNET_DISCONNECTED')
            || (pushMode === 'misconfigured' || pushMode === 'error') && message.text().includes('status of 503')) {
            report.expectedConsole.push(message.text());
            return;
        }
        report.console.push(message.text());
    });
    page.on('pageerror', (error) => report.console.push(error.message));
    page.on('requestfailed', (request) => {
        if (!request.failure()?.errorText.includes('ERR_INTERNET_DISCONNECTED')
            && !request.failure()?.errorText.includes('ERR_ABORTED')) {
            report.failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`);
        }
    });

    const publicKey = Buffer.from([4, ...Array.from({ length: 64 }, (_, index) => index + 1)]).toString('base64url');
    await page.route('**/api/research/**', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === '/api/research/push/subscriptions') {
            report.subscriptionRequests.push({
                method: request.method(),
                authorization: request.headers().authorization ?? null,
                body: request.postData(),
            });
            if (pushMode === 'misconfigured') {
                return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Web Push is not configured on this server.' }) });
            }
            if (pushMode === 'error' && request.method() === 'POST') {
                return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Web Push subscriptions are unavailable.' }) });
            }
            if (request.method() === 'GET') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                    success: true,
                    data: { configured: true, publicKey, subscribedCount: 0, maximumSubscriptions: 5 },
                }) });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                success: true,
                data: { subscribed: request.method() === 'POST' },
            }) });
        }
        if (url.pathname === '/api/research/watchlist') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [], archivedSymbols: [] }) });
        }
        if (url.pathname === '/api/research/alerts') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                success: true,
                data: { generatedAt: '2026-07-26T00:00:00.000Z', monitoredCount: 0, alerts: [], triggerCoverage: [], warnings: [] },
            }) });
        }
        if (url.pathname === '/api/research/notifications/settings') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                success: true,
                data: {
                    settings: { enabled: true, mode: 'daily', quietHoursEnabled: false, quietHoursStartUtc: 22, quietHoursEndUtc: 7 },
                    configured: false,
                    history: [],
                },
            }) });
        }
        if (url.pathname === '/api/research/inbox') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
                success: true,
                data: { generatedAt: '2026-07-26T00:00:00.000Z', monitoredCount: 0, items: [], warnings: [] },
            }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: {} }) });
    });

    await page.goto(`${baseUrl}/research?workspace=alerts`, { waitUntil: 'domcontentloaded', timeout });
    await page.getByRole('heading', { name: 'Background Web Push' }).waitFor();
    assert.equal(await page.evaluate(() => window.__signalQaPermissionCalls), 0, 'permission was requested on load');
    const token = 'browser-qa-only-bearer-32-characters-minimum';
    await page.getByLabel('Private server access token').fill(token);
    await page.getByRole('button', { name: 'Check secure setup' }).click();
    await page.getByText(/Secure Web Push is configured/).waitFor();
    assert.equal(await page.evaluate(() => window.__signalQaPermissionCalls), 0, 'setup check requested permission');
    await page.getByRole('button', { name: 'Enable background push' }).click();
    await page.getByText('Background Web Push is enabled for this browser.').waitFor();
    assert.equal(await page.evaluate(() => window.__signalQaPermissionCalls), 1);
    assert.equal(report.subscriptionRequests.at(-1).method, 'POST');
    assert.equal(report.subscriptionRequests.at(-1).authorization, `Bearer ${token}`);
    assert.match(report.subscriptionRequests.at(-1).body, /browser-qa-capability/);
    await page.getByRole('button', { name: 'Run local-only notification test' }).click();
    await page.getByText(/did not contact an external push service/).waitFor();
    await page.getByRole('button', { name: 'Disable and remove this device' }).click();
    await page.getByText(/server record was removed/).waitFor();
    assert.equal(report.subscriptionRequests.at(-1).method, 'DELETE');
    report.scenarios.push('PASS opt-in gesture, authenticated register, local test, and unsubscribe');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Private server access token').fill(token);
    await page.getByRole('button', { name: 'Check secure setup' }).click();
    await page.getByText(/Secure Web Push is configured/).waitFor();
    await page.evaluate(() => { window.__signalQaPermissionResult = 'denied'; });
    await page.getByRole('button', { name: 'Enable background push' }).click();
    await page.getByText(/Notification permission is blocked/).waitFor();
    report.scenarios.push('PASS denied permission state');

    pushMode = 'misconfigured';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Private server access token').fill(token);
    await page.getByRole('button', { name: 'Check secure setup' }).click();
    await page.getByText('Web Push is not configured on this server.').waitFor();
    report.scenarios.push('PASS fail-closed misconfigured state');

    pushMode = 'error';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByLabel('Private server access token').fill(token);
    await page.getByRole('button', { name: 'Check secure setup' }).click();
    await page.getByText(/Secure Web Push is configured/).waitFor();
    await page.getByRole('button', { name: 'Enable background push' }).click();
    await page.getByText('Web Push subscriptions are unavailable.').waitFor();
    assert.equal(await page.evaluate(() => window.__signalQaSubscribed), false, 'failed registration did not roll back browser subscription');
    report.scenarios.push('PASS registration error and browser rollback state');
    pushMode = 'configured';

    await page.goto(`${baseUrl}/offline`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        localStorage.setItem('signal-private-qa-marker', 'holdings cash thesis evidence sync secret');
    });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout });
    const manifestResult = await (await context.newCDPSession(page)).send('Page.getAppManifest');
    assert.equal(manifestResult.errors.length, 0, JSON.stringify(manifestResult.errors));
    const manifest = JSON.parse(manifestResult.data);
    assert.equal(manifest.name, 'Signal Market Research');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, '/');
    const cacheState = await page.evaluate(async () => {
        const names = await caches.keys();
        const requests = [];
        for (const name of names) {
            const cache = await caches.open(name);
            requests.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
        }
        return { names, requests };
    });
    assert.deepEqual(cacheState.names, ['signal-offline-v1']);
    assert.deepEqual([...cacheState.requests].sort(), [
        '/icons/signal-192.svg',
        '/icons/signal-512.svg',
        '/manifest.webmanifest',
        '/offline',
    ]);
    assert.equal(JSON.stringify(cacheState).includes('holdings'), false);
    report.scenarios.push('PASS install manifest, service worker, and exact privacy-bounded cache');

    await context.setOffline(true);
    await page.goto(`${baseUrl}/research?workspace=alerts`, { waitUntil: 'domcontentloaded', timeout });
    await page.getByRole('heading', { name: 'Signal cannot reach live server data' }).waitFor();
    await page.getByText(/must not be read as a current market view/).waitFor();
    await context.setOffline(false);
    await page.waitForFunction(() => navigator.onLine === true, null, { timeout });
    await page.getByRole('link', { name: 'Retry Signal' }).click();
    await page.waitForURL((url) => url.origin === baseUrl && url.pathname === '/', { waitUntil: 'domcontentloaded', timeout });
    report.scenarios.push('PASS online, offline fallback, and reconnect');

    for (const viewport of [
        { name: 'desktop', width: 1280, height: 900 },
        { name: 'tablet', width: 768, height: 900 },
        { name: 'mobile', width: 375, height: 812 },
    ]) {
        await page.setViewportSize(viewport);
        await page.goto(`${baseUrl}/offline`, { waitUntil: 'domcontentloaded' });
        const overflow = await page.evaluate(() => ({
            document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            body: document.body.scrollWidth - document.body.clientWidth,
        }));
        assert.ok(overflow.document <= 1 && overflow.body <= 1, `${viewport.name} overflow ${JSON.stringify(overflow)}`);
        await page.screenshot({ path: path.join(artifactDirectory, `offline-${viewport.name}.png`), fullPage: true });
        report.scenarios.push(`PASS ${viewport.name} ${viewport.width}px no overflow`);
    }

    await page.addInitScript(() => {
        Reflect.deleteProperty(window, 'PushManager');
    });
    await page.goto(`${baseUrl}/research?workspace=alerts`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Background Web Push' }).waitFor();
    await page.getByText('Unsupported', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Check secure setup' }).isDisabled(), true);
    report.scenarios.push('PASS unsupported browser state');

    const externalPushRequests = report.failedRequests.filter((value) =>
        /fcm\.googleapis|push\.services\.mozilla|push\.apple|notify\.windows/.test(value));
    assert.deepEqual(externalPushRequests, []);
    assert.deepEqual(report.console, []);
    assert.deepEqual(report.failedRequests, []);
    report.scenarios.push('PASS console, network, and no-external-push assertions');
    await context.close();
    await writeFile(path.join(artifactDirectory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(report.scenarios.join('\n'));
    console.log(`Evidence: ${artifactDirectory}`);
} finally {
    await browser.close();
    server.kill('SIGTERM');
    await Promise.race([
        new Promise((resolve) => server.once('exit', resolve)),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
}
