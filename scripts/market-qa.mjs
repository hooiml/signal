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
const requestedTheme = getArg('--theme') || null;
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
    requestedTheme,
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
    const components = {
        vix: fixtureComponent({ name: 'vix', displayName: market === 'US' ? 'VIX Index' : 'Global volatility', value: 16.2, score: 79, weight: market === 'US' ? 0.35 : 0.25, signal: 'buy', updatedAt }),
        aaii: fixtureComponent({ name: 'aaii', displayName: 'AAII', value: 36.3, score: 54, weight: market === 'US' ? 0.2 : 0.1, signal: 'neutral', updatedAt }),
    };
    if (market === 'US') {
        components.put_call = fixtureComponent({ name: 'put_call', displayName: 'Put/call ratio', value: 0.93, score: 46, weight: 0.1, signal: 'neutral', updatedAt });
        components.naaim = fixtureComponent({ name: 'naaim', displayName: 'Manager exposure (NAAIM)', value: 95.6, score: 100, weight: 0.1, signal: 'buy', updatedAt });
    }
    if (enableSocial) {
        components[sourceKey] = fixtureComponent({ name: sourceKey, displayName: sourceLabel, value: market === 'US' ? 0 : 0.32, score: market === 'US' ? 50 : 62, weight: market === 'US' ? 0.2 : 0.65, signal: market === 'US' ? 'neutral' : 'buy', updatedAt });
    }

    const activeWeight = Object.values(components).reduce((sum, component) => sum + component.weight, 0);
    const missingWeight = Math.max(0, 1 - activeWeight);
    const activePoints = Object.values(components).reduce((sum, component) => sum + component.score * component.weight, 0);
    const neutralPoints = missingWeight * 50;
    const compositeScore = Math.round(activePoints + neutralPoints);
    const standardTier = compositeScore >= 85 ? 'strong-buy' : compositeScore >= 65 ? 'buy' : compositeScore >= 40 ? 'neutral' : compositeScore >= 20 ? 'sell' : 'strong-sell';
    const contrarianTiers = { 'strong-buy': 'strong-sell', buy: 'sell', neutral: 'neutral', sell: 'buy', 'strong-sell': 'strong-buy' };
    const tier = mode === 'contrarian' ? contrarianTiers[standardTier] : standardTier;

    const scoreDrivers = [
        { key: 'vix', name: components.vix.display_name, impact: 'positive', contribution: components.vix.score * components.vix.weight, score: components.vix.score, weight: components.vix.weight, raw_value: components.vix.value, last_updated: updatedAt, detail: 'Low volatility supports the current read.' },
        { key: 'aaii', name: components.aaii.display_name, impact: 'negative', contribution: components.aaii.score * components.aaii.weight, score: components.aaii.score, weight: components.aaii.weight, raw_value: components.aaii.value, last_updated: updatedAt, detail: 'AAII does not fully confirm the majority read.' },
    ];
    if (enableSocial) {
        scoreDrivers.push({ key: sourceKey, name: sourceLabel, impact: market === 'US' ? 'negative' : 'positive', contribution: components[sourceKey].score * components[sourceKey].weight, score: components[sourceKey].score, weight: components[sourceKey].weight, raw_value: components[sourceKey].value, last_updated: updatedAt, detail: 'Sentiment is a secondary market input.' });
    }
    if (market === 'US') {
        scoreDrivers.push({ key: 'naaim', name: components.naaim.display_name, impact: 'positive', contribution: components.naaim.score * components.naaim.weight, score: components.naaim.score, weight: components.naaim.weight, raw_value: components.naaim.value, last_updated: updatedAt, detail: 'Manager exposure supports the current read.' });
        scoreDrivers.push({ key: 'put_call', name: 'Put/call ratio', impact: 'neutral', contribution: components.put_call.score * components.put_call.weight, score: components.put_call.score, weight: components.put_call.weight, raw_value: components.put_call.value, last_updated: updatedAt, detail: 'Options positioning does not confirm the majority read.' });
    }

    const conflictingIndicators = ['aaii', ...(market === 'US' && enableSocial ? ['social'] : []), ...(market === 'US' ? ['put_call'] : [])];

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
        interpretation: { action: tier.includes('buy') ? 'Cautiously positive' : tier.includes('sell') ? 'Cautiously negative' : 'Balanced', reasoning: 'Deterministic QA fixture.', color: '#10b981', emoji: '' },
        components,
        confidence: {
            agreement_pct: enableSocial ? 67 : 75,
            level: 'moderate',
            majority_signal: tier.includes('sell') ? 'SELL' : tier.includes('buy') ? 'BUY' : 'NEUTRAL',
            conflicting_indicators: conflictingIndicators,
            source_count: Object.keys(components).length,
        },
        metadata: {
            market,
            data_freshness: Object.fromEntries(Object.keys(components).map((key) => [key, updatedAt])),
            weight_distribution: Object.fromEntries(Object.entries(components).map(([key, component]) => [key, component.weight])),
            coverage_adjustment: { active_weight: activeWeight, missing_weight: missingWeight, neutral_baseline: 50, active_points: activePoints, neutral_points: neutralPoints },
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
                conflicting_signals: conflictingIndicators,
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
                    with_source_score: market === 'US' ? 66 : 65,
                    without_source_score: market === 'US' ? 66 : 58,
                    delta_without_source: market === 'US' ? 0 : -7,
                    summary: market === 'US' ? `${sourceLabel} is neutral and does not change the fixture score.` : `${sourceLabel} raises the fixture score by 7 points.`,
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
    const coverageAdjustment = document.querySelector('[data-testid="coverage-adjustment"]');
    return {
        orderIsCorrect,
        scoreBridgeConnected: visibleQuickReads.some((element) => element.textContent?.includes('Largest influence:')),
        scoreSectionVisible: Boolean(scoreSection && scoreSection.getBoundingClientRect().height > 0),
        driverHeadingVisible: Boolean(document.getElementById('drivers-title')?.getBoundingClientRect().height),
        oldDisclosureAbsent: !document.body.textContent?.includes('Explore charts and weighted evidence'),
        valuationCollapsed: valuation ? !valuation.hasAttribute('open') : null,
        marketContextCollapsed: marketContext ? !marketContext.hasAttribute('open') : null,
        coverageText: coverageAdjustment?.textContent || '',
        driverTableText: document.querySelector('section[aria-labelledby="drivers-title"]')?.textContent || '',
        documentOverflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth,
    };
});

const main = async () => {
    if (!VALID_SCENARIOS.has(requestedScenario)) throw new Error(`Unknown --scenario ${requestedScenario}. Use all, score-evidence, controls, or smoke.`);
    if (requestedTheme !== null && requestedTheme !== 'light' && requestedTheme !== 'dark') throw new Error('Theme must be light or dark.');
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
        if (requestedTheme) {
            await context.addInitScript((theme) => window.localStorage.setItem('signal-dashboard-theme-v2', theme), requestedTheme);
        }
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
                    runCheck(scenario.checks, 'coverage adjustment explains neutral reserve', details.coverageText.includes('95% configured weight') && details.coverageText.includes('neutral reserve (5% × 50)') && details.coverageText.includes('not redistributed'), details.coverageText);
                    runCheck(scenario.checks, 'driver weights are visible', details.driverTableText.includes('35% configured weight') && details.driverTableText.includes('20% configured weight') && details.driverTableText.includes('10% configured weight'), details.driverTableText);
                    runCheck(scenario.checks, 'document has no horizontal overflow', details.documentOverflow <= 1, `${details.documentOverflow}px overflow`);
                    runCheck(scenario.checks, 'secondary context starts collapsed', details.valuationCollapsed !== false && details.marketContextCollapsed !== false, JSON.stringify(details));

                    const conflictDisclosure = page.locator('[data-testid="conflict-explanation"][data-driver="aaii"]:visible').first();
                    runCheck(scenario.checks, 'conflict explanation control visible', await conflictDisclosure.count() > 0, 'expected a visible conflict info control');
                    if (await conflictDisclosure.count() > 0) {
                        await conflictDisclosure.locator('summary').click();
                        const conflictNote = conflictDisclosure.locator('[role="note"]');
                        const conflictNoteBox = await conflictNote.boundingBox();
                        const conflictNoteText = await conflictNote.textContent();
                        runCheck(scenario.checks, 'conflict explanation opens', await conflictDisclosure.evaluate((element) => element.hasAttribute('open')), conflictNoteText || 'no explanation text');
                        runCheck(scenario.checks, 'AAII explanation shows source, conversion, and majority relationship', Boolean(conflictNoteText?.includes('36.3% bullish') && conflictNoteText.includes('AAII Investor Sentiment Survey') && conflictNoteText.includes('(36.3 − 20) ÷ 30 × 100 = 54/100') && conflictNoteText.includes('neutral 40–64 band') && conflictNoteText.includes('majority')), conflictNoteText || 'no explanation text');
                        runCheck(scenario.checks, 'AAII explanation shows weighted contribution', Boolean(conflictNoteText?.includes('54/100 × 20% configured weight = 10.8 weighted points')), conflictNoteText || 'no explanation text');
                        const stacking = await conflictNote.evaluate((note) => {
                            const noteBox = note.getBoundingClientRect();
                            const coveredControls = [...document.querySelectorAll('[data-testid="conflict-explanation"]:not([open]) > summary')]
                                .map((control) => control.getBoundingClientRect())
                                .map((controlBox) => ({
                                    left: Math.max(noteBox.left, controlBox.left),
                                    right: Math.min(noteBox.right, controlBox.right),
                                    top: Math.max(noteBox.top, controlBox.top),
                                    bottom: Math.min(noteBox.bottom, controlBox.bottom),
                                }))
                                .filter((overlap) => overlap.right > overlap.left && overlap.bottom > overlap.top);
                            const allCovered = coveredControls.every((overlap) => {
                                const topElement = document.elementFromPoint((overlap.left + overlap.right) / 2, (overlap.top + overlap.bottom) / 2);
                                return Boolean(topElement && note.contains(topElement));
                            });
                            return { overlapCount: coveredControls.length, allCovered };
                        });
                        runCheck(scenario.checks, 'open explanation covers underlying info controls', stacking.overlapCount > 0 && stacking.allCovered, JSON.stringify(stacking));
                        runCheck(
                            scenario.checks,
                            'conflict explanation stays within viewport',
                            Boolean(conflictNoteBox && conflictNoteBox.x >= 0 && conflictNoteBox.x + conflictNoteBox.width <= viewport.width),
                            conflictNoteBox ? JSON.stringify(conflictNoteBox) : 'explanation is not visible',
                        );
                        await conflictDisclosure.locator('summary').click();
                    }

                    const socialConflict = page.locator('[data-testid="conflict-explanation"][data-driver="social"]:visible').first();
                    if (await socialConflict.count() > 0) {
                        await socialConflict.locator('summary').click();
                        const socialText = await socialConflict.locator('[role="note"]').textContent();
                        runCheck(scenario.checks, 'zero social reading is distinguished from source off', Boolean(socialText?.includes('(0.00 + 1) × 50 = 50/100') && socialText.includes('active balanced reading, not “off”') && socialText.includes('Reddit and StockTwits')), socialText || 'no social explanation text');
                        await socialConflict.locator('summary').click();
                    }

                    const putCallConflict = page.locator('[data-testid="conflict-explanation"][data-driver="put_call"]:visible').first();
                    if (await putCallConflict.count() > 0) {
                        await putCallConflict.locator('summary').click();
                        const putCallNote = putCallConflict.locator('[role="note"]');
                        const putCallNoteBox = await putCallNote.boundingBox();
                        const putCallControlBox = await putCallConflict.locator('summary').boundingBox();
                        const putCallText = await putCallNote.textContent();
                        runCheck(scenario.checks, 'put-call explanation shows source and inverse conversion', Boolean(putCallText?.includes('0.93 put/call') && putCallText.includes('Cboe, a major US options exchange') && putCallText.includes('Total market put/call ratio') && putCallText.includes('(1.25 − 0.93) ÷ 0.70 × 100 = 46/100') && putCallText.includes('neutral 40–64 band')), putCallText || 'no put-call explanation text');
                        runCheck(scenario.checks, 'put-call explanation shows weighted contribution', Boolean(putCallText?.includes('46/100 × 10% configured weight = 4.6 weighted points')), putCallText || 'no put-call explanation text');
                        runCheck(
                            scenario.checks,
                            'last-row explanation opens above its control',
                            Boolean(putCallNoteBox && putCallControlBox && putCallNoteBox.y + putCallNoteBox.height <= putCallControlBox.y),
                            JSON.stringify({ note: putCallNoteBox, control: putCallControlBox }),
                        );
                        await putCallConflict.locator('summary').click();
                    }

                    await conflictDisclosure.locator('summary').click();

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
                await page.waitForFunction(() => !document.querySelector('section[aria-labelledby="drivers-title"]')?.textContent?.includes('News Sentiment'), undefined, { timeout: timeoutMs });
                const quickReadText = await page.locator('[aria-label="Quick read"]:visible').textContent();
                runCheck(scenario.checks, 'source toggle changes request state', await sourceCheckbox.isChecked() === !before, `${before} -> ${await sourceCheckbox.isChecked()}`);
                runCheck(scenario.checks, 'disabled source is absent from score drivers', !await page.locator('section[aria-labelledby="drivers-title"]').textContent().then((text) => text?.includes('News Sentiment')), 'News Sentiment should be excluded when its source is off');
                const coverageText = await page.locator('[data-testid="coverage-adjustment"]').textContent();
                runCheck(scenario.checks, 'disabled source becomes neutral reserve instead of reweighting', Boolean(coverageText?.includes('35% configured weight') && coverageText.includes('neutral reserve (65% × 50)') && coverageText.includes('not redistributed')), coverageText || 'coverage explanation is missing');
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
