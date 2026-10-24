'use client';

import { useEffect, useRef, useState } from 'react';
import { parseDiscoveryResponseV6 } from '@/components/v6/research-discovery-response-v6';
import type { DiscoveryResponse } from '@/lib/types/research-discovery';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { ResearchCalendarV8 } from './ResearchCalendarV8';
import { ResearchPickerV8 } from './ResearchPickerV8';
import { ResearchTrendingV8 } from './ResearchTrendingV8';
import { discoverViews, type DiscoverView } from './discover-view';
import styles from './research-discover-v8.module.css';

const labels: Record<DiscoverView, string> = { trending: 'Trending · Top 20', picker: 'Stock Picker', calendar: 'Calendar' };

export type DiscoveryScan = { data: DiscoveryResponse | null; error: string; retry: () => void };

// One bounded US Trend Discovery scan feeds Trending and Picker; it is requested only once the panel opens.
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

export function ResearchDiscoverV8({ initialView, defaultOpen, records, onSelect }: { initialView?: DiscoverView; defaultOpen: boolean; records: readonly ResearchRecord[] | null; onSelect: (symbol: string, market: ResearchMarket) => void }) {
    const [open, setOpen] = useState(defaultOpen || !!initialView);
    const [view, setView] = useState<DiscoverView>(initialView ?? 'trending');
    const scan = useDiscoveryScan(open);
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
        url.searchParams.delete('discover'); url.hash = '';
        window.history.replaceState(null, '', url);
        setOpen(false);
        onSelect(symbol, market);
    }
    const savedSymbols = (records ?? []).filter(record => record.market === 'US').map(record => record.symbol);
    return <details ref={ref} id="discover" className={styles.discover} open={open} onToggle={event => setOpen(event.currentTarget.open)} data-testid="research-discover">
        <summary><b>Discover</b><span>Trending momentum, a rule-based Stock Picker, and upcoming earnings and reviews</span></summary>
        <div className={styles.views} role="tablist" aria-label="Discover views">{discoverViews.map(value => <button key={value} role="tab" id={`discover-tab-${value}`} aria-selected={view === value} aria-controls="discover-panel" onClick={() => changeView(value)}>{labels[value]}</button>)}</div>
        <div id="discover-panel" role="tabpanel" aria-labelledby={`discover-tab-${view}`} className={styles.body}>
            {view === 'trending' && <ResearchTrendingV8 scan={scan} onSelect={symbol => select(symbol, 'US')} />}
            {view === 'picker' && <ResearchPickerV8 scan={scan} savedSymbols={savedSymbols} onSelect={symbol => select(symbol, 'US')} />}
            {view === 'calendar' && <ResearchCalendarV8 records={records} trending={scan.data} onSelect={select} />}
        </div>
    </details>;
}
