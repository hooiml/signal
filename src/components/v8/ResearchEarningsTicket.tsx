'use client';

import { useEffect, useState } from 'react';
import type { ResearchMarket } from '@/lib/types/research';
import type { ResearchCalendarEvent } from '@/lib/types/research-calendar';
import { parseResearchCalendarResponse } from '@/lib/research/calendar-response';
import { earningsCalendarInput, earningsTimingLabel, nextEarningsEvent } from '@/lib/research/earnings-ticket';
import styles from './research-earnings-ticket.module.css';

export function ResearchEarningsTicket({ symbol, market }: { symbol: string; market: ResearchMarket }) {
    const [attempt, setAttempt] = useState(0);
    const key = `${market}:${symbol}:${attempt}`;
    const [result, setResult] = useState<{ key: string; event: ResearchCalendarEvent | null; failed: boolean } | null>(null);
    useEffect(() => {
        if (market !== 'US') return;
        const controller = new AbortController();
        const timeout = setTimeout(() => { controller.abort(); setResult({ key, event: null, failed: true }); }, 15_000);
        fetch(`/api/research/calendar?range=30&type=earnings&market=${market}&ticker=${encodeURIComponent(symbol)}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(earningsCalendarInput(symbol, market)), signal: controller.signal,
        }).then(async response => {
            if (!response.ok) throw new Error('Earnings request failed.');
            return parseResearchCalendarResponse(await response.json());
        }).then(data => {
            const event = nextEarningsEvent(data, symbol, market, new Date().toISOString().slice(0, 10));
            if (!controller.signal.aborted) setResult({ key, event, failed: false });
        }).catch(() => { if (!controller.signal.aborted) setResult({ key, event: null, failed: true }); })
            .finally(() => clearTimeout(timeout));
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [key, symbol, market]);
    const current = result?.key === key ? result : null;
    const event = current?.event;
    if (market === 'MY') return <p className={styles.status} data-testid="earnings-ticket">Earnings · Malaysia coverage unavailable</p>;
    if (!current) return <p className={styles.status} data-testid="earnings-ticket" role="status">Earnings · Checking dates…</p>;
    if (current.failed) return <p className={styles.status} data-testid="earnings-ticket">Earnings · Could not load dates. <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry earnings</button></p>;
    if (!event) return <p className={styles.status} data-testid="earnings-ticket">Earnings · No date supplied in the next 30 days</p>;
    const label = new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${event.displayDate}T00:00:00Z`));
    const href = `/research-v8?${new URLSearchParams({ ticker: symbol, market, discover: 'calendar', calendarDate: event.displayDate })}#discover`;
    return <a className={styles.ticket} data-testid="earnings-ticket" href={href} target="_blank" rel="noopener noreferrer" aria-label={`${symbol} earnings · ${label} · ${earningsTimingLabel(event.earningsTiming)} · date unconfirmed. Open Calendar in a new tab.`}>
        <span>Earnings · <time dateTime={event.displayDate}>{label}</time> · {earningsTimingLabel(event.earningsTiming)}</span>
        <small>Date unconfirmed · Calendar (new tab) ↗</small>
    </a>;
}
