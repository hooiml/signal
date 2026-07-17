import type { MarketSignal, SignalTier } from './types/signal-v2';

export type CalibrationSnapshot = {
    readonly date: string;
    readonly score: number;
    readonly tier: SignalTier;
};

export type CalibrationPrice = { readonly date: string; readonly close: number };

type CalibrationResult = NonNullable<MarketSignal['metadata']['historical_validation']>;

const zones = [
    { id: 'negative' as const, label: '0–39', matches: (score: number) => score <= 39 },
    { id: 'mixed' as const, label: '40–64', matches: (score: number) => score >= 40 && score <= 64 },
    { id: 'positive' as const, label: '65–84', matches: (score: number) => score >= 65 && score <= 84 },
    { id: 'strong-positive' as const, label: '85–100', matches: (score: number) => score >= 85 },
];

const returnPercent = (start: number, end: number) => Number((((end - start) / start) * 100).toFixed(2));

const expectedDirection = (tier: SignalTier): -1 | 0 | 1 =>
    tier === 'buy' || tier === 'strong-buy' ? 1 : tier === 'sell' || tier === 'strong-sell' ? -1 : 0;

export const calculateMarketCalibration = (input: {
    readonly snapshots: readonly CalibrationSnapshot[];
    readonly prices: readonly CalibrationPrice[];
    readonly mode: 'standard' | 'contrarian';
    readonly benchmarkSymbol: string;
    readonly benchmarkName: string;
}): CalibrationResult => {
    const sortedPrices = [...input.prices].filter((point) => point.close > 0).sort((left, right) => left.date.localeCompare(right.date));
    const observations = input.snapshots.flatMap((snapshot) => {
        const start = sortedPrices.find((point) => point.date >= snapshot.date);
        if (!start) return [];
        const startTime = new Date(`${start.date}T00:00:00Z`).getTime();
        const outcome = (days: 7 | 30) => sortedPrices.find((point) => new Date(`${point.date}T00:00:00Z`).getTime() >= startTime + days * 86_400_000);
        return [{ snapshot, returns: { 7: outcome(7) ? returnPercent(start.close, outcome(7)!.close) : null, 30: outcome(30) ? returnPercent(start.close, outcome(30)!.close) : null } }];
    });
    return {
        benchmark_symbol: input.benchmarkSymbol,
        benchmark_name: input.benchmarkName,
        mode: input.mode,
        snapshot_count: input.snapshots.length,
        minimum_sample_size: 5,
        horizons: ([7, 30] as const).map((days) => ({
            days,
            cohorts: zones.map((zone) => {
                const cohort = observations.filter(({ snapshot, returns }) => zone.matches(snapshot.score) && returns[days] !== null);
                const returns = cohort.map((item) => item.returns[days]!);
                const directional = cohort.filter(({ snapshot }) => expectedDirection(snapshot.tier) !== 0);
                const aligned = directional.filter(({ snapshot, returns: values }) => values[days]! * expectedDirection(snapshot.tier) > 0).length;
                return {
                    zone: zone.id,
                    label: zone.label,
                    sample_count: cohort.length,
                    average_forward_return_pct: returns.length > 0 ? Number((returns.reduce((sum, value) => sum + value, 0) / returns.length).toFixed(2)) : null,
                    alignment_rate_pct: directional.length > 0 ? Math.round((aligned / directional.length) * 100) : null,
                };
            }),
        })),
        limitation: 'Historical forward returns are overlapping observations without transaction costs. They calibrate prior signal interpretation and do not predict future returns.',
    };
};
