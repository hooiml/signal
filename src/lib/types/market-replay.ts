import type { SignalTier } from './signal-v2';

export type MarketReplayOrigin = 'observed' | 'reconstructed';

export type MarketReplaySummary = {
    readonly date: string;
    readonly score: number;
    readonly tier: SignalTier;
    readonly origin: MarketReplayOrigin;
    readonly coverageNote: string | null;
    readonly hasFullEvidence: boolean;
    readonly updatedAt: string;
};

export type MarketReplayComponent = {
    readonly key: string;
    readonly displayName: string;
    readonly rawValue: number | null;
    readonly score: number | null;
    readonly weight: number | null;
    readonly signal: string | null;
    readonly lastUpdated: string | null;
};

export type MarketReplaySnapshot = {
    readonly summary: MarketReplaySummary;
    readonly confidenceLevel: string;
    readonly agreementPercent: number;
    readonly majoritySignal: string;
    readonly components: readonly MarketReplayComponent[];
    readonly scoreDrivers: readonly Record<string, unknown>[];
    readonly indexTrend: readonly Record<string, unknown>[];
    readonly signalQuality: Readonly<Record<string, unknown>>;
    readonly interpretationContext: Readonly<Record<string, unknown>>;
    readonly metadata: Readonly<Record<string, unknown>>;
};

export type MarketReplayIndex = {
    readonly market: 'US' | 'MY';
    readonly mode: 'standard' | 'contrarian';
    readonly enableSocial: boolean;
    readonly summaries: readonly MarketReplaySummary[];
};

export type MarketReplayComparison = {
    readonly scoreDelta: number;
    readonly agreementDelta: number;
    readonly tierChanged: boolean;
    readonly changedComponents: number;
};

const tiers: readonly SignalTier[] = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isRecordArray = (value: unknown): value is readonly Record<string, unknown>[] =>
    Array.isArray(value) && value.every(isRecord);

const parseSummary = (value: unknown): MarketReplaySummary => {
    if (!isRecord(value)
        || typeof value.date !== 'string'
        || typeof value.score !== 'number' || !Number.isFinite(value.score)
        || typeof value.tier !== 'string' || !tiers.includes(value.tier as SignalTier)
        || (value.origin !== 'observed' && value.origin !== 'reconstructed')
        || (value.coverageNote !== null && typeof value.coverageNote !== 'string')
        || typeof value.hasFullEvidence !== 'boolean'
        || typeof value.updatedAt !== 'string') {
        throw new Error('Invalid replay summary.');
    }
    return {
        date: value.date,
        score: value.score,
        tier: value.tier as SignalTier,
        origin: value.origin,
        coverageNote: value.coverageNote,
        hasFullEvidence: value.hasFullEvidence,
        updatedAt: value.updatedAt,
    };
};

const parseComponent = (value: unknown): MarketReplayComponent => {
    if (!isRecord(value)
        || typeof value.key !== 'string'
        || typeof value.displayName !== 'string'
        || (value.rawValue !== null && (typeof value.rawValue !== 'number' || !Number.isFinite(value.rawValue)))
        || (value.score !== null && (typeof value.score !== 'number' || !Number.isFinite(value.score)))
        || (value.weight !== null && (typeof value.weight !== 'number' || !Number.isFinite(value.weight)))
        || (value.signal !== null && typeof value.signal !== 'string')
        || (value.lastUpdated !== null && typeof value.lastUpdated !== 'string')) {
        throw new Error('Invalid replay component.');
    }
    return {
        key: value.key,
        displayName: value.displayName,
        rawValue: value.rawValue,
        score: value.score,
        weight: value.weight,
        signal: value.signal,
        lastUpdated: value.lastUpdated,
    };
};

export const parseMarketReplayIndex = (payload: unknown): MarketReplayIndex => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
        || (payload.data.market !== 'US' && payload.data.market !== 'MY')
        || (payload.data.mode !== 'standard' && payload.data.mode !== 'contrarian')
        || typeof payload.data.enableSocial !== 'boolean'
        || !Array.isArray(payload.data.summaries)) {
        throw new Error('Invalid replay index.');
    }
    return {
        market: payload.data.market,
        mode: payload.data.mode,
        enableSocial: payload.data.enableSocial,
        summaries: payload.data.summaries.map(parseSummary),
    };
};

export const parseMarketReplaySnapshot = (payload: unknown): MarketReplaySnapshot => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
        || typeof payload.data.confidenceLevel !== 'string'
        || typeof payload.data.agreementPercent !== 'number' || !Number.isFinite(payload.data.agreementPercent)
        || typeof payload.data.majoritySignal !== 'string'
        || !Array.isArray(payload.data.components)
        || !isRecordArray(payload.data.scoreDrivers)
        || !isRecordArray(payload.data.indexTrend)
        || !isRecord(payload.data.signalQuality)
        || !isRecord(payload.data.interpretationContext)
        || !isRecord(payload.data.metadata)) {
        throw new Error('Invalid replay snapshot.');
    }
    return {
        summary: parseSummary(payload.data.summary),
        confidenceLevel: payload.data.confidenceLevel,
        agreementPercent: payload.data.agreementPercent,
        majoritySignal: payload.data.majoritySignal,
        components: payload.data.components.map(parseComponent),
        scoreDrivers: payload.data.scoreDrivers,
        indexTrend: payload.data.indexTrend,
        signalQuality: payload.data.signalQuality,
        interpretationContext: payload.data.interpretationContext,
        metadata: payload.data.metadata,
    };
};

export const compareMarketReplaySnapshots = (
    primary: MarketReplaySnapshot,
    comparison: MarketReplaySnapshot,
): MarketReplayComparison => {
    const comparisonComponents = new Map(comparison.components.map((component) => [component.key, component]));
    const changedComponents = primary.components.filter((component) => {
        const previous = comparisonComponents.get(component.key);
        return !previous || previous.score !== component.score || previous.weight !== component.weight || previous.rawValue !== component.rawValue;
    }).length;
    return {
        scoreDelta: Number((primary.summary.score - comparison.summary.score).toFixed(2)),
        agreementDelta: Number((primary.agreementPercent - comparison.agreementPercent).toFixed(2)),
        tierChanged: primary.summary.tier !== comparison.summary.tier,
        changedComponents,
    };
};
