import assert from 'node:assert/strict';
import { createResearchRecord } from '../../src/lib/research/records';
import { reviewWeekEnd, sortWatchlist, watchlistHighProximity, watchlistReview, type WatchlistQuoteMetric } from '../../src/lib/research/watchlist-review';

const today = '2026-10-29';
const bookmark = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Apple', saveOnly: true });
const scheduled = (symbol: string, nextReviewAt: string | null) => ({ ...bookmark, symbol, decisionJournal: { ...bookmark.decisionJournal, nextReviewAt } });
assert.equal(reviewWeekEnd(today), '2026-11-01');
assert.equal(reviewWeekEnd('2026-11-01'), '2026-11-01', 'Sunday ends today, not next Sunday.');
assert.equal(reviewWeekEnd('2026-11-02'), '2026-11-08');
assert.equal(reviewWeekEnd('2024-02-29'), '2024-03-03');
assert.equal(reviewWeekEnd('2026-12-31'), '2027-01-03');
assert.equal(reviewWeekEnd('2026-02-30'), null);
assert.deepEqual(watchlistReview(bookmark, today), { date: null, kind: null, status: 'unscheduled', dueThisWeek: false });
assert.equal(watchlistReview(scheduled('OLD', '2020-01-01'), today).status, 'overdue');
assert.equal(watchlistReview(scheduled('NOW', today), today).status, 'today');
assert.equal(watchlistReview(scheduled('NEXT', '2026-11-01'), today).status, 'upcoming');
assert.equal(watchlistReview(scheduled('NEXT', '2026-11-01'), today).dueThisWeek, true);
assert.equal(watchlistReview(scheduled('LATER', '2026-11-02'), today).dueThisWeek, false);
assert.equal(watchlistReview(scheduled('INVALID', '2026-02-30'), today).date, null);
assert.equal(watchlistReview(scheduled('INVALID', '2026-10-29T12:00:00Z'), today).date, null);
assert.equal(watchlistReview(scheduled('NOW', today), 'invalid').date, null);

const stale = { ...scheduled('STALE', '2026-12-01'), lastReviewedAt: '2026-09-28', decisionJournal: { ...bookmark.decisionJournal, decision: 'Watch' as const, nextReviewAt: '2026-12-01' }, monitoringRules: { ...bookmark.monitoringRules, reviewAgeDays: 30 } };
assert.deepEqual(watchlistReview(stale, today), { date: '2026-10-28', kind: 'stale', status: 'overdue', dueThisWeek: true });
assert.deepEqual(watchlistReview(stale, '2026-10-28'), { date: '2026-12-01', kind: 'scheduled', status: 'upcoming', dueThisWeek: false }, 'Age deadlines only enter the queue after they pass, as in Calendar.');
assert.equal(watchlistReview({ ...stale, decisionJournal: { ...bookmark.decisionJournal } }, today).date, null, 'A bookmark never acquires an age deadline.');
for (const reviewAgeDays of [NaN, Infinity, -1, 0, 1.5, 366]) {
    assert.equal(watchlistReview({ ...stale, monitoringRules: { ...stale.monitoringRules, reviewAgeDays } }, today).date, '2026-12-01');
}
assert.equal(watchlistReview({ ...stale, lastReviewedAt: '2026-02-30' }, today).date, '2026-12-01');
assert.equal(watchlistReview({ ...stale, decisionJournal: { ...stale.decisionJournal, nextReviewAt: '2026-10-20' } }, today).date, '2026-10-20', 'Earliest independent due reason wins.');

const rows = [scheduled('ZZZ', null), scheduled('TIE', today), scheduled('OLD', '2026-10-20'), { ...scheduled('TIE', today), market: 'MY' as const }, scheduled('INVALID', 'invalid'), scheduled('LATER', '2026-11-02')];
const bytes = JSON.stringify(rows);
const keys = (values: typeof rows) => values.map(row => `${row.market}:${row.symbol}`);
assert.deepEqual(keys(sortWatchlist(rows, 'saved', today)), keys(rows));
assert.deepEqual(keys(sortWatchlist(rows, 'review', today)), ['US:OLD', 'MY:TIE', 'US:TIE', 'US:LATER', 'US:INVALID', 'US:ZZZ']);
assert.deepEqual(keys(sortWatchlist([...rows].reverse(), 'review', today)), keys(sortWatchlist(rows, 'review', today)), 'Due ties do not depend on response ordering.');
assert.deepEqual(keys(sortWatchlist(rows, 'symbol', today)), ['US:INVALID', 'US:LATER', 'US:OLD', 'MY:TIE', 'US:TIE', 'US:ZZZ']);
assert.equal(JSON.stringify(rows), bytes, 'Sorting never mutates saved records or their original order.');
assert.deepEqual(sortWatchlist([], 'review', today), []);

const quoteRows = [
    scheduled('AAA', null),
    scheduled('BBB', null),
    { ...scheduled('BBB', null), market: 'MY' as const },
    scheduled('CCC', null),
    scheduled('DDD', null),
    scheduled('MISSING', null),
    scheduled('ZERO', null),
];
const quoteMap = new Map<string, WatchlistQuoteMetric>([
    ['US:AAA', { price: 95, dailyChangePercent: -1.5, fiftyTwoWeekHigh: 100 }],
    ['US:BBB', { price: 190, dailyChangePercent: 3.2, fiftyTwoWeekHigh: 200 }],
    ['MY:BBB', { price: 9.5, dailyChangePercent: -3.2, fiftyTwoWeekHigh: 10 }],
    ['US:CCC', { price: 102, dailyChangePercent: 0.4, fiftyTwoWeekHigh: 100 }],
    ['US:DDD', { price: 98, dailyChangePercent: 0.1, fiftyTwoWeekHigh: 100 }],
    ['US:ZERO', { price: 0, dailyChangePercent: null, fiftyTwoWeekHigh: 0 }],
]);
assert.equal(watchlistHighProximity(quoteMap.get('US:AAA')), -5);
assert.equal(watchlistHighProximity(quoteMap.get('US:CCC')), 2);
assert.equal(watchlistHighProximity(quoteMap.get('US:ZERO')), null);
assert.equal(watchlistHighProximity(undefined), null);
assert.deepEqual(
    keys(sortWatchlist(quoteRows, 'move', today, quoteMap)),
    ['MY:BBB', 'US:BBB', 'US:AAA', 'US:CCC', 'US:DDD', 'US:MISSING', 'US:ZERO'],
    'Biggest daily % move sorts by absolute magnitude descending, ties by symbol+market, missing last.',
);
assert.deepEqual(
    keys(sortWatchlist(quoteRows, 'high', today, quoteMap)),
    ['US:CCC', 'US:DDD', 'US:AAA', 'MY:BBB', 'US:BBB', 'US:MISSING', 'US:ZERO'],
    'Closest to 52-week high sorts by signed distance descending, ties by symbol+market, invalid/missing last.',
);
assert.deepEqual(
    keys(sortWatchlist(quoteRows, 'move', today)),
    keys(sortWatchlist(quoteRows, 'symbol', today)),
    'Missing quote map falls back to deterministic symbol+market order.',
);

console.log('Watchlist review contracts passed: UTC weeks, independent deadlines, unknown dates, quote sorts, deterministic ties and immutable order.');
