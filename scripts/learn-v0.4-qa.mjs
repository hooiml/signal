import { chromium } from 'playwright';
import process from 'node:process';

const baseUrl = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.SIGNAL_QA_TIMEOUT_MS || 15_000);
const viewports = [{ width: 1280, height: 900 }, { width: 768, height: 900 }, { width: 375, height: 812 }];

const currentPoint = {
    time: '2026-08-21', open: 98, high: 102, low: 97, close: 100, volume: 20000000,
    ma50: 95, ma200: 88, ema20: 98, ema50: 94, sma200: 88, averageVolume20: 18000000,
    rsi14: 62, macd: 1.5, macdSignal: 1.2, macdHistogram: 0.3, atr14: 4, atrPercent14: 4,
    anchoredVwap: 96, adx14: 24, plusDi14: 28, minusDi14: 18, supertrend: 93, supertrendDirection: 1,
};
const researchPayload = { success: true, data: {
    symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-23T16:00:00.000Z',
    benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: 12, baselineReturnPercent: 8, relativeReturnPercent: 4, returnBasis: 'adjusted close', status: 'outperformed' },
    quote: { name: 'Microsoft Corporation', currency: 'USD', price: 100, dailyChangePercent: 1 },
    fundamentals: { revenueGrowthPercent: 15, grossMarginPercent: 69, operatingMarginPercent: 45, freeCashFlow: 74000000000, debt: 44000000000, cash: 95000000000, shares: 7440000000, annualRevenue: 245000000000, annualNetIncome: 88000000000, reportingPeriod: '2025-06-30', shareChangePercent: -0.5, source: 'SEC EDGAR', history: [] },
    valuation: { marketCap: 3350000000000, priceEarnings: 30, priceSales: 10, freeCashFlowYieldPercent: 2.2, netCash: 51000000000, reportingPeriod: '2025-06-30', source: 'SEC EDGAR + Yahoo Finance' },
    technicals: { ma50: 95, ma200: 88, rsi14: 62, macd: 1.5, low52Week: 70, high52Week: 105, averageVolume20: 18000000, support: 94, resistance: 105 },
    chart: { interval: '1d', points: [currentPoint] }, sources: ['Yahoo Finance', 'SEC EDGAR'], warnings: [],
} };

const replayPoints = Array.from({ length: 8 }, (_, index) => ({
    ...currentPoint,
    time: `2024-05-${String(10 + index).padStart(2, '0')}`,
    open: 92 + index,
    high: 95 + index,
    low: 91 + index,
    close: 94 + index,
    volume: 15000000 + (index * 500000),
    ma50: 90 + index * 0.5,
    ema20: 92 + index * 0.5,
    ema50: 89 + index * 0.4,
    rsi14: 52 + index,
    atr14: 3.5,
    anchoredVwap: 91 + index * 0.5,
}));
const replayIntro = {
    symbol: 'MSFT', market: 'US', replayId: 'MSFT:2024-05-17', cutoffDate: '2024-05-17', points: replayPoints,
    current: replayPoints.at(-1), sources: ['Yahoo Finance'], fetchedAt: '2026-08-23T16:00:00.000Z',
    limitations: ['Daily historical price practice only; this is not an intraday execution simulator.', 'Technical values at the cutoff are calculated from that bar and prior bars only.', 'Spread, queue position, and actual fill quality are not available from this daily chart source.', 'Subsequent bars describe one historical outcome and do not predict repetition.'],
};
const futurePoints = [{ ...currentPoint, time: '2024-05-20', open: 105, high: 122, low: 104, close: 120, volume: 30000000 }];

const main = async () => {
    const browser = await chromium.launch({ headless: true });
    let failed = false;
    try {
        for (const viewport of viewports) {
            const context = await browser.newContext({ viewport });
            const page = await context.newPage();
            page.setDefaultTimeout(timeoutMs);
            const errors = [];
            let revealBody = null;
            page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
            page.on('pageerror', (error) => errors.push(error.message));
            await page.route('**/api/research/symbol/MSFT?market=US', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(researchPayload) }));
            await page.route('**/api/learn/trading-replay/MSFT*', async (route) => {
                if (route.request().method() === 'POST') {
                    revealBody = route.request().postDataJSON();
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...replayIntro, decision: revealBody.decision, nextPoints: futurePoints } }) });
                }
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: replayIntro }) });
            });
            const check = (condition, message) => { if (!condition) throw new Error(message); };
            try {
                const response = await page.goto(`${baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
                check(response?.ok(), 'Learn route did not load');
                const tradingTrack = page.getByRole('button', { name: /Short-term trading/ }).first();
                await tradingTrack.waitFor();
                await tradingTrack.click();

                await page.getByRole('button', { name: /3\.11 · Position sizing/ }).click();
                const sizingLab = page.getByTestId('position-size-lab-v4');
                await sizingLab.waitFor();
                check((await sizingLab.innerText()).includes('20 shares'), 'Position sizing did not calculate 20 shares for 10k / 1% / 100 / 95');
                await sizingLab.getByLabel('Invalidation stop').fill('105');
                await page.getByTestId('position-size-error-v4').waitFor();
                check((await page.getByTestId('position-size-error-v4').innerText()).includes('stop below entry'), 'Invalid long stop was not rejected');

                await page.getByRole('button', { name: /3\.12 · Expectancy/ }).click();
                await page.getByTestId('expectancy-lab-v4').waitFor();
                check((await page.getByTestId('expectancy-result-v4').textContent())?.includes('0.2R'), '40% / 2R / 1R expectancy should equal 0.2R');

                await page.getByRole('button', { name: /Apply today/ }).click();
                await page.getByTestId('trading-apply-v4').waitFor();
                await page.getByText('Microsoft Corporation', { exact: false }).first().waitFor();
                check((await page.getByTestId('trading-apply-v4').innerText()).includes('not independent predictions'), 'Current technical limitation is missing');
                await page.getByRole('button', { name: 'Momentum' }).click();
                check((await page.getByTestId('trading-apply-v4').innerText()).includes('RSI 14'), 'RSI evidence did not render');
                await page.getByRole('button', { name: 'Participation' }).click();
                check((await page.getByTestId('trading-apply-v4').innerText()).includes('anchored VWAP'), 'VWAP evidence did not render');
                await page.getByRole('button', { name: 'Volatility' }).click();
                check((await page.getByTestId('trading-apply-v4').innerText()).includes('ATR 14'), 'ATR evidence did not render');

                await page.getByRole('button', { name: 'Validate practice decision' }).click();
                check((await page.getByTestId('trade-plan-validation-v4').innerText()).includes('Complete context'), 'Incomplete trade plan was not blocked');
                await page.getByTestId('trade-plan-v4').getByLabel('No Trade').check();
                await page.getByLabel('No Trade reason').fill('The current evidence does not provide a sufficiently clear setup with a justified trigger and invalidation.');
                await page.getByRole('button', { name: 'Validate practice decision' }).click();
                check((await page.getByTestId('trade-plan-validation-v4').innerText()).includes('Valid practice decision'), 'No Trade was not accepted as a valid learning decision');

                await page.getByRole('button', { name: /Historical replay/ }).click();
                await page.getByTestId('trading-replay-locked').waitFor();
                check(!(await page.locator('main').innerText()).includes('$120.00'), 'Future trading bar leaked before commitment');
                await page.getByTestId('trading-replay-locked').getByLabel('No Trade').check();
                await page.getByLabel('Replay No Trade reason').fill('There is not enough evidence at the cutoff to justify a trade with defined edge and invalidation.');
                const revealButton = page.getByRole('button', { name: 'Commit decision & reveal' });
                check(!(await revealButton.isDisabled()), 'Complete No Trade replay decision should allow reveal');
                await revealButton.click();
                await page.getByTestId('trading-replay-revealed').waitFor();
                check(revealBody?.decision?.noTrade === true, 'Replay did not send explicit No Trade decision');
                check((await page.getByTestId('trading-replay-revealed').innerText()).includes('$120.00'), 'Future trading bar did not reveal after commitment');

                const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
                check(overflow <= 1, `Document overflowed by ${overflow}px`);
                check(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
                console.log(`v0.4 QA passed at ${viewport.width}x${viewport.height}`);
            } catch (error) {
                failed = true;
                console.error(`v0.4 QA failed at ${viewport.width}x${viewport.height}:`, error);
            } finally { await context.close(); }
        }
    } finally { await browser.close(); }
    if (failed) process.exitCode = 1;
};

await main();
