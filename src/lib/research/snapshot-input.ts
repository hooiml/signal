import { researchBenchmarkReturnBases, researchBenchmarkStatuses, type ResearchSnapshot } from '../types/research-snapshot';

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

const isChartPoint = (value: unknown) => isRecord(value)
    && typeof value.time === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value.time)
    && ['open', 'high', 'low', 'close'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))
    && hasNullableNumbers(value, [
        'volume', 'ma50', 'ma200', 'averageVolume20', 'rsi14',
        'macd', 'macdSignal', 'macdHistogram', 'atrPercent14',
    ]);

const isResearchChart = (value: unknown): value is ResearchSnapshot['chart'] => isRecord(value)
    && value.interval === '1d'
    && Array.isArray(value.points)
    && value.points.every(isChartPoint);

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
