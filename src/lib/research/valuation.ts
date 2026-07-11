export type ValuationSnapshot = {
    readonly marketCap: number | null;
    readonly priceEarnings: number | null;
    readonly priceSales: number | null;
    readonly freeCashFlowYieldPercent: number | null;
    readonly netCash: number | null;
};

export type ValuationInputs = {
    readonly price: number | null;
    readonly shares: number | null;
    readonly annualRevenue: number | null;
    readonly annualNetIncome: number | null;
    readonly freeCashFlow: number | null;
    readonly debt: number | null;
    readonly cash: number | null;
};

const ratio = (numerator: number | null, denominator: number | null): number | null =>
    numerator === null || denominator === null || denominator <= 0
        ? null
        : Number((numerator / denominator).toFixed(2));

export const calculateValuation = (inputs: ValuationInputs): ValuationSnapshot => {
    const marketCap = inputs.price === null || inputs.shares === null ? null : inputs.price * inputs.shares;
    const freeCashFlowYield = ratio(inputs.freeCashFlow, marketCap);
    return {
        marketCap,
        priceEarnings: ratio(marketCap, inputs.annualNetIncome),
        priceSales: ratio(marketCap, inputs.annualRevenue),
        freeCashFlowYieldPercent: freeCashFlowYield === null ? null : Number((freeCashFlowYield * 100).toFixed(2)),
        netCash: inputs.cash === null || inputs.debt === null ? null : inputs.cash - inputs.debt,
    };
};
