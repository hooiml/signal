import {
    researchCalendarEventTypes,
    researchCalendarRanges,
    type ResearchCalendarEventType,
    type ResearchCalendarInput,
    type ResearchCalendarQuery,
    type ResearchCalendarRange,
} from '../types/research-calendar';

export class ResearchCalendarInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchCalendarInputError';
    }
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const isResearchCalendarDate = (value: string): boolean => {
    if (!datePattern.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const nullableDate = (value: unknown, label: string): string | null => {
    if (value === null) return null;
    if (typeof value !== 'string' || !isResearchCalendarDate(value)) throw new ResearchCalendarInputError(`${label} must be a valid YYYY-MM-DD date or null.`);
    return value;
};

const nullableDays = (value: unknown, label: string, maximum: number): number | null => {
    if (value === null) return null;
    if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > maximum) throw new ResearchCalendarInputError(`${label} must be an integer from 1 to ${maximum}, or null.`);
    return Number(value);
};

const parseCalendarInput = (value: unknown): ResearchCalendarInput => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ResearchCalendarInputError('Invalid research calendar input.');
    const input = Object.fromEntries(Object.entries(value));
    if (typeof input.symbol !== 'string' || !/^[A-Z0-9.-]{1,15}$/.test(input.symbol)) throw new ResearchCalendarInputError('Invalid research calendar symbol.');
    if (input.market !== 'US' && input.market !== 'MY') throw new ResearchCalendarInputError('Invalid research calendar market.');
    if (typeof input.lastReviewedAt !== 'string' || !isResearchCalendarDate(input.lastReviewedAt)) throw new ResearchCalendarInputError('lastReviewedAt must be a valid YYYY-MM-DD date.');
    return {
        symbol: input.symbol,
        market: input.market,
        nextReviewAt: nullableDate(input.nextReviewAt, 'nextReviewAt'),
        lastReviewedAt: input.lastReviewedAt,
        reviewAgeDays: nullableDays(input.reviewAgeDays, 'reviewAgeDays', 365),
        earningsWithinDays: nullableDays(input.earningsWithinDays, 'earningsWithinDays', 90),
    };
};

export const parseResearchCalendarInputs = (value: unknown): readonly ResearchCalendarInput[] => {
    if (!Array.isArray(value) || value.length === 0 || value.length > 50) throw new ResearchCalendarInputError('Provide between 1 and 50 research calendar records.');
    const parsed = value.map(parseCalendarInput);
    if (new Set(parsed.map((input) => input.symbol)).size !== parsed.length) throw new ResearchCalendarInputError('Research calendar symbols must be unique.');
    return parsed;
};

const rangeValue = (value: string | null): ResearchCalendarRange => {
    if (value === null) return 30;
    const range = Number(value);
    if (!researchCalendarRanges.includes(range as ResearchCalendarRange)) throw new ResearchCalendarInputError('range must be 30 or 90.');
    return range as ResearchCalendarRange;
};

const eventTypeValue = (value: string | null): ResearchCalendarEventType | 'ALL' => {
    if (value === null || value === 'ALL') return 'ALL';
    if (!researchCalendarEventTypes.includes(value as ResearchCalendarEventType)) throw new ResearchCalendarInputError('Invalid calendar event type.');
    return value as ResearchCalendarEventType;
};

export const parseResearchCalendarQuery = (params: URLSearchParams): ResearchCalendarQuery => {
    const market = params.get('market') ?? 'ALL';
    if (market !== 'ALL' && market !== 'US' && market !== 'MY') throw new ResearchCalendarInputError('Invalid calendar market.');
    const ticker = (params.get('ticker') ?? 'ALL').toUpperCase();
    if (ticker !== 'ALL' && !/^[A-Z0-9.-]{1,15}$/.test(ticker)) throw new ResearchCalendarInputError('Invalid calendar ticker.');
    return {
        rangeDays: rangeValue(params.get('range')),
        market,
        ticker,
        type: eventTypeValue(params.get('type')),
    };
};
