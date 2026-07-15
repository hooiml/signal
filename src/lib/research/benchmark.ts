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

    const useAdjustedCloses = candidate.history.adjustedCloses.length >= 2
        && baseline.history.adjustedCloses.length >= 2;
    const returnBasis = useAdjustedCloses ? 'adjusted close' : 'close';
    const candidateValues = useAdjustedCloses ? candidate.history.adjustedCloses : candidate.history.closes;
    const baselineValues = useAdjustedCloses ? baseline.history.adjustedCloses : baseline.history.closes;
    const candidateReturnPercent = returnPercent(candidateValues);
    const baselineReturnPercent = returnPercent(baselineValues);
    if (candidateReturnPercent === null || baselineReturnPercent === null) {
        return { ...unavailableResearchBenchmark, returnBasis };
    }

    const relativeReturnPercent = Number((candidateReturnPercent - baselineReturnPercent).toFixed(1));
    return {
        baselineSymbol,
        baselineName,
        period,
        candidateReturnPercent,
        baselineReturnPercent,
        relativeReturnPercent,
        returnBasis,
        status: statusForRelativeReturn(relativeReturnPercent),
    };
};
