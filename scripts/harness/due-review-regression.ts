import assert from 'node:assert/strict';
import { createResearchRecord, appendResearchReview } from '../../src/lib/research/records';
import { dueReviewReasons, savedReviewContext, reviewHighDistance } from '../../src/lib/research/due-review';

const bookmark = createResearchRecord({ symbol: 'AAPL', market: 'US', companyName: 'Fixture', saveOnly: true });
const today = '2026-10-28';
assert.deepEqual(dueReviewReasons({ ...bookmark, lastReviewedAt: '2020-01-01' }, today), [], 'Bookmark age is not review age.');
assert.equal(savedReviewContext(bookmark), null);
const scheduled = { ...bookmark, decisionJournal: { ...bookmark.decisionJournal, nextReviewAt: today } };
assert.deepEqual(dueReviewReasons(scheduled, today), [{ kind: 'scheduled', date: today }]);
assert.deepEqual(dueReviewReasons(scheduled, '2026-10-27'), []);
assert.deepEqual(dueReviewReasons(scheduled, '2026-10-29'), [{ kind: 'scheduled', date: today }]);
assert.deepEqual(dueReviewReasons(scheduled, '2026-02-30'), []);

const reviewed = { ...scheduled, lastReviewedAt: '2026-10-01', monitoringRules: { ...bookmark.monitoringRules, reviewAgeDays: 27 }, decisionJournal: { ...scheduled.decisionJournal, decision: 'Watch' as const, observedPrice: 90, observedCurrency: 'USD' }, whyInterested: 'Saved thesis' };
assert.deepEqual(dueReviewReasons(reviewed, today), [{ kind: 'scheduled', date: today }], 'Age deadline is stale only after its UTC date.');
assert.deepEqual(dueReviewReasons(reviewed, '2026-10-29'), [{ kind: 'scheduled', date: today }, { kind: 'stale', date: today }]);
assert.deepEqual(dueReviewReasons({ ...reviewed, decisionJournal: { ...reviewed.decisionJournal, nextReviewAt: '2026-12-01' } }, '2026-10-29'), [{ kind: 'stale', date: today }], 'Future schedule does not conceal an independently stale review.');
assert.deepEqual(dueReviewReasons({ ...reviewed, lastReviewedAt: 'invalid' }, today), [{ kind: 'scheduled', date: today }]);
assert.equal(savedReviewContext(reviewed)?.journal.observedPrice, 90, 'Legacy genuine reviews retain their saved context.');

const older = { ...appendResearchReview(reviewed).reviewHistory[0]!, id: 'older', reviewedAt: '2026-09-01T12:00:00Z', whyInterested: 'Old thesis' };
const latest = { ...older, id: 'latest', reviewedAt: '2026-10-01T12:00:00Z', whyInterested: 'Latest snapshot thesis', decisionJournal: { ...reviewed.decisionJournal, observedPrice: null, observedCurrency: null } };
const record = { ...reviewed, reviewHistory: [latest, older], whyInterested: 'Current saved thesis' };
const before = JSON.stringify(record);
assert.equal(savedReviewContext(record)?.thesis, 'Latest snapshot thesis');
assert.equal(savedReviewContext({ ...record, reviewHistory: [older, latest] })?.thesis, 'Latest snapshot thesis');
assert.equal(savedReviewContext(record)?.journal.observedPrice, null, 'Missing snapshot price cannot be backfilled from another review.');
assert.equal(savedReviewContext({ ...record, reviewHistory: [{ ...latest, decisionJournal: { ...latest.decisionJournal, observedPrice: 12, observedCurrency: undefined } }] })?.journal.observedCurrency, undefined, 'Legacy currency is never inferred.');
dueReviewReasons(record, today);
assert.equal(JSON.stringify(record), before, 'Reading context and due status never mutate saved records.');
assert.equal(reviewHighDistance(90, 100), '10.0% below');
assert.equal(reviewHighDistance(110, 100), '10.0% above');
assert.equal(reviewHighDistance(100, 100), 'At the high');
for (const [value, high] of [[null, 100], [100, null], [0, 100], [100, 0], [NaN, 100], [100, Infinity]]) assert.equal(reviewHighDistance(value, high), 'Unavailable');
console.log('Due review contracts passed: UTC deadlines, immutable context, no inferred history and read-only calculations.');
