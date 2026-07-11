import { getResearchAction } from '../../src/lib/research/decision';
import { parseResearchCreateInput, parseResearchRecord, parseResearchUpdateInput } from '../../src/lib/research/input';
import { applyResearchUpdate, createResearchRecord } from '../../src/lib/research/records';
import { calculateTechnicals } from '../../src/lib/research/technicals';
import { parseYahooResearchChart, toYahooSymbol } from '../../src/lib/research/yahoo-research';
import { calculateValuation } from '../../src/lib/research/valuation';
import { scoreDiscoveryCandidate } from '../../src/lib/research/discovery-score';
import { evaluateResearchAlerts, parseBuyZone } from '../../src/lib/research/alerts';
import { scoreDiscoveryQuality } from '../../src/lib/research/discovery-quality';
import { parseSecCompanyFacts } from '../../src/lib/research/sec-edgar';
import { calculateCohortPerformance, calculateHistorySignals } from '../../src/lib/research/discovery-history';
import { sectorRelativeStrength } from '../../src/lib/research/discovery-sectors';
import { classifyEarlyTrend, classifyValuation } from '../../src/lib/research/discovery-opportunity';

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
    assertThrows(() => parseResearchUpdateInput({ thesisStrength: 'excellent' }), 'update rejects unknown thesis strength');

    const merged = applyResearchUpdate(createResearchRecord(created), parseResearchUpdateInput({}));
    const record = parseResearchRecord({ ...merged, lastReviewedAt: '2026-07-11' });
    assertEqual(record.companyName, 'Microsoft', 'record parser preserves required identity');
    assertEqual(record.notes, '', 'record parser preserves defaults for omitted optional fields');
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
        indicators: { quote: [{ close: [99, 100, 101], volume: [10, 20, 30] }] },
    }] } });
    assertEqual(chart.dailyChangePercent, 1, 'daily change uses the prior session, not the range baseline');
    assertEqual(toYahooSymbol('1155', 'MY'), '1155.KL', 'Malaysia ticker uses Yahoo KL suffix');
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

runInputTests();
runDecisionTests();
runTechnicalTests();
runValuationTests();
runDiscoveryTests();
runAlertTests();
runDiscoveryQualityTests();
runSecCompanyFactsTests();
runDiscoveryHistoryTests();
runDiscoveryOpportunityTests();
console.log('Research regression tests passed.');
