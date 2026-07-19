import type { MarketSignal, SignalTier } from './types/signal-v2';

export const MARKET_SCORE_MODEL_VERSION = '2.0.0';

export type CalibrationSnapshot = {
    readonly date: string;
    readonly score: number;
    readonly tier: SignalTier;
    readonly origin?: 'observed' | 'reconstructed';
    readonly modelVersion?: string | null;
    readonly coverageNote?: string | null;
    readonly validationEligible?: boolean;
};

export type CalibrationPrice = { readonly date: string; readonly close: number };

export type CalibrationResult = NonNullable<MarketSignal['metadata']['historical_validation']>;
export type CalibrationCohort = CalibrationResult['horizons'][number]['cohorts'][number];
export type CalibrationBaseline = CalibrationResult['horizons'][number]['baseline'];
export type CalibrationObservation = CalibrationResult['horizons'][number]['observations'][number];
export type CalibrationValidationCase = CalibrationObservation & {
    readonly kind: 'aligned' | 'directional-mismatch' | 'neutral-sharp-move';
};
export type SimilarScoreOutcomeState = 'unavailable' | CalibrationCohort['evidence_level'];

export type SimilarScoreOutcome = {
    readonly days: 7 | 30;
    readonly state: SimilarScoreOutcomeState;
    readonly cohort: CalibrationCohort | null;
    readonly baseline: CalibrationBaseline | null;
    readonly observations: readonly CalibrationObservation[];
    readonly minimumSampleSize: number | null;
};

const zones = [
    { id: 'negative' as const, label: '0–39', min: 0, max: 39 },
    { id: 'mixed' as const, label: '40–64', min: 40, max: 64 },
    { id: 'positive' as const, label: '65–84', min: 65, max: 84 },
    { id: 'strong-positive' as const, label: '85–100', min: 85, max: 100 },
];

export const getCalibrationZone = (score: number): CalibrationCohort['zone'] | null =>
    Number.isFinite(score) ? zones.find((zone) => score >= zone.min && score <= zone.max)?.id ?? null : null;

export const getCalibrationZoneBounds = (score: number) => {
    if (!Number.isFinite(score)) return null;
    const zone = zones.find((candidate) => score >= candidate.min && score <= candidate.max);
    return zone ? { id: zone.id, label: zone.label, min: zone.min, max: zone.max } : null;
};

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

const isUsableBaseline = (baseline: CalibrationBaseline) => isCount(baseline.sample_count)
    && baseline.sample_count > 0
    && isCount(baseline.observed_count)
    && isCount(baseline.reconstructed_count)
    && baseline.observed_count + baseline.reconstructed_count === baseline.sample_count
    && typeof baseline.median_forward_return_pct === 'number'
    && Number.isFinite(baseline.median_forward_return_pct)
    && typeof baseline.positive_return_rate_pct === 'number'
    && Number.isFinite(baseline.positive_return_rate_pct)
    && baseline.positive_return_rate_pct >= 0
    && baseline.positive_return_rate_pct <= 100;

const isUsableObservation = (observation: CalibrationObservation) => typeof observation.date === 'string'
    && observation.date.length > 0
    && typeof observation.score === 'number'
    && Number.isFinite(observation.score)
    && observation.score >= 0
    && observation.score <= 100
    && (observation.tier === 'strong-buy' || observation.tier === 'buy' || observation.tier === 'neutral'
        || observation.tier === 'sell' || observation.tier === 'strong-sell')
    && typeof observation.forward_return_pct === 'number'
    && Number.isFinite(observation.forward_return_pct)
    && (observation.origin === 'observed' || observation.origin === 'reconstructed');

export const selectHistoricalValidationCases = (
    calibration: CalibrationResult | null | undefined,
    limit = 4,
): Readonly<{ aligned: readonly CalibrationValidationCase[]; mismatches: readonly CalibrationValidationCase[]; neutral: readonly CalibrationValidationCase[] }> => {
    const observations = calibration?.horizons.find((horizon) => horizon.days === 30)?.observations ?? [];
    const classified: CalibrationValidationCase[] = [];
    observations.forEach((observation) => {
        if (!isUsableObservation(observation)) return;
        const direction = expectedDirection(observation.tier);
        if (observation.forward_return_pct === 0) return;
        if (direction === 0) {
            if (Math.abs(observation.forward_return_pct) >= 5) classified.push({ ...observation, kind: 'neutral-sharp-move' });
            return;
        }
        classified.push({
            ...observation,
            kind: observation.forward_return_pct * direction > 0
                ? 'aligned' as const
                : 'directional-mismatch' as const,
        });
    });
    const largestFirst = (left: CalibrationValidationCase, right: CalibrationValidationCase) =>
        Math.abs(right.forward_return_pct) - Math.abs(left.forward_return_pct) || left.date.localeCompare(right.date);
    return {
        aligned: classified.filter((item) => item.kind === 'aligned').sort(largestFirst).slice(0, limit),
        mismatches: classified.filter((item) => item.kind === 'directional-mismatch').sort(largestFirst).slice(0, limit),
        neutral: classified.filter((item) => item.kind === 'neutral-sharp-move').sort(largestFirst).slice(0, limit),
    };
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
            return { days, state: 'unavailable', cohort: null, baseline: null, observations: [], minimumSampleSize: null };
        }
        const horizon = calibration.horizons.find((candidate) => candidate.days === days);
        const cohort = Array.isArray(horizon?.cohorts)
            ? horizon.cohorts.find((candidate) => candidate?.zone === zone)
            : undefined;
        if (!cohort || !isUsableCohort(cohort, minimumSampleSize)) {
            return { days, state: 'unavailable', cohort: null, baseline: null, observations: [], minimumSampleSize };
        }
        const baseline = horizon?.baseline && isUsableBaseline(horizon.baseline) ? horizon.baseline : null;
        const observations = baseline && Array.isArray(horizon?.observations)
            && horizon.observations.length === baseline.sample_count
            && horizon.observations.every(isUsableObservation)
            ? horizon.observations
            : [];
        return { days, state: cohort.evidence_level, cohort, baseline, observations, minimumSampleSize };
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
    readonly modelVersion?: string;
    readonly generatedAt?: string;
}): CalibrationResult => {
    const sortedPrices = [...input.prices].filter((point) => point.close > 0).sort((left, right) => left.date.localeCompare(right.date));
    const sortedSnapshots = [...input.snapshots].sort((left, right) => left.date.localeCompare(right.date));
    const priceOnOrAfter = (date: string) => sortedPrices.find((point) => point.date >= date) ?? null;
    const timelineCandidates = sortedSnapshots.flatMap((snapshot) => {
        const price = priceOnOrAfter(snapshot.date);
        return price ? [{ snapshot, price }] : [];
    });
    const timelineBase = timelineCandidates[0]?.price.close ?? null;
    const observations = input.snapshots.filter((snapshot) => snapshot.validationEligible !== false).flatMap((snapshot) => {
        const start = priceOnOrAfter(snapshot.date);
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
        model_version: input.modelVersion ?? MARKET_SCORE_MODEL_VERSION,
        generated_at: input.generatedAt ?? new Date().toISOString(),
        data_start_date: timelineCandidates[0]?.snapshot.date ?? null,
        data_through_date: timelineCandidates.at(-1)?.snapshot.date ?? null,
        snapshot_count: input.snapshots.length,
        timeline_only_snapshot_count: input.snapshots.filter((snapshot) => snapshot.validationEligible === false).length,
        observed_snapshot_count: observedSnapshotCount,
        reconstructed_snapshot_count: reconstructedSnapshotCount,
        minimum_sample_size: minimumSampleSize,
        directional_sample_size: directionalSampleSize,
        reconstruction_note: reconstructedSnapshotCount > 0 ? input.reconstructionNote ?? null : null,
        horizons: ([7, 30] as const).map((days) => {
            const eligible = observations.filter(({ returns }) => returns[days] !== null);
            const baselineReturns = eligible.map((item) => item.returns[days]!);
            const baselineObservedCount = eligible.filter(({ snapshot }) => snapshot.origin !== 'reconstructed').length;
            return {
                days,
                observations: eligible.map(({ snapshot, returns }) => ({
                    date: snapshot.date,
                    score: snapshot.score,
                    tier: snapshot.tier,
                    forward_return_pct: returns[days]!,
                    origin: snapshot.origin === 'reconstructed' ? 'reconstructed' as const : 'observed' as const,
                })),
                baseline: {
                    sample_count: eligible.length,
                    observed_count: baselineObservedCount,
                    reconstructed_count: eligible.length - baselineObservedCount,
                    median_forward_return_pct: median(baselineReturns),
                    positive_return_rate_pct: baselineReturns.length > 0 ? Math.round((baselineReturns.filter((value) => value > 0).length / baselineReturns.length) * 100) : null,
                },
                cohorts: zones.map((zone) => {
                    const cohort = observations.filter(({ snapshot, returns }) => snapshot.score >= zone.min && snapshot.score <= zone.max && returns[days] !== null);
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
            };
        }),
        timeline: timelineBase === null ? [] : timelineCandidates.map(({ snapshot, price }) => ({
            date: snapshot.date,
            score: snapshot.score,
            tier: snapshot.tier,
            origin: snapshot.origin === 'reconstructed' ? 'reconstructed' as const : 'observed' as const,
            benchmark_rebased: Number(((price.close / timelineBase) * 100).toFixed(2)),
            model_version: snapshot.modelVersion ?? null,
            coverage_note: snapshot.coverageNote ?? null,
        })),
        limitation: 'Historical forward returns are overlapping observations without transaction costs. They calibrate prior signal interpretation and do not predict future returns.',
    };
};
