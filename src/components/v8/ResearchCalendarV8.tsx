'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildResearchCalendarRequest } from '@/lib/research/calendar-request';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import type { ResearchCalendarRange, ResearchCalendarResponse } from '@/lib/types/research-calendar';
import type { DiscoveryResponse } from '@/lib/types/research-discovery';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

const day = (value: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const typeLabel = { earnings: 'Earnings', review: 'Review', stale: 'Stale review' } as const;

// Earnings and review dates for saved securities, plus earnings already known for the trending list.
export function ResearchCalendarV8({ records, trending, onSelect }: { records: readonly ResearchRecord[] | null; trending: DiscoveryResponse | null; onSelect: (symbol: string, market: ResearchMarket) => void }) {
    const [range, setRange] = useState<ResearchCalendarRange>(30);
    const [now] = useState(() => Date.now());
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
    const groups = new Map<string, ResearchCalendarResponse['events'][number][]>();
    for (const event of current?.data?.events ?? []) groups.set(event.displayDate, [...(groups.get(event.displayDate) ?? []), event]);
    const today = new Date(now).toISOString().slice(0, 10);
    const end = new Date(now + range * 86_400_000).toISOString().slice(0, 10);
    const trendingEarnings = [...(trending?.candidates ?? []), ...(trending?.contenders ?? [])]
        .flatMap(row => row.catalyst && row.catalyst.date >= today && row.catalyst.date <= end ? [{ symbol: row.symbol, name: row.name, catalyst: row.catalyst }] : [])
        .sort((left, right) => left.catalyst.date.localeCompare(right.catalyst.date));
    return <div className={styles.calendar}>
        <div className={styles.resultHead}>
            <p className={styles.meta}>Upcoming earnings, scheduled reviews and overdue reviews for your saved securities. Dates are UTC.</p>
            <div className={styles.segment} aria-label="Calendar range">{([30, 90] as const).map(value => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value} days</button>)}</div>
        </div>
        <section aria-label="Saved securities calendar">
            <h3>Your saved securities</h3>
            {!records ? <p role="status">Loading saved securities…</p>
                : !hasRecords ? <p className={styles.meta}>Save a security to see its earnings and review dates here.</p>
                    : !current ? <p role="status">Loading calendar…</p>
                        : current.error ? <p role="alert">{current.error}</p>
                            : groups.size === 0 ? <p className={styles.meta}>No earnings or reviews in the next {range} days.</p>
                                : <ol className={styles.days}>{[...groups].map(([date, events]) => <li key={date}><h4>{date === today ? 'Today' : day(date)}</h4><ul>{events.map(event => <li key={event.id} data-urgency={event.urgency}>
                                    <span className={styles.badge} data-type={event.type}>{typeLabel[event.type]}</span>
                                    <button className={styles.link} onClick={() => onSelect(event.symbol, event.market)}>{event.symbol}</button>
                                    <span><b>{event.title}</b><small>{event.detail} · {event.source}{event.freshness === 'overdue' ? ` · due ${event.sourceDate}` : ''}</small></span>
                                </li>)}</ul></li>)}</ol>}
            {current?.data?.warnings.map(warning => <p key={warning} className={styles.meta}>{warning}</p>)}
        </section>
        <section aria-label="Trending stocks reporting soon">
            <h3>Trending stocks reporting soon</h3>
            {!trending ? <p className={styles.meta}>Loading the trend scan…</p>
                : trendingEarnings.length === 0 ? <p className={styles.meta}>No Top 20 stock reports earnings in the next {range} days.</p>
                    : <ul className={styles.basketRows}>{trendingEarnings.map(item => <li key={item.symbol}><button className={styles.link} onClick={() => onSelect(item.symbol, 'US')}>{item.symbol}</button><span>{item.name}</span><span>{day(item.catalyst.date)} · {item.catalyst.timing === 'pre-market' ? 'before open' : item.catalyst.timing === 'after-hours' ? 'after close' : 'time not supplied'}</span></li>)}</ul>}
        </section>
        {!!current?.data?.macroEvents.length && <details className={styles.small}><summary>Macro watch · {current.data.macroEvents.length} releases</summary><ul>{current.data.macroEvents.map(event => <li key={event.id}><b>{day(event.date)}</b> · {event.title} · <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{event.source} ↗</a></li>)}</ul><p className={styles.meta}>Calendar retrieved {retrievedAt(current.data.generatedAt)}.</p></details>}
    </div>;
}
