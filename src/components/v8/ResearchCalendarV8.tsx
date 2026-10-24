'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildResearchCalendarRequest } from '@/lib/research/calendar-request';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import type { ResearchCalendarRange, ResearchCalendarResponse } from '@/lib/types/research-calendar';
import type { DiscoveryResponse } from '@/lib/types/research-discovery';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

type Kind = 'earnings' | 'review' | 'stale' | 'trending' | 'macro';
type Item = { id: string; date: string; kind: Kind; symbol?: string; market?: ResearchMarket; title: string; detail: string; href?: string; source?: string; action?: boolean };

const kindLabel: Record<Kind, string> = { earnings: 'Earnings', review: 'Review', stale: 'Overdue review', trending: 'Trending earnings', macro: 'Macro' };
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const visibleChips = 3;

const addDays = (value: string, days: number) => {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};
const addMonths = (month: string, months: number) => {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 7);
};
const weekday = (value: string) => new Date(`${value}T00:00:00Z`).getUTCDay();
const monthLabel = (month: string) => new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`));
const dayLabel = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const timingLabel = (timing: string | null | undefined) => timing === 'pre-market' ? 'before open' : timing === 'after-hours' ? 'after close' : 'time not supplied';

// Watchlist earnings and review dates, earnings already known for the trending list, and macro releases, on a month grid.
export function ResearchCalendarV8({ records, trending, onSelect }: { records: readonly ResearchRecord[] | null; trending: DiscoveryResponse | null; onSelect: (symbol: string, market: ResearchMarket) => void }) {
    const [range, setRange] = useState<ResearchCalendarRange>(30);
    const [now] = useState(() => Date.now());
    const today = new Date(now).toISOString().slice(0, 10);
    const [month, setMonth] = useState(today.slice(0, 7));
    const [selectedDay, setSelectedDay] = useState(today);
    const [result, setResult] = useState<{ key: string; data: ResearchCalendarResponse | null; error: string } | null>(null);
    // The calendar API takes unique symbols; the first saved market wins for a duplicated ticker.
    const body = useMemo(() => {
        const unique = [...new Map((records ?? []).map(record => [record.symbol, record])).values()].slice(0, 50);
        return JSON.stringify(buildResearchCalendarRequest(unique));
    }, [records]);
    const key = `${range}:${body}`;
    const hasRecords = !!records?.length;
    useEffect(() => {
        if (!hasRecords) return;
        const controller = new AbortController();
        fetch(`/api/research/calendar?range=${range}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal })
            .then(async response => parseResearchCalendarResponse(await response.json()))
            .then(data => setResult({ key, data, error: '' }))
            .catch(cause => { if (!controller.signal.aborted) setResult({ key, data: null, error: cause instanceof Error ? cause.message : 'The calendar is unavailable.' }); });
        return () => controller.abort();
    }, [hasRecords, range, body, key]);
    const current = result?.key === key ? result : null;
    const end = addDays(today, range);
    const firstMonth = today.slice(0, 7);
    const lastMonth = end.slice(0, 7);
    const activeMonth = month < firstMonth ? firstMonth : month > lastMonth ? lastMonth : month;

    // Watchlist events, trending earnings not already on the watchlist, and macro releases, in date order.
    const items: Item[] = [];
    for (const event of current?.data?.events ?? []) items.push({ id: event.id, date: event.displayDate, kind: event.type, symbol: event.symbol, market: event.market, title: event.title, detail: event.detail, source: event.freshness === 'overdue' ? `${event.source} · due ${event.sourceDate}` : event.source, action: event.urgency === 'action' });
    const saved = new Set(items.filter(item => item.kind === 'earnings').map(item => item.symbol));
    for (const row of [...(trending?.candidates ?? []), ...(trending?.contenders ?? [])]) {
        if (!row.catalyst || row.catalyst.date < today || row.catalyst.date > end || saved.has(row.symbol)) continue;
        items.push({ id: `trending:${row.symbol}`, date: row.catalyst.date, kind: 'trending', symbol: row.symbol, market: 'US', title: `${row.name} earnings`, detail: timingLabel(row.catalyst.timing), source: 'Trend scan' });
    }
    for (const event of current?.data?.macroEvents ?? []) items.push({ id: event.id, date: event.date, kind: 'macro', market: event.market, title: event.title, detail: event.timeLabel ?? 'Time not supplied', href: event.sourceUrl, source: event.source });
    items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
    const byDay = items.reduce((days, item) => days.set(item.date, [...(days.get(item.date) ?? []), item]), new Map<string, Item[]>());

    const monthStart = `${activeMonth}-01`;
    const monthEnd = addDays(`${addMonths(activeMonth, 1)}-01`, -1);
    const gridStart = addDays(monthStart, -weekday(monthStart));
    const gridDays = Array.from({ length: Math.ceil((weekday(monthStart) + Number(monthEnd.slice(-2))) / 7) * 7 }, (_, index) => addDays(gridStart, index));
    const selectedItems = byDay.get(selectedDay) ?? [];
    const upcoming = items.filter(item => item.date >= today).length;
    const status = !trending && !records ? 'Loading watchlist and trend scan…'
        : hasRecords && !current ? 'Loading watchlist dates…'
            : current?.error ? current.error : null;

    return <div className={styles.calendar}>
        <div className={styles.resultHead}>
            <p className={styles.meta}>{upcoming} {upcoming === 1 ? 'date' : 'dates'} in the next {range} days · earnings, reviews and macro releases. Dates are UTC.</p>
            <div className={styles.segment} aria-label="Calendar range">{([30, 90] as const).map(value => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value} days</button>)}</div>
        </div>
        {!hasRecords && records && <p className={styles.meta}>Add stocks to your watchlist to see their earnings and review dates here. Trending earnings are shown meanwhile.</p>}
        {status && <p role={current?.error ? 'alert' : 'status'} className={styles.meta}>{status}</p>}
        <ul className={styles.calendarLegend} aria-label="Calendar legend">{(['earnings', 'trending', 'review', 'stale', 'macro'] as const).map(kind => <li key={kind} data-kind={kind}><i aria-hidden="true" />{kindLabel[kind]}</li>)}</ul>
        <div className={styles.monthBar} role="group" aria-label="Calendar month">
            <button type="button" className={styles.todayButton} onClick={() => { setMonth(firstMonth); setSelectedDay(today); }}>Today</button>
            <button type="button" aria-label="Previous month" disabled={activeMonth <= firstMonth} onClick={() => setMonth(addMonths(activeMonth, -1))}>‹</button>
            <h3 aria-live="polite">{monthLabel(activeMonth)}</h3>
            <button type="button" aria-label="Next month" disabled={activeMonth >= lastMonth} onClick={() => setMonth(addMonths(activeMonth, 1))}>›</button>
        </div>
        <div className={styles.monthGrid} data-testid="research-calendar-grid">
            {weekdays.map(day => <span key={day} className={styles.weekday} aria-hidden="true">{day}</span>)}
            {gridDays.map(date => {
                const dayItems = byDay.get(date) ?? [];
                const inMonth = date.startsWith(activeMonth);
                const inRange = date >= today && date <= end;
                return <button key={date} type="button" className={styles.dayCell} data-in-month={inMonth} data-in-range={inRange} data-today={date === today} aria-pressed={date === selectedDay}
                    aria-label={`${dayLabel(date)}: ${dayItems.length ? dayItems.map(item => `${item.symbol ?? item.title} ${kindLabel[item.kind]}`).join(', ') : 'no events'}`}
                    onClick={() => setSelectedDay(date)}>
                    <time dateTime={date}>{Number(date.slice(-2))}</time>
                    {inMonth && dayItems.slice(0, visibleChips).map(item => <span key={item.id} className={styles.chip} data-kind={item.kind}>{item.symbol ?? kindLabel[item.kind]}</span>)}
                    {inMonth && dayItems.length > visibleChips && <span className={styles.more}>+{dayItems.length - visibleChips}</span>}
                </button>;
            })}
        </div>
        <section className={styles.agenda} aria-label="Selected day">
            <h3>{selectedDay === today ? `Today · ${dayLabel(selectedDay)}` : dayLabel(selectedDay)}</h3>
            {selectedItems.length === 0 ? <p className={styles.meta}>Nothing scheduled. Pick a day with a marker.</p>
                : <ul>{selectedItems.map(item => <li key={item.id} data-urgency={item.action ? 'action' : undefined}>
                    <span className={styles.badge} data-type={item.kind}>{kindLabel[item.kind]}</span>
                    {item.symbol && item.market ? <button className={styles.link} onClick={() => onSelect(item.symbol!, item.market!)}>{item.symbol}</button> : <span />}
                    <span><b>{item.title}</b><small>{item.detail}{item.source ? ` · ${item.source}` : ''}{item.href && <> · <a href={item.href} target="_blank" rel="noopener noreferrer">Source ↗</a></>}</small></span>
                </li>)}</ul>}
        </section>
        {current?.data?.warnings.map(warning => <p key={warning} className={styles.meta}>{warning}</p>)}
        {current?.data && <p className={styles.meta}>Watchlist dates retrieved {retrievedAt(current.data.generatedAt)}.</p>}
    </div>;
}
