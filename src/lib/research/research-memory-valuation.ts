export type ResearchMemoryValuationAssumptions = {
    readonly currentEps: number;
    readonly epsCagrPct: number;
    readonly terminalPe: number;
    readonly years: number;
    readonly annualDiscountRatePct: number;
};

export type ResearchMemoryValuationScenario = ResearchMemoryValuationAssumptions & {
    readonly id: string;
    readonly label: string;
};

export type ResearchMemoryValuationResult = {
    readonly id: string;
    readonly label: string;
    readonly terminalEps: number;
    readonly terminalValue: number;
    readonly presentValue: number;
};

export type ResearchMemoryImpliedExpectation = {
    readonly marketPrice: number;
    readonly currentEps: number;
    readonly terminalPe: number;
    readonly years: number;
    readonly annualDiscountRatePct: number;
    readonly impliedEpsCagrPct: number;
};

const finitePositive = (value: number, label: string) => {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number`);
    return value;
};

const finiteRate = (value: number, label: string) => {
    if (!Number.isFinite(value) || value <= -100) throw new Error(`${label} must be finite and greater than -100%`);
    return value / 100;
};

export const calculateResearchMemoryValuation = (
    scenario: ResearchMemoryValuationScenario,
): ResearchMemoryValuationResult => {
    const eps = finitePositive(scenario.currentEps, 'Current EPS');
    const terminalPe = finitePositive(scenario.terminalPe, 'Terminal P/E');
    const years = finitePositive(scenario.years, 'Years');
    const growth = finiteRate(scenario.epsCagrPct, 'EPS CAGR');
    const discount = finiteRate(scenario.annualDiscountRatePct, 'Discount rate');
    const terminalEps = eps * Math.pow(1 + growth, years);
    const terminalValue = terminalEps * terminalPe;
    const presentValue = terminalValue / Math.pow(1 + discount, years);
    return { id: scenario.id, label: scenario.label, terminalEps, terminalValue, presentValue };
};

export const calculateResearchMemoryValuationRange = (
    scenarios: readonly ResearchMemoryValuationScenario[],
) => {
    if (scenarios.length === 0) throw new Error('At least one valuation scenario is required');
    const results = scenarios.map(calculateResearchMemoryValuation);
    const sorted = [...results].sort((a, b) => a.presentValue - b.presentValue);
    return {
        results,
        low: sorted[0].presentValue,
        high: sorted.at(-1)?.presentValue ?? sorted[0].presentValue,
        midpoint: sorted.reduce((sum, item) => sum + item.presentValue, 0) / sorted.length,
    };
};

export const calculateResearchMemoryImpliedEpsGrowth = (input: {
    readonly marketPrice: number;
    readonly currentEps: number;
    readonly terminalPe: number;
    readonly years: number;
    readonly annualDiscountRatePct: number;
}): ResearchMemoryImpliedExpectation => {
    const marketPrice = finitePositive(input.marketPrice, 'Market price');
    const currentEps = finitePositive(input.currentEps, 'Current EPS');
    const terminalPe = finitePositive(input.terminalPe, 'Terminal P/E');
    const years = finitePositive(input.years, 'Years');
    const discount = finiteRate(input.annualDiscountRatePct, 'Discount rate');
    const requiredTerminalValue = marketPrice * Math.pow(1 + discount, years);
    const requiredTerminalEps = requiredTerminalValue / terminalPe;
    const growth = Math.pow(requiredTerminalEps / currentEps, 1 / years) - 1;
    return {
        ...input,
        impliedEpsCagrPct: growth * 100,
    };
};

export const calculateResearchMemoryValuationGap = (marketPrice: number, presentValue: number) => {
    finitePositive(marketPrice, 'Market price');
    finitePositive(presentValue, 'Present value');
    const gap = presentValue - marketPrice;
    return {
        absolute: gap,
        pctOfMarketPrice: (gap / marketPrice) * 100,
        state: gap > 0 ? 'below_scenario_value' as const : gap < 0 ? 'above_scenario_value' as const : 'at_scenario_value' as const,
    };
};
