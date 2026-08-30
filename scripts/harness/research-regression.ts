Warning: truncated output (original token count: 74799)
Total output lines: 4563

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
import { buildResearchAlertRequest } from '../../src/lib/research/alert-request';
import { evaluateResearchStructuredTriggers, parseResearchStructuredTriggerSet } from '../../src/lib/research/structured-triggers';
import { evaluateMarketAlert, getMarketAlertRulesForBriefing, parseMarketAlertRules, type MarketAlertRule } from '../../src/lib/market-alerts';
import { scoreDiscoveryQuality } from '../../src/lib/research/discovery-quality';
import { getConfiguredSecHeaders, parseSecCompanyFacts, parseSecTickerMapping } from '../../src/lib/research/sec-edgar';
import { parseYahooFundamentalTimeseries } from '../../src/lib/research/yahoo-fundamentals';
import { calculateCohortPerformance, calculateHistorySignals } from '../../src/lib/research/discovery-history';
import {
    addPickerRun,
    buildPickerCandidateBrief,
    buildPickerRejectionSummary,
    createPickerRun,
    explainPickerSelection,
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
import { parseResearchChartResponse, parseResearchQuoteBatchResponse, parseResearchSnapshotResponse } from '../../src/lib/research/snapshot-input';
import {
    getResearchQuoteBatch,
    parseResearchQuoteBatchRequest,
    researchQuoteBatchLimits,
} from '../../src/lib/research/quote-batch';
import type { ResearchQuoteData } from '../../src/lib/types/research-quote';
import { createSignalCache, SIGNAL_CACHE_TTL_MS } from '../../src/lib/signal-cache';
import { buildHistoricalValuationReport, HISTORICAL_VALUATION_PRICE_CONVENTION, historicalValuationLimits } from '../../src/lib/research/historical-valuation';
import { parseHistoricalValuationResponse } from '../../src/lib/research/historical-valuation-input';
import { parseHistoricalValuationRequest } from '../../src/lib/research/historical-valuation-request';
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
import {
    buildResearchRelativeUrl,
    mergeResearchSearchParams,
    parseResearchUrlDecision,
    parseResearchUrlDensity,
    parseResearchUrlMarket,
    parseResearchUrlQuery,
    resolveVisibleResearchSymbol,
} from '../../src/lib/research/url-state';
import { nextHorizontalTabIndex } from '../../src/lib/research/tab-navigation';
import { researchWorkspaceGroupFor, researchWorkspaceGroups } from '../../src/lib/research/workspace-navigation';
import {
    buildResearchVisitSnapshot,
    buildSinceLastVisitBriefing,
    buildSinceLastVisitChanges,
    buildTodayContinuationHref,
    buildTodayOwnerSummaries,
    createTodayMarketContinuation,
    createTodayResearchContinuation,
    parseResearchVisitSnapshot,
    parseTodayContinuation,
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
    buildCanonicalPortfolioTransactionCsvTemplate,
    createPortfolioTransactionImportSnapshot,
    mergePortfolioTransactionSnapshots,
    parsePortfolioTransactionCsv,
    parsePortfolioTransactionSnapshot,
    portfolioTransactionImportLimits,
    previewPortfolioTransactionImportEffect,
} from '../../src/lib/portfolio/transactions';
import { buildPortfolioTransactionReconciliation } from '../../src/lib/portfolio/transaction-reconciliation';
import { buildCoveredPortfolioAttribution } from '../../src/lib/portfolio/performance-attribution';
import {
    buildDividendDiscoveryPath,
    calculateIllustrativeGrossDividend,
    dividendEventDate,
    emptyDividendCashFlowSnapshot,
    filterDividendCashFlowEvents,
    migrateDividendCashFlowSnapshot,
    parseDividendCashFlowSnapshot,
    parseNasdaqDividendDiscovery,
    parseNasdaqDividendDiscoveryResponse,
    removeDividendCashFlowEvent,
    upcomingDividendCashFlowDigestEvents,
    upsertDividendCashFlowEvent,
} from '../../src/lib/portfolio/dividend-cashflow';
import { fetchNasdaqDividendDiscovery } from '../../src/lib/research/nasdaq-dividends';
import type {
    CashFlowPlanningEvent,
    DividendPlanningEvent,
} from '../../src/lib/types/dividend-cashflow';
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
    parseProductAnalyticsEvent,
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
import { buildResearchReadiness } from '../../src/lib/research/readiness';
import {
    calculateCurrencyPerformance,
    defaultCurrencyPerformanceSettings,
    parseCurrencyPerformanceSettings,
} from '../../src/lib/research/currency-performance';
import { buildEvidenceDocumentDiff } from '../../src/lib/research/evidence-document-diff';
import {
    buildPersistedResearchEvidenceBundle,
    buildResearchDocumentCitationDiff,
    canonicalPrimarySourceUrl,
    migrateResearchDocumentEvidenceSet,
    parseResearchDocumentEvidenceSet,
    researchDocumentContentDigest,
    splitPersistedResearchEvidence,
    type ResearchDocumentDiffItem,
} from '../../src/lib/research/document-evidence';
import {
    buildPortfolioFactorExposure,
    migrateResearchFactorAssumptionSet,
    parseResearchFactorAssumptionSet,
    researchFactorEvidenceIds,
} from '../../src/lib/research/factor-exposure';
import {
    buildOfficialSecFilingUrl,
    fetchSecFilingDiscovery,
    parseSecSubmissions,
} from '../../src/lib/research/sec-filings';
import type { ResearchDocumentCitation } from '../../src/lib/types/research';
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
    getResearchWorkflowSourceDestination,
    getResearchWorkflowTemplate,
    parseResearchWorkflowTasks,
    sortResearchWorkflowTasks,
    upsertResearchWorkflowTask,
    type ResearchWorkflowTask,
} from '../../src/lib/research/workflow-queue';
import {
    buildLocalResearchSearchIndex,
    localResearchSearchGroups,
    localResearchSearchLimits,
    searchLocalResearchIndex,
} from '../../src/lib/research/local-search';
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
import {
    createFirstRunSetupState,
    firstRunOwnerCompletedSteps,
    hasExistingFirstRunOwnerState,
    parseFirstRunSetupState,
    reconcileFirstRunSetupState,
    setFirstRunMonitoringSkipped,
    setFirstRunSetupStatus,
    updateFirstRunMarkets,
} from '../../src/lib/research/first-run';

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

const runFirstRunSetupTests = () => {
    const initial = createFirstRunSetupState('2026-07-30T09:00:00.000Z');
    assertEqual(initial.status, 'active', 'first-run setup begins active');
    assertEqual(initial.completedSteps.length, 0, 'first-run setup begins without invented completion');
    assertThrows(
        () => parseFirstRunSetupState({ ...initial, hiddenPayload: 'research content' }),
        'first-run setup rejects unexpected persisted fields',
    );
    assertThrows(
        () => parseFirstRunSetupState({ ...initial, markets: ['US', 'US'] }),
        'first-run setup rejects duplicate markets',
    );
    assertThrows(
        () => parseFirstRunSetupState({ ...initial, completedSteps: ['review', 'private-note'] }),
        'first-run setup accepts only bounded completion enums',
    );

    const markets = updateFirstRunMarkets(initial, ['MY', 'US'], '2026-07-30T09:01:00.000Z');
    assertEqual(markets.markets.join(','), 'US,MY', 'first-run markets use deterministic supported order');
    const created = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const reviewed = appendResearchReview({
        ...created,
        decisionJournal: { ...created.decisionJournal, nextReviewAt: '2026-08-30' },
        monitoringRules: {
            ...created.monitoringRules,
            structuredTriggers: {
                version: 1,
                migrationState: 'current',
                rules: [{
                    id: 'setup-rule',
                    purpose: 'opportunity-review',
                    metric: 'price',
                    operator: 'above',
                    threshold: 500,
                    enabled: true,
                }],
            },
        },
    }, '2026-07-30T09:02:00.000Z');
    const owner = { records: [reviewed], hasPortfolioSnapshot: false };
    assertEqual(firstRunOwnerCompletedSteps(markets, owner).join(','), 'markets,watchlist,review,schedule,monitoring', 'first-run derives completion from existing owners');

    const completed = reconcileFirstRunSetupState(markets, owner, '2026-07-30T09:03:00.000Z');
    assertEqual(completed.status, 'completed', 'first-run completes after all owner-backed steps');
    assertEqual(
        reconcileFirstRunSetupState(completed, owner, '2026-07-30T09:04:00.000Z').completedSteps.join(','),
        completed.completedSteps.join(','),
        'first-run reconciliation is idempotent',
    );

    const requiredOwner = {
        records: [{
            ...reviewed,
            monitoringRules: created.monitoringRules,
        }],
        hasPortfolioSnapshot: false,
    };
    const optionalSkipped = reconcileFirstRunSetupState(
        setFirstRunMonitoringSkipped(markets, true, '2026-07-30T09:05:00.000Z'),
        requiredOwner,
        '2026-07-30T09:06:00.000Z',
    );
    assertEqual(optionalSkipped.status, 'completed', 'first-run optional monitoring step can be explicitly skipped');
    assertEqual(
        reconcileFirstRunSetupState(
            setFirstRunSetupStatus(optionalSkipped, 'skipped', '2026-07-30T09:07:00.000Z'),
            requiredOwner,
            '2026-07-30T09:08:00.000Z',
        ).status,
        'skipped',
        'first-run skip remains explicit during reconciliation',
    );
    assertEqual(hasExistingFirstRunOwnerState({ records: [], hasPortfolioSnapshot: false }, 0), false, 'first-run detects a truly empty owner state');
    assertEqual(hasExistingFirstRunOwnerState({ records: [], hasPortfolioSnapshot: true }, 0), true, 'first-run preserves existing portfolio state');
    assertEqual(hasExistingFirstRunOwnerState({ records: [], hasPortfolioSnapshot: false }, 1), true, 'first-run preserves existing Queue state');
    assertEqual(created.reviewHistory.length, 0, 'first-run derivation does not mutate Research records');
};

const runResearchQuoteBatchTests = async () => {
    const parsed = parseResearchQuoteBatchRequest([
        { symbol: ' msft ', market: 'US' },
        { symbol: '1155.KL', market: 'MY' },
    ]);
    assertEqual(parsed[0]?.symbol, 'MSFT', 'quote batch normalizes symbols at the route boundary');
    assertEqual(parsed[1]?.market, 'MY', 'quote batch preserves explicit markets');
    assertThrows(() => parseResearchQuoteBatchRequest([]), 'quote batch rejects an empty request');
    assertThrows(
        () => parseResearchQuoteBatchRequest(Array.from({ length: 51 }, (_, index) => ({ symbol: `A${index}`, market: 'US' }))),
        'quote batch rejects oversized item collections',
    );
    assertThrows(
        () => parseResearchQuoteBatchRequest([{ symbol: 'MSFT', market: 'US', account: 'private' }]),
        'quote batch rejects unexpected private fields',
    );
    assertThrows(
        () => parseResearchQuoteBatchRequest([{ symbol: 'MSFT', market: 'US' }, { symbol: 'msft', market: 'US' }]),
        'quote batch rejects duplicate exact identities',
    );

    let active = 0;
    let maximumActive = 0;
    const requests = parseResearchQuoteBatchRequest([
        { symbol: 'A', market: 'US' },
        { symbol: 'B', market: 'US' },
        { symbol: 'C', market: 'US' },
        { symbol: 'D', market: 'US' },
        { symbol: 'E', market: 'US' },
        { symbol: 'F', market: 'US' },
        { symbol: 'FAIL', market: 'MY' },
    ]);
    const results = await getResearchQuoteBatch(requests, async (symbol, market): Promise<ResearchQuoteData> => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        try {
            await new Promise((resolve) => setTimeout(resolve, 1));
            if (symbol === 'FAIL') throw new Error('fixture failure');
            return {
                symbol,
                market,
                providerSymbol: symbol,
                fetchedAt: '2026-07-29T00:00:00.000Z',
                quote: { name: symbol, currency: market === 'MY' ? 'MYR' : 'USD', price: 10, dailyChangePercent: 1 },
            };
        } finally {
            active -= 1;
        }
    });
    assertEqual(maximumActive, researchQuoteBatchLimits.concurrency, 'quote batch caps provider concurrency');
    assertEqual(results.length, requests.length, 'quote batch preserves one result per input');
    assertEqual(results[0]?.success, true, 'quote batch retains successful items');
    assertEqual(results[6]?.success, false, 'quote batch degrades one provider failure independently');

    const response = parseResearchQuoteBatchResponse({
        success: true,
        data: { fetchedAt: '2026-07-29T00:00:00.000Z', items: results },
    });
    assertEqual(response.length, 7, 'quote batch client boundary accepts bounded partial results');
    assertThrows(
        () => parseResearchQuoteBatchResponse({
            success: true,
            data: {
                fetchedAt: '2026-07-29T00:00:00.000Z',
                items: Array.from({ length: 51 }, () => results[0]),
            },
        }),
        'quote batch client boundary rejects oversized responses',
    );
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
    assertEqual(parseResearchUrlQuery('cloud infrastructure'), 'cloud infrastructure', 'research URL accepts a bounded search query');
    assertEqual(parseResearchUrlQuery('x'.repeat(81)), '', 'research URL rejects an overlong search query');
    assertEqual(parseResearchUrlQuery('unsafe\u0000query'), '', 'research URL rejects control characters in a search query');
    assertEqual(parseResearchUrlMarket('MY'), 'MY', 'research URL accepts a supported market filter');
    assertEqual(parseResearchUrlMarket('EU'), 'ALL', 'research URL falls back from an unknown market filter');
    assertEqual(parseResearchUrlDecision('Wait for price'), 'Wait for price', 'research URL accepts a supported decision filter');
    assertEqual(parseResearchUrlDecision('Buy now'), 'ALL', 'research URL falls back from an unknown decision filter');
    assertEqual(parseResearchUrlDensity('compact'), 'compact', 'research URL accepts a supported density');
    assertEqual(parseResearchUrlDensity('tiny'), null, 'research URL ignores an unknown density so saved preference can recover');

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
    assertEqual(researchWorkspaceGroups.length, 6, 'research navigation exposes no more than six primary sections');
    assertEqual(new Set(workspaceIds).size, workspaceIds.length, 'research navigation assigns every workspace at most once');
    assertEqual(
        [...workspaceIds].sort().join('|'),
        [...researchLayoutWorkspaces].sort().join('|'),
        'research navigation assigns every supported workspace exactly once',
    );
    assertEqual(researchWorkspaceGroupFor('picker').id, 'analyze', 'Picker lives under Analyze');
    assertEqual(researchWorkspaceGroupFor('today').id, 'today', 'Today is a first-class section');
    assertEqual(researchWorkspaceGroupFor('queue').id, 'today', 'Queue lives under Today');
    assertEqual(researchWorkspaceGroupFor('relationships').id, 'analyze', 'Map lives under Analyze');
    assertEqual(researchWorkspaceGroupFor('outcomes').id, 'review', 'Outcomes lives under Review');
    assertEqual(researchWorkspaceGroupFor('backup').id, 'more', 'Backup lives under More');
    assertEqual(researchWorkspaceGroups.find((group) => group.id === 'today')?.defaultWorkspace, 'today', 'Today opens directly');
    assertEqual(researchWorkspaceGroups.find((group) => group.id === 'analyze')?.items[1]?.label, 'Picker', 'Analyze keeps Picker discoverable');
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
    assertEqual(getResearchWorkflowSourceDestination('manual'), null, 'manual Queue tasks have no source destination');
    assertEqual(getResearchWorkflowSourceDestination('thesis-change')?.kind, 'research', 'connected Queue tasks retain an internal source destination');
    const thesisChangeDestination = getResearchWorkflowSourceDestination('thesis-change');
    assertEqual(
        thesisChangeDestination?.kind === 'research'
            ? thesisChangeDestination.workspace
            : null,
        'changes',
        'thesis-change Queue tasks return to Changes',
    );
    const marketExposureDestination = getResearchWorkflowSourceDestination('market-exposure');
    assertEqual(
        marketExposureDestination?.kind === 'market'
            ? marketExposureDestination.pathname
            : null,
        '/',
        'market-exposure Queue tasks return to Market',
    );
    for (const source of ['factor-exposure', 'portfolio-holdings', 'portfolio-reconciliation'] as const) {
        const destination = getResearchWorkflowSourceDestination(source);
        assertEqual(
            destination?.kind === 'research' ? destination.workspace : null,
            'portfolio',
            `${source} Queue tasks return to Portfolio`,
        );
    }

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
    const portfolioHolding = enqueueResearchWorkflowTask([], {
        symbol: 'MSFT',
        templateId: 'thesis-challenge',
        source: 'portfolio-holdings',
        dueAt: '2026-07-27',
    }, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '2026-07-26T00:00:00.000Z');
    const duplicatePortfolioHolding = enqueueResearchWorkflowTask(portfolioHolding.tasks, {
        symbol: 'MSFT',
        templateId: 'thesis-challenge',
        source: 'portfolio-holdings',
        dueAt: '2026-07-28',
    }, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '2026-07-26T01:00:00.000Z');
    assertEqual(portfolioHolding.task.source, 'portfolio-holdings', 'workflow queue retains portfolio-holdings provenance');
    assertEqual(duplicatePortfolioHolding.created, false, 'workflow queue deduplicates repeated holding-review prompts');
    assertEqual(duplicatePortfolioHolding.tasks.length, 1, 'workflow queue keeps one pending holding review across account rows');
    const portfolioReconciliation = enqueueResearchWorkflowTask([], {
        symbol: '1155.KL',
        templateId: 'thesis-challenge',
        source: 'portfolio-reconciliation',
        dueAt: '2026-07-27',
    }, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '2026-07-26T00:00:00.000Z');
    const duplicatePortfolioReconciliation = enqueueResearchWorkflowTask(portfolioReconciliation.tasks, {
        symbol: '1155.KL',
        templateId: 'thesis-challenge',
        source: 'portfolio-reconciliation',
        dueAt: '2026-07-28',
    }, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '2026-07-26T01:00:00.000Z');
    assertEqual(portfolioReconciliation.task.source, 'portfolio-reconciliation', 'workflow queue retains portfolio-reconciliation provenance');
    assertEqual(duplicatePortfolioReconciliation.created, false, 'workflow queue deduplicates repeated reconciliation-review prompts');
    assertEqual(duplicatePortfolioReconciliation.tasks.length, 1, 'workflow queue keeps one pending reconciliation review across account rows');
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

const runLocalResearchSearchTests = () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const citationDraft = {
        id: '0000789019-26-000001',
        market: 'US' as const,
        symbol: 'MSFT',
        sourceKind: '10-Q' as const,
        publicationDate: '2026-07-20',
        reportingPeriod: '2026-06-30',
        title: 'Microsoft quarterly filing',
        sourceUrl: 'https://www.sec.gov/Archives/edgar/data/789019/000078901926000001/msft-20260630.htm?private-marker=do-not-index',
        providerLabel: 'SEC EDGAR',
        location: 'Risk factors, page 42',
        excerpt: 'PRIVATE-FILING-EXCERPT must remain outside the search index.',
        capturedAt: '2026-07-20T12:00:00.000Z',
        captureMethod: 'sec-official' as const,
    };
    const citation: ResearchDocumentCitation = {
        ...citationDraft,
        contentDigest: researchDocumentContentDigest(citationDraft),
    };
    const record = {
        ...base,
        whyInterested: 'Durable enterprise demand and pricing power support the research case.',
        notes: 'Review renewal evidence before the next decision.',
        acceptedEvidence: [{
            id: 'accepted-revenue',
            title: 'Annual revenue evidence',
            summary: 'Revenue growth remained positive.',
            target: 'bullCase' as const,
            tone: 'positive' as const,
            mode: 'evidence' as const,
            acceptedAt: '2026-07-20T12:00:00.000Z',
            sources: [{
                id: 'source-revenue',
                label: 'Annual revenue growth',
                value: 'PRIVATE-EVIDENCE-VALUE',
                source: 'SEC Company Facts',
                sourceUrl: 'https://data.sec.gov/private-search-marker',
                reportingPeriod: '2026-06-30',
            }],
        }],
        documentEvidence: { version: 1 as const, migrationState: 'current' as const, citations: [citation] },
    };
    const queueTask: ResearchWorkflowTask = {
        id: '11111111-1111-4111-8111-111111111111',
        symbol: 'MSFT',
        templateId: 'post-event',
        source: 'document-diff',
        dedupeKey: 'PRIVATE-QUEUE-DEDUPE-KEY',
        dueAt: '2026-07-30',
        createdAt: '2026-07-20T12:00:00.000Z',
        completedAt: null,
    };
    const beforeRecord = JSON.stringify(record);
    const beforeQueue = JSON.stringify(queueTask);
    const index = buildLocalResearchSearchIndex([record], [queueTask]);
    assertEqual(
        localResearchSearchGroups.every((group) => index.some((item) => item.group === group)),
        true,
        'local research search builds every accepted owner group',
    );
    assertEqual(searchLocalResearchIndex(index, 'msft').results[0]?.group, 'Ticker', 'exact ticker matches rank first');
    const thesis = searchLocalResearchIndex(index, 'pricing power').results[0];
    assertEqual(thesis?.group, 'Research', 'authored thesis text is searchable in the browser-local index');
    assertEqual(thesis?.destination.workspace, 'research', 'thesis results open the owning Research record');
    assertEqual(thesis?.snippet.includes('pricing power'), true, 'authored matches show a short local snippet');
    const evidence = searchLocalResearchIndex(index, 'SEC Company Facts').results[0];
    assertEqual(evidence?.group, 'Evidence', 'accepted-evidence source titles are searchable');
    assertEqual(evidence?.destination.workspace, 'research', 'accepted evidence opens the owning Research record');
    const filing = searchLocalResearchIndex(index, '0000789019-26-000001').results[0];
    assertEqual(filing?.group, 'Filings', 'filing identifiers are searchable');
    assertEqual(filing?.destination.workspace, 'filings', 'filing results open the owning Filings workspace');
    assertEqual(filing?.destination.symbol, 'MSFT', 'filing results preserve exact ticker context');
    const queue = searchLocalResearchIndex(index, 'Filing evidence').results[0];
    assertEqual(queue?.group, 'Queue', 'fixed Queue source metadata is searchable');
    assertEqual(queue?.destination.workspace, 'queue', 'Queue results open the Queue owner');
    assertEqual(
        queue?.destination.workspace === 'queue' ? queue.destination.taskId : null,
        queueTask.id,
        'Queue results retain the exact task destination',
    );
    assertEqual(searchLocalResearchIndex(index, 'P').results.length, 0, 'single-character local queries do not scan authored text');
    assertEqual(searchLocalResearchIndex(index, 'PRIVATE-EVIDENCE-VALUE').results.length, 0, 'evidence values stay outside the search index');
    assertEqual(searchLocalResearchIndex(index, 'PRIVATE-FILING-EXCERPT').results.length, 0, 'filing excerpts stay outside the search index');
    assertEqual(searchLocalResearchIndex(index, 'PRIVATE-QUEUE-DEDUPE-KEY').results.length, 0, 'Queue dedupe keys stay outside the search index');
    const serializedIndex = JSON.stringify(index);
    assertEqual(serializedIndex.includes('private-search-marker'), false, 'source URLs stay outside the local search index');
    assertEqual(serializedIndex.includes('private-marker'), false, 'filing URLs stay outside the local search index');
    assertEqual(JSON.stringify(record), beforeRecord, 'building the local index does not mutate research records');
    assertEqual(JSON.stringify(queueTask), beforeQueue, 'building the local index does not mutate Queue state');

    const manyRecords = Array.from({ length: 20 }, (_, indexValue) => ({
        ...createResearchRecord({
            symbol: `S${indexValue}`,
            market: 'US',
            companyName: `Search Fixture ${indexValue}`,
        }),
        whyInterested: `Shared bounded phrase ${indexValue}`,
    }));
    const largeIndex = buildLocalResearchSearchIndex(manyRecords, []);
    const largeSearch = searchLocalResearchIndex(largeIndex, 'shared bounded phrase');
    assertEqual(largeSearch.totalMatches, 20, 'large local result sets retain the deterministic total');
    assertEqual(largeSearch.results.length, localResearchSearchLimits.resultsPerGroup, 'large local result sets are capped per owner');
    assertEqual(largeSearch.truncated, true, 'large local result sets disclose truncation');
    assertEqual(
        JSON.stringify(searchLocalResearchIndex(largeIndex, 'shared bounded phrase')),
        JSON.stringify(largeSearch),
        'identical local inputs produce identical search order and snippets',
    );
    assertEqual(
        largeSearch.results.every((result) => result.snippet.length <= localResearchSearchLimits.snippetLength + 2),
        true,
        'local search snippets remain bounded',
    );
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

const runResearchReadinessTests = () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const baseAssessment = {
        symbol: 'MSFT',
        sector: 'Technology',
        violations: [],
        evidenceCoveragePercent: 100,
        reviewAgeDays: 1,
        compliant: true,
    } as const;
    const empty = buildResearchReadiness({ record: base, sector: 'Technology', policyAssessment: null, today: '2026-07-26' });
    assertEqual(empty.items.length, 7, 'research readiness exposes each saved-state owner exactly once');
    assertEqual(empty.nextGap.label, 'Thesis and checklist', 'research readiness starts with incomplete authored research');
    assertEqual(empty.context, 'US · Technology · saved research only', 'research readiness keeps market and sector context descriptive');
    assertEqual(
        JSON.stringify(buildResearchReadiness({ record: base, sector: 'Technology', policyAssessment: null, today: '2026-07-26' })),
        JSON.stringify(empty),
        'research readiness is deterministic for identical saved inputs',
    );

    const targets = ['whyInterested', 'bullCase', 'bearCase', 'buyTrigger', 'sellTrigger', 'thesisBreak', 'notes'] as const;
    const evidenceReady = {
        ...base,
        whyInterested: 'Why interested',
        bullCase: 'Bull case',
        bearCase: 'Bear case',
        buyTrigger: 'Buy trigger',
        sellTrigger: 'Sell trigger',
        thesisBreak: 'Thesis invalidation',
        notes: 'Review notes',
        checklist: Object.fromEntries(Object.keys(base.checklist).map((key) => [key, true])) as typeof base.checklist,
        acceptedEvidence: targets.map((target) => ({
            id: `evidence-${target}`,
            title: `${target} evidence`,
            summary: 'Bounded fixture.',
            target,
            tone: 'neutral' as const,
            mode: 'evidence' as const,
            acceptedAt: '2026-07-25T00:00:00.000Z',
            sources: [{
                id: `source-${target}`,
                label: 'Saved evidence',
                value: 'Available',
                source: 'Fixture source',
                sourceUrl: 'https://example.com/evidence',
                reportingPeriod: '2026-07-25',
            }],
        })),
    };
    const valuationGap = buildResearchReadiness({ record: evidenceReady, sector: 'Technology', policyAssessment: baseAssessment, today: '2026-07-26' });
    assertEqual(valuationGap.nextGap.label, 'Saved valuation', 'unknown valuation follows complete research and evidence in the fixed precedence');

    const valued = { ...evidenceReady, valuationState: 'fair' as const };
    const policyGap = buildResearchReadiness({
        record: valued,
        sector: 'Technology',
        policyAssessment: { ...baseAssessment, compliant: false, violations: [{ kind: 'review-age' as const, message: 'Review stale.', actual: 100, limit: 90 }] },
        today: '2026-07-26',
    });
    assertEqual(policyGap.nextGap.label, 'Policy guardrails', 'saved-policy violations precede monitoring and scheduling gaps');

    const triggerGap = buildResearchReadiness({ record: valued, sector: 'Technology', policyAssessment: baseAssessment, today: '2026-07-26' });
    assertEqual(triggerGap.nextGap.label, 'Structured triggers', 'missing structured triggers remain explicit after policy passes');
    const monitored = {
        ...valued,
        monitoringRules: {
            ...valued.monitoringRules,
            structuredTriggers: {
                ...valued.monitoringRules.structuredTriggers,
                rules: [{ id: 'review-age', enabled: true, purpose: 'scheduled-evidence-review' as const, metric: 'research-age-days' as const, operator: 'above' as const, threshold: 30 }],
            },
        },
    };
    const reviewGap = buildResearchReadiness({ record: monitored, sector: 'Technology', policyAssessment: baseAssessment, today: '2026-07-26' });
    assertEqual(reviewGap.nextGap.label, 'Next review', 'missing next-review date follows configured monitoring');
    const overdue = { ...monitored, decisionJournal: { ...monitored.decisionJournal, nextReviewAt: '2026-07-25' } };
    const overdueGap = buildResearchReadiness({ record: overdue, sector: 'Technology', policyAssessment: baseAssessment, today: '2026-07-26' });
    assertEqual(overdueGap.items.find((item) => item.id === 'review')?.status, 'Overdue', 'readiness labels a past next-review date as overdue');
    assertEqual(overdueGap.nextGap.label, 'Next review', 'an overdue review remains the single next readiness action');
    const scheduled = { ...monitored, decisionJournal: { ...monitored.decisionJournal, nextReviewAt: '2026-08-01' } };
    const positionGap = buildResearchReadiness({ record: scheduled, sector: 'Technology', policyAssessment: baseAssessment, today: '2026-07-26' });
    assertEqual(positionGap.nextGap.label, 'Position plan', 'incomplete position planning is the final saved-state gap');
    const complete = { ...scheduled, positionPlan: { ...scheduled.positionPlan, plannedAllocationPercent: 5, plannedEntryPrice: 100, invalidationPrice: 90 } };
    const ready = buildResearchReadiness({ record: complete, sector: 'Technology', policyAssessment: baseAssessment, today: '2026-07-26' });
    assertEqual(ready.nextGap.label, 'Review current evidence', 'readiness falls back to review without inventing a score when no gap remains');
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
    assertEqual(parseResearchUpdateMode({ mode: 'evidence' }), 'evidence', 'document-evidence updates use an explicit narrow mode');
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

const runPrimaryDocumentEvidenceTests = async () => {
    const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
    const draft = {
        id: 'msft-10q-2026q2-risk',
        market: 'US' as const,
        symbol: 'MSFT',
        sourceKind: '10-Q' as const,
        publicationDate: '2026-07-20',
        reportingPeriod: '2026-06-30',
        title: 'Microsoft 2026 Q2 Form 10-Q',
        sourceUrl: 'https://www.sec.gov/Archives/edgar/data/789019/000078901926000001/msft-20260630.htm#risk',
        providerLabel: 'SEC EDGAR',
        location: 'Risk factors, page 42',
        excerpt: '<script>alert("text only")</script> Customer demand may vary.',
        capturedAt: '2026-07-21T08:00:00.000Z',
        captureMethod: 'sec-official' as const,
    };
    const citation: ResearchDocumentCitation = { ...draft, contentDigest: researchDocumentContentDigest(draft) };
    assertEqual(citation.contentDigest, researchDocumentContentDigest({ ...draft }), 'document content fingerprint is stable');
    assertEqual(canonicalPrimarySourceUrl(`${draft.sourceUrl}#ignored`).includes('#'), false, 'canonical document URL strips fragments');
    assertThrows(() => canonicalPrimarySourceUrl('http://www.sec.gov/example'), 'manual capture rejects non-HTTPS sources');
    assertThrows(() => canonicalPrimarySourceUrl('https://user:secret@example.com/report'), 'manual capture rejects embedded credentials');
    assertEqual(parseResearchDocumentEvidenceSet({ version: 1, citations: [citation] }, { market: 'US', symbol: 'MSFT' }).citations[0]?.excerpt, draft.excerpt, 'citation boundary preserves verbatim markup as inert text');
    assertThrows(() => parseResearchDocumentEvidenceSet({ version: 1, citations: [{ ...citation, symbol: 'AAPL' }] }, { market: 'US', symbol: 'MSFT' }), 'citation boundary enforces market and symbol ownership');
    const spoofedSec = { ...citation, sourceUrl: 'https://example.com/report', contentDigest: researchDocumentContentDigest({ ...draft, sourceUrl: 'https://example.com/report' }) };
    assertThrows(() => parseResearchDocumentEvidenceSet({ version: 1, citations: [spoofedSec] }), 'official SEC provenance cannot point at an arbitrary HTTPS host');
    assertThrows(() => parseResearchDocumentEvidenceSet({ version: 1, citations: [{ ...citation, excerpt: 'changed without digest update' }] }), 'citation boundary rejects stale content fingerprints');
    assertThrows(() => parseResearchDocumentEvidenceSet({ version: 1, citations: Array.from({ length: 26 }, (_, index) => ({ ...citation, id: `citation-${index}` })) }), 'citation list is bounded to 25 entries');
    assertThrows(() => parseResearchDocumentEvidenceSet({ version: 1, citations: [{ ...citation, excerpt: 'x'.repeat(2001), contentDigest: 'fnv1a32:00000000' }] }), 'citation excerpt length is bounded');
    assertEqual(migrateResearchDocumentEvidenceSet(undefined).migrationState, 'migrated-empty', 'legacy records migrate to an empty citation set');
    assertEqual(migrateResearchDocumentEvidenceSet({ version: 1, citations: [{ broken: true }] }).migrationState, 'invalid-recovered', 'malformed persisted citations recover visibly');
    const bundle = buildPersistedResearchEvidenceBundle(
        [],
        { version: 1, migrationState: 'current', citations: [citation] },
        { version: 1, migrationState: 'current', assumptions: [] },
    );
    assertEqual(splitPersistedResearchEvidence(bundle).documentEvidence !== undefined, true, 'versioned evidence bundle shares the existing JSON column');
    assertEqual(splitPersistedResearchEvidence([]).documentEvidence, undefined, 'legacy evidence arrays remain readable');

    const evidenceUpdate = parseResearchUpdateInput({ documentEvidence: { version: 1, citations: [citation] } });
    const evidenceOnly = prepareStoredResearchRecord(base, {
        ...evidenceUpdate,
        bullCase: 'must not be applied',
        checklist: { understandBusiness: true },
        decisionJournal: { ...base.decisionJournal, confidence: 'high' },
    }, 'evidence');
    assertEqual(evidenceOnly.documentEvidence.citations.length, 1, 'evidence-only save applies document citations');
    assertEqual(evidenceOnly.bullCase, base.bullCase, 'evidence-only save cannot mutate thesis');
    assertEqual(evidenceOnly.checklist.understandBusiness, false, 'evidence-only save cannot mutate checklist');
    assertEqual(evidenceOnly.decisionJournal.confidence, base.decisionJournal.confidence, 'evidence-only save cannot mutate decision journal');
    assertEqual(evidenceOnly.reviewHistory.length, 0, 'evidence-only save does not fabricate a review snapshot');
    const reviewed = appendResearchReview(evidenceOnly, '2026-07-22T08:00:00.000Z');
    const editedDraft = { ...draft, excerpt: 'Customer demand changed in this captured selection.' };
    const edited = { ...editedDraft, contentDigest: researchDocumentContentDigest(editedDraft) };
    const changedRecord = { ...reviewed, documentEvidence: { version: 1 as const, migrationState: 'current' as const, citations: [edited] } };
    const changed = buildResearchDocumentCitationDiff(changedRecord.…24799 tokens truncated…nside buy zone'), true, 'price inside configured zone alerts');
    assertEqual(alerts.some((alert) => alert.title === 'Large daily move'), true, 'large daily move alerts');
    assertEqual(alerts.some((alert) => alert.title === 'Oversold review'), true, 'low RSI alerts without claiming a buy');
    assertEqual(alerts.some((alert) => alert.title === 'Below 50-day average'), true, 'medium trend weakness alerts');

    const monitoringRules = { ...defaultResearchMonitoringRules, reviewAgeDays: 14 };
    const request = buildResearchAlertRequest([{
        symbol: 'MSFT', market: 'US', targetBuyZone: '$390 - $405', lastReviewedAt: '2026-07-01',
    }, {
        symbol: 'MAYBANK', market: 'MY', targetBuyZone: 'RM9.20 - RM9.60', lastReviewedAt: '2026-07-02',
    }], [{
        symbol: 'MSFT', lastReviewedAt: '2026-07-20', acceptedEvidence: [], monitoringRules,
    }]);
    assertEqual(request[0]?.lastReviewedAt, '2026-07-20', 'alert request uses the saved record review date');
    assertEqual(request[0]?.acceptedEvidence.length, 0, 'alert request includes accepted evidence');
    assertEqual(request[0]?.monitoringRules.reviewAgeDays, 14, 'alert request includes saved monitoring rules');
    assertEqual(request[1]?.lastReviewedAt, '2026-07-02', 'alert request falls back to the watchlist review date');
    assertEqual(request[1]?.monitoringRules.reviewAgeDays, defaultResearchMonitoringRules.reviewAgeDays, 'alert request includes default monitoring rules without a saved record');
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
    const baselineTrace = explainPickerSelection(data, balanced);
    assertEqual(
        JSON.stringify(baselineTrace.selected),
        JSON.stringify(selectPickerCandidates(data, balanced)),
        'picker explanation preserves the existing selected candidates and order',
    );
    assertEqual(
        JSON.stringify(baselineTrace.counts),
        JSON.stringify({ scanned: 3, policyEligible: 3, riskScoreEligible: 2, diversificationEligible: 2, shortlisted: 2 }),
        'picker explanation reports conserved funnel counts',
    );
    assertEqual(
        baselineTrace.decisions.length,
        3,
        'picker explanation represents every unique input symbol exactly once',
    );
    assertEqual(
        Object.values(baselineTrace.exclusionCounts).reduce((sum, count) => sum + count, 0),
        baselineTrace.decisions.filter((decision) => decision.outcome === 'excluded').length,
        'picker explanation exclusion counts match excluded decisions',
    );
    assertEqual(
        JSON.stringify(explainPickerSelection(data, balanced)),
        JSON.stringify(baselineTrace),
        'picker explanation is deterministic for identical inputs',
    );
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
    assertEqual(
        JSON.stringify(buildPickerCandidateBrief(policyRanked[0])),
        JSON.stringify({
            support: 'Business quality',
            riskOrUnknown: 'No principal risk is identified by this bounded scan; complete Research before acting.',
            evidenceStatus: 'confirmed',
        }),
        'picker brief chooses one bounded support, one risk or unknown, and confirmed coverage',
    );
    const partialBrief = buildPickerCandidateBrief({
        ...policyRanked[0],
        qualityScore: null,
        qualityReasons: [],
        reasons: ['Above 50- and 200-day averages'],
        risk: 'moderate',
    });
    assertEqual(
        JSON.stringify(partialBrief),
        JSON.stringify({
            support: 'Above 50- and 200-day averages',
            riskOrUnknown: 'Current risk is moderate.',
            evidenceStatus: 'partial',
        }),
        'picker brief keeps partial evidence and the principal bounded risk explicit',
    );
    const unconfirmedBrief = buildPickerCandidateBrief({
        ...policyRanked[0],
        qualityScore: null,
        qualityReasons: [],
        reasons: [],
        valuation: { guardrail: 'unavailable', priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null },
    });
    assertEqual(unconfirmedBrief.evidenceStatus, 'unconfirmed', 'picker brief identifies unconfirmed quality and valuation coverage');
    assertEqual(unconfirmedBrief.riskOrUnknown, 'Valuation evidence is unavailable.', 'picker brief emits one explicit unavailable-evidence statement');

    const traceCandidates = [
        candidate({ symbol: 'SELECT_A', discoveryScore: 99, sector: 'Technology' }),
        candidate({ symbol: 'SELECT_B', discoveryScore: 98, sector: 'Healthcare' }),
        candidate({ symbol: 'SELECT_C', discoveryScore: 97, sector: 'Financials' }),
        candidate({ symbol: 'CUTOFF', discoveryScore: 96, sector: 'Industrials' }),
        candidate({ symbol: 'SECTOR_CAP', discoveryScore: 95, sector: 'Technology' }),
        candidate({ symbol: 'SAVED', discoveryScore: 94, sector: 'Energy' }),
        candidate({ symbol: 'CONSERVATIVE', discoveryScore: 93, risk: 'moderate', sector: 'Real Estate' }),
        candidate({ symbol: 'MINIMUM', discoveryScore: 60, sector: 'Utilities' }),
        candidate({ symbol: 'HIGH_RISK', discoveryScore: 92, risk: 'high', sector: 'Materials' }),
        {
            ...candidate({
                symbol: 'LIMITED',
                discoveryScore: 91,
                sector: 'Communication Services',
                valuation: { guardrail: 'unavailable', priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null },
            }),
            qualityScore: null,
        },
        candidate({ symbol: 'SELECT_A', discoveryScore: 10, sector: 'Utilities' }),
    ];
    const detailedTrace = explainPickerSelection({ candidates: traceCandidates, contenders: [] }, {
        ...balanced,
        riskProfile: 'conservative',
        maximumPerSector: 1,
        excludeSavedSymbols: true,
    }, { savedSymbols: ['SAVED'] });
    assertEqual(detailedTrace.selected.map((item) => item.symbol).join(','), 'SELECT_A,SELECT_B,SELECT_C', 'picker trace keeps the current sorted selection under combined rules');
    assertEqual(detailedTrace.counts.scanned, 10, 'picker trace retains first-seen behavior for duplicate symbols');
    assertEqual(detailedTrace.counts.policyEligible, 9, 'picker trace counts policy-eligible unique symbols');
    assertEqual(detailedTrace.counts.riskScoreEligible, 7, 'picker trace counts candidates after risk and score checks');
    assertEqual(detailedTrace.counts.diversificationEligible, 5, 'picker trace counts candidates after saved-symbol and sector rules');
    assertEqual(detailedTrace.exclusionCounts['shortlist-cutoff'], 2, 'picker trace explains candidates beyond the configured shortlist size');
    assertEqual(detailedTrace.exclusionCounts['sector-cap'], 1, 'picker trace explains sector diversification exclusions');
    assertEqual(detailedTrace.exclusionCounts['saved-symbol'], 1, 'picker trace explains saved-symbol exclusions');
    assertEqual(detailedTrace.exclusionCounts['conservative-profile'], 1, 'picker trace explains conservative-profile exclusions');
    assertEqual(detailedTrace.exclusionCounts['minimum-score'], 1, 'picker trace explains minimum-score exclusions');
    assertEqual(detailedTrace.exclusionCounts['high-risk'], 1, 'picker trace explains high-risk exclusions');
    assertEqual(
        detailedTrace.decisions.find((decision) => decision.symbol === 'LIMITED')?.evidenceLimitations.join(','),
        'quality-unavailable,valuation-unavailable',
        'picker trace keeps unavailable quality and valuation explicit',
    );
    const rejectionSummary = buildPickerRejectionSummary(detailedTrace);
    assertEqual(
        rejectionSummary.map((reason) => `${reason.code}:${reason.count}`).join(','),
        'high-risk:1,conservative-profile:1,minimum-score:1,saved-symbol:1,sector-cap:1,shortlist-cutoff:2',
        'picker rejection summary maps the stable trace codes to fixed counted reasons',
    );
    assertEqual(
        rejectionSummary.flatMap((reason) => reason.exampleSymbols).join(','),
        'HIGH_RISK,CONSERVATIVE,MINIMUM,SAVED,SECTOR_CAP',
        'picker rejection examples preserve decision order within reason and cap disclosure at five symbols',
    );
    assertEqual(
        detailedTrace.selected.map((item) => item.symbol).join(','),
        'SELECT_A,SELECT_B,SELECT_C',
        'building rejection disclosure does not mutate selection order',
    );

    const policyReasonCases = [
        {
            expected: 'discovery-policy-sector',
            candidate: candidate({ symbol: 'POLICY_SECTOR', discoveryScore: 90, sector: 'Utilities' }),
            policy: { ...defaultDiscoveryUniversePolicy, sectors: ['Technology'] },
        },
        {
            expected: 'discovery-policy-liquidity',
            candidate: {
                ...candidate({ symbol: 'POLICY_LIQUIDITY', discoveryScore: 90 }),
                averageDollarVolume: 10_000_000,
            },
            policy: defaultDiscoveryUniversePolicy,
        },
        {
            expected: 'discovery-policy-risk',
            candidate: candidate({ symbol: 'POLICY_RISK', discoveryScore: 90, risk: 'moderate' }),
            policy: { ...defaultDiscoveryUniversePolicy, maximumRisk: 'low' as const },
        },
        {
            expected: 'discovery-policy-valuation',
            candidate: candidate({ symbol: 'POLICY_VALUATION', discoveryScore: 90, valuation: { guardrail: 'extreme', priceEarnings: 90, priceSales: 30, freeCashFlowYieldPercent: 0.5 } }),
            policy: { ...defaultDiscoveryUniversePolicy, excludeExtremeValuation: true },
        },
    ] as const;
    for (const testCase of policyReasonCases) {
        const trace = explainPickerSelection({ candidates: [testCase.candidate], contenders: [] }, balanced, { policy: testCase.policy });
        assertEqual(trace.decisions[0]?.exclusionReason, testCase.expected, `picker trace exposes fixed ${testCase.expected} reason`);
    }
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

const runPortfolioFactorExposureTests = () => {
    const acceptedEvidence = [{
        id: 'accepted-msft',
        title: 'Accepted fact',
        summary: 'Accepted summary',
        target: 'bullCase' as const,
        tone: 'positive' as const,
        mode: 'evidence' as const,
        acceptedAt: '2026-07-01T00:00:00.000Z',
        sources: [{
            id: 'source-msft',
            label: 'Revenue',
            value: '100',
            source: 'SEC EDGAR',
            sourceUrl: 'https://www.sec.gov/',
            reportingPeriod: '2026-Q2',
        }],
    }];
    const base = {
        ...createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' }),
        acceptedEvidence,
    };
    const valid = parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: [{
            factor: 'interest-rates',
            direction: 'harmed-when-rises',
            materiality: 'high',
            evidenceNote: 'Higher discount rates may pressure the declared valuation thesis.',
            evidenceDate: '2026-07-01',
            evidenceId: 'accepted-msft',
        }],
    }, researchFactorEvidenceIds(base));
    assertEqual(valid.assumptions.length, 1, 'factor contract accepts one explicit fixed-enum assumption');
    assertThrows(() => parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: [valid.assumptions[0], { ...valid.assumptions[0], direction: 'mixed' }],
    }), 'factor contract rejects duplicate factors');
    assertThrows(() => parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: [{ ...valid.assumptions[0], factor: 'custom-factor' }],
    }), 'factor contract rejects custom factor names');
    assertThrows(() => parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: [{ ...valid.assumptions[0], direction: 'neutral' }],
    }), 'factor contract rejects unsupported direction');
    assertThrows(() => parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: [{ ...valid.assumptions[0], evidenceDate: '2026-02-30' }],
    }), 'factor contract rejects invalid evidence dates');
    assertThrows(() => parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: [{ ...valid.assumptions[0], evidenceNote: 'x'.repeat(501) }],
    }), 'factor contract bounds evidence notes');
    assertThrows(() => parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: [{ ...valid.assumptions[0], evidenceId: 'other-record-evidence' }],
    }, researchFactorEvidenceIds(base)), 'factor contract enforces same-record evidence ownership');
    assertThrows(() => parseResearchFactorAssumptionSet({
        version: 1,
        assumptions: Array.from({ length: 11 }, (_, index) => ({
            ...valid.assumptions[0],
            factor: `factor-${index}`,
        })),
    }), 'factor contract enforces the bounded total before custom factor parsing');
    assertEqual(migrateResearchFactorAssumptionSet(undefined).migrationState, 'migrated-empty', 'legacy records migrate to empty factor assumptions');
    assertEqual(migrateResearchFactorAssumptionSet({ version: 1, assumptions: [{ bad: true }] }).migrationState, 'invalid-recovered', 'malformed factors recover visibly');

    const reviewedInput = {
        ...base,
        whyInterested: 'Keep this thesis unchanged.',
        checklist: { ...base.checklist, understandBusiness: true },
        monitoringRules: { ...base.monitoringRules, reviewAgeDays: 45 },
        factorAssumptions: valid,
        revision: 7,
    };
    const factorsOnly = prepareStoredResearchRecord(reviewedInput, {
        factorAssumptions: {
            version: 1,
            migrationState: 'current',
            assumptions: [{ ...valid.assumptions[0], materiality: 'moderate' }],
        },
        whyInterested: 'Attempted unrelated mutation.',
        acceptedEvidence: [],
        monitoringRules: defaultResearchMonitoringRules,
    }, 'factors');
    assertEqual(factorsOnly.factorAssumptions.assumptions[0]?.materiality, 'moderate', 'factor mode applies the validated factor set');
    assertEqual(factorsOnly.whyInterested, reviewedInput.whyInterested, 'factor mode isolates thesis text');
    assertEqual(JSON.stringify(factorsOnly.acceptedEvidence), JSON.stringify(reviewedInput.acceptedEvidence), 'factor mode isolates accepted evidence');
    assertEqual(JSON.stringify(factorsOnly.monitoringRules), JSON.stringify(reviewedInput.monitoringRules), 'factor mode isolates monitoring rules');
    assertEqual(factorsOnly.reviewHistory.length, 0, 'factor mode does not append immutable history');
    const frozen = appendResearchReview(factorsOnly, '2026-07-02T00:00:00.000Z');
    const changedCurrent = {
        ...frozen,
        factorAssumptions: {
            version: 1 as const,
            migrationState: 'current' as const,
            assumptions: [{ ...valid.assumptions[0], direction: 'mixed' as const }],
        },
    };
    assertEqual(frozen.reviewHistory[0]?.factorAssumptions.assumptions[0]?.direction, 'harmed-when-rises', 'full review freezes factor assumptions');
    assertEqual(changedCurrent.reviewHistory[0]?.factorAssumptions.assumptions[0]?.direction, 'harmed-when-rises', 'later current edits do not mutate frozen assumptions');

    const persisted = buildPersistedResearchEvidenceBundle(
        acceptedEvidence,
        base.documentEvidence,
        valid,
    );
    assertEqual(persisted.version, 3, 'factor assumptions extend the existing evidence JSON bundle');
    assertEqual(splitPersistedResearchEvidence(persisted).factorAssumptions, persisted.factorAssumptions, 'persisted bundle splits factor assumptions');
    assertEqual(splitPersistedResearchEvidence({
        version: 2,
        acceptedEvidence,
        documentEvidence: base.documentEvidence,
    }).factorAssumptions, undefined, 'version-2 evidence bundle migrates without invented assumptions');

    const malformedRecord = parseResearchRecord({
        ...reviewedInput,
        factorAssumptions: { version: 1, assumptions: [{ factor: 'invented' }] },
        lastReviewedAt: '2026-07-01',
        updatedAt: '2026-07-01T00:00:00.000Z',
    });
    assertEqual(malformedRecord.factorAssumptions.migrationState, 'invalid-recovered', 'record parsing surfaces recoverable malformed factor state');
    const legacyRecord = parseResearchRecord({
        ...reviewedInput,
        factorAssumptions: undefined,
        lastReviewedAt: '2026-07-01',
        updatedAt: '2026-07-01T00:00:00.000Z',
    });
    assertEqual(legacyRecord.factorAssumptions.migrationState, 'migrated-empty', 'record parsing migrates a legacy missing factor set');

    const orcl = {
        ...createResearchRecord({ symbol: 'ORCL', market: 'US', companyName: 'Oracle' }),
        factorAssumptions: { version: 1 as const, migrationState: 'current' as const, assumptions: [] },
    };
    const maybank = {
        ...createResearchRecord({ symbol: '1155.KL', market: 'MY', companyName: 'Maybank' }),
        factorAssumptions: {
            version: 1 as const,
            migrationState: 'current' as const,
            assumptions: [{
                factor: 'interest-rates' as const,
                direction: 'benefits-when-rises' as const,
                materiality: 'moderate' as const,
                evidenceNote: '',
                evidenceDate: '2026-07-01',
                evidenceId: null,
            }],
        },
    };
    const holdingsSnapshot = parsePortfolioHoldingsSnapshot({
        version: 1,
        updatedAt: '2026-07-02T00:00:00.000Z',
        holdings: [
            { accountLabel: 'Account A', symbol: 'MSFT', market: 'US', quantity: 1, averageCost: 90, currency: 'USD', importedAt: '2026-07-02T00:00:00.000Z', provenanceLabel: 'QA' },
            { accountLabel: 'Account A', symbol: 'ORCL', market: 'US', quantity: 1, averageCost: 40, currency: 'USD', importedAt: '2026-07-02T00:00:00.000Z', provenanceLabel: 'QA' },
            { accountLabel: 'Account A', symbol: 'AMD', market: 'US', quantity: 1, averageCost: 70, currency: 'USD', importedAt: '2026-07-02T00:00:00.000Z', provenanceLabel: 'QA' },
            { accountLabel: 'Account B', symbol: 'MSFT', market: 'US', quantity: 2, averageCost: 90, currency: 'USD', importedAt: '2026-07-02T00:00:00.000Z', provenanceLabel: 'QA' },
            { accountLabel: 'Account A', symbol: '1155.KL', market: 'MY', quantity: 3, averageCost: 8, currency: 'MYR', importedAt: '2026-07-02T00:00:00.000Z', provenanceLabel: 'QA' },
        ],
        cashBalances: [],
    });
    const sourceBefore = JSON.stringify(holdingsSnapshot);
    const reconciled = reconcilePortfolioHoldings(
        holdingsSnapshot,
        [{ ...reviewedInput, factorAssumptions: valid }, orcl, maybank],
        new Map([
            ['US:MSFT', 100],
            ['US:ORCL', 50],
            ['US:AMD', 80],
            ['MY:1155.KL', 10],
        ]),
    );
    const exposure = buildPortfolioFactorExposure(reconciled);
    assertEqual(exposure.length, 3, 'factor exposure keeps account and currency groups separate');
    const accountUsd = exposure.find((group) => group.accountLabel === 'Account A' && group.currency === 'USD')!;
    const accountBUsd = exposure.find((group) => group.accountLabel === 'Account B' && group.currency === 'USD')!;
    const accountMyr = exposure.find((group) => group.accountLabel === 'Account A' && group.currency === 'MYR')!;
    const usdRates = accountUsd.aggregates.find((aggregate) => aggregate.factor === 'interest-rates')!;
    assertEqual(accountUsd.knownValue, 150, 'known-value denominator excludes missing unmatched price values');
    assertEqual(usdRates.harmedKnownValue, 100, 'factor numerator includes only explicitly harmed known value');
    assertEqual(usdRates.harmedSharePercent, 66.67, 'factor share uses the complete known account-currency denominator');
    assertEqual(usdRates.knownValueCoveragePercent, 66.67, 'factor value coverage stays separate from direction share');
    assertEqual(usdRates.holdingsWithAssumption, 1, 'factor count coverage counts declared holdings');
    assertEqual(usdRates.totalHoldings, 3, 'factor count denominator retains unmatched and undeclared holdings');
    assertEqual(accountUsd.missingPriceCount, 1, 'factor summary retains missing price count');
    assertEqual(accountUsd.unmatchedCount, 1, 'factor summary retains unmatched holdings');
    assertEqual(accountUsd.noAssumptionCount, 1, 'factor summary retains matched holdings with no assumptions');
    assertEqual(accountBUsd.knownValue, 200, 'a second account is never combined with the first');
    assertEqual(accountMyr.knownValue, 30, 'a different currency is never FX-converted or combined');
    assertEqual(accountMyr.aggregates[0]?.benefitsSharePercent, 100, 'explicit benefits direction aggregates independently');
    assertEqual(JSON.stringify(holdingsSnapshot), sourceBefore, 'factor aggregation does not mutate the holdings snapshot');
};

const runHistoricalValuationTests = () => {
    assertEqual(parseHistoricalValuationRequest(' msft ', 'US').symbol, 'MSFT', 'historical valuation request normalizes a bounded symbol');
    assertThrows(() => parseHistoricalValuationRequest('MSFT/private', 'US'), 'historical valuation request rejects an unsafe symbol');
    assertThrows(() => parseHistoricalValuationRequest('MSFT', 'GB'), 'historical valuation request rejects an unsupported market');
    const fact = (
        val: number,
        start: string,
        end: string,
        filed: string,
        form: '10-K' | '10-K/A',
        accn: string,
    ) => ({ val, start, end, filed, form, accn, fp: 'FY', fy: Number(end.slice(0, 4)), frame: `CY${end.slice(0, 4)}` });
    const original = {
        start: '2023-01-01', end: '2023-12-31', filed: '2024-02-15',
        form: '10-K' as const, accn: '0000789019-24-000001',
    };
    const amendment = {
        start: '2023-01-01', end: '2023-12-31', filed: '2024-03-01',
        form: '10-K/A' as const, accn: '0000789019-24-000002',
    };
    const lossYear = {
        start: '2024-01-01', end: '2024-12-31', filed: '2025-02-14',
        form: '10-K' as const, accn: '0000789019-25-000001',
    };
    const comparative = fact(800, '2022-01-01', '2022-12-31', original.filed, original.form, original.accn);
    const companyFacts = {
        facts: {
            'us-gaap': {
                RevenueFromContractWithCustomerExcludingAssessedTax: { units: { USD: [
                    comparative,
                    fact(1_000, original.start, original.end, original.filed, original.form, original.accn),
                    fact(1_000, original.start, original.end, original.filed, original.form, original.accn),
                    fact(1_100, amendment.start, amendment.end, amendment.filed, amendment.form, amendment.accn),
                    fact(1_200, lossYear.start, lossYear.end, lossYear.filed, lossYear.form, lossYear.accn),
                ] } },
                NetIncomeLoss: { units: { USD: [
                    fact(100, original.start, original.end, original.filed, original.form, original.accn),
                    fact(90, amendment.start, amendment.end, amendment.filed, amendment.form, amendment.accn),
                    fact(-20, lossYear.start, lossYear.end, lossYear.filed, lossYear.form, lossYear.accn),
                ] } },
                NetCashProvidedByUsedInOperatingActivities: { units: { USD: [
                    fact(150, original.start, original.end, original.filed, original.form, original.accn),
                    fact(155, amendment.start, amendment.end, amendment.filed, amendment.form, amendment.accn),
                    fact(50, lossYear.start, lossYear.end, lossYear.filed, lossYear.form, lossYear.accn),
                ] } },
                PaymentsToAcquirePropertyPlantAndEquipment: { units: { USD: [
                    fact(50, original.start, original.end, original.filed, original.form, original.accn),
                    fact(50, amendment.start, amendment.end, amendment.filed, amendment.form, amendment.accn),
                ] } },
                WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [
                    fact(50, original.start, original.end, original.filed, original.form, original.accn),
                    fact(50, amendment.start, amendment.end, amendment.filed, amendment.form, amendment.accn),
                    fact(48, lossYear.start, lossYear.end, lossYear.filed, lossYear.form, lossYear.accn),
                ] } },
            },
        },
    };
    const unix = (date: string) => Date.parse(`${date}T21:00:00.000Z`) / 1_000;
    const chart = {
        chart: {
            result: [{
                meta: { currency: 'USD' },
                timestamp: [
                    unix('2024-02-15'), unix('2024-02-16'),
                    unix('2024-03-01'), unix('2024-03-04'),
                    unix('2025-02-14'), unix('2025-02-18'),
                ],
                indicators: { quote: [{ close: [19, 20, 21, 22, 29, 30] }] },
                events: { splits: { split1: { date: unix('2024-06-01'), numerator: 2, denominator: 1, splitRatio: '2:1' } } },
            }],
        },
    };
    const report = buildHistoricalValuationReport({
        symbol: 'MSFT',
        market: 'US',
        cik: '0000789019',
        companyName: 'Microsoft Corp',
        companyFacts,
        chartPayload: chart,
        generatedAt: '2026-07-26T00:00:00.000Z',
    });
    assertEqual(report.observations.length, 3, 'historical valuation emits one current-period observation per annual accession');
    const originalObservation = report.observations.find((item) => item.accession === original.accn)!;
    const amendedObservation = report.observations.find((item) => item.accession === amendment.accn)!;
    const lossObservation = report.observations.find((item) => item.accession === lossYear.accn)!;
    assertEqual(originalObservation.priceDate, '2024-02-16', 'price selection is strictly after the filed date');
    assertEqual(originalObservation.price, 20, 'price selection uses the first next available close');
    assertEqual(originalObservation.splitAdjustmentFactor, 2, 'future stock splits are applied to filing-period diluted shares');
    assertEqual(originalObservation.splitAdjustedShares, 100, 'reported shares are aligned to the provider split-adjusted price basis');
    assertEqual(originalObservation.marketCapitalization, 2_000, 'historical market capitalization uses aligned price and share bases');
    assertEqual(originalObservation.priceEarnings.value, 20, 'historical P/E formula is deterministic');
    assertEqual(originalObservation.priceSales.value, 2, 'historical price-to-sales formula is deterministic');
    assertEqual(originalObservation.freeCashFlowYield.value, 5, 'historical FCF yield formula is deterministic');
    assertEqual(originalObservation.facts.length, 5, 'formula inputs retain exact accession provenance');
    assertEqual(originalObservation.facts.every((item) => item.accession === original.accn), true, 'facts never cross filing accessions');
    assertEqual(originalObservation.fiscalPeriodEnd, '2023-12-31', 'comparative prior-year rows in the filing do not replace the current fiscal year frame');
    assertEqual(amendedObservation.restatementStatus, 'amended-values-changed', 'changed amendment inputs are visibly classified');
    assertEqual(lossObservation.priceDate, '2025-02-18', 'next close selection handles a non-trading holiday window');
    assertEqual(lossObservation.priceEarnings.value, null, 'negative earnings never produce a P/E multiple');
    assertEqual(lossObservation.priceEarnings.unavailableReason?.includes('not positive'), true, 'negative denominator has a specific unavailable reason');
    assertEqual(lossObservation.freeCashFlowYield.value, null, 'missing capex omits FCF yield');
    assertEqual(lossObservation.freeCashFlowYield.unavailableReason?.includes('capital-expenditure'), true, 'missing capex has a specific unavailable reason');
    assertEqual(report.priceConvention, HISTORICAL_VALUATION_PRICE_CONVENTION, 'report freezes the explicit look-ahead-safe price convention');
    assertEqual(report.capabilities.periodCorrectFundamentals.status, 'partial', 'metric gaps surface partial provider coverage');
    assertEqual(report.capabilities.analystEstimateRevisions.status, 'unavailable', 'analyst revisions remain explicitly unavailable');
    assertEqual(report.capabilities.analystEstimateRevisions.detail.includes('not substitutes'), true, 'analyst revision unavailability rejects proxy substitution');
    assertEqual(report.sources[0]?.url, 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000789019.json', 'SEC source evidence links the exact CIK');
    assertEqual(parseHistoricalValuationResponse({ success: true, data: report }).observations.length, 3, 'client boundary accepts a valid bounded report');
    assertThrows(() => parseHistoricalValuationResponse({ success: true, data: { ...report, observations: Array(9).fill(originalObservation) } }), 'client boundary rejects oversized observation collections');

    const currencyMismatch = buildHistoricalValuationReport({
        symbol: 'MSFT', market: 'US', cik: '0000789019', companyName: 'Microsoft Corp',
        companyFacts, chartPayload: { chart: { result: [{ ...chart.chart.result[0], meta: { currency: 'EUR' } }] } },
    });
    assertEqual(currencyMismatch.observations[0]?.priceEarnings.value, null, 'currency mismatch omits valuation');
    assertEqual(currencyMismatch.observations[0]?.gaps[0]?.includes('does not match'), true, 'currency mismatch is explained');

    const unavailablePrices = buildHistoricalValuationReport({
        symbol: 'MSFT', market: 'US', cik: '0000789019', companyName: 'Microsoft Corp',
        companyFacts, chartPayload: null, priceError: 'Historical prices unavailable: fixture failure.',
    });
    assertEqual(unavailablePrices.capabilities.historicalPrices.status, 'unavailable', 'provider failure retains an unavailable price capability');
    assertEqual(unavailablePrices.observations.every((item) => item.priceEarnings.value === null), true, 'price failure never falls back to current prices');
    assertEqual(unavailablePrices.warnings[0], 'Historical prices unavailable: fixture failure.', 'provider failure evidence remains visible');

    const unsupportedSymbol = buildHistoricalValuationReport({
        symbol: 'ZZZZ', market: 'US', cik: null, companyName: null,
        companyFacts: null, chartPayload: chart, secError: 'SEC has no CIK mapping for ZZZZ.',
    });
    assertEqual(unsupportedSymbol.capabilities.historicalPrices.status, 'available', 'unsupported SEC symbol can retain independent price capability');
    assertEqual(unsupportedSymbol.capabilities.periodCorrectFundamentals.status, 'unavailable', 'unsupported SEC symbol has no filing valuation');
    assertEqual(unsupportedSymbol.warnings[0], 'SEC has no CIK mapping for ZZZZ.', 'unsupported symbol reason remains visible');

    const malaysia = buildHistoricalValuationReport({
        symbol: '1155', market: 'MY', cik: null, companyName: null, companyFacts: null, chartPayload: null,
    });
    assertEqual(malaysia.observations.length, 0, 'unsupported markets never manufacture observations');
    assertEqual(malaysia.capabilities.periodCorrectFundamentals.status, 'unavailable', 'unsupported market capability is explicit');

    const conflictingFacts = structuredClone(companyFacts);
    conflictingFacts.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD.push(
        fact(999, original.start, original.end, original.filed, original.form, original.accn),
    );
    const conflictReport = buildHistoricalValuationReport({
        symbol: 'MSFT', market: 'US', cik: '0000789019', companyName: 'Microsoft Corp',
        companyFacts: conflictingFacts, chartPayload: chart,
    });
    assertEqual(conflictReport.observations.length, 0, 'conflicting duplicate facts fail closed');
    assertEqual(conflictReport.warnings.some((warning) => warning.includes('conflicting duplicate')), true, 'conflicting duplicate fact reason remains visible');
    assertEqual(historicalValuationLimits.maxObservations, 8, 'historical valuation observation count is bounded');
    assertEqual(historicalValuationLimits.maxPriceRows, 4_000, 'historical price payload row count is bounded');
};

const runSignalCacheTests = async () => {
    type Fixture = { ok: boolean; sequence: number };
    let now = 1_000;
    let loadCount = 0;
    const cache = createSignalCache<Fixture>((value) => value.ok);
    const input = { market: 'US' as const, mode: 'standard' as const, enableSocial: true };
    const load = async () => ({ ok: true, sequence: ++loadCount });

    const first = await cache.get(input, load, { now: () => now });
    const second = await cache.get(input, load, { now: () => now });
    assertEqual(first.status, 'miss', 'signal cache records the first request as a miss');
    assertEqual(second.status, 'hit', 'signal cache reuses a fresh exact-key result');
    assertEqual(second.value.sequence, first.value.sequence, 'signal cache returns the cached value');
    assertEqual(loadCount, 1, 'signal cache loads an exact key only once within the TTL');

    await cache.get({ ...input, mode: 'contrarian' }, load, { now: () => now });
    assertEqual(loadCount, 2, 'signal cache isolates market configuration keys');

    const bypass = await cache.get(input, load, { forceRefresh: true, now: () => now });
    assertEqual(bypass.status, 'bypass', 'explicit refresh bypasses a fresh cache entry');
    assertEqual(loadCount, 3, 'explicit refresh invokes the loader');

    now += SIGNAL_CACHE_TTL_MS + 1;
    await cache.get(input, load, { now: () => now });
    assertEqual(loadCount, 4, 'expired signal entries are reloaded');

    cache.clear();
    let releasePending: ((value: Fixture) => void) | undefined;
    const pendingLoad = () => {
        loadCount += 1;
        return new Promise<Fixture>((resolve) => {
            releasePending = resolve;
        });
    };
    const pendingFirst = cache.get(input, pendingLoad, { now: () => now });
    const pendingSecond = cache.get(input, pendingLoad, { now: () => now });
    assertEqual(loadCount, 5, 'concurrent requests share one in-flight signal load');
    releasePending?.({ ok: true, sequence: loadCount });
    const [resolvedFirst, resolvedSecond] = await Promise.all([pendingFirst, pendingSecond]);
    assertEqual(resolvedFirst.status, 'miss', 'the in-flight owner records a miss');
    assertEqual(resolvedSecond.status, 'shared', 'the concurrent waiter records a shared load');

    cache.clear();
    let rejectedLoads = 0;
    const rejectOnce = async () => {
        rejectedLoads += 1;
        if (rejectedLoads === 1) throw new Error('fixture failure');
        return { ok: true, sequence: rejectedLoads };
    };
    try {
        await cache.get(input, rejectOnce, { now: () => now });
    } catch {
        // Expected: failed loads must not occupy the cache or in-flight map.
    }
    await cache.get(input, rejectOnce, { now: () => now });
    assertEqual(rejectedLoads, 2, 'failed signal loads can be retried');

    cache.clear();
    let uncacheableLoads = 0;
    const uncacheable = async () => ({ ok: false, sequence: ++uncacheableLoads });
    await cache.get(input, uncacheable, { now: () => now });
    await cache.get(input, uncacheable, { now: () => now });
    assertEqual(uncacheableLoads, 2, 'engine-level errors are not cached');
};

const main = async () => {
    runInputTests();
    runFirstRunSetupTests();
    await runResearchQuoteBatchTests();
    await runSignalCacheTests();
    await runPrimaryDocumentEvidenceTests();
    runOutcomeAnalyticsTests();
    runSinceLastVisitTests();
    runPortfolioAnalyticsTests();
    runPortfolioHoldingsImportTests();
    runPortfolioTransactionImportTests();
    runPortfolioTransactionReconciliationTests();
    runCoveredPortfolioAttributionTests();
    await runDividendCashFlowTests();
    runPortfolioSimulationTests();
    runPortfolioFactorExposureTests();
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
    runLocalResearchSearchTests();
    runEvidenceCoverageTests();
    runInvestmentPolicyTests();
    runResearchReadinessTests();
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
    runHistoricalValuationTests();
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
