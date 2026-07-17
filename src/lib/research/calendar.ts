import type {
    ResearchCalendarCatalyst,
    ResearchCalendarEvent,
    ResearchCalendarInput,
    ResearchCalendarQuery,
    ResearchCalendarRange,
    ResearchCalendarResponse,
} from '../types/research-calendar';
import { fetchUpcomingCatalysts } from './catalysts';

const utcDate = (date: Date): string => date.toISOString().slice(0, 10);

const addUtcDays = (date: string, days: number): string => {
    const value = new Date(`${date}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return utcDate(value);
};

const inRange = (date: string, start: string, end: string): boolean => date >= start && date <= end;

const reviewHref = (symbol: string) => `/research?ticker=${encodeURIComponent(symbol)}&tab=overview&review=edit`;
const earningsHref = (symbol: string) => `/research?ticker=${encodeURIComponent(symbol)}&tab=events`;

const scheduledReviewEvent = (input: ResearchCalendarInput, start: string, end: string): ResearchCalendarEvent | null => {
    const sourceDate = input.nextReviewAt;
    if (sourceDate === null) return null;
    const overdue = sourceDate < start;
    const displayDate = overdue ? start : sourceDate;
    if (!inRange(displayDate, start, end)) return null;
    return {
        id: `${input.symbol}-review-${sourceDate}`,
        symbol: input.symbol,
        market: input.market,
        type: 'review',
        title: overdue ? 'Scheduled review overdue' : 'Scheduled research review',
        detail: overdue ? `The review scheduled for ${sourceDate} still needs attention.` : 'Review the thesis, valuation, invalidation, and saved decision.',
        source: 'Research journal',
        sourceDate,
        displayDate,
        timezone: 'UTC',
        freshness: overdue ? 'overdue' : 'scheduled',
        urgency: overdue ? 'action' : 'upcoming',
        targetHref: reviewHref(input.symbol),
    };
};

const staleReviewEvent = (input: ResearchCalendarInput, start: string, end: string): ResearchCalendarEvent | null => {
    if (input.reviewAgeDays === null) return null;
    const sourceDate = addUtcDays(input.lastReviewedAt, input.reviewAgeDays);
    if (sourceDate >= start) return null;
    const displayDate = start;
    if (!inRange(displayDate, start, end)) return null;
    return {
        id: `${input.symbol}-stale-${sourceDate}`,
        symbol: input.symbol,
        market: input.market,
        type: 'stale',
        title: 'Research review is stale',
        detail: `The ${input.reviewAgeDays}-day review deadline passed on ${sourceDate}.`,
        source: 'Research journal',
        sourceDate,
        displayDate,
        timezone: 'UTC',
        freshness: 'overdue',
        urgency: 'action',
        targetHref: reviewHref(input.symbol),
    };
};

const earningsEvent = (input: ResearchCalendarInput, catalyst: ResearchCalendarCatalyst, start: string, end: string): ResearchCalendarEvent | null => {
    if (!inRange(catalyst.date, start, end)) return null;
    const timing = catalyst.timing === 'pre-market' ? 'Before market open' : catalyst.timing === 'after-hours' ? 'After market close' : 'Timing not supplied';
    return {
        id: `${input.symbol}-earnings-${catalyst.date}`,
        symbol: input.symbol,
        market: input.market,
        type: 'earnings',
        title: 'Earnings announcement',
        detail: `${timing}${catalyst.fiscalQuarterEnding ? ` · Fiscal quarter ${catalyst.fiscalQuarterEnding}` : ''}${catalyst.epsForecast ? ` · EPS forecast ${catalyst.epsForecast}` : ''}`,
        source: catalyst.source,
        sourceDate: catalyst.date,
        displayDate: catalyst.date,
        timezone: 'UTC',
        freshness: 'scheduled',
        urgency: 'upcoming',
        targetHref: earningsHref(input.symbol),
    };
};

const eventOrder = (left: ResearchCalendarEvent, right: ResearchCalendarEvent) =>
    left.displayDate.localeCompare(right.displayDate)
    || Number(right.urgency === 'action') - Number(left.urgency === 'action')
    || left.symbol.localeCompare(right.symbol)
    || left.type.localeCompare(right.type);

export const filterResearchCalendarEvents = (
    events: readonly ResearchCalendarEvent[],
    filters: Pick<ResearchCalendarQuery, 'market' | 'ticker' | 'type'>,
): readonly ResearchCalendarEvent[] => events.filter((event) =>
    (filters.market === 'ALL' || event.market === filters.market)
    && (filters.ticker === 'ALL' || event.symbol === filters.ticker)
    && (filters.type === 'ALL' || event.type === filters.type));

export const buildResearchCalendar = ({ inputs, catalysts, now, rangeDays, warnings = [] }: {
    readonly inputs: readonly ResearchCalendarInput[];
    readonly catalysts: readonly ResearchCalendarCatalyst[];
    readonly now: Date;
    readonly rangeDays: ResearchCalendarRange;
    readonly warnings?: readonly string[];
}): ResearchCalendarResponse => {
    const start = utcDate(now);
    const end = addUtcDays(start, rangeDays);
    const inputBySymbol = new Map(inputs.map((input) => [input.symbol, input]));
    const events: ResearchCalendarEvent[] = [];
    for (const input of inputs) {
        const review = scheduledReviewEvent(input, start, end);
        if (review) events.push(review);
        const stale = staleReviewEvent(input, start, end);
        if (stale) events.push(stale);
    }
    for (const catalyst of catalysts) {
        const input = inputBySymbol.get(catalyst.symbol);
        if (!input) continue;
        const event = earningsEvent(input, catalyst, start, end);
        if (event) events.push(event);
    }
    const unique = [...new Map(events.map((event) => [event.id, event])).values()].sort(eventOrder);
    return {
        generatedAt: now.toISOString(),
        rangeDays,
        timezone: 'UTC',
        events: unique,
        warnings: [...new Set(warnings)].slice(0, 5),
    };
};

export const getResearchCalendar = async (
    inputs: readonly ResearchCalendarInput[],
    query: ResearchCalendarQuery,
    now = new Date(),
    catalystFetcher: typeof fetchUpcomingCatalysts = fetchUpcomingCatalysts,
): Promise<ResearchCalendarResponse> => {
    const usSymbols = inputs
        .filter((input) => input.market === 'US' && input.earningsWithinDays !== null)
        .map((input) => input.symbol);
    const catalystResult = await Promise.allSettled([
        usSymbols.length > 0 ? catalystFetcher(usSymbols, query.rangeDays, now) : Promise.resolve(new Map()),
    ]);
    const catalystMap = catalystResult[0]?.status === 'fulfilled'
        ? catalystResult[0].value
        : new Map();
    const catalysts: ResearchCalendarCatalyst[] = [...catalystMap.entries()].map(([symbol, catalyst]) => ({ symbol, ...catalyst }));
    const calendar = buildResearchCalendar({
        inputs,
        catalysts,
        now,
        rangeDays: query.rangeDays,
        warnings: catalystResult[0]?.status === 'rejected' ? ['Upcoming earnings coverage is temporarily unavailable.'] : [],
    });
    return {
        ...calendar,
        events: filterResearchCalendarEvents(calendar.events, query),
    };
};
