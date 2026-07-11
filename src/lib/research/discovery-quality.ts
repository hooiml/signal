import type { DiscoveryCategory } from '../types/research-discovery';

export type DiscoveryQualityInput = {
    readonly revenueGrowthPercent: number | null;
    readonly grossMarginPercent: number | null;
    readonly operatingMarginPercent: number | null;
    readonly freeCashFlow: number | null;
    readonly debt: number | null;
    readonly cash: number | null;
    readonly shareChangePercent: number | null;
};

export type DiscoveryQuality = {
    readonly score: number;
    readonly category: DiscoveryCategory;
    readonly reasons: readonly string[];
};

export const scoreDiscoveryQuality = (input: DiscoveryQualityInput, trendScore: number): DiscoveryQuality => {
    const extraordinaryGrowth = (input.revenueGrowthPercent ?? 0) > 100;
    const growthPoints = input.revenueGrowthPercent === null ? 0 : extraordinaryGrowth ? 18 : input.revenueGrowthPercent >= 15 ? 25 : input.revenueGrowthPercent >= 5 ? 18 : input.revenueGrowthPercent >= 0 ? 10 : 0;
    const grossMarginPoints = input.grossMarginPercent === null ? 0 : input.grossMarginPercent >= 50 ? 15 : input.grossMarginPercent >= 30 ? 10 : input.grossMarginPercent > 0 ? 5 : 0;
    const operatingPoints = input.operatingMarginPercent === null ? 0 : input.operatingMarginPercent >= 20 ? 20 : input.operatingMarginPercent >= 10 ? 12 : input.operatingMarginPercent > 0 ? 5 : 0;
    const cashFlowPoints = input.freeCashFlow === null ? 0 : input.freeCashFlow > 0 ? 20 : 0;
    const balancePoints = input.cash === null || input.debt === null ? 0 : input.cash >= input.debt ? 10 : input.cash >= input.debt * 0.5 ? 5 : 0;
    const dilutionPoints = input.shareChangePercent === null ? 0 : input.shareChangePercent <= 1 ? 10 : input.shareChangePercent <= 5 ? 5 : 0;
    const score = growthPoints + grossMarginPoints + operatingPoints + cashFlowPoints + balancePoints + dilutionPoints;
    const reasons = [
        input.revenueGrowthPercent !== null ? `Revenue ${input.revenueGrowthPercent >= 0 ? '+' : ''}${input.revenueGrowthPercent.toFixed(1)}%${extraordinaryGrowth ? '; review comparability' : ''}` : null,
        input.operatingMarginPercent !== null ? `Operating margin ${input.operatingMarginPercent.toFixed(1)}%` : null,
        input.freeCashFlow !== null && input.freeCashFlow > 0 ? 'Positive free cash flow' : null,
        input.shareChangePercent !== null && input.shareChangePercent <= 1 ? 'Stable share count' : null,
    ].filter((reason): reason is string => reason !== null);
    let category: DiscoveryCategory = 'momentum only';
    if (score < 25 && ((input.revenueGrowthPercent ?? 0) < 0 || (input.freeCashFlow ?? 0) < 0)) category = 'fundamentally unsupported';
    else if ((input.operatingMarginPercent ?? 0) <= 0 && (input.revenueGrowthPercent ?? 0) > 0 && (input.freeCashFlow ?? 0) > 0) category = 'turnaround';
    else if (extraordinaryGrowth && score >= 50) category = 'cyclical acceleration';
    else if (score >= 75 && trendScore >= 70) category = 'quality compounder';
    else if ((input.revenueGrowthPercent ?? 0) >= 15 && score >= 50) category = 'cyclical acceleration';
    return { score, category, reasons };
};
