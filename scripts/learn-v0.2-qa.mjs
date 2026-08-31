import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const baseUrlArgumentIndex = process.argv.indexOf('--base-url');
const baseUrl = (baseUrlArgumentIndex >= 0 ? process.argv[baseUrlArgumentIndex + 1] : undefined) || process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.SIGNAL_QA_TIMEOUT_MS || 15_000);
const captureScreenshots = process.env.SIGNAL_QA_SCREENSHOTS !== '0';
const viewports = [{ name: 'desktop', width: 1280, height: 900 }, { name: 'tablet', width: 768, height: 900 }, { name: 'mobile', width: 375, height: 812 }];
const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
const evidenceDir = path.resolve(process.env.SIGNAL_QA_EVIDENCE_DIR || path.join('.tmp', 'signal-learn-v0.2-qa', timestamp));
const report = { command: 'npm run qa:learn-v0.2', baseUrl, scenarios: [], fatalError: null };

const researchPayload = {
    success: true,
    data: {
        symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-30T16:00:00.000Z',
        benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: 12, baselineReturnPercent: 8, relativeReturnPercent: 4, returnBasis: 'adjusted close', status: 'outperformed' },
        quote: { name: 'Microsoft Corporation', currency: 'USD', price: 450, dailyChangePercent: 0.8 },
        fundamentals: {
            revenueGrowthPercent: 15, grossMarginPercent: 69, operatingMarginPercent: 45, freeCashFlow: 74000000000,
            debt: 44000000000, cash: 95000000000, shares: 7440000000, annualRevenue: 245000000000,
            annualNetIncome: 88000000000, reportingPeriod: '2025-06-30', shareChangePercent: -0.5, source: 'SEC EDGAR',
            history: [
                { reportingPeriod: '2025-06-30', currency: 'USD', source: 'SEC EDGAR', annualRevenue: 245000000000, revenueGrowthPercent: 15, grossMarginPercent: 69, operatingMarginPercent: 45, annualNetIncome: 88000000000, freeCashFlow: 74000000000, debt: 44000000000, cash: 95000000000, shares: 7440000000, shareChangePercent: -0.5 },
                { reportingPeriod: '2024-06-30', currency: 'USD', source: 'SEC EDGAR', annualRevenue: 211000000000, revenueGrowthPercent: 12, grossMarginPercent: 68, operatingMarginPercent: 42, annualNetIncome: 72000000000, freeCashFlow: 62000000000, debt: 47000000000, cash: 81000000000, shares: 7480000000, shareChangePercent: -0.2 },
            ],
        },
        valuation: { marketCap: 3350000000000, priceEarnings: 38.07, priceSales: 13.67, freeCashFlowYieldPercent: 2.21, netCash: 51000000000, reportingPeriod: '2025-06-30', source: 'SEC EDGAR + Yahoo Finance' },
        technicals: { ma50: 440, ma200: 410, rsi14: 56, macd: 2, low52Week: 350, high52Week: 470, averageVolume20: 22000000, support: 430, resistance: 470 },
        chart: { interval: '1d', points: [] }, sources: ['SEC EDGAR', 'Yahoo Finance'], warnings: [],
    },
};

const emptyValues = {
    revenue: null, costOfRevenue: null, grossProfit: null, operatingExpenses: null, operatingIncome: null,
    interestExpense: null, taxes: null, netIncome: null, operatingCashFlow: null, capex: null, freeCashFlow: null,
    cash: null, receivables: null, inventory: null, totalAssets: null, debt: null, currentLiabilities: null,
    longTermLiabilities: null, equity: null, sharesDiluted: null, investedCapital: null,
};
const snapshot = (caseId, period, values) => ({
    id: `${caseId}-${period}`, companyId: caseId, companyName: caseId === 'margin-expansion' ? 'Orion Services' : 'Meridian Commerce', fiscalPeriod: `${period}-12-31`,
    periodType: 'annual', reportedAt: `${Number(period) + 1}-02-20`, knownAsOf: `${Number(period) + 1}-02-20`, currency: 'USD', unit: 'millions', sourceId: 'signal-learn-curated-v0.2', sourceLabel: 'Curated educational dataset', methodologyVersion: 'learn-financials-v0.2',
    values: { ...emptyValues, ...values },
});
const replayFor = (caseId) => {
    const base = caseId === 'cash-flow-deterioration'
        ? { revenue: 7200, grossProfit: 2880, operatingIncome: 1080, interestExpense: 120, taxes: 192, netIncome: 768, operatingCashFlow: 1050, capex: 320, freeCashFlow: 730, cash: 1100, debt: 1600, sharesDiluted: 640, investedCapital: 4100 }
        : { revenue: 5000, grossProfit: 2750, operatingIncome: 850, interestExpense: 80, taxes: 154, netIncome: 616, operatingCashFlow: 720, capex: 180, freeCashFlow: 540, cash: 900, debt: 700, sharesDiluted: 500, investedCapital: 2400 };
    const future = caseId === 'cash-flow-deterioration'
        ? { ...base, revenue: 7900, netIncome: 915, operatingCashFlow: 760, capex: 520, freeCashFlow: 240, debt: 2100 }
        : { ...base, revenue: 7777, grossProfit: 4500, operatingIncome: 1800, netIncome: 1300, freeCashFlow: 1100 };
    const intro = { caseId, replayId: `${caseId}-2022`, title: caseId, pattern: 'Business pattern', knownAsOf: '2023-02-20', snapshot: snapshot(caseId, '2022', base), sharePrice: 24, sourceNote: 'Curated historical-pattern exercise.' };
    return { intro, reveal: { ...intro, nextSnapshot: snapshot(caseId, '2023', future), nextSharePrice: 55, debrief: ['Review the driver, contrary evidence, and valuation implication.'] } };
};

const addCheck = (scenario, name, passed, details = '') => {
    scenario.checks.push({ name, status: passed ? 'passed' : 'failed', details });
    if (!passed) throw new Error(`${name}${details ? `: ${details}` : ''}`);
};

const completeReplay = async (page, label) => {
    if (label) await page.getByRole('button', { name: new RegExp(label) }).click();
    await page.getByTestId('business-replay-locked').waitFor();
    await page.getByLabel('Primary business driver').fill('Margins and cash conversion are the main business drivers.');
    await page.getByLabel('Contrary evidence').fill('Debt and capital needs could offset the earnings evidence.');
    await page.getByLabel('Valuation implication').fill('The P/E requires durable earnings and cash-flow support.');
    await page.getByRole('button', { name: 'Commit reasoning and reveal' }).click();
    await page.getByTestId('business-replay-revealed').waitFor();
    await page.getByLabel('Which driver reasoning held up?').fill('The primary driver remained visible in the next report.');
    await page.getByLabel('Which evidence did you miss?').fill('I underweighted cash conversion and balance-sheet change.');
    await page.getByLabel('What changed in the valuation interpretation?').fill('The multiple needed stronger underlying business evidence.');
    await page.getByRole('button', { name: 'Save reflection' }).click();
};

const main = async () => {
    await mkdir(evidenceDir, { recursive: true });
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        for (const viewport of viewports) {
            const scenario = { viewport: `${viewport.width}x${viewport.height}`, checks: [], issues: [], screenshots: [], status: 'failed' };
            report.scenarios.push(scenario);
            const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
            const page = await context.newPage();
            page.setDefaultTimeout(timeoutMs);
            const revealBodies = [];
            page.on('console', (message) => { if (message.type() === 'error') scenario.issues.push({ type: 'console-error', message: message.text() }); });
            page.on('pageerror', (error) => scenario.issues.push({ type: 'page-error', message: error.message }));
            page.on('requestfailed', (request) => scenario.issues.push({ type: 'request-failed', message: `${request.method()} ${request.url()}` }));
            await page.route('**/api/research/symbol/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(researchPayload) }));
            await page.route('**/api/learn/business-replay/**', async (route) => {
                const caseId = new URL(route.request().url()).pathname.split('/').pop();
                const replay = replayFor(caseId);
                if (route.request().method() === 'POST') { revealBodies.push(route.request().postDataJSON()); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: replay.reveal }) }); return; }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: replay.intro }) });
            });

            try {
                const response = await page.goto(`${baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
                addCheck(scenario, 'learn route response', response?.ok() === true, response ? `HTTP ${response.status()}` : 'no response');
                addCheck(scenario, 'v0.3 is current while v0.2 remains selectable', await page.getByRole('button', { name: 'Investment analysis v0.3' }).getAttribute('aria-pressed') === 'true');
                await page.getByRole('button', { name: 'Business foundations v0.2' }).click();
                await page.getByTestId('learn-v0-2').waitFor();
                addCheck(scenario, 'v0.2 release is selected', await page.getByRole('button', { name: 'Business foundations v0.2' }).getAttribute('aria-pressed') === 'true');
                const nav = page.locator('nav[aria-label^="Primary"]:visible');
                addCheck(scenario, 'shared Learn navigation remains selected', (await nav.locator('a[aria-current="page"]').textContent())?.trim() === 'Learn');
                let overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
                addCheck(scenario, 'initial page has no horizontal overflow', overflow <= 1, `${overflow}px`);
                if (captureScreenshots) { const file = path.join(evidenceDir, `learn-v0.2-${viewport.name}-light.png`); await page.screenshot({ path: file, fullPage: true }); scenario.screenshots.push(file); }

                await page.getByPlaceholder('Record the evidence and reasoning you would use.').fill('Organic growth, acquisition cost, margins, and cash contribution must be compared.');
                await page.getByRole('button', { name: 'Mark understood' }).click();
                addCheck(scenario, 'Understand mastery updates', (await page.getByTestId('business-mastery').innerText()).includes('1/9'));

                await page.getByRole('button', { name: /Financials Lab/ }).click();
                await page.getByTestId('financials-lab').waitFor();
                addCheck(scenario, 'all six Financials Lab views exist', await page.locator('nav[aria-label="Financials Lab views"] button').count() === 6);
                const initialEps = await page.getByTestId('v2-waterfall-eps').textContent();
                await page.getByLabel('Gross margin').fill('55');
                addCheck(scenario, 'income-statement manipulation updates EPS', await page.getByTestId('v2-waterfall-eps').textContent() !== initialEps);
                await page.getByRole('button', { name: 'Balance Sheet', exact: true }).click();
                await page.getByRole('button', { name: 'Debt', exact: true }).click();
                addCheck(scenario, 'line item exposes explanation', await page.getByText('Interest-bearing borrowings at the reporting date.').count() > 0);
                await page.getByRole('button', { name: 'Cash Flow', exact: true }).click();
                addCheck(scenario, 'cash flow distinguishes net income and FCF', await page.getByRole('button', { name: 'Net income', exact: true }).count() > 0 && await page.getByRole('button', { name: 'Free cash flow', exact: true }).count() > 0);
                await page.getByRole('button', { name: 'Driver Tree', exact: true }).click();
                addCheck(scenario, 'driver tree links business inputs to P/E', await page.getByText('P/E', { exact: true }).count() > 0 && await page.getByText('Share price / EPS').count() > 0);
                await page.getByRole('button', { name: 'Historical Trend', exact: true }).click();
                addCheck(scenario, 'historical trend shows three periods', await page.getByText('FY 2022').count() > 0 && await page.getByText('FY 2024').count() > 0);
                await page.getByRole('button', { name: 'Compare', exact: true }).click();
                addCheck(scenario, 'comparison warns about structural weakness', await page.getByText('Structurally weak comparison warning', { exact: false }).count() > 0);

                await page.getByRole('button', { name: /Business replay/ }).click();
                await page.getByTestId('business-replay-locked').waitFor();
                addCheck(scenario, 'future financial report is locked before commitment', await page.getByTestId('business-replay-revealed').count() === 0 && !(await page.locator('main').innerText()).includes('7,777'));
                await completeReplay(page);
                addCheck(scenario, 'reveal POST carries bounded reasoning', Boolean(revealBodies[0]?.commitment?.primaryDriver && revealBodies[0]?.commitment?.contraryEvidence && revealBodies[0]?.commitment?.valuationImplication));
                addCheck(scenario, 'future appears after commitment', (await page.getByTestId('business-replay-revealed').innerText()).includes('7,777'));
                addCheck(scenario, 'first replay updates Interpret mastery', (await page.getByTestId('business-mastery').innerText()).includes('1/2'));
                await completeReplay(page, 'Cash-flow deterioration');
                addCheck(scenario, 'two business debriefs complete Interpret mastery', (await page.getByTestId('business-mastery').innerText()).includes('2/2'));

                await page.getByRole('button', { name: /Apply live/ }).click();
                await page.getByText('Microsoft Corporation', { exact: false }).waitFor();
                addCheck(scenario, 'current company labels missing inputs', await page.getByText('The current provider contract has no approved interest-expense input').count() > 0 && await page.getByText('No approved estimate-history provider').count() > 0);
                await page.getByLabel('Selected driver').selectOption({ label: 'Cash conversion and CapEx' });
                await page.getByLabel('Evidence supporting the selection').fill('FCF growth and FCF margin connect earnings to cash generation.');
                await page.getByLabel('Valuation and thesis implication').fill('A weak conversion trend would reduce support for the current P/E.');
                await page.getByLabel('Evidence limitation or missing input').fill('Interest coverage and ROIC are unavailable from the approved contract.');
                await page.getByRole('button', { name: 'Mark Apply complete' }).click();
                addCheck(scenario, 'Apply mastery updates', (await page.getByTestId('business-mastery').innerText()).includes('1/1'));

                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.getByRole('button', { name: 'Business foundations v0.2' }).click();
                await page.getByTestId('business-mastery').waitFor();
                await page.waitForFunction(() => document.querySelector('[data-testid="business-mastery"]')?.textContent?.includes('2/2'));
                const mastery = await page.getByTestId('business-mastery').innerText();
                addCheck(scenario, 'v0.2 mastery persists independently', mastery.includes('1/9') && mastery.includes('2/2') && mastery.includes('1/1'));
                await page.getByRole('button', { name: 'Valuation foundations v0.1' }).click();
                addCheck(scenario, 'v0.1 remains reachable', await page.getByRole('button', { name: /0\.3 .*P\/E ratio/ }).count() > 0);
                await page.getByRole('button', { name: 'Business foundations v0.2' }).click();

                const themeButton = page.locator('button[aria-label^="Switch to"]');
                const shell = page.getByTestId('learn-shell');
                const beforeTheme = await shell.getAttribute('data-theme');
                await themeButton.click();
                addCheck(scenario, 'theme toggle remains functional', await shell.getAttribute('data-theme') !== beforeTheme);
                overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
                addCheck(scenario, 'completed flow has no horizontal overflow', overflow <= 1, `${overflow}px`);
                if (captureScreenshots) { const file = path.join(evidenceDir, `learn-v0.2-${viewport.name}-dark.png`); await page.screenshot({ path: file, fullPage: true }); scenario.screenshots.push(file); }
                addCheck(scenario, 'no browser errors', scenario.issues.length === 0, JSON.stringify(scenario.issues));
                scenario.status = 'passed';
            } catch (error) {
                scenario.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) });
            } finally {
                await context.close();
            }
        }
    } catch (error) {
        report.fatalError = error instanceof Error ? error.message : String(error);
    } finally {
        if (browser) await browser.close();
        await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2));
    }
    const failed = Boolean(report.fatalError) || report.scenarios.some((scenario) => scenario.status !== 'passed');
    console.log(JSON.stringify({ evidenceDir, scenarios: report.scenarios.map(({ viewport, status }) => ({ viewport, status })), fatalError: report.fatalError }, null, 2));
    if (failed) process.exitCode = 1;
};

await main();
