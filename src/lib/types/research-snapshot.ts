import type { ResearchMarket } from './research';

export const researchBenchmarkStatuses = ['outperformed', 'lagged', 'in-line', 'unavailable', 'not-applicable'] as const;
export const researchBenchmarkReturnBases = ['adjusted close', 'close'] as const;

export type ResearchBenchmarkStatus = typeof researchBenchmarkStatuses[number];
export type ResearchBenchmarkReturnBasis = typeof researchBenchmarkReturnBases[number];

export type ResearchBenchmark = {
    readonly baselineSymbol: 'VOO';
    readonly baselineName: 'Vanguard S&P 500 ETF';
    readonly period: '1Y';
    readonly candidateReturnPercent: number | null;
    readonly baselineReturnPercent: number | null;
    readonly relativeReturnPercent: number | null;
    readonly returnBasis: ResearchBenchmarkReturnBasis | null;
    readonly status: ResearchBenchmarkStatus;
};

export type ResearchChartPoint = {
    readonly time: string;
    readonly open: number;
    readonly high: number;
    readonly low: number;
    readonly close: number;
    readonly volume: number | null;
    readonly ma50: number | null;
    readonly ma200: number | null;
    readonly averageVolume20: number | null;
    readonly rsi14: number | null;
    readonly macd: number | null;
    readonly macdSignal: number | null;
    readonly macdHistogram: number | null;
    readonly atrPercent14: number | null;
};

export type ResearchSnapshot = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly fetchedAt: string;
    readonly benchmark: ResearchBenchmark;
    readonly quote: {
        readonly name: string | null;
        readonly currency: string | null;
        readonly price: number | null;
        readonly dailyChangePercent: number | null;
    };
    readonly fundamentals: {
        readonly revenueGrowthPercent: number | null;
        readonly grossMarginPercent: number | null;
        readonly operatingMarginPercent: number | null;
        readonly freeCashFlow: number | null;
        readonly debt: number | null;
        readonly cash: number | null;
        readonly shares: number | null;
        readonly annualRevenue: number | null;
        readonly annualNetIncome: number | null;
        readonly reportingPeriod: string | null;
        readonly shareChangePercent: number | null;
    };
    readonly valuation: {
        readonly marketCap: number | null;
        readonly priceEarnings: number | null;
        readonly priceSales: number | null;
        readonly freeCashFlowYieldPercent: number | null;
        readonly netCash: number | null;
        readonly reportingPeriod: string | null;
        readonly source: string | null;
    };
    readonly technicals: {
        readonly ma50: number | null;
        readonly ma200: number | null;
        readonly rsi14: number | null;
        readonly macd: number | null;
        readonly low52Week: number | null;
        readonly high52Week: number | null;
        readonly averageVolume20: number | null;
        readonly support: number | null;
        readonly resistance: number | null;
    };
    readonly chart: {
        readonly interval: '1d';
        readonly points: readonly ResearchChartPoint[];
    };
    readonly sources: readonly string[];
    readonly warnings: readonly string[];
};
