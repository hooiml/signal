import type { ResearchMarket } from './research';

export const researchCalendarRanges = [30, 90] as const;
export const researchCalendarEventTypes = ['review', 'earnings', 'stale'] as const;
export const researchCalendarFreshness = ['scheduled', 'overdue'] as const;

export type ResearchCalendarRange = typeof researchCalendarRanges[number];
export type ResearchCalendarEventType = typeof researchCalendarEventTypes[number];
export type ResearchCalendarFreshness = typeof researchCalendarFreshness[number];
export type ResearchCalendarFilterValue = 'ALL';

export type ResearchCalendarInput = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly nextReviewAt: string | null;
    readonly lastReviewedAt: string;
    readonly reviewAgeDays: number | null;
    readonly earningsWithinDays: number | null;
};

export type ResearchCalendarCatalyst = {
    readonly symbol: string;
    readonly date: string;
    readonly type: 'earnings';
    readonly timing: 'pre-market' | 'after-hours' | 'time-not-supplied';
    readonly fiscalQuarterEnding: string | null;
    readonly epsForecast: string | null;
    readonly source: 'Nasdaq earnings calendar';
};

export type ResearchCalendarEvent = {
    readonly id: string;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly type: ResearchCalendarEventType;
    readonly title: string;
    readonly detail: string;
    readonly source: 'Research journal' | 'Nasdaq earnings calendar';
    readonly sourceDate: string;
    readonly displayDate: string;
    readonly timezone: 'UTC';
    readonly freshness: ResearchCalendarFreshness;
    readonly urgency: 'action' | 'upcoming';
    readonly targetHref: string;
};

export type ResearchCalendarResponse = {
    readonly generatedAt: string;
    readonly rangeDays: ResearchCalendarRange;
    readonly timezone: 'UTC';
    readonly events: readonly ResearchCalendarEvent[];
    readonly warnings: readonly string[];
};

export type ResearchCalendarQuery = {
    readonly rangeDays: ResearchCalendarRange;
    readonly market: ResearchMarket | ResearchCalendarFilterValue;
    readonly ticker: string | ResearchCalendarFilterValue;
    readonly type: ResearchCalendarEventType | ResearchCalendarFilterValue;
};
