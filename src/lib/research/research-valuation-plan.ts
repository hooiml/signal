import {
    calculateResearchMemoryImpliedEpsGrowth,
    calculateResearchMemoryValuation,
    calculateResearchMemoryValuationGap,
    type ResearchMemoryValuationScenario,
} from './research-memory-valuation';
import { normalizeResearchMemoryTicker } from './research-memory';

export type ResearchValuationPlan = {
    readonly ticker: string;
    readonly currentEps: number | null;
    readonly years: number;
    readonly annualDiscountRatePct: number;
    readonly scenarios: readonly ResearchMemoryValuationScenario[];
    readonly updatedAt: string;
};

export type ResearchValuationPlanResult = {
    readonly plan: ResearchValuationPlan;
    readonly scenarioResults: readonly ({
        readonly id: string;
        readonly label: string;
        readonly epsCagrPct: number;
        readonly terminalPe: number;
        readonly presentValue: number;
        readonly terminalEps: number;
        readonly gapPct: number | null;
    })[];
    readonly impliedEpsCagrPct: number | null;
};

const finiteRange = (value: unknown, label: string, min: number, max: number) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} must be between ${min} and ${max}.`);
    return number;
};

const nullablePositive = (value: unknown, label: string) => {
    if (value === undefined || value === null || value === '') return null;
    return finiteRange(value, label, 0.000001, 1000000);
};

const timestamp = (value: unknown) => {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error('Invalid valuation updatedAt.');
    return new Date(value).toISOString();
};

export const createResearchValuationPlan = (ticker: string, now = new Date()): ResearchValuationPlan => ({
    ticker: normalizeResearchMemoryTicker(ticker),
    currentEps: null,
    years: 5,
    annualDiscountRatePct: 10,
    scenarios: [
        { id: 'bear', label: 'Bear', currentEps: 1, epsCagrPct: 4, terminalPe: 20, years: 5, annualDiscountRatePct: 10 },
        { id: 'base', label: 'Base', currentEps: 1, epsCagrPct: 10, terminalPe: 25, years: 5, annualDiscountRatePct: 10 },
        { id: 'bull', label: 'Bull', currentEps: 1, epsCagrPct: 16, terminalPe: 30, years: 5, annualDiscountRatePct: 10 },
    ],
    updatedAt: now.toISOString(),
});

export const parseResearchValuationPlan = (input: unknown): ResearchValuationPlan => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid valuation plan.');
    const raw = input as Record<string, unknown>;
    const ticker = normalizeResearchMemoryTicker(typeof raw.ticker === 'string' ? raw.ticker : '');
    const currentEps = nullablePositive(raw.currentEps, 'Current EPS');
    const years = finiteRange(raw.years, 'Years', 1, 10);
    const annualDiscountRatePct = finiteRange(raw.annualDiscountRatePct, 'Discount rate', 0, 50);
    if (!Array.isArray(raw.scenarios) || raw.scenarios.length !== 3) throw new Error('Valuation plan requires bear, base and bull scenarios.');
    const ids = ['bear', 'base', 'bull'] as const;
    const labels = ['Bear', 'Base', 'Bull'] as const;
    const scenarios = raw.scenarios.map((item, index): ResearchMemoryValuationScenario => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`Invalid ${labels[index]} scenario.`);
        const scenario = item as Record<string, unknown>;
        return {
            id: ids[index],
            label: labels[index],
            currentEps: currentEps ?? 1,
            epsCagrPct: finiteRange(scenario.epsCagrPct, `${labels[index]} EPS CAGR`, -50, 100),
            terminalPe: finiteRange(scenario.terminalPe, `${labels[index]} terminal P/E`, 1, 100),
            years,
            annualDiscountRatePct,
        };
    });
    return { ticker, currentEps, years, annualDiscountRatePct, scenarios, updatedAt: timestamp(raw.updatedAt) };
};

export const evaluateResearchValuationPlan = (planInput: ResearchValuationPlan, marketPrice: number | null): ResearchValuationPlanResult => {
    const plan = parseResearchValuationPlan(planInput);
    if (plan.currentEps === null) return { plan, scenarioResults: [], impliedEpsCagrPct: null };
    const scenarios = plan.scenarios.map((scenario) => ({ ...scenario, currentEps: plan.currentEps as number, years: plan.years, annualDiscountRatePct: plan.annualDiscountRatePct }));
    const scenarioResults = scenarios.map((scenario) => {
        const result = calculateResearchMemoryValuation(scenario);
        const gapPct = marketPrice && marketPrice > 0 ? calculateResearchMemoryValuationGap(marketPrice, result.presentValue).pctOfMarketPrice : null;
        return {
            id: scenario.id,
            label: scenario.label,
            epsCagrPct: scenario.epsCagrPct,
            terminalPe: scenario.terminalPe,
            presentValue: result.presentValue,
            terminalEps: result.terminalEps,
            gapPct,
        };
    });
    const base = scenarios.find((scenario) => scenario.id === 'base') ?? scenarios[1];
    const impliedEpsCagrPct = marketPrice && marketPrice > 0
        ? calculateResearchMemoryImpliedEpsGrowth({
            marketPrice,
            currentEps: plan.currentEps,
            terminalPe: base.terminalPe,
            years: plan.years,
            annualDiscountRatePct: plan.annualDiscountRatePct,
        }).impliedEpsCagrPct
        : null;
    return { plan, scenarioResults, impliedEpsCagrPct };
};
