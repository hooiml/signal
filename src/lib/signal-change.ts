export type DriverContribution = {
    readonly key: string;
    readonly name: string;
    readonly contribution: number;
};

export type DriverChange = {
    readonly key: string;
    readonly name: string;
    readonly current_contribution: number;
    readonly previous_contribution: number;
    readonly delta: number;
};

const isDriverContribution = (value: unknown): value is DriverContribution =>
    typeof value === 'object'
    && value !== null
    && typeof Reflect.get(value, 'key') === 'string'
    && typeof Reflect.get(value, 'name') === 'string'
    && typeof Reflect.get(value, 'contribution') === 'number'
    && Number.isFinite(Reflect.get(value, 'contribution'));

export const parseStoredDriverContributions = (value: unknown): DriverContribution[] | null =>
    Array.isArray(value) ? value.filter(isDriverContribution) : null;

export const parseStoredComponentContributions = (value: unknown): DriverContribution[] | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

    const contributions: DriverContribution[] = [];
    for (const [key, component] of Object.entries(value)) {
        if (typeof component !== 'object' || component === null) continue;
        const name = Reflect.get(component, 'display_name');
        const score = Reflect.get(component, 'score');
        const weight = Reflect.get(component, 'weight');
        if (typeof name !== 'string' || typeof score !== 'number' || typeof weight !== 'number') continue;
        if (!Number.isFinite(score) || !Number.isFinite(weight)) continue;
        contributions.push({ key, name, contribution: score * weight });
    }

    return contributions;
};

export const calculateDriverChanges = (
    current: readonly DriverContribution[],
    previous: readonly DriverContribution[],
): DriverChange[] => {
    const currentByKey = new Map(current.map((driver) => [driver.key, driver]));
    const previousByKey = new Map(previous.map((driver) => [driver.key, driver]));
    const keys = new Set([...currentByKey.keys(), ...previousByKey.keys()]);

    return [...keys]
        .map((key) => {
            const currentDriver = currentByKey.get(key);
            const previousDriver = previousByKey.get(key);
            const currentContribution = currentDriver?.contribution ?? 0;
            const previousContribution = previousDriver?.contribution ?? 0;

            return {
                key,
                name: currentDriver?.name ?? previousDriver?.name ?? key,
                current_contribution: currentContribution,
                previous_contribution: previousContribution,
                delta: currentContribution - previousContribution,
            };
        })
        .filter((change) => change.delta !== 0)
        .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.name.localeCompare(right.name));
};

// Full accounting of a composite score change between two archived snapshots. The composite is
// round(clamp(sum of score x weight + missing weight x 50)), so the reported delta equals the sum
// of component deltas, the neutral-fallback delta and a rounding/clamp residual.
export type StoredComponentReading = {
    readonly key: string;
    readonly name: string;
    readonly score: number;
    readonly weight: number;
    readonly raw_value: number | null;
    readonly last_updated: string | null;
};

export type ComponentChangeStatus = 'changed' | 'unchanged' | 'became-available' | 'became-unavailable';

export type ComponentChangeRow = {
    readonly key: string;
    readonly name: string;
    readonly status: ComponentChangeStatus;
    readonly previous_score: number | null;
    readonly current_score: number | null;
    readonly previous_weight: number | null;
    readonly current_weight: number | null;
    readonly previous_raw_value: number | null;
    readonly current_raw_value: number | null;
    readonly previous_observed_at: string | null;
    readonly current_observed_at: string | null;
    /** null when either reading lacks a timestamp, so a new observation cannot be established. */
    readonly new_observation: boolean | null;
    /** (current score - previous score) x previous weight; null for availability changes. */
    readonly score_effect: number | null;
    /** current score x (current weight - previous weight); null for availability changes. */
    readonly weight_effect: number | null;
    readonly delta: number;
};

export type ScoreChangeReconciliation = {
    readonly previous_score: number;
    readonly current_score: number;
    readonly reported_delta: number;
    readonly components: readonly ComponentChangeRow[];
    readonly component_delta: number;
    readonly neutral_fallback: {
        readonly previous_missing_weight: number;
        readonly current_missing_weight: number;
        readonly previous_points: number;
        readonly current_points: number;
        readonly delta: number;
    };
    readonly rounding_residual: number;
    readonly weights_changed: boolean;
    readonly model_version: { readonly previous: string | null; readonly current: string; readonly changed: boolean | null };
};

const neutralBaseline = 50;
const finiteOrNull = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** Returns null when any stored component lacks the score and weight needed to reconcile. */
export const parseStoredComponentReadings = (value: unknown): StoredComponentReading[] | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const readings: StoredComponentReading[] = [];
    for (const [key, component] of Object.entries(value)) {
        if (typeof component !== 'object' || component === null) return null;
        const name = Reflect.get(component, 'display_name');
        const score = finiteOrNull(Reflect.get(component, 'score'));
        const weight = finiteOrNull(Reflect.get(component, 'weight'));
        if (typeof name !== 'string' || score === null || weight === null) return null;
        const lastUpdated = Reflect.get(component, 'last_updated');
        readings.push({
            key,
            name,
            score,
            weight,
            raw_value: finiteOrNull(Reflect.get(component, 'raw_value')),
            last_updated: typeof lastUpdated === 'string' && Number.isFinite(Date.parse(lastUpdated)) ? lastUpdated : null,
        });
    }
    return readings;
};

const neutralPoints = (readings: readonly StoredComponentReading[]) => {
    const missingWeight = Math.max(0, 1 - readings.reduce((total, reading) => total + reading.weight, 0));
    return { missingWeight, points: missingWeight * neutralBaseline };
};

const rawComposite = (readings: readonly StoredComponentReading[]) =>
    readings.reduce((total, reading) => total + reading.score * reading.weight, 0) + neutralPoints(readings).points;

export const reconcileScoreChange = (input: {
    readonly current: readonly StoredComponentReading[];
    readonly previous: readonly StoredComponentReading[];
    readonly currentScore: number;
    readonly previousScore: number;
    readonly currentModelVersion: string;
    readonly previousModelVersion: string | null;
}): ScoreChangeReconciliation => {
    const currentByKey = new Map(input.current.map((reading) => [reading.key, reading]));
    const previousByKey = new Map(input.previous.map((reading) => [reading.key, reading]));
    const components = [...new Set([...currentByKey.keys(), ...previousByKey.keys()])].map((key): ComponentChangeRow => {
        const now = currentByKey.get(key);
        const before = previousByKey.get(key);
        const delta = round6((now ? now.score * now.weight : 0) - (before ? before.score * before.weight : 0));
        const both = now !== undefined && before !== undefined;
        const newObservation = both && now.last_updated && before.last_updated
            ? Date.parse(now.last_updated) !== Date.parse(before.last_updated)
            : null;
        const status: ComponentChangeStatus = !before ? 'became-available'
            : !now ? 'became-unavailable'
            : delta !== 0 || now.raw_value !== before.raw_value || newObservation === true ? 'changed' : 'unchanged';
        return {
            key,
            name: now?.name ?? before?.name ?? key,
            status,
            previous_score: before?.score ?? null,
            current_score: now?.score ?? null,
            previous_weight: before?.weight ?? null,
            current_weight: now?.weight ?? null,
            previous_raw_value: before?.raw_value ?? null,
            current_raw_value: now?.raw_value ?? null,
            previous_observed_at: before?.last_updated ?? null,
            current_observed_at: now?.last_updated ?? null,
            new_observation: newObservation,
            score_effect: both ? round6((now.score - before.score) * before.weight) : null,
            weight_effect: both ? round6(now.score * (now.weight - before.weight)) : null,
            delta,
        };
    }).sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta) || left.name.localeCompare(right.name));
    const previousNeutral = neutralPoints(input.previous);
    const currentNeutral = neutralPoints(input.current);
    const reportedDelta = input.currentScore - input.previousScore;
    return {
        previous_score: input.previousScore,
        current_score: input.currentScore,
        reported_delta: reportedDelta,
        components,
        component_delta: round6(components.reduce((total, row) => total + row.delta, 0)),
        neutral_fallback: {
            previous_missing_weight: round6(previousNeutral.missingWeight),
            current_missing_weight: round6(currentNeutral.missingWeight),
            previous_points: round6(previousNeutral.points),
            current_points: round6(currentNeutral.points),
            delta: round6(currentNeutral.points - previousNeutral.points),
        },
        rounding_residual: round6(reportedDelta - (rawComposite(input.current) - rawComposite(input.previous))),
        weights_changed: components.some((row) => row.previous_weight !== null && row.current_weight !== null && row.previous_weight !== row.current_weight),
        model_version: {
            previous: input.previousModelVersion,
            current: input.currentModelVersion,
            changed: input.previousModelVersion === null ? null : input.previousModelVersion !== input.currentModelVersion,
        },
    };
};
