import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    KNOWN_2026_SCORE_GAP, calculate, dateRange, datesWithoutUsableVix,
    vixHistoryUrl, weightsFor, latestAvailable,
} from './backfill-signal-history.mjs';

// Deterministic, offline coverage: no credentials, live providers or DB mutations.
const { start, end } = KNOWN_2026_SCORE_GAP;
const dates = dateRange(start, end);
assert.equal(start, '2026-02-14');
assert.equal(end, '2026-04-24');
assert.equal(dates.length, 70, 'every omitted calendar date is targeted');
assert.equal(dates[0], start);
assert.equal(dates.at(-1), end);

const url = new URL(vixHistoryUrl(start, end));
assert.equal(url.hostname, 'query1.finance.yahoo.com');
assert.equal(url.pathname, '/v8/finance/chart/%5EVIX');
assert.equal(url.searchParams.get('interval'), '1d');
assert.equal(url.searchParams.has('range'), false, 'historical repair must not depend on the current 1-year window');
assert.ok(Number(url.searchParams.get('period1')) * 1000 <= Date.parse('2026-02-13T00:00:00Z'), 'includes prior market close');
assert.ok(Number(url.searchParams.get('period2')) * 1000 > Date.parse('2026-04-24T00:00:00Z'), 'includes final omitted date');
assert.throws(() => vixHistoryUrl('not-a-day', end), /Invalid historical/);
assert.throws(() => vixHistoryUrl(end, start), /Invalid historical/);

const weekdayQuotes = dateRange('2026-02-13', end)
    .filter((date) => {
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        return weekday !== 0 && weekday !== 6;
    })
    .map((date) => ({ date, value: 20.6 }));
assert.deepEqual(datesWithoutUsableVix(weekdayQuotes, dates), [], 'last available close covers weekends without future values');
assert.deepEqual(datesWithoutUsableVix([], dates), dates, 'missing history must block repair');
assert.deepEqual(
    datesWithoutUsableVix([{ date: '2026-02-13', value: 20.6 }], ['2026-02-14', '2026-02-20', '2026-02-22']),
    ['2026-02-22'], 'long stale close must not be reused to invent a dated reading',
);

const pointInTimeInputs = [
    { date: '2026-02-10', availableAt: '2026-02-10', value: 0.91 },
    { date: '2026-02-12', availableAt: '2026-04-26', value: 0.72 },
];
assert.equal(latestAvailable(pointInTimeInputs, '2026-03-01', true)?.value, 0.91, 'later-archived historical input must not leak backwards');
assert.equal(latestAvailable(pointInTimeInputs, '2026-03-01', false)?.value, 0.72, 'general backfill behaviour is retained');

const weights = weightsFor(20.6, false);
assert.equal(weights.social, 0, 'target US Standard/Social Off does not include social inputs');
assert.ok(Math.abs(weights.vix + weights.put_call + weights.aaii - 1) < 1e-9);

const reconstructed = calculate({
    date: start, mode: 'standard', enableSocial: false,
    inputs: { vix: { date: '2026-02-13', value: 20.6 }, social: null, putCall: null, aaii: null },
});
assert.ok(Number.isInteger(reconstructed.score) && reconstructed.score >= 0 && reconstructed.score <= 100);
assert.equal(reconstructed.components.vix.last_updated, '2026-02-13', 'weekend snapshot retains real observation date');
assert.equal(reconstructed.components.social, undefined);
assert.equal(reconstructed.components.put_call, undefined, 'missing inputs are not synthesized');
assert.match(reconstructed.coverage, /VIX historical close from 2026-02-13/);
assert.match(reconstructed.coverage, /put\/call neutral reserve/);
assert.match(reconstructed.coverage, /AAII neutral reserve/);

const source = readFileSync(new URL('./backfill-signal-history.mjs', import.meta.url), 'utf8');
assert.match(source, /repairGap \? \[\['standard', false\]\]/, 'repair only the affected US Standard/Social Off stream');
assert.match(source, /WHERE signal_snapshots\.origin = 'reconstructed'/, 'upsert must not replace observed points');
assert.match(source, /repairVerification:/, 'post-write verification must remain present');

console.log('PASS signal known 2026 score-gap repair: 70 dates, bounded VIX, no lookahead, neutral fallback, observed-row protection');
