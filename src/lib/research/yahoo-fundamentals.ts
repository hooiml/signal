import type { ResearchMarket } from '../types/research';
import type { ResearchFundamentalPeriod } from '../types/research-snapshot';
import { toYahooSymbol } from './yahoo-research';

const seriesToField = {
    annualTotalRevenue: 'annualRevenue',
    annualGrossProfit: 'grossProfit',
    annualOperatingIncome: 'operatingIncome',
    annualNetIncome: 'annualNetIncome',
    annualFreeCashFlow: 'freeCashFlow',
    annualTotalDebt: 'debt',
    annualCashCashEquivalentsAndShortTermInvestments: 'cash',
    annualDilutedAverageShares: 'shares',
} as const;

type SeriesName = keyof typeof seriesToField;
type DraftPeriod = {
    annualRevenue: number | null;
    grossProfit: number | null;
    operatingIncome: number | null;
    annualNetIncome: number | null;
    freeCashFlow: number | null;
    debt: number | null;
    cash: number | null;
    shares: number | null;
};

const emptyPeriod = (): DraftPeriod => ({
    annualRevenue: null,
    grossProfit: null,
    operatingIncome: null,
    annualNetIncome: null,
    freeCashFlow: null,
    debt: null,
    cash: null,
    shares: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const ratio = (numerator: number | null, denominator: number | null) =>
    numerator === null || denominator === null || denominator === 0
        ? null
        : Number(((numerator / denominator) * 100).toFixed(1));

const change = (current: number | null, previous: number | null) =>
    current === null || previous === null || previous === 0
        ? null
        : Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));

export const parseYahooFundamentalTimeseries = (
    payload: unknown,
    expectedCurrency: string,
): readonly ResearchFundamentalPeriod[] => {
    if (!isRecord(payload) || !isRecord(payload.timeseries)
        || !Array.isArray(payload.timeseries.result)
        || (payload.timeseries.error !== undefined && payload.timeseries.error !== null)) {
        throw new Error('Yahoo Finance returned an invalid fundamentals response.');
    }
    const periods = new Map<string, DraftPeriod>();
    for (const value of payload.timeseries.result) {
        if (!isRecord(value) || !isRecord(value.meta)
            || !Array.isArray(value.meta.type)
            || value.meta.type.length !== 1
            || typeof value.meta.type[0] !== 'string'
            || !(value.meta.type[0] in seriesToField)) {
            throw new Error('Yahoo Finance returned an invalid fundamentals series.');
        }
        const seriesName = value.meta.type[0] as SeriesName;
        const entries = value[seriesName] === undefined ? [] : value[seriesName];
        if (!Array.isArray(entries)) throw new Error('Yahoo Finance returned an invalid fundamentals series.');
        for (const entry of entries) {
            if (!isRecord(entry) || typeof entry.asOfDate !== 'string'
                || !/^\d{4}-\d{2}-\d{2}$/.test(entry.asOfDate)
                || entry.periodType !== '12M'
                || typeof entry.currencyCode !== 'string'
                || !isRecord(entry.reportedValue)
                || typeof entry.reportedValue.raw !== 'number'
                || !Number.isFinite(entry.reportedValue.raw)) {
                throw new Error('Yahoo Finance returned an invalid annual fundamental value.');
            }
            if (seriesName !== 'annualDilutedAverageShares' && entry.currencyCode !== expectedCurrency) continue;
            const period = periods.get(entry.asOfDate) ?? emptyPeriod();
            period[seriesToField[seriesName]] = entry.reportedValue.raw;
            periods.set(entry.asOfDate, period);
        }
    }
    const sorted = [...periods.entries()]
        .sort(([left], [right]) => right.localeCompare(left))
        .slice(0, 5);
    return sorted.map(([reportingPeriod, period], index): ResearchFundamentalPeriod => {
        const previous = sorted[index + 1]?.[1] ?? null;
        return {
            reportingPeriod,
            currency: expectedCurrency,
            source: 'Yahoo Finance',
            annualRevenue: period.annualRevenue,
            revenueGrowthPercent: change(period.annualRevenue, previous?.annualRevenue ?? null),
            grossMarginPercent: ratio(period.grossProfit, period.annualRevenue),
            operatingMarginPercent: ratio(period.operatingIncome, period.annualRevenue),
            annualNetIncome: period.annualNetIncome,
            freeCashFlow: period.freeCashFlow,
            debt: period.debt,
            cash: period.cash,
            shares: period.shares,
            shareChangePercent: change(period.shares, previous?.shares ?? null),
        };
    });
};

const requestedSeries = Object.keys(seriesToField).join(',');

export const fetchYahooFundamentalHistory = async (
    symbol: string,
    market: ResearchMarket,
): Promise<readonly ResearchFundamentalPeriod[]> => {
    const providerSymbol = toYahooSymbol(symbol, market);
    const period2 = Math.floor(Date.now() / 1_000);
    const period1 = period2 - 10 * 366 * 24 * 60 * 60;
    const query = new URLSearchParams({
        symbol: providerSymbol,
        type: requestedSeries,
        period1: String(period1),
        period2: String(period2),
    });
    const response = await fetch(
        `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(providerSymbol)}?${query.toString()}`,
        {
            headers: {
                Accept: 'application/json',
                'User-Agent': 'Mozilla/5.0 Signal research dashboard',
            },
            next: { revalidate: 21_600 },
        },
    );
    if (!response.ok) throw new Error(`Yahoo Finance fundamentals request failed (${response.status}).`);
    return parseYahooFundamentalTimeseries(await response.json(), market === 'MY' ? 'MYR' : 'USD');
};
