import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const baseUrlArgumentIndex = process.argv.indexOf('--base-url');
const baseUrlArgument = baseUrlArgumentIndex >= 0 ? process.argv[baseUrlArgumentIndex + 1] : undefined;
const baseUrl = baseUrlArgument || process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.SIGNAL_QA_TIMEOUT_MS || 15_000);
const captureScreenshots = process.env.SIGNAL_QA_SCREENSHOTS !== '0';
const viewports = [
    { name: 'desktop', width: 1280, height: 900 },
    { name: 'tablet', width: 768, height: 900 },
    { name: 'mobile', width: 375, height: 812 },
];
const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
const evidenceDir = path.resolve(process.env.SIGNAL_QA_EVIDENCE_DIR || path.join('.tmp', 'signal-learn-v0.1-qa', timestamp));
const report = { command: 'npm run qa:learn', baseUrl, scenarios: [], fatalError: null };

const researchPayload = {
    success: true,
    data: {
        symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-23T16:00:00.000Z',
        benchmark: { baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y', candidateReturnPercent: 12, baselineReturnPercent: 8, relativeReturnPercent: 4, returnBasis: 'adjusted close', status: 'outperformed' },
        quote: { name: 'Microsoft Corporation', currency: 'USD', price: 450, dailyChangePercent: 0.8 },
        fundamentals: {
            revenueGrowthPercent: 15, grossMarginPercent: 69, operatingMarginPercent: 45, freeCashFlow: 74000000000,
            debt: 44000000000, cash: 95000000000, shares: 7440000000, annualRevenue: 245000000000,
            annualNetIncome: 88000000000, reportingPeriod: '2025-06-30', shareChangePercent: -0.5, source: 'SEC EDGAR',
            history: [{ reportingPeriod: '2025-06-30', currency: 'USD', source: 'SEC EDGAR', annualRevenue: 245000000000, revenueGrowthPercent: 15, grossMarginPercent: 69, operatingMarginPercent: 45, annualNetIncome: 88000000000, freeCashFlow: 74000000000, debt: 44000000000, cash: 95000000000, shares: 7440000000, shareChangePercent: -0.5 }],
        },
        valuation: { marketCap: 3350000000000, priceEarnings: 38.07, priceSales: 13.67, freeCashFlowYieldPercent: 2.21, netCash: 51000000000, reportingPeriod: '2025-06-30', source: 'SEC EDGAR + Yahoo Finance' },
        technicals: { ma50: 440, ma200: 410, rsi14: 56, macd: 2, low52Week: 350, high52Week: 470, averageVolume20: 22000000, support: 430, resistance: 470 },
        chart: { interval: '1d', points: [{ time: '2026-08-21', open: 445, high: 452, low: 443, close: 450, volume: 20000000, ma50: 440, ma200: 410, ema20: 446, ema50: 438, sma200: 410, averageVolume20: 22000000, rsi14: 56, macd: 2, macdSignal: 1.8, macdHistogram: 0.2, atr14: 7, atrPercent14: 1.55, anchoredVwap: 442, adx14: 24, plusDi14: 28, minusDi14: 20, supertrend: 435, supertrendDirection: 1 }] },
        sources: ['SEC EDGAR', 'Yahoo Finance'], warnings: [],
    },
};
const nvdaResearchPayload = {
    ...researchPayload,
    data: {
        ...researchPayload.data,
        symbol: 'NVDA',
        quote: { ...researchPayload.data.quote, name: 'NVIDIA Corporation', price: 190 },
        fundamentals: { ...researchPayload.data.fundamentals, revenueGrowthPercent: 55, operatingMarginPercent: 62, cash: 54000000000, debt: 11000000000 },
        valuation: { ...researchPayload.data.valuation, priceEarnings: 46.5, marketCap: 4650000000000 },
    },
};

const before = {
    id: 'msft-2023', fiscalPeriodEnd: '2023-06-30', filedAt: '2023-07-27', priceDate: '2023-07-28', price: 338.37,
    priceEarnings: 34.9, annualRevenue: 211915000000, annualNetIncome: 72361000000, splitAdjustedShares: 7472000000,
    marketCapitalization: 2528000000000, filingUrl: 'https://www.sec.gov/example-2023', form: '10-K', gaps: [],
};
const after = {
    id: 'msft-2024', fiscalPeriodEnd: '2024-06-30', filedAt: '2024-07-30', priceDate: '2024-07-31', price: 418.35,
    priceEarnings: 36.2, annualRevenue: 245122000000, annualNetIncome: 88136000000, splitAdjustedShares: 7464000000,
    marketCapitalization: 3122000000000, filingUrl: 'https://www.sec.gov/example-2024', form: '10-K', gaps: [],
};
const replayIntro = { symbol: 'MSFT', companyName: 'Microsoft Corporation', replayId: before.id, knownAsOf: before.priceDate, observation: before, sourceLabels: ['SEC EDGAR', 'Yahoo Finance'], warnings: [] };
const replayPayloadFor = (symbol) => symbol === 'META'
    ? {
        intro: { ...replayIntro, symbol: 'META', companyName: 'Meta Platforms, Inc.', replayId: 'meta-2023', observation: { ...before, id: 'meta-2023', price: 300.21, priceEarnings: 27.4 }, knownAsOf: before.priceDate },
        after: { ...after, id: 'meta-2024', price: 474.83, priceEarnings: 29.1 },
    }
    : { intro: replayIntro, after };

const addCheck = (scenario, name, passed, details = '') => {
    scenario.checks.push({ name, status: passed ? 'passed' : 'failed', details });
    if (!passed) throw new Error(`${name}${details ? `: ${details}` : ''}`);
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

            await page.route('**/api/research/symbol/**', async (route) => {
                const symbol = new URL(route.request().url()).pathname.split('/').pop();
                const payload = symbol === 'NVDA' ? nvdaResearchPayload : researchPayload;
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
            });
            await page.route('**/api/learn/replay/**', async (route) => {
                const symbol = new URL(route.request().url()).pathname.split('/').pop();
                const replay = replayPayloadFor(symbol);
                if (route.request().method() === 'POST') {
                    revealBodies.push(route.request().postDataJSON());
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { ...replay.intro, nextObservation: replay.after } }) });
                    return;
                }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: replay.intro }) });
            });

            try {
                const response = await page.goto(`${baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
                addCheck(scenario, 'learn route response', response?.ok() === true, response ? `HTTP ${response.status()}` : 'no response');
                await page.getByRole('button', { name: 'Valuation foundations v0.1' }).click();
                await page.locator('[data-testid="learn-v0-1"]').waitFor({ state: 'visible' });
                const nav = page.locator('nav[aria-label^="Primary"]:visible');
                addCheck(scenario, 'Learn selected in visible navigation', (await nav.locator('a[aria-current="page"]').textContent())?.trim() === 'Learn');
                addCheck(scenario, 'Learn navigation labels', (await nav.locator('a').allTextContents()).map((item) => item.trim()).join('|') === 'Market|Research|Learn');
                const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
                addCheck(scenario, 'no horizontal document overflow', overflow <= 1, `${overflow}px`);

                if (captureScreenshots) {
                    const lightPath = path.join(evidenceDir, `learn-${viewport.name}-light.png`);
                    await page.screenshot({ path: lightPath, fullPage: true });
                    scenario.screenshots.push(lightPath);
                }

                await page.getByRole('button', { name: /0\.3 · P\/E ratio/ }).click();
                await page.getByLabel('Share price').fill('200');
                await page.getByLabel('EPS').fill('10');
                addCheck(scenario, 'P/E lab computes ratio', (await page.getByTestId('pe-result').textContent())?.trim() === '20×');
                await page.getByLabel('EPS').fill('0');
                addCheck(scenario, 'P/E lab rejects non-positive EPS', (await page.getByTestId('pe-result').textContent())?.trim() === 'Not meaningful');
                await page.getByRole('button', { name: 'Mark understood' }).click();
                addCheck(scenario, 'concept mastery updates', (await page.getByTestId('learn-mastery').innerText()).includes('1/6'));

                await page.getByRole('button', { name: /Compare/ }).click();
                await page.getByText('NVIDIA Corporation', { exact: false }).waitFor();
                addCheck(scenario, 'comparison loads both companies', await page.getByText('Microsoft Corporation', { exact: false }).count() > 0 && await page.getByText('NVIDIA Corporation', { exact: false }).count() > 0);
                addCheck(scenario, 'comparison does not select a winner', await page.getByText('No automatic winner', { exact: false }).count() > 0);
                const comparisonText = await page.getByTestId('learn-compare').innerText();
                addCheck(scenario, 'comparison exposes timestamps', (comparisonText.match(/Fetched/g) || []).length >= 2);

                await page.getByRole('button', { name: /Apply today/ }).click();
                await page.getByText('Microsoft Corporation', { exact: false }).first().waitFor();
                addCheck(scenario, 'current exercise identifies unavailable forward P/E', await page.getByText('No approved analyst-consensus/estimate-history provider exists', { exact: false }).count() > 0);
                addCheck(scenario, 'current evidence exposes provenance', await page.getByText('Sources and provenance').count() > 0);
                await page.getByLabel('Evidence category').selectOption('supports');
                await page.getByPlaceholder('What fact, assumption, risk, or unanswered question matters?').fill('Positive annual earnings support an interpretable P/E.');
                await page.getByRole('button', { name: 'Add', exact: true }).click();
                await page.getByLabel('Evidence category').selectOption('against');
                await page.getByPlaceholder('What fact, assumption, risk, or unanswered question matters?').fill('The multiple still requires durable growth.');
                await page.getByRole('button', { name: 'Add', exact: true }).click();
                await page.getByLabel('Current thesis').fill('The current valuation may be justified only if earnings growth remains durable.');
                await page.getByLabel('What would change my mind?').fill('Earnings growth slows materially without a lower valuation.');
                await page.getByRole('button', { name: 'Mark Apply complete' }).click();
                addCheck(scenario, 'current exercise updates Apply mastery', (await page.getByTestId('learn-mastery').innerText()).includes('1/1'));

                await page.getByRole('button', { name: /Historical replay/ }).click();
                await page.getByTestId('replay-locked-state').waitFor();
                addCheck(scenario, 'future is locked before commitment', await page.getByTestId('replay-revealed-state').count() === 0);
                addCheck(scenario, 'future value absent before commitment', !(await page.locator('main').innerText()).includes('418.35'));
                await page.getByLabel('Supporting evidence').fill('The filing-aligned P/E is interpretable with positive annual earnings.');
                await page.getByLabel('Contrary evidence').fill('The multiple is high enough that future growth still matters.');
                await page.getByLabel('Invalidation').fill('Earnings weaken while the valuation multiple remains elevated.');
                await page.getByRole('button', { name: 'Commit view & reveal next checkpoint' }).click();
                await page.getByTestId('replay-revealed-state').waitFor();
                addCheck(scenario, 'reveal POST carries commitment', Boolean(revealBodies[0]?.commitment?.supportingEvidence && revealBodies[0]?.commitment?.contraryEvidence && revealBodies[0]?.commitment?.invalidation));
                addCheck(scenario, 'original commitment remains visible', await page.getByText('Your original commitment · locked').count() > 0);
                addCheck(scenario, 'future observation appears only after commit', (await page.getByTestId('replay-revealed-state').innerText()).includes('$418.35'));
                await page.getByLabel('Which reasoning held up?').fill('Earnings and valuation both needed interpretation.');
                await page.getByLabel('Which assumption would you revise?').fill('I relied too much on one multiple.');
                await page.getByLabel('Did confidence match evidence quality?').fill('Confidence was higher than the evidence breadth justified.');
                await page.getByLabel('What would you check sooner next time?').fill('I would inspect growth durability and contrary evidence sooner.');
                await page.getByRole('button', { name: 'Save reflection' }).click();
                addCheck(scenario, 'first replay reflection updates mastery', (await page.getByTestId('learn-mastery').innerText()).includes('1/2'));

                await page.getByRole('button', { name: /Expectations and valuation reset/ }).click();
                await page.getByText('Meta Platforms, Inc.', { exact: false }).waitFor();
                addCheck(scenario, 'second curated case starts with future locked', await page.getByTestId('replay-revealed-state').count() === 0);
                await page.getByLabel('Supporting evidence').fill('The filing showed positive annual earnings.');
                await page.getByLabel('Contrary evidence').fill('Expectations could still reset the multiple.');
                await page.getByLabel('Invalidation').fill('Earnings and revenue weaken together.');
                await page.getByRole('button', { name: 'Commit view & reveal next checkpoint' }).click();
                await page.getByTestId('replay-revealed-state').waitFor();
                await page.getByLabel('Which reasoning held up?').fill('The evidence required both earnings and valuation context.');
                await page.getByLabel('Which assumption would you revise?').fill('I underweighted expectation changes.');
                await page.getByLabel('Did confidence match evidence quality?').fill('The confidence was appropriately limited.');
                await page.getByLabel('What would you check sooner next time?').fill('I would inspect estimate and margin direction sooner.');
                await page.getByRole('button', { name: 'Save reflection' }).click();
                addCheck(scenario, 'two curated replay debriefs update mastery', (await page.getByTestId('learn-mastery').innerText()).includes('2/2'));

                await page.reload({ waitUntil: 'domcontentloaded' });
                await page.getByRole('button', { name: 'Valuation foundations v0.1' }).click();
                await page.getByTestId('learn-mastery').waitFor();
                await page.waitForFunction(() => document.querySelector('[data-testid="learn-mastery"]')?.textContent?.includes('2/2'));
                const masteryAfterReload = await page.getByTestId('learn-mastery').innerText();
                addCheck(scenario, 'mastery survives reload', masteryAfterReload.includes('1/6') && masteryAfterReload.includes('2/2') && masteryAfterReload.includes('1/1'));

                const themeButton = page.locator('button[aria-label^="Switch to"]');
                const beforeTheme = await page.locator('[data-testid="learn-shell"]').getAttribute('data-theme');
                await themeButton.click();
                const afterTheme = await page.locator('[data-testid="learn-shell"]').getAttribute('data-theme');
                addCheck(scenario, 'theme toggle changes Learn theme', beforeTheme !== afterTheme, `${beforeTheme} -> ${afterTheme}`);
                if (captureScreenshots) {
                    const darkPath = path.join(evidenceDir, `learn-${viewport.name}-dark.png`);
                    await page.screenshot({ path: darkPath, fullPage: true });
                    scenario.screenshots.push(darkPath);
                }
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
