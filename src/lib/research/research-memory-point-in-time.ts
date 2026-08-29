export type ResearchMemoryPointInTimeObservation<T> = {
    readonly id: string;
    readonly ticker: string;
    readonly series: string;
    readonly effectiveAt: string;
    readonly observedAt: string;
    readonly value: T;
    readonly source: string;
    readonly kind: 'expectation' | 'actual' | 'context';
};

export type ResearchMemoryReplayFrame = {
    readonly ticker: string;
    readonly asOf: string;
    readonly observations: readonly ResearchMemoryPointInTimeObservation<unknown>[];
};

const time = (value: string, label: string) => {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) throw new Error(`Invalid ${label}`);
    return parsed;
};

const normalizeTicker = (value: string) => value.trim().toUpperCase();

export const createResearchMemoryPointInTimeObservation = <T>(
    input: ResearchMemoryPointInTimeObservation<T>,
): ResearchMemoryPointInTimeObservation<T> => ({
    ...input,
    ticker: normalizeTicker(input.ticker),
    effectiveAt: new Date(time(input.effectiveAt, 'effectiveAt')).toISOString(),
    observedAt: new Date(time(input.observedAt, 'observedAt')).toISOString(),
});

export const isResearchMemoryObservationKnownAt = <T>(
    observation: ResearchMemoryPointInTimeObservation<T>,
    asOf: string,
) => time(observation.observedAt, 'observedAt') <= time(asOf, 'asOf');

export const getResearchMemoryReplayFrame = (
    observations: readonly ResearchMemoryPointInTimeObservation<unknown>[],
    ticker: string,
    asOf: string,
): ResearchMemoryReplayFrame => {
    const normalizedTicker = normalizeTicker(ticker);
    const asOfTime = time(asOf, 'asOf');
    const visible = observations
        .filter((observation) => observation.ticker === normalizedTicker && time(observation.observedAt, 'observedAt') <= asOfTime)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
    return { ticker: normalizedTicker, asOf: new Date(asOfTime).toISOString(), observations: visible };
};

export const getLatestResearchMemoryObservationAsOf = <T>(
    observations: readonly ResearchMemoryPointInTimeObservation<T>[],
    input: { readonly ticker: string; readonly series: string; readonly asOf: string; readonly kind?: ResearchMemoryPointInTimeObservation<T>['kind'] },
): ResearchMemoryPointInTimeObservation<T> | null => {
    const normalizedTicker = normalizeTicker(input.ticker);
    const asOfTime = time(input.asOf, 'asOf');
    return observations
        .filter((observation) => observation.ticker === normalizedTicker
            && observation.series === input.series
            && (!input.kind || observation.kind === input.kind)
            && time(observation.observedAt, 'observedAt') <= asOfTime)
        .sort((a, b) => b.observedAt.localeCompare(a.observedAt) || b.id.localeCompare(a.id))[0] ?? null;
};

export type ResearchMemoryExpectationReality<T> = {
    readonly ticker: string;
    readonly series: string;
    readonly decisionAsOf: string;
    readonly expectation: ResearchMemoryPointInTimeObservation<T> | null;
    readonly actual: ResearchMemoryPointInTimeObservation<T> | null;
    readonly actualWasKnownAtDecision: boolean;
};

export const compareResearchMemoryExpectationToReality = <T>(
    observations: readonly ResearchMemoryPointInTimeObservation<T>[],
    input: { readonly ticker: string; readonly series: string; readonly decisionAsOf: string; readonly revealAsOf: string },
): ResearchMemoryExpectationReality<T> => {
    const expectation = getLatestResearchMemoryObservationAsOf(observations, {
        ticker: input.ticker,
        series: input.series,
        asOf: input.decisionAsOf,
        kind: 'expectation',
    });
    const actual = getLatestResearchMemoryObservationAsOf(observations, {
        ticker: input.ticker,
        series: input.series,
        asOf: input.revealAsOf,
        kind: 'actual',
    });
    return {
        ticker: normalizeTicker(input.ticker),
        series: input.series,
        decisionAsOf: new Date(time(input.decisionAsOf, 'decisionAsOf')).toISOString(),
        expectation,
        actual,
        actualWasKnownAtDecision: Boolean(actual && isResearchMemoryObservationKnownAt(actual, input.decisionAsOf)),
    };
};

export const assertResearchMemoryReplayIntegrity = (frame: ResearchMemoryReplayFrame) => {
    const asOf = time(frame.asOf, 'frame asOf');
    const leaked = frame.observations.find((observation) => time(observation.observedAt, 'observedAt') > asOf);
    if (leaked) throw new Error(`Point-in-time leak detected: ${leaked.id}`);
    return true;
};
