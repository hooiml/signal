import type { ResearchPositionPlan, ResearchRecord } from '../types/research';

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
