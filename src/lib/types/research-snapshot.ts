import type { ResearchMarket } from './research';

export type ResearchSnapshot = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly fetchedAt: string;
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
    readonly sources: readonly string[];
    readonly warnings: readonly string[];
};
