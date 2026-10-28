'use client';

import { useEffect, useRef, useState } from 'react';
import { parseDiscoveryResponseV6 } from '@/components/v6/research-discovery-response-v6';
import type { DiscoveryResponse } from '@/lib/types/research-discovery';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { ResearchAlertsV8 } from './ResearchAlertsV8';
import { ResearchCalendarV8 } from './ResearchCalendarV8';
import { ResearchEarlyTrendsV8 } from './ResearchEarlyTrendsV8';
import { ResearchPickerV8 } from './ResearchPickerV8';
import { ResearchTrendingV8 } from './ResearchTrendingV8';
import { discoverViews, type DiscoverView } from './discover-view';
import styles from './research-discover-v8.module.css';
import type { EarningsCalendarTarget } from '@/lib/research/earnings-ticket';

const labels: Record<DiscoverView, string> = { trending: 'Trending', early: 'Early trends', picker: 'Stock Picker', calendar: 'Calendar', alerts: 'Alerts' };

export type DiscoveryScan = { data: DiscoveryResponse | null; error: string; retry: () => void };

// One bounded US Trend Discovery scan feeds Trending, Early trends and Picker; it is requested only once the panel opens.
function useDiscoveryScan(enabled: boolean): DiscoveryScan {
    const [data, setData] = useState<DiscoveryResponse | null>(null);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!enabled || data) return;
        const controller = new AbortController();
        fetch('/api/research/discovery', { signal: controller.signal })
            .then(async response => {
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string' ? payload.error : 'The trend scan is unavailable.');
                return parseDiscoveryResponseV6(payload);
            })
            .then(setData)
            .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The trend scan is unavailable.'); });
        return () => controller.abort();
    }, [enabled, data, attempt]);
    return { data, error, retry: () => { setError(''); setAttempt(value => value + 1); } };
}

export function ResearchDiscoverV8({ initialView, calendarTarget, defaultOpen, embedded = false, records, workspace, onSelect }: { initialView?: DiscoverView; calendarTarget?: EarningsCalendarTarget; defaultOpen: boolean; embedded?: boolean; records: readonly ResearchRecord[] | null; workspace: 'checking' | 'guest' | 'owner'; onSelect: (symbol: string, market: ResearchMarket) => void }) {
    const [expanded, setOpen] = useState(defaultOpen || !!initialView);
    // On the Research home, Discover is a tab beside the watchlist and is always open.
    const open = embedded || expanded;
    const [view, setView] = useState<DiscoverView>(initialView ?? 'trending');
    const scan = useDiscoveryScan(open && !(view === 'calendar' && calendarTarget));
    const ref = useRef<HTMLDetailsElement>(null);
    useEffect(() => { if (initialView) ref.current?.scrollIntoView({ block: 'start' }); }, [initialView]);
    function changeView(next: DiscoverView) {
        setView(next);
        const url = new URL(window.location.href);
        url.searchParams.set('discover', next);
        window.history.replaceState(null, '', url);
    }
    function select(symbol: string, market: ResearchMarket) {
        // Reading a stock leaves Discover; a reload should not reopen and scroll to it.
        const url = new URL(window.location.href);
        url.searchParams.delete('discover'); url.searchParams.delete('calendarDate'); url.hash = '';
        window.history.replaceState(null, '', url);
        setOpen(false);
        onSelect(symbol, market);
    }
    const savedSymbols = (records ?? []).filter(record => record.market === 'US').map(record => record.symbol);
    const content = <>
        <div className={styles.views} role="tablist" aria-label="Discover views">{discoverViews.map(value => <button key={value} role="tab" id={`discover-tab-${value}`} aria-selected={view === value} aria-controls="discover-panel" onClick={() => changeView(value)}>{labels[value]}</button>)}</div>
        <div id="discover-panel" role="tabpanel" aria-labelledby={`discover-tab-${view}`} className={styles.body}>
            {view === 'trending' && <ResearchTrendingV8 scan={scan} onSelect={symbol => select(symbol, 'US')} />}
            {view === 'early' && <ResearchEarlyTrendsV8 scan={scan} onSelect={symbol => select(symbol, 'US')} />}
            {view === 'picker' && <ResearchPickerV8 scan={scan} savedSymbols={savedSymbols} onSelect={symbol => select(symbol, 'US')} />}
            {view === 'calendar' && <ResearchCalendarV8 key={calendarTarget ? `${calendarTarget.market}:${calendarTarget.symbol}:${calendarTarget.date}` : 'watchlist'} target={calendarTarget} records={records} trending={scan.data} onSelect={select} />}
            {view === 'alerts' && <ResearchAlertsV8 records={records} workspace={workspace} onSelect={select} />}
        </div>
    </>;
    if (embedded) return <div id="discover" className={`${styles.discover} ${styles.embedded}`} data-testid="research-discover">{content}</div>;
    return <details ref={ref} id="discover" className={styles.discover} open={open} onToggle={event => setOpen(event.currentTarget.open)} data-testid="research-discover">
        <summary><b>Discover</b><span>Trending and early-trend stocks, a Stock Picker, earnings dates and alerts</span></summary>
        {content}
    </details>;
}
