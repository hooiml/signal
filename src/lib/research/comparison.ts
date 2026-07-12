import type { ResearchSnapshot } from '../types/research-snapshot';

export type ComparisonMetrics = {
    readonly price: string;
    readonly dailyChange: string;
    readonly revenueGrowth: string;
    readonly operatingMargin: string;
    readonly priceEarnings: string;
    readonly priceSales: string;
    readonly freeCashFlowYield: string;
    readonly rsi: string;
    readonly versusMa50: string;
    readonly versusMa200: string;
};

const number = (value: number | null, suffix = '', digits = 1) =>
    value === null ? 'Unavailable' : `${value.toFixed(digits)}${suffix}`;

const price = (value: number | null, currency: string | null) => {
    if (value === null) return 'Unavailable';
    if (currency === 'USD') return `$${value.toFixed(2)}`;
    if (currency === 'MYR') return `RM ${value.toFixed(2)}`;
    return `${currency ? currency + ' ' : ''}${value.toFixed(2)}`;
};

const distance = (current: number | null, average: number | null) => {
    if (current === null || average === null || average === 0) return 'Unavailable';
    const value = ((current - average) / average) * 100;
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export const buildComparisonMetrics = (snapshot: ResearchSnapshot): ComparisonMetrics => ({
    price: price(snapshot.quote.price, snapshot.quote.currency),
    dailyChange: snapshot.quote.dailyChangePercent === null
        ? 'Unavailable'
        : `${snapshot.quote.dailyChangePercent >= 0 ? '+' : ''}${snapshot.quote.dailyChangePercent.toFixed(2)}%`,
    revenueGrowth: number(snapshot.fundamentals.revenueGrowthPercent, '%'),
    operatingMargin: number(snapshot.fundamentals.operatingMarginPercent, '%'),
    priceEarnings: number(snapshot.valuation.priceEarnings, 'x'),
    priceSales: number(snapshot.valuation.priceSales, 'x'),
    freeCashFlowYield: number(snapshot.valuation.freeCashFlowYieldPercent, '%'),
    rsi: number(snapshot.technicals.rsi14),
    versusMa50: distance(snapshot.quote.price, snapshot.technicals.ma50),
    versusMa200: distance(snapshot.quote.price, snapshot.technicals.ma200),
});
