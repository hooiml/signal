import type { ResearchCalendarEvent } from '../types/research-calendar';
import { isResearchCalendarDate } from './calendar-input';
import { researchListingKey } from './listing-identity';

export const RESEARCH_CALENDAR_DATE_STATE_KEY = 'signal-research-calendar-dates-v1';

export type ResearchCalendarDateState = Readonly<Record<string, string>>;

const stateKey = ({ market, symbol, type }: Pick<ResearchCalendarEvent, 'market' | 'symbol' | 'type'>): string => `${researchListingKey(market, symbol)}:${type}`;

export const parseResearchCalendarDateState = (value: unknown): ResearchCalendarDateState => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    const entries = Object.entries(value).filter((entry): entry is [string, string] =>
        typeof entry[1] === 'string' && isResearchCalendarDate(entry[1]));
    // Earnings in the old cache came from US-only coverage. Old review dates have no market.
    const legacyEarnings = entries.filter(([key]) => /^[A-Z0-9.-]{1,15}:earnings$/.test(key))
        .map(([key, date]) => [`US:${key}`, date]);
    const listingDates = entries.filter(([key]) => /^(US|MY):[A-Z0-9.-]{1,15}:(review|earnings|stale)$/.test(key));
    return Object.fromEntries([...legacyEarnings, ...listingDates]);
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
