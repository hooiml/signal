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
const baseUrl = arg('--base-url', process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000');
const timeout = Number(arg('--timeout', '15000'));
const widths = arg('--viewport', '1280,768,375').split(',').map(Number);
const evidenceDir = path.resolve(arg('--screenshot-dir', path.join('.tmp', 'research-picker-qa', new Date().toISOString().replace(/[.:]/g, '-'))));
const failures = [];

const candidate = (overrides) => ({
    symbol: 'MSFT', name: 'Microsoft', price: 425, momentum3MonthPercent: 18, momentum6MonthPercent: 28,
    distanceFromMa50Percent: 7, averageDollarVolume: 1_000_000_000, volumeSpikeRatio: 1.2,
    maxDailyMovePercent: 4, annualizedVolatilityPercent: 24, aboveMa50: true, aboveMa200: true,
    trendScore: 86, riskScore: 18, risk: 'moderate', reasons: ['Sustained trend'], flags: [],
    qualityScore: 88, discoveryScore: 87, category: 'quality compounder', qualityReasons: ['Positive free cash flow'],
    sector: 'Technology', sectorRelativeStrengthPercent: 5.2, scoreChange1Day: 2, scoreChange1Week: 4,
    scoreChange1Month: null, rankChange1Week: 4, firstSeenAt: '2026-07-01T00:00:00.000Z', earlyTrendStage: 'confirmed',
    valuation: { guardrail: 'fair', priceEarnings: 31, priceSales: 10, freeCashFlowYieldPercent: 2.8 },
    catalyst: null, ownership: null,
    ...overrides,
});

const successFixture = { success: true, data: {
    generatedAt: '2026-07-31T08:00:00.000Z', universeSize: 40, scannedCount: 40,
    candidates: [
        candidate({}),
        candidate({ symbol: 'AMD', name: 'Advanced Micro Devices', discoveryScore: 82, risk: 'low', riskScore: 8 }),
        candidate({ symbol: 'NVDA', name: 'Nvidia', discoveryScore: 80, risk: 'low', riskScore: 9 }),
        candidate({ symbol: 'JNJ', name: 'Johnson & Johnson', discoveryScore: 78, risk: 'low', riskScore: 7, sector: 'Healthcare' }),
        candidate({ symbol: 'LOW', name: 'Below threshold', discoveryScore: 65, risk: 'low', riskScore: 6, sector: 'Utilities' }),
        candidate({ symbol: 'RISK', name: 'High risk fixture', discoveryScore: 92, risk: 'high', riskScore: 45, sector: 'Materials' }),
    ],
    contenders: [], emergingCandidates: [],
    performance: [
        { period: '1D', averageReturnPercent: 1.2, trackedCount: 2, winnerCount: 2 },
        { period: '1W', averageReturnPercent: null, trackedCount: 0, winnerCount: 0 },
        { period: '1M', averageReturnPercent: null, trackedCount: 0, winnerCount: 0 },
    ],
    historySnapshotCount: 5, warnings: [],
} };

const noMatchFixture = { success: true, data: {
    ...successFixture.data,
    generatedAt: '2026-07-31T09:00:00.000Z',
    candidates: [
        candidate({ symbol: 'LOW_A', discoveryScore: 61, risk: 'low', sector: 'Technology' }),
        candidate({ symbol: 'LOW_B', discoveryScore: 62, risk: 'low', sector: 'Healthcare' }),
    ],
} };

const quoteFixture = { success: true, data: { quote: { name: 'Vanguard S&P 500 ETF', currency: 'USD', price: 500, dailyChangePercent: 0.2 } } };
const expectStatus = async (page, stage, expected) => {
    await page.waitForFunction(
        ({ stageId, expectedStatus }) => document.querySelector(`[data-testid="picker-stage-${stageId}"]`)?.getAttribute('data-status') === expectedStatus,
        { stageId: stage, expectedStatus: expected },
        { timeout },
    );
    const actual = await page.getByTestId(`picker-stage-${stage}`).getAttribute('data-status');
    if (actual !== expected) throw new Error(`${stage} expected ${expected}, got ${actual}`);
};

await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
    for (const width of widths) {
        const context = await browser.newContext({ viewport: { width, height: width <= 480 ? 812 : 900 } });
        await context.addInitScript((storageKey) => {
            const original = Storage.prototype.setItem;
            Storage.prototype.setItem = function setItem(key, value) {
                if (key === storageKey) throw new DOMException('Storage unavailable', 'QuotaExceededError');
                return original.call(this, key, value);
            };
        }, 'signal-picker-runs-v1');
        const page = await context.newPage();
        const issues = [];
        let responseMode = 'success';
        let delayNextScan = true;
        let releaseScan = null;
        let discoveryRequests = 0;

        page.on('console', (message) => {
            if (message.type() === 'error') issues.push(`console: ${message.text()}`);
        });
        page.on('pageerror', (error) => issues.push(`page: ${error.message}`));
        page.on('requestfailed', (request) => {
            if (!(request.failure()?.errorText ?? '').includes('ERR_ABORTED')) issues.push(`request: ${request.url()}`);
        });
        await page.route('**/api/research/**', async (route) => {
            const url = new URL(route.request().url());
            if (url.pathname === '/api/research/watchlist' && route.request().method() === 'GET') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], archivedSymbols: [] }) });
            }
            if (url.pathname === '/api/research/inbox') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-31T08:00:00.000Z', monitoredCount: 0, items: [], warnings: [] } }) });
            }
            if (url.pathname === '/api/research/discovery') {
                discoveryRequests += 1;
                if (delayNextScan) await new Promise((resolve) => { releaseScan = resolve; });
                if (responseMode === 'failure') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Fixture unavailable.' }) });
                const fixture = responseMode === 'empty' ? noMatchFixture : successFixture;
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) });
            }
            if (url.pathname === '/api/research/quote/VOO') {
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(quoteFixture) });
            }
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], fetchedAt: '2026-07-31T08:00:00.000Z' } }) });
        });

        try {
            await page.goto(`${baseUrl}/research?workspace=picker`, { waitUntil: 'domcontentloaded', timeout });
            await page.getByRole('heading', { name: 'Stock Picker' }).waitFor({ state: 'visible', timeout });
            await expectStatus(page, 'scan', 'next');
            await expectStatus(page, 'filter', 'pending');
            if (await page.getByTestId('picker-methodology').getAttribute('open') !== null) throw new Error('methodology is not collapsed initially');

            await page.getByRole('button', { name: 'Run picker' }).click();
            await expectStatus(page, 'scan', 'current');
            await page.getByText('Scanning the current Discovery universe…').waitFor({ state: 'visible', timeout });
            delayNextScan = false;
            releaseScan?.();
            await expectStatus(page, 'shortlist', 'complete');
            await page.getByText('6 scanned → 5 policy eligible → 4 passed risk and score → 3 shortlisted').waitFor({ state: 'visible', timeout });
            await expectStatus(page, 'research', 'next');
            await expectStatus(page, 'measure', 'pending');
            if (await page.getByRole('button', { name: 'Open research' }).count() !== 3) throw new Error('expected three explicit Research actions');
            if (discoveryRequests !== 1) throw new Error(`expected one Discovery request, got ${discoveryRequests}`);

            await page.getByTestId('picker-methodology').locator('summary').click();
            await page.getByText('basket constraints do not create another score.').waitFor({ state: 'visible', timeout });
            await page.getByRole('button', { name: 'Start paper basket' }).click();
            await expectStatus(page, 'measure', 'available');
            await page.getByText('Paper basket is available for this session, but browser storage is unavailable.').waitFor({ state: 'visible', timeout });

            const layout = await page.evaluate(() => {
                const journey = document.querySelector('[data-testid="picker-journey"]');
                const rect = journey?.getBoundingClientRect();
                return {
                    documentOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
                    journeyOverflow: journey ? journey.scrollWidth - journey.clientWidth : null,
                    journeyBottom: rect?.bottom ?? null,
                };
            });
            if (layout.documentOverflow > 1) throw new Error(`document overflows by ${layout.documentOverflow}px`);
            if (layout.journeyOverflow === null || layout.journeyOverflow > 1) throw new Error(`journey overflows by ${layout.journeyOverflow}px`);
            if (width === 1280 && (layout.journeyBottom === null || layout.journeyBottom > 900)) throw new Error('journey is not visible in the first desktop viewport');
            await page.getByTestId('picker-journey').screenshot({ path: path.join(evidenceDir, `picker-journey-${width}.png`) });

            responseMode = 'failure';
            await page.getByRole('button', { name: 'Run again with current data' }).click();
            await page.getByTestId('picker-setup').getByRole('alert').waitFor({ state: 'visible', timeout });
            await expectStatus(page, 'scan', 'unavailable');
            responseMode = 'empty';
            await page.getByRole('button', { name: 'Retry scan' }).click();
            await page.getByText('No candidates meet this rule').waitFor({ state: 'visible', timeout });
            await expectStatus(page, 'research', 'unavailable');
            await expectStatus(page, 'measure', 'unavailable');

            if (issues.length > 0) throw new Error(issues.join(' | '));
            console.log(`PASS Picker journey states and layout ${width}px`);
        } catch (error) {
            failures.push(`${width}px: ${error instanceof Error ? error.message : String(error)}`);
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
    console.log('PASS setup, loading, success, storage-unavailable, failure, retry, and no-match states');
    console.log('PASS console and failed requests: 0 blocking issues');
    console.log(`Screenshots: ${evidenceDir}`);
    console.log('Research Picker journey QA passed.');
}
