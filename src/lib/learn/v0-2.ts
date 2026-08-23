import type { HistoricalValuationObservation } from '@/lib/types/historical-valuation';

export const businessModuleIdsV02 = [
    'revenue',
    'income-statement',
    'margins',
    'balance-sheet',
    'cash-flow',
    'debt',
    'roic',
    'dilution',
    'connections',
] as const;

export type BusinessModuleIdV02 = typeof businessModuleIdsV02[number];

export const businessModulesV02: readonly {
    readonly id: BusinessModuleIdV02;
    readonly eyebrow: string;
    readonly title: string;
    readonly objective: string;
}[] = [
    { id: 'revenue', eyebrow: '1.1', title: 'Revenue', objective: 'Trace where growth comes from and distinguish rate from growth quality.' },
    { id: 'income-statement', eyebrow: '1.2', title: 'Income statement', objective: 'Follow revenue through gross profit, operating income, net income, and EPS.' },
    { id: 'margins', eyebrow: '1.3', title: 'Margins & operating leverage', objective: 'Understand why earnings can move faster than revenue.' },
    { id: 'balance-sheet', eyebrow: '1.4', title: 'Balance sheet', objective: 'Interpret cash, debt, working-capital pressure, and financial flexibility.' },
    { id: 'cash-flow', eyebrow: '1.5', title: 'Cash flow & FCF', objective: 'Separate accounting earnings from cash the business actually generates.' },
    { id: 'debt', eyebrow: '1.6', title: 'Debt & resilience', objective: 'Judge debt alongside cash generation, interest burden, and business stability.' },
    { id: 'roic', eyebrow: '1.7', title: 'ROIC & capital efficiency', objective: 'Ask how much capital a business needs to produce its operating returns.' },
    { id: 'dilution', eyebrow: '1.8', title: 'Dilution & buybacks', objective: 'Translate company growth into per-share economics.' },
    { id: 'connections', eyebrow: '1.9', title: 'Connect the statements', objective: 'Trace business drivers back into EPS, cash flow, and valuation.' },
];

export type BusinessDriverInputsV02 = {
    readonly revenue: number;
    readonly grossMarginPercent: number;
    readonly operatingExpenses: number;
    readonly interestExpense: number;
    readonly taxRatePercent: number;
    readonly dilutedShares: number;
    readonly operatingCashFlow: number;
    readonly capex: number;
    readonly debt: number;
    readonly cash: number;
    readonly investedCapital: number;
};

export type BusinessDriverResultV02 = {
    readonly grossProfit: number;
    readonly operatingIncome: number;
    readonly pretaxIncome: number;
    readonly netIncome: number;
    readonly eps: number | null;
    readonly freeCashFlow: number;
    readonly netDebt: number;
    readonly interestCoverage: number | null;
    readonly roicPercent: number | null;
};

export const calculateBusinessDriversV02 = (inputs: BusinessDriverInputsV02): BusinessDriverResultV02 => {
    const grossProfit = inputs.revenue * (inputs.grossMarginPercent / 100);
    const operatingIncome = grossProfit - inputs.operatingExpenses;
    const pretaxIncome = operatingIncome - inputs.interestExpense;
    const taxRate = Math.min(Math.max(inputs.taxRatePercent, 0), 100) / 100;
    const netIncome = pretaxIncome > 0 ? pretaxIncome * (1 - taxRate) : pretaxIncome;
    const eps = inputs.dilutedShares > 0 ? netIncome / inputs.dilutedShares : null;
    const freeCashFlow = inputs.operatingCashFlow - inputs.capex;
    const netDebt = inputs.debt - inputs.cash;
    const interestCoverage = inputs.interestExpense > 0 ? operatingIncome / inputs.interestExpense : null;
    const nopat = operatingIncome > 0 ? operatingIncome * (1 - taxRate) : operatingIncome;
    const roicPercent = inputs.investedCapital > 0 ? (nopat / inputs.investedCapital) * 100 : null;
    return { grossProfit, operatingIncome, pretaxIncome, netIncome, eps, freeCashFlow, netDebt, interestCoverage, roicPercent };
};

export type BusinessReplayObservationV02 = {
    readonly id: string;
    readonly fiscalPeriodEnd: string;
    readonly filedAt: string;
    readonly priceDate: string;
    readonly annualRevenue: number;
    readonly annualNetIncome: number;
    readonly freeCashFlow: number | null;
    readonly priceEarnings: number;
    readonly filingUrl: string;
    readonly form: '10-K' | '10-K/A';
};

export const toBusinessReplayObservationV02 = (observation: HistoricalValuationObservation): BusinessReplayObservationV02 | null => {
    if (
        observation.priceDate === null
        || observation.annualRevenue === null
        || observation.annualRevenue <= 0
        || observation.annualNetIncome === null
        || observation.priceEarnings.value === null
    ) return null;
    return {
        id: observation.id,
        fiscalPeriodEnd: observation.fiscalPeriodEnd,
        filedAt: observation.filedAt,
        priceDate: observation.priceDate,
        annualRevenue: observation.annualRevenue,
        annualNetIncome: observation.annualNetIncome,
        freeCashFlow: observation.freeCashFlow,
        priceEarnings: observation.priceEarnings.value,
        filingUrl: observation.filingUrl,
        form: observation.form,
    };
};

export const eligibleBusinessReplayObservationsV02 = (observations: readonly HistoricalValuationObservation[]) =>
    observations
        .map(toBusinessReplayObservationV02)
        .filter((observation): observation is BusinessReplayObservationV02 => observation !== null)
        .sort((left, right) => left.priceDate.localeCompare(right.priceDate) || left.id.localeCompare(right.id));
