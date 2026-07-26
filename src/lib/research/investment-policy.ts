import type { ResearchRecord } from '../types/research';
import { buildEvidenceCoverage } from './evidence-coverage';

export type InvestmentPolicy = {
    readonly version: 1;
    readonly maxSingleAllocationPercent: number;
    readonly maxSectorAllocationPercent: number;
    readonly minEvidenceCoveragePercent: number;
    readonly maxReviewAgeDays: number;
    readonly requireFairOrCheapForReady: boolean;
};

export const defaultInvestmentPolicy: InvestmentPolicy = {
    version: 1,
    maxSingleAllocationPercent: 20,
    maxSectorAllocationPercent: 35,
    minEvidenceCoveragePercent: 40,
    maxReviewAgeDays: 90,
    requireFairOrCheapForReady: true,
};

export const investmentPolicyViolationKinds = [
    'single-allocation',
    'sector-allocation',
    'evidence-coverage',
    'review-age',
    'ready-valuation',
] as const;

export type InvestmentPolicyViolationKind = typeof investmentPolicyViolationKinds[number];

export type InvestmentPolicyViolation = {
    readonly kind: InvestmentPolicyViolationKind;
    readonly message: string;
    readonly actual: number | string;
    readonly limit: number | string;
};

export type InvestmentPolicyAssessment = {
    readonly symbol: string;
    readonly sector: string;
    readonly violations: readonly InvestmentPolicyViolation[];
    readonly evidenceCoveragePercent: number;
    readonly reviewAgeDays: number;
    readonly compliant: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const validPercent = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

export const parseInvestmentPolicy = (value: unknown): InvestmentPolicy => {
    if (!isRecord(value) || value.version !== 1
        || !validPercent(value.maxSingleAllocationPercent) || value.maxSingleAllocationPercent === 0
        || !validPercent(value.maxSectorAllocationPercent) || value.maxSectorAllocationPercent === 0
        || !validPercent(value.minEvidenceCoveragePercent)
        || typeof value.maxReviewAgeDays !== 'number' || !Number.isInteger(value.maxReviewAgeDays)
        || value.maxReviewAgeDays < 1 || value.maxReviewAgeDays > 730
        || typeof value.requireFairOrCheapForReady !== 'boolean') return defaultInvestmentPolicy;
    return {
        version: 1,
        maxSingleAllocationPercent: value.maxSingleAllocationPercent,
        maxSectorAllocationPercent: value.maxSectorAllocationPercent,
        minEvidenceCoveragePercent: value.minEvidenceCoveragePercent,
        maxReviewAgeDays: value.maxReviewAgeDays,
        requireFairOrCheapForReady: value.requireFairOrCheapForReady,
    };
};

const utcDay = (value: string): number => Math.floor(Date.parse(`${value}T00:00:00.000Z`) / 86_400_000);

export const assessInvestmentPolicy = (
    entries: readonly { readonly record: ResearchRecord; readonly sector: string }[],
    policy: InvestmentPolicy,
    today = new Date().toISOString().slice(0, 10),
): readonly InvestmentPolicyAssessment[] => {
    const parsedPolicy = parseInvestmentPolicy(policy);
    const sectorAllocations = new Map<string, number>();
    for (const { record, sector } of entries) {
        const allocation = record.positionPlan.plannedAllocationPercent ?? 0;
        if (allocation > 0) sectorAllocations.set(sector, (sectorAllocations.get(sector) ?? 0) + allocation);
    }
    return entries.map(({ record, sector }) => {
        const violations: InvestmentPolicyViolation[] = [];
        const allocation = record.positionPlan.plannedAllocationPercent ?? 0;
        const sectorAllocation = sectorAllocations.get(sector) ?? 0;
        const evidenceCoveragePercent = buildEvidenceCoverage(record, today).coveragePercent;
        const reviewAgeDays = Math.max(0, utcDay(today) - utcDay(record.lastReviewedAt));
        if (allocation > parsedPolicy.maxSingleAllocationPercent) violations.push({
            kind: 'single-allocation',
            message: `Planned allocation exceeds the ${parsedPolicy.maxSingleAllocationPercent}% single-name limit.`,
            actual: allocation,
            limit: parsedPolicy.maxSingleAllocationPercent,
        });
        if (allocation > 0 && sectorAllocation > parsedPolicy.maxSectorAllocationPercent) violations.push({
            kind: 'sector-allocation',
            message: `${sector} plans total ${sectorAllocation.toFixed(1)}%, above the sector limit.`,
            actual: sectorAllocation,
            limit: parsedPolicy.maxSectorAllocationPercent,
        });
        if (evidenceCoveragePercent < parsedPolicy.minEvidenceCoveragePercent) violations.push({
            kind: 'evidence-coverage',
            message: `Evidence coverage is below the ${parsedPolicy.minEvidenceCoveragePercent}% minimum.`,
            actual: evidenceCoveragePercent,
            limit: parsedPolicy.minEvidenceCoveragePercent,
        });
        if (reviewAgeDays > parsedPolicy.maxReviewAgeDays) violations.push({
            kind: 'review-age',
            message: `The saved review is older than ${parsedPolicy.maxReviewAgeDays} days.`,
            actual: reviewAgeDays,
            limit: parsedPolicy.maxReviewAgeDays,
        });
        if (parsedPolicy.requireFairOrCheapForReady
            && (record.decisionJournal.decision === 'Ready' || record.decisionJournal.decision === 'DCA')
            && record.valuationState !== 'cheap' && record.valuationState !== 'fair') violations.push({
            kind: 'ready-valuation',
            message: `${record.decisionJournal.decision} requires cheap or fair saved valuation under this policy.`,
            actual: record.valuationState,
            limit: 'cheap or fair',
        });
        return {
            symbol: record.symbol,
            sector,
            violations,
            evidenceCoveragePercent,
            reviewAgeDays,
            compliant: violations.length === 0,
        };
    });
};
