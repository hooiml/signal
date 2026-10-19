import type { ResearchPositionPlan, ResearchRecord } from '../types/research';
import { normalizeCurrencyCode } from './price-format';

export const positionPlanPriceFields = ['averageCost', 'plannedEntryPrice', 'invalidationPrice'] as const;

export const positionPlanValueCount = (plan: ResearchPositionPlan): number =>
    [plan.plannedAllocationPercent, ...positionPlanPriceFields.map((field) => plan[field])].filter((value) => value !== null).length;

/**
 * New or changed plan prices must carry an explicit currency. Unchanged legacy prices may stay
 * without one, so older records still save; their currency remains unknown rather than inferred.
 */
export const positionPlanCurrencyIssue = (initial: ResearchPositionPlan, draft: ResearchPositionPlan): string | null => {
    const entered = draft.currency?.trim() ?? '';
    if (entered !== '' && normalizeCurrencyCode(entered) === null) return 'Use a three-letter currency code, such as USD or MYR.';
    const changedPrice = positionPlanPriceFields.some((field) => draft[field] !== null && draft[field] !== initial[field]);
    return changedPrice && entered === '' ? 'Record the currency of the position plan prices before saving.' : null;
};

export type PositionPlanRisk = {
    readonly referencePrice: number;
    readonly downsidePercent: number;
    readonly portfolioRiskPercent: number;
};

export const calculatePositionPlanRisk = (
    plan: ResearchPositionPlan,
    currentPrice: number | null,
): PositionPlanRisk | null => {
    const referencePrice = plan.averageCost ?? plan.plannedEntryPrice ?? currentPrice;
    if (referencePrice === null || referencePrice <= 0 || plan.invalidationPrice === null
        || plan.invalidationPrice < 0 || plan.invalidationPrice >= referencePrice
        || plan.plannedAllocationPercent === null || plan.plannedAllocationPercent <= 0) return null;
    const downsidePercent = ((referencePrice - plan.invalidationPrice) / referencePrice) * 100;
    return {
        referencePrice,
        downsidePercent: Number(downsidePercent.toFixed(2)),
        portfolioRiskPercent: Number(((plan.plannedAllocationPercent * downsidePercent) / 100).toFixed(2)),
    };
};

export const calculateSectorConcentration = (
    records: readonly ResearchRecord[],
    sectors: ReadonlyMap<string, string>,
): readonly { readonly sector: string; readonly allocationPercent: number }[] => {
    const totals = new Map<string, number>();
    records.filter((record) => record.positionState === 'owned').forEach((record) => {
        const allocation = record.positionPlan.plannedAllocationPercent;
        if (allocation === null || allocation <= 0) return;
        const sector = sectors.get(record.symbol) || 'Unknown';
        totals.set(sector, (totals.get(sector) ?? 0) + allocation);
    });
    return [...totals.entries()]
        .map(([sector, allocationPercent]) => ({ sector, allocationPercent: Number(allocationPercent.toFixed(2)) }))
        .sort((left, right) => right.allocationPercent - left.allocationPercent || left.sector.localeCompare(right.sector));
};
