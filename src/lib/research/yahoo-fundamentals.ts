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

export type DatedOrdinaryShares = {
    readonly count: number;
    readonly date: string;
    readonly source: 'Yahoo Finance';
};

export type YahooFundamentalHistory = {
    readonly history: readonly ResearchFundamentalPeriod[];
    readonly ordinaryShares: DatedOrdinaryShares | null;
    readonly historyError: string | null;
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
            || (!(value.meta.type[0] in seriesToField)
                && value.meta.type[0] !== 'annualOrdinarySharesNumber'
                && value.meta.type[0] !== 'quarterlyOrdinarySharesNumber')) {
            throw new Error('Yahoo Finance returned an invalid fundamentals series.');
        }
        if (!(value.meta.type[0] in seriesToField)) continue;
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
        const previousEntry = sorted[index + 1];
        const previous = previousEntry?.[1] ?? null;
        const elapsedDays = previousEntry ? (Date.parse(reportingPeriod) - Date.parse(previousEntry[0])) / 86_400_000 : NaN;
        // Allow 52/53-week fiscal years, but never a missing year or changed short period.
        const comparableAnnual = elapsedDays >= 350 && elapsedDays <= 380;
        return {
            reportingPeriod,
            comparisonPeriod: previousEntry?.[0] ?? null,
            comparisonRevenue: previous?.annualRevenue ?? null,
            comparisonShares: previous?.shares ?? null,
            comparableAnnual,
            shareBasis: 'diluted average',
            currency: expectedCurrency,
            source: 'Yahoo Finance',
            annualRevenue: period.annualRevenue,
            revenueGrowthPercent: comparableAnnual ? change(period.annualRevenue, previous?.annualRevenue ?? null) : null,
            grossMarginPercent: ratio(period.grossProfit, period.annualRevenue),
            operatingMarginPercent: ratio(period.operatingIncome, period.annualRevenue),
            annualNetIncome: period.annualNetIncome,
            freeCashFlow: period.freeCashFlow,
            debt: period.debt,
            cash: period.cash,
            shares: period.shares,
            shareChangePercent: comparableAnnual ? change(period.shares, previous?.shares ?? null) : null,
        };
    });
};

const isReportingDate = (value: unknown): value is string => typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Extract a dated ordinary-share count; diluted averages and issued/treasury values are excluded. */
export const parseYahooDatedOrdinaryShares = (
    payload: unknown,
    expectedSymbol: string,
    expectedCurrency: string,
    asOf = new Date(),
): DatedOrdinaryShares | null => {
    if (!isRecord(payload) || !isRecord(payload.timeseries) || !Array.isArray(payload.timeseries.result)
        || (payload.timeseries.error !== undefined && payload.timeseries.error !== null)) return null;
    const asOfDate = asOf.toISOString().slice(0, 10);
    const candidates: DatedOrdinaryShares[] = [];
    for (const value of payload.timeseries.result) {
        if (!isRecord(value) || !isRecord(value.meta) || !Array.isArray(value.meta.type)
            || value.meta.type.length !== 1 || !Array.isArray(value.meta.symbol)
            || value.meta.symbol.length !== 1 || value.meta.symbol[0] !== expectedSymbol) continue;
        const seriesName = value.meta.type[0];
        if (seriesName !== 'annualOrdinarySharesNumber' && seriesName !== 'quarterlyOrdinarySharesNumber') continue;
        const entries = value[seriesName];
        if (!Array.isArray(entries)) continue;
        const expectedPeriod = seriesName === 'annualOrdinarySharesNumber' ? '12M' : '3M';
        for (const entry of entries) {
            if (!isRecord(entry) || !isReportingDate(entry.asOfDate) || entry.asOfDate > asOfDate
                || entry.periodType !== expectedPeriod || entry.currencyCode !== expectedCurrency
                || !isRecord(entry.reportedValue) || typeof entry.reportedValue.raw !== 'number'
                || !Number.isSafeInteger(entry.reportedValue.raw) || entry.reportedValue.raw <= 0) continue;
            candidates.push({ count: entry.reportedValue.raw, date: entry.asOfDate, source: 'Yahoo Finance' });
        }
    }
    candidates.sort((left, right) => right.date.localeCompare(left.date));
    const latestDate = candidates[0]?.date;
    if (!latestDate) return null;
    const latestCounts = new Set(candidates.filter(candidate => candidate.date === latestDate).map(candidate => candidate.count));
    return latestCounts.size === 1 ? candidates[0] ?? null : null;
};

const requestedSeries = Object.keys(seriesToField).join(',');

export const fetchYahooFundamentalHistory = async (
    symbol: string,
    market: ResearchMarket,
): Promise<YahooFundamentalHistory> => {
    const providerSymbol = toYahooSymbol(symbol, market);
    const period2 = Math.floor(Date.now() / 1_000);
    const period1 = period2 - 10 * 366 * 24 * 60 * 60;
    const query = new URLSearchParams({
        symbol: providerSymbol,
        type: `${requestedSeries},annualOrdinarySharesNumber,quarterlyOrdinarySharesNumber`,
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
            signal: AbortSignal.timeout(15_000),
        },
    );
    if (!response.ok) throw new Error(`Yahoo Finance fundamentals request failed (${response.status}).`);
    const payload: unknown = await response.json();
    let history: readonly ResearchFundamentalPeriod[] = [];
    let historyError: string | null = null;
    try {
        history = parseYahooFundamentalTimeseries(payload, market === 'MY' ? 'MYR' : 'USD');
    } catch (error) {
        historyError = error instanceof Error ? error.message : 'Yahoo Finance annual fundamentals are invalid.';
    }
    return {
        history,
        ordinaryShares: market === 'MY' ? parseYahooDatedOrdinaryShares(payload, providerSymbol, 'MYR') : null,
        historyError,
    };
};
