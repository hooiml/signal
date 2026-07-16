import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const DEFAULT_PORT = 3107;
const DEFAULT_TIMEOUT_MS = 15_000;
const VIEWPORTS = new Map([
    [1280, { name: 'desktop', width: 1280, height: 900 }],
    [768, { name: 'tablet', width: 768, height: 900 }],
    [375, { name: 'mobile', width: 375, height: 812 }],
]);
const VALID_SCENARIOS = new Set(['all', 'score-evidence', 'controls', 'smoke']);

const args = process.argv.slice(2);
const getArg = (name) => {
    const index = args.indexOf(name);
    if (index >= 0) return args[index + 1];
    const inline = args.find((arg) => arg.startsWith(name + '='));
    return inline ? inline.slice(name.length + 1) : undefined;
};

const requestedScenario = getArg('--scenario') || 'all';
const requestedWidths = (getArg('--viewport') || '1280,768,375')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
const viewports = requestedWidths.map((width) => VIEWPORTS.get(width) || {
    name: `width-${width}`,
    width,
    height: width <= 480 ? 812 : 900,
});
const timeoutMs = Number(getArg('--timeout') || process.env.SIGNAL_QA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
const requestedBaseUrl = getArg('--base-url') || process.env.SIGNAL_QA_URL || null;
const requestedPort = Number(getArg('--port') || DEFAULT_PORT);
const useLiveData = args.includes('--live');
const captureScreenshots = !args.includes('--no-screenshots') && process.env.SIGNAL_QA_SCREENSHOTS !== '0';
const captureFullPage = args.includes('--full-page');
const startedAt = Date.now();
const timestamp = new Date().toISOString().replace(/[.:]/g, '-');
const evidenceDir = path.resolve(
    process.env.SIGNAL_QA_EVIDENCE_DIR || path.join('.tmp', 'signal-market-qa', `${timestamp}-${process.pid}`),
);
const reportPath = path.join(evidenceDir, 'report.json');
const report = {
    command: 'npm run qa:market',
    requestedScenario,
    useLiveData,
    captureScreenshots,
    captureFullPage,
    baseUrl: null,
    server: { owned: false, port: null, stdout: null, stderr: null },
    scenarios: [],
    warnings: [],
    fatalError: null,
};

const shorten = (value, limit = 320) => {
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text.length > limit ? text.slice(0, limit - 3) + '...' : text;
};

const delay = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

const parseOrigin = (value) => {
    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
};

const addIssue = (scenario, category, message, blocking) => {
    const issue = { category, message: shorten(message), blocking };
    if (scenario) scenario.issues.push(issue);
    else report.warnings.push(issue);
};

const runCheck = (checks, name, condition, details) => {
    const passed = Boolean(condition);
    checks.push({ name, status: passed ? 'passed' : 'failed', details });
    if (!passed) throw new Error(`${name}: ${details}`);
};

const canReach = async (url, probeTimeoutMs = 1_000) => {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(probeTimeoutMs) });
        return response.ok;
    } catch {
        return false;
    }
};

const waitForServer = async (url, child) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`Owned dev server exited with code ${child.exitCode}.`);
        if (await canReach(url)) return;
        await delay(250);
    }
    throw new Error(`Timed out waiting for the owned dev server at ${url}.`);
};

const startOwnedServer = async (port) => {
    const baseUrl = `http://127.0.0.1:${port}`;
    if (await canReach(baseUrl)) {
        throw new Error(`Port ${port} is already serving HTTP. Pass --base-url to reuse it or --port to select another port.`);
    }

    const stdoutPath = path.join(evidenceDir, 'server.stdout.log');
    const stderrPath = path.join(evidenceDir, 'server.stderr.log');
    const stdout = createWriteStream(stdoutPath, { flags: 'a' });
    const stderr = createWriteStream(stderrPath, { flags: 'a' });
    const child = spawn(
        process.execPath,
        [path.join(REPO_ROOT, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '--hostname', '127.0.0.1', '--port', String(port)],
        { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
    );
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    report.server = { owned: true, port, stdout: stdoutPath, stderr: stderrPath };
    const server = { baseUrl, child, stdout, stderr };
    try {
        await waitForServer(baseUrl, child);
        return server;
    } catch (error) {
        await stopOwnedServer(server);
        throw error;
    }
};

const stopOwnedServer = async (server) => {
    if (!server?.child || server.child.exitCode !== null) {
        server?.stdout?.end();
        server?.stderr?.end();
        return;
    }

    server.child.kill('SIGTERM');
    const exited = await Promise.race([
        new Promise((resolve) => server.child.once('exit', () => resolve(true))),
        delay(3_000).then(() => false),
    ]);
    if (!exited && server.child.exitCode === null) server.child.kill('SIGKILL');
    server.stdout.end();
    server.stderr.end();
};

const fixtureComponent = ({ name, displayName, value, score, weight, signal, updatedAt }) => ({
    name,
    display_name: displayName,
    value,
    score,
    weight,
    signal,
    enabled: true,
    last_updated: updatedAt,
    metadata: { cadence: name === 'vix' ? 'Daily' : 'Weekly', horizon: name === 'vix' ? 'Short term' : 'Medium term' },
});

const buildFixtureSignal = (requestUrl) => {
    const url = new URL(requestUrl);
    const market = url.searchParams.get('market') === 'MY' ? 'MY' : 'US';
    const mode = url.searchParams.get('mode') === 'contrarian' ? 'contrarian' : 'standard';
    const enableSocial = url.searchParams.get('enableSocial') !== 'false';
    const sourceKey = market === 'MY' ? 'news' : 'social';
    const sourceLabel = market === 'MY' ? 'News Sentiment' : 'Social Sentiment';
    const updatedAt = '2026-07-16T08:00:00.000Z';
    const snapshotDate = '2026-07-16T00:00:00.000Z';
    const baseScore = market === 'US' ? 65 : 61;
    const modeAdjustment = mode === 'contrarian' ? -6 : 0;
    const sourceAdjustment = enableSocial ? 0 : -3;
    const compositeScore = baseScore + modeAdjustment + sourceAdjustment;
    const tier = compositeScore >= 65 ? 'buy' : compositeScore >= 40 ? 'neutral' : 'sell';
    const sourceContribution = enableSocial ? (market === 'US' ? 10.5 : 8.2) : 0;
    const components = {
        vix: fixtureComponent({ name: 'vix', displayName: market === 'US' ? 'VIX Index' : 'Global volatility', value: 16.2, score: 79, weight: 0.45, signal: 'buy', updatedAt }),
        positioning: fixtureComponent({ name: 'positioning', displayName: market === 'US' ? 'AAII' : 'Fund positioning', value: 36.3, score: 58, weight: 0.3, signal: 'neutral', updatedAt }),
    };
    if (enableSocial) {
        components[sourceKey] = fixtureComponent({ name: sourceKey, displayName: sourceLabel, value: market === 'US' ? 0.18 : 0.32, score: 62, weight: 0.25, signal: 'buy', updatedAt });
    }

    const scoreDrivers = [
        { key: 'vix', name: components.vix.display_name, impact: 'positive', contribution: 28.9, score: 79, weight: 0.45, raw_value: 16.2, last_updated: updatedAt, detail: 'Low volatility supports the current read.' },
        { key: 'positioning', name: components.positioning.display_name, impact: 'negative', contribution: 11.4, score: 58, weight: 0.3, raw_value: 36.3, last_updated: updatedAt, detail: 'Positioning does not fully confirm the majority read.' },
    ];
    if (enableSocial) {
        scoreDrivers.push({ key: sourceKey, name: sourceLabel, impact: 'negative', contribution: sourceContribution, score: 62, weight: 0.25, raw_value: components[sourceKey].value, last_updated: updatedAt, detail: 'Sentiment is a secondary, conflicting input.' });
    }

    const marketContext = market === 'US'
        ? {
            market: 'US',
            yield_curve: { spread_pct: 0.42, state: 'normal', report_date: snapshotDate, source_url: 'https://fred.stlouisfed.org/' },
            financial_conditions: { value: -0.18, stance: 'looser', report_date: snapshotDate, source_url: 'https://www.chicagofed.org/' },
            breadth: { equal_weight_return_pct: 7.3, cap_weight_return_pct: 5.8, relative_return_pct: 1.5, period_label: 'one year', report_date: snapshotDate, source_urls: ['https://finance.yahoo.com/'] },
        }
        : {
            market: 'MY',
            malaysia_rates: { mgs_3y_pct: 3.2, mgs_10y_pct: 3.76, curve_spread_pct: 0.56, opr_pct: 3, myor_pct: 3.01, short_term_bill_3m_pct: 3.05, short_term_bill_name: 'BNM Monetary Notes', report_date: snapshotDate, opr_report_date: snapshotDate, source_url: 'https://www.bnm.gov.my/' },
        };

    return {
        composite_score: compositeScore,
        tier,
        mode,
        interpretation: { action: tier === 'buy' ? 'Cautiously positive' : 'Balanced', reasoning: 'Deterministic QA fixture.', color: '#10b981', emoji: '' },
        components,
        confidence: {
            agreement_pct: enableSocial ? 67 : 75,
            level: 'moderate',
            majority_signal: tier === 'sell' ? 'SELL' : tier === 'buy' ? 'BUY' : 'NEUTRAL',
            conflicting_indicators: ['positioning', ...(enableSocial ? [sourceKey] : [])],
            source_count: Object.keys(components).length,
        },
        metadata: {
            market,
            data_freshness: Object.fromEntries(Object.keys(components).map((key) => [key, updatedAt])),
            weight_distribution: Object.fromEntries(Object.entries(components).map(([key, component]) => [key, component.weight])),
            signal_quality: { freshness: 'fresh', source_coverage: 'strong', noise_level: 'moderate', market_regime: 'constructive', warnings: [] },
            score_drivers: scoreDrivers,
            index_trend: [
                { symbol: market === 'US' ? 'SPY' : 'FBMKLCI', price: 100, changePercent: 1.2, trend: 'positive' },
                { symbol: market === 'US' ? 'RSP' : 'FBM70', price: 100, changePercent: 0.7, trend: 'positive' },
            ],
            articles: [
                { title: 'Breadth improves while volatility remains contained', source: 'QA fixture', pubDate: snapshotDate, sentiment: 'bullish' },
                { title: 'Positioning remains mixed ahead of the next update', source: 'QA fixture', pubDate: snapshotDate, sentiment: 'neutral' },
            ],
            interpretation_context: {
                regime: 'Constructive',
                agreeing_signals: ['vix'],
                conflicting_signals: ['positioning', ...(enableSocial ? [sourceKey] : [])],
                limitation: 'Fixture data proves rendering and interaction, not live market accuracy.',
                mode_note: mode === 'contrarian' ? 'Contrarian fixture interpretation.' : 'Momentum fixture interpretation.',
                article_feed_role: 'Fixture articles provide context only.',
            },
            valuation_backdrop: market === 'US' ? {
                name: 'Buffett Indicator', ratio_pct: 188.4, market_value_billions: 55_000, gdp_billions: 29_000, report_date: snapshotDate, label: 'Elevated', detail: 'Non-scored valuation context.', source_url: 'https://fred.stlouisfed.org/',
            } : undefined,
            market_context: marketContext,
            score_delta: { previous_score: compositeScore - 2, delta: 2, previous_date: '2026-07-15T00:00:00.000Z', snapshot_date: snapshotDate, label: 'Up 2 points' },
            score_history: [
                { date: '2026-07-12T00:00:00.000Z', score: compositeScore - 5, tier: 'neutral' },
                { date: '2026-07-13T00:00:00.000Z', score: compositeScore - 3, tier: 'neutral' },
                { date: '2026-07-14T00:00:00.000Z', score: compositeScore - 4, tier: 'neutral' },
                { date: snapshotDate, score: compositeScore, tier },
            ],
            driver_changes_available: true,
            driver_changes: scoreDrivers.slice(0, 2).map((driver, index) => ({ key: driver.key, name: driver.name, current_contribution: driver.contribution, previous_contribution: driver.contribution - (index === 0 ? 0.8 : -0.4), delta: index === 0 ? 0.8 : -0.4 })),
            trend_context: { score_trend: 'Improving', last_signal_change: 'Compared with 2026-07-15', note: 'Deterministic fixture trend.' },
            counterfactuals: {
                source_toggle: {
                    source: sourceKey,
                    source_label: sourceLabel,
                    active: enableSocial,
                    current_score: compositeScore,
                    with_source_score: baseScore + modeAdjustment,
                    without_source_score: baseScore + modeAdjustment - 3,
                    delta_without_source: -3,
                    summary: `${sourceLabel} changes the fixture score by 3 points.`,
                },
            },
        },
    };
};

const inspectScoreEvidence = async (page) => page.evaluate(() => {
    const ids = ['changed-title', 'score-evidence-title', 'scenarios-title', 'context-title', 'market-alerts-title', 'terms-title'];
    const elements = ids.map((id) => document.getElementById(id));
    const orderIsCorrect = elements.every(Boolean) && elements.every((element, index) => (
        index === elements.length - 1
        || Boolean(element.compareDocumentPosition(elements[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING)
    ));
    const visibleQuickReads = [...document.querySelectorAll('[aria-label="Quick read"]')].filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.getBoundingClientRect().height > 0;
    });
    const scoreSection = document.querySelector('section[aria-labelledby="score-evidence-title"]');
    const valuation = document.querySelector('[data-testid="valuation-backdrop"]');
    const marketContext = document.querySelector('[data-testid="market-context"]');
    return {
        orderIsCorrect,
        scoreBridgeConnected: visibleQuickReads.some((element) => element.textContent?.includes('Largest influence:')),
        scoreSectionVisible: Boolean(scoreSection && scoreSection.getBoundingClientRect().height > 0),
        driverHeadingVisible: Boolean(document.getElementById('drivers-title')?.getBoundingClientRect().height),
        oldDisclosureAbsent: !document.body.textContent?.includes('Explore charts and weighted evidence'),
        valuationCollapsed: valuation ? !valuation.hasAttribute('open') : null,
        marketContextCollapsed: marketContext ? !marketContext.hasAttribute('open') : null,
        documentOverflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth,
    };
});

const main = async () => {
    if (!VALID_SCENARIOS.has(requestedScenario)) throw new Error(`Unknown --scenario ${requestedScenario}. Use all, score-evidence, controls, or smoke.`);
    if (viewports.length === 0) throw new Error('No valid viewport widths were provided.');
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error('Timeout must be a positive number.');
    if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65_535) throw new Error('Port must be an integer from 1 to 65535.');

    await mkdir(evidenceDir, { recursive: true });
    let ownedServer = null;
    let browser = null;
    let currentScenario = null;

    try {
        let baseUrl = requestedBaseUrl;
        if (!baseUrl) {
            baseUrl = await canReach(DEFAULT_BASE_URL) ? DEFAULT_BASE_URL : null;
        }
        if (!baseUrl) {
            ownedServer = await startOwnedServer(requestedPort);
            baseUrl = ownedServer.baseUrl;
        } else if (!await canReach(baseUrl, timeoutMs)) {
            throw new Error(`Base URL is unavailable: ${baseUrl}`);
        }

        const baseOrigin = parseOrigin(baseUrl);
        if (!baseOrigin) throw new Error(`Invalid base URL: ${baseUrl}`);
        report.baseUrl = baseUrl;

        browser = await chromium.launch({ headless: !args.includes('--headed') });
        const context = await browser.newContext();
        context.setDefaultTimeout(timeoutMs);
        const page = await context.newPage();
        const signalRequests = [];

        if (!useLiveData) {
            await page.route('**/api/signals/v2?**', async (route) => {
                const signal = buildFixtureSignal(route.request().url());
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: signal }) });
            });
        }

        page.on('request', (request) => {
            if (request.url().includes('/api/signals/v2?')) signalRequests.push(request.url());
        });
        page.on('console', (message) => {
            if (message.type() === 'warning') addIssue(currentScenario, 'console-warning', message.text(), false);
            if (message.type() === 'error') addIssue(currentScenario, 'console-error', message.text(), true);
        });
        page.on('pageerror', (error) => addIssue(currentScenario, 'page-error', error.message, true));
        page.on('requestfailed', (request) => {
            if ((request.failure()?.errorText || '').includes('ERR_ABORTED')) return;
            addIssue(currentScenario, 'request-failed', `${request.method()} ${request.url()} (${request.failure()?.errorText || 'unknown failure'})`, parseOrigin(request.url()) === baseOrigin);
        });
        page.on('response', (response) => {
            if (response.status() < 400) return;
            addIssue(currentScenario, 'http-response', `${response.status()} ${response.request().method()} ${response.url()}`, parseOrigin(response.url()) === baseOrigin);
        });

        const runLayout = requestedScenario === 'all' || requestedScenario === 'score-evidence' || requestedScenario === 'smoke';
        const runControls = requestedScenario === 'all' || requestedScenario === 'controls';
        const layoutViewports = requestedScenario === 'smoke' ? viewports.slice(0, 1) : viewports;

        if (runLayout) {
            for (const viewport of layoutViewports) {
                const scenario = { name: 'score-evidence', viewport: `${viewport.width}x${viewport.height}`, screenshot: null, checks: [], issues: [], durationMs: 0, status: 'failed' };
                report.scenarios.push(scenario);
                currentScenario = scenario;
                const scenarioStartedAt = Date.now();
                try {
                    await page.setViewportSize({ width: viewport.width, height: viewport.height });
                    const navigationResponse = await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
                    runCheck(scenario.checks, 'document response', navigationResponse?.ok() === true, navigationResponse ? `HTTP ${navigationResponse.status()}` : 'navigation did not return a response');
                    await page.locator('#score-evidence-title').waitFor({ state: 'visible', timeout: timeoutMs });
                    const details = await inspectScoreEvidence(page);
                    runCheck(scenario.checks, 'section order', details.orderIsCorrect, JSON.stringify(details));
                    runCheck(scenario.checks, 'score bridge connected', details.scoreBridgeConnected, JSON.stringify(details));
                    runCheck(scenario.checks, 'score evidence visible', details.scoreSectionVisible && details.driverHeadingVisible && details.oldDisclosureAbsent, JSON.stringify(details));
                    runCheck(scenario.checks, 'document has no horizontal overflow', details.documentOverflow <= 1, `${details.documentOverflow}px overflow`);
                    runCheck(scenario.checks, 'secondary context starts collapsed', details.valuationCollapsed !== false && details.marketContextCollapsed !== false, JSON.stringify(details));

                    if (captureScreenshots) {
                        const screenshotPath = path.join(evidenceDir, `score-evidence-${viewport.name}-${viewport.width}x${viewport.height}.png`);
                        if (captureFullPage) await page.screenshot({ path: screenshotPath, fullPage: true });
                        else await page.locator('section[aria-labelledby="score-evidence-title"]').screenshot({ path: screenshotPath });
                        scenario.screenshot = screenshotPath;
                    }
                    scenario.status = 'passed';
                } catch (error) {
                    scenario.error = shorten(error instanceof Error ? error.message : error);
                } finally {
                    scenario.durationMs = Date.now() - scenarioStartedAt;
                }
            }
        }

        if (runControls) {
            const viewport = viewports.find((candidate) => candidate.width >= 1200) || viewports[0];
            const scenario = { name: 'controls', viewport: `${viewport.width}x${viewport.height}`, screenshot: null, checks: [], issues: [], durationMs: 0, status: 'failed' };
            report.scenarios.push(scenario);
            currentScenario = scenario;
            const scenarioStartedAt = Date.now();
            try {
                await context.clearCookies();
                await page.setViewportSize({ width: viewport.width, height: viewport.height });
                await page.goto(new URL('/', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
                await page.locator('#score-evidence-title').waitFor({ state: 'visible', timeout: timeoutMs });

                const waitForRecordedSignal = async (part, startIndex) => {
                    const deadline = Date.now() + timeoutMs;
                    while (Date.now() < deadline) {
                        const match = signalRequests.slice(startIndex).find((url) => url.includes(part));
                        if (match) return match;
                        await delay(50);
                    }
                    throw new Error(`No signal request containing ${part} was recorded.`);
                };

                let requestIndex = signalRequests.length;
                await page.locator('[role="group"][aria-label="Region"] button', { hasText: 'MY' }).click();
                await waitForRecordedSignal('market=MY', requestIndex);
                runCheck(scenario.checks, 'market toggle requests MY signal', signalRequests.some((url) => url.includes('market=MY')), signalRequests.at(-1) || 'no signal request');

                requestIndex = signalRequests.length;
                await page.locator('[role="group"][aria-label="Interpretation mode"] button', { hasText: 'Contrarian' }).click();
                await waitForRecordedSignal('mode=contrarian', requestIndex);
                runCheck(scenario.checks, 'mode toggle requests contrarian signal', signalRequests.some((url) => url.includes('mode=contrarian')), signalRequests.at(-1) || 'no signal request');

                const sourceGroup = page.locator('[role="group"][aria-label="Data source"]');
                const sourceCheckbox = sourceGroup.locator('input[type="checkbox"]');
                const before = await sourceCheckbox.isChecked();
                requestIndex = signalRequests.length;
                await sourceGroup.locator('label').click();
                await waitForRecordedSignal(`enableSocial=${!before}`, requestIndex);
                const quickReadText = await page.locator('[aria-label="Quick read"]:visible').textContent();
                runCheck(scenario.checks, 'source toggle changes request state', await sourceCheckbox.isChecked() === !before, `${before} -> ${await sourceCheckbox.isChecked()}`);
                runCheck(scenario.checks, 'score bridge remains connected after controls', quickReadText.includes('Largest influence:'), shorten(quickReadText));
                scenario.status = 'passed';
            } catch (error) {
                scenario.error = shorten(error instanceof Error ? error.message : error);
            } finally {
                scenario.durationMs = Date.now() - scenarioStartedAt;
            }
        }

        report.signalRequests = signalRequests;
        await context.close();
    } catch (error) {
        report.fatalError = shorten(error instanceof Error ? error.message : error);
    } finally {
        if (browser) await browser.close();
        await stopOwnedServer(ownedServer);
    }

    report.durationMs = Date.now() - startedAt;
    report.passedScenarios = report.scenarios.filter((scenario) => scenario.status === 'passed').length;
    report.failedScenarios = report.scenarios.length - report.passedScenarios;
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

    const blockingIssueCount = report.scenarios.reduce((count, scenario) => count + scenario.issues.filter((issue) => issue.blocking).length, 0);
    const failed = Boolean(report.fatalError || report.failedScenarios > 0 || blockingIssueCount > 0);
    console.log(`Market QA ${failed ? 'FAILED' : 'PASSED'} in ${report.durationMs}ms (${useLiveData ? 'live' : 'fixture'} data)`);
    for (const scenario of report.scenarios) {
        const suffix = scenario.error ? `: ${scenario.error}` : '';
        console.log(`${scenario.status === 'passed' ? 'PASS' : 'FAIL'} ${scenario.name} ${scenario.viewport} (${scenario.durationMs}ms)${suffix}`);
    }
    if (report.warnings.length > 0) console.log(`WARN run-level issues: ${report.warnings.length}`);
    console.log(`Evidence report: ${reportPath}`);
    if (failed) process.exitCode = 1;
};

main().catch(async (error) => {
    report.fatalError = shorten(error instanceof Error ? error.message : error);
    report.durationMs = Date.now() - startedAt;
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.error(`Market QA could not start: ${report.fatalError}`);
    console.error(`Evidence report: ${reportPath}`);
    process.exitCode = 1;
});
