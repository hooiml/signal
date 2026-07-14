import type {
    DiscoveryCategory,
    DiscoveryCatalyst,
    DiscoveryContender,
    DiscoveryResponse,
    EarlyTrendStage,
    InstitutionalOwnershipBuyer,
    InstitutionalOwnershipEvidence,
    QualityDiscoveryResult,
    ValuationGuardrail,
} from '@/lib/types/research-discovery';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNullableNumber = (value: unknown) => value === null || typeof value === 'number';
const discoveryCategories: readonly DiscoveryCategory[] = ['quality compounder', 'cyclical acceleration', 'turnaround', 'momentum only', 'fundamentally unsupported', 'unconfirmed'];
const earlyTrendStages: readonly EarlyTrendStage[] = ['emerging', 'confirmed', 'extended', 'not ready'];
const valuationGuardrails: readonly ValuationGuardrail[] = ['attractive', 'fair', 'expensive', 'extreme', 'unavailable'];
const isListedValue = <T extends string>(value: unknown, values: readonly T[]): value is T =>
    typeof value === 'string' && values.some((candidate) => candidate === value);

const isCatalyst = (value: unknown): value is DiscoveryCatalyst => {
    if (!isRecord(value)) return false;
    return typeof value.date === 'string' && value.type === 'earnings'
        && (value.timing === 'pre-market' || value.timing === 'after-hours' || value.timing === 'time-not-supplied')
        && (value.fiscalQuarterEnding === null || typeof value.fiscalQuarterEnding === 'string')
        && (value.epsForecast === null || typeof value.epsForecast === 'string')
        && value.source === 'Nasdaq earnings calendar';
};

const isBuyer = (value: unknown): value is InstitutionalOwnershipBuyer => {
    if (!isRecord(value)) return false;
    return typeof value.name === 'string' && typeof value.reportDate === 'string'
        && typeof value.sharesHeld === 'number' && typeof value.sharesAdded === 'number'
        && isNullableNumber(value.positionChangePercent) && typeof value.newPosition === 'boolean'
        && isNullableNumber(value.marketValueThousands)
        && (value.sourceUrl === null || typeof value.sourceUrl === 'string');
};

const isOwnership = (value: unknown): value is InstitutionalOwnershipEvidence => {
    if (!isRecord(value)) return false;
    return (value.activity === 'increases-led' || value.activity === 'mixed' || value.activity === 'decreases-led')
        && isNullableNumber(value.institutionalOwnershipPercent)
        && isNullableNumber(value.increasedShares) && isNullableNumber(value.decreasedShares)
        && (value.reportPeriod === null || typeof value.reportPeriod === 'string')
        && Array.isArray(value.buyers) && value.buyers.every(isBuyer)
        && value.source === 'Nasdaq institutional holdings' && typeof value.sourceUrl === 'string';
};

const isCandidate = (value: unknown): value is QualityDiscoveryResult => {
    if (!isRecord(value)) return false;
    return typeof value.symbol === 'string' && typeof value.name === 'string'
        && typeof value.price === 'number' && typeof value.trendScore === 'number'
        && typeof value.riskScore === 'number' && (value.risk === 'low' || value.risk === 'moderate' || value.risk === 'high')
        && typeof value.momentum3MonthPercent === 'number' && typeof value.momentum6MonthPercent === 'number'
        && isNullableNumber(value.qualityScore) && typeof value.discoveryScore === 'number'
        && isListedValue(value.category, discoveryCategories)
        && typeof value.sector === 'string' && typeof value.sectorRelativeStrengthPercent === 'number'
        && isNullableNumber(value.scoreChange1Day) && isNullableNumber(value.scoreChange1Week)
        && isNullableNumber(value.scoreChange1Month) && isNullableNumber(value.rankChange1Week)
        && typeof value.firstSeenAt === 'string' && isListedValue(value.earlyTrendStage, earlyTrendStages)
        && isRecord(value.valuation) && isListedValue(value.valuation.guardrail, valuationGuardrails)
        && isNullableNumber(value.valuation.priceEarnings) && isNullableNumber(value.valuation.priceSales)
        && isNullableNumber(value.valuation.freeCashFlowYieldPercent)
        && (value.catalyst === null || isCatalyst(value.catalyst))
        && (value.ownership === null || isOwnership(value.ownership))
        && Array.isArray(value.reasons) && value.reasons.every((reason) => typeof reason === 'string')
        && Array.isArray(value.qualityReasons) && value.qualityReasons.every((reason) => typeof reason === 'string')
        && Array.isArray(value.flags) && value.flags.every((flag) => typeof flag === 'string');
};

const isContender = (value: unknown): value is DiscoveryContender => {
    if (!isCandidate(value) || !isRecord(value)) return false;
    return typeof Object.fromEntries(Object.entries(value)).contenderReason === 'string';
};

export const parseDiscoveryResponseV6 = (payload: unknown): DiscoveryResponse => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) throw new Error('Invalid trend discovery response.');
    const data = payload.data;
    if (typeof data.generatedAt !== 'string' || typeof data.universeSize !== 'number' || typeof data.scannedCount !== 'number'
        || !Array.isArray(data.candidates) || !data.candidates.every(isCandidate)
        || !Array.isArray(data.contenders) || !data.contenders.every(isContender)
        || !Array.isArray(data.emergingCandidates) || !data.emergingCandidates.every(isCandidate)
        || !Array.isArray(data.performance) || !data.performance.every((item) => isRecord(item)
            && (item.period === '1D' || item.period === '1W' || item.period === '1M')
            && isNullableNumber(item.averageReturnPercent) && typeof item.trackedCount === 'number' && typeof item.winnerCount === 'number')
        || typeof data.historySnapshotCount !== 'number'
        || !Array.isArray(data.warnings) || !data.warnings.every((warning) => typeof warning === 'string')) {
        throw new Error('Invalid trend discovery data.');
    }
    return {
        generatedAt: data.generatedAt,
        universeSize: data.universeSize,
        scannedCount: data.scannedCount,
        candidates: data.candidates,
        contenders: data.contenders,
        emergingCandidates: data.emergingCandidates,
        performance: data.performance,
        historySnapshotCount: data.historySnapshotCount,
        warnings: data.warnings,
    };
};
