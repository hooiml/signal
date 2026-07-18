import type { MarketSignal, SignalTier } from './types/signal-v2';

export type CalibrationSnapshot = {
    readonly date: string;
    readonly score: number;
    readonly tier: SignalTier;
    readonly origin?: 'observed' | 'reconstructed';
};

export type CalibrationPrice = { readonly date: string; readonly close: number };

export type CalibrationResult = NonNullable<MarketSignal['metadata']['historical_validation']>;
export type CalibrationCohort = CalibrationResult['horizons'][number]['cohorts'][number];
export type SimilarScoreOutcomeState = 'unavailable' | CalibrationCohort['evidence_level'];

export type SimilarScoreOutcome = {
    readonly days: 7 | 30;
    readonly state: SimilarScoreOutcomeState;
    readonly cohort: CalibrationCohort | null;
    readonly minimumSampleSize: number | null;
};

const zones = [
    { id: 'negative' as const, label: '0–39', matches: (score: number) => score <= 39 },
    { id: 'mixed' as const, label: '40–64', matches: (score: number) => score >= 40 && score <= 64 },
    { id: 'positive' as const, label: '65–84', matches: (score: number) => score >= 65 && score <= 84 },
    { id: 'strong-positive' as const, label: '85–100', matches: (score: number) => score >= 85 },
];

export const getCalibrationZone = (score: number): CalibrationCohort['zone'] | null =>
    Number.isFinite(score) ? zones.find((zone) => zone.matches(score))?.id ?? null : null;

const isCount = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
const isFiniteOrNull = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));
const isRateOrNull = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);

const isUsableCohort = (cohort: CalibrationCohort, minimumSampleSize: number) => {
    const evidenceLevels: readonly CalibrationCohort['evidence_level'][] = ['insufficient', 'preliminary', 'established'];
    const countsAreValid = isCount(cohort.sample_count)
        && isCount(cohort.observed_count)
        && isCount(cohort.reconstructed_count)
        && cohort.observed_count + cohort.reconstructed_count === cohort.sample_count;
    const statisticsAreFinite = [
        cohort.average_forward_return_pct,
        cohort.median_forward_return_pct,
        cohort.worst_forward_return_pct,
        cohort.best_forward_return_pct,
    ].every(isFiniteOrNull);
    const ratesAreValid = isRateOrNull(cohort.positive_return_rate_pct) && isRateOrNull(cohort.alignment_rate_pct);
    const rangeIsValid = cohort.worst_forward_return_pct === null
        || cohort.best_forward_return_pct === null
        || cohort.worst_forward_return_pct <= cohort.best_forward_return_pct;
    const evidenceMatchesMinimum = cohort.evidence_level === 'insufficient'
        ? cohort.sample_count < minimumSampleSize
        : cohort.sample_count >= minimumSampleSize;
    const summaryStatisticsExist = cohort.evidence_level === 'insufficient'
        || (cohort.median_forward_return_pct !== null && cohort.positive_return_rate_pct !== null);

    return countsAreValid
        && statisticsAreFinite
        && ratesAreValid
        && rangeIsValid
        && evidenceLevels.includes(cohort.evidence_level)
        && evidenceMatchesMinimum
        && summaryStatisticsExist;
};

export const selectSimilarScoreOutcomes = (
    score: number,
    calibration: CalibrationResult | null | undefined,
): readonly SimilarScoreOutcome[] => {
    const zone = getCalibrationZone(score);
    const minimumSampleSize = calibration?.minimum_sample_size;
    const calibrationIsUsable = zone !== null
        && Array.isArray(calibration?.horizons)
        && Number.isInteger(minimumSampleSize)
        && Number(minimumSampleSize) > 0;

    return ([7, 30] as const).map((days) => {
        if (!calibrationIsUsable || minimumSampleSize === undefined) {
            return { days, state: 'unavailable', cohort: null, minimumSampleSize: null };
        }
        const horizon = calibration.horizons.find((candidate) => candidate.days === days);
        const cohort = Array.isArray(horizon?.cohorts)
            ? horizon.cohorts.find((candidate) => candidate?.zone === zone)
            : undefined;
        if (!cohort || !isUsableCohort(cohort, minimumSampleSize)) {
            return { days, state: 'unavailable', cohort: null, minimumSampleSize };
        }
        return { days, state: cohort.evidence_level, cohort, minimumSampleSize };
    });
};

const returnPercent = (start: number, end: number) => Number((((end - start) / start) * 100).toFixed(2));

const median = (values: readonly number[]) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? Number(((sorted[middle - 1] + sorted[middle]) / 2).toFixed(2))
        : sorted[middle];
};

const expectedDirection = (tier: SignalTier): -1 | 0 | 1 =>
    tier === 'buy' || tier === 'strong-buy' ? 1 : tier === 'sell' || tier === 'strong-sell' ? -1 : 0;

export const calculateMarketCalibration = (input: {
    readonly snapshots: readonly CalibrationSnapshot[];
    readonly prices: readonly CalibrationPrice[];
    readonly mode: 'standard' | 'contrarian';
    readonly benchmarkSymbol: string;
    readonly benchmarkName: string;
    readonly reconstructionNote?: string | null;
}): CalibrationResult => {
    const sortedPrices = [...input.prices].filter((point) => point.close > 0).sort((left, right) => left.date.localeCompare(right.date));
    const observations = input.snapshots.flatMap((snapshot) => {
        const start = sortedPrices.find((point) => point.date >= snapshot.date);
        if (!start) return [];
        const startTime = new Date(`${start.date}T00:00:00Z`).getTime();
        const outcome = (days: 7 | 30) => sortedPrices.find((point) => new Date(`${point.date}T00:00:00Z`).getTime() >= startTime + days * 86_400_000);
        return [{ snapshot, returns: { 7: outcome(7) ? returnPercent(start.close, outcome(7)!.close) : null, 30: outcome(30) ? returnPercent(start.close, outcome(30)!.close) : null } }];
    });
    const observedSnapshotCount = input.snapshots.filter((snapshot) => snapshot.origin !== 'reconstructed').length;
    const reconstructedSnapshotCount = input.snapshots.length - observedSnapshotCount;
    const minimumSampleSize = 5;
    const directionalSampleSize = 20;

    return {
        benchmark_symbol: input.benchmarkSymbol,
        benchmark_name: input.benchmarkName,
        mode: input.mode,
        snapshot_count: input.snapshots.length,
        observed_snapshot_count: observedSnapshotCount,
        reconstructed_snapshot_count: reconstructedSnapshotCount,
        minimum_sample_size: minimumSampleSize,
        directional_sample_size: directionalSampleSize,
        reconstruction_note: reconstructedSnapshotCount > 0 ? input.reconstructionNote ?? null : null,
        horizons: ([7, 30] as const).map((days) => ({
            days,
            cohorts: zones.map((zone) => {
                const cohort = observations.filter(({ snapshot, returns }) => zone.matches(snapshot.score) && returns[days] !== null);
                const returns = cohort.map((item) => item.returns[days]!);
                const directional = cohort.filter(({ snapshot }) => expectedDirection(snapshot.tier) !== 0);
                const aligned = directional.filter(({ snapshot, returns: values }) => values[days]! * expectedDirection(snapshot.tier) > 0).length;
                const observedCount = cohort.filter(({ snapshot }) => snapshot.origin !== 'reconstructed').length;
                return {
                    zone: zone.id,
                    label: zone.label,
                    sample_count: cohort.length,
                    observed_count: observedCount,
                    reconstructed_count: cohort.length - observedCount,
                    average_forward_return_pct: returns.length > 0 ? Number((returns.reduce((sum, value) => sum + value, 0) / returns.length).toFixed(2)) : null,
                    median_forward_return_pct: median(returns),
                    positive_return_rate_pct: returns.length > 0 ? Math.round((returns.filter((value) => value > 0).length / returns.length) * 100) : null,
                    worst_forward_return_pct: returns.length > 0 ? Math.min(...returns) : null,
                    best_forward_return_pct: returns.length > 0 ? Math.max(...returns) : null,
                    alignment_rate_pct: directional.length > 0 ? Math.round((aligned / directional.length) * 100) : null,
                    evidence_level: cohort.length < minimumSampleSize
                        ? 'insufficient' as const
                        : cohort.length >= directionalSampleSize && observedCount >= minimumSampleSize
                            ? 'established' as const
                            : 'preliminary' as const,
                };
            }),
        })),
        limitation: 'Historical forward returns are overlapping observations without transaction costs. They calibrate prior signal interpretation and do not predict future returns.',
    };
};
