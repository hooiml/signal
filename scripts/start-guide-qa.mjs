import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
const timeout = 15_000;
const evidenceDir = path.resolve('.tmp', 'signal-start-qa', new Date().toISOString().replace(/[.:]/g, '-'));
const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
];
const report = { command: 'npm run qa:start', baseUrl, scenarios: [], errors: [] };

const candidate = (symbol, name, discoveryScore) => ({
    symbol,
    name,
    price: symbol === 'AAPL' ? 224.1 : 181.4,
    momentum3MonthPercent: 12,
    momentum6MonthPercent: 24,
    distanceFromMa50Percent: 4,
    averageDollarVolume: 1_000_000_000,
    volumeSpikeRatio: 1.1,
    maxDailyMovePercent: 4,
    annualizedVolatilityPercent: 28,
    aboveMa50: true,
    aboveMa200: true,
    trendScore: 78,
    riskScore: 24,
    risk: 'low',
    reasons: ['Price trend remains above the current moving-average guardrails.'],
    flags: [],
    qualityScore: 82,
    discoveryScore,
    category: 'quality compounder',
    qualityReasons: ['Current quality inputs pass the bounded scan.'],
    sector: 'Technology',
    sectorRelativeStrengthPercent: 5.2,
    scoreChange1Day: 1,
    scoreChange1Week: 2,
    scoreChange1Month: 4,
    rankChange1Week: 1,
    firstSeenAt: new Date().toISOString(),
    earlyTrendStage: 'confirmed',
    valuation: { guardrail: 'fair', priceEarnings: 29, priceSales: 8, freeCashFlowYieldPercent: 3.2 },
    catalyst: null,
    ownership: null,
});

const signalPayload = () => ({
    success: true,
    data: {
        composite_score: 72,
        tier: 'buy',
        mode: 'standard',
        interpretation: { action: 'Buy', reasoning: 'Fixture', color: '#10b981', emoji: '' },
        components: {},
        confidence: { agreement_pct: 75, level: 'moderate', majority_signal: 'BUY', conflicting_indicators: [] },
        metadata: {
            market: 'US',
            data_freshness: {},
            weight_distribution: {},
            signal_quality: { freshness: 'fresh', source_coverage: 'strong', noise_level: 'low', market_regime: 'constructive', warnings: [] },
            score_delta: { previous_score: 69, delta: 3, previous_date: new Date(Date.now() - 86_400_000).toISOString(), snapshot_date: new Date().toISOString(), label: 'Higher' },
            articles: [
                { title: 'Current market breadth improves', source: 'Current Wire', url: 'https://example.com/current', pubDate: new Date().toISOString(), sentiment: 'bullish' },
                { title: 'Old market headline must stay hidden', source: 'Archive Wire', url: 'https://example.com/old', pubDate: new Date(Date.now() - 86_400_000).toISOString(), sentiment: 'neutral' },
            ],
        },
    },
});

const discoveryPayload = () => ({
    success: true,
    data: {
        generatedAt: new Date().toISOString(),
        universeSize: 50,
        scannedCount: 50,
        candidates: [candidate('AAPL', 'Apple Inc.', 88), candidate('NVDA', 'NVIDIA Corporation', 85)],
        contenders: [],
        emergingCandidates: [],
        performance: [],
        historySnapshotCount: 4,
        warnings: [],
    },
});

const main = async () => {
    await mkdir(evidenceDir, { recursive: true });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    context.setDefaultTimeout(timeout);
    const page = await context.newPage();
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push(`console: ${message.text()}`); });
    page.on('pageerror', (error) => report.errors.push(`page: ${error.message}`));
    page.on('requestfailed', (request) => {
        if (!request.failure()?.errorText.includes('ERR_ABORTED')) report.errors.push(`request: ${request.url()} ${request.failure()?.errorText}`);
    });
    await page.route('**/api/signals/v2?*', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(signalPayload()) }));
    await page.route('**/api/research/discovery', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(discoveryPayload()) }));

    for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${baseUrl}/start`, { waitUntil: 'domcontentloaded', timeout });
        await page.getByTestId('start-market-step').getByText('72', { exact: true }).waitFor();
        await page.getByRole('button', { name: /NVDA/ }).click();
        await page.getByRole('heading', { name: 'Continue with NVDA' }).waitFor();
        const checks = {
            startSelected: await page.getByRole('link', { name: 'Start', exact: true }).getAttribute('aria-current') === 'page',
            appleVisible: await page.getByText('Apple Inc.').isVisible(),
            nvidiaVisible: await page.getByText('NVIDIA Corporation').isVisible(),
            currentNewsVisible: await page.getByText('Current market breadth improves').isVisible(),
            oldNewsExcluded: await page.getByText('Old market headline must stay hidden').count() === 0,
            candidateContinues: await page.getByRole('link', { name: 'Open Discovery for NVDA' }).getAttribute('href') === '/research?workspace=discovery',
            noHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
        };
        const screenshot = path.join(evidenceDir, `${viewport.name}-${viewport.width}.png`);
        await page.screenshot({ path: screenshot, fullPage: true });
        const passed = Object.values(checks).every(Boolean);
        report.scenarios.push({ viewport, checks, screenshot, passed });
        if (!passed) report.errors.push(`${viewport.name}: ${JSON.stringify(checks)}`);
    }

    await context.close();
    await browser.close();
    await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
    if (report.errors.length > 0) throw new Error(report.errors.join('\n'));
    console.log(`Start guide QA passed at 1280px, 768px, and 375px. Evidence: ${evidenceDir}`);
};

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
