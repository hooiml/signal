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
        aaii: fixtureComponent({ name: 'aaii', displayName: 'AAII', value: 36.3, score: 54, weight: market === 'US' ? 0.2 : 0.1, signal: 'neutral', updatedAt: '2026-06-01T08:00:00.000Z' }),
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
        { key: 'aaii', name: components.aaii.display_name, impact: 'negative', contribution: components.aaii.score * components.aaii.weight, score: components.aaii.score, weight: components.aaii.weight, raw_value: components.aaii.value, last_updated: components.aaii.last_updated, detail: 'AAII does not fully confirm the majority read.' },
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
            signal_quality: { freshness: 'mixed', source_coverage: 'strong', noise_level: 'moderate', market_regime: 'constructive', warnings: ['AAII data is stale.'] },
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
            historical_validation: {
                benchmark_symbol: market === 'US' ? 'VOO' : 'FBM KLCI',
                benchmark_name: market === 'US' ? 'Vanguard S&P 500 ETF' : 'FTSE Bursa Malaysia KLCI',
                mode, snapshot_count: 18, observed_snapshot_count: 12, reconstructed_snapshot_count: 6,
                minimum_sample_size: 5, directional_sample_size: 20,
                reconstruction_note: 'Earlier scores are reconstructed with the current model from stored VIX and social sentiment.',
                horizons: [7, 30].map((days) => ({ days, cohorts: [
                    { zone: 'negative', label: '0–39', sample_count: 2, average_forward_return_pct: -1.2, alignment_rate_pct: 50 },
                    { zone: 'mixed', label: '40–64', sample_count: 4, average_forward_return_pct: 0.4, alignment_rate_pct: null },
                    { zone: 'positive', label: '65–84', sample_count: 7, average_forward_return_pct: days === 7 ? 1.8 : 3.2, alignment_rate_pct: 71 },
                    { zone: 'strong-positive', label: '85–100', sample_count: 5, average_forward_return_pct: 2.4, alignment_rate_pct: 80 },
                ].map((cohort) => ({
                    ...cohort,
                    observed_count: Math.max(0, cohort.sample_count - 2),
                    reconstructed_count: Math.min(2, cohort.sample_count),
                    median_forward_return_pct: cohort.average_forward_return_pct,
                    positive_return_rate_pct: cohort.alignment_rate_pct ?? 50,
                    worst_forward_return_pct: (cohort.average_forward_return_pct ?? 0) - 1.5,
                    best_forward_return_pct: (cohort.average_forward_return_pct ?? 0) + 2.5,
                    evidence_level: cohort.sample_count < 5 ? 'insufficient' : cohort.sample_count < 20 ? 'preliminary' : 'established',
                })) })),
                limitation: 'Historical forward returns are overlapping observations without transaction costs. They calibrate prior signal interpretation and do not predict future returns.',
            },
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

const discoveryCandidateFixture = (overrides) => ({
    symbol: 'MSFT', name: 'Microsoft', price: 425, momentum3MonthPercent: 18, momentum6MonthPercent: 28,
    distanceFromMa50Percent: 7, averageDollarVolume: 1_000_000_000, volumeSpikeRatio: 1.2,
    maxDailyMovePercent: 4, annualizedVolatilityPercent: 24, aboveMa50: true, aboveMa200: true,
    trendScore: 86, riskScore: 18, risk: 'moderate', reasons: ['Sustained trend'], flags: [],
    qualityScore: 88, discoveryScore: 87, category: 'quality compounder', qualityReasons: ['Positive free cash flow'],
    sector: 'Technology', sectorRelativeStrengthPercent: 5.2, scoreChange1Day: 2, scoreChange1Week: 4,
    scoreChange1Month: null, rankChange1Week: 4, firstSeenAt: '2026-07-01T00:00:00.000Z', earlyTrendStage: 'confirmed',
    valuation: { guardrail: 'expensive', priceEarnings: 31, priceSales: 10, freeCashFlowYieldPercent: 2.8 },
    catalyst: { date: '2026-07-28', type: 'earnings', timing: 'after-hours', fiscalQuarterEnding: 'Jun/2026', epsForecast: '3.12', source: 'Nasdaq earnings calendar' },
    ownership: null,
    ...overrides,
});

const buildDiscoveryFixture = () => ({ success: true, data: {
    generatedAt: '2026-07-17T08:00:00.000Z', universeSize: 40, scannedCount: 40,
    candidates: [
        discoveryCandidateFixture({}),
        discoveryCandidateFixture({ symbol: 'AMD', name: 'Advanced Micro Devices', price: 180, discoveryScore: 82, risk: 'low', riskScore: 8, valuation: { guardrail: 'fair', priceEarnings: 25, priceSales: 8, freeCashFlowYieldPercent: 3.2 }, catalyst: null }),
    ],
    contenders: [], emergingCandidates: [],
    performance: [
        { period: '1D', averageReturnPercent: 1.2, trackedCount: 2, winnerCount: 2 },
        { period: '1W', averageReturnPercent: null, trackedCount: 0, winnerCount: 0 },
        { period: '1M', averageReturnPercent: null, trackedCount: 0, winnerCount: 0 },
    ],
    historySnapshotCount: 5, warnings: [],
} });

const inspectScoreEvidence = async (page) => page.evaluate(() => {
    const ids = ['changed-title', 'score-evidence-title', 'market-calibration-title', 'scenarios-title', 'context-title', 'market-alerts-title', 'terms-title'];
    const elements = ids.map((id) => document.getElementById(id));
    const orderIsCorrect = elements.every(Boolean) && elements.every((element, index) => (
        index === elements.length - 1
        || Boolean(element.compareDocumentPosition(elements[index + 1]) & Node.DOCUMENT_POSITION_FOLLOWING)
    ));
    const scoreSection = document.querySelector('section[aria-labelledby="score-evidence-title"]');
    const valuation = document.querySelector('[data-testid="valuation-backdrop"]');
    const marketContext = document.querySelector('[data-testid="market-context"]');
    const coverageAdjustment = document.querySelector('[data-testid="coverage-adjustment"]');
    const handoff = document.querySelector('[data-testid="market-research-handoff"]');
    const handoffLink = handoff?.querySelector('a');
    const calibration = document.querySelector('[data-testid="market-calibration"]');
    const storyTrust = document.querySelector('[data-testid="market-story-trust"]');
    const storyEvidence = document.querySelector('[data-testid="market-story-evidence"]');
    const storyCards = storyEvidence ? [...storyEvidence.querySelectorAll('article')] : [];
    const contributionFormulas = storyEvidence ? [...storyEvidence.querySelectorAll('[data-testid="market-story-contribution-formula"]')] : [];
    const relationships = storyEvidence ? [...storyEvidence.querySelectorAll('[data-testid="market-story-relationship"]')] : [];
    const freshnessWarnings = storyEvidence ? [...storyEvidence.querySelectorAll('[data-testid="market-story-freshness-warning"]')] : [];
    const primarySurfaces = [...document.querySelectorAll('[data-surface-tier="primary"]')];
    const secondarySurfaces = [...document.querySelectorAll('[data-surface-tier="secondary"]')];
    const utilitySurfaces = [...document.querySelectorAll('[data-surface-tier="utility"]')];
    const actionSurfaces = [...document.querySelectorAll('[data-surface-tier="action"]')];
    const changeSummaryLabels = [...document.querySelectorAll('[data-testid="change-summary-label"]')];
    const changeSummaryValues = [...document.querySelectorAll('[data-testid="change-summary-value"]')];
    const supportingSection = document.querySelector('[aria-label="Forward scenarios and market developments"]');
    const termsSection = document.querySelector('section[aria-labelledby="terms-title"]');
    const commandText = document.querySelector('[aria-label="Market briefing controls"]')?.textContent || '';
    const evidenceBounds = storyEvidence?.getBoundingClientRect();
    return {
        orderIsCorrect,
        scoreBridgeConnected: Boolean(storyTrust?.textContent?.includes('Composite score') && storyEvidence?.textContent?.includes('Strongest influence')),
        quickReadAbsent: !document.body.textContent?.includes('Quick read'),
        scoreSectionVisible: Boolean(scoreSection && scoreSection.getBoundingClientRect().height > 0),
        driverHeadingVisible: Boolean(document.getElementById('drivers-title')?.getBoundingClientRect().height),
        oldDisclosureAbsent: !document.body.textContent?.includes('Explore charts and weighted evidence'),
        valuationCollapsed: valuation ? !valuation.hasAttribute('open') : null,
        marketContextCollapsed: marketContext ? !marketContext.hasAttribute('open') : null,
        coverageText: coverageAdjustment?.textContent || '',
        driverTableText: document.querySelector('section[aria-labelledby="drivers-title"]')?.textContent || '',
        handoffText: handoff?.textContent || '',
        handoffHref: handoffLink?.getAttribute('href') || '',
        calibrationText: calibration?.textContent || '',
        storyTrustText: storyTrust?.textContent || '',
        storyEvidenceText: storyEvidence?.textContent || '',
        storyTrustOverflow: storyTrust ? storyTrust.scrollWidth - storyTrust.clientWidth : null,
        storyEvidenceOverflow: storyEvidence ? storyEvidence.scrollWidth - storyEvidence.clientWidth : null,
        storyCardsContained: Boolean(evidenceBounds && storyCards.length === 3 && storyCards.every((card) => {
            const bounds = card.getBoundingClientRect();
            return bounds.left >= evidenceBounds.left - 1 && bounds.right <= evidenceBounds.right + 1 && bounds.width > 0 && bounds.height > 0;
        })),
        storyAuditMathAbsent: contributionFormulas.length === 0 && !storyEvidence?.textContent?.includes('configured weight'),
        storyCardsFlattened: storyCards.length === 3 && storyCards.every((card) => Number.parseFloat(getComputedStyle(card).borderRadius) === 0),
        storyTextHierarchy: storyCards.length === 3
            && relationships.length === 3
            && freshnessWarnings.length === 1
            && freshnessWarnings[0]?.textContent?.includes('Freshness: Stale')
            && storyCards.every((card, index) => {
                const primaryColor = getComputedStyle(card.querySelector('h2')).color;
                return getComputedStyle(relationships[index]).color !== primaryColor;
            }),
        supportingSectionsFlattened: Boolean(supportingSection && termsSection)
            && Number.parseFloat(getComputedStyle(supportingSection).borderRadius) === 0
            && Number.parseFloat(getComputedStyle(termsSection).borderRadius) === 0,
        commandText,
        pageSurfaceHierarchy: primarySurfaces.length === 2
            && secondarySurfaces.length >= 4
            && utilitySurfaces.length >= 5
            && actionSurfaces.length === 1
            && getComputedStyle(primarySurfaces[0]).backgroundColor !== getComputedStyle(secondarySurfaces[0]).backgroundColor
            && getComputedStyle(secondarySurfaces[0]).backgroundColor !== getComputedStyle(utilitySurfaces[0]).backgroundColor
            && getComputedStyle(primarySurfaces[0]).boxShadow !== 'none'
            && getComputedStyle(primarySurfaces[0]).boxShadow !== getComputedStyle(utilitySurfaces[0]).boxShadow
            && utilitySurfaces[0].classList.contains('shadow-none')
            && getComputedStyle(actionSurfaces[0]).borderColor !== getComputedStyle(secondarySurfaces[0]).borderColor,
        pageSurfaceCounts: {
            primary: primarySurfaces.length,
            secondary: secondarySurfaces.length,
            utility: utilitySurfaces.length,
            action: actionSurfaces.length,
        },
        pageSurfaceStyles: Object.fromEntries([
            ['primary', primarySurfaces[0]],
            ['secondary', secondarySurfaces[0]],
            ['utility', utilitySurfaces[0]],
            ['action', actionSurfaces[0]],
        ].map(([tier, element]) => [tier, element ? {
            backgroundColor: getComputedStyle(element).backgroundColor,
            borderColor: getComputedStyle(element).borderColor,
            boxShadow: getComputedStyle(element).boxShadow,
        } : null])),
        changeSummaryAligned: window.innerWidth < 1024 || (
            changeSummaryLabels.length === 4
            && changeSummaryValues.length === 4
            && Math.max(...changeSummaryLabels.map((element) => element.getBoundingClientRect().top)) - Math.min(...changeSummaryLabels.map((element) => element.getBoundingClientRect().top)) <= 1
            && Math.max(...changeSummaryValues.map((element) => element.getBoundingClientRect().top)) - Math.min(...changeSummaryValues.map((element) => element.getBoundingClientRect().top)) <= 1
        ),
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
        let signalResponseMode = 'success';

        if (!useLiveData) {
            await page.route('**/api/signals/v2?**', async (route) => {
                if (signalResponseMode === 'failure') {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Deterministic refresh failure.' }) });
                    return;
                }
                const signal = buildFixtureSignal(route.request().url());
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: signal }) });
            });
            await page.route('**/api/research/**', async (route) => {
                const url = new URL(route.request().url());
                if (url.pathname === '/api/research/watchlist' && route.request().method() === 'GET') {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [], archivedSymbols: [] }) });
                    return;
                }
                if (url.pathname === '/api/research/inbox') {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { generatedAt: '2026-07-17T08:00:00.000Z', monitoredCount: 0, items: [], warnings: [] } }) });
                    return;
                }
                if (url.pathname === '/api/research/discovery') {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildDiscoveryFixture()) });
                    return;
                }
                await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Deterministic QA route: live research data omitted.' }) });
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
                    runCheck(scenario.checks, 'desktop Quick Read duplication is removed', details.quickReadAbsent, JSON.stringify(details));
                    runCheck(scenario.checks, 'market story exposes trust context', details.storyTrustText.includes('Composite score') && details.storyTrustText.includes('Indicator agreement') && details.storyTrustText.includes('Data freshness') && details.storyTrustText.includes('Briefing as of'), details.storyTrustText);
                    runCheck(scenario.checks, 'market story keeps readings without audit math', details.storyEvidenceText.includes('16.20') && details.storyEvidenceText.includes('36.3% bullish') && details.storyEvidenceText.includes('0.00 sentiment') && details.storyAuditMathAbsent, details.storyEvidenceText);
                    runCheck(scenario.checks, 'market story uses ranked evidence roles', details.storyEvidenceText.includes('Strongest influence') && details.storyEvidenceText.includes('Conflicting signal') && !details.storyEvidenceText.includes('Evidence chapter'), details.storyEvidenceText);
                    runCheck(scenario.checks, 'market story cards fit their container', details.storyCardsContained && details.storyTrustOverflow <= 1 && details.storyEvidenceOverflow <= 1, JSON.stringify({ storyCardsContained: details.storyCardsContained, storyTrustOverflow: details.storyTrustOverflow, storyEvidenceOverflow: details.storyEvidenceOverflow }));
                    runCheck(scenario.checks, 'market story uses divider-led driver groups', details.storyCardsFlattened, JSON.stringify({ storyCardsFlattened: details.storyCardsFlattened }));
                    runCheck(scenario.checks, 'market story freshness warning is visible text', details.storyTextHierarchy, JSON.stringify({ storyTextHierarchy: details.storyTextHierarchy }));
                    runCheck(scenario.checks, 'lower-priority supporting sections are unboxed', details.supportingSectionsFlattened, JSON.stringify({ supportingSectionsFlattened: details.supportingSectionsFlattened }));
                    runCheck(scenario.checks, 'briefing header separates briefing date and availability', details.commandText.includes('Briefing as of') && details.commandText.includes('Briefing available'), details.commandText);
                    runCheck(scenario.checks, 'main page uses distinct primary, secondary, utility, and action surfaces', details.pageSurfaceHierarchy, JSON.stringify({ counts: details.pageSurfaceCounts, styles: details.pageSurfaceStyles }));
                    runCheck(scenario.checks, 'what changed summary labels and values align', details.changeSummaryAligned, JSON.stringify({ changeSummaryAligned: details.changeSummaryAligned }));
                    runCheck(scenario.checks, 'document has no horizontal overflow', details.documentOverflow <= 1, `${details.documentOverflow}px overflow`);
                    runCheck(scenario.checks, 'secondary context starts collapsed', details.valuationCollapsed !== false && details.marketContextCollapsed !== false, JSON.stringify(details));
                    runCheck(scenario.checks, 'market-to-research handoff is evidence-only', details.handoffText.includes('Carry this market context into Research') && details.handoffText.includes('does not change any ticker decision'), details.handoffText);
                    runCheck(scenario.checks, 'market-to-research handoff carries validated context', details.handoffHref.includes('/research?') && details.handoffHref.includes('contextMarket=US') && details.handoffHref.includes('contextScore='), details.handoffHref);
                    runCheck(scenario.checks, 'historical calibration shows current-zone outcomes, provenance, and non-predictive limits', details.calibrationText.includes('What followed similar scores') && details.calibrationText.includes('Median return') && details.calibrationText.includes('Positive periods') && details.calibrationText.includes('5 observed') && details.calibrationText.includes('2 reconstructed') && details.calibrationText.includes('do not predict future returns'), shorten(details.calibrationText));

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
                        await page.locator('[data-testid="conflict-explanation"][open]').evaluateAll((elements) => elements.forEach((element) => element.removeAttribute('open')));
                        const screenshotPath = path.join(evidenceDir, `score-evidence-${viewport.name}-${viewport.width}x${viewport.height}.png`);
                        if (captureFullPage) await page.screenshot({ path: screenshotPath, fullPage: true });
                        else await page.locator('section[aria-labelledby="score-evidence-title"]').screenshot({ path: screenshotPath });
                        scenario.screenshot = screenshotPath;
                        const storyScreenshotPath = path.join(evidenceDir, `market-story-${viewport.name}-${viewport.width}x${viewport.height}.png`);
                        await page.locator('section[aria-labelledby="market-story-title"]').screenshot({ path: storyScreenshotPath });
                        scenario.storyScreenshot = storyScreenshotPath;
                    }

                    await page.locator('[data-testid="market-research-handoff"] a').click();
                    await page.locator('[data-testid="research-market-context"]').waitFor({ state: 'visible', timeout: timeoutMs });
                    const researchHandoff = await page.locator('[data-testid="research-market-context"]').evaluate((element) => ({
                        text: element.textContent || '',
                        overflow: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth,
                    }));
                    runCheck(scenario.checks, 'research receives visible market context', page.url().includes('/research?') && researchHandoff.text.includes('Market context · evidence only') && researchHandoff.text.includes('score '), shorten(researchHandoff.text));
                    runCheck(scenario.checks, 'research context keeps security decisions independent', researchHandoff.text.includes('independent') || researchHandoff.text.includes('evidence only'), shorten(researchHandoff.text));
                    runCheck(scenario.checks, 'research handoff has no horizontal overflow', researchHandoff.overflow <= 1, `${researchHandoff.overflow}px overflow`);
                    if (captureScreenshots) {
                        const handoffScreenshotPath = path.join(evidenceDir, `market-research-handoff-${viewport.name}-${viewport.width}x${viewport.height}.png`);
                        await page.locator('[data-testid="research-market-context"]').screenshot({ path: handoffScreenshotPath });
                        scenario.handoffScreenshot = handoffScreenshotPath;
                    }

                    await page.locator('[data-testid="research-market-context"] button').click();
                    const journal = page.locator('[data-testid="research-decision-journal"]');
                    const journalToggle = journal.getByTestId('research-journal-toggle');
                    runCheck(scenario.checks, 'research journal starts collapsed', await journalToggle.getAttribute('aria-expanded') === 'false' && await journal.getByRole('heading', { name: 'Thesis and triggers' }).count() === 0, 'expected collapsed read-only details');
                    await journalToggle.click();
                    await journal.getByRole('heading', { name: 'Thesis and triggers' }).waitFor({ state: 'visible', timeout: timeoutMs });
                    runCheck(scenario.checks, 'research journal disclosure expands', await journalToggle.getAttribute('aria-expanded') === 'true', 'expected expanded read-only details');
                    await journal.getByRole('button', { name: 'Submit review' }).click();
                    const decisionRecord = journal.getByRole('group', { name: 'Decision record' });
                    await decisionRecord.waitFor({ state: 'visible', timeout: timeoutMs });
                    const decisionText = await decisionRecord.textContent();
                    runCheck(scenario.checks, 'decision journal captures review context', Boolean(decisionText?.includes('Calculated decision') && decisionText.includes('Confidence') && decisionText.includes('Observed price') && decisionText.includes('Next review date')), shorten(decisionText));
                    await decisionRecord.getByLabel('Confidence').selectOption('high');
                    await decisionRecord.getByLabel('Next review date').fill('2026-08-15');
                    runCheck(scenario.checks, 'decision journal accepts confidence and review date', await decisionRecord.getByLabel('Confidence').inputValue() === 'high' && await decisionRecord.getByLabel('Next review date').inputValue() === '2026-08-15', 'expected high confidence and 2026-08-15');
                    const positionPlan = journal.getByRole('group', { name: 'Position plan' });
                    await positionPlan.getByLabel('Planned allocation %').fill('10');
                    await positionPlan.getByLabel('Planned entry price').fill('100');
                    await positionPlan.getByLabel('Invalidation price').fill('90');
                    const positionPlanText = await positionPlan.textContent();
                    runCheck(scenario.checks, 'position plan calculates bounded portfolio risk', Boolean(positionPlanText?.includes('10.0% downside') && positionPlanText.includes('1.00% of portfolio at risk')), shorten(positionPlanText));
                    const overviewText = await page.locator('[data-testid="position-plan-overview"]').textContent();
                    runCheck(scenario.checks, 'position overview stays explicitly planning-only', Boolean(overviewText?.includes('Position plan overview') && overviewText.includes('No brokerage balances, transactions, or automatic orders')), shorten(overviewText));
                    const journalOverflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth);
                    runCheck(scenario.checks, 'decision journal has no horizontal overflow', journalOverflow <= 1, `${journalOverflow}px overflow`);
                    await journal.getByRole('button', { name: 'Cancel' }).click();
                    runCheck(scenario.checks, 'cancel returns journal to collapsed summary', await journal.getByTestId('research-journal-toggle').getAttribute('aria-expanded') === 'false', 'expected collapsed summary after cancel');

                    const overviewPanel = page.getByTestId('research-tab-panel');
                    const overviewPanelHeight = (await overviewPanel.boundingBox())?.height ?? 0;
                    await page.getByRole('tab', { name: 'Fundamentals' }).click();
                    const fundamentalsPanel = page.getByTestId('research-tab-panel');
                    await fundamentalsPanel.waitFor({ state: 'visible', timeout: timeoutMs });
                    const fundamentalsPanelHeight = (await fundamentalsPanel.boundingBox())?.height ?? 0;
                    if (viewport.width >= 700) {
                        runCheck(scenario.checks, 'research tabs keep a stable viewport height', Math.abs(overviewPanelHeight - fundamentalsPanelHeight) <= 1 && overviewPanelHeight === 680, `${overviewPanelHeight}px overview; ${fundamentalsPanelHeight}px fundamentals`);
                    } else {
                        const mobileOverflow = await fundamentalsPanel.evaluate((element) => getComputedStyle(element).overflowY);
                        runCheck(scenario.checks, 'research tabs retain natural mobile document flow', mobileOverflow === 'visible', `overflow-y: ${mobileOverflow}`);
                    }
                    await page.getByRole('tab', { name: 'Overview' }).click();

                    await page.evaluate(() => localStorage.setItem('signal-discovery-visit-v1', JSON.stringify({
                        version: 1,
                        capturedAt: '2026-07-16T08:00:00.000Z',
                        candidates: [{ symbol: 'MSFT', rank: 5, score: 70, risk: 'low', valuation: 'fair', catalystDate: null }],
                    })));
                    await page.goto(new URL('/research?workspace=discovery', baseUrl).toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs });
                    const changeFeed = page.locator('[data-testid="discovery-change-feed"]');
                    await changeFeed.waitFor({ state: 'visible', timeout: timeoutMs });
                    const changeText = await changeFeed.textContent();
                    runCheck(scenario.checks, 'Discovery explains changes since last visit', Boolean(changeText?.includes('AMD') && changeText.includes('Entered the ranked list') && changeText.includes('MSFT') && changeText.includes('Moved up 4 places')), shorten(changeText));
                    await page.getByLabel('Filter by risk').selectOption('low');
                    await page.getByLabel('Discovery view name').fill('Low risk');
                    await page.getByRole('button', { name: 'Save current' }).click();
                    await page.reload({ waitUntil: 'domcontentloaded', timeout: timeoutMs });
                    await page.getByLabel('Apply saved Discovery view').waitFor({ state: 'visible', timeout: timeoutMs });
                    runCheck(scenario.checks, 'Discovery saved view survives reload', await page.getByLabel('Apply saved Discovery view').locator('option', { hasText: 'Low risk' }).count() === 1, 'expected Low risk saved option');
                    await page.getByLabel('Apply saved Discovery view').selectOption('low-risk');
                    runCheck(scenario.checks, 'Discovery saved view restores filters', await page.getByLabel('Filter by risk').inputValue() === 'low', await page.getByLabel('Filter by risk').inputValue());
                    await page.getByRole('button', { name: 'Delete saved view Low risk' }).click();
                    runCheck(scenario.checks, 'Discovery saved view can be removed', await page.getByLabel('Apply saved Discovery view').locator('option', { hasText: 'Low risk' }).count() === 0, 'Low risk option should be absent');
                    await page.evaluate(() => {
                        const nextUrl = new URL(window.location.href);
                        nextUrl.searchParams.set('qa', 'preserve');
                        window.history.replaceState({ ...window.history.state, as: nextUrl.pathname + nextUrl.search, url: nextUrl.pathname + nextUrl.search }, '', nextUrl.pathname + nextUrl.search);
                    });
                    await page.getByRole('tab', { name: 'Watchlist', exact: true }).click();
                    await page.waitForURL(/workspace=research/, { timeout: timeoutMs });
                    const watchlistUrl = new URL(page.url());
                    runCheck(scenario.checks, 'workspace navigation preserves query context', watchlistUrl.searchParams.get('workspace') === 'research' && watchlistUrl.searchParams.get('qa') === 'preserve', watchlistUrl.toString());
                    await page.getByRole('tab', { name: 'Discovery', exact: true }).click();
                    await page.waitForURL(/workspace=discovery/, { timeout: timeoutMs });
                    const discoveryOverflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0) - window.innerWidth);
                    runCheck(scenario.checks, 'Discovery change feed and saved views have no horizontal overflow', discoveryOverflow <= 1, `${discoveryOverflow}px overflow`);
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
                runCheck(scenario.checks, 'source toggle changes request state', await sourceCheckbox.isChecked() === !before, `${before} -> ${await sourceCheckbox.isChecked()}`);
                runCheck(scenario.checks, 'disabled source is absent from score drivers', !await page.locator('section[aria-labelledby="drivers-title"]').textContent().then((text) => text?.includes('News Sentiment')), 'News Sentiment should be excluded when its source is off');
                const coverageText = await page.locator('[data-testid="coverage-adjustment"]').textContent();
                runCheck(scenario.checks, 'disabled source becomes neutral reserve instead of reweighting', Boolean(coverageText?.includes('35% configured weight') && coverageText.includes('neutral reserve (65% × 50)') && coverageText.includes('not redistributed')), coverageText || 'coverage explanation is missing');
                const scoreBridgeText = `${await page.locator('[data-testid="market-story-trust"]').textContent()} ${await page.locator('section[aria-labelledby="drivers-title"]').textContent()}`;
                runCheck(scenario.checks, 'score bridge remains connected after controls', scoreBridgeText.includes('Composite score') && scoreBridgeText.includes('configured weight'), shorten(scoreBridgeText));

                signalResponseMode = 'failure';
                await page.getByRole('button', { name: /Refresh market briefing/ }).click();
                await page.waitForFunction(() => document.querySelector('[aria-label="Market briefing controls"]')?.textContent?.includes('Refresh failed'), undefined, { timeout: timeoutMs });
                const failedStatusText = await page.locator('[aria-label="Market briefing controls"]').textContent();
                runCheck(scenario.checks, 'failed refresh retains the previous briefing', Boolean(failedStatusText?.includes('Refresh failed') && failedStatusText.includes('Previous briefing retained') && failedStatusText.includes('Attempted') && await page.locator('#market-story-title').isVisible()), shorten(failedStatusText));
                signalResponseMode = 'success';
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
