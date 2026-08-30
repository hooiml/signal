import { normalizeResearchMemoryTicker } from './research-memory.ts';

export const calibrationRatings = ['strong', 'mixed', 'weak', 'not-applicable'] as const;
export const calibrationVerdicts = ['repeat', 'adjust', 'insufficient-evidence'] as const;
export type CalibrationRating = typeof calibrationRatings[number];
export type CalibrationVerdict = typeof calibrationVerdicts[number];

export type ResearchDecisionCalibration = {
    readonly id: string;
    readonly ticker: string;
    readonly reviewId: string;
    readonly reviewedAt: string;
    readonly originalDecision: string;
    readonly originalObservedPrice: number | null;
    readonly laterPrice: number | null;
    readonly thesisQuality: CalibrationRating;
    readonly evidenceQuality: CalibrationRating;
    readonly valuationDiscipline: CalibrationRating;
    readonly triggerDiscipline: CalibrationRating;
    readonly hindsightRisk: boolean;
    readonly unexpectedInformation: string;
    readonly processVerdict: CalibrationVerdict;
    readonly note: string;
    readonly createdAt: string;
    readonly updatedAt: string;
};

const text = (value: unknown, label: string, max: number, required = true) => {
    if (typeof value !== 'string') {
        if (!required && (value === undefined || value === null)) return '';
        throw new Error(`${label} is required.`);
    }
    const normalized = value.trim();
    if (required && !normalized) throw new Error(`${label} is required.`);
    if (normalized.length > max) throw new Error(`${label} is too long.`);
    return normalized;
};
const nullableNumber = (value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new Error('Price must be a positive finite number.');
    return number;
};
const timestamp = (value: unknown, label: string) => {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${label}.`);
    return new Date(value).toISOString();
};

export const parseResearchDecisionCalibration = (input: unknown): ResearchDecisionCalibration => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid decision calibration.');
    const raw = input as Record<string, unknown>;
    const rating = (key: string) => {
        const value = raw[key];
        if (!calibrationRatings.includes(value as CalibrationRating)) throw new Error(`Invalid ${key}.`);
        return value as CalibrationRating;
    };
    if (!calibrationVerdicts.includes(raw.processVerdict as CalibrationVerdict)) throw new Error('Invalid process verdict.');
    return {
        id: text(raw.id, 'Calibration id', 140),
        ticker: normalizeResearchMemoryTicker(text(raw.ticker, 'Ticker', 20)),
        reviewId: text(raw.reviewId, 'Review id', 140),
        reviewedAt: timestamp(raw.reviewedAt, 'reviewedAt'),
        originalDecision: text(raw.originalDecision, 'Original decision', 80),
        originalObservedPrice: nullableNumber(raw.originalObservedPrice),
        laterPrice: nullableNumber(raw.laterPrice),
        thesisQuality: rating('thesisQuality'), evidenceQuality: rating('evidenceQuality'),
        valuationDiscipline: rating('valuationDiscipline'), triggerDiscipline: rating('triggerDiscipline'),
        hindsightRisk: raw.hindsightRisk === true,
        unexpectedInformation: text(raw.unexpectedInformation, 'Unexpected information', 1500, false),
        processVerdict: raw.processVerdict as CalibrationVerdict,
        note: text(raw.note, 'Calibration note', 2000, false),
        createdAt: timestamp(raw.createdAt, 'createdAt'), updatedAt: timestamp(raw.updatedAt, 'updatedAt'),
    };
};

export const createResearchDecisionCalibration = (input: {
    ticker: string; reviewId: string; reviewedAt: string; originalDecision: string; originalObservedPrice: number | null;
}, now = new Date()): ResearchDecisionCalibration => {
    const time = now.toISOString();
    const ticker = normalizeResearchMemoryTicker(input.ticker);
    return {
        id: `${ticker.toLowerCase()}-${input.reviewId}-calibration`, ticker, reviewId: input.reviewId,
        reviewedAt: new Date(input.reviewedAt).toISOString(), originalDecision: input.originalDecision,
        originalObservedPrice: input.originalObservedPrice, laterPrice: null,
        thesisQuality: 'mixed', evidenceQuality: 'mixed', valuationDiscipline: 'mixed', triggerDiscipline: 'mixed',
        hindsightRisk: false, unexpectedInformation: '', processVerdict: 'adjust', note: '', createdAt: time, updatedAt: time,
    };
};

export const summarizeResearchDecisionCalibration = (review: ResearchDecisionCalibration) => {
    const ratings = [review.thesisQuality, review.evidenceQuality, review.valuationDiscipline, review.triggerDiscipline].filter((v) => v !== 'not-applicable');
    const strong = ratings.filter((v) => v === 'strong').length;
    const weak = ratings.filter((v) => v === 'weak').length;
    return { strong, weak, reviewedDimensions: ratings.length, verdict: review.processVerdict };
};
