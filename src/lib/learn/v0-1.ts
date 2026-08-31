import type { HistoricalValuationObservation } from '@/lib/types/historical-valuation';

export const learnModuleIdsV01 = ['evidence', 'eps', 'pe', 'forward-pe', 'growth', 'expectations'] as const;
export type LearnModuleIdV01 = typeof learnModuleIdsV01[number];

export const learnModulesV01: readonly {
    readonly id: LearnModuleIdV01;
    readonly eyebrow: string;
    readonly title: string;
    readonly objective: string;
    readonly measures: string;
    readonly whyItMatters: string;
    readonly changesWith: string;
    readonly limitation: string;
    readonly connectedConcept: string;
}[] = [
    { id: 'evidence', eyebrow: '0.1', title: 'Evidence & uncertainty', objective: 'Separate facts, interpretations, expectations, theses, and uncertainty.', measures: 'Whether a statement is observed, inferred, expected, or still unknown.', whyItMatters: 'A defensible view keeps sourced facts separate from conclusions and confidence.', changesWith: 'New filings, prices, estimates, events, and contradictory evidence.', limitation: 'More evidence does not remove uncertainty or guarantee an outcome.', connectedConcept: 'Market expectations' },
    { id: 'eps', eyebrow: '0.2', title: 'Earnings per share', objective: 'Understand how company earnings become per-share economics.', measures: 'Annual or periodic earnings attributable to each diluted share.', whyItMatters: 'It connects company profit to the economics of one share.', changesWith: 'Net income, dilution, issuance, buybacks, and one-off accounting items.', limitation: 'EPS can improve while cash generation or business quality deteriorates.', connectedConcept: 'P/E ratio' },
    { id: 'pe', eyebrow: '0.3', title: 'P/E ratio', objective: 'Interpret what investors are paying relative to earnings, with context.', measures: 'Price relative to positive earnings per share for a stated period basis.', whyItMatters: 'It makes valuation expectations visible enough to compare with growth and risk.', changesWith: 'Price, earnings, business quality, rates, risk, and market expectations.', limitation: 'P/E is not meaningful with non-positive earnings and never proves cheap or expensive alone.', connectedConcept: 'Earnings growth' },
    { id: 'forward-pe', eyebrow: '0.4', title: 'Forward P/E', objective: 'Understand why valuation based on forecast earnings depends on estimates.', measures: 'Price relative to forecast rather than already reported earnings.', whyItMatters: 'It exposes how much a valuation depends on expected future earnings.', changesWith: 'Price, estimate revisions, fiscal-period alignment, and analyst coverage.', limitation: 'The denominator is an estimate and may be unavailable or materially wrong.', connectedConcept: 'Market expectations' },
    { id: 'growth', eyebrow: '0.5', title: 'Earnings growth', objective: 'Connect growth rate, growth direction, and valuation without using a shortcut rule.', measures: 'How earnings changed across comparable periods.', whyItMatters: 'Growth can support a valuation only when its durability and required assumptions are understood.', changesWith: 'Revenue, margins, taxes, financing, share count, and base effects.', limitation: 'A single growth rate does not reveal quality, durability, or what the price already assumes.', connectedConcept: 'Forward P/E' },
    { id: 'expectations', eyebrow: '0.6', title: 'Market expectations', objective: 'Compare reported results with what investors expected before the result.', measures: 'The gap between reported evidence and prior forecasts or assumptions.', whyItMatters: 'Strong results can still disappoint when the market expected more.', changesWith: 'Guidance, estimates, revisions, macro conditions, and new evidence.', limitation: 'Expectations are uncertain and must not be presented as reported facts.', connectedConcept: 'Evidence & uncertainty' },
];

export const learnReplayCasesV01 = [
    { id: 'premium-growth', symbol: 'MSFT', title: 'Premium valuation and delivered growth', objective: 'Separate earnings progress from the multiple investors paid for it.' },
    { id: 'expectations-reset', symbol: 'META', title: 'Expectations and valuation reset', objective: 'Examine how changing earnings and expectations can move together or diverge.' },
] as const;
export type LearnReplayCaseIdV01 = typeof learnReplayCasesV01[number]['id'];

export type LearnReflectionV01 = {
    readonly caseId: LearnReplayCaseIdV01;
    readonly symbol: string;
    readonly replayId: string;
    readonly createdAt: string;
    readonly reasoningHeldUp: string;
    readonly assumptionToRevise: string;
    readonly confidenceFit: string;
    readonly nextCheck: string;
    readonly revisitConcept: LearnModuleIdV01;
};

export type LearnProgressV01 = {
    readonly version: 1;
    readonly completedModules: readonly LearnModuleIdV01[];
    readonly applyCompleted: boolean;
    readonly reflections: readonly LearnReflectionV01[];
};

export const emptyLearnProgressV01 = (): LearnProgressV01 => ({
    version: 1,
    completedModules: [],
    applyCompleted: false,
    reflections: [],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isLearnModuleIdV01 = (value: unknown): value is LearnModuleIdV01 =>
    typeof value === 'string' && learnModuleIdsV01.some((candidate) => candidate === value);

const isLearnReplayCaseIdV01 = (value: unknown): value is LearnReplayCaseIdV01 =>
    typeof value === 'string' && learnReplayCasesV01.some((candidate) => candidate.id === value);

const readReflectionV01 = (value: unknown): LearnReflectionV01 | null => {
    if (!isRecord(value)
        || !isLearnReplayCaseIdV01(value.caseId)
        || !isLearnModuleIdV01(value.revisitConcept)
        || typeof value.symbol !== 'string'
        || !/^[A-Z0-9.-]{1,15}$/.test(value.symbol)
        || typeof value.replayId !== 'string'
        || typeof value.createdAt !== 'string') return null;
    const fields = ['reasoningHeldUp', 'assumptionToRevise', 'confidenceFit', 'nextCheck'] as const;
    if (fields.some((field) => typeof value[field] !== 'string' || value[field].trim().length === 0 || value[field].length > 700)) return null;
    return value as LearnReflectionV01;
};

export const parseLearnProgressV01 = (value: unknown): LearnProgressV01 => {
    const legacyModules = Array.isArray(value) ? value.filter(isLearnModuleIdV01) : null;
    if (legacyModules) return { ...emptyLearnProgressV01(), completedModules: [...new Set(legacyModules)] };
    if (!isRecord(value) || value.version !== 1) return emptyLearnProgressV01();
    const completedModules = Array.isArray(value.completedModules)
        ? [...new Set(value.completedModules.filter(isLearnModuleIdV01))]
        : [];
    const reflections = Array.isArray(value.reflections)
        ? value.reflections.map(readReflectionV01).filter((item): item is LearnReflectionV01 => item !== null).slice(-2)
        : [];
    return {
        version: 1,
        completedModules,
        applyCompleted: value.applyCompleted === true,
        reflections,
    };
};

export const replayViewsV01 = ['attractive', 'neutral', 'unattractive'] as const;
export type ReplayViewV01 = typeof replayViewsV01[number];

export type ReplayCommitmentV01 = {
    readonly view: ReplayViewV01;
    readonly confidence: number;
    readonly supportingEvidence: string;
    readonly contraryEvidence: string;
    readonly invalidation: string;
};

export type LearnReplayObservationV01 = {
    readonly id: string;
    readonly fiscalPeriodEnd: string;
    readonly filedAt: string;
    readonly priceDate: string;
    readonly price: number;
    readonly priceEarnings: number;
    readonly annualRevenue: number | null;
    readonly annualNetIncome: number;
    readonly splitAdjustedShares: number;
    readonly marketCapitalization: number | null;
    readonly filingUrl: string;
    readonly form: '10-K' | '10-K/A';
    readonly gaps: readonly string[];
};

export type LearnReplayIntroV01 = {
    readonly symbol: string;
    readonly companyName: string | null;
    readonly replayId: string;
    readonly knownAsOf: string;
    readonly observation: LearnReplayObservationV01;
    readonly sourceLabels: readonly string[];
    readonly warnings: readonly string[];
};

export type LearnReplayRevealV01 = LearnReplayIntroV01 & {
    readonly nextObservation: LearnReplayObservationV01;
};

export const calculateEpsV01 = (netIncome: number, dilutedShares: number): number | null => {
    if (!Number.isFinite(netIncome) || !Number.isFinite(dilutedShares) || dilutedShares <= 0) return null;
    return netIncome / dilutedShares;
};

export const calculatePeV01 = (price: number, eps: number): number | null => {
    if (!Number.isFinite(price) || !Number.isFinite(eps) || price < 0 || eps <= 0) return null;
    return price / eps;
};

export const classifyExpectationV01 = (actual: number, expected: number): 'above' | 'in-line' | 'below' => {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return 'in-line';
    const tolerance = Math.max(Math.abs(expected) * 0.005, 0.01);
    if (actual > expected + tolerance) return 'above';
    if (actual < expected - tolerance) return 'below';
    return 'in-line';
};

export const isReplayViewV01 = (value: unknown): value is ReplayViewV01 =>
    typeof value === 'string' && replayViewsV01.some((candidate) => candidate === value);

const boundedText = (value: unknown, maxLength: number) =>
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;

export const isReplayCommitmentV01 = (value: unknown): value is ReplayCommitmentV01 => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    return isReplayViewV01(record.view)
        && typeof record.confidence === 'number'
        && Number.isInteger(record.confidence)
        && record.confidence >= 0
        && record.confidence <= 100
        && boundedText(record.supportingEvidence, 700)
        && boundedText(record.contraryEvidence, 700)
        && boundedText(record.invalidation, 700);
};

export const toLearnReplayObservationV01 = (observation: HistoricalValuationObservation): LearnReplayObservationV01 | null => {
    if (
        observation.price === null
        || observation.priceDate === null
        || observation.priceEarnings.value === null
        || observation.annualNetIncome === null
        || observation.annualNetIncome <= 0
        || observation.splitAdjustedShares === null
        || observation.splitAdjustedShares <= 0
    ) return null;

    return {
        id: observation.id,
        fiscalPeriodEnd: observation.fiscalPeriodEnd,
        filedAt: observation.filedAt,
        priceDate: observation.priceDate,
        price: observation.price,
        priceEarnings: observation.priceEarnings.value,
        annualRevenue: observation.annualRevenue,
        annualNetIncome: observation.annualNetIncome,
        splitAdjustedShares: observation.splitAdjustedShares,
        marketCapitalization: observation.marketCapitalization,
        filingUrl: observation.filingUrl,
        form: observation.form,
        gaps: observation.gaps,
    };
};

export const eligibleReplayObservationsV01 = (observations: readonly HistoricalValuationObservation[]) =>
    observations
        .map(toLearnReplayObservationV01)
        .filter((observation): observation is LearnReplayObservationV01 => observation !== null)
        .sort((left, right) => left.priceDate.localeCompare(right.priceDate) || left.id.localeCompare(right.id));
