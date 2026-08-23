import { chromium } from 'playwright';
import process from 'node:process';

const baseUrl = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.SIGNAL_QA_TIMEOUT_MS || 15_000);
const viewports = [{ width: 1280, height: 900 }, { width: 768, height: 900 }, { width: 375, height: 812 }];

const history = [
    { reportingPeriod: '2025-06-30', currency: 'USD', source: 'SEC EDGAR', annualRevenue: 245000000000, revenueGrowthPercent: 15, grossMarginPercent: 69, operatingMarginPercent: 45, annualNetIncome: 88000000000, freeCashFlow: 74000000000, debt: 44000000000, cash: 95000000000, shares: 7440000000, shareChangePercent: -0.5 },
    { reportingPeriod: '2024-06-30', currency: 'USD', source: 'SEC EDGAR', annualRevenue: 211000000000, revenueGrowthPercent: 12, grossMarginPercent: 68, operatingMarginPercent: 42, annualNetIncome: 72000000000, freeCashFlow: 62000000000, debt: 47000000000, cash: 82000000000, shares: 7480000000, shareChangePercent: -0.2 },
];
const researchPayload = { success: true, data: { symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-23T16:00:00.000Z', benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: 12, baselineReturnPercent: 8, relativeReturnPercent: 4, returnBasis: 'adjusted close', status: 'outperformed' }, quote: { name: 'Microsoft Corporation', currency: 'USD', price: 450, dailyChangePercent: 0.8 }, fundamentals: { revenueGrowthPercent: 15, grossMarginPercent: 69, operatingMarginPercent: 45, freeCashFlow: 74000000000, debt: 44000000000, cash: 95000000000, shares: 7440000000, annualRevenue: 245000000000, annualNetIncome: 88000000000, reportingPeriod: '2025-06-30', shareChangePercent: -0.5, source: 'SEC EDGAR', history }, valuation: { marketCap: 3350000000000, priceEarnings: 38.07, priceSales: 13.67, freeCashFlowYieldPercent: 2.21, netCash: 51000000000, reportingPeriod: '2025-06-30', source: 'SEC EDGAR + Yahoo Finance' }, technicals: { ma50: 440, ma200: 410, rsi14: 56, macd: 2, low52Week: 350, high52Week: 470, averageVolume20: 22000000, support: 430, resistance: 470 }, chart: { interval: '1d', points: [{ time: '2026-08-21', open: 445, high: 452, low: 443, close: 450, volume: 20000000, ma50: 440, ma200: 410, ema20: 446, ema50: 438, sma200: 410, averageVolume20: 22000000, rsi14: 56, macd: 2, macdSignal: 1.8, macdHistogram: 0.2, atr14: 7, atrPercent14: 1.55, anchoredVwap: 442, adx14: 24, plusDi14: 28, minusDi14: 20, supertrend: 435, supertrendDirection: 1 }] }, sources: ['SEC EDGAR', 'Yahoo Finance'], warnings: [] } };
const before = { id: 'business-2023', fiscalPeriodEnd: '2023-06-30', filedAt: '2023-07-27', priceDate: '2023-07-28', annualRevenue: 211000000000, annualNetIncome: 72000000000, freeCashFlow: 59000000000, priceEarnings: 34.9, filingUrl: 'https://www.sec.gov/example-2023', form: '10-K' };
const after = { id: 'business-2024', fiscalPeriodEnd: '2024-06-30', filedAt: '2024-07-30', priceDate: '2024-07-31', annualRevenue: 245000000000, annualNetIncome: 88000000000, freeCashFlow: 74000000000, priceEarnings: 36.2, filingUrl: 'https://www.sec.gov/example-2024', form: '10-K' };
const intro = { symbol: 'MSFT', companyName: 'Microsoft Corporation', replayId: before.id, knownAsOf: before.priceDate, observation: before, sources: ['SEC EDGAR', 'Yahoo Finance'], warnings: [] };

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
            await page.route('**/api/learn/business-replay/MSFT*', async (route) => {
                if (route.request().method() === 'POST') { revealBody = route.request().postDataJSON(); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...intro, nextObservation: after } }) }); }
                return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: intro }) });
            });
            const check = (condition, message) => { if (!condition) throw new Error(message); };
            try {
                const response = await page.goto(`${baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
                check(response?.ok(), 'Learn route did not load');
                const businessTrack = page.getByRole('button', { name: /Understand the business/ }).first();
                await businessTrack.waitFor();
                await businessTrack.click();
                await page.getByRole('button', { name: /1\.2 · Income statement/ }).click();
                await page.getByTestId('business-driver-lab').waitFor();
                await page.getByLabel('Revenue').fill('1200');
                check((await page.getByTestId('business-driver-highlight').textContent())?.includes('$370m'), 'Business driver calculation did not update');

                await page.getByRole('button', { name: /Apply today/ }).click();
                await page.getByTestId('business-apply').waitFor();
                await page.getByText('Microsoft Corporation', { exact: false }).first().waitFor();
                check(await page.getByText('2024-06-30').count() > 0, 'Annual history did not render');
                check(await page.getByText('Sources and provenance').count() > 0, 'Business provenance is missing');

                await page.getByRole('button', { name: /Historical replay/ }).click();
                await page.getByTestId('business-replay-locked').waitFor();
                check(!(await page.locator('main').innerText()).includes('$74B'), 'Future business cash flow leaked before commitment');
                await page.getByLabel('Business supporting evidence').fill('Revenue and net income are both positive and the filing-aligned evidence is internally consistent.');
                await page.getByLabel('Business contrary evidence').fill('The valuation multiple remains elevated and cash generation must keep supporting the thesis.');
                await page.getByLabel('Business invalidation').fill('Revenue, earnings, or cash flow deteriorate enough to break the original business thesis.');
                await page.getByRole('button', { name: 'Commit & reveal next filing' }).click();
                await page.getByTestId('business-replay-revealed').waitFor();
                check(Boolean(revealBody?.commitment?.supportingEvidence && revealBody?.commitment?.contraryEvidence), 'Commitment was not sent to reveal endpoint');
                check((await page.getByTestId('business-replay-revealed').innerText()).includes('$74B'), 'Next filing did not reveal after commitment');
                const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
                check(overflow <= 1, `Document overflowed by ${overflow}px`);
                check(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
                console.log(`v0.2 QA passed at ${viewport.width}x${viewport.height}`);
            } catch (error) {
                failed = true;
                console.error(`v0.2 QA failed at ${viewport.width}x${viewport.height}:`, error);
            } finally { await context.close(); }
        }
    } finally { await browser.close(); }
    if (failed) process.exitCode = 1;
};

await main();
