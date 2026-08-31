import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const baseUrlArg = process.argv.findIndex((value) => value === '--base-url');
const baseUrl = (baseUrlArg >= 0 ? process.argv[baseUrlArg + 1] : process.env.SIGNAL_QA_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const timeoutMs = Number(process.env.SIGNAL_QA_TIMEOUT_MS || 15000);
const captureScreenshots = process.env.SIGNAL_QA_SCREENSHOTS !== '0';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceDir = path.resolve(process.env.SIGNAL_QA_EVIDENCE_DIR || path.join('.tmp', 'signal-learn-v0.3-qa', timestamp));
const viewports = [{ name: 'desktop', width: 1280, height: 800 }, { name: 'tablet', width: 768, height: 900 }, { name: 'mobile', width: 375, height: 812 }];
const report = { command: 'npm run qa:learn-v0.3', baseUrl, scenarios: [], fatalError: null };

const replayIntro = (caseId) => ({ caseId, replayId: `${caseId}-checkpoint`, title: caseId === 'duration-reset-2022' ? 'Long-duration growth during a rate reset' : 'Record margins in a cyclical business', knownAsOf: '2022-06-30', setup: 'Use only the evidence available at this checkpoint.', snapshot: { revenueGrowth: '20%', margin: '18%', earningsPower: '$4.00 EPS', valuation: '30x earnings', estimates: 'Revisions down 4%', rates: '2Y 3.0%; 10Y 3.2%', inflation: 'CPI 8.0%', events: ['Policy rate increased.'], narrativeEvidence: ['Relative performance weakened.', 'Estimate revisions were negative.'] }, sourceNote: 'Curated point-in-time educational fixture.' });
const replayReveal = (caseId) => ({ ...replayIntro(caseId), nextKnownAsOf: '2023-03-31', nextSnapshot: { revenueGrowth: 'FUTURE-ONLY 11%', margin: '15%', earningsPower: '$3.20 EPS', valuation: '22x earnings', estimates: 'Revisions down 9%', rates: '2Y 4.2%; 10Y 3.6%', inflation: 'CPI 6.0%', events: ['Guidance reduced.'], narrativeEvidence: ['Relative performance stabilized.'] }, debrief: ['Separate operating change from multiple change.', 'Do not diagnose bias from outcome alone.'] });
const addCheck = (scenario, name, passed, details = '') => { scenario.checks.push({ name, status: passed ? 'passed' : 'failed', details }); if (!passed) throw new Error(`${name}${details ? `: ${details}` : ''}`); };
const fillAllThesis = async (page) => { for (const label of ['Business', 'Quality', 'Growth', 'Valuation', 'Expectations', 'Risks', 'Catalysts', 'Contrary evidence', 'Invalidation']) await page.getByLabel(`Thesis ${label}`).fill(`${label} evidence is explicit, sourced, and bounded by an assumption.`); };
const fillCurrent = async (page) => { await page.getByLabel('Current company', { exact: true }).fill('TEST'); for (const label of ['Business summary', 'Financial health', 'Valuation', 'Expectations', 'Macro context', 'Evidence for', 'Evidence against', 'Scenarios', 'Thesis', 'Invalidation']) await page.getByLabel(`Current ${label}`, { exact: true }).fill(`${label} uses current verified evidence with a stated limitation.`); };

const main = async () => {
    await mkdir(evidenceDir, { recursive: true });
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        for (const viewport of viewports) {
            const scenario = { viewport: `${viewport.width}x${viewport.height}`, checks: [], issues: [], screenshots: [], status: 'failed' };
            report.scenarios.push(scenario);
            const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
            await context.addInitScript(() => { if (!sessionStorage.getItem('signal-learn-v0.3-qa-initialized')) { localStorage.removeItem('signal-learn-v0.3-progress'); localStorage.removeItem('signal-learn-v0.3-decision-journal'); sessionStorage.setItem('signal-learn-v0.3-qa-initialized', '1'); } });
            const page = await context.newPage(); page.setDefaultTimeout(timeoutMs); const revealBodies = [];
            page.on('console', (message) => { if (message.type() === 'error') scenario.issues.push({ type: 'console-error', message: message.text() }); });
            page.on('pageerror', (error) => scenario.issues.push({ type: 'page-error', message: error.message }));
            page.on('requestfailed', (request) => scenario.issues.push({ type: 'request-failed', message: `${request.method()} ${request.url()}` }));
            await page.route('**/api/learn/investment-replay/**', async (route) => { const caseId = new URL(route.request().url()).pathname.split('/').pop(); if (route.request().method() === 'POST') { revealBodies.push(route.request().postDataJSON()); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: replayReveal(caseId) }) }); } else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: replayIntro(caseId) }) }); });
            try {
                const response = await page.goto(`${baseUrl}/learn`, { waitUntil: 'domcontentloaded' });
                addCheck(scenario, 'learn route response', response?.ok() === true, response ? `HTTP ${response.status()}` : 'no response');
                addCheck(scenario, 'v0.4 is current while v0.3 remains selectable', await page.getByRole('button', { name: 'Trading process v0.4' }).getAttribute('aria-pressed') === 'true');
                await page.getByRole('button', { name: 'Investment analysis v0.3' }).click();
                await page.getByTestId('learn-v0-3').waitFor();
                addCheck(scenario, 'v0.3 release is selected', await page.getByRole('button', { name: 'Investment analysis v0.3' }).getAttribute('aria-pressed') === 'true');
                const nav = page.locator('nav[aria-label^="Primary"]:visible');
                addCheck(scenario, 'shared Learn navigation remains selected', (await nav.locator('a[aria-current="page"]').textContent())?.trim() === 'Learn');
                let overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
                addCheck(scenario, 'initial page has no horizontal overflow', overflow <= 1, `${overflow}px`);
                if (captureScreenshots) { const file = path.join(evidenceDir, `learn-v0.3-${viewport.name}-light.png`); await page.screenshot({ path: file, fullPage: true }); scenario.screenshots.push(file); }

                await page.getByLabel('Concept reasoning').fill('The denominator must match business economics and expose its limitations.');
                await page.getByRole('button', { name: 'Mark understood' }).click();
                addCheck(scenario, 'concept mastery updates', (await page.getByTestId('investment-mastery').innerText()).includes('1/14'));

                await page.getByRole('button', { name: /Valuation Lens/ }).click();
                await page.getByTestId('valuation-lens').waitFor();
                addCheck(scenario, 'multiple bridge separates earnings and compression', (await page.getByTestId('multiple-total-return').textContent()) === '-6.7%');
                await page.getByLabel('Business type').selectOption('bank'); await page.getByLabel('Preferred valuation metric').selectOption('price-sales');
                addCheck(scenario, 'weak valuation metric is challenged', await page.getByText('Structural challenge:', { exact: false }).count() === 1);
                await page.getByLabel('Valuation evidence reasoning').fill('Book value is a stronger starting point because the balance sheet drives bank economics.');
                await page.getByRole('button', { name: 'Save valuation reasoning' }).click();

                await page.getByRole('button', { name: /Macro Context/ }).click();
                addCheck(scenario, 'macro separates facts and uncertainty', await page.getByText('Possible interpretation', { exact: true }).count() === 4 && await page.getByText('Uncertainty', { exact: true }).count() === 4);
                await page.getByLabel('Macro second-order reasoning').fill('Jobs strength may support revenue while also raising required returns and compressing long-duration multiples.');
                await page.getByRole('button', { name: 'Save macro reasoning' }).click();

                await page.getByRole('button', { name: /^Research/ }).click();
                await page.getByRole('button', { name: 'Evidence Board', exact: true }).click();
                await page.getByLabel('Evidence observation').fill('Estimate revisions declined four percent.'); await page.getByLabel('Evidence source').fill('Fixture consensus, 2023-09'); await page.getByRole('button', { name: 'Add', exact: true }).click();
                await page.getByLabel('Evidence relationship').selectOption('against'); await page.getByLabel('Evidence observation').fill('Required return rose with the ten-year yield.'); await page.getByLabel('Evidence source').fill('Fixture Treasury, 2023-09'); await page.getByRole('button', { name: 'Add', exact: true }).click();
                addCheck(scenario, 'evidence board preserves relationship and source', await page.locator('[data-testid="evidence-board"] article').count() === 2);
                await page.getByRole('button', { name: 'Thesis', exact: true }).click(); await fillAllThesis(page);
                addCheck(scenario, 'reasoning challenger never rates the stock', !(await page.getByTestId('reasoning-challenge').innerText()).match(/\bbuy\b|\bsell\b/i));
                await page.getByRole('button', { name: 'Commit thesis to journal' }).click();
                addCheck(scenario, 'journal original is locked', (await page.getByTestId('journal-original').innerText()).includes('Business evidence is explicit'));
                await page.getByLabel('Journal update reason').fill('New evidence changed the estimate trend.'); await page.getByLabel('Journal current thesis').fill('The current thesis retains quality but uses lower confidence.'); await page.getByRole('button', { name: 'Append update' }).click();
                addCheck(scenario, 'journal appends update', (await page.getByTestId('decision-journal').innerText()).includes('New evidence changed the estimate trend.'));

                await page.getByRole('button', { name: /^Scenarios/ }).first().click(); await page.getByTestId('scenario-builder').waitFor();
                addCheck(scenario, 'default scenario probabilities total 100', await page.getByTestId('scenario-probability-total').textContent() === '100%');
                await page.getByLabel('Bear Probability %').fill('30'); addCheck(scenario, 'probabilities are not normalized invisibly', await page.getByTestId('scenario-probability-total').textContent() === '105%');
                await page.getByLabel('Bear Probability %').fill('25'); await page.getByLabel('Enable weighted expected value').check(); addCheck(scenario, 'weighted value is opt-in', (await page.getByTestId('scenario-weighted-value').innerText()).includes('$'));
                await page.getByRole('button', { name: 'Save scenario set' }).click();

                await page.getByRole('button', { name: /Portfolio/ }).click(); addCheck(scenario, 'factor exposure reveals hidden concentration', (await page.getByTestId('portfolio-lab').innerText()).includes('Long-duration growth') && (await page.getByTestId('portfolio-lab').innerText()).includes('65%'));
                await page.getByLabel('Portfolio concentration reasoning').fill('Long-duration growth connects four holdings and dominates the portfolio.'); await page.getByRole('button', { name: 'Save risk reasoning' }).click();
                await page.getByRole('button', { name: /^Journal/ }).first().click(); addCheck(scenario, 'journal survives workspace navigation', (await page.getByTestId('journal-original').innerText()).includes('Business evidence is explicit'));

                await page.getByRole('button', { name: /^Replay/ }).click(); await page.getByTestId('investment-replay-locked').waitFor();
                addCheck(scenario, 'future evidence is absent before commitment', !(await page.locator('main').innerText()).includes('FUTURE-ONLY'));
                await page.getByLabel('Replay thesis').fill('Growth may slow while quality remains durable.'); await page.getByLabel('Supporting evidence').fill('Margins remain positive and recurring.'); await page.getByLabel('Contrary evidence').fill('Estimate revisions and relative performance weakened.'); await page.getByLabel('Invalidation').fill('Margins below fifteen percent would invalidate the view.'); await page.getByRole('button', { name: 'Commit thesis and reveal' }).click(); await page.getByTestId('investment-replay-revealed').waitFor();
                addCheck(scenario, 'reveal POST carries bounded thesis evidence', Boolean(revealBodies[0]?.commitment?.thesis && revealBodies[0]?.commitment?.contraryEvidence && revealBodies[0]?.commitment?.invalidation));
                addCheck(scenario, 'future evidence appears only after commitment', (await page.getByTestId('investment-replay-revealed').innerText()).includes('FUTURE-ONLY'));
                await page.getByLabel('Which reasoning held up?').fill('Quality remained visible.'); await page.getByLabel('Which evidence did you miss?').fill('I underweighted estimate revisions.'); await page.getByLabel('How should the thesis change?').fill('Confidence should decline without rewriting the original.'); await page.getByRole('button', { name: 'Save reflection' }).click();

                await page.getByRole('button', { name: /Apply current/ }).click(); await fillCurrent(page); addCheck(scenario, 'current exercise exposes all eleven required inputs', await page.locator('[data-testid="investment-apply"] textarea').count() === 10 && await page.getByLabel('Current analysis confidence').count() === 1); await page.getByRole('button', { name: 'Complete current analysis' }).click();
                const currentText = await page.getByTestId('investment-apply').innerText(); addCheck(scenario, 'current exercise does not output a recommendation', currentText.includes('No hidden answer key') && !currentText.match(/Buy rating|Sell rating|Recommendation:/i));

                await page.reload({ waitUntil: 'domcontentloaded' }); await page.getByRole('button', { name: 'Investment analysis v0.3' }).click(); await page.getByTestId('investment-mastery').waitFor(); await page.waitForFunction(() => document.querySelector('[data-testid="investment-mastery"]')?.textContent?.includes('Replay'));
                addCheck(scenario, 'v0.3 mastery persists independently', (await page.getByTestId('investment-mastery').innerText()).includes('1/14'));
                await page.getByRole('button', { name: /^Journal/ }).first().click(); await page.getByTestId('journal-original').waitFor(); addCheck(scenario, 'immutable journal persists after reload', (await page.getByTestId('journal-original').innerText()).includes('Business evidence is explicit'));
                await page.getByRole('button', { name: 'Business foundations v0.2' }).click(); addCheck(scenario, 'v0.2 remains reachable', await page.getByTestId('learn-v0-2').count() === 1); await page.getByRole('button', { name: 'Valuation foundations v0.1' }).click(); addCheck(scenario, 'v0.1 remains reachable', await page.getByTestId('learn-v0-1').count() === 1); await page.getByRole('button', { name: 'Investment analysis v0.3' }).click();
                const themeButton = page.locator('button[aria-label^="Switch to"]'); const shell = page.getByTestId('learn-shell'); const beforeTheme = await shell.getAttribute('data-theme'); await themeButton.click(); addCheck(scenario, 'theme toggle remains functional', await shell.getAttribute('data-theme') !== beforeTheme);
                overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth); addCheck(scenario, 'completed flow has no horizontal overflow', overflow <= 1, `${overflow}px`);
                if (captureScreenshots) { const file = path.join(evidenceDir, `learn-v0.3-${viewport.name}-dark.png`); await page.screenshot({ path: file, fullPage: true }); scenario.screenshots.push(file); }
                addCheck(scenario, 'no browser errors', scenario.issues.length === 0, JSON.stringify(scenario.issues)); scenario.status = 'passed';
            } catch (error) { scenario.issues.push({ type: 'blocking', message: error instanceof Error ? error.message : String(error) }); } finally { await context.close(); }
        }
    } catch (error) { report.fatalError = error instanceof Error ? error.message : String(error); } finally { if (browser) await browser.close(); await writeFile(path.join(evidenceDir, 'report.json'), JSON.stringify(report, null, 2)); }
    const failed = Boolean(report.fatalError) || report.scenarios.some((scenario) => scenario.status !== 'passed'); console.log(JSON.stringify({ evidenceDir, scenarios: report.scenarios.map(({ viewport, status, issues }) => ({ viewport, status, issues })), fatalError: report.fatalError }, null, 2)); if (failed) process.exitCode = 1;
};

await main();
