'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import { V9Navigation } from '@/components/v9/v9-navigation';
import { getHomeSessionContext } from '@/lib/home-schedule';
import {
    DIVIDEND_CASH_FLOW_CHANGE_EVENT,
    DIVIDEND_CASH_FLOW_STORAGE_KEY,
    loadDividendCashFlowSnapshot,
    type DividendCashFlowLoadResult,
} from '@/lib/portfolio/dividend-cashflow-client';
import { buildResearchCalendarRequest } from '@/lib/research/calendar-request';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import { earningsCalendarInput, earningsTimingLabel, nextEarningsEvent, type EarningsCalendarTarget } from '@/lib/research/earnings-ticket';
import { researchListingKey } from '@/lib/research/listing-identity';
import type { ResearchCalendarRange, ResearchCalendarResponse } from '@/lib/types/research-calendar';
import type { DiscoveryResponse } from '@/lib/types/research-discovery';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

type Kind = 'earnings' | 'review' | 'stale' | 'trending' | 'macro' | 'dividend';
type KindFilter = 'all' | 'earnings' | 'reviews' | 'macro' | 'trending' | 'dividend';
type Item = { id: string; date: string; kind: Kind; symbol?: string; market?: ResearchMarket; title: string; detail: string; href?: string; source?: string; action?: boolean };

const kindLabel: Record<Kind, string> = { earnings: 'Earnings', review: 'Review', stale: 'Overdue review', trending: 'Trending earnings', macro: 'Macro', dividend: 'Dividend' };
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const visibleChips = 3;
const kindOrder: readonly Kind[] = ['earnings', 'trending', 'review', 'stale', 'macro', 'dividend'];
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
const formatAmountPerShare = (amount: number | null, currency: string) =>
    amount === null ? null : `${currency} ${amount.toFixed(4).replace(/\.?0+$/, '')}/sh`;

// Watchlist earnings and review dates, earnings already known for the trending list, and macro releases, on a week grid that starts this week.
export function ResearchCalendarV8({ records, trending, target, onSelect }: { records: readonly ResearchRecord[] | null; trending: DiscoveryResponse | null; target?: EarningsCalendarTarget; onSelect: (symbol: string, market: ResearchMarket) => void }) {
    const isV9 = Boolean(useContext(V9Navigation));
    const [range, setRange] = useState<ResearchCalendarRange>(30);
    const [now] = useState(() => Date.now());
    const today = new Date(now).toISOString().slice(0, 10);
    const [page, setPage] = useState(0);
    const targetInRange = !!target && target.date >= today && target.date <= addDays(today, 30);
    const [selectedDay, setSelectedDay] = useState(targetInRange ? target!.date : today);
    const [kindFilter, setKindFilter] = useState<KindFilter>('all');
    const [showDividends, setShowDividends] = useState(false);
    const [dividendState, setDividendState] = useState<DividendCashFlowLoadResult | null>(null);
    const [showEmptyGrid, setShowEmptyGrid] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{ key: string; data: ResearchCalendarResponse | null; error: string } | null>(null);
    const body = useMemo(() => {
        if (target) return JSON.stringify(earningsCalendarInput(target.symbol, target.market));
        const unique = [...new Map((records ?? []).map(record => [researchListingKey(record.market, record.symbol), record])).values()].slice(0, 50);
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

    useEffect(() => {
        if (!isV9 || target || !showDividends) return;
        const refresh = () => setDividendState(loadDividendCashFlowSnapshot());
        const timer = window.setTimeout(refresh, 0);
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === DIVIDEND_CASH_FLOW_STORAGE_KEY) refresh();
        };
        window.addEventListener(DIVIDEND_CASH_FLOW_CHANGE_EVENT, refresh);
        window.addEventListener('storage', onStorage);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener(DIVIDEND_CASH_FLOW_CHANGE_EVENT, refresh);
            window.removeEventListener('storage', onStorage);
        };
    }, [isV9, showDividends, target]);

    const current = result?.key === key ? result : null;
    const end = addDays(today, range);
    const firstWeek = addDays(today, -weekday(today));
    const pageCount = Math.ceil((weekday(today) + range + 1) / 7 / weeksPerPage);
    const activePage = Math.min(page, pageCount - 1);
    const sessionContext = useMemo(() => isV9 ? getHomeSessionContext(new Date(now)) : null, [isV9, now]);

    // Watchlist events, trending earnings not already on the watchlist, macro releases, and optional local dividend dates, in date order.
    const allItems: Item[] = [];
    const watchlistEvents = current?.data?.events ?? [];
    for (const event of watchlistEvents) allItems.push({ id: event.id, date: event.displayDate, kind: event.type, symbol: event.symbol, market: event.market, title: event.title, detail: target && event.type === 'earnings' ? `${earningsTimingLabel(event.earningsTiming)} · Date unconfirmed` : event.detail, source: event.freshness === 'overdue' ? `${event.source} · due ${event.sourceDate}` : event.source, action: event.urgency === 'action' });
    const scheduledEarnings = new Set(watchlistEvents.filter(event => event.type === 'earnings').map(event => researchListingKey(event.market, event.symbol)));
    for (const row of target ? [] : [...(trending?.candidates ?? []), ...(trending?.contenders ?? [])]) {
        const listing = researchListingKey('US', row.symbol);
        if (!row.catalyst || row.catalyst.date < today || row.catalyst.date > end || scheduledEarnings.has(listing)) continue;
        allItems.push({ id: `trending:${listing}`, date: row.catalyst.date, kind: 'trending', symbol: row.symbol, market: 'US', title: `${row.name} earnings`, detail: timingLabel(row.catalyst.timing), source: 'Trend scan' });
        scheduledEarnings.add(listing);
    }
    for (const event of current?.data?.macroEvents ?? []) allItems.push({ id: event.id, date: event.date, kind: 'macro', market: event.market, title: event.title, detail: event.timeLabel ?? 'Time not supplied', href: event.sourceUrl, source: event.source });

    if (isV9 && !target && showDividends && dividendState?.status === 'ready') {
        for (const event of dividendState.snapshot.events) {
            if (event.kind !== 'dividend') continue;
            const perShare = formatAmountPerShare(event.amountPerShare, event.currency);
            if (event.exDate && event.exDate >= today && event.exDate <= end) {
                allItems.push({
                    id: `dividend-ex:${event.id}`,
                    date: event.exDate,
                    kind: 'dividend',
                    symbol: event.symbol,
                    market: event.market,
                    title: `${event.symbol} ex-dividend`,
                    detail: perShare ? `Ex-dividend · ${perShare}` : 'Ex-dividend date',
                    source: 'Local dividend plan',
                });
            }
            if (event.paymentDate && event.paymentDate >= today && event.paymentDate <= end) {
                allItems.push({
                    id: `dividend-pay:${event.id}`,
                    date: event.paymentDate,
                    kind: 'dividend',
                    symbol: event.symbol,
                    market: event.market,
                    title: `${event.symbol} dividend payment`,
                    detail: perShare ? `Payment · ${perShare}` : 'Dividend payment date',
                    source: 'Local dividend plan',
                });
            }
        }
    }

    const listings = new Set((records ?? []).map(record => researchListingKey(record.market, record.symbol)));
    for (const { symbol, market } of allItems) {
        if (symbol && market) listings.add(researchListingKey(market, symbol));
    }
    const itemLabel = (item: Item) => item.symbol && item.market && listings.has(researchListingKey(item.market === 'US' ? 'MY' : 'US', item.symbol))
        ? `${item.symbol} · ${item.market}`
        : item.symbol ?? item.title;

    allItems.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
    const effectiveFilter: KindFilter = (!showDividends && kindFilter === 'dividend') ? 'all' : kindFilter;
    const items = (isV9 && !target && effectiveFilter !== 'all')
        ? allItems.filter(item => {
            if (effectiveFilter === 'reviews') return item.kind === 'review' || item.kind === 'stale';
            return item.kind === effectiveFilter;
        })
        : allItems;
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

    const filterOptions: readonly { readonly id: KindFilter; readonly label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'earnings', label: 'Earnings' },
        { id: 'reviews', label: 'Reviews' },
        { id: 'macro', label: 'Macro' },
        { id: 'trending', label: 'Trending' },
        ...(showDividends ? [{ id: 'dividend' as const, label: 'Dividends' }] : []),
    ];

    return <div className={styles.calendar}>
        <div className={styles.resultHead}>
            <div className={styles.calendarLead}>
                <p className={styles.meta}>{target ? `${target.symbol} · ${target.market} earnings` : 'Earnings, reviews and macro releases'} · {upcoming} {upcoming === 1 ? 'date' : 'dates'} in the next {range} days. Dates are UTC.</p>
                {isV9 && !target && sessionContext && (
                    <span className={styles.sessionPill} data-weekend={sessionContext.isWeekend ? 'true' : undefined} data-testid="calendar-session-rhythm">
                        {sessionContext.sessionLabel} · {sessionContext.secondaryLabel}
                    </span>
                )}
            </div>
            {!target && <div className={styles.segment} aria-label="Calendar range">{([30, 90] as const).map(value => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value} days</button>)}</div>}
        </div>
        {isV9 && !target && (
            <div className={styles.calendarToolbar}>
                <div className={styles.filterBar} data-testid="calendar-kind-filters" role="group" aria-label="Filter calendar event kinds">
                    {filterOptions.map(option => (
                        <button
                            key={option.id}
                            type="button"
                            className={styles.filterChip}
                            aria-pressed={effectiveFilter === option.id}
                            onClick={() => setKindFilter(option.id)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={styles.filterChip}
                    data-testid="calendar-dividend-toggle"
                    aria-pressed={showDividends}
                    onClick={() => setShowDividends(value => !value)}
                >
                    Local dividend dates
                </button>
            </div>
        )}
        {isV9 && !target && showDividends && dividendState && dividendState.status !== 'ready' && (
            <p className={styles.meta} role={dividendState.status === 'invalid' ? 'alert' : 'status'}>
                {dividendState.status === 'empty'
                    ? 'No local dividend dates saved on this device.'
                    : dividendState.message}
            </p>
        )}
        {target && !targetInRange && <p className={styles.meta}>The linked date is outside the current 30-day window. Showing current dates.</p>}
        {target?.market === 'MY' && <p className={styles.meta}>Malaysia earnings coverage is unavailable.</p>}
        {!target && !hasRecords && records && <p className={styles.meta}>Add stocks to your watchlist to see their earnings and review dates here. Trending earnings are shown meanwhile.</p>}
        {status && <p role={current?.error ? 'alert' : 'status'} className={styles.meta}>{status}{current?.error && <> <button className={styles.link} onClick={() => setAttempt(value => value + 1)}>Retry calendar</button></>}</p>}
        {shownKinds.length > 0 && <ul className={styles.calendarLegend} aria-label="Calendar legend">{shownKinds.map(kind => <li key={kind} data-kind={kind}><i aria-hidden="true" />{kindLabel[kind]}</li>)}</ul>}
        {!target && !status && items.length === 0 && !showEmptyGrid ? (
            <section className={styles.agenda} aria-label="Empty calendar">
                <p className={styles.meta}>
                    {allItems.length > 0 && effectiveFilter !== 'all'
                        ? <>No matching events in this filter for the next {range} days. <button type="button" className={styles.link} onClick={() => setKindFilter('all')}>Show all events</button></>
                        : `No earnings, reviews, or macro releases are scheduled in the next ${range} days.`}
                </p>
                {allItems.length === 0 && <button type="button" className={styles.link} onClick={() => setShowEmptyGrid(true)}>Show full calendar grid</button>}
            </section>
        ) : <>
        <div className={styles.monthBar} role="group" aria-label="Calendar weeks">
            <button type="button" className={styles.todayButton} onClick={() => { setPage(0); setSelectedDay(today); }}>Today</button>
            {pageCount > 1 && <button type="button" aria-label="Earlier weeks" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>‹</button>}
            <h3 aria-live="polite">{shortDate(pageFrom)} – {shortDate(pageTo, true)}</h3>
            {pageCount > 1 && <button type="button" aria-label="Later weeks" disabled={activePage >= pageCount - 1} onClick={() => setPage(activePage + 1)}>›</button>}
        </div>
        <div className={styles.monthGrid} data-testid="research-calendar-grid">
            {weekdays.map((day, index) => <span key={day} className={styles.weekday} data-weekend={isV9 && (index === 0 || index === 6) ? 'true' : undefined} aria-hidden="true">{day}</span>)}
            {gridDays.map(date => {
                const dayItems = byDay.get(date) ?? [];
                const inRange = date >= today && date <= end;
                const dayOfWeek = weekday(date);
                return <button key={date} type="button" className={styles.dayCell} data-in-range={inRange} data-today={date === today} data-weekend={isV9 && (dayOfWeek === 0 || dayOfWeek === 6) ? 'true' : undefined} aria-pressed={date === selectedDay}
                    aria-label={`${dayLabel(date)}: ${dayItems.length ? dayItems.map(item => `${itemLabel(item)} ${kindLabel[item.kind]}`).join(', ') : 'no events'}`}
                    onClick={() => setSelectedDay(date)}>
                    <time dateTime={date}>{date.endsWith('-01') || date === gridDays[0] ? shortDate(date) : Number(date.slice(-2))}</time>
                    {dayItems.slice(0, visibleChips).map(item => <span key={item.id} className={styles.chip} data-kind={item.kind}>{item.symbol ? itemLabel(item) : kindLabel[item.kind]}</span>)}
                    {dayItems.length > visibleChips && <span className={styles.more}>+{dayItems.length - visibleChips}</span>}
                </button>;
            })}
        </div>
        <section className={styles.agenda} aria-label="Selected day">
            <h3>{selectedDay === today ? `Today · ${dayLabel(selectedDay)}` : dayLabel(selectedDay)}</h3>
            {selectedItems.length === 0 ? <p className={styles.meta}>Nothing scheduled. Pick a day with a marker.</p>
                : <ul>{selectedItems.map(item => <li key={item.id} data-urgency={item.action ? 'action' : undefined}>
                    <span className={styles.badge} data-type={item.kind}>{kindLabel[item.kind]}</span>
                    {item.symbol && item.market ? <button className={styles.link} onClick={() => onSelect(item.symbol!, item.market!)}>{itemLabel(item)}</button> : <span />}
                    <span><b>{item.title}</b><small>{item.detail}{item.source ? ` · ${item.source}` : ''}{item.href && <> · <a href={item.href} target="_blank" rel="noopener noreferrer">Source ↗</a></>}</small></span>
                </li>)}</ul>}
        </section>
        </>}
        {current?.data?.warnings.map(warning => <p key={warning} className={styles.meta}>{warning}</p>)}
        {current?.data && <p className={styles.meta}>{target ? 'Earnings' : 'Watchlist'} dates retrieved {retrievedAt(current.data.generatedAt)}.</p>}
    </div>;
}
