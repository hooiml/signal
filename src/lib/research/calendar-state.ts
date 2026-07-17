import type { ResearchCalendarEvent } from '../types/research-calendar';
import { isResearchCalendarDate } from './calendar-input';

export const RESEARCH_CALENDAR_DATE_STATE_KEY = 'signal-research-calendar-dates-v1';

export type ResearchCalendarDateState = Readonly<Record<string, string>>;

const stateKey = (event: Pick<ResearchCalendarEvent, 'symbol' | 'type'>): string => `${event.symbol}:${event.type}`;

export const parseResearchCalendarDateState = (value: unknown): ResearchCalendarDateState => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, date]) =>
        /^[A-Z0-9.-]{1,15}:(review|earnings|stale)$/.test(key)
        && typeof date === 'string'
        && isResearchCalendarDate(date)));
};

export const snapshotResearchCalendarDates = (events: readonly ResearchCalendarEvent[]): ResearchCalendarDateState =>
    Object.fromEntries(events
        .filter((event) => event.freshness === 'scheduled')
        .map((event) => [stateKey(event), event.sourceDate]));

export const mergeResearchCalendarDateState = (
    previous: ResearchCalendarDateState,
    current: ResearchCalendarDateState,
    preserveMissing: boolean,
): ResearchCalendarDateState => preserveMissing ? { ...previous, ...current } : current;

export const calendarDateChanges = (
    previous: ResearchCalendarDateState,
    events: readonly ResearchCalendarEvent[],
): ResearchCalendarDateState => Object.fromEntries(events.flatMap((event) => {
    const priorDate = previous[stateKey(event)];
    return priorDate && priorDate !== event.sourceDate ? [[event.id, priorDate]] : [];
}));
