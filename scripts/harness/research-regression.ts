import { getResearchAction } from '../../src/lib/research/decision';
import { parsePersistedResearchMonitoringRules, parseResearchCreateInput, parseResearchExpectedRevision, parseResearchRecord, parseResearchUpdateInput, parseResearchUpdateMode } from '../../src/lib/research/input';
import { appendQuickReviewNote, appendResearchReview, applyResearchUpdate, calculateResearchDecision, createResearchRecord, describeReviewChanges, latestReviewChanges, prepareStoredResearchRecord } from '../../src/lib/research/records';
import { defaultResearchMonitoringRules } from '../../src/lib/types/research';
import { calculateTechnicals } from '../../src/lib/research/technicals';
import { buildTechnicalOutlook } from '../../src/lib/research/technical-outlook';
import { calculateTechnicalSeries } from '../../src/lib/research/technical-series';
import { anchoredVwap, relativeStrengthSeries, volumeProfile } from '../../src/lib/research/chart-analysis';
import { parseYahooResearchChart, toYahooSymbol } from '../../src/lib/research/yahoo-research';
import { calculateValuation } from '../../src/lib/research/valuation';
import { scoreDiscoveryCandidate } from '../../src/lib/research/discovery-score';
import { evaluateResearchAlerts, parseBuyZone } from '../../src/lib/research/alerts';
import { evaluateResearchStructuredTriggers, parseResearchStructuredTriggerSet } from '../../src/lib/research/structured-triggers';
import { evaluateMarketAlert, getMarketAlertRulesForBriefing, parseMarketAlertRules, type MarketAlertRule } from '../../src/lib/market-alerts';
import { scoreDiscoveryQuality } from '../../src/lib/research/discovery-quality';
import { parseSecCompanyFacts } from '../../src/lib/research/sec-edgar';
import { parseYahooFundamentalTimeseries } from '../../src/lib/research/yahoo-fundamentals';
import { calculateCohortPerformance, calculateHistorySignals } from '../../src/lib/research/discovery-history';
import {
    addPickerRun,
    createPickerRun,
    parsePickerConfig,
    parsePickerRuns,
    pickerCohortEvidence,
    pickerObservedMovePercent,
    pickerRunSummary,
    removePickerRun,
    resolvePickerRuns,
    selectPickerCandidates,
} from '../../src/lib/research/picker';
import { sectorRelativeStrength } from '../../src/lib/research/discovery-sectors';
import { classifyEarlyTrend, classifyValuation } from '../../src/lib/research/discovery-opportunity';
import { describeContender, rankDiscoveryTiers } from '../../src/lib/research/discovery-ranking';
import { filterDiscoveryCandidates } from '../../src/lib/research/discovery-filters';
import { parseNasdaqInstitutionalHoldings } from '../../src/lib/research/institutional-ownership';
import { buildComparisonMetrics } from '../../src/lib/research/comparison';
import { buildResearchBenchmark, notApplicableResearchBenchmark } from '../../src/lib/research/benchmark';
import type { ResearchSnapshot } from '../../src/lib/types/research-snapshot';
import { parseResearchChartResponse, parseResearchSnapshotResponse } from '../../src/lib/research/snapshot-input';
import { buildEvidenceFindings, buildResearchEvidence } from '../../src/lib/research/assistant';
import { parseResearchAssistantResponse } from '../../src/lib/research/assistant-input';
import { buildResearchInboxItems } from '../../src/lib/research/inbox';
import { parseResearchInboxResponse } from '../../src/lib/research/inbox-input';
import { inboxItemChange, inboxItemSignature, parseInboxState, snapshotInboxItems } from '../../src/lib/research/inbox-state';
import { buildResearchHandoffHref, getMarketResearchEmphasis, parseMarketResearchHandoff, type MarketResearchHandoff } from '../../src/lib/market-research-handoff';
import { buildResearchNotificationDigest, deliverResearchNotification, executeResearchNotificationDelivery, filterResearchNotificationItems, researchNotificationDigestKey, signResearchNotification, validateNotificationEndpoint } from '../../src/lib/research/notification-delivery';
import { compareDiscoveryVisits, parseSavedDiscoveryViews, removeSavedDiscoveryView, upsertSavedDiscoveryView, type DiscoveryVisitSnapshot } from '../../src/lib/research/discovery-workspace';
import { calculatePositionPlanRisk, calculateSectorConcentration } from '../../src/lib/research/position-plan';
import { buildResearchCalendar, filterResearchCalendarEvents, getResearchCalendar } from '../../src/lib/research/calendar';
import { parseResearchCalendarInputs, parseResearchCalendarQuery } from '../../src/lib/research/calendar-input';
import { parseResearchCalendarResponse } from '../../src/lib/research/calendar-response';
import { calendarDateChanges, mergeResearchCalendarDateState, parseResearchCalendarDateState, snapshotResearchCalendarDates } from '../../src/lib/research/calendar-state';
import {
    buildResearchMacroEvents,
    parseBlsCalendarIcs,
    parseDosmReleaseCalendar,
    parseFomcCalendarHtml,
} from '../../src/lib/research/macro-calendar';
import { buildResearchRelativeUrl, mergeResearchSearchParams, resolveVisibleResearchSymbol } from '../../src/lib/research/url-state';
import { nextHorizontalTabIndex } from '../../src/lib/research/tab-navigation';
import { researchWorkspaceGroupFor, researchWorkspaceGroups } from '../../src/lib/research/workspace-navigation';
import {
    buildResearchVisitSnapshot,
    buildSinceLastVisitBriefing,
    buildSinceLastVisitChanges,
    parseResearchVisitSnapshot,
} from '../../src/lib/research/since-last-visit';
import {
    parseSinceLastVisitAlerts,
    parseSinceLastVisitMarket,
    parseSinceLastVisitSourceIssues,
} from '../../src/lib/research/since-last-visit-input';
import {
    getResearchStrategyTemplate,
    researchStrategyTemplateIds,
    researchStrategyTemplates,
} from '../../src/lib/research/research-strategy-templates';
import { buildResearchOutcomeAnalytics } from '../../src/lib/research/outcome-analytics';
import { buildPortfolioMarketAnalytics, buildPortfolioScenarios, buildPortfolioSummary } from '../../src/lib/research/portfolio-analytics';
import {
    buildCanonicalPortfolioCsvTemplate,
    buildPortfolioActualSummary,
    createPortfolioImportSnapshot,
    escapeSpreadsheetCell,
    mergePortfolioHoldingsSnapshots,
    parsePortfolioCsv,
    parsePortfolioHoldingsSnapshot,
    portfolioActualWeightPercent,
    portfolioImportLimits,
    previewPortfolioImportEffect,
    reconcilePortfolioHoldings,
} from '../../src/lib/portfolio/holdings';
import {
    buildPortfolioSimulationExport,
    portfolioSimulationLimits,
    simulatePortfolioScenario,
    type PortfolioSimulationLegInput,
} from '../../src/lib/portfolio/simulation';
import { isResearchNotificationQuietHour, parseResearchNotificationSettings } from '../../src/lib/types/research-notification-settings';
import { buildPeerBenchmark } from '../../src/lib/research/peer-benchmark';
import { summarizeSourceHealth, type SourceHealthEntry } from '../../src/lib/types/source-health';
import { compareMarketReplaySnapshots, parseMarketReplayIndex, parseMarketReplaySnapshot, type MarketReplaySnapshot } from '../../src/lib/types/market-replay';
import { buildResearchDecisionPacket } from '../../src/lib/research/decision-packet';
import {
    appendProductAnalyticsEvent,
    buildProductAnalyticsSummary,
    parseProductAnalyticsState,
} from '../../src/lib/product-analytics';
import type { ProductAnalyticsEvent } from '../../src/lib/types/product-analytics';
import { buildMarketWatchlistExposure } from '../../src/lib/research/market-exposure';
import type { MarketSignal } from '../../src/lib/types/signal-v2';
import { buildThesisChangeItems, stageThesisChangeEvidence } from '../../src/lib/research/thesis-change';
import type { AssistedResearch } from '../../src/lib/types/research-assistant';
import { simulateMarketScore, tierForMarketScore } from '../../src/lib/market-sensitivity';
import { buildEvidenceCoverage } from '../../src/lib/research/evidence-coverage';
import {
    assessInvestmentPolicy,
    defaultInvestmentPolicy,
    parseInvestmentPolicy,
} from '../../src/lib/research/investment-policy';
import {
    calculateCurrencyPerformance,
    defaultCurrencyPerformanceSettings,
    parseCurrencyPerformanceSettings,
} from '../../src/lib/research/currency-performance';
import { buildEvidenceDocumentDiff } from '../../src/lib/research/evidence-document-diff';
import { buildResearchRelationshipGraph, relationshipsForSymbol } from '../../src/lib/research/relationship-graph';
import {
    applySavedPortfolioScenario,
    parseSavedPortfolioScenarios,
    portfolioScenarioLibraryLimit,
    removeSavedPortfolioScenario,
    upsertSavedPortfolioScenario,
    type SavedPortfolioScenario,
} from '../../src/lib/research/scenario-library';
import {
    addPaperDecision,
    buildDecisionReviewAnalytics,
    decisionReviewDueAt,
    decisionReviewHistoryKey,
    evaluatePaperDecision,
    paperDecisionLimit,
    paperDecisionMarketMovePercent,
    parsePaperDecisions,
    removePaperDecision,
    resolveDuePaperDecisions,
    resolvePaperDecision,
    type PaperDecision,
} from '../../src/lib/research/paper-decisions';
import {
    enqueueResearchWorkflowTask,
    getResearchWorkflowTemplate,
    parseResearchWorkflowTasks,
    sortResearchWorkflowTasks,
    upsertResearchWorkflowTask,
    type ResearchWorkflowTask,
} from '../../src/lib/research/workflow-queue';
import {
    applyDiscoveryUniversePolicy,
    defaultDiscoveryUniversePolicy,
    parseDiscoveryUniversePolicy,
    parseSavedDiscoveryUniverses,
    removeSavedDiscoveryUniverse,
    upsertSavedDiscoveryUniverse,
} from '../../src/lib/research/discovery-policy';
import type { QualityDiscoveryResult } from '../../src/lib/types/research-discovery';
import {
    buildResearchSyncPreview,
    decryptResearchBackup,
    encryptResearchBackup,
    parseResearchBackupPayload,
    parseResearchRestoreRequest,
    validateEncryptedResearchBackup,
} from '../../src/lib/research/backup';
import {
    authorizeResearchSyncBearer,
    parseResearchSyncWriteRequest,
} from '../../src/lib/research/sync-vault';
import {
    buildResearchNativeNotification,
    parseResearchNativeNotificationSettings,
    researchNativeNotificationDigest,
} from '../../src/lib/research/native-notifications';
import {
    parseResearchLayoutDensity,
    parseSavedResearchLayouts,
    removeSavedResearchLayout,
    researchLayoutWorkspaces,
    researchSavedLayoutLimit,
    upsertSavedResearchLayout,
    type SavedResearchLayout,
} from '../../src/lib/research/saved-layouts';

const assertEqual = <T>(actual: T, expected: T, label: string) => {
    if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
};

const assertThrows = (callback: () => void, label: string) => {
    try {
        callback();
    } catch (error) {
        if (error instanceof Error) return;
        throw error;
    }
    throw new Error(`${label}: expected an error`);
};

const assertRejects = async (callback: () => Promise<unknown>, label: string) => {
    try {
        await callback();
    } catch (error) {
        if (error instanceof Error) return;
        throw error;
    }
    throw new Error(`${label}: expected a rejection`);
};

const runResearchBackupTests = async () => {
    const record = {
        ...createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' }),
        notes: 'Encrypted thesis detail',
        revision: 7,
        updatedAt: '2026-07-25T08:00:00.000Z',
    };
    const encrypted = await encryptResearchBackup([record], 'correct horse battery staple', '2026-07-25T08:30:00.000Z');
    assertEqual(encrypted.includes('Encrypted thesis detail'), false, 'encrypted backup does not expose plaintext research');
    const decrypted = await decryptResearchBackup(encrypted, 'correct horse battery staple');
    assertEqual(decrypted.records[0]?.notes, record.notes, 'encrypted backup round-trips validated research');
    assertEqual(decrypted.exportedAt, '2026-07-25T08:30:00.000Z', 'encrypted backup preserves export time');
    await assertRejects(
        () => decryptResearchBackup(encrypted, 'incorrect passphrase'),
        'encrypted backup rejects the wrong passphrase',
    );
    assertThrows(
        () => parseResearchBackupPayload({ version: 1, exportedAt: '2026-07-25T08:30:00.000Z', records: [record, record] }),
        'backup parser rejects duplicate symbols',
    );
    assertEqual(
        parseResearchRestoreRequest({ conflictPolicy: 'add-only', records: [record] }).records.length,
        1,
        'restore boundary accepts validated add-only records',
    );
    assertThrows(
        () => parseResearchRestoreRequest({ conflictPolicy: 'overwrite-everything', records: [record] }),
        'restore boundary rejects unknown conflict policies',
    );
    const syncPreview = buildResearchSyncPreview(
        [record, { ...record, symbol: 'NVDA', revision: 10 }, { ...record, symbol: 'CIMB', market: 'MY', revision: 1 }],
        [
            { ...record, revision: 8, updatedAt: '2026-07-25T09:00:00.000Z' },
            { ...record, symbol: 'NVDA', revision: 9 },
            { ...record, symbol: 'CIMB', market: 'MY', revision: 1 },
            { ...record, symbol: 'MAYBANK', market: 'MY' },
        ],
    );
    assertEqual(syncPreview.newRecords, 1, 'sync preview identifies records new to the receiving device');
    assertEqual(syncPreview.incomingNewer, 1, 'sync preview identifies incoming newer records');
    assertEqual(syncPreview.localNewer, 1, 'sync preview identifies local newer records');
    assertEqual(syncPreview.sameRevision, 1, 'sync preview identifies matching revisions');
    assertEqual(validateEncryptedResearchBackup(encrypted), encrypted, 'sync vault accepts only a validated encrypted backup envelope');
    assertEqual(parseResearchSyncWriteRequest({ envelope: encrypted, expectedRevision: 0 }).expectedRevision, 0, 'sync write accepts an initial expected revision');
    assertThrows(() => parseResearchSyncWriteRequest({ envelope: '{}', expectedRevision: 0 }), 'sync write rejects an invalid encrypted envelope');
    assertThrows(() => parseResearchSyncWriteRequest({ envelope: encrypted, expectedRevision: -1 }), 'sync write rejects a negative expected revision');
    const syncSecret = '0123456789abcdef0123456789abcdef';
    assertEqual(authorizeResearchSyncBearer(`Bearer ${syncSecret}`, syncSecret), true, 'sync authorization accepts the configured bearer secret');
    assertThrows(() => authorizeResearchSyncBearer('Bearer wrong-secret', syncSecret), 'sync authorization rejects an incorrect bearer secret');
    assertThrows(() => authorizeResearchSyncBearer(`Bearer ${syncSecret}`, undefined), 'sync authorization fails closed when the server secret is absent');
};

const runSavedResearchLayoutTests = () => {
    const layout: SavedResearchLayout = {
        id: 'layout-us-ready',
        name: 'US ready list',
        savedAt: '2026-07-25T09:00:00.000Z',
        workspace: 'research',
        query: '',
        market: 'US',
        action: 'Ready',
        ticker: 'MSFT',
        tab: 'valuation',
        density: 'compact',
    };
    assertEqual(parseSavedResearchLayouts([layout])[0]?.ticker, 'MSFT', 'saved layout parser preserves a valid ticker');
    assertEqual(parseSavedResearchLayouts([{ ...layout, ticker: '../../bad' }]).length, 0, 'saved layout parser rejects invalid tickers');
    assertEqual(parseSavedResearchLayouts([{ ...layout, workspace: 'admin' }]).length, 0, 'saved layout parser rejects unknown workspaces');
    const renamed = { ...layout, id: 'layout-renamed', savedAt: '2026-07-25T09:10:00.000Z' };
    assertEqual(upsertSavedResearchLayout([layout], renamed).length, 1, 'saved layout upsert replaces case-insensitive names');
    const many = Array.from({ length: researchSavedLayoutLimit + 3 }, (_, index) => ({
        ...layout,
        id: `layout-${index}`,
        name: `View ${index}`,
    }));
    assertEqual(parseSavedResearchLayouts(many).length, researchSavedLayoutLimit, 'saved layout parser enforces the storage cap');
    assertEqual(removeSavedResearchLayout([layout], layout.id).length, 0, 'saved layout removal targets one ID');
    assertEqual(parseResearchLayoutDensity('compact'), 'compact', 'saved density accepts compact');
    assertEqual(parseResearchLayoutDensity('tiny'), 'comfortable', 'saved density falls back safely');
};

const runResearchUrlStateTests = () => {
    const initial = new URLSearchParams('workspace=discovery&ticker=MSFT&tab=chart&review=edit&market=US&source=briefing&future=value');
    const workspace = mergeResearchSearchParams(initial, { workspace: 'calendar' });
    assertEqual(workspace.get('workspace'), 'calendar', 'workspace navigation updates its owned parameter');
    assertEqual(workspace.get('ticker'), 'MSFT', 'workspace navigation preserves ticker');
    assertEqual(workspace.get('tab'), 'chart', 'workspace navigation preserves detail tab');
    assertEqual(workspace.get('review'), 'edit', 'workspace navigation preserves review mode');
    assertEqual(workspace.get('market'), 'US', 'workspace navigation preserves handoff context');
    assertEqual(workspace.get('future'), 'value', 'workspace navigation preserves unknown parameters');

    const ticker = mergeResearchSearchParams(workspace, { workspace: 'research', ticker: 'NVDA', tab: null, review: null });
    assertEqual(ticker.get('workspace'), 'research', 'opening a ticker restores the research workspace');
    assertEqual(ticker.get('ticker'), 'NVDA', 'opening a ticker updates the selected ticker');
    assertEqual(ticker.has('tab'), false, 'opening the overview removes stale detail tab state');
    assertEqual(ticker.has('review'), false, 'opening a ticker removes stale review state');
    assertEqual(ticker.get('source'), 'briefing', 'opening a ticker preserves unrelated source context');
    assertEqual(buildResearchRelativeUrl('/research', ticker, '#detail').startsWith('/research?'), true, 'research URL builder includes non-empty query state');
    assertEqual(buildResearchRelativeUrl('/research', new URLSearchParams(), ''), '/research', 'research URL builder omits an empty query marker');

    const visibleTickers = [{ symbol: 'MSFT' }, { symbol: 'NVDA' }];
    assertEqual(resolveVisibleResearchSymbol(visibleTickers, 'NVDA'), 'NVDA', 'visible ticker selection preserves the requested symbol');
    assertEqual(resolveVisibleResearchSymbol(visibleTickers, 'AAPL'), 'MSFT', 'filtered ticker selection falls back to the first visible symbol');
    assertEqual(resolveVisibleResearchSymbol([], 'MSFT'), null, 'empty filtered ticker selection clears the selected symbol');

    assertEqual(nextHorizontalTabIndex(0, 'ArrowRight', 5), 1, 'right arrow advances the active tab');
    assertEqual(nextHorizontalTabIndex(0, 'ArrowLeft', 5), 4, 'left arrow wraps to the final tab');
    assertEqual(nextHorizontalTabIndex(3, 'Home', 5), 0, 'Home moves to the first tab');
    assertEqual(nextHorizontalTabIndex(1, 'End', 5), 4, 'End moves to the final tab');
    assertEqual(nextHorizontalTabIndex(1, 'Enter', 5), null, 'unrelated keys do not move tab focus');
};

const runResearchWorkspaceNavigationTests = () => {
    const workspaceIds = researchWorkspaceGroups.flatMap((group) => group.items.map((item) => item.id));
    assertEqual(researchWorkspaceGroups.length, 7, 'research navigation exposes seven primary sections');
    assertEqual(new Set(workspaceIds).size, workspaceIds.length, 'research navigation assigns every workspace at most once');
    assertEqual(
        [...workspaceIds].sort().join('|'),
        [...researchLayoutWorkspaces].sort().join('|'),
        'research navigation assigns every supported workspace exactly once',
    );
    assertEqual(researchWorkspaceGroupFor('picker').id, 'discovery', 'Picker lives under Discovery');
    assertEqual(researchWorkspaceGroupFor('queue').id, 'activity', 'Queue lives under Activity');
    assertEqual(researchWorkspaceGroupFor('relationships').id, 'analyze', 'Map lives under Analyze');
    assertEqual(researchWorkspaceGroupFor('outcomes').id, 'review', 'Outcomes lives under Review');
    assertEqual(researchWorkspaceGroupFor('backup').id, 'more', 'Backup lives under More');
    assertEqual(researchWorkspaceGroups.find((group) => group.id === 'activity')?.defaultWorkspace, 'queue', 'Activity opens Queue by default');
    assertEqual(researchWorkspaceGroups.find((group) => group.id === 'discovery')?.items[1]?.label, 'Picker', 'Discovery exposes Picker as its second workspace');
};

const runMarketResearchHandoffTests = () => {
    const handoff: MarketResearchHandoff = {
        market: 'US', mode: 'standard', score: 68, tier: 'buy', freshness: 'mixed', coverage: 'strong',
        conflicts: ['Put/Call Ratio'], snapshotAt: new Date().toISOString(),
    };
    const href = buildResearchHandoffHref(handoff);
    const parsed = parseMarketResearchHandoff(new URL('https://signal.test' + href).searchParams);
    assertEqual(parsed?.market, 'US', 'market handoff preserves market');
    assertEqual(parsed?.score, 68, 'market handoff preserves score');
    assertEqual(parsed?.conflicts[0], 'Put/Call Ratio', 'market handoff preserves conflicts');
    assertEqual(getMarketResearchEmphasis(handoff).includes('independent'), true, 'market handoff keeps research decisions independent');
    assertEqual(getMarketResearchEmphasis({ ...handoff, snapshotAt: null, freshness: 'fresh' }).includes('provisional'), true, 'missing handoff timestamp is treated as provisional');
    assertEqual(getMarketResearchEmphasis({ ...handoff, snapshotAt: '2099-01-01T00:00:00.000Z', freshness: 'fresh' }).includes('provisional'), true, 'future handoff timestamp is treated as provisional');
    assertEqual(parseMarketResearchHandoff(new URLSearchParams('contextMarket=US&contextScore=150')), null, 'market handoff rejects invalid context');
};

const runMarketWatchlistExposureTests = () => {
    const signal = {
        metadata: {
            market: 'US',
            score_drivers: [
                { key: 'vix', name: 'Volatility Index', impact: 'negative', contribution: -6, score: 30, weight: 0.3, raw_value: 27, last_updated: '2026-07-25T00:00:00.000Z', detail: 'Elevated volatility' },
                { key: 'naaim', name: 'NAAIM positioning', impact: 'positive', contribution: 4, score: 65, weight: 0.2, raw_value: 70, last_updated: '2026-07-25T00:00:00.000Z', detail: 'Manager exposure' },
            ],
        },
        components: {
            vix: { enabled: true },
            naaim: { enabled: true },
        },
    } as unknown as MarketSignal;
    const items = [
        { symbol: 'TECH', market: 'US' as const, sector: 'Technology', industry: 'Software', positionState: 'not-owned' as const, lastReviewedAt: '2026-07-20' },
        { symbol: 'ETF', market: 'US' as const, sector: 'ETF', industry: 'Broad market', positionState: 'owned' as const, lastReviewedAt: '2026-07-10' },
        { symbol: 'UNKNOWN', market: 'US' as const, sector: 'Unknown', industry: 'Unknown', positionState: 'not-owned' as const, lastReviewedAt: 'bad-date' },
        { symbol: 'MYCO', market: 'MY' as const, sector: 'Financials', industry: 'Banks', positionState: 'owned' as const, lastReviewedAt: '2026-07-01' },
    ];
    const exposure = buildMarketWatchlistExposure(signal, items, new Date('2026-07-25T00:00:00.000Z'));
    assertEqual(exposure.length, 3, 'exposure map includes only same-market watchlist names');
    assertEqual(exposure[0]?.symbol, 'ETF', 'exposure map prioritizes owned names');
    assertEqual(exposure.find((item) => item.symbol === 'TECH')?.highestLevel, 'higher', 'cyclical sector receives the visible higher-connection rule');
    assertEqual(exposure.find((item) => item.symbol === 'UNKNOWN')?.highestLevel, 'unmapped', 'unknown sectors remain explicitly unmapped');
    assertEqual(exposure.find((item) => item.symbol === 'TECH')?.connections[0]?.driverImpact, 'negative', 'exposure map preserves the source driver direction');
    assertEqual(exposure.find((item) => item.symbol === 'TECH')?.reviewAgeDays, 5, 'exposure map derives review age from the saved review date');
};

const runThesisChangeTests = () => {
    const record = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const assisted: AssistedResearch = {
        symbol: 'MSFT',
        market: 'US',
        generatedAt: '2026-07-25T00:00:00.000Z',
        mode: 'evidence',
        findings: [{
            id: 'revenue-direction',
            title: 'Revenue is expanding',
            summary: 'Reported annual revenue growth is +15.0% for 2026-06-30.',
            target: 'bullCase',
            tone: 'positive',
            evidenceIds: ['revenue-growth'],
        }],
        evidence: [{
            id: 'revenue-growth',
            label: 'Annual revenue growth',
            value: '+15.0%',
            source: 'SEC EDGAR',
            sourceUrl: 'https://www.sec.gov/edgar/search/#/q=MSFT',
            reportingPeriod: '2026-06-30',
        }],
        warnings: [],
    };
    const fresh = buildThesisChangeItems(record, assisted);
    assertEqual(fresh[0]?.status, 'new', 'thesis-change inbox labels unseen sourced evidence as new');
    assertEqual(fresh[0]?.relationship, 'not-reflected', 'thesis-change inbox does not claim an empty field reflects a finding');
    const staged = stageThesisChangeEvidence(fresh[0]!, '2026-07-25T01:00:00.000Z');
    assertEqual(staged.sources[0]?.value, '+15.0%', 'staged thesis evidence freezes the source value');
    assertEqual(record.bullCase, '', 'staging thesis evidence does not mutate the saved thesis text');
    const accepted = { ...record, acceptedEvidence: [staged] };
    assertEqual(buildThesisChangeItems(accepted, assisted)[0]?.status, 'unchanged', 'identical accepted evidence is recognized as unchanged');
    const changed = {
        ...assisted,
        evidence: [{ ...assisted.evidence[0]!, value: '+9.0%', reportingPeriod: '2027-06-30' }],
    };
    assertEqual(buildThesisChangeItems(accepted, changed)[0]?.status, 'changed', 'updated source value or reporting period is surfaced as changed');
    assertEqual(buildThesisChangeItems(accepted, changed)[0]?.relationship, 'updated-evidence', 'changed accepted evidence is distinguished from text reflection');
};

const runMarketSensitivityTests = () => {
    const signal = {
        composite_score: 50,
        tier: 'neutral',
        mode: 'standard',
        components: {
            first: { enabled: true, score: 60 },
            second: { enabled: true, score: 40 },
        },
        metadata: {
            score_drivers: [
                { key: 'first', name: 'First', score: 60, weight: 0.4 },
                { key: 'second', name: 'Second', score: 40, weight: 0.4 },
            ],
            coverage_adjustment: { neutral_baseline: 50, neutral_points: 10 },
        },
    } as unknown as MarketSignal;
    const baseline = simulateMarketScore(signal, {});
    assertEqual(baseline.simulatedScore, 50, 'sensitivity baseline reproduces the coverage-aware composite');
    assertEqual(baseline.neutralPoints, 10, 'sensitivity preserves the missing-source neutral reserve');
    const raised = simulateMarketScore(signal, { first: 100 });
    assertEqual(raised.simulatedScore, 66, 'sensitivity applies a fixed-weight normalized-score override');
    assertEqual(raised.scoreDelta, 16, 'sensitivity reports the composite delta');
    assertEqual(raised.simulatedTier, 'buy', 'sensitivity applies the current mode tier thresholds');
    assertEqual(raised.drivers[0]?.contributionDelta, 16, 'sensitivity reports per-driver weighted-point delta');
    assertEqual(raised.conflicts.includes('Second'), true, 'sensitivity reports drivers that conflict with the simulated composite direction');
    assertEqual(raised.weightRegime, 'base', 'sensitivity identifies the fixed configured-weight regime');
    assertEqual(simulateMarketScore(signal, { first: 150 }).drivers[0]?.simulatedScore, 100, 'sensitivity clamps overrides to the normalized range');
    assertEqual(tierForMarketScore(66, 'contrarian'), 'sell', 'sensitivity inverts interpretation tier in contrarian mode');
};

const runResearchWorkflowQueueTests = () => {
    const pending: ResearchWorkflowTask = {
        id: '11111111-1111-4111-8111-111111111111',
        symbol: 'MSFT',
        templateId: 'earnings-update',
        source: 'manual',
        dedupeKey: null,
        dueAt: '2026-07-26',
        createdAt: '2026-07-20T00:00:00.000Z',
        completedAt: null,
    };
    const completed: ResearchWorkflowTask = {
        ...pending,
        id: '22222222-2222-4222-8222-222222222222',
        symbol: 'NVDA',
        dueAt: '2026-07-25',
        completedAt: '2026-07-24T00:00:00.000Z',
    };
    assertEqual(parseResearchWorkflowTasks([pending, { ...pending, id: 'bad' }]).length, 1, 'workflow queue drops malformed tasks');
    const migrated = parseResearchWorkflowTasks([{ ...pending, source: undefined }]);
    assertEqual(migrated[0]?.source, 'manual', 'workflow queue migrates tasks created before source provenance');
    assertEqual(parseResearchWorkflowTasks([{ ...pending, source: 'unknown' }]).length, 0, 'workflow queue drops tasks with invalid source provenance');
    assertEqual(sortResearchWorkflowTasks([completed, pending])[0]?.id, pending.id, 'workflow queue keeps pending reviews ahead of completed reviews');
    assertEqual(upsertResearchWorkflowTask([pending], { ...pending, dueAt: '2026-08-01' }).length, 1, 'workflow queue replaces a task by id');
    assertEqual(upsertResearchWorkflowTask([pending], { ...pending, dueAt: '2026-08-01' })[0]?.dueAt, '2026-08-01', 'workflow queue retains the updated due date');
    assertEqual(getResearchWorkflowTemplate('valuation-refresh').fields.join(','), 'notes', 'valuation refresh limits narrative fields to notes');
    assertEqual(getResearchWorkflowTemplate('earnings-update').fields.includes('thesisBreak'), true, 'earnings update retains thesis invalidation');
    assertEqual(getResearchWorkflowTemplate('new-idea').fields.length, 7, 'new idea exposes the complete narrative field set');

    const connected = enqueueResearchWorkflowTask([], {
        symbol: 'MSFT',
        templateId: 'thesis-challenge',
        source: 'alert',
        dueAt: '2026-07-28',
    }, '33333333-3333-4333-8333-333333333333', '2026-07-25T00:00:00.000Z');
    assertEqual(connected.created, true, 'workflow queue creates a connected review');
    assertEqual(connected.task.source, 'alert', 'workflow queue retains connected-review provenance');
    const duplicate = enqueueResearchWorkflowTask(connected.tasks, {
        symbol: 'MSFT',
        templateId: 'thesis-challenge',
        source: 'alert',
        dueAt: '2026-07-27',
    }, '44444444-4444-4444-8444-444444444444', '2026-07-26T00:00:00.000Z');
    assertEqual(duplicate.created, false, 'workflow queue deduplicates pending connected reviews');
    assertEqual(duplicate.tasks.length, 1, 'workflow queue keeps one pending task per symbol, template, and source');
    assertEqual(duplicate.task.dueAt, '2026-07-27', 'workflow queue keeps the earliest connected-review due date');
    const otherSource = enqueueResearchWorkflowTask(duplicate.tasks, {
        symbol: 'MSFT',
        templateId: 'thesis-challenge',
        source: 'calendar',
        dueAt: '2026-07-27',
    }, '55555555-5555-4555-8555-555555555555', '2026-07-26T00:00:00.000Z');
    assertEqual(otherSource.tasks.length, 2, 'workflow queue preserves distinct signal provenance');
    const afterCompletion = enqueueResearchWorkflowTask([
        { ...connected.task, completedAt: '2026-07-26T00:00:00.000Z' },
    ], {
        symbol: 'MSFT',
        templateId: 'thesis-challenge',
        source: 'alert',
        dueAt: '2026-08-01',
    }, '66666666-6666-4666-8666-666666666666', '2026-07-27T00:00:00.000Z');
    assertEqual(afterCompletion.created, true, 'workflow queue allows a new task after the prior connected review is completed');
    const firstTrigger = enqueueResearchWorkflowTask([], {
        symbol: 'MSFT', templateId: 'thesis-challenge', source: 'structured-trigger',
        dedupeKey: 'structured-trigger:MSFT:price-rule', dueAt: '2026-07-28',
    }, '77777777-7777-4777-8777-777777777777', '2026-07-27T00:00:00.000Z');
    const repeatedTrigger = enqueueResearchWorkflowTask(firstTrigger.tasks, {
        symbol: 'MSFT', templateId: 'thesis-challenge', source: 'structured-trigger',
        dedupeKey: 'structured-trigger:MSFT:price-rule', dueAt: '2026-07-27',
    }, '88888888-8888-4888-8888-888888888888', '2026-07-27T01:00:00.000Z');
    assertEqual(repeatedTrigger.created, false, 'workflow queue deterministically deduplicates the same matched structured rule');
    const secondTrigger = enqueueResearchWorkflowTask(repeatedTrigger.tasks, {
        symbol: 'MSFT', templateId: 'thesis-challenge', source: 'structured-trigger',
        dedupeKey: 'structured-trigger:MSFT:rsi-rule', dueAt: '2026-07-27',
    }, '99999999-9999-4999-8999-999999999999', '2026-07-27T02:00:00.000Z');
    assertEqual(secondTrigger.tasks.length, 2, 'workflow queue preserves distinct matched rules even when their templates match');
};

const runEvidenceCoverageTests = () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const empty = buildEvidenceCoverage(base, '2026-07-26');
    assertEqual(empty.missing, 7, 'evidence coverage treats empty thesis fields as missing');
    assertEqual(empty.coveragePercent, 0, 'evidence coverage does not award unsupported coverage');

    const finding = {
        id: 'bull-growth',
        title: 'Revenue growth evidence',
        summary: 'Annual revenue expanded.',
        target: 'bullCase' as const,
        tone: 'positive' as const,
        mode: 'evidence' as const,
        acceptedAt: '2026-07-20T00:00:00.000Z',
        sources: [{
            id: 'revenue-growth',
            label: 'Annual revenue growth',
            value: '+15.0%',
            source: 'SEC EDGAR',
            sourceUrl: 'https://www.sec.gov/edgar',
            reportingPeriod: '2026-06-30',
        }],
    };
    const supportedRecord = { ...base, bullCase: 'Revenue growth supports the current thesis.', acceptedEvidence: [finding] };
    const supported = buildEvidenceCoverage(supportedRecord, '2026-07-26');
    assertEqual(supported.items.find((item) => item.target === 'bullCase')?.status, 'supported', 'evidence coverage recognizes current sourced analysis');
    assertEqual(supported.items.find((item) => item.target === 'bullCase')?.ageDays, 26, 'evidence coverage measures freshness from the reporting period');

    const assumption = buildEvidenceCoverage({ ...base, bearCase: 'Competition could pressure margins.' }, '2026-07-26');
    assertEqual(assumption.items.find((item) => item.target === 'bearCase')?.status, 'assumption', 'evidence coverage distinguishes unsourced saved analysis');

    const stale = buildEvidenceCoverage({
        ...supportedRecord,
        acceptedEvidence: [{
            ...finding,
            acceptedAt: '2024-06-30T00:00:00.000Z',
            sources: [{ ...finding.sources[0], reportingPeriod: '2024-06-30' }],
        }],
    }, '2026-07-26');
    assertEqual(stale.items.find((item) => item.target === 'bullCase')?.status, 'stale', 'evidence coverage applies the field freshness rule');

    const conflicting = buildEvidenceCoverage({
        ...supportedRecord,
        acceptedEvidence: [finding, { ...finding, id: 'bull-risk', tone: 'risk' as const }],
    }, '2026-07-26');
    assertEqual(conflicting.items.find((item) => item.target === 'bullCase')?.status, 'conflicting', 'evidence coverage surfaces mixed positive and risk evidence');

    const evidenceWithoutText = buildEvidenceCoverage({ ...base, acceptedEvidence: [finding] }, '2026-07-26');
    assertEqual(evidenceWithoutText.items.find((item) => item.target === 'bullCase')?.status, 'missing', 'evidence coverage keeps an empty saved thesis field explicitly missing');
};

const runInvestmentPolicyTests = () => {
    assertEqual(parseInvestmentPolicy({ ...defaultInvestmentPolicy, maxReviewAgeDays: 0 }).maxReviewAgeDays, 90, 'investment policy rejects invalid review-age limits');
    assertEqual(parseInvestmentPolicy({ ...defaultInvestmentPolicy, maxSingleAllocationPercent: 15 }).maxSingleAllocationPercent, 15, 'investment policy accepts bounded allocation limits');

    const first = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const second = createResearchRecord({ symbol: 'NVDA', market: 'US', companyName: 'NVIDIA' });
    const policy = {
        ...defaultInvestmentPolicy,
        maxSingleAllocationPercent: 20,
        maxSectorAllocationPercent: 35,
        minEvidenceCoveragePercent: 0,
        maxReviewAgeDays: 730,
    };
    const assessments = assessInvestmentPolicy([
        {
            record: {
                ...first,
                positionPlan: { ...first.positionPlan, plannedAllocationPercent: 25 },
                valuationState: 'expensive',
                decisionJournal: { ...first.decisionJournal, decision: 'Ready' },
            },
            sector: 'Technology',
        },
        {
            record: { ...second, positionPlan: { ...second.positionPlan, plannedAllocationPercent: 20 } },
            sector: 'Technology',
        },
    ], policy, '2026-07-26');
    const firstKinds = assessments[0]?.violations.map((item) => item.kind) ?? [];
    assertEqual(firstKinds.includes('single-allocation'), true, 'investment policy flags a single-name allocation breach');
    assertEqual(firstKinds.includes('sector-allocation'), true, 'investment policy flags aggregate sector allocation');
    assertEqual(firstKinds.includes('ready-valuation'), true, 'investment policy applies the optional Ready valuation guardrail');
    assertEqual(assessments[1]?.violations.some((item) => item.kind === 'sector-allocation'), true, 'investment policy applies a sector breach to each planned position in that sector');

    const evidenceAndAge = assessInvestmentPolicy([{
        record: { ...first, bullCase: 'Unsourced thesis.', lastReviewedAt: '2025-01-01' },
        sector: 'Technology',
    }], defaultInvestmentPolicy, '2026-07-26')[0];
    assertEqual(evidenceAndAge?.violations.some((item) => item.kind === 'evidence-coverage'), true, 'investment policy flags evidence coverage below the configured minimum');
    assertEqual(evidenceAndAge?.violations.some((item) => item.kind === 'review-age'), true, 'investment policy flags an overdue saved review');
};

const runCurrencyPerformanceTests = () => {
    assertEqual(parseCurrencyPerformanceSettings({ ...defaultCurrencyPerformanceSettings, currentUsdMyr: 0 }).currentUsdMyr, 4.25, 'currency performance rejects invalid FX assumptions');
    assertEqual(parseCurrencyPerformanceSettings({
        ...defaultCurrencyPerformanceSettings,
        adjustments: [
            { symbol: 'MSFT', dividendsPercent: 2, feesPercent: 1 },
            { symbol: 'MSFT', dividendsPercent: 5, feesPercent: 0 },
            { symbol: 'bad symbol', dividendsPercent: 1, feesPercent: 1 },
        ],
    }).adjustments.length, 1, 'currency performance drops duplicate and malformed adjustments');

    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const record = {
        ...base,
        positionPlan: { ...base.positionPlan, averageCost: 100 },
        decisionJournal: { ...base.decisionJournal, benchmarkLabel: 'VOO', benchmarkReturnPercent: 8 },
    };
    const myr = calculateCurrencyPerformance(record, 110, {
        version: 1,
        baseCurrency: 'MYR',
        entryUsdMyr: 4,
        currentUsdMyr: 4.4,
        adjustments: [{ symbol: 'MSFT', dividendsPercent: 2, feesPercent: 1 }],
    });
    assertEqual(myr.priceReturnPercent, 10, 'currency performance separates security-price return');
    assertEqual(myr.fxReturnPercent, 10, 'currency performance calculates USD appreciation in an MYR base');
    assertEqual(myr.totalReturnPercent, 22, 'currency performance compounds price and FX before manual adjustments');
    assertEqual(myr.relativeToSavedBenchmarkPercent, 14, 'currency performance compares with saved benchmark context when available');

    const myBase = createResearchRecord({ symbol: 'MAYBANK', market: 'MY', companyName: 'Maybank' });
    const usd = calculateCurrencyPerformance({
        ...myBase,
        positionPlan: { ...myBase.positionPlan, plannedEntryPrice: 10 },
    }, 11, {
        ...defaultCurrencyPerformanceSettings,
        baseCurrency: 'USD',
        entryUsdMyr: 4,
        currentUsdMyr: 4.4,
    });
    assertEqual(usd.priceReturnPercent, 10, 'currency performance retains local-currency price return');
    assertEqual(usd.fxReturnPercent, -9.09, 'currency performance converts MYR depreciation into a USD-base drag');
    assertEqual(usd.totalReturnPercent, 0, 'currency performance compounds offsetting price and FX changes');

    const unavailable = calculateCurrencyPerformance(base, null, defaultCurrencyPerformanceSettings);
    assertEqual(unavailable.available, false, 'currency performance keeps missing cost and price inputs unavailable');
};

const runEvidenceDocumentDiffTests = () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const evidence = (id: string, label: string, value: string, target: 'bullCase' | 'bearCase', reportingPeriod: string) => ({
        id: `finding-${id}`,
        title: label,
        summary: `${label}: ${value}`,
        target,
        tone: target === 'bullCase' ? 'positive' as const : 'risk' as const,
        mode: 'evidence' as const,
        acceptedAt: `${reportingPeriod}T00:00:00.000Z`,
        sources: [{
            id,
            label,
            value,
            source: 'SEC EDGAR',
            sourceUrl: `https://www.sec.gov/edgar/${id}`,
            reportingPeriod,
        }],
    });
    const first = appendResearchReview({
        ...base,
        acceptedEvidence: [
            evidence('free-cash-flow', 'Annual free cash flow', '$50B', 'bullCase', '2025-06-30'),
            evidence('operating-margin', 'Operating margin', '40%', 'bullCase', '2025-06-30'),
        ],
    }, '2025-07-01T00:00:00.000Z');
    const second = appendResearchReview({
        ...first,
        acceptedEvidence: [
            evidence('free-cash-flow', 'Annual free cash flow', '$60B', 'bullCase', '2026-06-30'),
            evidence('total-debt', 'Total debt', '$80B', 'bearCase', '2026-06-30'),
        ],
    }, '2026-07-01T00:00:00.000Z');
    const diff = buildEvidenceDocumentDiff(second);
    assertEqual(diff.hasBaseline, true, 'evidence document diff uses the prior saved review as its baseline');
    assertEqual(diff.baselineAt, '2025-07-01T00:00:00.000Z', 'evidence document diff preserves the baseline timestamp');
    assertEqual(diff.items.find((item) => item.id.endsWith('free-cash-flow'))?.kind, 'changed', 'evidence document diff detects value and reporting-period changes');
    assertEqual(diff.items.find((item) => item.id.endsWith('free-cash-flow'))?.category, 'cash-flow', 'evidence document diff categorizes cash-flow evidence');
    assertEqual(diff.items.find((item) => item.id.endsWith('operating-margin'))?.kind, 'removed', 'evidence document diff detects removed evidence');
    assertEqual(diff.items.find((item) => item.id.endsWith('total-debt'))?.kind, 'added', 'evidence document diff detects added evidence');
    assertEqual(diff.items.find((item) => item.id.endsWith('total-debt'))?.category, 'debt', 'evidence document diff categorizes debt evidence');

    const noBaseline = buildEvidenceDocumentDiff(appendResearchReview({
        ...base,
        acceptedEvidence: [evidence('revenue-growth', 'Revenue growth', '12%', 'bullCase', '2026-06-30')],
    }, '2026-07-01T00:00:00.000Z'));
    assertEqual(noBaseline.hasBaseline, false, 'evidence document diff discloses a missing prior review baseline');
    assertEqual(noBaseline.items[0]?.kind, 'added', 'evidence document diff treats current evidence as added without a baseline');
};

const runDiscoveryUniversePolicyTests = () => {
    const candidate = (input: Partial<QualityDiscoveryResult> & Pick<QualityDiscoveryResult, 'symbol' | 'discoveryScore'>) => ({
        name: input.symbol,
        qualityScore: 50,
        trendScore: 50,
        sector: 'Technology',
        sectorRelativeStrengthPercent: 0,
        averageDollarVolume: 30_000_000,
        risk: 'moderate',
        valuation: { guardrail: 'fair' },
        catalyst: null,
        ...input,
    }) as QualityDiscoveryResult;
    const first = candidate({ symbol: 'FIRST', discoveryScore: 70, qualityScore: 40, trendScore: 70, valuation: { guardrail: 'expensive', priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null } });
    const second = candidate({ symbol: 'SECOND', discoveryScore: 69, qualityScore: 90, sector: 'Financials', averageDollarVolume: 100_000_000, valuation: { guardrail: 'attractive', priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null } });
    const baseline = applyDiscoveryUniversePolicy([first, second], defaultDiscoveryUniversePolicy);
    assertEqual(baseline.rows[0]?.candidate.symbol, 'FIRST', 'default universe policy preserves the default ranking');
    assertEqual(baseline.rows[0]?.policyScore, first.discoveryScore, 'default universe policy leaves discovery scores unchanged');
    const qualityPolicy = { ...defaultDiscoveryUniversePolicy, preferences: ['quality'] as const };
    const reranked = applyDiscoveryUniversePolicy([first, second], qualityPolicy);
    assertEqual(reranked.rows[0]?.candidate.symbol, 'SECOND', 'quality preference can transparently change policy rank');
    assertEqual(reranked.rows[0]?.defaultRank, 2, 'policy result retains the default rank');
    assertEqual(reranked.rows[0]?.reasons[0], 'Quality +4', 'policy result discloses the exact preference adjustment');
    const excluded = applyDiscoveryUniversePolicy([first, second], { ...defaultDiscoveryUniversePolicy, sectors: ['Technology'], minimumDollarVolume: 50_000_000 });
    assertEqual(excluded.rows.length, 0, 'universe policy applies sector and liquidity eligibility before ranking');
    assertEqual(excluded.excluded.length, 2, 'universe policy reports every excluded candidate');
    assertEqual(parseDiscoveryUniversePolicy({ ...defaultDiscoveryUniversePolicy, preferences: ['quality', 'quality'] }), null, 'universe policy rejects duplicate preferences');
    const saved = upsertSavedDiscoveryUniverse([], 'Quality leaders', qualityPolicy);
    assertEqual(parseSavedDiscoveryUniverses(saved)[0]?.name, 'Quality leaders', 'saved universe round-trips through the strict parser');
    assertEqual(removeSavedDiscoveryUniverse(saved, saved[0]!.id).length, 0, 'saved universe removal is explicit and bounded');
};

const runResearchNotificationTests = async () => {
    const inbox = {
        generatedAt: '2026-07-17T08:00:00.000Z', monitoredCount: 1, warnings: [],
        items: [{ id: 'MSFT-risk', symbol: 'MSFT', kind: 'risk' as const, urgency: 'action' as const, title: 'Below 200-day average', detail: 'Review trend weakness.', proximity: '2.0% below MA200', source: 'Yahoo Finance' as const, eventDate: null, structuredTriggerRuleId: null }],
    };
    const digest = buildResearchNotificationDigest(inbox, 'https://signal.example/research?workspace=alerts');
    assertEqual(digest.summary.action, 1, 'notification digest counts actionable items');
    assertEqual(digest.summary.tickerCount, 1, 'notification digest counts distinct tickers');
    assertEqual(digest.summary.omitted, 0, 'notification digest reports omitted items');
    const structuredDigest = buildResearchNotificationDigest({
        ...inbox,
        items: [{
            ...inbox.items[0]!,
            id: 'MSFT-structured-price-rule',
            title: 'Thesis invalidation review',
            detail: 'Price below 100 USD; observed 95 USD on 2026-07-17 from Yahoo Finance (0 days old).',
            source: 'Structured trigger' as const,
            structuredTriggerRuleId: 'price-rule',
        }],
    }, 'https://signal.example/research?workspace=alerts');
    assertEqual(JSON.stringify(structuredDigest).includes('private authored thesis'), false, 'structured trigger digest contains no authored thesis or notes');
    assertEqual(structuredDigest.items[0]?.source, 'Structured trigger', 'structured trigger digest retains fixed provenance without raw provider payloads');
    assertEqual(filterResearchNotificationItems(inbox.items, 'daily').length, 1, 'daily notification mode retains the digest');
    assertEqual(filterResearchNotificationItems(inbox.items, 'urgent-only').length, 1, 'urgent-only mode retains actionable items');
    assertEqual(filterResearchNotificationItems([{ ...inbox.items[0]!, urgency: 'upcoming' }], 'urgent-only').length, 0, 'urgent-only mode excludes non-action items');
    const settings = parseResearchNotificationSettings({
        enabled: true, mode: 'urgent-only', quietHoursEnabled: true,
        quietHoursStartUtc: 22, quietHoursEndUtc: 7,
    });
    assertEqual(isResearchNotificationQuietHour(settings, new Date('2026-07-20T23:00:00.000Z')), true, 'overnight quiet hours include the late UTC range');
    assertEqual(isResearchNotificationQuietHour(settings, new Date('2026-07-20T12:00:00.000Z')), false, 'overnight quiet hours exclude daytime UTC');
    assertThrows(() => parseResearchNotificationSettings({ ...settings, quietHoursStartUtc: 24 }), 'notification settings reject invalid UTC hours');
    const crowdedDigest = buildResearchNotificationDigest({
        ...inbox,
        items: [
            ...Array.from({ length: 50 }, (_, index) => ({ ...inbox.items[0]!, id: `upcoming-${index}`, symbol: `U${index}`, kind: 'catalyst' as const, urgency: 'upcoming' as const })),
            { ...inbox.items[0]!, id: 'late-batch-risk', symbol: 'RISK', kind: 'risk' as const, urgency: 'action' as const },
        ],
    }, 'https://signal.example/research?workspace=alerts');
    assertEqual(crowdedDigest.items[0]?.id, 'late-batch-risk', 'full-watchlist digest globally prioritizes action risk before truncation');
    assertEqual(crowdedDigest.summary.totalAvailable, 51, 'digest reports attention items across batches');
    assertEqual(crowdedDigest.summary.omitted, 31, 'digest reports items omitted by the delivery bound');
    assertEqual(researchNotificationDigestKey(digest).length, 64, 'notification digest uses a SHA-256 deduplication key');
    assertEqual(researchNotificationDigestKey({ ...digest, generatedAt: '2026-07-17T18:00:00.000Z' }), researchNotificationDigestKey(digest), 'unchanged conditions deduplicate within the same day');
    assertEqual(researchNotificationDigestKey({ ...digest, generatedAt: '2026-07-18T08:00:00.000Z' }) === researchNotificationDigestKey(digest), false, 'daily digest can remind again on a later day');
    assertEqual(signResearchNotification(JSON.stringify(digest), '0123456789abcdef').startsWith('sha256='), true, 'notification delivery signs its payload');
    assertEqual(validateNotificationEndpoint('https://hooks.example.test/signal').hostname, 'hooks.example.test', 'notification endpoint accepts HTTPS');
    assertThrows(() => validateNotificationEndpoint('http://hooks.example.test/signal'), 'notification endpoint rejects plaintext HTTP');
    assertThrows(() => validateNotificationEndpoint('https://user:pass@hooks.example.test/signal'), 'notification endpoint rejects URL credentials');
    let deliveryId = '';
    await deliverResearchNotification({
        endpoint: 'https://hooks.example.test/signal', secret: '0123456789abcdef', digest,
        fetcher: async (_url, init) => {
            deliveryId = new Headers(init?.headers).get('Idempotency-Key') ?? '';
            return new Response(null, { status: 204 });
        },
    });
    assertEqual(deliveryId, researchNotificationDigestKey(digest), 'notification receiver gets the stable delivery id');
    const calls: string[] = [];
    assertEqual(await executeResearchNotificationDelivery({
        digest, digestKey: deliveryId,
        reserve: async () => true,
        deliver: async () => { calls.push('deliver'); },
        markDelivered: async () => { calls.push('mark'); },
        release: async () => { calls.push('release'); },
    }), 'delivered', 'notification lifecycle marks a successful delivery');
    assertEqual(calls.join(','), 'deliver,mark', 'successful delivery does not release its reservation');
    assertEqual(await executeResearchNotificationDelivery({
        digest, digestKey: deliveryId,
        reserve: async () => false,
        deliver: async () => { throw new Error('must not deliver'); },
        markDelivered: async () => undefined,
        release: async () => undefined,
    }), 'duplicate', 'active or delivered reservation suppresses a duplicate');
    let released = false;
    try {
        await executeResearchNotificationDelivery({
            digest, digestKey: deliveryId,
            reserve: async () => true,
            deliver: async () => { throw new Error('webhook failed'); },
            markDelivered: async () => undefined,
            release: async () => { released = true; },
        });
    } catch {
        // Expected delivery failure.
    }
    assertEqual(released, true, 'failed delivery releases its reservation for retry');

    const alerts = [
        { id: 'MSFT-risk', symbol: 'MSFT', kind: 'market-condition' as const, title: 'Below 200-day average', detail: 'Review trend weakness.', severity: 'risk' as const, structuredTrigger: null },
        { id: 'NVDA-opportunity', symbol: 'NVDA', kind: 'market-condition' as const, title: 'Near buy zone', detail: 'Price is near the saved range.', severity: 'opportunity' as const, structuredTrigger: null },
    ];
    const nativeSettings = parseResearchNativeNotificationSettings({ enabled: true, mode: 'risk-only' });
    assertEqual(nativeSettings.enabled, true, 'native notification settings preserve explicit opt-in');
    assertEqual(parseResearchNativeNotificationSettings({ enabled: 'yes', mode: 'all' }).enabled, false, 'malformed native settings fail closed');
    const riskNotification = buildResearchNativeNotification(alerts, nativeSettings.mode);
    assertEqual(riskNotification?.itemCount, 1, 'risk-only native mode excludes non-risk alerts');
    assertEqual(riskNotification?.body.includes('MSFT'), true, 'native notification body names the affected ticker');
    assertEqual(buildResearchNativeNotification([], 'all'), null, 'native notifications stay quiet without active alerts');
    assertEqual(
        await researchNativeNotificationDigest(alerts),
        await researchNativeNotificationDigest([...alerts].reverse()),
        'native notification deduplication is stable across provider order',
    );
    assertEqual((await researchNativeNotificationDigest(alerts)).includes('MSFT'), false, 'native notification deduplication does not persist alert plaintext');
};

const runDiscoveryWorkspaceTests = () => {
    const previous: DiscoveryVisitSnapshot = { version: 1, capturedAt: '2026-07-16T08:00:00.000Z', candidates: [
        { symbol: 'MSFT', rank: 5, score: 70, risk: 'low', valuation: 'fair', catalystDate: null },
        { symbol: 'NVDA', rank: 1, score: 90, risk: 'low', valuation: 'expensive', catalystDate: null },
    ] };
    const current: DiscoveryVisitSnapshot = { version: 1, capturedAt: '2026-07-17T08:00:00.000Z', candidates: [
        { symbol: 'MSFT', rank: 1, score: 82, risk: 'moderate', valuation: 'expensive', catalystDate: '2026-07-28' },
        { symbol: 'AMD', rank: 2, score: 80, risk: 'low', valuation: 'fair', catalystDate: null },
    ] };
    const changes = compareDiscoveryVisits(previous, current);
    assertEqual(changes.some((change) => change.symbol === 'AMD' && change.kind === 'new'), true, 'Discovery visit detects new ranked entrants');
    assertEqual(changes.some((change) => change.symbol === 'MSFT' && change.kind === 'rank'), true, 'Discovery visit detects material rank moves');
    assertEqual(changes.some((change) => change.symbol === 'MSFT' && change.kind === 'risk'), true, 'Discovery visit detects changed risk');
    assertEqual(changes.some((change) => change.symbol === 'MSFT' && change.kind === 'catalyst'), true, 'Discovery visit detects changed catalysts');
    const filters = { sector: 'Technology', risk: 'low' as const, stage: 'confirmed' as const, valuation: 'fair' as const };
    const saved = upsertSavedDiscoveryView([], 'Quality tech', filters);
    assertEqual(parseSavedDiscoveryViews(saved)[0]?.filters.sector, 'Technology', 'Discovery saved view preserves filters');
    assertEqual(upsertSavedDiscoveryView(saved, 'Quality tech', { ...filters, risk: 'moderate' })[0]?.filters.risk, 'moderate', 'Discovery saved view updates a matching name');
    assertEqual(removeSavedDiscoveryView(saved, saved[0]!.id).length, 0, 'Discovery saved view can be removed');
};

const runInputTests = () => {
    const created = parseResearchCreateInput({ symbol: ' msft ', market: 'US', companyName: ' Microsoft ' });
    assertEqual(created.symbol, 'MSFT', 'create input normalizes symbol');
    assertEqual(created.companyName, 'Microsoft', 'create input trims company name');
    assertThrows(() => parseResearchCreateInput({ symbol: '../bad', market: 'US', companyName: 'Bad' }), 'create rejects unsafe symbol');
    assertThrows(() => parseResearchCreateInput({ symbol: 'MSFT', market: 'EU', companyName: 'Microsoft' }), 'create rejects unknown market');

    const updated = parseResearchUpdateInput({ thesisStrength: 'high', inBuyZone: true, checklist: { valuationReasonable: true } });
    assertEqual(updated.thesisStrength, 'high', 'update accepts thesis strength');
    assertEqual(updated.checklist?.valuationReasonable, true, 'update accepts checklist patch');
    assertEqual(updated.monitoringRules?.rsiBelow, undefined, 'update leaves monitoring rules unchanged when omitted');
    const monitoringUpdate = parseResearchUpdateInput({ monitoringRules: { ...defaultResearchMonitoringRules, rsiBelow: 35, earningsWithinDays: 10 } });
    assertEqual(monitoringUpdate.monitoringRules?.rsiBelow, 35, 'update accepts typed monitoring thresholds');
    assertThrows(() => parseResearchUpdateInput({ monitoringRules: { ...defaultResearchMonitoringRules, rsiBelow: 80 } }), 'update rejects an invalid lower RSI threshold');
    assertEqual(parseResearchUpdateMode({ mode: 'settings' }), 'settings', 'settings updates do not masquerade as reviews');
    assertEqual(parseResearchUpdateMode({}), 'review', 'legacy updates retain review behavior');
    assertThrows(() => parseResearchUpdateMode({ mode: 'silent' }), 'update rejects unknown persistence modes');
    assertEqual(parseResearchExpectedRevision({ revision: 3 }), 3, 'updates require an optimistic row revision');
    assertThrows(() => parseResearchExpectedRevision({}), 'updates reject a missing row revision');
    assertThrows(() => parseResearchUpdateInput({ thesisStrength: 'excellent' }), 'update rejects unknown thesis strength');
    assertEqual(Object.hasOwn(parseResearchUpdateInput({ reviewHistory: [{ id: 'forged' }] }), 'reviewHistory'), false, 'update ignores client-supplied review history');

    const merged = applyResearchUpdate(createResearchRecord(created), parseResearchUpdateInput({}));
    const record = parseResearchRecord({ ...merged, lastReviewedAt: '2026-07-11' });
    assertEqual(record.companyName, 'Microsoft', 'record parser preserves required identity');
    assertEqual(record.notes, '', 'record parser preserves defaults for omitted optional fields');
    assertEqual(record.acceptedEvidence.length, 0, 'record parser defaults persisted evidence for legacy records');
    assertEqual(record.reviewHistory.length, 0, 'record parser defaults review history for legacy records');
    assertEqual(record.monitoringRules.reviewAgeDays, 30, 'record parser defaults legacy monitoring rules');
    assertEqual(record.decisionJournal.decision, 'Watch', 'record parser defaults the decision journal for legacy records');
    assertEqual(record.positionPlan.plannedAllocationPercent, null, 'record parser defaults the position plan for legacy records');
    assertEqual(calculateResearchDecision(record), 'Watch', 'server decision calculation owns the saved decision');
    assertEqual(parseResearchUpdateInput({ monitoringRules: { rsiAbove: null } }).monitoringRules?.rsiAbove, null, 'explicitly disabled monitoring rules stay disabled');

    const acceptedEvidence = [{
        id: 'MSFT-bullCase-growth', title: 'Revenue growth', summary: 'Revenue grew 14%.',
        target: 'bullCase', tone: 'positive', mode: 'evidence', acceptedAt: '2026-07-14T10:00:00.000Z',
        sources: [{ id: 'revenue-growth', label: 'Revenue growth', value: '14%', source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar', reportingPeriod: '2025-06-30' }],
    }] as const;
    const evidenceUpdate = parseResearchUpdateInput({ acceptedEvidence });
    assertEqual(evidenceUpdate.acceptedEvidence?.[0]?.sources[0]?.source, 'SEC EDGAR', 'update parser preserves accepted source provenance');
    assertThrows(() => parseResearchUpdateInput({ acceptedEvidence: [{ ...acceptedEvidence[0], sources: [{ ...acceptedEvidence[0].sources[0], sourceUrl: 'javascript:alert(1)' }] }] }), 'update rejects unsafe evidence links');

    const decisionJournal = {
        decision: 'Ready', confidence: 'high', observedPrice: 425.5,
        benchmarkLabel: 'Vanguard S&P 500 ETF', benchmarkReturnPercent: 12.4,
        nextReviewAt: '2026-08-15', priorReviewId: null, priorOutcome: 'unresolved', outcomeNote: '',
    } as const;
    const journalUpdate = parseResearchUpdateInput({ decisionJournal });
    assertEqual(journalUpdate.decisionJournal?.observedPrice, 425.5, 'decision journal preserves observed price');
    assertEqual(journalUpdate.decisionJournal?.nextReviewAt, '2026-08-15', 'decision journal preserves next review date');
    assertThrows(() => parseResearchUpdateInput({ decisionJournal: { ...decisionJournal, nextReviewAt: '15/08/2026' } }), 'decision journal rejects malformed review dates');
    const canonicalFirstReview = prepareStoredResearchRecord(record, journalUpdate, 'review');
    assertEqual(canonicalFirstReview.decisionJournal.decision, 'Watch', 'server replaces a client-authored calculated decision');
    assertEqual(canonicalFirstReview.decisionJournal.priorReviewId, null, 'first review has no fabricated prior review link');
    const canonicalSecondReview = prepareStoredResearchRecord(canonicalFirstReview, parseResearchUpdateInput({ decisionJournal: { ...decisionJournal, priorReviewId: 'forged', priorOutcome: 'correct' } }), 'review');
    assertEqual(canonicalSecondReview.decisionJournal.priorReviewId, canonicalFirstReview.reviewHistory[0]?.id ?? null, 'server links outcome to the actual preceding review');
    const settingsOnly = prepareStoredResearchRecord(canonicalSecondReview, parseResearchUpdateInput({ monitoringRules: { ...defaultResearchMonitoringRules, rsiBelow: 35 }, decisionJournal: { ...decisionJournal, decision: 'Ready' } }), 'settings');
    assertEqual(settingsOnly.decisionJournal.decision, canonicalSecondReview.decisionJournal.decision, 'settings updates cannot rewrite journal evidence');
    assertEqual(settingsOnly.reviewHistory.length, canonicalSecondReview.reviewHistory.length, 'settings updates do not append review history');
    assertThrows(() => parseResearchUpdateInput({ decisionJournal: { ...decisionJournal, nextReviewAt: '2026-02-31' } }), 'decision journal rejects impossible calendar dates');
    assertEqual(parseResearchUpdateInput({ decisionJournal: {} }).decisionJournal?.decision, 'Watch', 'empty migrated decision journal receives safe defaults');
    const positionPlan = { plannedAllocationPercent: 10, averageCost: 100, plannedEntryPrice: null, invalidationPrice: 90 };
    const planUpdate = parseResearchUpdateInput({ positionPlan });
    assertEqual(planUpdate.positionPlan?.plannedAllocationPercent, 10, 'position plan preserves allocation');
    assertThrows(() => parseResearchUpdateInput({ positionPlan: { ...positionPlan, plannedAllocationPercent: 120 } }), 'position plan rejects allocation above 100%');
    assertEqual(parseResearchUpdateInput({ positionPlan: {} }).positionPlan?.averageCost, null, 'empty migrated position plan receives safe defaults');
    assertEqual(calculatePositionPlanRisk(positionPlan, null)?.portfolioRiskPercent, 1, 'position plan calculates portfolio-at-risk from allocation and invalidation');
    assertEqual(calculatePositionPlanRisk({ ...positionPlan, invalidationPrice: 110 }, null), null, 'position plan rejects invalidation above its reference price');

    const firstReview = appendResearchReview(applyResearchUpdate(applyResearchUpdate(record, evidenceUpdate), journalUpdate), '2026-07-14T10:30:00.000Z');
    assertEqual(firstReview.reviewHistory.length, 1, 'saved review appends a history snapshot');
    assertEqual(firstReview.reviewHistory[0]?.acceptedEvidence[0]?.sources[0]?.source, 'SEC EDGAR', 'review snapshot freezes source provenance');
    assertEqual(firstReview.reviewHistory[0]?.decisionJournal.decision, 'Ready', 'review snapshot freezes the calculated decision');
    assertEqual(firstReview.reviewHistory[0]?.decisionJournal.benchmarkReturnPercent, 12.4, 'review snapshot freezes benchmark context');
    const secondReview = appendResearchReview({ ...firstReview, bullCase: 'Revenue grew and margins expanded.' }, '2026-07-15T11:00:00.000Z');
    assertEqual(describeReviewChanges(secondReview.reviewHistory[0], secondReview.reviewHistory[1]).includes('Bull case'), true, 'review history describes changed thesis fields');
    assertEqual(latestReviewChanges(secondReview).includes('Bull case'), true, 'latest review changes compare the two newest saved reviews');
    const quickNote = appendQuickReviewNote('Existing note', 'Checked margins', '2026-07-15');
    assertEqual(quickNote.startsWith('Existing note'), true, 'quick review preserves existing notes');
    assertEqual(quickNote.includes('Checked margins'), true, 'quick review appends the new note');
    assertEqual(parseResearchRecord(secondReview).reviewHistory[0]?.acceptedEvidence[0]?.sources[0]?.sourceUrl, 'https://www.sec.gov/edgar', 'record boundary preserves historical source links');
    const boundedHistory = Array.from({ length: 30 }, (_, index) => index).reduce(
        (current, index) => appendResearchReview(current, `2026-07-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`),
        record,
    );
    assertEqual(boundedHistory.reviewHistory.length, 25, 'review history stays bounded');
    const ownedWithPlan = { ...record, positionState: 'owned' as const, positionPlan };
    const sectorConcentration = calculateSectorConcentration([ownedWithPlan, { ...ownedWithPlan, symbol: 'AMD', positionPlan: { ...positionPlan, plannedAllocationPercent: 5 } }], new Map([['MSFT', 'Technology'], ['AMD', 'Technology']]));
    assertEqual(sectorConcentration[0]?.allocationPercent, 15, 'position plan aggregates owned-sector concentration');
};

const runOutcomeAnalyticsTests = () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const completedChecklist = Object.fromEntries(
        Object.keys(base.checklist).map((key) => [key, true]),
    ) as unknown as typeof base.checklist;
    const first = appendResearchReview({
        ...base,
        checklist: completedChecklist,
        decisionJournal: {
            ...base.decisionJournal,
            decision: 'Ready',
            confidence: 'high',
            observedPrice: 100,
            nextReviewAt: '2026-02-10',
        },
    }, '2026-01-01T12:00:00.000Z');
    const priorId = first.reviewHistory[0]!.id;
    const second = appendResearchReview({
        ...first,
        decisionJournal: {
            ...first.decisionJournal,
            decision: 'Watch',
            confidence: 'medium',
            observedPrice: 110,
            priorReviewId: priorId,
            priorOutcome: 'correct',
            outcomeNote: 'The thesis held through the review period.',
        },
    }, '2026-02-05T12:00:00.000Z');
    const analytics = buildResearchOutcomeAnalytics([second]);
    assertEqual(analytics.historicalDecisions, 2, 'outcome analytics counts saved decision snapshots');
    assertEqual(analytics.linkedDecisions, 1, 'outcome analytics counts decisions linked to later reviews');
    assertEqual(analytics.assessedDecisions, 1, 'outcome analytics counts resolved assessments');
    assertEqual(analytics.correct, 1, 'outcome analytics preserves explicit correct outcomes');
    assertEqual(analytics.assessments[0]?.decision, 'Ready', 'outcome analytics groups by the assessed decision');
    assertEqual(analytics.assessments[0]?.confidence, 'high', 'outcome analytics groups by assessed confidence');
    assertEqual(analytics.assessments[0]?.priceChangePercent, 10, 'outcome analytics derives linked observed-price change');
    assertEqual(analytics.assessments[0]?.checklistCompletionPercent, 100, 'outcome analytics measures assessed checklist completeness');
    assertEqual(analytics.onTimeAssessments, 1, 'outcome analytics compares assessment time with the recorded schedule');
    assertEqual(analytics.byDecision[0]?.label, 'Ready', 'outcome analytics emits populated decision groups');

    const unresolved = buildResearchOutcomeAnalytics([{
        ...second,
        reviewHistory: second.reviewHistory.map((review, index) => index === 0
            ? { ...review, decisionJournal: { ...review.decisionJournal, priorOutcome: 'unresolved' as const } }
            : review),
    }]);
    assertEqual(unresolved.assessedDecisions, 0, 'outcome analytics excludes unresolved judgments from resolved totals');
    assertEqual(unresolved.unresolvedDecisions, 1, 'outcome analytics reports unresolved linked reviews separately');
};

const runSinceLastVisitTests = () => {
    const baselineRecord = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const baseline = buildResearchVisitSnapshot([baselineRecord], '2026-07-01T00:00:00.000Z', [{
        market: 'US', tier: 'neutral', score: 50, snapshotAt: '2026-07-01T00:00:00.000Z',
    }]);
    const changedRecord = {
        ...baselineRecord,
        revision: baselineRecord.revision + 1,
        updatedAt: '2026-07-20T00:00:00.000Z',
        decisionJournal: { ...baselineRecord.decisionJournal, nextReviewAt: '2026-07-15' },
        acceptedEvidence: [{
            id: 'finding-1',
            title: 'Revenue evidence',
            summary: 'Revenue advanced.',
            target: 'bullCase' as const,
            tone: 'positive' as const,
            mode: 'evidence' as const,
            acceptedAt: '2026-07-20T00:00:00.000Z',
            sources: [{ id: 'revenue', label: 'Revenue', value: '10%', source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/', reportingPeriod: '2026-Q2' }],
        }],
    };
    const changes = buildSinceLastVisitChanges([
        changedRecord,
        createResearchRecord({ symbol: 'NVDA', market: 'US', companyName: 'NVIDIA' }),
    ], baseline, '2026-07-26T00:00:00.000Z');
    assertEqual(changes.newSymbols.join(','), 'NVDA', 'since-last-visit briefing identifies newly tracked records');
    assertEqual(changes.revisedSymbols.join(','), 'MSFT', 'since-last-visit briefing identifies revised records');
    assertEqual(changes.evidenceChangedSymbols.join(','), 'MSFT', 'since-last-visit briefing detects accepted-evidence changes');
    assertEqual(changes.overdueReviewSymbols.join(','), 'MSFT', 'since-last-visit briefing identifies overdue scheduled reviews');
    assertEqual(parseResearchVisitSnapshot(JSON.parse(JSON.stringify(baseline)))?.records[0]?.symbol, 'MSFT', 'since-last-visit snapshot survives local persistence');
    assertEqual(parseResearchVisitSnapshot(JSON.parse(JSON.stringify(baseline)))?.markets[0]?.tier, 'neutral', 'since-last-visit snapshot preserves the prior market posture');
    assertEqual(parseResearchVisitSnapshot({ ...baseline, version: 2 }), null, 'since-last-visit snapshot rejects unknown versions');
    const briefing = buildSinceLastVisitBriefing({
        changes,
        previous: baseline,
        currentMarkets: [{ market: 'US', tier: 'buy', score: 68, snapshotAt: '2026-07-26T00:00:00.000Z' }],
        events: [
            { symbol: 'MSFT', type: 'stale', date: '2026-07-15' },
            { symbol: 'NVDA', type: 'earnings', date: '2026-07-28' },
        ],
        alerts: [{ symbol: 'MSFT', severity: 'risk' }],
        policyViolations: [{ symbol: 'NVDA', count: 2 }],
        sourceIssues: [{ name: 'SEC EDGAR', affectedFeatures: ['Research fundamentals'] }],
        attentionCount: 4,
        unreadCount: 2,
    });
    assertEqual(briefing.marketChanges[0]?.direction, 'improved', 'since-last-visit briefing identifies a stronger market posture');
    assertEqual(briefing.topActions.length, 3, 'since-last-visit briefing limits the action list to three priorities');
    assertEqual(briefing.topActions[0]?.kind, 'risk-alert', 'since-last-visit briefing prioritizes active risk conditions');
    assertEqual(briefing.topActions[1]?.kind, 'policy', 'since-last-visit briefing prioritizes policy breaches before upcoming events');
    assertEqual(briefing.sourceIssues[0]?.name, 'SEC EDGAR', 'since-last-visit briefing keeps degraded source impact visible');

    const market = parseSinceLastVisitMarket({
        success: true,
        data: {
            composite_score: 68,
            tier: 'buy',
            metadata: { market: 'US' },
        },
    }, 'US', '2026-07-26T08:00:00.000Z');
    assertEqual(market.tier, 'buy', 'since-last-visit market parser preserves a validated tier');
    assertEqual(market.snapshotAt, '2026-07-26T08:00:00.000Z', 'since-last-visit market parser uses the bounded fetch timestamp');
    assertThrows(() => parseSinceLastVisitMarket({
        success: true,
        data: { composite_score: 68, tier: 'buy', metadata: { market: 'MY' } },
    }, 'US', '2026-07-26T08:00:00.000Z'), 'since-last-visit market parser rejects a mismatched market');

    const alertSummaries = parseSinceLastVisitAlerts({
        success: true,
        data: {
            generatedAt: '2026-07-26T08:00:00.000Z',
            monitoredCount: 2,
            alerts: [
                { symbol: 'MSFT', severity: 'risk', title: 'Risk', detail: 'Below invalidation.' },
                { symbol: 'NVDA', severity: 'watch', title: 'Watch', detail: 'Near target.' },
            ],
            warnings: [],
        },
    });
    assertEqual(alertSummaries.map((item) => `${item.symbol}:${item.severity}`).join(','), 'MSFT:risk,NVDA:watch', 'since-last-visit alert parser emits bounded alert summaries');
    assertThrows(() => parseSinceLastVisitAlerts({ success: true, data: { alerts: [{ symbol: '../bad', severity: 'risk' }] } }), 'since-last-visit alert parser rejects unsafe symbols');

    const sourceIssues = parseSinceLastVisitSourceIssues({
        success: true,
        data: {
            generatedAt: '2026-07-26T08:00:00.000Z',
            entries: [
                { id: 'sec', name: 'SEC EDGAR', category: 'research', status: 'degraded', checkedAt: null, lastSuccessfulAt: null, latencyMs: null, cadence: 'daily', coverage: 'US', affectedFeatures: ['Research fundamentals'], detail: 'Unavailable.' },
                { id: 'yahoo', name: 'Yahoo', category: 'market', status: 'healthy', checkedAt: null, lastSuccessfulAt: null, latencyMs: null, cadence: 'live', coverage: 'US', affectedFeatures: ['Quotes'], detail: 'Healthy.' },
            ],
        },
    });
    assertEqual(sourceIssues.length, 1, 'since-last-visit source parser includes degraded sources only');
    assertEqual(sourceIssues[0]?.affectedFeatures[0], 'Research fundamentals', 'since-last-visit source parser preserves affected features');
};

const portfolioChartPoint = (time: string, close: number) => ({
    time, open: close, high: close, low: close, close, volume: 1_000_000,
    ma50: null, ma200: null, ema20: null, ema50: null, sma200: null, averageVolume20: null,
    rsi14: null, macd: null, macdSignal: null, macdHistogram: null, atr14: null,
    atrPercent14: null, anchoredVwap: null, adx14: null, plusDi14: null, minusDi14: null,
    supertrend: null, supertrendDirection: null,
});

const runPortfolioAnalyticsTests = () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const positionPlan = { plannedAllocationPercent: 20, averageCost: 100, plannedEntryPrice: null, invalidationPrice: 90 };
    const msft = { ...base, positionState: 'owned' as const, positionPlan };
    const amd = { ...base, symbol: 'AMD', positionPlan: { ...positionPlan, plannedAllocationPercent: 10, invalidationPrice: null } };
    const summary = buildPortfolioSummary([
        { record: msft, sector: 'Technology', currency: 'USD', currentPrice: 110 },
        { record: amd, sector: 'Technology', currency: 'USD', currentPrice: 120 },
    ]);
    assertEqual(summary.totalAllocationPercent, 30, 'portfolio summary totals planned allocation');
    assertEqual(summary.unallocatedPercent, 70, 'portfolio summary reports unallocated capacity');
    assertEqual(summary.definedRiskPercent, 2, 'portfolio summary excludes incomplete invalidation risk');
    assertEqual(summary.riskCoveredAllocationPercent, 20, 'portfolio summary discloses risk coverage');
    assertEqual(summary.bySector[0]?.allocationPercent, 30, 'portfolio summary aggregates sector exposure');
    assertEqual(summary.largestHolding?.symbol, 'MSFT', 'portfolio summary surfaces single-name concentration');

    const dates = Array.from({ length: 31 }, (_, index) => `2026-01-${String(index + 1).padStart(2, '0')}`);
    const benchmark = dates.map((date, index) => portfolioChartPoint(date, 100 + index));
    const charts = new Map([
        ['MSFT', dates.map((date, index) => portfolioChartPoint(date, 100 + index * 2))],
        ['AMD', dates.map((date, index) => portfolioChartPoint(date, 80 + index * 1.5))],
    ]);
    const analytics = buildPortfolioMarketAnalytics(summary.holdings, charts, new Map([['US', benchmark]]));
    assertEqual(analytics.metrics[0]?.observations, 30, 'portfolio beta uses overlapping return observations');
    assertEqual(analytics.metrics.every((metric) => metric.beta !== null), true, 'portfolio beta is available with sufficient history');
    assertEqual(analytics.correlations[0]?.correlations.AMD !== null, true, 'portfolio correlation is calculated with sufficient overlap');
    const scenarios = buildPortfolioScenarios(summary, analytics, -12);
    assertEqual(scenarios.find((scenario) => scenario.label === 'User-defined shock')?.portfolioImpactPercent, -3.6, 'portfolio custom shock weights planned allocation');
    assertEqual(scenarios.find((scenario) => scenario.label === 'Saved invalidation levels')?.coveredAllocationPercent, 20, 'portfolio invalidation scenario reports covered allocation');
};

const runPortfolioHoldingsImportTests = () => {
    const canonical = [
        'account_label,row_type,symbol,market,quantity,average_cost,currency,cash_balance',
        'Main,holding,MSFT,US,10,420.5,USD,',
        'Main,cash,,,,,USD,2500',
        'Trading,holding,1155.KL,MY,100,9.25,MYR,',
    ].join('\n');
    const parsed = parsePortfolioCsv(canonical);
    assertEqual(parsed.holdings.length, 2, 'portfolio CSV parses canonical holding rows');
    assertEqual(parsed.cashBalances[0]?.balance, 2500, 'portfolio CSV parses explicit cash rows');
    assertEqual(parsed.holdings[1]?.symbol, '1155.KL', 'portfolio CSV preserves provider-qualified symbols');

    const aliases = parsePortfolioCsv([
        'account,ticker,market,shares,avg_cost,ccy',
        'Broker,msft,US,2,100,USD',
    ].join('\n'));
    assertEqual(aliases.holdings[0]?.symbol, 'MSFT', 'portfolio CSV accepts only documented unambiguous aliases');
    assertThrows(() => parsePortfolioCsv('account,account_name,symbol,market,quantity,average_cost,currency\nA,A,MSFT,US,1,1,USD'), 'portfolio CSV rejects ambiguous duplicate aliases');
    assertThrows(() => parsePortfolioCsv('account_label,symbol,quantity,average_cost,currency\nA,MSFT,1,1,USD'), 'portfolio CSV requires explicit market');
    assertThrows(() => parsePortfolioCsv('account_label,symbol,market,quantity,average_cost,currency,notes\nA,MSFT,US,1,1,USD,x'), 'portfolio CSV rejects unsupported columns');

    const partial = parsePortfolioCsv([
        'account_label,row_type,symbol,market,quantity,average_cost,currency,cash_balance',
        'Main,holding,MSFT,US,10,420.5,USD,',
        'Main,holding,NVDA,US,not-a-number,100,USD,',
        'Main,holding,../bad,US,1,1,USD,',
        'Main,cash,,,,,EUR,50',
    ].join('\n'));
    assertEqual(partial.holdings.length, 1, 'portfolio CSV retains valid rows in a partial import');
    assertEqual(partial.rejectedRows.length, 3, 'portfolio CSV reports every invalid row');
    assertEqual(partial.rejectedRows[0]?.rowNumber, 3, 'portfolio CSV errors retain exact source row numbers');

    const duplicate = parsePortfolioCsv([
        'account_label,symbol,market,quantity,average_cost,currency',
        'Main,MSFT,US,1,100,USD',
        ' main ,msft,US,2,110,USD',
    ].join('\n'));
    assertEqual(duplicate.holdings.length, 0, 'portfolio CSV excludes every row in a duplicate identity group');
    assertEqual(duplicate.duplicates[0]?.rowNumbers.join(','), '2,3', 'portfolio CSV reports duplicate source rows');
    assertEqual(duplicate.rejectedRows.length, 2, 'portfolio CSV exposes duplicate rows as rejected rows');

    const tooManyRows = [
        'account_label,symbol,market,quantity,average_cost,currency',
        ...Array.from({ length: portfolioImportLimits.maxRows + 1 }, (_, index) => `A${index},S${index},US,1,1,USD`),
    ].join('\n');
    assertThrows(() => parsePortfolioCsv(tooManyRows), 'portfolio CSV enforces the row limit');
    assertThrows(() => parsePortfolioCsv('x'.repeat(portfolioImportLimits.maxFileBytes + 1)), 'portfolio CSV enforces the byte limit');
    assertEqual(escapeSpreadsheetCell('=HYPERLINK("bad")'), '\'=HYPERLINK("bad")', 'portfolio CSV export neutralizes formula cells');
    assertEqual(buildCanonicalPortfolioCsvTemplate().startsWith('account_label,row_type'), true, 'portfolio CSV template exposes the canonical contract');

    const first = createPortfolioImportSnapshot(parsed, 'Manual import', '2026-07-26T10:00:00.000Z');
    const conflictIncoming = createPortfolioImportSnapshot({
        holdings: [
            { accountLabel: 'Main', symbol: 'MSFT', market: 'US', quantity: 12, averageCost: 410, currency: 'USD' },
            { accountLabel: 'Main', symbol: 'NVDA', market: 'US', quantity: 5, averageCost: 150, currency: 'USD' },
        ],
        cashBalances: [{ accountLabel: 'Main', currency: 'USD', balance: 3000 }],
    }, 'Second import', '2026-07-26T11:00:00.000Z');
    const addEffect = previewPortfolioImportEffect(first, conflictIncoming, 'add-only');
    assertEqual(addEffect.skippedHoldings, 1, 'portfolio add-only preview identifies matching holdings');
    assertEqual(addEffect.addedHoldings, 1, 'portfolio add-only preview identifies new holdings');
    assertEqual(addEffect.unchangedExistingHoldings, 1, 'portfolio import preview preserves unrelated holdings');
    const additive = mergePortfolioHoldingsSnapshots(first, conflictIncoming, 'add-only');
    assertEqual(additive.holdings.find((holding) => holding.symbol === 'MSFT')?.quantity, 10, 'portfolio add-only merge does not replace a match');
    assertEqual(additive.holdings.some((holding) => holding.symbol === '1155.KL'), true, 'portfolio add-only merge preserves unrelated holdings');
    assertThrows(() => mergePortfolioHoldingsSnapshots(first, conflictIncoming, 'replace-matching'), 'portfolio replacement requires acknowledgement');
    const replaced = mergePortfolioHoldingsSnapshots(first, conflictIncoming, 'replace-matching', true);
    assertEqual(replaced.holdings.find((holding) => holding.symbol === 'MSFT')?.quantity, 12, 'portfolio acknowledged replacement updates an exact match');
    assertEqual(replaced.holdings.some((holding) => holding.symbol === '1155.KL'), true, 'portfolio replacement never deletes unrelated holdings');
    assertEqual(replaced.cashBalances[0]?.balance, 3000, 'portfolio replacement updates only matching cash identity');

    assertThrows(() => parsePortfolioHoldingsSnapshot({ ...first, version: 2 }), 'portfolio persistence rejects unsupported versions');
    assertThrows(() => parsePortfolioHoldingsSnapshot({ ...first, holdings: [...first.holdings, first.holdings[0]] }), 'portfolio persistence rejects duplicate stored holdings');
    assertEqual(parsePortfolioHoldingsSnapshot(JSON.parse(JSON.stringify(first))).version, 1, 'portfolio persistence validates a round-tripped snapshot');

    const msft = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const wrongMarket = createResearchRecord({ symbol: '1155.KL', market: 'US', companyName: 'Wrong market record' });
    const reconciled = reconcilePortfolioHoldings(first, [msft, wrongMarket], new Map([
        ['US:MSFT', 450],
        ['MY:1155.KL', 10],
    ]));
    assertEqual(reconciled.find((row) => row.holding.symbol === 'MSFT')?.marketValue, 4500, 'portfolio reconciliation uses exact matched research price');
    assertEqual(reconciled.find((row) => row.holding.symbol === '1155.KL')?.researchRecord, null, 'portfolio reconciliation never guesses across markets');
    assertEqual(reconciled.find((row) => row.holding.symbol === '1155.KL')?.marketValue, null, 'unmatched portfolio values remain unavailable');
    const actual = buildPortfolioActualSummary(first, reconciled);
    const usd = actual.find((summary) => summary.currency === 'USD');
    const myr = actual.find((summary) => summary.currency === 'MYR');
    assertEqual(usd?.costBasis, 4205, 'portfolio actual summary calculates cost basis independently of planned allocation');
    assertEqual(usd?.cashBalance, 2500, 'portfolio actual summary includes explicit cash separately');
    assertEqual(myr?.missingMarketValues, 1, 'portfolio actual summary reports missing market values');
    assertEqual(
        portfolioActualWeightPercent(reconciled.find((row) => row.holding.symbol === '1155.KL')!, myr!),
        null,
        'portfolio actual weights remain unavailable when market value is missing',
    );
    assertEqual(buildPortfolioSummary([]).totalAllocationPercent, 0, 'imported holdings do not mutate planned allocation analytics');
};

const runPortfolioSimulationTests = () => {
    const imported = createPortfolioImportSnapshot({
        holdings: [
            { accountLabel: 'Main', symbol: 'MSFT', market: 'US', quantity: 10, averageCost: 100, currency: 'USD' },
            { accountLabel: 'Main', symbol: 'NVDA', market: 'US', quantity: 4, averageCost: 200, currency: 'USD' },
            { accountLabel: 'MY Account', symbol: '1155.KL', market: 'MY', quantity: 100, averageCost: 8, currency: 'MYR' },
        ],
        cashBalances: [
            { accountLabel: 'Main', currency: 'USD', balance: 1_000 },
            { accountLabel: 'MY Account', currency: 'MYR', balance: 500 },
        ],
    }, 'Simulation fixture', '2026-07-26T10:00:00.000Z');
    const msft = {
        ...createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' }),
        lastReviewedAt: '2026-07-20',
        positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: 90 },
    };
    const nvda = {
        ...createResearchRecord({ symbol: 'NVDA', market: 'US', companyName: 'Nvidia' }),
        lastReviewedAt: '2026-07-20',
        positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
    };
    const research = [
        { record: msft, sector: 'Technology', currentPrice: 120 },
        { record: nvda, sector: 'Technology', currentPrice: null },
    ];
    const buy: PortfolioSimulationLegInput = {
        id: 'buy-msft', accountLabel: 'Main', symbol: 'msft', market: 'US', currency: 'USD',
        side: 'buy', quantity: 5, assumedPrice: 110,
    };
    const partialSell: PortfolioSimulationLegInput = {
        id: 'sell-nvda', accountLabel: 'Main', symbol: 'NVDA', market: 'US', currency: 'USD',
        side: 'sell', quantity: 2, assumedPrice: 210,
    };
    const result = simulatePortfolioScenario(imported, [partialSell, buy], research, defaultInvestmentPolicy, '2026-07-26');
    assertEqual(result.status, 'ready', 'portfolio simulation accepts a valid multi-leg basket');
    assertEqual(result.legs[0]?.id, 'sell-nvda', 'portfolio simulation preserves visible leg ordering');
    assertEqual(result.after.positions.find((row) => row.symbol === 'MSFT')?.quantity, 15, 'portfolio simulation applies a buy quantity');
    assertEqual(result.after.positions.find((row) => row.symbol === 'MSFT')?.averageCost, 103.33, 'portfolio simulation calculates weighted average cost');
    assertEqual(result.after.positions.find((row) => row.symbol === 'NVDA')?.quantity, 2, 'portfolio simulation applies a partial sell');
    assertEqual(result.after.buckets.find((row) => row.accountLabel === 'Main')?.cashBalance, 870, 'portfolio simulation nets same-currency cash deterministically');
    assertEqual(result.before.buckets.find((row) => row.currency === 'MYR')?.cashBalance, 500, 'portfolio simulation isolates currency and account buckets');
    assertEqual(result.after.buckets.find((row) => row.currency === 'MYR')?.cashBalance, 500, 'portfolio simulation leaves unrelated currency cash unchanged');
    assertEqual(result.after.buckets.find((row) => row.accountLabel === 'Main')?.missingMarketValues, 0, 'assumed sell price supplies the touched position value');
    assertEqual(result.before.buckets.find((row) => row.accountLabel === 'Main')?.missingMarketValues, 1, 'portfolio simulation keeps unavailable current values unavailable before the scenario');
    assertEqual(result.before.buckets.find((row) => row.accountLabel === 'Main')?.largestPosition, null, 'portfolio simulation does not claim concentration with incomplete values');
    assertEqual(result.after.buckets.find((row) => row.accountLabel === 'Main')?.largestPosition?.symbol, 'MSFT', 'portfolio simulation calculates single-name concentration');
    assertEqual(result.after.buckets.find((row) => row.accountLabel === 'Main')?.sectors[0]?.label, 'Technology', 'portfolio simulation aggregates exact research sectors');
    assertEqual(result.after.buckets.find((row) => row.accountLabel === 'Main')?.definedDownsideValue, 300, 'portfolio simulation includes valid lower invalidation downside only');
    assertEqual(result.after.buckets.find((row) => row.accountLabel === 'Main')?.riskExcludedPositions, 1, 'portfolio simulation discloses missing downside evidence');
    assertEqual(
        result.after.buckets.find((row) => row.accountLabel === 'Main')?.policyBreaches.some((breach) => breach.kind === 'single-allocation'),
        true,
        'portfolio simulation reuses deterministic policy evaluation for valid actual weights',
    );

    const reordered = simulatePortfolioScenario(imported, [buy, partialSell], research, defaultInvestmentPolicy, '2026-07-26');
    assertEqual(JSON.stringify(reordered.after), JSON.stringify(result.after), 'portfolio simulation result is independent of distinct leg ordering');

    const fullSell = simulatePortfolioScenario(imported, [{
        ...partialSell, id: 'full-sell', quantity: 4,
    }], research, defaultInvestmentPolicy, '2026-07-26');
    assertEqual(fullSell.after.positions.some((row) => row.symbol === 'NVDA'), false, 'portfolio simulation removes a fully sold position');

    const invalid = simulatePortfolioScenario(imported, [
        { ...partialSell, id: 'oversell', quantity: 5 },
        { ...buy, id: 'duplicate-a' },
        { ...buy, id: 'duplicate-b', side: 'sell' },
        { ...buy, id: 'bad-price', symbol: 'AMD', assumedPrice: Number.NaN },
        { ...buy, id: 'wrong-account', accountLabel: 'main', symbol: 'GOOG' },
    ], research, defaultInvestmentPolicy, '2026-07-26');
    assertEqual(invalid.status, 'invalid', 'portfolio simulation rejects an invalid basket');
    assertEqual(invalid.legs.find((leg) => leg.id === 'oversell')?.errors.some((error) => error.includes('exceeds')), true, 'portfolio simulation rejects overselling');
    assertEqual(invalid.legs.find((leg) => leg.id === 'duplicate-a')?.errors.some((error) => error.includes('Duplicate')), true, 'portfolio simulation rejects duplicate or conflicting legs');
    assertEqual(invalid.legs.find((leg) => leg.id === 'bad-price')?.errors.some((error) => error.includes('price')), true, 'portfolio simulation rejects a missing or non-finite assumed price');
    assertEqual(invalid.legs.find((leg) => leg.id === 'wrong-account')?.errors.some((error) => error.includes('account')), true, 'portfolio simulation requires exact account scope');
    assertEqual(JSON.stringify(invalid.after), JSON.stringify(invalid.before), 'portfolio simulation never applies a partially invalid basket');

    const unmatched = simulatePortfolioScenario(imported, [{
        ...buy, id: 'unmatched', symbol: 'GOOG', quantity: 1, assumedPrice: 100,
    }], research, defaultInvestmentPolicy, '2026-07-26');
    assertEqual(unmatched.legs[0]?.researchMatched, false, 'portfolio simulation surfaces unmatched symbols without guessing');
    assertEqual(unmatched.after.buckets.find((row) => row.accountLabel === 'Main')?.unmatchedPositions, 1, 'portfolio simulation discloses unmatched coverage');

    const deficit = simulatePortfolioScenario(imported, [{
        ...buy, id: 'deficit', symbol: 'GOOG', quantity: 20, assumedPrice: 100,
    }], research, defaultInvestmentPolicy, '2026-07-26');
    assertEqual(deficit.after.buckets.find((row) => row.accountLabel === 'Main')?.cashBalance, -1_000, 'portfolio simulation preserves an explicit cash deficit');
    assertEqual(deficit.warnings.some((warning) => warning.includes('cash deficit')), true, 'portfolio simulation warns instead of silently funding or blocking');

    const duplicateSnapshot = JSON.stringify(imported);
    const first = simulatePortfolioScenario(imported, [buy], research, defaultInvestmentPolicy, '2026-07-26');
    const second = simulatePortfolioScenario(imported, [buy], research, defaultInvestmentPolicy, '2026-07-26');
    assertEqual(JSON.stringify(imported), duplicateSnapshot, 'portfolio simulation does not mutate the accepted holdings snapshot');
    assertEqual(JSON.stringify(first), JSON.stringify(second), 'portfolio simulation is idempotent for the same explicit inputs');

    const tooMany = Array.from({ length: portfolioSimulationLimits.maxLegs + 1 }, (_, index) => ({
        ...buy, id: `leg-${index}`, symbol: `S${index}`,
    }));
    assertEqual(simulatePortfolioScenario(imported, tooMany, research, defaultInvestmentPolicy).status, 'invalid', 'portfolio simulation enforces its leg bound');

    const csv = buildPortfolioSimulationExport(first, 'csv');
    const markdown = buildPortfolioSimulationExport(first, 'markdown', '=Authored scenario');
    assertEqual(csv.includes('No orders were sent'), true, 'portfolio simulation export states that no orders were sent');
    assertEqual(markdown.includes("'=Authored scenario"), true, 'portfolio simulation export neutralizes spreadsheet formulas');
    assertEqual(markdown.includes('No orders were sent'), true, 'portfolio simulation Markdown export states that no orders were sent');
};

const runScenarioLibraryTests = () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const summary = buildPortfolioSummary([
        {
            record: { ...base, positionPlan: { plannedAllocationPercent: 20, averageCost: 100, plannedEntryPrice: null, invalidationPrice: 90 } },
            sector: 'Technology',
            currency: 'USD',
            currentPrice: 110,
        },
        {
            record: { ...base, symbol: 'MAYBANK', market: 'MY', positionPlan: { plannedAllocationPercent: 10, averageCost: 9, plannedEntryPrice: null, invalidationPrice: 8 } },
            sector: 'Financials',
            currency: 'MYR',
            currentPrice: 10,
        },
    ]);
    const scenario: SavedPortfolioScenario = {
        id: 'sector:tech decline',
        name: 'Tech decline',
        kind: 'sector',
        shockPercent: -25,
        target: 'Technology',
        savedAt: '2026-07-26T00:00:00.000Z',
    };
    const result = applySavedPortfolioScenario(summary, scenario);
    assertEqual(result.portfolioImpactPercent, -5, 'saved scenario weights its shock by affected allocation');
    assertEqual(result.coveredAllocationPercent, 20, 'saved scenario reports targeted allocation coverage');
    assertEqual(applySavedPortfolioScenario(summary, { ...scenario, target: 'Energy' }).portfolioImpactPercent, null, 'saved scenario preserves an unavailable unmatched target');
    assertEqual(parseSavedPortfolioScenarios([{ ...scenario, shockPercent: -150 }])[0]?.shockPercent, -100, 'saved scenario parser clamps unsafe shock input');
    assertEqual(parseSavedPortfolioScenarios([{ ...scenario, target: null }]).length, 0, 'saved scenario parser rejects missing targeted scope');
    const updated = upsertSavedPortfolioScenario([scenario], { ...scenario, shockPercent: -30, savedAt: '2026-07-26T01:00:00.000Z' });
    assertEqual(updated.length, 1, 'saved scenario upsert replaces an existing identity');
    assertEqual(updated[0]?.shockPercent, -30, 'saved scenario upsert preserves the latest definition');
    assertEqual(removeSavedPortfolioScenario(updated, scenario.id).length, 0, 'saved scenario removal deletes only the selected identity');
    const many = Array.from({ length: portfolioScenarioLibraryLimit + 2 }, (_, index) => ({
        ...scenario,
        id: `market:${index}`,
        name: `Scenario ${index}`,
        kind: 'market' as const,
        target: null,
        savedAt: `2026-07-26T${String(index).padStart(2, '0')}:00:00.000Z`,
    }));
    assertEqual(parseSavedPortfolioScenarios(many).length, portfolioScenarioLibraryLimit, 'saved scenario parser enforces the library limit');
};

const runPaperDecisionTests = () => {
    const decision: PaperDecision = {
        id: 'MSFT:2026-07-26T00:00:00.000Z',
        symbol: 'MSFT',
        market: 'US',
        action: 'act',
        decisionPrice: 100,
        note: 'Evidence met the saved policy.',
        recordedAt: '2026-07-26T00:00:00.000Z',
        horizon: '3M',
        researchDecision: 'Ready',
        confidence: 'high',
        benchmark: {
            symbol: 'VOO',
            entryPrice: 500,
            outcomePrice: null,
            observedAt: null,
        },
        outcomePrice: null,
        resolvedAt: null,
        maxDrawdownPercent: null,
        maxFavorableMovePercent: null,
    };
    const added = addPaperDecision([], decision);
    assertEqual(added.length, 1, 'paper decision tracker adds a validated decision');
    assertEqual(decisionReviewDueAt(added[0]!), '2026-10-24T00:00:00.000Z', 'decision review horizon produces a stable due date');
    const migrated = parsePaperDecisions([{
        id: 'MAYBANK:legacy',
        symbol: 'MAYBANK',
        market: 'MY',
        action: 'pass',
        decisionPrice: 10,
        note: '',
        recordedAt: '2026-07-26T00:00:00.000Z',
        outcomePrice: null,
        resolvedAt: null,
    }])[0];
    assertEqual(migrated?.horizon, '3M', 'legacy paper decisions migrate to the default review horizon');
    assertEqual(migrated?.benchmark.symbol, 'KLCI', 'legacy Malaysia decisions migrate to the local benchmark');
    const candidateHistory = [
        portfolioChartPoint('2026-07-27', 100),
        { ...portfolioChartPoint('2026-09-01', 90), low: 80, high: 110 },
        { ...portfolioChartPoint('2026-10-23', 120), low: 115, high: 120 },
        portfolioChartPoint('2026-10-26', 115),
    ];
    const benchmarkHistory = [
        portfolioChartPoint('2026-07-27', 500),
        portfolioChartPoint('2026-10-26', 525),
    ];
    const evaluated = evaluatePaperDecision(added[0]!, candidateHistory, benchmarkHistory);
    assertEqual(evaluated.outcomePrice, 115, 'decision review resolves from the first available session after the horizon');
    assertEqual(evaluated.benchmark.outcomePrice, 525, 'decision review freezes the matching benchmark observation');
    assertEqual(evaluated.maxDrawdownPercent, -20, 'decision review measures maximum path drawdown from the recorded price');
    assertEqual(evaluated.maxFavorableMovePercent, 20, 'decision review measures maximum favorable path move from the recorded price');
    const evaluatedWithBenchmarkBackfill = evaluatePaperDecision(
        { ...added[0]!, benchmark: { ...added[0]!.benchmark, entryPrice: null } },
        candidateHistory,
        benchmarkHistory,
    );
    assertEqual(evaluatedWithBenchmarkBackfill.benchmark.entryPrice, 500, 'decision review backfills a missing benchmark entry from the first session after recording');
    assertEqual(
        evaluatePaperDecision(evaluated, [...candidateHistory, portfolioChartPoint('2026-10-27', 140)], benchmarkHistory).outcomePrice,
        115,
        'decision review never rewrites a frozen outcome',
    );
    const reviewAnalytics = buildDecisionReviewAnalytics(Array.from({ length: 5 }, (_, index) => ({
        ...evaluated,
        id: `MSFT:review-${index}`,
        action: index === 4 ? 'pass' as const : 'act' as const,
    })));
    assertEqual(reviewAnalytics.resolvedCount, 5, 'decision review analytics counts frozen outcomes');
    assertEqual(reviewAnalytics.benchmarkedCount, 5, 'decision review analytics counts comparable benchmark outcomes');
    assertEqual(reviewAnalytics.averageRelativeReturnPercent, 10, 'decision review analytics reports benchmark-relative return');
    assertEqual(reviewAnalytics.byHorizon[0]?.evidenceLevel, 'preliminary', 'decision review cohorts require five observations before showing statistics');
    assertEqual(reviewAnalytics.byAction.find((group) => group.label === 'pass')?.averageDecisionEffectPercent, null, 'small decision cohorts withhold false precision');
    assertEqual(
        buildDecisionReviewAnalytics(Array.from({ length: 20 }, (_, index) => ({ ...evaluated, id: `MSFT:established-${index}` }))).byHorizon[0]?.evidenceLevel,
        'established',
        'decision review cohorts require twenty observations for established evidence',
    );
    const batchResolved = resolveDuePaperDecisions(
        [added[0]!, { ...added[0]!, id: 'NVDA:pending', symbol: 'NVDA' }],
        new Map([
            [decisionReviewHistoryKey('MSFT', 'US'), candidateHistory],
            [decisionReviewHistoryKey('VOO', 'US'), benchmarkHistory],
            [decisionReviewHistoryKey('MSFT', 'MY'), [portfolioChartPoint('2026-10-26', 1)]],
        ]),
    );
    assertEqual(batchResolved[0]?.outcomePrice, 115, 'decision review batch resolves histories that are available');
    assertEqual(batchResolved[1]?.outcomePrice, null, 'decision review batch preserves pending decisions with unavailable history');
    const resolved = resolvePaperDecision(added, decision.id, 112, '2026-08-26T00:00:00.000Z');
    assertEqual(paperDecisionMarketMovePercent(resolved[0]!), 12, 'paper decision tracker calculates the later observed market move');
    assertEqual(resolvePaperDecision(added, decision.id, 0, '2026-08-26T00:00:00.000Z')[0]?.outcomePrice, null, 'paper decision tracker rejects a non-positive outcome through boundary parsing');
    assertEqual(parsePaperDecisions([{ ...decision, decisionPrice: Number.NaN }]).length, 0, 'paper decision tracker rejects malformed prices');
    assertEqual(parsePaperDecisions([{ ...decision, symbol: ' msft ', note: 'x'.repeat(300) }])[0]?.symbol, 'MSFT', 'paper decision tracker normalizes symbols');
    assertEqual(parsePaperDecisions([{ ...decision, symbol: ' msft ', note: 'x'.repeat(300) }])[0]?.note.length, 240, 'paper decision tracker bounds notes');
    assertEqual(removePaperDecision(resolved, decision.id).length, 0, 'paper decision tracker removes only the selected entry');
    const many = Array.from({ length: paperDecisionLimit + 2 }, (_, index) => ({
        ...decision,
        id: `MSFT:${index}`,
        recordedAt: `2026-07-26T${String(index % 24).padStart(2, '0')}:${String(index).padStart(3, '0')}:00.000Z`,
    }));
    assertEqual(parsePaperDecisions(many).length, paperDecisionLimit, 'paper decision tracker enforces its storage bound');
};

const runRelationshipGraphTests = () => {
    const graph = buildResearchRelationshipGraph([
        { symbol: 'MSFT', market: 'US', sector: 'Technology', providers: ['SEC EDGAR', 'Yahoo Finance', 'SEC EDGAR'] },
        { symbol: 'NVDA', market: 'US', sector: 'Technology', providers: ['SEC EDGAR'] },
        { symbol: 'MAYBANK', market: 'MY', sector: 'Financials', providers: ['Bursa Malaysia'] },
        { symbol: 'CIMB', market: 'MY', sector: 'Financials', providers: ['Bursa Malaysia', 'Company IR'] },
    ]);
    assertEqual(graph.nodes.length, 4, 'relationship graph preserves distinct ticker nodes');
    assertEqual(graph.edges.length, 2, 'relationship graph emits only explicit sector or provider links');
    const us = graph.edges.find((edge) => edge.id === 'MSFT:NVDA');
    assertEqual(us?.sharedSector, 'Technology', 'relationship graph reports the shared sector');
    assertEqual(us?.sharedProviders[0], 'SEC EDGAR', 'relationship graph reports a deduplicated shared provider');
    assertEqual(us?.strength, 2, 'relationship graph strength counts explicit relationship reasons');
    const malaysiaLink = relationshipsForSymbol(graph, 'MAYBANK')[0];
    assertEqual(malaysiaLink?.left === 'MAYBANK' ? malaysiaLink.right : malaysiaLink?.left, 'CIMB', 'relationship graph retrieves focused ticker links');
    assertEqual(buildResearchRelationshipGraph([
        { symbol: 'A', market: 'US', sector: 'Unknown', providers: [] },
        { symbol: 'B', market: 'US', sector: 'Unknown', providers: [] },
    ]).edges.length, 0, 'relationship graph does not infer a link from market membership alone');
};

const runSourceHealthTests = () => {
    const base = {
        category: 'research' as const,
        checkedAt: null,
        lastSuccessfulAt: null,
        latencyMs: null,
        cadence: 'On request',
        coverage: 'Test coverage',
        affectedFeatures: ['Research'],
        detail: 'Test evidence',
    };
    const entries: SourceHealthEntry[] = [
        { ...base, id: 'healthy', name: 'Healthy', status: 'healthy' },
        { ...base, id: 'degraded', name: 'Degraded', status: 'degraded' },
        { ...base, id: 'unconfigured', name: 'Unconfigured', status: 'unconfigured' },
        { ...base, id: 'unchecked', name: 'Unchecked', status: 'unchecked' },
    ];
    const summary = summarizeSourceHealth(entries);
    assertEqual(summary.healthy, 1, 'source health summary counts healthy sources');
    assertEqual(summary.degraded, 1, 'source health summary counts degraded sources');
    assertEqual(summary.unconfigured, 1, 'source health summary counts unconfigured sources');
    assertEqual(summary.unchecked, 1, 'source health summary keeps unchecked separate from healthy');
};

const runMarketReplayTests = () => {
    const snapshot = (date: string, score: number, tier: MarketReplaySnapshot['summary']['tier'], agreementPercent: number, componentScore: number): MarketReplaySnapshot => ({
        summary: {
            date,
            score,
            tier,
            origin: 'observed',
            coverageNote: null,
            hasFullEvidence: true,
            updatedAt: `${date}T12:00:00.000Z`,
        },
        confidenceLevel: 'medium',
        agreementPercent,
        majoritySignal: 'buy',
        components: [{
            key: 'trend',
            displayName: 'Trend',
            rawValue: componentScore,
            score: componentScore,
            weight: 0.4,
            signal: 'positive',
            lastUpdated: date,
        }],
        scoreDrivers: [],
        indexTrend: [],
        signalQuality: { freshness: 'current' },
        interpretationContext: { limitation: 'Point-in-time market evidence only.' },
        metadata: { scoring_model_version: 'v2' },
    });
    const current = snapshot('2026-07-25', 72, 'buy', 75, 80);
    const previous = snapshot('2026-07-18', 65, 'neutral', 60, 70);
    const comparison = compareMarketReplaySnapshots(current, previous);
    assertEqual(comparison.scoreDelta, 7, 'market replay compares stored composite scores');
    assertEqual(comparison.agreementDelta, 15, 'market replay compares stored evidence agreement');
    assertEqual(comparison.tierChanged, true, 'market replay reports stored tier changes');
    assertEqual(comparison.changedComponents, 1, 'market replay counts changed persisted components');
    assertEqual(parseMarketReplayIndex({ success: true, data: {
        market: 'US', mode: 'standard', enableSocial: true, summaries: [current.summary],
    } }).summaries.length, 1, 'market replay index boundary accepts the complete contract');
    assertEqual(parseMarketReplaySnapshot({ success: true, data: current }).components.length, 1, 'market replay detail boundary accepts the complete contract');
    assertThrows(() => parseMarketReplaySnapshot({ success: true, data: {
        ...current, components: [{ ...current.components[0], score: '80' }],
    } }), 'market replay detail boundary rejects malformed component values');

    const baseRecord = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const packetRecord = {
        ...baseRecord,
        revision: 3,
        notes: 'Prefer durable free cash flow.',
        decisionJournal: {
            ...baseRecord.decisionJournal,
            decision: 'Ready' as const,
            confidence: 'high' as const,
            nextReviewAt: '2026-08-25',
        },
        acceptedEvidence: [{
            id: 'revenue',
            title: 'Revenue evidence',
            summary: 'Revenue grew.',
            target: 'bullCase' as const,
            tone: 'positive' as const,
            mode: 'evidence' as const,
            acceptedAt: '2026-07-25T00:00:00.000Z',
            sources: [{
                id: 'revenue-growth',
                label: 'Revenue growth',
                value: '14%',
                source: 'SEC EDGAR',
                sourceUrl: 'https://www.sec.gov/edgar',
                reportingPeriod: '2025-06-30',
            }],
        }],
    };
    const packet = buildResearchDecisionPacket({
        record: packetRecord,
        generatedAt: '2026-07-25T05:00:00.000Z',
        marketContext: current,
    });
    assertEqual(packet.filename, 'msft-decision-packet-2026-07-25.md', 'decision packet uses a deterministic sanitized filename');
    assertEqual(packet.recordRevision, 3, 'decision packet freezes the saved research revision');
    assertEqual(packet.marketSnapshotDate, '2026-07-25', 'decision packet records the persisted market snapshot date');
    assertEqual(packet.markdown.includes('- Decision: Ready'), true, 'decision packet includes the saved decision');
    assertEqual(packet.markdown.includes('- Confidence: high'), true, 'decision packet includes saved confidence');
    assertEqual(packet.markdown.includes('- Next review: 2026-08-25'), true, 'decision packet includes the next review date');
    assertEqual(packet.markdown.includes('[SEC EDGAR](https://www.sec.gov/edgar)'), true, 'decision packet preserves accepted evidence provenance');
    assertEqual(packet.markdown.includes('This packet freezes saved research state'), true, 'decision packet states its point-in-time limitation');
};

const runProductAnalyticsTests = () => {
    const event = (
        id: string,
        name: ProductAnalyticsEvent['name'],
        occurredAt: string,
        overrides: Partial<ProductAnalyticsEvent> = {},
    ): ProductAnalyticsEvent => ({
        id,
        sessionId: '10000000-0000-4000-8000-000000000001',
        name,
        surface: 'research',
        workspace: 'research',
        source: null,
        attributes: {},
        occurredAt,
        ...overrides,
    });
    const now = new Date('2026-07-25T12:00:00.000Z');
    const opened = event('10000000-0000-4000-8000-000000000002', 'review_opened', '2026-07-24T09:00:00.000Z', {
        workspace: 'alerts',
        source: 'alerts',
    });
    const saved = event('10000000-0000-4000-8000-000000000003', 'review_saved', '2026-07-24T09:05:00.000Z', {
        source: 'alerts',
        attributes: { decision: 'Ready', result: 'success' },
    });
    const exported = event('10000000-0000-4000-8000-000000000004', 'packet_exported', '2026-07-25T10:00:00.000Z', {
        workspace: 'packets',
        attributes: { format: 'markdown' },
    });
    const viewed = event('10000000-0000-4000-8000-000000000005', 'workspace_viewed', '2026-07-25T08:00:00.000Z', {
        workspace: 'portfolio',
    });
    const old = event('10000000-0000-4000-8000-000000000006', 'workspace_viewed', '2025-01-01T00:00:00.000Z');
    const state = parseProductAnalyticsState({
        version: 1,
        enabled: true,
        events: [opened, saved, exported, viewed, old, { ...viewed, id: 'invalid', attributes: { symbol: 'MSFT' } }],
    }, now);
    assertEqual(state.events.length, 4, 'product analytics drops expired and malformed local events');
    const appended = appendProductAnalyticsEvent(state, viewed, now);
    assertEqual(appended.events.length, 4, 'product analytics deduplicates event ids');
    const summary = buildProductAnalyticsSummary(state.events, 7, now);
    assertEqual(summary.activeDays, 2, 'product analytics counts active UTC days');
    assertEqual(summary.sessions, 1, 'product analytics counts browser sessions without a user identifier');
    assertEqual(summary.meaningfulActions, 3, 'product analytics excludes workspace views from meaningful actions');
    assertEqual(summary.reviewOpened, 1, 'product analytics counts guided review opens');
    assertEqual(summary.reviewSaved, 1, 'product analytics counts successful saved reviews');
    assertEqual(summary.reviewCompletionPercent, 100, 'product analytics derives bounded open-to-save completion');
    assertEqual(summary.guidedReviewSaved, 1, 'product analytics attributes a saved review to its workflow source');
    assertEqual(summary.packetExports, 1, 'product analytics counts decision packet exports');
    assertEqual(summary.pathways[0]?.source, 'alerts', 'product analytics reports the guided source without ticker content');
    assertEqual(summary.workspaces[0]?.workspace, 'portfolio', 'product analytics reports workspace adoption');
    assertEqual(summary.daily.length, 7, 'product analytics fills every day in the selected window');
};

const runDecisionTests = () => {
    const record = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    assertEqual(getResearchAction(record), 'Watch', 'new record starts on watch');

    const ready = {
        ...record,
        thesisStrength: 'high' as const,
        inBuyZone: true,
        valuationState: 'fair' as const,
        checklist: {
            understandBusiness: true,
            revenueGrowingOrStable: true,
            marginsHealthyOrImproving: true,
            debtManageable: true,
            freeCashFlowPositiveOrImproving: true,
            valuationReasonable: true,
            catalystOrCompoundingReason: true,
            downsideAcceptable: true,
            betterThanCashOrIndex: false,
        },
    };
    assertEqual(getResearchAction(ready), 'Ready', 'eight checks in buy zone becomes ready');
    assertEqual(getResearchAction({ ...ready, thesisStrength: 'low' }), 'Avoid', 'low thesis takes precedence');
};

const runTechnicalTests = () => {
    const closes = Array.from({ length: 220 }, (_, index) => index + 1);
    const snapshot = calculateTechnicals(closes, closes.map((value) => value * 100));
    assertEqual(snapshot.ma50, 195.5, '50-day moving average');
    assertEqual(snapshot.ma200, 120.5, '200-day moving average');
    assertEqual(snapshot.rsi14, 100, 'RSI for uninterrupted gains');
    assertEqual(snapshot.low52Week, 1, '52-week low');
    assertEqual(snapshot.high52Week, 220, '52-week high');
    assertEqual(snapshot.averageVolume20, 21050, '20-day average volume');
    const chart = parseYahooResearchChart({ chart: { result: [{
        meta: { symbol: 'MSFT', currency: 'USD', regularMarketPrice: 101, chartPreviousClose: 80 },
        timestamp: [1704067200, 1704153600, 1704240000],
        indicators: {
            quote: [{
                open: [98, null, 100], high: [100, null, 102], low: [97, null, 99],
                close: [99, 100, 101], volume: [10, 20, 30],
            }],
            adjclose: [{ adjclose: [98, 99, 100] }],
        },
    }] } });
    assertEqual(chart.dailyChangePercent, 1, 'daily change uses the prior session, not the range baseline');
    assertEqual(Object.hasOwn(chart.history, 'adjustedCloses'), true, 'Yahoo chart preserves adjusted closes for return comparisons');
    assertEqual(chart.history.adjustedCloses.join(','), '98,99,100', 'Yahoo chart preserves adjusted-close values');
    assertEqual(chart.chart.points.length, 2, 'Yahoo chart drops incomplete candles without shifting adjacent fields');
    assertEqual(chart.chart.points[1]?.time, '2024-01-03', 'Yahoo chart preserves timestamp alignment');
    assertEqual(chart.chart.points[1]?.volume, 30, 'Yahoo chart preserves volume alignment');
    const series = calculateTechnicalSeries(closes.map((close) => ({ high: close + 2, low: close - 2, close, volume: close * 100 })));
    assertEqual(series.at(-1)?.rsi14, 100, 'technical series exposes aligned RSI history');
    assertEqual(series.at(-1)?.averageVolume20, 21050, 'technical series exposes aligned average volume');
    assertEqual(series[18]?.ema20, null, 'EMA20 remains null during warmup');
    assertEqual(series[49]?.ema20 !== null && series[49]?.ema50 !== null, true, 'EMA series becomes available after its warmup');
    assertEqual(series[199]?.sma200 !== null && series[199]?.ma200 === series[199]?.sma200, true, 'SMA200 exposes a compatible MA200 alias');
    assertEqual(series[12]?.atr14, null, 'ATR14 remains null during warmup');
    assertEqual(series.at(-1)?.atrPercent14 !== null, true, 'technical series exposes ATR percentage');
    assertEqual(series.at(-1)?.atr14, 4, 'technical series exposes ATR14');
    assertEqual(series.at(-1)?.plusDi14 !== null && series.at(-1)?.minusDi14 !== null, true, 'technical series exposes directional indicators');
    assertEqual(series.at(-1)?.adx14, 100, 'rising series converges to ADX 100');
    assertEqual(series[25]?.adx14, null, 'ADX14 remains null until its second warmup window');
    assertEqual(series.at(-1)?.supertrendDirection, 1, 'rising series stays in a positive supertrend');
    assertEqual(series[8]?.supertrend, null, 'Supertrend remains null during its configured warmup');
    assertEqual(series.at(-1)?.anchoredVwap !== null, true, 'technical series exposes range-start anchored VWAP');
    const flatPoints = Array.from({ length: 30 }, () => ({ high: 10, low: 10, close: 10, volume: 100 }));
    const flatSeries = calculateTechnicalSeries(flatPoints, { supertrendPeriod: 5, supertrendMultiplier: 2 });
    assertEqual(flatSeries.at(-1)?.adx14, 0, 'flat series has zero ADX');
    assertEqual(flatSeries.at(-1)?.plusDi14, 0, 'flat series has zero positive directional movement');
    assertEqual(flatSeries.at(-1)?.minusDi14, 0, 'flat series has zero negative directional movement');
    assertEqual(flatSeries.at(-1)?.anchoredVwap, 10, 'flat series anchored VWAP equals its constant price');
    assertEqual(flatSeries[3]?.supertrend, null, 'configured Supertrend period controls warmup');
    assertEqual(flatSeries[4]?.supertrend, 10, 'configured Supertrend multiplier is applied to flat data');
    const reversalPoints = [
        ...Array.from({ length: 30 }, (_, index) => index + 10),
        ...Array.from({ length: 30 }, (_, index) => 39 - index * 1.5),
    ].map((close) => ({ high: close + 1, low: close - 1, close, volume: 100 }));
    const reversalSeries = calculateTechnicalSeries(reversalPoints, { supertrendPeriod: 5, supertrendMultiplier: 2 });
    assertEqual(reversalSeries.at(-1)?.supertrendDirection, -1, 'Supertrend reverses after a sustained downside break');
    const configuredTrend = calculateTechnicalSeries(closes.slice(0, 10).map((close) => ({ high: close + 2, low: close - 2, close, volume: 100 })), { supertrendPeriod: 5, supertrendMultiplier: 2 });
    assertEqual(configuredTrend[4]?.supertrend, -3, 'configured Supertrend multiplier changes the band');
    assertEqual(series.at(-1)?.macdSignal !== null, true, 'technical series exposes MACD signal history');
    assertEqual(series.at(-1)?.macdHistogram !== null, true, 'technical series exposes MACD histogram history');
    const chartPoints = series.map((technical, index) => ({
        time: `2025-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
        open: closes[index] - 1, high: closes[index] + 2, low: closes[index] - 2, close: closes[index],
        volume: closes[index] * 100,
        ...technical,
    }));
    const rangeVwap = anchoredVwap(chartPoints.slice(-3), 'range-start');
    assertEqual(rangeVwap.length, 3, 'visible-range anchored VWAP includes its anchor bar');
    assertEqual(rangeVwap[0]?.value, 218, 'visible-range anchored VWAP starts from typical price');
    const profile = volumeProfile(chartPoints.slice(-20), 5);
    assertEqual(profile.reduce((sum, bin) => sum + bin.volume, 0), chartPoints.slice(-20).reduce((sum, point) => sum + (point.volume ?? 0), 0), 'volume profile conserves visible volume');
    assertEqual(profile.filter((bin) => bin.isPointOfControl).length, 1, 'volume profile selects one deterministic POC');
    const noVolume = chartPoints.slice(-3).map((point, index) => ({ ...point, volume: index === 0 ? null : 0 }));
    assertEqual(anchoredVwap(noVolume, 'range-start').length, 0, 'anchored VWAP stays unavailable without valid volume');
    assertEqual(volumeProfile(noVolume).length, 0, 'volume profile stays unavailable without valid volume');
    const relative = relativeStrengthSeries(chartPoints.slice(-3), chartPoints.slice(-3).map((point) => ({ ...point, close: point.close / 2 })));
    assertEqual(relative[0]?.value, 100, 'relative strength rebases at the visible range start');
    assertEqual(relative.at(-1)?.value, 100, 'constant candidate-to-benchmark ratio stays at 100');
    assertEqual(relativeStrengthSeries(chartPoints.slice(-3), [chartPoints.at(-3)!, chartPoints.at(-1)!]).length, 2, 'relative strength intersects unequal trading dates');
    assertEqual(relativeStrengthSeries(chartPoints.slice(-3), [{ ...chartPoints.at(-3)!, close: 0 }]).length, 0, 'relative strength rejects a zero benchmark baseline');
    assertEqual(toYahooSymbol('1155', 'MY'), '1155.KL', 'Malaysia ticker uses Yahoo KL suffix');
    assertEqual(toYahooSymbol('KLCI', 'MY'), '^KLSE', 'KLCI comparative index uses Yahoo KLSE symbol');
};

const runBenchmarkTests = () => {
    const candidate = { history: { closes: [100, 130], adjustedCloses: [100, 130], volumes: [] } };
    const baseline = { history: { closes: [100, 120], adjustedCloses: [100, 120], volumes: [] } };
    const benchmark = buildResearchBenchmark(candidate, baseline);
    assertEqual(benchmark.candidateReturnPercent, 30, 'benchmark calculates candidate return from adjusted closes');
    assertEqual(benchmark.baselineReturnPercent, 20, 'benchmark calculates passive baseline return from adjusted closes');
    assertEqual(benchmark.relativeReturnPercent, 10, 'benchmark calculates relative return');
    assertEqual(benchmark.returnBasis, 'adjusted close', 'benchmark labels adjusted-close comparisons');
    assertEqual(benchmark.status, 'outperformed', 'benchmark identifies outperformance');
    assertEqual(buildResearchBenchmark(candidate, null).status, 'unavailable', 'benchmark degrades when passive data is unavailable');
    assertEqual(notApplicableResearchBenchmark.status, 'not-applicable', 'Malaysia keeps the US benchmark out of scope');
};

const runValuationTests = () => {
    const valuation = calculateValuation({
        price: 20, shares: 100, annualRevenue: 1000, annualNetIncome: 200,
        freeCashFlow: 100, debt: 300, cash: 500,
    });
    assertEqual(valuation.marketCap, 2000, 'market cap uses price and shares');
    assertEqual(valuation.priceEarnings, 10, 'P/E uses market cap and annual net income');
    assertEqual(valuation.priceSales, 2, 'price to sales uses annual revenue');
    assertEqual(valuation.freeCashFlowYieldPercent, 5, 'FCF yield uses market cap');
    assertEqual(valuation.netCash, 200, 'net cash subtracts debt');

    const unavailable = calculateValuation({
        price: null, shares: null, annualRevenue: null, annualNetIncome: null,
        freeCashFlow: null, debt: null, cash: null,
    });
    assertEqual(unavailable.marketCap, null, 'missing valuation inputs remain unavailable');
    assertEqual(calculateValuation({
        price: 20, shares: 100, annualRevenue: 1000, annualNetIncome: -20,
        freeCashFlow: 100, debt: 300, cash: 500,
    }).priceEarnings, null, 'loss-making companies do not display a misleading negative P/E');
};

const runDiscoveryTests = () => {
    const strong = scoreDiscoveryCandidate({
        symbol: 'MU', name: 'Micron', price: 150, momentum3MonthPercent: 32,
        momentum6MonthPercent: 58, distanceFromMa50Percent: 9, averageDollarVolume: 500_000_000,
        volumeSpikeRatio: 1.4, maxDailyMovePercent: 8, annualizedVolatilityPercent: 42,
        aboveMa50: true, aboveMa200: true,
    });
    assertEqual(strong.risk, 'low', 'liquid sustained trend has low manipulation-pattern risk');
    assertEqual(strong.trendScore >= 75, true, 'sustained momentum earns a strong trend score');

    const spike = scoreDiscoveryCandidate({
        symbol: 'SPIKE', name: 'Spike', price: 8, momentum3MonthPercent: 120,
        momentum6MonthPercent: 130, distanceFromMa50Percent: 55, averageDollarVolume: 5_000_000,
        volumeSpikeRatio: 8, maxDailyMovePercent: 45, annualizedVolatilityPercent: 140,
        aboveMa50: true, aboveMa200: true,
    });
    assertEqual(spike.risk, 'high', 'thin parabolic move is high risk');
    assertEqual(spike.flags.length >= 4, true, 'high-risk candidate explains its flags');
};

const runAlertTests = () => {
    const zone = parseBuyZone('$95 - $105');
    assertEqual(zone?.[0], 95, 'buy zone lower bound');
    assertEqual(zone?.[1], 105, 'buy zone upper bound');
    assertEqual(parseBuyZone('review later'), null, 'invalid buy zone remains unset');

    const alerts = evaluateResearchAlerts('MU', '$95 - $105', {
        price: 100, dailyChangePercent: -8.5, ma50: 110, ma200: 90, rsi14: 28,
    });
    assertEqual(alerts.some((alert) => alert.title === 'Inside buy zone'), true, 'price inside configured zone alerts');
    assertEqual(alerts.some((alert) => alert.title === 'Large daily move'), true, 'large daily move alerts');
    assertEqual(alerts.some((alert) => alert.title === 'Oversold review'), true, 'low RSI alerts without claiming a buy');
    assertEqual(alerts.some((alert) => alert.title === 'Below 50-day average'), true, 'medium trend weakness alerts');
};

const runStructuredTriggerTests = () => {
    const rules = [
        { id: 'price', enabled: true, purpose: 'opportunity-review' as const, metric: 'price' as const, operator: 'above' as const, threshold: 100 },
        { id: 'rsi', enabled: true, purpose: 'thesis-invalidation' as const, metric: 'rsi14' as const, operator: 'above' as const, threshold: 55 },
        { id: 'ma50', enabled: true, purpose: 'opportunity-review' as const, metric: 'price-vs-ma50-percent' as const, operator: 'above' as const, threshold: 10 },
        { id: 'ma200', enabled: true, purpose: 'thesis-invalidation' as const, metric: 'price-vs-ma200-percent' as const, operator: 'above' as const, threshold: 40 },
        { id: 'earnings', enabled: true, purpose: 'scheduled-evidence-review' as const, metric: 'earnings-within-days' as const, operator: 'within' as const, threshold: 5 },
        { id: 'research-age', enabled: true, purpose: 'scheduled-evidence-review' as const, metric: 'research-age-days' as const, operator: 'above' as const, threshold: 30 },
        { id: 'evidence-age', enabled: true, purpose: 'scheduled-evidence-review' as const, metric: 'evidence-age-days' as const, operator: 'above' as const, threshold: 30 },
        { id: 'pe', enabled: true, purpose: 'thesis-invalidation' as const, metric: 'price-earnings' as const, operator: 'above' as const, threshold: 20 },
        { id: 'fcf', enabled: true, purpose: 'opportunity-review' as const, metric: 'free-cash-flow-yield-percent' as const, operator: 'above' as const, threshold: 5 },
        { id: 'growth', enabled: true, purpose: 'opportunity-review' as const, metric: 'revenue-growth-percent' as const, operator: 'above' as const, threshold: 10 },
    ];
    const structuredTriggers = parseResearchStructuredTriggerSet({ version: 1, migrationState: 'current', rules });
    assertEqual(structuredTriggers.rules.length, 10, 'structured trigger parser accepts the bounded maximum');
    assertThrows(() => parseResearchStructuredTriggerSet({ version: 1, rules: [...rules, { ...rules[0], id: 'eleventh', threshold: 101 }] }), 'structured trigger parser rejects more than ten rules');
    assertThrows(() => parseResearchStructuredTriggerSet({ version: 1, rules: [{ ...rules[0], id: 'duplicate-a' }, { ...rules[0], id: 'duplicate-b' }] }), 'structured trigger parser rejects duplicate semantic conditions');
    assertThrows(() => parseResearchStructuredTriggerSet({ version: 1, rules: [{ ...rules[0], operator: 'within' }] }), 'structured trigger parser rejects incompatible metric operators');
    assertThrows(() => parseResearchStructuredTriggerSet({ version: 1, rules: [{ ...rules[4], threshold: 1.5 }] }), 'structured trigger parser rejects fractional day thresholds');
    assertThrows(() => parseResearchStructuredTriggerSet({ version: 1, rules: [{ ...rules[0], threshold: Number.NaN }] }), 'structured trigger parser rejects non-finite thresholds');

    const migrated = parsePersistedResearchMonitoringRules({
        buyZone: true, belowMa200: true, rsiBelow: 30, rsiAbove: null, earningsWithinDays: 21, reviewAgeDays: 30,
    });
    assertEqual(migrated.structuredTriggers.migrationState, 'migrated-empty', 'legacy monitoring JSON migrates to an empty versioned rule set');
    assertEqual(migrated.structuredTriggers.rules.length, 0, 'legacy migration does not infer structured rules');
    const recovered = parsePersistedResearchMonitoringRules({ structuredTriggers: { version: 9, rules: 'bad' } });
    assertEqual(recovered.structuredTriggers.migrationState, 'invalid-recovered', 'malformed persisted rules fail closed without corrupting the research record');
    assertEqual(parseResearchRecord({ ...createResearchRecord({ symbol: 'EMPTY', market: 'US', companyName: 'Empty' }), monitoringRules: undefined }).monitoringRules.structuredTriggers.rules.length, 0, 'records without monitoring JSON default to an empty valid rule set');

    const acceptedEvidence = [{
        id: 'evidence-1',
        title: 'Revenue evidence',
        summary: 'Bounded fixture.',
        target: 'bullCase' as const,
        tone: 'positive' as const,
        mode: 'evidence' as const,
        acceptedAt: '2026-07-01T00:00:00.000Z',
        sources: [{
            id: 'source-1', label: 'Revenue', value: '12%', source: 'SEC EDGAR',
            sourceUrl: 'https://www.sec.gov/edgar', reportingPeriod: '2026-06-15',
        }],
    }];
    const record = {
        ...createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' }),
        lastReviewedAt: '2026-06-01',
        acceptedEvidence,
        monitoringRules: { ...defaultResearchMonitoringRules, structuredTriggers },
    };
    const snapshot: ResearchSnapshot = {
        symbol: 'MSFT', market: 'US', fetchedAt: '2026-07-20T12:00:00.000Z',
        benchmark: {
            baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y',
            candidateReturnPercent: null, baselineReturnPercent: null, relativeReturnPercent: null,
            returnBasis: null, status: 'unavailable',
        },
        quote: { name: 'Microsoft', currency: 'USD', price: 120, dailyChangePercent: 1 },
        fundamentals: {
            revenueGrowthPercent: 12, grossMarginPercent: null, operatingMarginPercent: null,
            freeCashFlow: 10, debt: 5, cash: 8, shares: 1, annualRevenue: 100,
            annualNetIncome: 10, reportingPeriod: '2025-06-30', shareChangePercent: null,
            source: 'SEC EDGAR', history: [],
        },
        valuation: {
            marketCap: 120, priceEarnings: 25, priceSales: 1.2, freeCashFlowYieldPercent: 6,
            netCash: 3, reportingPeriod: '2025-06-30', source: 'Yahoo Finance + SEC EDGAR',
        },
        technicals: {
            ma50: 100, ma200: 80, rsi14: 60, macd: null, low52Week: null,
            high52Week: null, averageVolume20: null, support: null, resistance: null,
        },
        chart: { interval: '1d', points: [] },
        sources: ['Yahoo Finance', 'SEC EDGAR'],
        warnings: [],
    };
    const context = {
        record,
        snapshot,
        snapshotStatus: 'available' as const,
        catalyst: {
            date: '2026-07-25', type: 'earnings' as const, timing: 'after-hours' as const,
            fiscalQuarterEnding: null, epsForecast: null, source: 'Nasdaq earnings calendar' as const,
        },
        earningsStatus: 'available' as const,
        now: new Date('2026-07-21T12:00:00.000Z'),
    };
    const evaluations = evaluateResearchStructuredTriggers(context);
    assertEqual(evaluations.every((evaluation) => evaluation.status === 'matched'), true, 'all supported structured metrics evaluate deterministic matches');
    assertEqual(evaluations.find((evaluation) => evaluation.rule.id === 'pe')?.detail.includes('annual period 2025-06-30'), true, 'valuation matches retain reporting-period provenance');
    assertEqual(evaluations.find((evaluation) => evaluation.rule.id === 'price')?.severity, 'opportunity', 'purpose fixes alert severity without changing match semantics');

    const equalityRules = parseResearchStructuredTriggerSet({ version: 1, rules: [
        { ...rules[0], id: 'price-equal', threshold: 120 },
        { ...rules[4], id: 'earnings-equal', threshold: 4 },
        { ...rules[5], id: 'age-equal', threshold: 50 },
    ] });
    const equality = evaluateResearchStructuredTriggers({
        ...context,
        record: { ...record, monitoringRules: { ...record.monitoringRules, structuredTriggers: equalityRules } },
    });
    assertEqual(equality.find((item) => item.rule.id === 'price-equal')?.status, 'not-matched', 'strict above comparison does not match equality');
    assertEqual(equality.find((item) => item.rule.id === 'earnings-equal')?.status, 'matched', 'within-days comparison includes the configured boundary');
    assertEqual(equality.find((item) => item.rule.id === 'age-equal')?.status, 'not-matched', 'age beyond comparison does not match equality');

    const disabled = evaluateResearchStructuredTriggers({
        ...context,
        record: { ...record, monitoringRules: { ...record.monitoringRules, structuredTriggers: { version: 1, migrationState: 'current', rules: [{ ...rules[0], enabled: false }] } } },
    });
    assertEqual(disabled[0]?.status, 'disabled', 'disabled rules never evaluate as matches');
    const missingSnapshot = evaluateResearchStructuredTriggers({
        ...context,
        snapshot: null,
        snapshotStatus: 'unavailable',
        record: { ...record, monitoringRules: { ...record.monitoringRules, structuredTriggers: { version: 1, migrationState: 'current', rules: [rules[0]] } } },
    });
    assertEqual(missingSnapshot[0]?.status, 'unavailable', 'missing current snapshot produces unavailable coverage');
    const staleSnapshot = evaluateResearchStructuredTriggers({
        ...context,
        snapshot: { ...snapshot, fetchedAt: '2026-07-01T00:00:00.000Z' },
        record: { ...record, monitoringRules: { ...record.monitoringRules, structuredTriggers: { version: 1, migrationState: 'current', rules: [rules[1]] } } },
    });
    assertEqual(staleSnapshot[0]?.status, 'unavailable', 'stale current metrics produce unavailable coverage rather than false non-matches');
    const noEvidence = evaluateResearchStructuredTriggers({
        ...context,
        record: { ...record, acceptedEvidence: [], monitoringRules: { ...record.monitoringRules, structuredTriggers: { version: 1, migrationState: 'current', rules: [rules[6]] } } },
    });
    assertEqual(noEvidence[0]?.status, 'unavailable', 'missing dated evidence produces unavailable coverage');
    const degradedFundamental = evaluateResearchStructuredTriggers({
        ...context,
        snapshot: { ...snapshot, fundamentals: { ...snapshot.fundamentals, revenueGrowthPercent: null, source: null }, warnings: ['SEC unavailable'] },
        snapshotStatus: 'degraded',
        record: { ...record, monitoringRules: { ...record.monitoringRules, structuredTriggers: { version: 1, migrationState: 'current', rules: [rules[9]] } } },
    });
    assertEqual(degradedFundamental[0]?.status, 'unavailable', 'provider-degraded fundamental inputs stay unavailable');
    assertEqual(parseResearchStructuredTriggerSet({ version: 1, rules: rules.slice(0, 9) }).rules.some((rule) => rule.id === 'growth'), false, 'rule removal is explicit and preserved by the parser');

    const frozen = appendResearchReview(record, '2026-07-21T12:00:00.000Z');
    const changed = {
        ...record,
        monitoringRules: { ...record.monitoringRules, structuredTriggers: { version: 1 as const, migrationState: 'current' as const, rules: [] } },
    };
    assertEqual(frozen.reviewHistory[0]?.monitoringRules.structuredTriggers.rules.length, 10, 'immutable review history freezes structured monitoring rules');
    assertEqual(changed.monitoringRules.structuredTriggers.rules.length, 0, 'later rule removal does not mutate the frozen review');
    const settingsOnly = prepareStoredResearchRecord(record, parseResearchUpdateInput({
        monitoringRules: changed.monitoringRules,
        whyInterested: 'must not save',
        checklist: { understandBusiness: true },
    }), 'settings');
    assertEqual(settingsOnly.whyInterested, record.whyInterested, 'settings-only trigger save cannot write authored thesis text');
    assertEqual(settingsOnly.checklist.understandBusiness, record.checklist.understandBusiness, 'settings-only trigger save cannot toggle checklist state');
    assertEqual(settingsOnly.decisionJournal.decision, record.decisionJournal.decision, 'settings-only trigger save cannot change the saved decision');
};

const runInboxTests = () => {
    const inputs = [
        { symbol: 'MSFT', market: 'US' as const, targetBuyZone: '$390 - $405', lastReviewedAt: '2026-05-10', acceptedEvidence: [], monitoringRules: defaultResearchMonitoringRules },
        { symbol: '1155', market: 'MY' as const, targetBuyZone: 'RM 110 - RM 115', lastReviewedAt: '2026-07-10', acceptedEvidence: [], monitoringRules: { ...defaultResearchMonitoringRules, rsiBelow: 40 } },
    ];
    const evaluations = [
        { input: inputs[0], state: { price: 380, dailyChangePercent: -2, ma50: 400, ma200: 400, rsi14: 42 }, failed: false, alerts: [], structuredTriggers: [], catalyst: null },
        { input: inputs[1], state: { price: 116, dailyChangePercent: 1, ma50: 120, ma200: 100, rsi14: 35 }, failed: false, alerts: [], structuredTriggers: [], catalyst: null },
    ];
    const catalysts = new Map([['MSFT', {
        date: '2026-07-22', type: 'earnings' as const, timing: 'after-hours' as const,
        fiscalQuarterEnding: 'Jun/2026', epsForecast: '3.12', source: 'Nasdaq earnings calendar' as const,
    }]]);
    const items = buildResearchInboxItems({ inputs, evaluations, catalysts, now: new Date('2026-07-15T12:00:00.000Z') });
    assertEqual(items.some((item) => item.kind === 'risk' && item.urgency === 'action'), true, 'inbox preserves actionable risk conditions');
    assertEqual(items.some((item) => item.kind === 'catalyst' && item.eventDate === '2026-07-22'), true, 'inbox includes dated earnings catalysts');
    assertEqual(items.some((item) => item.kind === 'stale' && item.symbol === 'MSFT'), true, 'inbox flags reviews older than thirty days');
    assertEqual(items.some((item) => item.title === 'Below 50-day average'), false, 'inbox excludes low-priority watch noise');
    assertEqual(items.some((item) => item.symbol === '1155' && item.title === 'RSI below 40'), true, 'inbox evaluates a custom RSI threshold');
    assertEqual(items.find((item) => item.title === 'Below 200-day average')?.proximity, '5.0% below MA200', 'inbox quantifies distance to technical trigger');
    assertEqual(items.find((item) => item.kind === 'stale')?.proximity, '66 days since review', 'inbox derives review age from the saved review date');
    const nextDayItems = buildResearchInboxItems({ inputs, evaluations, catalysts, now: new Date('2026-07-16T12:00:00.000Z') });
    assertEqual(nextDayItems.find((item) => item.kind === 'stale')?.proximity, '67 days since review', 'inbox review age advances automatically with the generated date');
    assertEqual(items.find((item) => item.kind === 'catalyst')?.proximity, '7 days away', 'inbox quantifies time to catalyst');
    assertEqual(items.findIndex((item) => item.kind === 'stale') < items.findIndex((item) => item.kind === 'catalyst'), true, 'inbox keeps action-needed reviews ahead of upcoming catalysts');
    const response = { success: true, data: { generatedAt: '2026-07-15T12:00:00.000Z', monitoredCount: 2, items, warnings: [] } };
    assertEqual(parseResearchInboxResponse(response).items.length, items.length, 'inbox boundary accepts typed items');
    assertThrows(() => parseResearchInboxResponse({ ...response, data: { ...response.data, items: [{ ...items[0], urgency: 'urgent' }] } }), 'inbox boundary rejects unknown urgency');
    assertThrows(() => parseResearchInboxResponse({ ...response, data: { ...response.data, items: [{ ...items[0], proximity: 4 }] } }), 'inbox boundary rejects invalid proximity');

    const snapshot = snapshotInboxItems(items);
    assertEqual(inboxItemChange(items[0], snapshot, true), null, 'unchanged inbox item stays quiet');
    assertEqual(inboxItemChange({ ...items[0], proximity: '4.0% below MA200' }, snapshot, true), '5.0% below MA200 → 4.0% below MA200', 'inbox explains changed trigger distance');
    assertEqual(inboxItemChange(items[0], {}, false), null, 'first browser check establishes a quiet baseline');
    assertEqual(inboxItemChange(items[0], {}, true), 'New since last check', 'later unseen item is called out as new');
    const parsedState = parseInboxState({ seen: { [items[0].id]: inboxItemSignature(items[0]), bad: 2 }, snoozed: { [items[0].id]: '2026-07-16T00:00:00.000Z' }, snapshot, checkedAt: '2026-07-15T12:00:00.000Z' });
    assertEqual(Object.keys(parsedState.seen).length, 1, 'inbox local state drops malformed seen entries');
};

const runCalendarTests = async () => {
    const inputs = parseResearchCalendarInputs([
        {
            symbol: 'MSFT', market: 'US', nextReviewAt: '2026-07-20', lastReviewedAt: '2026-05-10',
            reviewAgeDays: 30, earningsWithinDays: 21,
        },
        {
            symbol: '1155', market: 'MY', nextReviewAt: '2026-08-14', lastReviewedAt: '2026-07-10',
            reviewAgeDays: 30, earningsWithinDays: null,
        },
        {
            symbol: 'NVDA', market: 'US', nextReviewAt: '2026-08-15', lastReviewedAt: '2026-07-15',
            reviewAgeDays: null, earningsWithinDays: 21,
        },
    ]);
    const catalysts = [
        { symbol: 'MSFT', date: '2026-07-22', type: 'earnings' as const, timing: 'after-hours' as const, fiscalQuarterEnding: 'Jun/2026', epsForecast: '3.12', source: 'Nasdaq earnings calendar' as const },
        { symbol: 'MSFT', date: '2026-07-22', type: 'earnings' as const, timing: 'after-hours' as const, fiscalQuarterEnding: 'Jun/2026', epsForecast: '3.12', source: 'Nasdaq earnings calendar' as const },
        { symbol: 'NVDA', date: '2026-08-15', type: 'earnings' as const, timing: 'pre-market' as const, fiscalQuarterEnding: null, epsForecast: null, source: 'Nasdaq earnings calendar' as const },
    ];
    const calendar = buildResearchCalendar({
        inputs, catalysts, now: new Date('2026-07-15T12:00:00.000Z'), rangeDays: 30,
        macroEvents: [],
        warnings: ['Upcoming earnings coverage is temporarily unavailable.'],
    });
    assertEqual(calendar.rangeDays, 30, 'calendar preserves the requested range');
    assertEqual(calendar.timezone, 'UTC', 'calendar exposes the source timezone');
    assertEqual(calendar.events.some((event) => event.type === 'review' && event.sourceDate === '2026-07-20'), true, 'calendar includes scheduled reviews');
    assertEqual(calendar.events.some((event) => event.type === 'earnings' && event.sourceDate === '2026-07-22'), true, 'calendar includes dated earnings');
    assertEqual(calendar.events.filter((event) => event.type === 'earnings' && event.symbol === 'MSFT').length, 1, 'calendar deduplicates repeated provider catalysts');
    assertEqual(calendar.events.some((event) => event.type === 'stale' && event.symbol === 'MSFT' && event.displayDate === '2026-07-15'), true, 'calendar surfaces overdue stale reviews on today');
    assertEqual(calendar.events.find((event) => event.type === 'stale' && event.symbol === 'MSFT')?.sourceDate, '2026-06-09', 'calendar preserves the actual stale deadline');
    assertEqual(calendar.events.some((event) => event.symbol === '1155' && event.sourceDate === '2026-08-14'), true, 'calendar includes the inclusive day-thirty boundary');
    assertEqual(calendar.events.some((event) => event.symbol === 'NVDA' && event.sourceDate === '2026-08-15'), false, 'calendar excludes events beyond the inclusive boundary');
    assertEqual(calendar.events.find((event) => event.type === 'review' && event.symbol === 'MSFT')?.targetHref, '/research?ticker=MSFT&tab=overview&review=edit', 'scheduled review opens the review workflow');
    assertEqual(calendar.events.find((event) => event.type === 'earnings' && event.symbol === 'MSFT')?.targetHref, '/research?ticker=MSFT&tab=events', 'earnings opens the Events tab');
    assertEqual(calendar.events.find((event) => event.type === 'stale' && event.symbol === 'MSFT')?.targetHref, '/research?ticker=MSFT&tab=overview&review=edit', 'stale review opens the review workflow');
    assertEqual(calendar.events.every((event, index) => index === 0 || calendar.events[index - 1]!.displayDate <= event.displayDate), true, 'calendar events are ordered chronologically');
    assertEqual(calendar.warnings.length, 1, 'calendar preserves provider degradation warnings');
    const ninetyDay = buildResearchCalendar({
        inputs: [
            { ...inputs[0]!, symbol: 'DAY90', nextReviewAt: '2026-10-13', reviewAgeDays: null },
            { ...inputs[0]!, symbol: 'DAY91', nextReviewAt: '2026-10-14', reviewAgeDays: null },
        ],
        catalysts: [], macroEvents: [], now: new Date('2026-07-15T12:00:00.000Z'), rangeDays: 90,
    });
    assertEqual(ninetyDay.events.some((event) => event.symbol === 'DAY90'), true, 'calendar includes the inclusive day-ninety boundary');
    assertEqual(ninetyDay.events.some((event) => event.symbol === 'DAY91'), false, 'calendar excludes events beyond the ninety-day boundary');

    const marketFiltered = filterResearchCalendarEvents(calendar.events, { market: 'US', ticker: 'ALL', type: 'ALL' });
    assertEqual(marketFiltered.every((event) => event.market === 'US'), true, 'calendar market filter excludes other markets');
    const tickerFiltered = filterResearchCalendarEvents(calendar.events, { market: 'ALL', ticker: 'MSFT', type: 'earnings' });
    assertEqual(tickerFiltered.length, 1, 'calendar combines ticker and type filters');
    assertEqual(tickerFiltered[0]?.type, 'earnings', 'calendar type filter preserves only the requested event type');

    assertEqual(parseResearchCalendarQuery(new URLSearchParams()).rangeDays, 30, 'calendar query defaults to thirty days');
    assertEqual(parseResearchCalendarQuery(new URLSearchParams('range=90&market=US&ticker=MSFT&type=earnings')).rangeDays, 90, 'calendar query accepts the ninety-day range');
    assertThrows(() => parseResearchCalendarQuery(new URLSearchParams('range=31')), 'calendar query rejects unknown ranges');
    assertThrows(() => parseResearchCalendarQuery(new URLSearchParams('market=EU')), 'calendar query rejects unknown markets');
    assertThrows(() => parseResearchCalendarQuery(new URLSearchParams('ticker=../bad')), 'calendar query rejects unsafe tickers');
    assertThrows(() => parseResearchCalendarQuery(new URLSearchParams('type=dividend')), 'calendar query rejects unknown event types');
    assertEqual(parseResearchCalendarInputs([]).length, 0, 'calendar accepts an empty watchlist so macro dates remain useful');
    assertThrows(() => parseResearchCalendarInputs([inputs[0], inputs[0]]), 'calendar input rejects duplicate symbols');
    assertThrows(() => parseResearchCalendarInputs([{ symbol: 'MSFT', market: 'US', nextReviewAt: '20/07/2026', lastReviewedAt: '2026-05-10', reviewAgeDays: 30, earningsWithinDays: 21 }]), 'calendar input rejects malformed review dates');

    const response = parseResearchCalendarResponse({ success: true, data: calendar });
    assertEqual(response.events.length, calendar.events.length, 'calendar client boundary accepts typed events');
    assertThrows(() => parseResearchCalendarResponse({ success: true, data: { ...calendar, timezone: 'local' } }), 'calendar client boundary rejects an unknown timezone');
    assertThrows(() => parseResearchCalendarResponse({ success: true, data: { ...calendar, events: [{ ...calendar.events[0], targetHref: 'https://evil.example' }] } }), 'calendar client boundary rejects an external destination');

    const priorDates = parseResearchCalendarDateState({ 'MSFT:earnings': '2026-07-21', bad: '21/07/2026' });
    assertEqual(Object.keys(priorDates).length, 1, 'calendar date state drops malformed entries');
    const changes = calendarDateChanges(priorDates, calendar.events);
    assertEqual(changes[calendar.events.find((event) => event.type === 'earnings')?.id ?? ''], '2026-07-21', 'calendar reports the prior date when a scheduled event changes');
    const nextDates = snapshotResearchCalendarDates(calendar.events);
    assertEqual(nextDates['MSFT:earnings'], '2026-07-22', 'calendar snapshots the current date by symbol and event type');
    assertEqual(mergeResearchCalendarDateState(priorDates, {}, true)['MSFT:earnings'], '2026-07-21', 'degraded calendar refresh preserves missing provider dates');
    assertEqual(mergeResearchCalendarDateState(priorDates, {}, false)['MSFT:earnings'], undefined, 'complete calendar refresh removes events that are no longer scheduled');

    const degraded = await getResearchCalendar(
        inputs,
        parseResearchCalendarQuery(new URLSearchParams('range=30')),
        new Date('2026-07-15T12:00:00.000Z'),
        async () => { throw new Error('Nasdaq unavailable'); },
        async () => ({ events: [], warnings: [] }),
    );
    assertEqual(degraded.events.some((event) => event.type === 'review'), true, 'calendar service preserves scheduled reviews when earnings fail');
    assertEqual(degraded.events.some((event) => event.type === 'stale'), true, 'calendar service preserves stale reviews when earnings fail');
    assertEqual(degraded.events.some((event) => event.type === 'earnings'), false, 'calendar service excludes unavailable earnings without inventing dates');
    assertEqual(degraded.warnings[0], 'Upcoming earnings coverage is temporarily unavailable.', 'calendar service explains degraded earnings coverage');

    const fomcEvents = parseFomcCalendarHtml(`
        <h4><a>2026 FOMC Meetings</a></h4>
        <div class="fomc-meeting__month"><strong>July</strong></div>
        <div class="fomc-meeting__date">28-29</div>
        <div class="fomc-meeting__month"><strong>September</strong></div>
        <div class="fomc-meeting__date">15-16*</div>
    `);
    assertEqual(fomcEvents[0]?.date, '2026-07-29', 'FOMC parser uses the scheduled decision day');
    assertEqual(fomcEvents[1]?.detail.includes('economic projections'), true, 'FOMC parser discloses projection meetings');

    const blsEvents = parseBlsCalendarIcs([
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'DTSTART;TZID=America/New_York:20260812T083000',
        'SUMMARY:Consumer Price Index for July 2026',
        'URL:https://www.bls.gov/news.release/cpi.nr0.htm',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'DTSTART:20260904T123000Z',
        'SUMMARY:The Employment Situation for August 2026',
        'URL:https://www.bls.gov/news.release/empsit.nr0.htm',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'DTSTART:20260813T123000Z',
        'SUMMARY:Producer Price Index',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n'));
    assertEqual(blsEvents.length, 2, 'BLS parser keeps CPI and employment releases only');
    assertEqual(blsEvents[0]?.timeLabel, '08:30 ET', 'BLS parser preserves the official Eastern release time');

    const dosmEvents = parseDosmReleaseCalendar([
        { title_en: 'Consumer Price Index, July 2026', frequency: 'MONTHLY', release_date: '2026-08-21 12:00:00', publication_id: 'cpi_2026-07', publication_type: 'cpi' },
        { title_en: 'Gross Domestic Product, Second Quarter 2026', frequency: 'QUARTERLY', release_date: '2026-08-14 12:00:00', publication_id: 'gdp_2026-q2', publication_type: 'gdp' },
        { title_en: 'Labour Force Survey, June 2026', frequency: 'MONTHLY', release_date: '2026-08-10 12:00:00', publication_id: 'lfs_2026-06', publication_type: 'lfs' },
        { title_en: 'External Trade Statistics', frequency: 'MONTHLY', release_date: '2026-08-19 12:00:00', publication_id: 'trade_2026-07', publication_type: 'trade' },
    ]);
    assertEqual(dosmEvents.length, 3, 'OpenDOSM parser keeps inflation, growth, and employment releases');
    assertEqual(dosmEvents.every((event) => event.market === 'MY'), true, 'OpenDOSM events carry Malaysia market scope');

    const macroEvents = buildResearchMacroEvents({
        inputs,
        events: [...fomcEvents, ...blsEvents, ...dosmEvents],
        now: new Date('2026-07-15T12:00:00.000Z'),
        rangeDays: 90,
    });
    assertEqual(macroEvents.some((event) => event.date === '2026-07-29'), true, 'macro calendar includes dates inside the range');
    assertEqual(macroEvents.some((event) => event.date === '2026-11-01'), false, 'macro calendar excludes dates beyond the range');
    assertEqual(macroEvents.find((event) => event.market === 'US')?.trackedSymbols.join(','), 'MSFT,NVDA', 'macro relevance names same-market tracked symbols');
    assertEqual(macroEvents.find((event) => event.market === 'MY')?.trackedSymbols.join(','), '1155', 'macro relevance does not cross market scope');
    const typedMacroResponse = parseResearchCalendarResponse({ success: true, data: { ...calendar, macroEvents } });
    assertEqual(typedMacroResponse.macroEvents.length, macroEvents.length, 'calendar client boundary accepts typed macro events');
    assertThrows(() => parseResearchCalendarResponse({
        success: true,
        data: { ...calendar, macroEvents: [{ ...macroEvents[0], sourceUrl: 'https://evil.example/calendar' }] },
    }), 'calendar client boundary rejects an untrusted macro source URL');

    const macroDegraded = await getResearchCalendar(
        inputs,
        parseResearchCalendarQuery(new URLSearchParams('range=30')),
        new Date('2026-07-15T12:00:00.000Z'),
        async () => new Map(),
        async () => { throw new Error('Macro providers unavailable'); },
    );
    assertEqual(macroDegraded.events.some((event) => event.type === 'review'), true, 'calendar service preserves journal dates when macro providers fail');
    assertEqual(macroDegraded.macroEvents.length, 0, 'calendar service does not invent macro dates on provider failure');
    assertEqual(macroDegraded.warnings[0], 'Macro-event coverage is temporarily unavailable.', 'calendar service explains degraded macro coverage');
};

const runResearchStrategyTemplateTests = () => {
    assertEqual(new Set(researchStrategyTemplateIds).size, researchStrategyTemplateIds.length, 'strategy template ids are unique');
    assertEqual(researchStrategyTemplates.length, 6, 'strategy templates include the core lens and five strategy-specific lenses');
    for (const template of researchStrategyTemplates) {
        assertEqual(Object.keys(template.fieldPrompts).length, 7, `${template.id} guides every narrative field`);
        assertEqual(template.evidenceFocus.length >= 3, true, `${template.id} names at least three evidence priorities`);
        assertEqual(Object.values(template.fieldPrompts).every((prompt) => prompt.trim().endsWith('?')), true, `${template.id} guidance remains question-led`);
    }
    assertEqual(getResearchStrategyTemplate('quality-compounder').name, 'Quality compounder', 'strategy template lookup returns the requested lens');
    assertEqual(getResearchStrategyTemplate('unsupported').id, 'core', 'unknown strategy template ids fall back without changing research');
};

const runMarketAlertTests = () => {
    const scoreRule: MarketAlertRule = {
        id: 'score-rule', market: 'US', mode: 'standard', enableSocial: true, condition: 'score-above', threshold: 70, baselineTier: null, createdAt: '2026-07-13T00:00:00.000Z',
    };
    const signal = {
        composite_score: 72,
        tier: 'buy',
        mode: 'standard',
        confidence: { agreement_pct: 64 },
        metadata: { market: 'US', signal_quality: { freshness: 'fresh' }, score_delta: { delta: 4 } },
    };
    const parsed = parseMarketAlertRules([
        scoreRule,
        { id: 2 },
        { ...scoreRule, id: 'invalid-daily', condition: 'daily-move', threshold: 0 },
        { ...scoreRule, id: 'missing-tier-baseline', condition: 'tier-change', threshold: null, baselineTier: null },
    ]);
    assertEqual(parsed.length, 1, 'market alert parser drops invalid stored rules');
    assertEqual(evaluateMarketAlert(scoreRule, signal as Parameters<typeof evaluateMarketAlert>[1]).triggered, true, 'score threshold alert triggers at the boundary');
    assertEqual(evaluateMarketAlert({ ...scoreRule, condition: 'daily-move', threshold: 5 }, signal as Parameters<typeof evaluateMarketAlert>[1]).triggered, false, 'daily move alert remains monitoring below threshold');
    const scopedRules = getMarketAlertRulesForBriefing([
        scoreRule,
        { ...scoreRule, id: 'contrarian', mode: 'contrarian' },
        { ...scoreRule, id: 'social-off', enableSocial: false },
        { ...scoreRule, id: 'malaysia', market: 'MY' },
    ], signal as Parameters<typeof evaluateMarketAlert>[1], true);
    assertEqual(scopedRules.map((rule) => rule.id).join(','), 'score-rule', 'market alerts remain scoped to the briefing configuration that created them');
};

const runDiscoveryQualityTests = () => {
    const compounder = scoreDiscoveryQuality({
        revenueGrowthPercent: 18, grossMarginPercent: 55, operatingMarginPercent: 24,
        freeCashFlow: 4_000_000_000, debt: 2_000_000_000, cash: 5_000_000_000, shareChangePercent: -1,
    }, 82);
    assertEqual(compounder.score >= 75, true, 'profitable growing business earns high quality');
    assertEqual(compounder.category, 'quality compounder', 'strong trend and quality classify as compounder');

    const unsupported = scoreDiscoveryQuality({
        revenueGrowthPercent: -12, grossMarginPercent: 8, operatingMarginPercent: -15,
        freeCashFlow: -500_000_000, debt: 3_000_000_000, cash: 100_000_000, shareChangePercent: 18,
    }, 90);
    assertEqual(unsupported.category, 'fundamentally unsupported', 'weak fundamentals reject momentum-only narrative');
    assertEqual(unsupported.score < 25, true, 'weak fundamentals receive low quality score');
    assertEqual(scoreDiscoveryQuality({
        revenueGrowthPercent: 250, grossMarginPercent: 45, operatingMarginPercent: 20,
        freeCashFlow: 2_000_000_000, debt: 2_000_000_000, cash: 3_000_000_000, shareChangePercent: 0,
    }, 85).category, 'cyclical acceleration', 'extraordinary comparisons do not masquerade as compounders');
};

const runSecCompanyFactsTests = () => {
    const annual = (start: string, end: string, val: number, filed: string) => ({ start, end, val, filed, form: '10-K', fp: 'FY' });
    const parsed = parseSecCompanyFacts({ facts: { 'us-gaap': {
        RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [annual('2021-02-01', '2022-01-30', 26_914, '2022-03-18')] } },
        Revenues: { units: { USD: [
            annual('2024-01-29', '2025-01-26', 130_497, '2025-02-26'),
            annual('2025-01-27', '2026-01-25', 215_938, '2026-02-25'),
        ] } },
        OperatingIncomeLoss: { units: { USD: [annual('2025-01-27', '2026-01-25', 130_387, '2026-02-25')] } },
    } } });
    assertEqual(parsed.annualRevenue, 215_938, 'latest revenue survives an SEC concept-name transition');
    assertEqual(parsed.revenueGrowthPercent, 65.5, 'growth compares the two latest periods across revenue concepts');
    assertEqual(parsed.operatingMarginPercent, 60.4, 'margin uses the matching latest revenue concept');
    assertEqual(parsed.history.map((period) => period.reportingPeriod).join(','), '2026-01-25,2025-01-26,2022-01-30', 'SEC history keeps distinct annual periods across concept changes');
    assertEqual(parsed.history[0]?.revenueGrowthPercent, 65.5, 'SEC history calculates period-over-period revenue growth');

    const yahoo = parseYahooFundamentalTimeseries({
        timeseries: {
            result: [
                {
                    meta: { symbol: ['1155.KL'], type: ['annualTotalRevenue'] },
                    annualTotalRevenue: [
                        { asOfDate: '2023-12-31', periodType: '12M', currencyCode: 'MYR', reportedValue: { raw: 25_999_633_000 } },
                        { asOfDate: '2024-12-31', periodType: '12M', currencyCode: 'MYR', reportedValue: { raw: 28_041_657_000 } },
                    ],
                },
                {
                    meta: { symbol: ['1155.KL'], type: ['annualNetIncome'] },
                    annualNetIncome: [
                        { asOfDate: '2023-12-31', periodType: '12M', currencyCode: 'MYR', reportedValue: { raw: 9_349_780_000 } },
                        { asOfDate: '2024-12-31', periodType: '12M', currencyCode: 'MYR', reportedValue: { raw: 10_088_673_000 } },
                    ],
                },
                {
                    meta: { symbol: ['1155.KL'], type: ['annualDilutedAverageShares'] },
                    annualDilutedAverageShares: [
                        { asOfDate: '2023-12-31', periodType: '12M', currencyCode: 'MYR', reportedValue: { raw: 12_056_164_000 } },
                        { asOfDate: '2024-12-31', periodType: '12M', currencyCode: 'MYR', reportedValue: { raw: 12_066_347_327 } },
                    ],
                },
            ],
            error: null,
        },
    }, 'MYR');
    assertEqual(yahoo.length, 2, 'Yahoo fundamentals combine metric series into annual periods');
    assertEqual(yahoo[0]?.reportingPeriod, '2024-12-31', 'Yahoo fundamentals sort the latest annual period first');
    assertEqual(yahoo[0]?.revenueGrowthPercent, 7.9, 'Yahoo fundamentals calculate annual revenue growth');
    assertEqual(yahoo[0]?.shareChangePercent, 0.1, 'Yahoo fundamentals calculate annual share-count change');
    assertEqual(yahoo[0]?.grossMarginPercent, null, 'Yahoo fundamentals preserve unavailable Malaysia metrics');
    assertThrows(() => parseYahooFundamentalTimeseries({ timeseries: { result: [{ bad: true }] } }, 'MYR'), 'Yahoo fundamentals reject malformed provider entries');
};

const runDiscoveryHistoryTests = () => {
    const snapshots = [
        { generatedAt: '2026-07-11T10:00:00.000Z', candidates: [{ symbol: 'MU', rank: 4, discoveryScore: 72, price: 100 }] },
        { generatedAt: '2026-07-05T10:00:00.000Z', candidates: [{ symbol: 'MU', rank: 8, discoveryScore: 64, price: 80 }] },
    ];
    const signals = calculateHistorySignals('MU', 82, 2, '2026-07-12T10:00:00.000Z', snapshots);
    assertEqual(signals.scoreChange1Day, 10, 'one-day score delta uses the nearest prior snapshot');
    assertEqual(signals.scoreChange1Week, 18, 'one-week score delta uses the nearest prior snapshot');
    assertEqual(signals.rankChange1Week, 6, 'positive rank change means the candidate moved up');
    assertEqual(signals.firstSeenAt, '2026-07-05T10:00:00.000Z', 'first seen date comes from retained history');

    const performance = calculateCohortPerformance('1W', snapshots[1], new Map([['MU', 100], ['NVDA', 200]]));
    assertEqual(performance.averageReturnPercent, 25, 'cohort return compares saved entry price with current price');
    assertEqual(performance.trackedCount, 1, 'cohort performance reports its tracked coverage');
    assertEqual(performance.winnerCount, 1, 'cohort performance counts positive returns');
    const leadersOnly = calculateCohortPerformance('1W', {
        generatedAt: '2026-07-05T10:00:00.000Z',
        candidates: [
            { symbol: 'MU', rank: 10, discoveryScore: 64, price: 80 },
            { symbol: 'NVDA', rank: 11, discoveryScore: 63, price: 100 },
        ],
    }, new Map([['MU', 100], ['NVDA', 200]]));
    assertEqual(leadersOnly.trackedCount, 1, 'forward cohort performance remains limited to saved top-ten leaders');
    assertEqual(leadersOnly.averageReturnPercent, 25, 'contender returns do not alter leader cohort performance');
    assertEqual(sectorRelativeStrength('MU', 30, [
        { symbol: 'MU', momentum3MonthPercent: 30 },
        { symbol: 'NVDA', momentum3MonthPercent: 10 },
        { symbol: 'MSFT', momentum3MonthPercent: 80 },
    ]), 10, 'sector strength compares a ticker only with sector peers');
};

const runDiscoveryOpportunityTests = () => {
    assertEqual(classifyEarlyTrend({
        aboveMa50: true, aboveMa200: true, momentum3MonthPercent: 14,
        momentum6MonthPercent: 22, distanceFromMa50Percent: 3, risk: 'low',
    }), 'emerging', 'controlled breakout near MA50 is an emerging trend');
    assertEqual(classifyEarlyTrend({
        aboveMa50: true, aboveMa200: true, momentum3MonthPercent: 42,
        momentum6MonthPercent: 70, distanceFromMa50Percent: 18, risk: 'moderate',
    }), 'extended', 'large move far above MA50 is already extended');
    assertEqual(classifyValuation({ priceEarnings: 17, priceSales: 3, freeCashFlowYieldPercent: 5.2 }), 'attractive', 'cash-generative low multiple is attractive');
    assertEqual(classifyValuation({ priceEarnings: 62, priceSales: 22, freeCashFlowYieldPercent: 0.8 }), 'extreme', 'high multiples and low cash yield trigger an extreme guardrail');
    assertEqual(classifyValuation({ priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null }), 'unavailable', 'missing valuation stays unavailable');
};

const runDiscoveryRankingTests = () => {
    const ranked = rankDiscoveryTiers(Array.from({ length: 23 }, (_, index) => ({
        symbol: `T${index + 1}`,
        discoveryScore: 100 - index,
        category: index === 4 ? 'fundamentally unsupported' as const : 'quality compounder' as const,
    })));
    assertEqual(ranked.leaders.length, 10, 'ranking preserves ten high-conviction leaders');
    assertEqual(ranked.contenders.length, 10, 'ranking exposes the next ten eligible candidates');
    assertEqual([...ranked.leaders, ...ranked.contenders].some((candidate) => candidate.symbol === 'T5'), false, 'unsupported candidates do not enter either tier');
    assertEqual(ranked.contenders[0]?.symbol, 'T12', 'contenders continue immediately after eligible leaders');
    assertEqual(describeContender({ category: 'unconfirmed', risk: 'low' }), 'SEC quality not confirmed', 'unconfirmed contender explains missing quality evidence');
    assertEqual(describeContender({ category: 'quality compounder', risk: 'moderate' }), 'Moderate risk deduction', 'moderate-risk contender explains its deduction');
    assertEqual(describeContender({ category: 'quality compounder', risk: 'low' }), 'Lower combined score than current leaders', 'contender reason matches the actual ranking input');
};

const runDiscoveryFilterTests = () => {
    const candidates = [
        { symbol: 'MU', sector: 'Semiconductors', risk: 'low' as const, earlyTrendStage: 'emerging' as const, valuation: { guardrail: 'fair' as const } },
        { symbol: 'AAPL', sector: 'Technology', risk: 'moderate' as const, earlyTrendStage: 'confirmed' as const, valuation: { guardrail: 'expensive' as const } },
        { symbol: 'NVDA', sector: 'Semiconductors', risk: 'moderate' as const, earlyTrendStage: 'extended' as const, valuation: { guardrail: 'extreme' as const } },
    ];
    assertEqual(filterDiscoveryCandidates(candidates, { sector: 'Semiconductors', risk: 'all', stage: 'all', valuation: 'all' }).map((candidate) => candidate.symbol).join(','), 'MU,NVDA', 'sector filter keeps matching discovery candidates');
    assertEqual(filterDiscoveryCandidates(candidates, { sector: 'all', risk: 'moderate', stage: 'confirmed', valuation: 'expensive' }).map((candidate) => candidate.symbol).join(','), 'AAPL', 'discovery filters combine with AND semantics');
    assertEqual(filterDiscoveryCandidates(candidates, { sector: 'all', risk: 'all', stage: 'all', valuation: 'all' }).length, 3, 'all filters preserve the full candidate list');
};

const runPickerTests = () => {
    const candidate = (input: Partial<QualityDiscoveryResult> & Pick<QualityDiscoveryResult, 'symbol' | 'discoveryScore'>): QualityDiscoveryResult => ({
        symbol: input.symbol,
        name: input.name ?? input.symbol,
        price: input.price ?? 100,
        momentum3MonthPercent: 20,
        momentum6MonthPercent: 30,
        distanceFromMa50Percent: 5,
        averageDollarVolume: 100_000_000,
        volumeSpikeRatio: 1.2,
        maxDailyMovePercent: 5,
        annualizedVolatilityPercent: 30,
        aboveMa50: true,
        aboveMa200: true,
        trendScore: input.trendScore ?? input.discoveryScore,
        riskScore: input.riskScore ?? 5,
        risk: input.risk ?? 'low',
        reasons: input.reasons ?? ['Current trend'],
        flags: input.flags ?? [],
        qualityScore: input.qualityScore ?? 80,
        discoveryScore: input.discoveryScore,
        category: input.category ?? 'quality compounder',
        qualityReasons: input.qualityReasons ?? ['Business quality'],
        sector: input.sector ?? 'Technology',
        sectorRelativeStrengthPercent: input.sectorRelativeStrengthPercent ?? 5,
        scoreChange1Day: input.scoreChange1Day ?? null,
        scoreChange1Week: input.scoreChange1Week ?? null,
        scoreChange1Month: input.scoreChange1Month ?? null,
        rankChange1Week: input.rankChange1Week ?? null,
        firstSeenAt: input.firstSeenAt ?? '2026-07-01T00:00:00.000Z',
        earlyTrendStage: input.earlyTrendStage ?? 'confirmed',
        valuation: input.valuation ?? { guardrail: 'fair', priceEarnings: 20, priceSales: 4, freeCashFlowYieldPercent: 4 },
        catalyst: input.catalyst ?? null,
        ownership: input.ownership ?? null,
    });
    const high = candidate({ symbol: 'HIGH', discoveryScore: 84, sector: 'Technology' });
    const moderate = candidate({ symbol: 'MOD', discoveryScore: 78, risk: 'moderate', riskScore: 20, sector: 'Technology' });
    const low = candidate({ symbol: 'LOW', discoveryScore: 65 });
    const data = { candidates: [moderate, high], contenders: [low] };
    const balanced = {
        horizon: '1M',
        riskProfile: 'balanced',
        minimumScore: 70,
        pickCount: 3,
        maximumPerSector: 3,
        excludeSavedSymbols: false,
    } as const;
    assertEqual(selectPickerCandidates(data, balanced).map((item) => item.symbol).join(','), 'HIGH,MOD', 'picker sorts eligible current candidates by Discovery score');
    assertEqual(selectPickerCandidates(data, { ...balanced, riskProfile: 'conservative' }).map((item) => item.symbol).join(','), 'HIGH', 'conservative picker excludes moderate risk');
    assertEqual(selectPickerCandidates(data, { ...balanced, minimumScore: 80 }).map((item) => item.symbol).join(','), 'HIGH', 'picker enforces the configured minimum score');
    assertEqual(selectPickerCandidates(data, { ...balanced, maximumPerSector: 1 }).map((item) => item.symbol).join(','), 'HIGH', 'picker enforces the configured sector cap');
    assertEqual(selectPickerCandidates(data, { ...balanced, excludeSavedSymbols: true }, { savedSymbols: ['HIGH'] }).map((item) => item.symbol).join(','), 'MOD', 'picker can exclude existing research symbols');
    assertEqual(selectPickerCandidates(data, balanced)[0]?.outlook, 'Strong current setup', 'picker outlook remains descriptive of the current score');
    const policyRanked = selectPickerCandidates({
        candidates: [
            candidate({ symbol: 'TREND', discoveryScore: 82, qualityScore: 40, sector: 'Technology' }),
            candidate({ symbol: 'QUALITY', discoveryScore: 78, qualityScore: 100, sector: 'Healthcare' }),
        ],
        contenders: [],
    }, balanced, {
        policy: {
            sectors: [],
            minimumDollarVolume: 20_000_000,
            maximumRisk: 'moderate',
            excludeExtremeValuation: false,
            preferences: ['quality'],
        },
    });
    assertEqual(policyRanked.map((item) => item.symbol).join(','), 'QUALITY,TREND', 'picker reuses the transparent Discovery policy rank');
    assertEqual(policyRanked[0]?.policyAdjustment, 5, 'picker exposes the policy adjustment used for selection');
    assertEqual(pickerCohortEvidence([{ period: '1M', averageReturnPercent: 2.4, trackedCount: 4, winnerCount: 3 }], '1M').positiveRatePercent, 75, 'picker derives observational positive coverage');
    assertEqual(pickerCohortEvidence([], '1W').state, 'collecting', 'picker withholds unavailable history');
    assertEqual(pickerObservedMovePercent(100, 112), 12, 'paper basket compares current observation with entry price');
    assertEqual(parsePickerConfig(balanced)?.minimumScore, 70, 'picker config accepts bounded options');
    assertEqual(parsePickerConfig({ horizon: '1M', riskProfile: 'balanced', minimumScore: 70, pickCount: 3 })?.maximumPerSector, 10, 'picker config preserves legacy basket behavior');
    assertEqual(parsePickerConfig({ ...balanced, minimumScore: 75 }), null, 'picker config rejects unsupported thresholds');

    const run = createPickerRun(
        '2026-07-26T10:00:00.000Z',
        '2026-07-26T09:00:00.000Z',
        balanced,
        selectPickerCandidates(data, balanced),
        { benchmarkEntryPrice: 500, strategy: null },
    );
    assertEqual(run.picks.length, 2, 'picker run freezes selected candidates');
    assertEqual(parsePickerRuns([run])[0]?.picks[0]?.discoveryScore, 84, 'picker run parsing preserves entry scores');
    assertEqual(addPickerRun([], run).length, 1, 'picker run can be added to local history');
    assertEqual(removePickerRun([run], run.id).length, 0, 'picker run can be removed from local history');
    const ongoing = pickerRunSummary(run, new Map([['HIGH', 88.2], ['MOD', 81.9], ['VOO', 505]]), '2026-07-27T09:00:00.000Z');
    assertEqual(ongoing.state, 'collecting', 'picker basket stays observational before its measurement horizon');
    const resolved = resolvePickerRuns(
        [run],
        new Map([['HIGH', 110], ['MOD', 111], ['VOO', 525]]),
        '2026-08-26T10:00:00.000Z',
    )[0];
    assertEqual(resolved?.picks.every((pick) => pick.outcome !== null), true, 'picker freezes candidate observations once the horizon is due');
    const summary = resolved ? pickerRunSummary(resolved, new Map(), '2026-08-26T10:00:00.000Z') : null;
    assertEqual(summary?.state, 'resolved', 'picker reports a fully resolved basket');
    assertEqual(summary?.averageReturnPercent, 10.5, 'picker summarizes the resolved equal-weight basket');
    assertEqual(summary?.benchmarkReturnPercent, 5, 'picker resolves the VOO observation from the same quote refresh');
    assertEqual(summary?.relativeReturnPercent, 5.5, 'picker keeps basket and benchmark outcomes separate');
};

const runInstitutionalOwnershipTests = () => {
    const payload = { data: {
        ownershipSummary: { SharesOutstandingPCT: { value: '72.4%' } },
        activePositions: { rows: [
            { positions: 'Increased Positions', shares: '18,000,000' },
            { positions: 'Decreased Positions', shares: '6,000,000' },
        ] },
        holdingsTransactions: { table: { rows: [
            { ownerName: 'Berkshire Hathaway Inc', date: '3/31/2026', sharesHeld: '25,000,000', sharesChange: '5,000,000', sharesChangePCT: '25%', marketValue: '$4,500,000', url: '/market-activity/institutional-portfolio/berkshire-hathaway-inc-1' },
            { ownerName: 'New Fund LP', date: '3/31/2026', sharesHeld: '2,000,000', sharesChange: '2,000,000', sharesChangePCT: 'New', marketValue: '$360,000', url: '/market-activity/institutional-portfolio/new-fund-lp-2' },
        ] } },
    } };
    const parsed = parseNasdaqInstitutionalHoldings(payload, 'AAPL');
    assertEqual(parsed.activity, 'increases-led', 'ownership activity compares disclosed increases with decreases');
    assertEqual(parsed.institutionalOwnershipPercent, 72.4, 'ownership parser normalizes percentage values');
    assertEqual(parsed.reportPeriod, '2026-03-31', 'ownership evidence exposes the latest reporting period');
    assertEqual(parsed.buyers[0]?.sharesAdded, 5_000_000, 'ownership evidence preserves disclosed share additions');
    assertEqual(parsed.buyers[1]?.positionChangePercent, null, 'new positions do not invent a percentage change');
    assertEqual(parseNasdaqInstitutionalHoldings({
        data: { ...payload.data, ownershipSummary: { SharesOutstandingPCT: { value: '109.3%' } } },
    }, 'AAPL').institutionalOwnershipPercent, null, 'ownership percentages above 100 remain unavailable');
    assertEqual(parseNasdaqInstitutionalHoldings({ data: {
        ...payload.data,
        activePositions: { rows: [
            { positions: 'Increased Positions', shares: '4,000,000' },
            { positions: 'Decreased Positions', shares: '4,800,000' },
        ] },
    } }, 'AAPL').activity, 'mixed', 'ownership balance stays mixed when neither side leads by more than 25 percent');
    const decreasesLed = parseNasdaqInstitutionalHoldings({ data: {
        ...payload.data,
        activePositions: { rows: [
            { positions: 'Increased Positions', shares: '1,000,000' },
            { positions: 'Decreased Positions', shares: '5,000,000' },
        ] },
        holdingsTransactions: { table: { rows: [] } },
    } }, 'AAPL');
    assertEqual(decreasesLed.activity, 'decreases-led', 'ownership balance preserves valid decrease-led aggregate evidence');
    assertEqual(decreasesLed.buyers.length, 0, 'ownership evidence permits snapshots with no increased-position holders');
    const aggregateOnly = parseNasdaqInstitutionalHoldings({ data: {
        ownershipSummary: { SharesOutstandingPCT: { value: '63.2%' } },
        activePositions: payload.data.activePositions,
    } }, 'AAPL');
    assertEqual(aggregateOnly.institutionalOwnershipPercent, 63.2, 'ownership evidence accepts an omitted transaction table when aggregate data is valid');
    assertEqual(aggregateOnly.buyers.length, 0, 'aggregate-only ownership evidence does not invent buyer rows');
    assertThrows(() => parseNasdaqInstitutionalHoldings({ data: null }, 'AAPL'), 'ownership boundary rejects malformed provider data');
};

const runComparisonTests = () => {
    const snapshot: ResearchSnapshot = {
        symbol: 'MSFT', market: 'US', fetchedAt: '2026-07-12T00:00:00.000Z',
        benchmark: {
            baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y',
            candidateReturnPercent: 30, baselineReturnPercent: 20, relativeReturnPercent: 10,
            returnBasis: 'adjusted close', status: 'outperformed',
        },
        quote: { name: 'Microsoft', currency: 'USD', price: 420.5, dailyChangePercent: 1.2 },
        fundamentals: {
            revenueGrowthPercent: 14.2, grossMarginPercent: 68.5, operatingMarginPercent: 44.1,
            freeCashFlow: 70_000_000_000, debt: 40_000_000_000, cash: 80_000_000_000,
            shares: 7_400_000_000, annualRevenue: 250_000_000_000, annualNetIncome: 90_000_000_000,
            reportingPeriod: '2025-06-30', shareChangePercent: -0.8, source: 'SEC EDGAR',
            history: [{
                reportingPeriod: '2025-06-30', currency: 'USD', source: 'SEC EDGAR',
                annualRevenue: 250_000_000_000, revenueGrowthPercent: 14.2,
                grossMarginPercent: 68.5, operatingMarginPercent: 44.1,
                annualNetIncome: 90_000_000_000, freeCashFlow: 70_000_000_000,
                debt: 40_000_000_000, cash: 80_000_000_000, shares: 7_400_000_000,
                shareChangePercent: -0.8,
            }],
        },
        valuation: {
            marketCap: 3_100_000_000_000, priceEarnings: 34.4, priceSales: 12.4,
            freeCashFlowYieldPercent: 2.3, netCash: 40_000_000_000, reportingPeriod: '2025-06-30', source: 'SEC EDGAR',
        },
        technicals: {
            ma50: 400, ma200: 360, rsi14: 58.2, macd: 3.5, low52Week: 330,
            high52Week: 450, averageVolume20: 20_000_000, support: 395, resistance: 450,
        },
        chart: { interval: '1d', points: [{
            time: '2026-07-11', open: 415, high: 423, low: 414, close: 420.5,
            volume: 28_000_000, ma50: 400, ma200: 360, averageVolume20: 20_000_000,
            ema20: 405, ema50: 398, sma200: 360, rsi14: 58.2, macd: 3.5, macdSignal: 2.8, macdHistogram: 0.7,
            atr14: 8.4, atrPercent14: 2.1, anchoredVwap: 410, adx14: 22, plusDi14: 24, minusDi14: 18,
            supertrend: 405, supertrendDirection: 1,
        }] },
        sources: ['Yahoo Finance', 'SEC EDGAR'], warnings: [],
    };
    const metrics = buildComparisonMetrics(snapshot);
    assertEqual(metrics.price, '$420.50', 'comparison formats US price');
    assertEqual(metrics.revenueGrowth, '14.2%', 'comparison formats revenue growth');
    assertEqual(metrics.priceEarnings, '34.4x', 'comparison formats earnings multiple');
    assertEqual(metrics.rsi, '58.2', 'comparison formats RSI');
    assertEqual(buildComparisonMetrics({ ...snapshot, valuation: { ...snapshot.valuation, priceEarnings: null } }).priceEarnings, 'Unavailable', 'comparison preserves missing data');
    const peerBenchmark = buildPeerBenchmark(snapshot, [
        {
            ...snapshot,
            symbol: 'AMD',
            fundamentals: { ...snapshot.fundamentals, revenueGrowthPercent: 10, operatingMarginPercent: 20, debt: 60, cash: 30 },
            valuation: { ...snapshot.valuation, priceEarnings: 40, freeCashFlowYieldPercent: 1.5 },
        },
        {
            ...snapshot,
            symbol: 'ORCL',
            fundamentals: { ...snapshot.fundamentals, revenueGrowthPercent: 8, operatingMarginPercent: null, debt: null, cash: null },
            valuation: { ...snapshot.valuation, priceEarnings: 25, freeCashFlowYieldPercent: null },
        },
    ]);
    const growthBenchmark = peerBenchmark.metrics.find((metric) => metric.key === 'revenueGrowth');
    const earningsBenchmark = peerBenchmark.metrics.find((metric) => metric.key === 'priceEarnings');
    const marginBenchmark = peerBenchmark.metrics.find((metric) => metric.key === 'operatingMargin');
    assertEqual(growthBenchmark?.peerMedian, 9, 'peer benchmark calculates the median from available peers');
    assertEqual(growthBenchmark?.percentile, 100, 'peer benchmark ranks higher-is-better growth in the favorable direction');
    assertEqual(earningsBenchmark?.percentile, 50, 'peer benchmark reverses percentile direction for lower valuation');
    assertEqual(marginBenchmark?.peerCoverage, 1, 'peer benchmark reports per-metric coverage');
    assertEqual(buildTechnicalOutlook(snapshot).overall.label, 'Constructive', 'technical outlook requires aligned positive evidence');
    const response = { success: true, data: snapshot };
    assertEqual(parseResearchSnapshotResponse(response).symbol, 'MSFT', 'snapshot boundary accepts complete comparison data');
    assertEqual(parseResearchSnapshotResponse(response).fundamentals.history[0]?.source, 'SEC EDGAR', 'snapshot boundary preserves fundamental-history provenance');
    assertEqual(parseResearchChartResponse({ success: true, data: { chart: snapshot.chart } }).points.length, 1, 'chart boundary accepts aligned history');
    assertThrows(() => parseResearchChartResponse({ success: true, data: { chart: { interval: '1d', points: [{ time: 'bad-date' }] } } }), 'chart boundary rejects malformed history');
    assertThrows(() => parseResearchSnapshotResponse({
        ...response,
        data: { ...snapshot, technicals: { ...snapshot.technicals, rsi14: 'hot' } },
    }), 'snapshot boundary rejects malformed comparison metrics');
    assertThrows(() => parseResearchSnapshotResponse({
        ...response,
        data: { ...snapshot, chart: { interval: '1d', points: [{ ...snapshot.chart.points[0], close: null }] } },
    }), 'snapshot boundary rejects malformed chart candles');
    assertThrows(() => parseResearchSnapshotResponse({
        ...response,
        data: { ...snapshot, fundamentals: { ...snapshot.fundamentals, history: [{ ...snapshot.fundamentals.history[0], reportingPeriod: 'bad-date' }] } },
    }), 'snapshot boundary rejects malformed fundamental history');
    assertThrows(() => parseResearchChartResponse({
        success: true,
        data: { chart: { interval: '1d', points: [{ ...snapshot.chart.points[0], supertrendDirection: 0 }] } },
    }), 'chart boundary rejects an invalid Supertrend direction');
    assertThrows(() => parseResearchChartResponse({
        success: true,
        data: { chart: { interval: '1d', points: [{ ...snapshot.chart.points[0], ema20: 'fast' }] } },
    }), 'chart boundary rejects malformed indicator values');
};

const runResearchAssistantTests = () => {
    const snapshot: ResearchSnapshot = {
        symbol: 'MSFT', market: 'US', fetchedAt: '2026-07-14T00:00:00.000Z',
        benchmark: {
            baselineSymbol: 'VOO', baselineName: 'Vanguard S&P 500 ETF', period: '1Y',
            candidateReturnPercent: 30, baselineReturnPercent: 20, relativeReturnPercent: 10,
            returnBasis: 'adjusted close', status: 'outperformed',
        },
        quote: { name: 'Microsoft', currency: 'USD', price: 420, dailyChangePercent: 1.2 },
        fundamentals: {
            revenueGrowthPercent: 14, grossMarginPercent: 68, operatingMarginPercent: 44,
            freeCashFlow: 70_000_000_000, debt: 40_000_000_000, cash: 80_000_000_000,
            shares: 7_400_000_000, annualRevenue: 250_000_000_000, annualNetIncome: 90_000_000_000,
            reportingPeriod: '2025-06-30', shareChangePercent: 2.2, source: 'SEC EDGAR',
            history: [{
                reportingPeriod: '2025-06-30', currency: 'USD', source: 'SEC EDGAR',
                annualRevenue: 250_000_000_000, revenueGrowthPercent: 14,
                grossMarginPercent: 68, operatingMarginPercent: 44,
                annualNetIncome: 90_000_000_000, freeCashFlow: 70_000_000_000,
                debt: 40_000_000_000, cash: 80_000_000_000, shares: 7_400_000_000,
                shareChangePercent: 2.2,
            }],
        },
        valuation: {
            marketCap: 3_100_000_000_000, priceEarnings: 34.4, priceSales: 12.4,
            freeCashFlowYieldPercent: 2.3, netCash: 40_000_000_000,
            reportingPeriod: '2025-06-30', source: 'Yahoo Finance + SEC EDGAR',
        },
        technicals: {
            ma50: 400, ma200: 360, rsi14: 58, macd: 3.5, low52Week: 330,
            high52Week: 450, averageVolume20: 20_000_000, support: 395, resistance: 450,
        },
        chart: { interval: '1d', points: [] },
        sources: ['Yahoo Finance', 'SEC EDGAR'], warnings: [],
    };
    const evidence = buildResearchEvidence(snapshot);
    const findings = buildEvidenceFindings(snapshot, evidence);
    assertEqual(evidence.some((item) => item.id === 'revenue-growth' && item.source === 'SEC EDGAR'), true, 'assistant preserves filing provenance');
    assertEqual(findings.some((item) => item.target === 'bullCase' && item.evidenceIds.includes('revenue-growth')), true, 'assistant maps positive growth to a supported draft');
    assertEqual(findings.some((item) => item.target === 'bearCase' && item.evidenceIds.includes('share-change')), true, 'assistant flags material share-count growth for review');
    const response = { success: true, data: {
        symbol: snapshot.symbol, market: snapshot.market, generatedAt: snapshot.fetchedAt,
        mode: 'evidence', findings, evidence, warnings: [],
    } };
    assertEqual(parseResearchAssistantResponse(response).findings.length, findings.length, 'assistant boundary accepts sourced findings');
    assertThrows(() => parseResearchAssistantResponse({
        ...response,
        data: { ...response.data, findings: [{ ...findings[0], evidenceIds: ['invented-source'] }] },
    }), 'assistant boundary rejects unsupported finding provenance');
};

const main = async () => {
    runInputTests();
    runOutcomeAnalyticsTests();
    runSinceLastVisitTests();
    runPortfolioAnalyticsTests();
    runPortfolioHoldingsImportTests();
    runPortfolioSimulationTests();
    runSourceHealthTests();
    runMarketReplayTests();
    runProductAnalyticsTests();
    runResearchUrlStateTests();
    runResearchWorkspaceNavigationTests();
    runMarketResearchHandoffTests();
    runMarketWatchlistExposureTests();
    runThesisChangeTests();
    runMarketSensitivityTests();
    runResearchWorkflowQueueTests();
    runEvidenceCoverageTests();
    runInvestmentPolicyTests();
    runCurrencyPerformanceTests();
    runEvidenceDocumentDiffTests();
    runScenarioLibraryTests();
    runPaperDecisionTests();
    runRelationshipGraphTests();
    runDiscoveryUniversePolicyTests();
    await runResearchBackupTests();
    runSavedResearchLayoutTests();
    await runResearchNotificationTests();
    runDiscoveryWorkspaceTests();
    runDecisionTests();
    runTechnicalTests();
    runBenchmarkTests();
    runValuationTests();
    runDiscoveryTests();
    runAlertTests();
    runStructuredTriggerTests();
    runInboxTests();
    await runCalendarTests();
    runResearchStrategyTemplateTests();
    runMarketAlertTests();
    runDiscoveryQualityTests();
    runSecCompanyFactsTests();
    runDiscoveryHistoryTests();
    runDiscoveryOpportunityTests();
    runDiscoveryRankingTests();
    runDiscoveryFilterTests();
    runPickerTests();
    runInstitutionalOwnershipTests();
    runComparisonTests();
    runResearchAssistantTests();
    console.log('Research regression tests passed.');
};

void main();
