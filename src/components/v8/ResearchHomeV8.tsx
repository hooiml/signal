'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import { reviewWeekEnd, sortWatchlist, watchlistReview, type WatchlistSort } from '@/lib/research/watchlist-review';
import { ResearchHoldingsV8 } from './ResearchHoldingsV8';
import { researchHref } from './research-v8-connected-data';
import styles from './research-v8-connected.module.css';
import { V8SegmentedControl } from './V8SegmentedControl';

const homeTabs = ['watchlist', 'discover', 'holdings'] as const;
type HomeTab = typeof homeTabs[number];

// The Research home before a stock is chosen; holdings stay separate from saved research.
export function ResearchHomeV8({ records, status, preferDiscover, discover, isUnsaved, onOpen, owner, query, market, onQuery, onMarket, loading, onReload }: {
    records: readonly ResearchRecord[] | null;
    status: ReactNode;
    preferDiscover: boolean;
    discover: ReactNode;
    isUnsaved: (record: ResearchRecord) => boolean;
    onOpen: (symbol: string, market: ResearchMarket) => void;
    owner: boolean;
    query: string;
    market: string;
    onQuery: (query: string) => void;
    onMarket: (market: string) => void;
    loading: boolean;
    onReload: () => void;
}) {
    const [chosen, setChosen] = useState<HomeTab | null>(preferDiscover ? 'discover' : null);
    const [sort, setSort] = useState<WatchlistSort>('saved');
    const [view, setView] = useState<'all' | 'due'>('all');
    const [today, setToday] = useState(() => new Date().toISOString().slice(0, 10));
    // A Watchlist left open overnight must not retain yesterday's queue. Visibility
    // also catches suspended tabs whose midnight timer could not run on time.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const update = () => {
            const now = new Date();
            setToday(now.toISOString().slice(0, 10));
            clearTimeout(timer);
            timer = setTimeout(update, Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime() + 50);
        };
        update();
        document.addEventListener('visibilitychange', update);
        return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
    }, []);
    const matches = (records ?? []).filter(record => (market === 'All' || record.market === market) && `${record.symbol} ${record.companyName}`.toLowerCase().includes(query.trim().toLowerCase()));
    const due = owner ? matches.filter(record => watchlistReview(record, today).dueThisWeek) : [];
    const queue = owner && view === 'due';
    const ordered = sortWatchlist(queue ? due : matches, queue ? 'review' : !owner && sort === 'review' ? 'saved' : sort, today);
    // Until the user picks a tab, open the watchlist when it has stocks and Discover otherwise.
    const tab: HomeTab = chosen ?? (records?.length ? 'watchlist' : 'discover');
    const count = records ? `${records.length}` : '…';
    return <section className={styles.home} aria-label="Research home">
        <V8SegmentedControl kind="tabs" label="Research home" className={styles.homeTabs} value={tab} onChange={setChosen} options={homeTabs.map(value => ({
            value, id: `home-tab-${value}`, controls: `home-panel-${value}`,
            label: value === 'watchlist' ? <>Watchlist <span className={styles.homeCount}>{count}</span></> : value === 'discover' ? 'Discover' : 'Holdings',
        }))} />
        {tab === 'watchlist' ? <div id="home-panel-watchlist" role="tabpanel" aria-labelledby="home-tab-watchlist" className={styles.homePanel}>
            {status}
            <div className={styles.homeControls}>
                <label>Find in watchlist<input type="search" value={query} onChange={event => { setChosen('watchlist'); onQuery(event.target.value); }} placeholder="Company or ticker" /></label>
                <label>Market<select value={market} onChange={event => { setChosen('watchlist'); onMarket(event.target.value); }}><option>All</option><option>US</option><option>MY</option></select></label>
                <label>Sort watchlist<select value={queue ? 'review' : !owner && sort === 'review' ? 'saved' : sort} disabled={queue} onChange={event => { setChosen('watchlist'); setSort(event.target.value as WatchlistSort); }} aria-describedby="watchlist-sort-note">
                    <option value="saved">Saved order</option><option value="symbol">Symbol A–Z</option>
                    {owner && <option value="review">Review due · oldest first</option>}
                    <option value="high" disabled>Closest to 52-week high · unavailable</option>
                    <option value="move" disabled>Biggest daily % move · unavailable</option>
                </select></label>
                <button type="button" className={styles.actionButton} disabled={loading} onClick={() => { setChosen('watchlist'); onReload(); }}>Reload watchlist</button>
            </div>
            <p id="watchlist-sort-note" className={styles.homeNote}>Price sorting is unavailable: saved records do not include current quotes, 52-week highs or daily percentage changes.</p>
            {owner ? <>
                <V8SegmentedControl kind="pressed" label="Watchlist view" legendClassName={styles.homeLegend} className={styles.homeViews} value={view} onChange={value => { setChosen('watchlist'); setView(value); }} options={[
                    { value: 'all', label: 'All saved' },
                    { value: 'due', label: <>Due this week <span className={styles.homeCount}>{records ? due.length : '…'}</span></> },
                ]} />
                <p className={styles.homeNote}>Overdue reviews and scheduled reviews through {reviewWeekEnd(today)} (Sunday, UTC). Review-age deadlines enter after they pass. Counts follow your search and market filters.</p>
            </> : records !== null && <p className={styles.homeNote}>Guest bookmarks have no review schedule or review history.</p>}
            {records && records.length === 0 && <div className={styles.homeEmpty}>
                <b>Your watchlist is empty.</b>
                <p>Search for a company above and choose Save stock, or find ideas in Discover.</p>
                <button type="button" className={styles.actionButton} onClick={() => setChosen('discover')}>Open Discover</button>
            </div>}
            {!!records?.length && <>
            <p className={styles.homeNote} role="status">Showing {ordered.length} of {records.length} loaded stocks{queue ? ' · oldest due first' : ''}.</p>
            {!ordered.length && <div className={styles.homeEmpty}><b>{queue ? 'No reviews due this week match these filters.' : 'No watchlist stocks match these filters.'}</b><button type="button" className={styles.actionButton} onClick={() => { setChosen('watchlist'); onQuery(''); onMarket('All'); setView('all'); }}>Show all saved stocks</button></div>}
            <ul className={styles.homeList}>{ordered.map(record => {
                const review = owner ? watchlistReview(record, today) : null;
                return <li key={`${record.market}:${record.symbol}`} data-testid="watchlist-row" data-symbol={record.symbol} data-market={record.market}>
                <button type="button" onClick={() => onOpen(record.symbol, record.market)}>
                    <b>{record.symbol}</b>
                    <span>{record.companyName || record.symbol}</span>
                    <small>{record.market}{isUnsaved(record) ? ' · Unsaved note' : ''}</small>
                    <span aria-hidden="true">↗</span>
                </button>
                <div className={styles.homeReview}>
                    <div><b>{!review ? 'No review schedule' : review.status === 'overdue' ? 'Overdue' : review.status === 'today' ? 'Due today' : review.status === 'upcoming' ? 'Upcoming' : 'No scheduled review'}</b>
                        {review?.date && <><time dateTime={review.date}>{review.date} UTC</time><small>{review.kind === 'stale' ? 'Review age deadline passed' : 'Scheduled review'}</small></>}
                    </div>
                    {owner && <a href={researchHref(record.symbol, 'review', record.market)} target="_blank" rel="noopener noreferrer" aria-label={`Start review for ${record.symbol} · ${record.market} (new tab)`}>Start review ↗</a>}
                </div>
            </li>;
            })}</ul></>}
            {!records && !status && <p role="status">Loading your watchlist…</p>}
        </div> : tab === 'discover' ? <div id="home-panel-discover" role="tabpanel" aria-labelledby="home-tab-discover">{discover}</div>
            : <div id="home-panel-holdings" role="tabpanel" aria-labelledby="home-tab-holdings" className={styles.homePanel}>
                {records === null && status}
                <ResearchHoldingsV8 records={records} onOpen={onOpen} />
            </div>}
    </section>;
}
