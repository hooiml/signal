import type { HistoricalValuationObservation } from '@/lib/types/historical-valuation';

export const learnModuleIdsV01 = ['evidence', 'eps', 'pe', 'forward-pe', 'growth', 'expectations'] as const;
export type LearnModuleIdV01 = typeof learnModuleIdsV01[number];

export const learnModulesV01: readonly {
    readonly id: LearnModuleIdV01;
    readonly eyebrow: string;
    readonly title: string;
    readonly objective: string;
}[] = [
    { id: 'evidence', eyebrow: '0.1', title: 'Evidence & uncertainty', objective: 'Separate facts, interpretations, expectations, theses, and uncertainty.' },
    { id: 'eps', eyebrow: '0.2', title: 'Earnings per share', objective: 'Understand how company earnings become per-share economics.' },
    { id: 'pe', eyebrow: '0.3', title: 'P/E ratio', objective: 'Interpret what investors are paying relative to earnings, with context.' },
    { id: 'forward-pe', eyebrow: '0.4', title: 'Forward P/E', objective: 'Understand why valuation based on forecast earnings depends on estimates.' },
    { id: 'growth', eyebrow: '0.5', title: 'Earnings growth', objective: 'Connect growth rate, growth direction, and valuation without using a shortcut rule.' },
    { id: 'expectations', eyebrow: '0.6', title: 'Market expectations', objective: 'Compare reported results with what investors expected before the result.' },
];

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
