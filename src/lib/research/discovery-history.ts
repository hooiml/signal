export type StoredDiscoveryCandidate = {
    readonly symbol: string;
    readonly rank: number;
    readonly discoveryScore: number;
    readonly price: number;
};

export type DiscoveryHistorySnapshot = {
    readonly generatedAt: string;
    readonly candidates: readonly StoredDiscoveryCandidate[];
};

export type DiscoveryHistorySignals = {
    readonly scoreChange1Day: number | null;
    readonly scoreChange1Week: number | null;
    readonly scoreChange1Month: number | null;
    readonly rankChange1Week: number | null;
    readonly firstSeenAt: string;
};

export type CohortPerformance = {
    readonly period: '1D' | '1W' | '1M';
    readonly averageReturnPercent: number | null;
    readonly trackedCount: number;
    readonly winnerCount: number;
};

const nearestSnapshot = (now: string, days: number, snapshots: readonly DiscoveryHistorySnapshot[]) => {
    const target = Date.parse(now) - days * 86_400_000;
    const nearest = [...snapshots].sort((left, right) =>
        Math.abs(Date.parse(left.generatedAt) - target) - Math.abs(Date.parse(right.generatedAt) - target)
    )[0] ?? null;
    const toleranceDays = days === 1 ? 0.75 : days === 7 ? 3 : 7;
    return nearest && Math.abs(Date.parse(nearest.generatedAt) - target) <= toleranceDays * 86_400_000 ? nearest : null;
};

const priorCandidate = (symbol: string, now: string, days: number, snapshots: readonly DiscoveryHistorySnapshot[]) =>
    nearestSnapshot(now, days, snapshots)?.candidates.find((candidate) => candidate.symbol === symbol) ?? null;

export const calculateHistorySignals = (
    symbol: string,
    currentScore: number,
    currentRank: number,
    generatedAt: string,
    snapshots: readonly DiscoveryHistorySnapshot[],
): DiscoveryHistorySignals => {
    const priorDay = priorCandidate(symbol, generatedAt, 1, snapshots);
    const priorWeek = priorCandidate(symbol, generatedAt, 7, snapshots);
    const priorMonth = priorCandidate(symbol, generatedAt, 30, snapshots);
    const seenDates = snapshots
        .filter((snapshot) => snapshot.candidates.some((candidate) => candidate.symbol === symbol))
        .map((snapshot) => snapshot.generatedAt);
    return {
        scoreChange1Day: priorDay ? currentScore - priorDay.discoveryScore : null,
        scoreChange1Week: priorWeek ? currentScore - priorWeek.discoveryScore : null,
        scoreChange1Month: priorMonth ? currentScore - priorMonth.discoveryScore : null,
        rankChange1Week: priorWeek ? priorWeek.rank - currentRank : null,
        firstSeenAt: [...seenDates, generatedAt].sort()[0] ?? generatedAt,
    };
};

export const calculateCohortPerformance = (
    period: CohortPerformance['period'],
    snapshot: DiscoveryHistorySnapshot | null,
    currentPrices: ReadonlyMap<string, number>,
): CohortPerformance => {
    const returns = snapshot?.candidates.flatMap((candidate) => {
        const current = currentPrices.get(candidate.symbol);
        return current === undefined || candidate.price <= 0 ? [] : [((current - candidate.price) / candidate.price) * 100];
    }) ?? [];
    const average = returns.length === 0 ? null : returns.reduce((sum, value) => sum + value, 0) / returns.length;
    return {
        period,
        averageReturnPercent: average === null ? null : Number(average.toFixed(1)),
        trackedCount: returns.length,
        winnerCount: returns.filter((value) => value > 0).length,
    };
};

export const snapshotForPeriod = (now: string, days: number, snapshots: readonly DiscoveryHistorySnapshot[]) =>
    nearestSnapshot(now, days, snapshots);
