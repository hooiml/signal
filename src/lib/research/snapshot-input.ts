import { researchBenchmarkReturnBases, researchBenchmarkStatuses, type ResearchSnapshot } from '../types/research-snapshot';
import type { ResearchQuoteBatchResult } from '../types/research-quote';

export class ResearchSnapshotInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchSnapshotInputError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isNullableNumber = (value: unknown) =>
    value === null || (typeof value === 'number' && Number.isFinite(value));

const isNullableString = (value: unknown) => value === null || typeof value === 'string';

const isResearchQuote = (value: unknown): value is ResearchSnapshot['quote'] => {
    if (!isRecord(value)) return false;
    return isNullableString(value.name)
        && isNullableString(value.currency)
        && hasNullableNumbers(value, ['price', 'dailyChangePercent']);
};

const isBenchmarkStatus = (value: unknown) => typeof value === 'string' && researchBenchmarkStatuses.some((status) => status === value);
const isBenchmarkReturnBasis = (value: unknown) => typeof value === 'string' && researchBenchmarkReturnBases.some((basis) => basis === value);

const hasNullableNumbers = (value: Record<string, unknown>, keys: readonly string[]) =>
    keys.every((key) => isNullableNumber(value[key]));

const isFundamentalPeriod = (value: unknown): value is ResearchSnapshot['fundamentals']['history'][number] =>
    isRecord(value)
    && typeof value.reportingPeriod === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.reportingPeriod)
    && typeof value.currency === 'string'
    && value.currency.length >= 3
    && value.currency.length <= 8
    && (value.source === 'SEC EDGAR' || value.source === 'Yahoo Finance')
    && hasNullableNumbers(value, [
        'annualRevenue', 'revenueGrowthPercent', 'grossMarginPercent', 'operatingMarginPercent',
        'annualNetIncome', 'freeCashFlow', 'debt', 'cash', 'shares', 'shareChangePercent',
    ]);

const isChartPoint = (value: unknown) => isRecord(value)
    && typeof value.time === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.time)
    && ['open', 'high', 'low', 'close'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))
    && hasNullableNumbers(value, [
        'volume', 'ma50', 'ma200', 'ema20', 'ema50', 'sma200', 'averageVolume20', 'rsi14',
        'macd', 'macdSignal', 'macdHistogram', 'atr14', 'atrPercent14', 'anchoredVwap',
        'adx14', 'plusDi14', 'minusDi14', 'supertrend',
    ]);

const isSupertrendDirection = (value: unknown): value is 1 | -1 | null => value === null || value === 1 || value === -1;

const isResearchChart = (value: unknown): value is ResearchSnapshot['chart'] => isRecord(value)
    && value.interval === '1d'
    && Array.isArray(value.points)
    && value.points.every((point) => isChartPoint(point) && isSupertrendDirection(point.supertrendDirection));

const isResearchSnapshot = (value: unknown): value is ResearchSnapshot => {
    if (!isRecord(value) || !isRecord(value.benchmark) || !isRecord(value.quote) || !isRecord(value.fundamentals)
        || !isRecord(value.valuation) || !isRecord(value.technicals) || !isRecord(value.chart)) return false;
    return typeof value.symbol === 'string'
        && (value.market === 'US' || value.market === 'MY')
        && typeof value.fetchedAt === 'string'
        && value.benchmark.baselineSymbol === 'VOO'
        && value.benchmark.baselineName === 'Vanguard S&P 500 ETF'
        && value.benchmark.period === '1Y'
        && hasNullableNumbers(value.benchmark, ['candidateReturnPercent', 'baselineReturnPercent', 'relativeReturnPercent'])
        && (value.benchmark.returnBasis === null || isBenchmarkReturnBasis(value.benchmark.returnBasis))
        && isBenchmarkStatus(value.benchmark.status)
        && isNullableString(value.quote.name)
        && isNullableString(value.quote.currency)
        && hasNullableNumbers(value.quote, ['price', 'dailyChangePercent'])
        && hasNullableNumbers(value.fundamentals, [
            'revenueGrowthPercent', 'grossMarginPercent', 'operatingMarginPercent', 'freeCashFlow',
            'debt', 'cash', 'shares', 'annualRevenue', 'annualNetIncome', 'shareChangePercent',
        ])
        && isNullableString(value.fundamentals.reportingPeriod)
        && (value.fundamentals.source === null || value.fundamentals.source === 'SEC EDGAR' || value.fundamentals.source === 'Yahoo Finance')
        && Array.isArray(value.fundamentals.history)
        && value.fundamentals.history.length <= 5
        && value.fundamentals.history.every(isFundamentalPeriod)
        && new Set(value.fundamentals.history.map((period) => period.reportingPeriod)).size === value.fundamentals.history.length
        && hasNullableNumbers(value.valuation, [
            'marketCap', 'priceEarnings', 'priceSales', 'freeCashFlowYieldPercent', 'netCash',
        ])
        && isNullableString(value.valuation.reportingPeriod)
        && isNullableString(value.valuation.source)
        && hasNullableNumbers(value.technicals, [
            'ma50', 'ma200', 'rsi14', 'macd', 'low52Week', 'high52Week',
            'averageVolume20', 'support', 'resistance',
        ])
        && isResearchChart(value.chart)
        && Array.isArray(value.sources) && value.sources.every((source) => typeof source === 'string')
        && Array.isArray(value.warnings) && value.warnings.every((warning) => typeof warning === 'string');
};

export const parseResearchSnapshotResponse = (payload: unknown): ResearchSnapshot => {
    if (!isRecord(payload)) throw new ResearchSnapshotInputError('Invalid research snapshot response.');
    if (payload.success !== true || !isResearchSnapshot(payload.data)) {
        throw new ResearchSnapshotInputError(typeof payload.error === 'string' ? payload.error : 'Unable to load free-source data.');
    }
    return payload.data;
};

export const parseResearchChartResponse = (payload: unknown): ResearchSnapshot['chart'] => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data) || !isResearchChart(payload.data.chart)) {
        throw new ResearchSnapshotInputError(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Unable to load chart history.');
    }
    return payload.data.chart;
};

export const parseResearchQuoteResponse = (payload: unknown): ResearchSnapshot['quote'] => {
    if (!isRecord(payload) || !isRecord(payload.data) || !isResearchQuote(payload.data.quote)) {
        throw new ResearchSnapshotInputError(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Unable to load live quote.');
    }
    return payload.data.quote;
};

const isQuoteBatchResult = (value: unknown): value is ResearchQuoteBatchResult => {
    if (!isRecord(value) || typeof value.success !== 'boolean') return false;
    if (value.success) {
        return isRecord(value.data)
            && typeof value.data.symbol === 'string'
            && (value.data.market === 'US' || value.data.market === 'MY')
            && typeof value.data.providerSymbol === 'string'
            && typeof value.data.fetchedAt === 'string'
            && isResearchQuote(value.data.quote);
    }
    return typeof value.symbol === 'string'
        && (value.market === 'US' || value.market === 'MY')
        && typeof value.error === 'string';
};

export const parseResearchQuoteBatchResponse = (payload: unknown): readonly ResearchQuoteBatchResult[] => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
        || typeof payload.data.fetchedAt !== 'string'
        || !Array.isArray(payload.data.items)
        || payload.data.items.length > 50
        || !payload.data.items.every(isQuoteBatchResult)) {
        throw new ResearchSnapshotInputError(
            isRecord(payload) && typeof payload.error === 'string'
                ? payload.error
                : 'Unable to load live quotes.',
        );
    }
    return payload.data.items;
};
