'use client';

import { useState, type ReactNode } from 'react';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import styles from './research-v8-connected.module.css';

type HomeTab = 'watchlist' | 'discover';

// The Research home before a stock is chosen: your watchlist and Discover as two sibling tabs.
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
    return <section className={styles.home} aria-label="Research home">
        <div className={styles.homeTabs} role="tablist" aria-label="Research home">
            {(['watchlist', 'discover'] as const).map(value => <button key={value} id={`home-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`home-panel-${value}`} onClick={() => setChosen(value)}>
                {value === 'watchlist' ? <>Watchlist <span className={styles.homeCount}>{count}</span></> : 'Discover'}
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
        </div> : <div id="home-panel-discover" role="tabpanel" aria-labelledby="home-tab-discover">{discover}</div>}
    </section>;
}
