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

const fillThesis = async (page) => {
    const values = {
        Business: 'Enterprise software and cloud platform with recurring customer relationships.',
        Quality: 'High switching costs and durable distribution support the economics.',
        Growth: 'The thesis requires continued revenue and per-share earnings growth.',
        Valuation: 'The current multiple requires durable growth and should be judged against business quality.',
        Expectations: 'The current price appears to assume continued strong execution.',
        Risks: 'Growth, margins, competitive intensity, or capital allocation can weaken the case.',
        'Contrary evidence': 'The valuation multiple leaves less room for an earnings disappointment.',
        Invalidation: 'Material deterioration in growth and cash economics without valuation compensation.',
    };
    for (const [label, value] of Object.entries(values)) await page.getByLabel(label, { exact: true }).fill(value);
};

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
                await page.locator('[data-testid="learn-v0-3"]').waitFor();
                await page.getByRole('button', { name: /Investment analysis/ }).first().click();
                await page.getByRole('button', { name: /2\.2 · Multiple expansion/ }).click();
                const multipleLab = page.getByTestId('multiple-change-lab');
                await multipleLab.waitFor();
                check((await multipleLab.innerText()).includes('$140'), 'Multiple-change lab did not show the expected ending implied value');

                await page.getByRole('button', { name: /Apply today/ }).click();
                await page.getByTestId('investment-apply-v3').waitFor();
                await page.getByText('Microsoft Corporation', { exact: false }).first().waitFor();
                check(await page.getByText('SEC EDGAR · Yahoo Finance').count() > 0, 'Current fact provenance is missing');

                const commitButton = page.getByRole('button', { name: 'Commit practice decision' });
                check(await commitButton.isDisabled(), 'Incomplete thesis should not be committable');
                await page.getByLabel('Bear probability').fill('20');
                check((await page.getByTestId('scenario-probability-total').textContent())?.includes('95%'), 'Scenario probabilities were silently normalized or total did not update');
                check((await page.getByTestId('scenario-builder-v3').innerText()).includes('does not silently normalize'), 'Probability warning is missing');
                await page.getByLabel('Bear probability').fill('25');
                await page.getByLabel('Add Against evidence').fill('Valuation leaves less room for execution risk.');
                await page.getByTestId('investment-evidence-board').getByRole('button', { name: 'Add' }).nth(1).click();
                await fillThesis(page);
                check(!(await commitButton.isDisabled()), 'Complete thesis with 100% scenarios should be committable');
                await commitButton.click();
                await page.getByTestId('learning-journal-v3').getByText('MSFT · committed thesis').waitFor();
                const stored = await page.evaluate(() => window.localStorage.getItem('signal-learn-v0.3-journal'));
                check(Boolean(stored?.includes('contraryEvidence')), 'Committed journal did not preserve the thesis');
                await page.getByLabel('Append reflection for MSFT').fill('Later evidence should append without rewriting the original entry.');
                await page.getByRole('button', { name: 'Append update' }).click();
                check((await page.getByTestId('learning-journal-v3').innerText()).includes('Later evidence should append'), 'Journal update did not append');

                await page.getByRole('button', { name: /Historical replay/ }).click();
                await page.getByTestId('investment-replay-locked').waitFor();
                check(!(await page.locator('main').innerText()).includes('$74B'), 'Future filing leaked before investment commitment');
                await page.getByLabel('Investment replay supporting evidence').fill('Current filing shows positive revenue, earnings, and cash generation.');
                await page.getByLabel('Investment replay contrary evidence').fill('The multiple may already price in strong execution.');
                await page.getByLabel('Investment replay invalidation').fill('Business economics deteriorate materially without a compensating valuation change.');
                await page.getByRole('button', { name: 'Commit thesis & reveal' }).click();
                await page.getByTestId('investment-replay-revealed').waitFor();
                check(Boolean(revealBody?.commitment?.contraryEvidence && revealBody?.commitment?.invalidation), 'Replay commitment did not include contrary evidence and invalidation');
                check((await page.getByTestId('investment-replay-revealed').innerText()).includes('$74B'), 'Next filing did not reveal after investment commitment');

                const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
                check(overflow <= 1, `Document overflowed by ${overflow}px`);
                check(errors.length === 0, `Browser errors: ${errors.join(' | ')}`);
                console.log(`v0.3 QA passed at ${viewport.width}x${viewport.height}`);
            } catch (error) {
                failed = true;
                console.error(`v0.3 QA failed at ${viewport.width}x${viewport.height}:`, error);
            } finally { await context.close(); }
        }
    } finally { await browser.close(); }
    if (failed) process.exitCode = 1;
};

await main();
