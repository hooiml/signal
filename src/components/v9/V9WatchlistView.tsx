'use client';

import { useContext, useState } from 'react';
import { ResearchWatchlistV8 } from '@/components/v8/ResearchHomeV8';
import type { WatchlistSort } from '@/lib/research/watchlist-review';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { V9Navigation } from './v9-navigation';
import type { V9AlertsScanState } from './useV9AlertsScan';
import type { V9QuoteBatchStatus } from './useV9QuoteBatch';
import styles from './v9-workspace.module.css';

export function V9WatchlistView({
    records,
    owner,
    loading,
    error,
    quotes,
    quoteStatus,
    quoteError,
    alertsScan,
    onReload,
    onOpenStock,
    isUnsaved,
}: {
    readonly records: readonly ResearchRecord[] | null;
    readonly owner: boolean;
    readonly loading: boolean;
    readonly error?: string;
    readonly quotes: ReadonlyMap<string, ResearchSnapshot['quote']>;
    readonly quoteStatus: V9QuoteBatchStatus;
    readonly quoteError?: string;
    readonly alertsScan: V9AlertsScanState;
    readonly onReload: () => void;
    readonly onOpenStock: (symbol: string, market: ResearchMarket) => void;
    readonly isUnsaved: (record: ResearchRecord) => boolean;
}) {
    const href = useContext(V9Navigation)!;
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState('All');
    const [sort, setSort] = useState<WatchlistSort>('saved');
    const [view, setView] = useState<'all' | 'due'>('all');
    const [triggeredOnly, setTriggeredOnly] = useState(false);

    const toggleTriggered = () => {
        const next = !triggeredOnly;
        setTriggeredOnly(next);
        if (next && records?.length && alertsScan.status !== 'ready' && alertsScan.status !== 'loading') {
            alertsScan.scan();
        }
    };

    const status = error ? <p className={styles.watchlistStatus} role="alert">{error}{records && ' Previously loaded watchlist records remain visible.'}</p>
        : loading && records ? <p className={styles.watchlistStatus} role="status">Refreshing your watchlist…</p> : null;

    const filterActive = triggeredOnly && alertsScan.status === 'ready';

    return <section className={`${styles.card} ${styles.watchlistView}`} aria-labelledby="v9-watchlist-title">
        <div className={styles.sectionHead}>
            <div>
                <h1 id="v9-watchlist-title" className={styles.heroTitle}>Watchlist</h1>
                {records && <p>{owner ? 'Owner workspace · Saved research' : 'Guest workspace · Saved on this device'}</p>}
            </div>
            {records && records.length > 0 && (
                <div className={styles.watchlistFilterBar}>
                    <button
                        type="button"
                        className={styles.triggeredFilterBtn}
                        aria-pressed={triggeredOnly}
                        data-testid="watchlist-triggered-filter"
                        onClick={toggleTriggered}
                    >
                        <span>Triggered rules</span>
                        {alertsScan.status === 'ready' && (
                            <span className={styles.triggeredCount}>{alertsScan.matchedSymbols.size}</span>
                        )}
                    </button>
                </div>
            )}
        </div>
        {triggeredOnly && (
            <div className={styles.triggeredStatusBar} role="status" data-testid="watchlist-triggered-status">
                {alertsScan.status === 'loading' ? (
                    <span>Checking {alertsScan.monitoredCount} saved stocks for triggered rules and active conditions…</span>
                ) : alertsScan.status === 'error' ? (
                    <>
                        <span>{alertsScan.error}</span>
                        <button type="button" className={styles.textLink} onClick={alertsScan.scan}>Retry check</button>
                    </>
                ) : alertsScan.status === 'ready' ? (
                    <>
                        <span>
                            Showing stocks with active alerts or matched monitoring rules ({alertsScan.matchedSymbols.size} of {alertsScan.data?.monitoredCount ?? alertsScan.monitoredCount} checked) · On-demand check
                        </span>
                        <div className={styles.triggeredStatusActions}>
                            <button type="button" className={styles.textLink} onClick={alertsScan.scan}>Re-check</button>
                            <button type="button" className={styles.textLink} onClick={() => setTriggeredOnly(false)}>Clear filter</button>
                        </div>
                    </>
                ) : null}
            </div>
        )}
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
            quotes={quotes}
            quoteStatus={quoteStatus}
            quoteError={quoteError}
            extraFilter={filterActive ? record => alertsScan.matchedSymbols.has(record.symbol.trim().toUpperCase()) : undefined}
            onClearExtraFilter={triggeredOnly ? () => setTriggeredOnly(false) : undefined}
            extraEmptyMessage={filterActive ? 'No saved stocks currently have triggered rules or active alert conditions.' : undefined}
            actionClassName={styles.ghostBtn}
            reviewHref={(ticker, market) => href('research', { ticker, market, tab: 'review' })}
            onOpenDiscover={() => {
                window.history.pushState(null, '', href('discover'));
                window.scrollTo(0, 0);
            }}
        />
    </section>;
}
