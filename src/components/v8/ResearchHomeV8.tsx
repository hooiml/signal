'use client';

import { useState, type ReactNode } from 'react';
import { useReviewDay } from '@/lib/research/use-review-day';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { reviewWeekEnd, sortWatchlist, watchlistHighProximity, watchlistReview, type WatchlistSort } from '@/lib/research/watchlist-review';
import type { V9QuoteBatchStatus } from '@/components/v9/useV9QuoteBatch';
import { ResearchHoldingsV8 } from './ResearchHoldingsV8';
import { researchHref } from './research-v8-connected-data';
import styles from './research-v8-connected.module.css';
import { V8SegmentedControl } from './V8SegmentedControl';

const homeTabs = ['watchlist', 'discover', 'holdings'] as const;
type HomeTab = typeof homeTabs[number];
type WatchlistView = 'all' | 'due';

type WatchlistProps = {
    records: readonly ResearchRecord[] | null;
    status?: ReactNode;
    isUnsaved?: (record: ResearchRecord) => boolean;
    onOpen: (symbol: string, market: ResearchMarket) => void;
    owner: boolean;
    query: string;
    market: string;
    onQuery: (query: string) => void;
    onMarket: (market: string) => void;
    loading: boolean;
    onReload: () => void;
};

export function ResearchWatchlistV8({
    records, status, isUnsaved, onOpen, owner, query, market, onQuery, onMarket, loading, onReload,
    sort, onSort, view, onView, onOpenDiscover, reviewHref = (symbol, market) => researchHref(symbol, 'review', market),
    actionClassName = styles.actionButton,
    quotes, quoteStatus, quoteError,
}: WatchlistProps & {
    sort: WatchlistSort;
    onSort: (sort: WatchlistSort) => void;
    view: WatchlistView;
    onView: (view: WatchlistView) => void;
    onOpenDiscover: () => void;
    reviewHref?: (symbol: string, market: ResearchMarket) => string;
    actionClassName?: string;
    quotes?: ReadonlyMap<string, ResearchSnapshot['quote']>;
    quoteStatus?: V9QuoteBatchStatus;
    quoteError?: string;
}) {
    const today = useReviewDay();
    const liveQuotes = quotes !== undefined;
    const matches = (records ?? []).filter(record => (market === 'All' || record.market === market) && `${record.symbol} ${record.companyName}`.toLowerCase().includes(query.trim().toLowerCase()));
    const due = owner ? matches.filter(record => watchlistReview(record, today).dueThisWeek) : [];
    const queue = owner && view === 'due';
    const hasMoveQuotes = liveQuotes && matches.some(record => {
        const quote = quotes.get(`${record.market}:${record.symbol}`);
        return typeof quote?.dailyChangePercent === 'number' && Number.isFinite(quote.dailyChangePercent);
    });
    const hasHighQuotes = liveQuotes && matches.some(record => watchlistHighProximity(quotes.get(`${record.market}:${record.symbol}`)) !== null);

    const effectiveSort: WatchlistSort = queue
        ? 'review'
        : !owner && sort === 'review'
            ? 'saved'
            : (sort === 'move' && !hasMoveQuotes) || (sort === 'high' && !hasHighQuotes)
                ? 'saved'
                : sort;

    const ordered = sortWatchlist(queue ? due : matches, effectiveSort, today, quotes);

    const sortNote = !liveQuotes
        ? 'Price sorting is unavailable: saved records do not include current quotes, 52-week highs or daily percentage changes.'
        : quoteStatus === 'loading'
            ? 'Loading live quotes for price sorting…'
            : quoteStatus === 'error'
                ? `${quoteError || 'Live quotes are unavailable.'} Saved and review sorting remain available.`
                : hasMoveQuotes || hasHighQuotes
                    ? 'Price sorts use live quotes; missing values sort last. Currencies are not combined.'
                    : 'Live quotes returned no price-change or 52-week-high figures for these stocks.';

    return <>
            {status}
            <div className={styles.homeControls}>
                <label>Find in watchlist<input type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Company or ticker" /></label>
                <label>Market<select value={market} onChange={event => onMarket(event.target.value)}><option>All</option><option>US</option><option>MY</option></select></label>
                <label>Sort watchlist<select value={effectiveSort} disabled={queue} onChange={event => onSort(event.target.value as WatchlistSort)} aria-describedby="watchlist-sort-note">
                    <option value="saved">Saved order</option><option value="symbol">Symbol A–Z</option>
                    {owner && <option value="review">Review due · oldest first</option>}
                    <option value="high" disabled={!hasHighQuotes}>{hasHighQuotes ? 'Closest to 52-week high' : liveQuotes && quoteStatus === 'loading' ? 'Closest to 52-week high · loading…' : 'Closest to 52-week high · unavailable'}</option>
                    <option value="move" disabled={!hasMoveQuotes}>{hasMoveQuotes ? 'Biggest daily % move' : liveQuotes && quoteStatus === 'loading' ? 'Biggest daily % move · loading…' : 'Biggest daily % move · unavailable'}</option>
                </select></label>
                <button type="button" className={actionClassName} disabled={loading} onClick={onReload}>Reload watchlist</button>
            </div>
            <p id="watchlist-sort-note" className={styles.homeNote}>{sortNote}</p>
            {owner ? <>
                <V8SegmentedControl kind="pressed" label="Watchlist view" legendClassName={styles.homeLegend} className={styles.homeViews} value={view} onChange={onView} options={[
                    { value: 'all', label: 'All saved' },
                    { value: 'due', label: <>Due this week <span className={styles.homeCount}>{records ? due.length : '…'}</span></> },
                ]} />
                <p className={styles.homeNote}>Overdue reviews and scheduled reviews through {reviewWeekEnd(today)} (Sunday, UTC). Review-age deadlines enter after they pass. Counts follow your search and market filters.</p>
            </> : records !== null && <p className={styles.homeNote}>Guest bookmarks have no review schedule or review history.</p>}
            {records && records.length === 0 && <div className={styles.homeEmpty}>
                <b>Your watchlist is empty.</b>
                <p>Search for a company above and choose Save stock, or find ideas in Discover.</p>
                <button type="button" className={actionClassName} onClick={onOpenDiscover}>Open Discover</button>
            </div>}
            {!!records?.length && <>
            <p className={styles.homeNote} role="status">Showing {ordered.length} of {records.length} loaded stocks{queue ? ' · oldest due first' : ''}.</p>
            {!ordered.length && <div className={styles.homeEmpty}><b>{queue ? 'No reviews due this week match these filters.' : 'No watchlist stocks match these filters.'}</b><button type="button" className={actionClassName} onClick={() => { onQuery(''); onMarket('All'); onView('all'); }}>Show all saved stocks</button></div>}
            <ul className={styles.homeList}>{ordered.map(record => {
                const review = owner ? watchlistReview(record, today) : null;
                const quote = liveQuotes ? quotes.get(`${record.market}:${record.symbol}`) : undefined;
                const highProx = liveQuotes ? watchlistHighProximity(quote) : null;
                return <li key={`${record.market}:${record.symbol}`} data-testid="watchlist-row" data-symbol={record.symbol} data-market={record.market}>
                <button type="button" onClick={() => onOpen(record.symbol, record.market)}>
                    <b>{record.symbol}</b>
                    <span>{record.companyName || record.symbol}</span>
                    <small>{record.market}{isUnsaved?.(record) ? ' · Unsaved note' : ''}</small>
                    <span aria-hidden="true">↗</span>
                </button>
                {liveQuotes && quote && quote.price !== null && (
                    <div className={styles.homeQuote} data-testid="watchlist-row-quote">
                        <strong>{quote.currency ? `${quote.currency} ` : ''}{quote.price.toFixed(2)}</strong>
                        {typeof quote.dailyChangePercent === 'number' && Number.isFinite(quote.dailyChangePercent) && (
                            <span className={styles.homeMove} data-tone={quote.dailyChangePercent >= 0 ? 'up' : 'down'}>
                                {quote.dailyChangePercent >= 0 ? '+' : '−'}{Math.abs(quote.dailyChangePercent).toFixed(2)}%
                            </span>
                        )}
                        {highProx !== null && (
                            <small>{highProx >= -0.05 ? 'At 52W high' : `${highProx.toFixed(1)}% vs 52W high`}</small>
                        )}
                    </div>
                )}
                <div className={styles.homeReview}>
                    <div><b>{!review ? 'No review schedule' : review.status === 'overdue' ? 'Overdue' : review.status === 'today' ? 'Due today' : review.status === 'upcoming' ? 'Upcoming' : 'No scheduled review'}</b>
                        {review?.date && <><time dateTime={review.date}>{review.date} UTC</time><small>{review.kind === 'stale' ? 'Review age deadline passed' : 'Scheduled review'}</small></>}
                    </div>
                    {owner && <a href={reviewHref(record.symbol, record.market)} target="_blank" rel="noopener noreferrer" aria-label={`Start review for ${record.symbol} · ${record.market} (new tab)`}>Start review ↗</a>}
                </div>
            </li>;
            })}</ul></>}
            {!records && !status && <p role="status">Loading your watchlist…</p>}
    </>;
}

// The Research home before a stock is chosen; holdings stay separate from saved research.
export function ResearchHomeV8({ preferDiscover, discover, ...watchlist }: WatchlistProps & { preferDiscover: boolean; discover: ReactNode }) {
    const [chosen, setChosen] = useState<HomeTab | null>(preferDiscover ? 'discover' : null);
    const [sort, setSort] = useState<WatchlistSort>('saved');
    const [view, setView] = useState<WatchlistView>('all');
    // Until the user picks a tab, open the watchlist when it has stocks and Discover otherwise.
    const tab: HomeTab = chosen ?? (watchlist.records?.length ? 'watchlist' : 'discover');
    const count = watchlist.records ? `${watchlist.records.length}` : '…';
    return <section className={styles.home} aria-label="Research home">
        <V8SegmentedControl kind="tabs" label="Research home" className={styles.homeTabs} value={tab} onChange={setChosen} options={homeTabs.map(value => ({
            value, id: `home-tab-${value}`, controls: `home-panel-${value}`,
            label: value === 'watchlist' ? <>Watchlist <span className={styles.homeCount}>{count}</span></> : value === 'discover' ? 'Discover' : 'Holdings',
        }))} />
        {tab === 'watchlist' ? <div id="home-panel-watchlist" role="tabpanel" aria-labelledby="home-tab-watchlist" className={styles.homePanel}>
            <ResearchWatchlistV8 {...watchlist}
                sort={sort} onSort={value => { setChosen('watchlist'); setSort(value); }}
                view={view} onView={value => { setChosen('watchlist'); setView(value); }}
                onQuery={value => { setChosen('watchlist'); watchlist.onQuery(value); }}
                onMarket={value => { setChosen('watchlist'); watchlist.onMarket(value); }}
                onReload={() => { setChosen('watchlist'); watchlist.onReload(); }}
                onOpenDiscover={() => setChosen('discover')} />
        </div> : tab === 'discover' ? <div id="home-panel-discover" role="tabpanel" aria-labelledby="home-tab-discover">{discover}</div>
            : <div id="home-panel-holdings" role="tabpanel" aria-labelledby="home-tab-holdings" className={styles.homePanel}>
                {watchlist.records === null && watchlist.status}
                <ResearchHoldingsV8 records={watchlist.records} onOpen={watchlist.onOpen} />
            </div>}
    </section>;
}
