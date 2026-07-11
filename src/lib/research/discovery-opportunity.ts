import type { DiscoveryRisk } from '../types/research-discovery';

export type EarlyTrendStage = 'emerging' | 'confirmed' | 'extended' | 'not ready';
export type ValuationGuardrail = 'attractive' | 'fair' | 'expensive' | 'extreme' | 'unavailable';

type EarlyTrendInput = {
    readonly aboveMa50: boolean;
    readonly aboveMa200: boolean;
    readonly momentum3MonthPercent: number;
    readonly momentum6MonthPercent: number;
    readonly distanceFromMa50Percent: number;
    readonly risk: DiscoveryRisk;
};

type ValuationInput = {
    readonly priceEarnings: number | null;
    readonly priceSales: number | null;
    readonly freeCashFlowYieldPercent: number | null;
};

export const classifyEarlyTrend = (input: EarlyTrendInput): EarlyTrendStage => {
    if (input.risk === 'high' || !input.aboveMa200 || input.momentum6MonthPercent <= 0) return 'not ready';
    if (input.distanceFromMa50Percent > 12 || input.momentum3MonthPercent > 35) return 'extended';
    if (input.aboveMa50 && input.momentum3MonthPercent >= 5 && input.distanceFromMa50Percent >= -2 && input.distanceFromMa50Percent <= 6) return 'emerging';
    if (input.aboveMa50 && input.momentum3MonthPercent >= 8 && input.distanceFromMa50Percent <= 12) return 'confirmed';
    return 'not ready';
};

export const classifyValuation = (input: ValuationInput): ValuationGuardrail => {
    if (input.priceEarnings === null && input.priceSales === null && input.freeCashFlowYieldPercent === null) return 'unavailable';
    if ((input.priceEarnings !== null && input.priceEarnings > 0 && input.priceEarnings <= 18)
        || (input.freeCashFlowYieldPercent ?? 0) >= 5) return 'attractive';
    if ((input.priceEarnings !== null && input.priceEarnings > 0 && input.priceEarnings <= 30)
        || (input.freeCashFlowYieldPercent ?? 0) >= 3) return 'fair';
    if ((input.priceEarnings !== null && input.priceEarnings > 0 && input.priceEarnings <= 50)
        || (input.priceSales !== null && input.priceSales <= 15)) return 'expensive';
    return 'extreme';
};
