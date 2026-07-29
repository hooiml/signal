import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_TIMEOUT_MS = 15_000;
const SETTLE_MS = 5_000;
const ROUTES = [
    { id: 'market', path: '/', oppositePath: '/research' },
    { id: 'research', path: '/research', oppositePath: '/' },
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
        throttle: throttle
            ? { latencyMs: 150, downloadBytesPerSecond: 200_000, uploadBytesPerSecond: 100_000, cpuRate: 4 }
            : null,
        routes: [],
        summary: {},
        fatalError: null,
    };

    try {
        for (const route of ROUTES) {
            const routeRuns = [];
            for (let run = 1; run <= runCount; run += 1) {
                const context = await browser.newContext({
                    viewport: { width: 1280, height: 900 },
                    serviceWorkers: 'block',
                });
                context.setDefaultTimeout(timeoutMs);
                const page = await context.newPage();
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
                    window.__signalPerformance = { lcpMs: null };
                    new PerformanceObserver((entries) => {
                        const latest = entries.getEntries().at(-1);
                        if (latest) window.__signalPerformance.lcpMs = latest.startTime;
                    }).observe({ type: 'largest-contentful-paint', buffered: true });
                });

                const requests = [];
                const failures = [];
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
                await page.waitForTimeout(settleMs);
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
                        lcpMs: window.__signalPerformance?.lcpMs ?? null,
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
                    if (route.oppositePath === '/') {
                        return request.resourceType === 'fetch'
                            && request.path.startsWith('/?_rsc=');
                    }
                    return request.path.startsWith(`${route.oppositePath}?_rsc=`);
                });
                routeRuns.push({
                    run,
                    elapsedMs: Date.now() - startedAt,
                    ...metrics,
                    requestCount: requests.length,
                    apiRequestCount: apiRequests.length,
                    apiRequests,
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
