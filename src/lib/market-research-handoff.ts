import type { MarketSignal, SignalTier } from './types/signal-v2';

export type MarketResearchHandoff = {
    readonly market: 'US' | 'MY';
    readonly mode: 'standard' | 'contrarian';
    readonly score: number;
    readonly tier: SignalTier;
    readonly freshness: 'fresh' | 'mixed' | 'stale' | 'unavailable';
    readonly coverage: 'strong' | 'moderate' | 'limited' | 'unavailable';
    readonly conflicts: readonly string[];
    readonly snapshotAt: string | null;
};

type SearchParamsReader = Pick<URLSearchParams, 'get' | 'getAll'>;

const tiers: readonly SignalTier[] = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
const freshnessValues = ['fresh', 'mixed', 'stale', 'unavailable'] as const;
const coverageValues = ['strong', 'moderate', 'limited', 'unavailable'] as const;

const isOneOf = <T extends string>(value: string | null, options: readonly T[]): value is T =>
    value !== null && options.includes(value as T);

const safeSnapshot = (value: string | null) => {
    if (!value) return null;
    return Number.isNaN(new Date(value).getTime()) ? null : value;
};

export const createMarketResearchHandoff = (signal: MarketSignal): MarketResearchHandoff => ({
    market: signal.metadata.market,
    mode: signal.mode,
    score: Math.round(signal.composite_score),
    tier: signal.tier,
    freshness: signal.metadata.signal_quality?.freshness ?? 'unavailable',
    coverage: signal.metadata.signal_quality?.source_coverage ?? 'unavailable',
    conflicts: signal.confidence.conflicting_indicators.slice(0, 3),
    snapshotAt: signal.metadata.score_delta?.snapshot_date ?? null,
});

export const buildResearchHandoffHref = (handoff: MarketResearchHandoff) => {
    const params = new URLSearchParams({
        workspace: 'research',
        contextMarket: handoff.market,
        contextMode: handoff.mode,
        contextScore: String(handoff.score),
        contextTier: handoff.tier,
        contextFreshness: handoff.freshness,
        contextCoverage: handoff.coverage,
    });
    handoff.conflicts.forEach((conflict) => params.append('contextConflict', conflict));
    if (handoff.snapshotAt) params.set('contextAt', handoff.snapshotAt);
    return '/research?' + params.toString();
};

export const parseMarketResearchHandoff = (params: SearchParamsReader): MarketResearchHandoff | null => {
    const market = params.get('contextMarket');
    const mode = params.get('contextMode');
    const score = Number(params.get('contextScore'));
    const tier = params.get('contextTier');
    const freshness = params.get('contextFreshness');
    const coverage = params.get('contextCoverage');

    if ((market !== 'US' && market !== 'MY')
        || (mode !== 'standard' && mode !== 'contrarian')
        || !Number.isFinite(score) || score < 0 || score > 100
        || !isOneOf(tier, tiers)
        || !isOneOf(freshness, freshnessValues)
        || !isOneOf(coverage, coverageValues)) return null;

    return {
        market,
        mode,
        score: Math.round(score),
        tier,
        freshness,
        coverage,
        conflicts: params.getAll('contextConflict').map((value) => value.trim()).filter(Boolean).map((value) => value.slice(0, 120)).slice(0, 3),
        snapshotAt: safeSnapshot(params.get('contextAt')),
    };
};

export const getMarketResearchEmphasis = (handoff: MarketResearchHandoff) => {
    const snapshotAge = handoff.snapshotAt ? Date.now() - new Date(handoff.snapshotAt).getTime() : null;
    if (snapshotAge === null || snapshotAge < -5 * 60_000 || snapshotAge > 7 * 86_400_000
        || handoff.freshness === 'stale' || handoff.freshness === 'unavailable'
        || handoff.coverage === 'limited' || handoff.coverage === 'unavailable') {
        return 'Treat the market read as provisional and prioritize evidence freshness before changing a security decision.';
    }
    if (handoff.tier === 'sell' || handoff.tier === 'strong-sell') {
        return handoff.mode === 'contrarian'
            ? 'Review downside cases and invalidation levels while testing whether fear is broad enough to support a contrarian thesis.'
            : 'Review downside cases, owned positions, and invalidation levels before adding exposure.';
    }
    if (handoff.tier === 'buy' || handoff.tier === 'strong-buy') {
        return handoff.mode === 'contrarian'
            ? 'Review valuation and crowding risk; strong positive conditions can reduce the contrarian margin of safety.'
            : 'Review ready names, but keep valuation, buy-zone, and thesis-invalidation gates independent.';
    }
    return 'Prioritize incomplete or stale research while keeping each security decision independent from the mixed market read.';
};
