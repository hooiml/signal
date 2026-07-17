'use client';

import { useEffect, useMemo, useState } from 'react';
import { filterResearchCalendarEvents } from '@/lib/research/calendar';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import {
    calendarDateChanges,
    mergeResearchCalendarDateState,
    parseResearchCalendarDateState,
    RESEARCH_CALENDAR_DATE_STATE_KEY,
    snapshotResearchCalendarDates,
    type ResearchCalendarDateState,
} from '@/lib/research/calendar-state';
import type {
    ResearchCalendarEvent,
    ResearchCalendarEventType,
    ResearchCalendarRange,
    ResearchCalendarResponse,
} from '@/lib/types/research-calendar';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type CalendarView = 'list' | 'calendar';
type FilterValue = 'ALL';

const addUtcDays = (value: string, days: number) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

const utcWeekday = (value: string) => new Date(`${value}T00:00:00.000Z`).getUTCDay();

const addUtcMonths = (value: string, months: number) => {
    const date = new Date(`${value}-01T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 7);
};

const formatUtcMonth = (value: string) => new Intl.DateTimeFormat(undefined, {
    month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${value}-01T00:00:00.000Z`));

const calendarEventTone = (event: ResearchCalendarEvent, theme: ResearchThemeV6) => {
    if (event.type === 'stale') return theme === 'light'
        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
        : 'border-rose-400/25 bg-rose-400/8 text-rose-200 hover:bg-rose-400/12';
    if (event.type === 'earnings') return theme === 'light'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
        : 'border-emerald-400/25 bg-emerald-400/8 text-emerald-200 hover:bg-emerald-400/12';
    return theme === 'light'
        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
        : 'border-slate-400/20 bg-slate-400/6 text-slate-200 hover:bg-slate-400/10';
};

const eventTypeLabel = (type: ResearchCalendarEventType) => type === 'earnings' ? 'Earnings' : type === 'stale' ? 'Stale review' : 'Scheduled review';

const eventButtonLabel = (event: ResearchCalendarEvent) => event.type === 'earnings'
    ? `Open ${event.symbol} earnings in Events`
    : `Open ${event.symbol} review workflow`;

const CalendarEventCard = ({ event, priorDate, theme, onOpen }: {
    readonly event: ResearchCalendarEvent;
    readonly priorDate: string | undefined;
    readonly theme: ResearchThemeV6;
    readonly onOpen: (targetHref: string) => void;
}) => {
    const styles = getThemeV6(theme);
    return (
        <article data-calendar-event className={'rounded-lg border p-4 ' + styles.row}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={'rounded-full border px-2 py-1 text-[11px] font-medium ' + (event.urgency === 'action' ? styles.risk : styles.textMuted)}>{eventTypeLabel(event.type)}</span>
                        <span className={'text-sm font-semibold ' + styles.textPrimary}>{event.symbol}</span>
                        <span className={'text-xs ' + styles.textMuted}>{event.market}</span>
                    </div>
                    <h3 className={'mt-3 text-base font-semibold ' + styles.textPrimary}>{event.title}</h3>
                    <p className={'mt-1 text-sm leading-5 ' + styles.textSecondary}>{event.detail}</p>
                    <p className={'mt-2 text-xs ' + styles.textMuted}>{event.source} · source date {event.sourceDate} UTC</p>
                    {priorDate ? <p className={'mt-1 text-xs font-medium ' + styles.risk}>Date changed from {priorDate} UTC</p> : null}
                    {event.freshness === 'overdue' ? <p className={'mt-1 text-xs font-medium ' + styles.risk}>Overdue · surfaced today</p> : null}
                </div>
                <button type="button" aria-label={eventButtonLabel(event)} onClick={() => onOpen(event.targetHref)} className="min-h-10 shrink-0 rounded-md bg-emerald-500 px-3 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
                    Open
                </button>
            </div>
        </article>
    );
};

const CompactCalendarEvent = ({ event, priorDate, theme, onOpen }: {
    readonly event: ResearchCalendarEvent;
    readonly priorDate: string | undefined;
    readonly theme: ResearchThemeV6;
    readonly onOpen: (targetHref: string) => void;
}) => (
    <button
        type="button"
        data-calendar-event
        data-calendar-event-chip
        aria-label={eventButtonLabel(event)}
        title={`${event.title} — ${event.detail} · ${event.source}`}
        onClick={() => onOpen(event.targetHref)}
        className={'group w-full rounded border px-2 py-1 text-left leading-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-500 active:translate-y-px ' + calendarEventTone(event, theme)}
    >
        <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-[10px] font-medium">{event.symbol}</span>
            <span aria-hidden="true" className="opacity-45">·</span>
            <span className="truncate text-[10px] font-normal">{eventTypeLabel(event.type)}</span>
            {priorDate ? <span aria-label={`Date changed from ${priorDate} UTC`} className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" /> : null}
        </span>
    </button>
);

export const ResearchCalendarV6 = ({ records, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (targetHref: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const [rangeDays, setRangeDays] = useState<ResearchCalendarRange>(30);
    const [calendar, setCalendar] = useState<ResearchCalendarResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [view, setView] = useState<CalendarView>('list');
    const [market, setMarket] = useState<ResearchMarket | FilterValue>('ALL');
    const [ticker, setTicker] = useState<string | FilterValue>('ALL');
    const [eventType, setEventType] = useState<ResearchCalendarEventType | FilterValue>('ALL');
    const [visibleMonth, setVisibleMonth] = useState<string | null>(null);
    const [dateChanges, setDateChanges] = useState<ResearchCalendarDateState>({});

    const requestBody = useMemo(() => records.map((record) => ({
        symbol: record.symbol,
        market: record.market,
        nextReviewAt: record.decisionJournal.nextReviewAt,
        lastReviewedAt: record.lastReviewedAt,
        reviewAgeDays: record.monitoringRules.reviewAgeDays,
        earningsWithinDays: record.monitoringRules.earningsWithinDays,
    })), [records]);
    const requestKey = JSON.stringify(requestBody);

    useEffect(() => {
        const controller = new AbortController();
        const loadCalendar = async () => {
            const inputCount = (JSON.parse(requestKey) as readonly unknown[]).length;
            if (inputCount === 0) {
                const generatedAt = new Date().toISOString();
                setCalendar({ generatedAt, rangeDays, timezone: 'UTC', events: [], warnings: [] });
                setVisibleMonth(generatedAt.slice(0, 7));
                setLoading(false);
                return;
            }
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/research/calendar?range=${rangeDays}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: requestKey,
                    signal: controller.signal,
                });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && !Array.isArray(payload) && typeof Object.fromEntries(Object.entries(payload)).error === 'string'
                    ? String(Object.fromEntries(Object.entries(payload)).error) : 'Unable to load the research calendar.');
                const parsed = parseResearchCalendarResponse(payload);
                if (controller.signal.aborted) return;
                setCalendar(parsed);
                setVisibleMonth((current) => {
                    const firstMonth = parsed.generatedAt.slice(0, 7);
                    const lastMonth = addUtcDays(parsed.generatedAt.slice(0, 10), parsed.rangeDays).slice(0, 7);
                    return current && current >= firstMonth && current <= lastMonth ? current : firstMonth;
                });
                try {
                    const previous = parseResearchCalendarDateState(JSON.parse(window.localStorage.getItem(RESEARCH_CALENDAR_DATE_STATE_KEY) ?? '{}'));
                    setDateChanges(calendarDateChanges(previous, parsed.events));
                    const currentDates = snapshotResearchCalendarDates(parsed.events);
                    window.localStorage.setItem(RESEARCH_CALENDAR_DATE_STATE_KEY, JSON.stringify(mergeResearchCalendarDateState(previous, currentDates, parsed.warnings.length > 0)));
                } catch {
                    setDateChanges({});
                }
            } catch (requestError) {
                if (controller.signal.aborted) return;
                setError(requestError instanceof Error ? requestError.message : 'Unable to load the research calendar.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void loadCalendar();
        return () => controller.abort();
    }, [rangeDays, requestKey, retryKey]);

    const events = useMemo(() => filterResearchCalendarEvents(calendar?.events ?? [], { market, ticker, type: eventType }), [calendar?.events, eventType, market, ticker]);
    const tickerOptions = useMemo(() => [...new Set((calendar?.events ?? []).map((event) => event.symbol))].sort(), [calendar?.events]);
    const startDate = calendar?.generatedAt.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const endDate = useMemo(() => addUtcDays(startDate, rangeDays), [rangeDays, startDate]);
    const firstMonth = startDate.slice(0, 7);
    const lastMonth = endDate.slice(0, 7);
    const activeMonth = visibleMonth ?? firstMonth;
    const monthStartDate = `${activeMonth}-01`;
    const monthEndDate = addUtcDays(`${addUtcMonths(activeMonth, 1)}-01`, -1);
    const calendarStartDate = useMemo(() => addUtcDays(monthStartDate, -utcWeekday(monthStartDate)), [monthStartDate]);
    const calendarEndDate = useMemo(() => addUtcDays(monthEndDate, 6 - utcWeekday(monthEndDate)), [monthEndDate]);
    const calendarDates = useMemo(() => {
        const dayCount = Math.round((new Date(`${calendarEndDate}T00:00:00.000Z`).getTime() - new Date(`${calendarStartDate}T00:00:00.000Z`).getTime()) / 86_400_000) + 1;
        return Array.from({ length: dayCount }, (_, index) => addUtcDays(calendarStartDate, index));
    }, [calendarEndDate, calendarStartDate]);
    const calendarWeeks = useMemo(() => Array.from({ length: calendarDates.length / 7 }, (_, index) => calendarDates.slice(index * 7, (index + 1) * 7)), [calendarDates]);
    const inputClass = 'min-h-10 rounded-md border bg-transparent px-3 text-sm font-normal outline-none focus:border-emerald-500 ' + styles.textPrimary;
    const monthNavButtonClass = 'flex h-9 w-9 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-30 active:translate-y-px ' + styles.textMuted + (theme === 'light' ? ' hover:bg-slate-100' : ' hover:bg-white/5');

    return (
        <section aria-labelledby="research-calendar-title" className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className={'text-xs font-medium uppercase tracking-[0.12em] ' + styles.textMuted}>Research schedule</p>
                    <h1 id="research-calendar-title" className={'mt-1 text-xl font-medium ' + styles.textPrimary}>Catalyst and review calendar</h1>
                    <p className={'mt-2 max-w-2xl text-sm leading-5 ' + styles.textSecondary}>UTC source dates with browser-local viewing context. Opening an event never changes a saved decision or checklist.</p>
                    <p className={'mt-1 text-xs font-normal ' + styles.textMuted}>UTC source dates · generated {calendar ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(calendar.generatedAt)) : 'when loaded'} local time</p>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Calendar range">
                    {([30, 90] as const).map((range) => <button key={range} type="button" aria-pressed={rangeDays === range} onClick={() => setRangeDays(range)} className={'min-h-10 rounded-md border px-3 text-xs font-medium ' + (rangeDays === range ? styles.selectedRow : styles.row)}>{range} days</button>)}
                </div>
            </div>

            <div className={'mt-5 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-[auto_1fr_1fr_1fr] ' + styles.cell + ' ' + styles.divider}>
                <div className="flex gap-2" role="group" aria-label="Calendar presentation">
                    <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')} className={'min-h-10 rounded-md border px-3 text-xs font-medium ' + (view === 'list' ? styles.selectedRow : styles.row)}>List view</button>
                    <button type="button" aria-pressed={view === 'calendar'} onClick={() => setView('calendar')} className={'min-h-10 rounded-md border px-3 text-xs font-medium ' + (view === 'calendar' ? styles.selectedRow : styles.row)}>Calendar view</button>
                </div>
                <label className={'text-xs font-medium ' + styles.textMuted}>Market
                    <select aria-label="Calendar market" value={market} onChange={(event) => setMarket(event.target.value as ResearchMarket | FilterValue)} className={'mt-1 w-full ' + inputClass}><option value="ALL">All markets</option><option value="US">US</option><option value="MY">MY</option></select>
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Ticker
                    <select aria-label="Calendar ticker" value={ticker} onChange={(event) => setTicker(event.target.value)} className={'mt-1 w-full ' + inputClass}><option value="ALL">All tickers</option>{tickerOptions.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}</select>
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Event type
                    <select aria-label="Event type" value={eventType} onChange={(event) => setEventType(event.target.value as ResearchCalendarEventType | FilterValue)} className={'mt-1 w-full ' + inputClass}><option value="ALL">All events</option><option value="review">Scheduled reviews</option><option value="earnings">Earnings</option><option value="stale">Stale reviews</option></select>
                </label>
            </div>

            {calendar?.warnings.map((warning) => <p key={warning} role="status" className={'mt-3 rounded-md border px-3 py-2 text-xs ' + styles.risk}>{warning}</p>)}
            {loading ? <div role="status" className={'mt-4 rounded-lg border p-6 text-sm ' + styles.panel + ' ' + styles.textSecondary}>Loading catalyst and review dates...</div> : null}
            {!loading && error ? <div role="alert" className={'mt-4 rounded-lg border p-6 ' + styles.panel}><p className={'text-sm ' + styles.risk}>{error}</p><button type="button" onClick={() => setRetryKey((current) => current + 1)} className="mt-3 min-h-10 rounded-md border border-current px-3 text-xs font-bold">Retry</button></div> : null}
            {!loading && !error && events.length === 0 ? <div className={'mt-4 rounded-lg border p-6 text-center ' + styles.panel}><h2 className={'text-base font-bold ' + styles.textPrimary}>No events in this view</h2><p className={'mt-2 text-sm ' + styles.textMuted}>Try a longer range or broaden the market, ticker, or event-type filters.</p></div> : null}

            {!loading && !error && events.length > 0 && view === 'list' ? <div className="mt-4 space-y-3">{events.map((event) => <CalendarEventCard key={event.id} event={event} priorDate={dateChanges[event.id]} theme={theme} onOpen={onOpen} />)}</div> : null}

            {!loading && !error && events.length > 0 && view === 'calendar' ? <>
                <div data-calendar-toolbar className="mt-4 flex items-center justify-between gap-3" role="group" aria-label="Calendar month navigation">
                    <button type="button" onClick={() => setVisibleMonth(firstMonth)} className={'min-h-9 rounded-md px-2 text-xs font-medium transition-colors active:translate-y-px ' + styles.textSecondary + (theme === 'light' ? ' hover:bg-slate-100' : ' hover:bg-white/5')}>Today</button>
                    <div className="flex items-center gap-1">
                        <button type="button" aria-label="Previous month" title="Previous month" disabled={activeMonth <= firstMonth} onClick={() => setVisibleMonth(addUtcMonths(activeMonth, -1))} className={monthNavButtonClass}><span aria-hidden="true" className="block h-2 w-2 rotate-[135deg] border-b border-r border-current" /></button>
                        <h2 data-calendar-month-label aria-live="polite" className={'min-w-24 text-center text-sm font-medium ' + styles.textPrimary}>{formatUtcMonth(activeMonth)}</h2>
                        <button type="button" aria-label="Next month" title="Next month" disabled={activeMonth >= lastMonth} onClick={() => setVisibleMonth(addUtcMonths(activeMonth, 1))} className={monthNavButtonClass}><span aria-hidden="true" className="block h-2 w-2 -rotate-45 border-b border-r border-current" /></button>
                    </div>
                </div>
                <div className="research-scrollbar mt-2 max-w-full overflow-x-auto rounded-lg border">
                    <div data-calendar-grid className="min-w-[840px]">
                        <div className={'grid grid-cols-7 border-b ' + styles.divider + ' ' + styles.statusSurface}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} data-calendar-weekday className={'px-2 py-2 text-[11px] font-medium ' + styles.textMuted}>{day}</div>)}
                        </div>
                        {calendarWeeks.map((week) => <div key={week[0]} data-calendar-week className={'grid grid-cols-7 divide-x border-b last:border-b-0 ' + styles.divider}>
                            {week.map((date) => {
                                const isInVisibleMonth = date.startsWith(activeMonth);
                                const dayEvents = isInVisibleMonth ? events.filter((event) => event.displayDate === date) : [];
                                const isInRange = isInVisibleMonth && date >= startDate && date <= endDate;
                                const isToday = date === startDate;
                                return <div key={date} data-calendar-day data-date={date} className={'min-h-24 min-w-0 p-2 ' + styles.cell + (isInRange ? '' : ' opacity-45')}>
                                    <div className="mb-2 flex items-center gap-2">
                                        <time dateTime={date} className={'flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-medium ' + (isToday ? 'bg-emerald-500 text-slate-950' : styles.textSecondary)}>{Number(date.slice(-2))}</time>
                                    </div>
                                    <div className="space-y-1">
                                        {dayEvents.map((event) => <CompactCalendarEvent key={event.id} event={event} priorDate={dateChanges[event.id]} theme={theme} onOpen={onOpen} />)}
                                    </div>
                                </div>;
                            })}
                        </div>)}
                    </div>
                    <p className={'sticky left-0 border-t px-3 py-2 text-[10px] sm:hidden ' + styles.divider + ' ' + styles.textMuted}>Swipe horizontally to see the full week.</p>
                </div>
            </> : null}
        </section>
    );
};
