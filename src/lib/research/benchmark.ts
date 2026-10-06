import type { ResearchBenchmark } from '../types/research-snapshot';
import type { YahooResearchResult } from './yahoo-research';

type BenchmarkYahooData = Pick<YahooResearchResult, 'history'>;

const baselineSymbol = 'VOO' as const;
const baselineName = 'Vanguard S&P 500 ETF' as const;
const period = '1Y' as const;

export const notApplicableResearchBenchmark: ResearchBenchmark = {
    baselineSymbol,
    baselineName,
    period,
    candidateReturnPercent: null,
    baselineReturnPercent: null,
    relativeReturnPercent: null,
    returnBasis: null,
    status: 'not-applicable',
};

const unavailableResearchBenchmark: ResearchBenchmark = {
    ...notApplicableResearchBenchmark,
    status: 'unavailable',
};

const returnPercent = (values: readonly number[]): number | null => {
    const first = values[0];
    const last = values.at(-1);
    if (first === undefined || last === undefined || first <= 0) return null;
    return Number((((last - first) / first) * 100).toFixed(1));
};

const statusForRelativeReturn = (relativeReturnPercent: number): ResearchBenchmark['status'] => {
    if (relativeReturnPercent > 0.1) return 'outperformed';
    if (relativeReturnPercent < -0.1) return 'lagged';
    return 'in-line';
};

export const buildResearchBenchmark = (
    candidate: BenchmarkYahooData | null,
    baseline: BenchmarkYahooData | null,
): ResearchBenchmark => {
    if (candidate === null || baseline === null) return unavailableResearchBenchmark;

    const candidateRows = new Map((candidate.history.observations ?? []).map(row => [row.date, row]));
    const baselineRows = new Map((baseline.history.observations ?? []).map(row => [row.date, row]));
    const common = [...candidateRows.keys()].filter(date => baselineRows.has(date)).sort();
    const positive = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
    const aligned = (adjusted: boolean) => common.flatMap(date => {
        const a = candidateRows.get(date), b = baselineRows.get(date);
        const left = adjusted ? a?.adjustedClose : a?.close;
        const right = adjusted ? b?.adjustedClose : b?.close;
        return positive(left) && positive(right) ? [{ date, left, right }] : [];
    });
    const adequate = (rows: ReturnType<typeof aligned>) => {
        if (rows.length < 20) return false;
        const days = (Date.parse(rows.at(-1)!.date) - Date.parse(rows[0].date)) / 86_400_000;
        return days >= 30 && rows.length >= Math.floor(days * 5 / 7) * 0.8;
    };
    const adjusted = aligned(true);
    const useAdjustedCloses = adequate(adjusted);
    const rows = useAdjustedCloses ? adjusted : aligned(false);
    const returnBasis = useAdjustedCloses ? 'adjusted close' : 'close';
    const windowStart = rows[0]?.date ?? null, windowEnd = rows.at(-1)?.date ?? null;
    const window = { windowStart, windowEnd, commonSessions: rows.length };
    if (!adequate(rows)) return { ...unavailableResearchBenchmark, ...window, returnBasis };
    const candidateReturnPercent = returnPercent(rows.map(row => row.left))!;
    const baselineReturnPercent = returnPercent(rows.map(row => row.right))!;

    const relativeReturnPercent = Number((candidateReturnPercent - baselineReturnPercent).toFixed(1));
    return {
        baselineSymbol,
        baselineName,
        period,
        ...window,
        candidateReturnPercent,
        baselineReturnPercent,
        relativeReturnPercent,
        returnBasis,
        status: statusForRelativeReturn(relativeReturnPercent),
    };
};
