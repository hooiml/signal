import type { DiscoveryCandidate, DiscoveryCatalyst, DiscoveryResponse, DiscoveryResult, QualityDiscoveryResult } from '../types/research-discovery';
import { scoreDiscoveryQuality } from './discovery-quality';
import { scoreDiscoveryCandidate } from './discovery-score';
import { calculateCohortPerformance, calculateHistorySignals, snapshotForPeriod } from './discovery-history';
import { sectorForSymbol, sectorRelativeStrength } from './discovery-sectors';
import { listDiscoverySnapshots, saveDiscoverySnapshot } from './discovery-store';
import { classifyEarlyTrend, classifyValuation } from './discovery-opportunity';
import { calculateValuation } from './valuation';
import { fetchUpcomingCatalysts } from './catalysts';
import { discoveryUniverse } from './discovery-universe';
import { fetchSecFundamentals } from './sec-edgar';
import { fetchYahooResearch, type YahooResearchResult } from './yahoo-research';

const percentChange = (current: number, prior: number | undefined): number =>
    prior === undefined || prior === 0 ? 0 : Number((((current - prior) / prior) * 100).toFixed(1));

const annualizedVolatility = (closes: readonly number[]): number => {
    const returns = closes.slice(-61).slice(1).map((close, index) => {
        const prior = closes.slice(-61)[index];
        return prior === undefined || prior === 0 ? 0 : (close - prior) / prior;
    });
    if (returns.length === 0) return 0;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
    return Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(1));
};

const toCandidate = (symbol: string, data: YahooResearchResult): DiscoveryCandidate | null => {
    const closes = data.history.closes;
    const volumes = data.history.volumes;
    const price = data.price ?? closes.at(-1);
    if (price === undefined || closes.length < 126 || data.technicals.ma50 === null || data.technicals.ma200 === null) return null;
    const averageVolume = data.technicals.averageVolume20 ?? 0;
    const peakRecentVolume = Math.max(...volumes.slice(-20), averageVolume);
    const dailyMoves = closes.slice(-61).slice(1).map((close, index) => Math.abs(percentChange(close, closes.slice(-61)[index])));
    return {
        symbol,
        name: data.name ?? symbol,
        price,
        momentum3MonthPercent: percentChange(price, closes.at(-64)),
        momentum6MonthPercent: percentChange(price, closes.at(-127)),
        distanceFromMa50Percent: percentChange(price, data.technicals.ma50),
        averageDollarVolume: Math.round(averageVolume * price),
        volumeSpikeRatio: averageVolume === 0 ? 0 : Number((peakRecentVolume / averageVolume).toFixed(1)),
        maxDailyMovePercent: Number(Math.max(...dailyMoves, 0).toFixed(1)),
        annualizedVolatilityPercent: annualizedVolatility(closes),
        aboveMa50: price > data.technicals.ma50,
        aboveMa200: price > data.technicals.ma200,
    };
};

const scanBatch = async (symbols: readonly string[]): Promise<readonly (DiscoveryResult | null)[]> =>
    Promise.all(symbols.map(async (symbol) => {
        try {
            const data = await fetchYahooResearch(symbol, 'US');
            const candidate = toCandidate(symbol, data);
            return candidate ? scoreDiscoveryCandidate(candidate) : null;
        } catch (error) {
            if (error instanceof Error) return null;
            throw error;
        }
    }));

type EnrichedCandidate = DiscoveryResult & Pick<QualityDiscoveryResult,
    'qualityScore' | 'discoveryScore' | 'category' | 'qualityReasons' | 'sector' | 'sectorRelativeStrengthPercent' | 'earlyTrendStage' | 'valuation'>;

const enrichCandidate = async (candidate: DiscoveryResult, scanned: readonly DiscoveryResult[]): Promise<EnrichedCandidate> => {
    const sector = sectorForSymbol(candidate.symbol);
    const sectorRelativeStrengthPercent = sectorRelativeStrength(candidate.symbol, candidate.momentum3MonthPercent, scanned);
    try {
        const fundamentals = await fetchSecFundamentals(candidate.symbol);
        const quality = scoreDiscoveryQuality({
            revenueGrowthPercent: fundamentals.revenueGrowthPercent,
            grossMarginPercent: fundamentals.grossMarginPercent,
            operatingMarginPercent: fundamentals.operatingMarginPercent,
            freeCashFlow: fundamentals.freeCashFlow,
            debt: fundamentals.debt,
            cash: fundamentals.cash,
            shareChangePercent: fundamentals.shareChangePercent,
        }, candidate.trendScore);
        const valuation = calculateValuation({
            price: candidate.price,
            shares: fundamentals.shares,
            annualRevenue: fundamentals.annualRevenue,
            annualNetIncome: fundamentals.annualNetIncome,
            freeCashFlow: fundamentals.freeCashFlow,
            debt: fundamentals.debt,
            cash: fundamentals.cash,
        });
        return {
            ...candidate,
            qualityScore: quality.score,
            discoveryScore: Math.round(candidate.trendScore * 0.65 + quality.score * 0.35),
            category: quality.category,
            qualityReasons: quality.reasons,
            sector,
            sectorRelativeStrengthPercent,
            earlyTrendStage: classifyEarlyTrend(candidate),
            valuation: {
                guardrail: classifyValuation(valuation),
                priceEarnings: valuation.priceEarnings,
                priceSales: valuation.priceSales,
                freeCashFlowYieldPercent: valuation.freeCashFlowYieldPercent,
            },
        };
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        return {
            ...candidate,
            qualityScore: null,
            discoveryScore: Math.round(candidate.trendScore * 0.65),
            category: 'unconfirmed',
            qualityReasons: [],
            sector,
            sectorRelativeStrengthPercent,
            earlyTrendStage: classifyEarlyTrend(candidate),
            valuation: { guardrail: 'unavailable', priceEarnings: null, priceSales: null, freeCashFlowYieldPercent: null },
        };
    }
};

export const getTrendDiscovery = async (): Promise<DiscoveryResponse> => {
    const results: (DiscoveryResult | null)[] = [];
    for (let index = 0; index < discoveryUniverse.length; index += 6) {
        results.push(...await scanBatch(discoveryUniverse.slice(index, index + 6)));
    }
    const scanned = results.filter((result): result is DiscoveryResult => result !== null);
    const shortlist = scanned
        .filter((candidate) => candidate.price >= 5 && candidate.averageDollarVolume >= 20_000_000 && candidate.risk !== 'high')
        .sort((left, right) => right.trendScore - left.trendScore)
        .slice(0, 15);
    const earlyShortlist = scanned
        .filter((candidate) => {
            const stage = classifyEarlyTrend(candidate);
            return stage === 'emerging' || stage === 'confirmed';
        })
        .sort((left, right) => right.trendScore - left.trendScore)
        .slice(0, 8);
    const enrichmentPool = [...shortlist, ...earlyShortlist.filter((candidate) => !shortlist.some((leader) => leader.symbol === candidate.symbol))];
    const enriched: EnrichedCandidate[] = [];
    for (let index = 0; index < enrichmentPool.length; index += 3) {
        enriched.push(...await Promise.all(enrichmentPool.slice(index, index + 3).map((candidate) => enrichCandidate(candidate, scanned))));
    }
    const leaderSymbols = new Set(shortlist.map((candidate) => candidate.symbol));
    const ranked = enriched
        .filter((candidate) => leaderSymbols.has(candidate.symbol) && candidate.category !== 'fundamentally unsupported')
        .sort((left, right) => right.discoveryScore - left.discoveryScore)
        .slice(0, 10);
    const generatedAt = new Date().toISOString();
    let historyWarning: string | null = null;
    let history = await listDiscoverySnapshots().catch((error): readonly [] => {
        if (!(error instanceof Error)) throw error;
        historyWarning = 'Discovery history storage is unavailable; current rankings are still live.';
        return [];
    });
    const catalystSymbols = [...new Set([...ranked, ...earlyShortlist].map((candidate) => candidate.symbol))];
    let catalysts: ReadonlyMap<string, DiscoveryCatalyst> = new Map<string, DiscoveryCatalyst>();
    let catalystWarning: string | null = null;
    try {
        catalysts = new Map(await fetchUpcomingCatalysts(catalystSymbols));
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        catalystWarning = 'Upcoming earnings coverage is temporarily unavailable.';
    }
    const candidates: QualityDiscoveryResult[] = ranked.map((candidate, index) => ({
        ...candidate,
        ...calculateHistorySignals(candidate.symbol, candidate.discoveryScore, index + 1, generatedAt, history),
        catalyst: catalysts.get(candidate.symbol) ?? null,
    }));
    const emergingCandidates: QualityDiscoveryResult[] = enriched
        .filter((candidate) => (candidate.earlyTrendStage === 'emerging' || candidate.earlyTrendStage === 'confirmed')
            && candidate.category !== 'fundamentally unsupported')
        .sort((left, right) => (left.earlyTrendStage === 'emerging' ? 0 : 1) - (right.earlyTrendStage === 'emerging' ? 0 : 1)
            || right.discoveryScore - left.discoveryScore)
        .slice(0, 8)
        .map((candidate, index) => ({
            ...candidate,
            ...calculateHistorySignals(candidate.symbol, candidate.discoveryScore, index + 1, generatedAt, history),
            catalyst: catalysts.get(candidate.symbol) ?? null,
        }));
    const currentPrices = new Map(scanned.map((candidate) => [candidate.symbol, candidate.price]));
    const performance = [
        calculateCohortPerformance('1D', snapshotForPeriod(generatedAt, 1, history), currentPrices),
        calculateCohortPerformance('1W', snapshotForPeriod(generatedAt, 7, history), currentPrices),
        calculateCohortPerformance('1M', snapshotForPeriod(generatedAt, 30, history), currentPrices),
    ];
    try {
        await saveDiscoverySnapshot(generatedAt, candidates);
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        historyWarning = 'Discovery history storage is unavailable; current rankings are still live.';
        history = [];
    }
    const unconfirmedCount = enriched.filter((candidate) => candidate.category === 'unconfirmed').length;
    return {
        generatedAt,
        universeSize: discoveryUniverse.length,
        scannedCount: scanned.length,
        candidates,
        emergingCandidates,
        performance,
        historySnapshotCount: history.length,
        warnings: [
            scanned.length < discoveryUniverse.length ? `${discoveryUniverse.length - scanned.length} symbols were unavailable and excluded.` : null,
            unconfirmedCount > 0 ? `${unconfirmedCount} shortlisted symbols could not be confirmed with SEC fundamentals.` : null,
            historyWarning,
            catalystWarning,
        ].filter((warning): warning is string => warning !== null),
    };
};
