import type { ResearchRecord } from '../types/research';
import { isResearchCalendarDate } from './calendar-input';
import { dueReviewReasons, type DueReviewReason } from './due-review';

export type WatchlistSort = 'saved' | 'symbol' | 'review' | 'high' | 'move';
export type WatchlistQuoteMetric = {
    readonly price: number | null;
    readonly dailyChangePercent: number | null;
    readonly fiftyTwoWeekHigh?: number | null;
};
export type WatchlistReview = {
    date: string | null;
    kind: DueReviewReason['kind'] | null;
    status: 'overdue' | 'today' | 'upcoming' | 'unscheduled';
    dueThisWeek: boolean;
};

/** Signed percentage distance from 52-week high (`0` = at high, `-5` = 5% below high). */
export function watchlistHighProximity(quote: WatchlistQuoteMetric | undefined): number | null {
    if (!quote) return null;
    const { price, fiftyTwoWeekHigh } = quote;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
    if (typeof fiftyTwoWeekHigh !== 'number' || !Number.isFinite(fiftyTwoWeekHigh) || fiftyTwoWeekHigh <= 0) return null;
    return ((price - fiftyTwoWeekHigh) / fiftyTwoWeekHigh) * 100;
}

/** Current calendar week ends on Sunday, using UTC just like Calendar and R2. */
export function reviewWeekEnd(today: string): string | null {
    if (!isResearchCalendarDate(today)) return null;
    const end = new Date(`${today}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + (7 - end.getUTCDay()) % 7);
    return end.toISOString().slice(0, 10);
}

export function watchlistReview(record: ResearchRecord, today: string): WatchlistReview {
    const end = reviewWeekEnd(today);
    const none: WatchlistReview = { date: null, kind: null, status: 'unscheduled', dueThisWeek: false };
    if (!end) return none;
    // Calendar includes age-based reviews only after their deadline passes. An
    // independently stale review must not be hidden by a later explicit schedule.
    const reasons = dueReviewReasons(record, today);
    const scheduled = record.decisionJournal.nextReviewAt;
    if (scheduled && isResearchCalendarDate(scheduled) && scheduled > today) reasons.push({ kind: 'scheduled', date: scheduled });
    const first = reasons.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind))[0];
    if (!first) return none;
    return {
        ...first,
        status: first.date < today ? 'overdue' : first.date === today ? 'today' : 'upcoming',
        dueThisWeek: first.date <= end,
    };
}

/** Input order remains the default; unavailable dates/quotes sort last and ties use exact identity. */
export function sortWatchlist(
    records: readonly ResearchRecord[],
    sort: WatchlistSort,
    today: string,
    quotes?: ReadonlyMap<string, WatchlistQuoteMetric>,
): ResearchRecord[] {
    const identity = (a: ResearchRecord, b: ResearchRecord) => a.symbol.localeCompare(b.symbol) || a.market.localeCompare(b.market);
    const rows = records.map(record => {
        const quote = quotes?.get(`${record.market}:${record.symbol}`);
        const move = sort === 'move' && quote && typeof quote.dailyChangePercent === 'number' && Number.isFinite(quote.dailyChangePercent)
            ? Math.abs(quote.dailyChangePercent)
            : null;
        const high = sort === 'high' ? watchlistHighProximity(quote) : null;
        return {
            record,
            review: sort === 'review' ? watchlistReview(record, today) : null,
            move,
            high,
        };
    });
    if (sort !== 'saved') rows.sort((a, b) => {
        if (sort === 'review') {
            const left = a.review?.date;
            const right = b.review?.date;
            const order = left && right ? left.localeCompare(right) : left ? -1 : right ? 1 : 0;
            if (order) return order;
        } else if (sort === 'move') {
            const order = a.move !== null && b.move !== null ? b.move - a.move : a.move !== null ? -1 : b.move !== null ? 1 : 0;
            if (order) return order;
        } else if (sort === 'high') {
            const order = a.high !== null && b.high !== null ? b.high - a.high : a.high !== null ? -1 : b.high !== null ? 1 : 0;
            if (order) return order;
        }
        return identity(a.record, b.record);
    });
    return rows.map(row => row.record);
}
