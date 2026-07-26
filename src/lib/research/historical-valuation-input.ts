import {
    historicalValuationCapabilityStatuses,
    type HistoricalValuationFact,
    type HistoricalValuationMetric,
    type HistoricalValuationObservation,
    type HistoricalValuationReport,
} from '../types/historical-valuation';

export class HistoricalValuationInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'HistoricalValuationInputError';
    }
}

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
const nullableNumber = (value: unknown): value is number | null =>
    value === null || (typeof value === 'number' && Number.isFinite(value));
const isoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const boundedString = (value: unknown, maximum = 2_000): value is string => typeof value === 'string' && value.length <= maximum;

const isMetric = (value: unknown): value is HistoricalValuationMetric => {
    const metric = objectValue(value);
    return Boolean(metric)
        && nullableNumber(metric?.value)
        && boundedString(metric?.formula, 300)
        && (metric?.unavailableReason === null || boundedString(metric?.unavailableReason, 500));
};

const isFact = (value: unknown): value is HistoricalValuationFact => {
    const fact = objectValue(value);
    return Boolean(fact)
        && boundedString(fact?.label, 100)
        && boundedString(fact?.concept, 150)
        && typeof fact?.value === 'number'
        && Number.isFinite(fact.value)
        && (fact.unit === 'USD' || fact.unit === 'shares')
        && isoDate(fact.fiscalStart)
        && isoDate(fact.fiscalEnd)
        && isoDate(fact.filedAt)
        && typeof fact.accession === 'string'
        && /^\d{10}-\d{2}-\d{6}$/.test(fact.accession);
};

const isObservation = (value: unknown): value is HistoricalValuationObservation => {
    const observation = objectValue(value);
    if (!observation) return false;
    return boundedString(observation.id, 100)
        && isoDate(observation.fiscalPeriodStart)
        && isoDate(observation.fiscalPeriodEnd)
        && isoDate(observation.filedAt)
        && (observation.priceDate === null || isoDate(observation.priceDate))
        && nullableNumber(observation.price)
        && (observation.priceCurrency === null || (typeof observation.priceCurrency === 'string' && /^[A-Z]{3}$/.test(observation.priceCurrency)))
        && boundedString(observation.priceConvention, 500)
        && [
            'reportedDilutedShares', 'splitAdjustmentFactor', 'splitAdjustedShares', 'marketCapitalization',
            'annualRevenue', 'annualNetIncome', 'operatingCashFlow', 'capitalExpenditure', 'freeCashFlow',
        ].every((key) => nullableNumber(observation[key]))
        && isMetric(observation.priceEarnings)
        && isMetric(observation.priceSales)
        && isMetric(observation.freeCashFlowYield)
        && (observation.form === '10-K' || observation.form === '10-K/A')
        && typeof observation.accession === 'string'
        && /^\d{10}-\d{2}-\d{6}$/.test(observation.accession)
        && typeof observation.isAmendment === 'boolean'
        && ['original', 'amended-baseline-unavailable', 'amended-unchanged', 'amended-values-changed'].includes(String(observation.restatementStatus))
        && typeof observation.filingUrl === 'string'
        && /^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(observation.filingUrl)
        && Array.isArray(observation.facts)
        && observation.facts.length <= 5
        && observation.facts.every(isFact)
        && Array.isArray(observation.gaps)
        && observation.gaps.length <= 3
        && observation.gaps.every((gap) => boundedString(gap, 500));
};

const isCapability = (value: unknown) => {
    const capability = objectValue(value);
    return Boolean(capability)
        && historicalValuationCapabilityStatuses.some((status) => status === capability?.status)
        && boundedString(capability?.detail, 1_000);
};

const isReport = (value: unknown): value is HistoricalValuationReport => {
    const report = objectValue(value);
    const capabilities = objectValue(report?.capabilities);
    const observations = Array.isArray(report?.observations) ? report.observations : [];
    return Boolean(report)
        && typeof report?.symbol === 'string'
        && /^[A-Z0-9.-]{1,15}$/.test(report.symbol)
        && (report.market === 'US' || report.market === 'MY')
        && (report.companyName === null || boundedString(report.companyName, 200))
        && typeof report.generatedAt === 'string'
        && Number.isFinite(Date.parse(report.generatedAt))
        && report.observationKind === 'filing observation'
        && boundedString(report.priceConvention, 500)
        && Boolean(capabilities)
        && isCapability(capabilities?.historicalPrices)
        && isCapability(capabilities?.periodCorrectFundamentals)
        && isCapability(capabilities?.analystEstimateRevisions)
        && observations.length <= 8
        && observations.every(isObservation)
        && new Set(observations.map((observation) => objectValue(observation)?.id)).size === observations.length
        && Array.isArray(report.sources)
        && report.sources.length <= 3
        && report.sources.every((source) => {
            const item = objectValue(source);
            return Boolean(item)
                && boundedString(item?.name, 100)
                && typeof item?.url === 'string'
                && /^https:\/\/(?:www\.)?(?:sec\.gov|data\.sec\.gov|finance\.yahoo\.com)\//.test(item.url)
                && boundedString(item?.detail, 500);
        })
        && Array.isArray(report.warnings)
        && report.warnings.length <= 5
        && report.warnings.every((warning) => boundedString(warning, 1_000));
};

export const parseHistoricalValuationResponse = (payload: unknown): HistoricalValuationReport => {
    const root = objectValue(payload);
    if (!root || root.success !== true || !isReport(root.data)) {
        throw new HistoricalValuationInputError(
            root && typeof root.error === 'string' ? root.error : 'Historical valuation response is invalid.',
        );
    }
    return root.data;
};
