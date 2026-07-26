import type {
    ResearchAction,
    ResearchDecisionConfidence,
    ResearchMarket,
} from '../types/research';
import type { ResearchChartPoint } from '../types/research-snapshot';

export const paperDecisionLimit = 100;
export const decisionReviewHorizons = ['1M', '3M', '6M', '1Y'] as const;

export type PaperDecisionAction = 'act' | 'pass';
export type DecisionReviewHorizon = typeof decisionReviewHorizons[number];

export type PaperDecisionBenchmark = {
    readonly symbol: 'VOO' | 'KLCI';
    readonly entryPrice: number | null;
    readonly outcomePrice: number | null;
    readonly observedAt: string | null;
};

export type PaperDecision = {
    readonly id: string;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly action: PaperDecisionAction;
    readonly decisionPrice: number;
    readonly note: string;
    readonly recordedAt: string;
    readonly horizon: DecisionReviewHorizon;
    readonly researchDecision: ResearchAction | null;
    readonly confidence: ResearchDecisionConfidence | null;
    readonly benchmark: PaperDecisionBenchmark;
    readonly outcomePrice: number | null;
    readonly resolvedAt: string | null;
    readonly maxDrawdownPercent: number | null;
    readonly maxFavorableMovePercent: number | null;
};

export type DecisionReviewEvidenceLevel = 'unavailable' | 'insufficient' | 'preliminary' | 'established';

export type DecisionReviewResult = {
    readonly decision: PaperDecision;
    readonly marketReturnPercent: number;
    readonly benchmarkReturnPercent: number | null;
    readonly relativeReturnPercent: number | null;
    readonly decisionEffectPercent: number;
};

export type DecisionReviewGroup = {
    readonly label: string;
    readonly sampleSize: number;
    readonly evidenceLevel: DecisionReviewEvidenceLevel;
    readonly averageRelativeReturnPercent: number | null;
    readonly averageDecisionEffectPercent: number | null;
    readonly favorableDecisionRatePercent: number | null;
};

export type DecisionReviewAnalytics = {
    readonly resolvedCount: number;
    readonly benchmarkedCount: number;
    readonly evidenceLevel: DecisionReviewEvidenceLevel;
    readonly averageRelativeReturnPercent: number | null;
    readonly results: readonly DecisionReviewResult[];
    readonly byAction: readonly DecisionReviewGroup[];
    readonly byConfidence: readonly DecisionReviewGroup[];
    readonly byHorizon: readonly DecisionReviewGroup[];
};

const finitePositive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const finiteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const oneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
    typeof value === 'string' && values.some((candidate) => candidate === value);

const parsePaperDecision = (value: unknown): PaperDecision | null => {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<PaperDecision>;
    const symbol = typeof candidate.symbol === 'string' ? candidate.symbol.trim().toUpperCase().slice(0, 12) : '';
    if (
        typeof candidate.id !== 'string'
        || !symbol
        || (candidate.market !== 'US' && candidate.market !== 'MY')
        || (candidate.action !== 'act' && candidate.action !== 'pass')
        || !finitePositive(candidate.decisionPrice)
        || typeof candidate.recordedAt !== 'string'
    ) return null;
    const outcomePrice = candidate.outcomePrice === null || candidate.outcomePrice === undefined
        ? null
        : finitePositive(candidate.outcomePrice) ? candidate.outcomePrice : null;
    const horizon = oneOf(candidate.horizon, decisionReviewHorizons) ? candidate.horizon : '3M';
    const researchDecision = oneOf(candidate.researchDecision, ['Ready', 'DCA', 'Wait for price', 'Watch', 'Avoid'] as const)
        ? candidate.researchDecision
        : null;
    const confidence = oneOf(candidate.confidence, ['low', 'medium', 'high'] as const)
        ? candidate.confidence
        : null;
    const benchmarkCandidate = candidate.benchmark && typeof candidate.benchmark === 'object'
        ? candidate.benchmark as Partial<PaperDecisionBenchmark>
        : null;
    const benchmarkSymbol = candidate.market === 'US' ? 'VOO' : 'KLCI';
    const benchmarkOutcomePrice = benchmarkCandidate?.outcomePrice === null || benchmarkCandidate?.outcomePrice === undefined
        ? null
        : finitePositive(benchmarkCandidate.outcomePrice) ? benchmarkCandidate.outcomePrice : null;
    return {
        id: candidate.id.slice(0, 100),
        symbol,
        market: candidate.market,
        action: candidate.action,
        decisionPrice: candidate.decisionPrice,
        note: typeof candidate.note === 'string' ? candidate.note.trim().slice(0, 240) : '',
        recordedAt: candidate.recordedAt,
        horizon,
        researchDecision,
        confidence,
        benchmark: {
            symbol: benchmarkSymbol,
            entryPrice: finitePositive(benchmarkCandidate?.entryPrice) ? benchmarkCandidate.entryPrice : null,
            outcomePrice: benchmarkOutcomePrice,
            observedAt: benchmarkOutcomePrice && typeof benchmarkCandidate?.observedAt === 'string'
                ? benchmarkCandidate.observedAt
                : null,
        },
        outcomePrice,
        resolvedAt: outcomePrice && typeof candidate.resolvedAt === 'string' ? candidate.resolvedAt : null,
        maxDrawdownPercent: finiteNumber(candidate.maxDrawdownPercent) ? candidate.maxDrawdownPercent : null,
        maxFavorableMovePercent: finiteNumber(candidate.maxFavorableMovePercent) ? candidate.maxFavorableMovePercent : null,
    };
};

export const parsePaperDecisions = (value: unknown): readonly PaperDecision[] => {
    if (!Array.isArray(value)) return [];
    const byId = new Map<string, PaperDecision>();
    for (const entry of value) {
        const parsed = parsePaperDecision(entry);
        if (parsed) byId.set(parsed.id, parsed);
    }
    return [...byId.values()]
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
        .slice(0, paperDecisionLimit);
};

export const addPaperDecision = (
    decisions: readonly PaperDecision[],
    decision: PaperDecision,
): readonly PaperDecision[] => parsePaperDecisions([decision, ...decisions]);

export const resolvePaperDecision = (
    decisions: readonly PaperDecision[],
    id: string,
    outcomePrice: number,
    resolvedAt: string,
): readonly PaperDecision[] => parsePaperDecisions(decisions.map((decision) =>
    decision.id === id ? { ...decision, outcomePrice, resolvedAt } : decision));

export const removePaperDecision = (
    decisions: readonly PaperDecision[],
    id: string,
): readonly PaperDecision[] => decisions.filter((decision) => decision.id !== id);

export const paperDecisionMarketMovePercent = (decision: PaperDecision): number | null =>
    decision.outcomePrice === null
        ? null
        : Number((((decision.outcomePrice - decision.decisionPrice) / decision.decisionPrice) * 100).toFixed(2));

const horizonDays: Readonly<Record<DecisionReviewHorizon, number>> = {
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
};

export const decisionReviewDueAt = (decision: PaperDecision): string =>
    new Date(Date.parse(decision.recordedAt) + horizonDays[decision.horizon] * 86_400_000).toISOString();

const percentMove = (from: number, to: number): number =>
    Number((((to - from) / from) * 100).toFixed(2));

const pointTime = (point: ResearchChartPoint): number => Date.parse(`${point.time}T00:00:00.000Z`);

const firstPointOnOrAfter = (
    points: readonly ResearchChartPoint[],
    date: string,
): ResearchChartPoint | null => {
    const targetTime = Date.parse(date);
    return [...points]
        .sort((left, right) => pointTime(left) - pointTime(right))
        .find((point) => pointTime(point) >= targetTime) ?? null;
};

export const evaluatePaperDecision = (
    decision: PaperDecision,
    candidateHistory: readonly ResearchChartPoint[],
    benchmarkHistory: readonly ResearchChartPoint[],
): PaperDecision => {
    if (decision.outcomePrice !== null) return decision;
    const dueAt = decisionReviewDueAt(decision);
    const outcome = firstPointOnOrAfter(candidateHistory, dueAt);
    if (!outcome) return decision;
    const recordedTime = Date.parse(decision.recordedAt);
    const outcomeTime = pointTime(outcome);
    const path = candidateHistory.filter((point) => {
        const time = pointTime(point);
        return time >= recordedTime && time <= outcomeTime;
    });
    const lowest = path.reduce((value, point) => Math.min(value, point.low), decision.decisionPrice);
    const highest = path.reduce((value, point) => Math.max(value, point.high), decision.decisionPrice);
    const benchmarkEntry = decision.benchmark.entryPrice === null
        ? firstPointOnOrAfter(benchmarkHistory, decision.recordedAt)
        : null;
    const benchmarkOutcome = firstPointOnOrAfter(benchmarkHistory, dueAt);
    return {
        ...decision,
        outcomePrice: outcome.close,
        resolvedAt: new Date(outcomeTime).toISOString(),
        maxDrawdownPercent: percentMove(decision.decisionPrice, lowest),
        maxFavorableMovePercent: percentMove(decision.decisionPrice, highest),
        benchmark: {
            ...decision.benchmark,
            entryPrice: decision.benchmark.entryPrice ?? benchmarkEntry?.close ?? null,
            outcomePrice: benchmarkOutcome?.close ?? null,
            observedAt: benchmarkOutcome ? new Date(pointTime(benchmarkOutcome)).toISOString() : null,
        },
    };
};

export const decisionReviewHistoryKey = (symbol: string, market: ResearchMarket): string =>
    `${market}:${symbol.trim().toUpperCase()}`;

export const resolveDuePaperDecisions = (
    decisions: readonly PaperDecision[],
    histories: ReadonlyMap<string, readonly ResearchChartPoint[]>,
): readonly PaperDecision[] => decisions.map((decision) => evaluatePaperDecision(
    decision,
    histories.get(decisionReviewHistoryKey(decision.symbol, decision.market)) ?? [],
    histories.get(decisionReviewHistoryKey(decision.benchmark.symbol, decision.market)) ?? [],
));

const average = (values: readonly number[]): number | null =>
    values.length === 0
        ? null
        : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));

const decisionReviewEvidenceLevel = (sampleSize: number): DecisionReviewEvidenceLevel =>
    sampleSize === 0 ? 'unavailable'
        : sampleSize < 5 ? 'insufficient'
            : sampleSize < 20 ? 'preliminary'
                : 'established';

const decisionReviewResult = (decision: PaperDecision): DecisionReviewResult | null => {
    const marketReturnPercent = paperDecisionMarketMovePercent(decision);
    if (marketReturnPercent === null) return null;
    const benchmarkReturnPercent = decision.benchmark.entryPrice === null || decision.benchmark.outcomePrice === null
        ? null
        : percentMove(decision.benchmark.entryPrice, decision.benchmark.outcomePrice);
    return {
        decision,
        marketReturnPercent,
        benchmarkReturnPercent,
        relativeReturnPercent: benchmarkReturnPercent === null
            ? null
            : Number((marketReturnPercent - benchmarkReturnPercent).toFixed(2)),
        decisionEffectPercent: decision.action === 'act' ? marketReturnPercent : -marketReturnPercent,
    };
};

const decisionReviewGroups = (
    results: readonly DecisionReviewResult[],
    labels: readonly string[],
    select: (result: DecisionReviewResult) => string,
): readonly DecisionReviewGroup[] => labels.map((label) => {
    const entries = results.filter((result) => select(result) === label);
    const evidenceLevel = decisionReviewEvidenceLevel(entries.length);
    const publishStatistics = entries.length >= 5;
    const relativeReturns = entries.flatMap((entry) =>
        entry.relativeReturnPercent === null ? [] : [entry.relativeReturnPercent]);
    return {
        label,
        sampleSize: entries.length,
        evidenceLevel,
        averageRelativeReturnPercent: publishStatistics ? average(relativeReturns) : null,
        averageDecisionEffectPercent: publishStatistics
            ? average(entries.map((entry) => entry.decisionEffectPercent))
            : null,
        favorableDecisionRatePercent: publishStatistics
            ? Math.round((entries.filter((entry) => entry.decisionEffectPercent > 0).length / entries.length) * 100)
            : null,
    };
}).filter((group) => group.sampleSize > 0);

export const buildDecisionReviewAnalytics = (
    decisions: readonly PaperDecision[],
): DecisionReviewAnalytics => {
    const results = decisions.flatMap((decision) => {
        const result = decisionReviewResult(decision);
        return result ? [result] : [];
    });
    const benchmarked = results.flatMap((result) =>
        result.relativeReturnPercent === null ? [] : [result.relativeReturnPercent]);
    return {
        resolvedCount: results.length,
        benchmarkedCount: benchmarked.length,
        evidenceLevel: decisionReviewEvidenceLevel(benchmarked.length),
        averageRelativeReturnPercent: average(benchmarked),
        results,
        byAction: decisionReviewGroups(results, ['act', 'pass'], (result) => result.decision.action),
        byConfidence: decisionReviewGroups(results, ['high', 'medium', 'low', 'unknown'], (result) => result.decision.confidence ?? 'unknown'),
        byHorizon: decisionReviewGroups(results, decisionReviewHorizons, (result) => result.decision.horizon),
    };
};
