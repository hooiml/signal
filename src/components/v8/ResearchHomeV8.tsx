'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { ResearchHoldingsV8 } from './ResearchHoldingsV8';
import styles from './research-v8-connected.module.css';

const homeTabs = ['watchlist', 'discover', 'holdings'] as const;
type HomeTab = typeof homeTabs[number];

// The Research home before a stock is chosen; holdings stay separate from saved research.
export function ResearchHomeV8({ records, status, preferDiscover, discover, isUnsaved, onOpen }: {
    records: readonly ResearchRecord[] | null;
    status: ReactNode;
    preferDiscover: boolean;
    discover: ReactNode;
    isUnsaved: (record: ResearchRecord) => boolean;
    onOpen: (symbol: string, market: ResearchMarket) => void;
}) {
    const [chosen, setChosen] = useState<HomeTab | null>(preferDiscover ? 'discover' : null);
    // Until the user picks a tab, open the watchlist when it has stocks and Discover otherwise.
    const tab: HomeTab = chosen ?? (records?.length ? 'watchlist' : 'discover');
    const count = records ? `${records.length}` : '…';
    const tabList = useRef<HTMLDivElement>(null);
    function tabKeys(event: KeyboardEvent<HTMLDivElement>) {
        const index = homeTabs.indexOf(tab);
        const next = event.key === 'ArrowRight' ? (index + 1) % homeTabs.length
            : event.key === 'ArrowLeft' ? (index + homeTabs.length - 1) % homeTabs.length
                : event.key === 'Home' ? 0 : event.key === 'End' ? homeTabs.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        setChosen(homeTabs[next]);
        tabList.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }
    return <section className={styles.home} aria-label="Research home">
        <div ref={tabList} className={styles.homeTabs} role="tablist" aria-label="Research home" onKeyDown={tabKeys}>
            {homeTabs.map(value => <button key={value} id={`home-tab-${value}`} role="tab" aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} aria-controls={`home-panel-${value}`} onClick={() => setChosen(value)}>
                {value === 'watchlist' ? <>Watchlist <span className={styles.homeCount}>{count}</span></> : value === 'discover' ? 'Discover' : 'Holdings'}
            </button>)}
        </div>
        {tab === 'watchlist' ? <div id="home-panel-watchlist" role="tabpanel" aria-labelledby="home-tab-watchlist" className={styles.homePanel}>
            {status}
            {records && records.length === 0 && <div className={styles.homeEmpty}>
                <b>Your watchlist is empty.</b>
                <p>Search for a company above and choose Save stock, or find ideas in Discover.</p>
                <button type="button" className={styles.actionButton} onClick={() => setChosen('discover')}>Open Discover</button>
            </div>}
            {!!records?.length && <ul className={styles.homeList}>{records.map(record => <li key={`${record.market}:${record.symbol}`}>
                <button type="button" onClick={() => onOpen(record.symbol, record.market)}>
                    <b>{record.symbol}</b>
                    <span>{record.companyName || record.symbol}</span>
                    <small>{record.market}{isUnsaved(record) ? ' · Unsaved note' : ''}</small>
                    <span aria-hidden="true">↗</span>
                </button>
            </li>)}</ul>}
            {!records && !status && <p role="status">Loading your watchlist…</p>}
        </div> : tab === 'discover' ? <div id="home-panel-discover" role="tabpanel" aria-labelledby="home-tab-discover">{discover}</div>
            : <div id="home-panel-holdings" role="tabpanel" aria-labelledby="home-tab-holdings" className={styles.homePanel}>
                {records === null && status}
                <ResearchHoldingsV8 records={records} onOpen={onOpen} />
            </div>}
    </section>;
}
