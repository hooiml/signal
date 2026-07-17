import { getResearchAction } from '../../src/lib/research/decision';
import { parseResearchCreateInput, parseResearchRecord, parseResearchUpdateInput, parseResearchUpdateMode } from '../../src/lib/research/input';
import { appendQuickReviewNote, appendResearchReview, applyResearchUpdate, createResearchRecord, describeReviewChanges, latestReviewChanges } from '../../src/lib/research/records';
import { defaultResearchMonitoringRules } from '../../src/lib/types/research';
import { calculateTechnicals } from '../../src/lib/research/technicals';
import { buildTechnicalOutlook } from '../../src/lib/research/technical-outlook';
import { calculateTechnicalSeries } from '../../src/lib/research/technical-series';
import { anchoredVwap, relativeStrengthSeries, volumeProfile } from '../../src/lib/research/chart-analysis';
import { parseYahooResearchChart, toYahooSymbol } from '../../src/lib/research/yahoo-research';
import { calculateValuation } from '../../src/lib/research/valuation';
import { scoreDiscoveryCandidate } from '../../src/lib/research/discovery-score';
import { evaluateResearchAlerts, parseBuyZone } from '../../src/lib/research/alerts';
import { evaluateMarketAlert, getMarketAlertRulesForBriefing, parseMarketAlertRules, type MarketAlertRule } from '../../src/lib/market-alerts';
import { scoreDiscoveryQuality } from '../../src/lib/research/discovery-quality';
import { parseSecCompanyFacts } from '../../src/lib/research/sec-edgar';
import { calculateCohortPerformance, calculateHistorySignals } from '../../src/lib/research/discovery-history';
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
    assertThrows(() => parseResearchUpdateInput({ thesisStrength: 'excellent' }), 'update rejects unknown thesis strength');
    assertEqual(Object.hasOwn(parseResearchUpdateInput({ reviewHistory: [{ id: 'forged' }] }), 'reviewHistory'), false, 'update ignores client-supplied review history');

    const merged = applyResearchUpdate(createResearchRecord(created), parseResearchUpdateInput({}));
    const record = parseResearchRecord({ ...merged, lastReviewedAt: '2026-07-11' });
    assertEqual(record.companyName, 'Microsoft', 'record parser preserves required identity');
    assertEqual(record.notes, '', 'record parser preserves defaults for omitted optional fields');
    assertEqual(record.acceptedEvidence.length, 0, 'record parser defaults persisted evidence for legacy records');
    assertEqual(record.reviewHistory.length, 0, 'record parser defaults review history for legacy records');
    assertEqual(record.monitoringRules.reviewAgeDays, 30, 'record parser defaults legacy monitoring rules');
    assertEqual(parseResearchUpdateInput({ monitoringRules: { rsiAbove: null } }).monitoringRules?.rsiAbove, null, 'explicitly disabled monitoring rules stay disabled');

    const acceptedEvidence = [{
        id: 'MSFT-bullCase-growth', title: 'Revenue growth', summary: 'Revenue grew 14%.',
        target: 'bullCase', tone: 'positive', mode: 'evidence', acceptedAt: '2026-07-14T10:00:00.000Z',
        sources: [{ id: 'revenue-growth', label: 'Revenue growth', value: '14%', source: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar', reportingPeriod: '2025-06-30' }],
    }] as const;
    const evidenceUpdate = parseResearchUpdateInput({ acceptedEvidence });
    assertEqual(evidenceUpdate.acceptedEvidence?.[0]?.sources[0]?.source, 'SEC EDGAR', 'update parser preserves accepted source provenance');
    assertThrows(() => parseResearchUpdateInput({ acceptedEvidence: [{ ...acceptedEvidence[0], sources: [{ ...acceptedEvidence[0].sources[0], sourceUrl: 'javascript:alert(1)' }] }] }), 'update rejects unsafe evidence links');

    const firstReview = appendResearchReview(applyResearchUpdate(record, evidenceUpdate), '2026-07-14T10:30:00.000Z');
    assertEqual(firstReview.reviewHistory.length, 1, 'saved review appends a history snapshot');
    assertEqual(firstReview.reviewHistory[0]?.acceptedEvidence[0]?.sources[0]?.source, 'SEC EDGAR', 'review snapshot freezes source provenance');
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

const runInboxTests = () => {
    const inputs = [
        { symbol: 'MSFT', market: 'US' as const, targetBuyZone: '$390 - $405', lastReviewedAt: '2026-05-10', monitoringRules: defaultResearchMonitoringRules },
        { symbol: '1155', market: 'MY' as const, targetBuyZone: 'RM 110 - RM 115', lastReviewedAt: '2026-07-10', monitoringRules: { ...defaultResearchMonitoringRules, rsiBelow: 40 } },
    ];
    const evaluations = [
        { input: inputs[0], state: { price: 380, dailyChangePercent: -2, ma50: 400, ma200: 400, rsi14: 42 }, failed: false, alerts: [
            { symbol: 'MSFT', severity: 'risk' as const, title: 'Below 200-day average', detail: 'Long-term trend weakness needs review.' },
        ] },
        { input: inputs[1], state: { price: 116, dailyChangePercent: 1, ma50: 120, ma200: 100, rsi14: 35 }, failed: false, alerts: [] },
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
            reportingPeriod: '2025-06-30', shareChangePercent: -0.8,
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
    assertEqual(buildTechnicalOutlook(snapshot).overall.label, 'Constructive', 'technical outlook requires aligned positive evidence');
    const response = { success: true, data: snapshot };
    assertEqual(parseResearchSnapshotResponse(response).symbol, 'MSFT', 'snapshot boundary accepts complete comparison data');
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
            reportingPeriod: '2025-06-30', shareChangePercent: 2.2,
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

runInputTests();
runDecisionTests();
runTechnicalTests();
runBenchmarkTests();
runValuationTests();
runDiscoveryTests();
runAlertTests();
runInboxTests();
runMarketAlertTests();
runDiscoveryQualityTests();
runSecCompanyFactsTests();
runDiscoveryHistoryTests();
runDiscoveryOpportunityTests();
runDiscoveryRankingTests();
runDiscoveryFilterTests();
runInstitutionalOwnershipTests();
runComparisonTests();
runResearchAssistantTests();
console.log('Research regression tests passed.');
