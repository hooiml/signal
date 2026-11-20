'use client';

import { useContext, useState } from 'react';
import { ResearchWatchlistV8 } from '@/components/v8/ResearchHomeV8';
import type { WatchlistSort } from '@/lib/research/watchlist-review';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { V9Navigation } from './v9-navigation';
import styles from './v9-workspace.module.css';

export function V9WatchlistView({ records, owner, loading, error, onReload, onOpenStock, isUnsaved }: {
    readonly records: readonly ResearchRecord[] | null;
    readonly owner: boolean;
    readonly loading: boolean;
    readonly error?: string;
    readonly onReload: () => void;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
    readonly isUnsaved: (record: ResearchRecord) => boolean;
}) {
    const href = useContext(V9Navigation)!;
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState('All');
    const [sort, setSort] = useState<WatchlistSort>('saved');
    const [view, setView] = useState<'all' | 'due'>('all');
    const status = error ? <p className={styles.watchlistStatus} role="alert">{error}{records && ' Previously loaded watchlist records remain visible.'}</p>
        : loading && records ? <p className={styles.watchlistStatus} role="status">Refreshing your watchlist…</p> : null;

    return <section className={`${styles.card} ${styles.watchlistView}`} aria-labelledby="v9-watchlist-title">
        <div className={styles.sectionHead}>
            <div>
                <h1 id="v9-watchlist-title" className={styles.heroTitle}>Watchlist</h1>
                {records && <p>{owner ? 'Owner workspace · Saved research' : 'Guest workspace · Saved on this device'}</p>}
            </div>
        </div>
        <ResearchWatchlistV8
            records={records}
            isUnsaved={isUnsaved}
            status={status}
            owner={owner}
            loading={loading}
            onReload={onReload}
            onOpen={onOpenStock}
            query={query}
            onQuery={setQuery}
            market={market}
            onMarket={setMarket}
            sort={sort}
            onSort={setSort}
            view={view}
            onView={setView}
            actionClassName={styles.ghostBtn}
            reviewHref={(ticker, market) => href('research', { ticker, market, tab: 'review' })}
            onOpenDiscover={() => {
                window.history.pushState(null, '', href('discover'));
                window.scrollTo(0, 0);
            }}
        />
    </section>;
}
