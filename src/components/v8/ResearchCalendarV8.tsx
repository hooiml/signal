'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildResearchCalendarRequest } from '@/lib/research/calendar-request';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import { earningsCalendarInput, earningsTimingLabel, nextEarningsEvent, type EarningsCalendarTarget } from '@/lib/research/earnings-ticket';
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
const kindOrder: readonly Kind[] = ['earnings', 'trending', 'review', 'stale', 'macro'];
// Six weeks hold any 30-day window from today; a 90-day window pages in six-week blocks.
const weeksPerPage = 6;

const addDays = (value: string, days: number) => {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};
const weekday = (value: string) => new Date(`${value}T00:00:00Z`).getUTCDay();
const shortDate = (value: string, year = false) => new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const dayLabel = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const timingLabel = (timing: string | null | undefined) => timing === 'pre-market' ? 'before open' : timing === 'after-hours' ? 'after close' : 'time not supplied';

// Watchlist earnings and review dates, earnings already known for the trending list, and macro releases, on a week grid that starts this week.
export function ResearchCalendarV8({ records, trending, target, onSelect }: { records: readonly ResearchRecord[] | null; trending: DiscoveryResponse | null; target?: EarningsCalendarTarget; onSelect: (symbol: string, market: ResearchMarket) => void }) {
    const [range, setRange] = useState<ResearchCalendarRange>(30);
    const [now] = useState(() => Date.now());
    const today = new Date(now).toISOString().slice(0, 10);
    const [page, setPage] = useState(0);
    const targetInRange = !!target && target.date >= today && target.date <= addDays(today, 30);
    const [selectedDay, setSelectedDay] = useState(targetInRange ? target!.date : today);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{ key: string; data: ResearchCalendarResponse | null; error: string } | null>(null);
    // The calendar API takes unique symbols; the first saved market wins for a duplicated ticker.
    const body = useMemo(() => {
        if (target) return JSON.stringify(earningsCalendarInput(target.symbol, target.market));
        const unique = [...new Map((records ?? []).map(record => [record.symbol, record])).values()].slice(0, 50);
        return JSON.stringify(buildResearchCalendarRequest(unique));
    }, [records, target]);
    const key = `${range}:${body}:${attempt}`;
    const hasRecords = target ? target.market === 'US' : !!records?.length;
    const query = target ? `range=30&type=earnings&market=${target.market}&ticker=${encodeURIComponent(target.symbol)}` : `range=${range}`;
    useEffect(() => {
        if (!hasRecords) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); setResult({ key, data: null, error: 'The calendar is unavailable.' }); }, 15_000);
        fetch(`/api/research/calendar?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal })
            .then(async response => { if (!response.ok) throw new Error('The calendar is unavailable.'); return parseResearchCalendarResponse(await response.json()); })
            .then(data => { if (target) nextEarningsEvent(data, target.symbol, target.market, today); if (!controller.signal.aborted) setResult({ key, data, error: '' }); })
            .catch(cause => { if (!controller.signal.aborted) setResult({ key, data: null, error: cause instanceof Error ? cause.message : 'The calendar is unavailable.' }); })
            .finally(() => clearTimeout(timeout));
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [hasRecords, query, body, key, target, today]);
    const current = result?.key === key ? result : null;
    const end = addDays(today, range);
    const firstWeek = addDays(today, -weekday(today));
    const pageCount = Math.ceil((weekday(today) + range + 1) / 7 / weeksPerPage);
    const activePage = Math.min(page, pageCount - 1);

    // Watchlist events, trending earnings not already on the watchlist, and macro releases, in date order.
    const items: Item[] = [];
    for (const event of current?.data?.events ?? []) items.push({ id: event.id, date: event.displayDate, kind: event.type, symbol: event.symbol, market: event.market, title: event.title, detail: target && event.type === 'earnings' ? `${earningsTimingLabel(event.earningsTiming)} · Date unconfirmed` : event.detail, source: event.freshness === 'overdue' ? `${event.source} · due ${event.sourceDate}` : event.source, action: event.urgency === 'action' });
    const saved = new Set(items.filter(item => item.kind === 'earnings').map(item => item.symbol));
    for (const row of target ? [] : [...(trending?.candidates ?? []), ...(trending?.contenders ?? [])]) {
        if (!row.catalyst || row.catalyst.date < today || row.catalyst.date > end || saved.has(row.symbol)) continue;
        items.push({ id: `trending:${row.symbol}`, date: row.catalyst.date, kind: 'trending', symbol: row.symbol, market: 'US', title: `${row.name} earnings`, detail: timingLabel(row.catalyst.timing), source: 'Trend scan' });
    }
    for (const event of current?.data?.macroEvents ?? []) items.push({ id: event.id, date: event.date, kind: 'macro', market: event.market, title: event.title, detail: event.timeLabel ?? 'Time not supplied', href: event.sourceUrl, source: event.source });
    items.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
    const byDay = items.reduce((days, item) => days.set(item.date, [...(days.get(item.date) ?? []), item]), new Map<string, Item[]>());

    const gridStart = addDays(firstWeek, activePage * weeksPerPage * 7);
    const pageWeeks = Math.min(weeksPerPage, Math.ceil((weekday(today) + range + 1) / 7) - activePage * weeksPerPage);
    const gridDays = Array.from({ length: pageWeeks * 7 }, (_, index) => addDays(gridStart, index));
    const pageFrom = gridDays[0] < today ? today : gridDays[0];
    const pageTo = gridDays[gridDays.length - 1] > end ? end : gridDays[gridDays.length - 1];
    const shownKinds = kindOrder.filter(kind => items.some(item => item.kind === kind));
    const selectedItems = byDay.get(selectedDay) ?? [];
    const upcoming = items.filter(item => item.date >= today).length;
    const status = !target && !trending && !records ? 'Loading watchlist and trend scan…'
        : hasRecords && !current ? 'Loading watchlist dates…'
            : current?.error ? current.error : null;

    return <div className={styles.calendar}>
        <div className={styles.resultHead}>
            <p className={styles.meta}>{target ? `${target.symbol} · ${target.market} earnings` : 'Earnings, reviews and macro releases'} · {upcoming} {upcoming === 1 ? 'date' : 'dates'} in the next {range} days. Dates are UTC.</p>
            {!target && <div className={styles.segment} aria-label="Calendar range">{([30, 90] as const).map(value => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value} days</button>)}</div>}
        </div>
        {target && !targetInRange && <p className={styles.meta}>The linked date is outside the current 30-day window. Showing current dates.</p>}
        {target?.market === 'MY' && <p className={styles.meta}>Malaysia earnings coverage is unavailable.</p>}
        {!target && !hasRecords && records && <p className={styles.meta}>Add stocks to your watchlist to see their earnings and review dates here. Trending earnings are shown meanwhile.</p>}
        {status && <p role={current?.error ? 'alert' : 'status'} className={styles.meta}>{status}{current?.error && <> <button className={styles.link} onClick={() => setAttempt(value => value + 1)}>Retry calendar</button></>}</p>}
        {shownKinds.length > 0 && <ul className={styles.calendarLegend} aria-label="Calendar legend">{shownKinds.map(kind => <li key={kind} data-kind={kind}><i aria-hidden="true" />{kindLabel[kind]}</li>)}</ul>}
        <div className={styles.monthBar} role="group" aria-label="Calendar weeks">
            <button type="button" className={styles.todayButton} onClick={() => { setPage(0); setSelectedDay(today); }}>Today</button>
            {pageCount > 1 && <button type="button" aria-label="Earlier weeks" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>‹</button>}
            <h3 aria-live="polite">{shortDate(pageFrom)} – {shortDate(pageTo, true)}</h3>
            {pageCount > 1 && <button type="button" aria-label="Later weeks" disabled={activePage >= pageCount - 1} onClick={() => setPage(activePage + 1)}>›</button>}
        </div>
        <div className={styles.monthGrid} data-testid="research-calendar-grid">
            {weekdays.map(day => <span key={day} className={styles.weekday} aria-hidden="true">{day}</span>)}
            {gridDays.map(date => {
                const dayItems = byDay.get(date) ?? [];
                const inRange = date >= today && date <= end;
                return <button key={date} type="button" className={styles.dayCell} data-in-range={inRange} data-today={date === today} aria-pressed={date === selectedDay}
                    aria-label={`${dayLabel(date)}: ${dayItems.length ? dayItems.map(item => `${item.symbol ?? item.title} ${kindLabel[item.kind]}`).join(', ') : 'no events'}`}
                    onClick={() => setSelectedDay(date)}>
                    <time dateTime={date}>{date.endsWith('-01') || date === gridDays[0] ? shortDate(date) : Number(date.slice(-2))}</time>
                    {dayItems.slice(0, visibleChips).map(item => <span key={item.id} className={styles.chip} data-kind={item.kind}>{item.symbol ?? kindLabel[item.kind]}</span>)}
                    {dayItems.length > visibleChips && <span className={styles.more}>+{dayItems.length - visibleChips}</span>}
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
        {current?.data && <p className={styles.meta}>{target ? 'Earnings' : 'Watchlist'} dates retrieved {retrievedAt(current.data.generatedAt)}.</p>}
    </div>;
}
