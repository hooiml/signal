import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_TIMEOUT_MS = 30_000;
const SETTLE_MS = 5_000;
const ROUTES = [
    { id: 'market', path: '/main-v8', oppositePath: '/research-v8' },
    { id: 'research', path: '/research-v8', oppositePath: '/main-v8' },
];

const args = process.argv.slice(2);
const getArg = (name) => {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1];
    const inline = args.find((value) => value.startsWith(`${name}=`));
    return inline ? inline.slice(name.length + 1) : undefined;
};

const baseUrl = getArg('--base-url') || process.env.SIGNAL_QA_URL || DEFAULT_BASE_URL;
const timeoutMs = Number(getArg('--timeout') || DEFAULT_TIMEOUT_MS);
const settleMs = Number(getArg('--settle') || SETTLE_MS);
const runCount = Number(getArg('--runs') || 2);
const throttle = !args.includes('--no-throttle');
const fixtureMode = args.includes('--research-fixture');
const routeFilter = getArg('--route') || (fixtureMode ? 'research' : 'all');
const routes = ROUTES.filter(route => routeFilter === 'all' || route.id === routeFilter);
const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
const evidenceDir = path.resolve(
    getArg('--output-dir')
        || process.env.SIGNAL_QA_EVIDENCE_DIR
        || path.join('.tmp', 'signal-performance', timestamp),
);
const reportPath = path.join(evidenceDir, 'report.json');

const median = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    if (sorted.length === 0) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
};

const variationPercent = (values) => {
    if (values.length < 2) return 0;
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    return maximum === 0 ? 0 : Number((((maximum - minimum) / maximum) * 100).toFixed(1));
};

const main = async () => {
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) throw new Error('Invalid timeout.');
    if (!Number.isFinite(settleMs) || settleMs < 0 || settleMs > 30_000) throw new Error('Invalid settle time.');
    if (!Number.isInteger(runCount) || runCount < 1 || runCount > 5) throw new Error('Runs must be between 1 and 5.');
    if (!routes.length) throw new Error('Route must be market, research or all.');
    if (fixtureMode && (routeFilter !== 'research' || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname))) {
        throw new Error('Research fixture mode requires a loopback origin and the research route.');
    }

    await mkdir(evidenceDir, { recursive: true });
    const origin = new URL(baseUrl).origin;
    const availability = await fetch(baseUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (!availability.ok) throw new Error(`Base URL returned HTTP ${availability.status}.`);

    const browser = await chromium.launch({ headless: !args.includes('--headed') });
    const report = {
        command: 'npm run qa:performance',
        generatedAt: new Date().toISOString(),
        baseUrl,
        timeoutMs,
        settleMs,
        runCount,
        dataMode: fixtureMode ? 'isolated SQL fixture; timings are not production speed evidence' : 'live application GETs (may execute existing writes)',
        throttle: throttle
            ? { latencyMs: 150, downloadBytesPerSecond: 200_000, uploadBytesPerSecond: 100_000, cpuRate: 4 }
            : null,
        routes: [],
        summary: {},
        fatalError: null,
    };

    try {
        for (const route of routes) {
            const routeRuns = [];
            for (let run = 1; run <= runCount; run += 1) {
                const context = await browser.newContext({
                    viewport: { width: 1280, height: 900 },
                    serviceWorkers: 'block',
                });
                context.setDefaultTimeout(timeoutMs);
                const page = await context.newPage();
                const fixture = researchReadFixture({ allowSchema: args.includes('--baseline-schema') });
                if (fixtureMode) {
                    fixture.parseSnapshot(researchSnapshotFixture);
                    await context.route('**/api/**', async intercepted => {
                        const request = intercepted.request();
                        const pathname = new URL(request.url()).pathname;
                        if (request.method() !== 'GET') return intercepted.abort();
                        if (pathname === '/api/research/watchlist') {
                            const response = await fixture.route.GET();
                            return intercepted.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
                        }
                        if (pathname === '/api/research/symbol/AAPL') return intercepted.fulfill({ json: researchSnapshotFixture });
                        return intercepted.abort();
                    });
                }
                const client = await context.newCDPSession(page);
                await client.send('Network.enable');
                await client.send('Network.setCacheDisabled', { cacheDisabled: true });
                if (throttle) {
                    await client.send('Network.emulateNetworkConditions', {
                        offline: false,
                        latency: 150,
                        downloadThroughput: 200_000,
                        uploadThroughput: 100_000,
                        connectionType: 'cellular3g',
                    });
                    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
                }

                await page.addInitScript(() => {
                    window.__signalPerformance = { lcpMs: null, savedRecordMs: null, quoteReadyMs: null, providerSettledMs: null, marketReadyMs: null };
                    new PerformanceObserver((entries) => {
                        const latest = entries.getEntries().at(-1);
                        if (latest) window.__signalPerformance.lcpMs = latest.startTime;
                    }).observe({ type: 'largest-contentful-paint', buffered: true });
                    setInterval(() => {
                        const metrics = window.__signalPerformance;
                        const expected = window.__signalExpected;
                        if (!expected) return;
                        const selected = new URL(location.href).searchParams.get('ticker');
                        const article = [...document.querySelectorAll('article[aria-label]')].find(element => element.getAttribute('aria-label') === `${expected.symbol} research`);
                        if (article && selected === expected.symbol) {
                            metrics.savedRecordMs ??= performance.now();
                            const status = document.querySelector('[aria-label="Provider data status"]');
                            if (status && !status.textContent.includes('Loading provider data') && !status.textContent.includes('Refreshing…')) metrics.providerSettledMs ??= performance.now();
                            if (expected.price && document.querySelector('[data-testid="research-price"]')?.textContent === expected.price) metrics.quoteReadyMs ??= performance.now();
                        }
                        if (expected.market && document.querySelector('[aria-label="Market score and history"]')) metrics.marketReadyMs ??= performance.now();
                    }, 50);
                });

                const requests = [];
                const failures = [];
                const responses = [];
                const responseJobs = [];
                let expectedSymbol = null;
                page.on('pageerror', error => failures.push(error.message));
                page.on('response', response => {
                    const url = new URL(response.url());
                    if (url.origin !== origin) return;
                    if (response.status() >= 400) failures.push(`HTTP ${response.status()} ${url.pathname}`);
                    if (!url.pathname.startsWith('/api/')) return;
                    const job = (async () => {
                        responses.push({ path: `${url.pathname}${url.search}`, status: response.status(),
                            serverTiming: response.headers()['server-timing'] ?? null,
                            applicationCache: response.headers()['x-signal-cache'] ?? null });
                        if (!response.ok()) return;
                        const payload = await response.json();
                        if (url.pathname === '/api/research/watchlist') {
                            const records = fixture.parseWatchlist(payload);
                            expectedSymbol = new URL(page.url()).searchParams.get('ticker') || records[0]?.symbol;
                            if (records.some(record => record.symbol === expectedSymbol)) await page.evaluate(symbol => { window.__signalExpected = { symbol }; }, expectedSymbol);
                        } else if (url.pathname.startsWith('/api/research/symbol/')) {
                            const snapshot = fixture.parseSnapshot(payload);
                            if (snapshot.symbol === expectedSymbol) {
                                const price = snapshot.quote.price === null ? null : `${snapshot.quote.currency || 'Currency not supplied'} ${snapshot.quote.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
                                await page.evaluate(({ symbol, price }) => { window.__signalExpected = { symbol, price, providerValidated: true }; }, { symbol: snapshot.symbol, price });
                            }
                        } else if (url.pathname === '/api/signals/v2' && payload.success === true && Number.isFinite(payload.data?.composite_score)) {
                            await page.evaluate(() => { window.__signalExpected = { market: true }; });
                        }
                    })().catch(error => failures.push(`Response validation ${url.pathname}: ${error.message}`));
                    responseJobs.push(job);
                });
                page.on('request', (request) => {
                    const url = new URL(request.url());
                    if (url.origin === origin) {
                        requests.push({
                            method: request.method(),
                            path: `${url.pathname}${url.search}`,
                            resourceType: request.resourceType(),
                        });
                    }
                });
                page.on('requestfailed', (request) => {
                    const url = new URL(request.url());
                    if (url.origin === origin && !request.failure()?.errorText.includes('ERR_ABORTED')) {
                        failures.push(`${request.method()} ${url.pathname}: ${request.failure()?.errorText || 'failed'}`);
                    }
                });

                const startedAt = Date.now();
                await page.goto(new URL(route.path, baseUrl).toString(), {
                    waitUntil: 'domcontentloaded',
                    timeout: timeoutMs,
                });
                await page.waitForFunction(id => id === 'research'
                    ? window.__signalPerformance?.savedRecordMs !== null && window.__signalPerformance?.providerSettledMs !== null
                        && window.__signalExpected?.providerValidated && (!window.__signalExpected.price || window.__signalPerformance?.quoteReadyMs !== null)
                    : window.__signalPerformance?.marketReadyMs !== null, route.id, { timeout: timeoutMs })
                    .catch(() => failures.push('Usable-data readiness deadline exceeded (empty, invalid or failed responses are not counted as ready).'));
                await page.waitForTimeout(settleMs);
                await Promise.all(responseJobs);
                const metrics = await page.evaluate(() => {
                    const resources = performance.getEntriesByType('resource').map((entry) => ({
                        name: entry.name,
                        initiatorType: entry.initiatorType,
                        transferSize: entry.transferSize,
                        encodedBodySize: entry.encodedBodySize,
                        duration: entry.duration,
                    }));
                    const scripts = resources.filter((resource) =>
                        resource.initiatorType === 'script' || new URL(resource.name).pathname.endsWith('.js'));
                    return {
                        ...window.__signalPerformance,
                        navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
                        paint: performance.getEntriesByType('paint').map(entry => entry.toJSON()),
                        apiTimings: resources.filter(resource => new URL(resource.name).pathname.startsWith('/api/')).map(resource => ({ path: new URL(resource.name).pathname, durationMs: resource.duration })),
                        scriptTransferBytes: scripts.reduce((sum, resource) => sum + resource.transferSize, 0),
                        scriptEncodedBytes: scripts.reduce((sum, resource) => sum + resource.encodedBodySize, 0),
                        scriptCount: scripts.length,
                        scripts: scripts.map((resource) => ({
                            path: `${new URL(resource.name).pathname}${new URL(resource.name).search}`,
                            transferSize: resource.transferSize,
                            encodedBodySize: resource.encodedBodySize,
                            durationMs: Number(resource.duration.toFixed(1)),
                        })),
                    };
                });

                const apiRequests = requests.filter((request) => request.path.startsWith('/api/'));
                const oppositePrefetches = requests.filter((request) => {
                    return request.path.startsWith(`${route.oppositePath}?_rsc=`);
                });
                routeRuns.push({
                    run,
                    elapsedMs: Date.now() - startedAt,
                    ...metrics,
                    requestCount: requests.length,
                    apiRequestCount: apiRequests.length,
                    apiRequests,
                    responses,
                    sqlStatements: fixtureMode ? [...fixture.calls] : undefined,
                    oppositeRoutePrefetchCount: oppositePrefetches.length,
                    oppositeRoutePrefetches: oppositePrefetches,
                    failures,
                });
                await context.close();
            }

            const scriptTransfers = routeRuns.map((item) => item.scriptTransferBytes);
            const requestCounts = routeRuns.map((item) => item.requestCount);
            report.routes.push({
                ...route,
                runs: routeRuns,
                summary: {
                    medianScriptTransferBytes: median(scriptTransfers),
                    scriptTransferVariationPercent: variationPercent(scriptTransfers),
                    medianRequestCount: median(requestCounts),
                    requestCountVariationPercent: variationPercent(requestCounts),
                    medianLcpMs: median(routeRuns.map((item) => item.lcpMs).filter(Number.isFinite)),
                    medianSavedRecordMs: median(routeRuns.map(item => item.savedRecordMs).filter(Number.isFinite)),
                    medianQuoteReadyMs: median(routeRuns.map(item => item.quoteReadyMs).filter(Number.isFinite)),
                    medianMarketReadyMs: median(routeRuns.map(item => item.marketReadyMs).filter(Number.isFinite)),
                    maxApiRequestCount: Math.max(...routeRuns.map((item) => item.apiRequestCount)),
                    maxOppositeRoutePrefetchCount: Math.max(...routeRuns.map((item) => item.oppositeRoutePrefetchCount)),
                    failureCount: routeRuns.reduce((sum, item) => sum + item.failures.length, 0),
                },
            });
        }
        report.summary = {
            stableTransferSizes: report.routes.every((route) =>
                route.summary.scriptTransferVariationPercent <= 10),
            stableRequestCounts: report.routes.every((route) =>
                route.summary.requestCountVariationPercent <= 10),
            totalFailures: report.routes.reduce((sum, route) => sum + route.summary.failureCount, 0),
        };
        if (report.summary.totalFailures > 0) process.exitCode = 1;
    } catch (error) {
        report.fatalError = error instanceof Error ? error.message : String(error);
        throw error;
    } finally {
        await browser.close();
        await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
        console.log(`Performance report: ${reportPath}`);
        for (const route of report.routes) {
            console.log(
                `${route.id}: ${route.summary.medianScriptTransferBytes} JS bytes, `
                + `${route.summary.medianRequestCount} requests, `
                + `${route.summary.maxApiRequestCount} API requests, `
                + `${route.summary.maxOppositeRoutePrefetchCount} opposite-route prefetches, `
                + `${route.summary.medianLcpMs ?? 'n/a'}ms LCP`,
            );
        }
    }
};

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
