import type { MarketSignal, SignalTier } from './types/signal-v2';

export type MarketSensitivityDriver = {
    readonly key: string;
    readonly name: string;
    readonly baseScore: number;
    readonly simulatedScore: number;
    readonly weight: number;
    readonly baseContribution: number;
    readonly simulatedContribution: number;
    readonly contributionDelta: number;
    readonly simulatedTier: SignalTier;
};

export type MarketSensitivityResult = {
    readonly baseScore: number;
    readonly simulatedScore: number;
    readonly scoreDelta: number;
    readonly baseTier: SignalTier;
    readonly simulatedTier: SignalTier;
    readonly neutralPoints: number;
    readonly weightRegime: 'base' | 'high-volatility-override';
    readonly conflicts: readonly string[];
    readonly drivers: readonly MarketSensitivityDriver[];
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 50));

export const tierForMarketScore = (
    score: number,
    mode: MarketSignal['mode'],
): SignalTier => {
    const contrarian = mode === 'contrarian';
    if (score >= 85) return contrarian ? 'strong-sell' : 'strong-buy';
    if (score >= 65) return contrarian ? 'sell' : 'buy';
    if (score >= 40) return 'neutral';
    if (score >= 20) return contrarian ? 'buy' : 'sell';
    return contrarian ? 'strong-buy' : 'strong-sell';
};

const tierDirection = (tier: SignalTier): 'positive' | 'neutral' | 'negative' => {
    if (tier === 'buy' || tier === 'strong-buy') return 'positive';
    if (tier === 'sell' || tier === 'strong-sell') return 'negative';
    return 'neutral';
};

export const simulateMarketScore = (
    signal: MarketSignal,
    overrides: Readonly<Record<string, number>>,
): MarketSensitivityResult => {
    const drivers = (signal.metadata.score_drivers ?? [])
        .filter((driver) => signal.components[driver.key]?.enabled === true)
        .map((driver): MarketSensitivityDriver => {
            const baseScore = clampScore(signal.components[driver.key]?.score ?? driver.score);
            const simulatedScore = clampScore(overrides[driver.key] ?? baseScore);
            const baseContribution = baseScore * driver.weight;
            const simulatedContribution = simulatedScore * driver.weight;
            return {
                key: driver.key,
                name: driver.name,
                baseScore,
                simulatedScore,
                weight: driver.weight,
                baseContribution,
                simulatedContribution,
                contributionDelta: simulatedContribution - baseContribution,
                simulatedTier: tierForMarketScore(simulatedScore, signal.mode),
            };
        });
    const activeWeight = drivers.reduce((sum, driver) => sum + driver.weight, 0);
    const neutralBaseline = signal.metadata.coverage_adjustment?.neutral_baseline ?? 50;
    const neutralPoints = signal.metadata.coverage_adjustment?.neutral_points
        ?? Math.max(0, 1 - activeWeight) * neutralBaseline;
    const simulatedRaw = drivers.reduce((sum, driver) => sum + driver.simulatedContribution, neutralPoints);
    const simulatedScore = Math.max(0, Math.min(100, Math.round(simulatedRaw)));
    const simulatedTier = tierForMarketScore(simulatedScore, signal.mode);
    return {
        baseScore: signal.composite_score,
        simulatedScore,
        scoreDelta: simulatedScore - signal.composite_score,
        baseTier: signal.tier,
        simulatedTier,
        neutralPoints,
        weightRegime: signal.metadata.market === 'US' && (signal.components.vix?.value ?? 0) > 30
            ? 'high-volatility-override'
            : 'base',
        conflicts: drivers.filter((driver) => tierDirection(driver.simulatedTier) !== tierDirection(simulatedTier)).map((driver) => driver.name),
        drivers,
    };
};
