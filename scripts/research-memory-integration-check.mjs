import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { researchReadFixture } from './harness/research-read-fixture.mjs';
import { buildResearchMemoryStateFromRecord } from '../src/lib/research/research-memory-integration.ts';

const read = (path) => readFile(path, 'utf8');

const [page, wrapper, dashboard, dock, reviewTools, detail, adapter, today, controls, marketDashboard, marketCalibration] = await Promise.all([
    read('src/app/research/page.tsx'),
    read('src/components/v7/ResearchIntegratedPageV7.tsx'),
    read('src/components/v6/ResearchDashboardV6.tsx'),
    read('src/components/v7/ResearchMemoryDockV7.tsx'),
    read('src/components/v12/ResearchReviewToolsV12.tsx'),
    read('src/components/v6/ResearchDetailV6.tsx'),
    read('src/lib/research/research-memory-integration.ts'),
    read('src/components/v6/SinceLastVisitBriefingV6.tsx'),
    read('src/components/v7/ResearchControlsV7.tsx'),
    read('src/components/v6/MarketDashboardV6.tsx'),
    read('src/components/v6/MarketCalibrationV6.tsx'),
]);

assert.match(page, /ResearchIntegratedPageV7/, 'Research route must mount the integrated V7 page');
assert.match(wrapper, /ResearchDashboardV7/, 'Integrated page must preserve the existing Research dashboard');
assert.doesNotMatch(wrapper, /ResearchMemoryDockV7/, 'Decision memory must not mount beside the Research dashboard');
assert.doesNotMatch(wrapper, /ResearchExpectationDockV8|ResearchValuationDockV9|ResearchDecisionCalibrationDockV10/, 'Integrated page must not mount external review docks');
assert.match(dashboard, /<ResearchReviewToolsV12/, 'Research dashboard must own review tools in source order');
assert.ok(dashboard.indexOf('<SinceLastVisitBriefingV6') < dashboard.indexOf('<main id='), 'Since last visit must precede the selected-security workspace');
assert.ok(dashboard.indexOf('<main id=') < dashboard.indexOf('<ResearchReviewToolsV12'), 'Selected-security research must precede secondary review tools in DOM order');
assert.match(dashboard, /presentation === 'v6' \? <h1 className="sr-only">Research workspace<\/h1> : null/, 'Legacy V6 keeps its page heading without duplicating the V7 heading');
assert.match(dashboard, /<h1 className=\{liveStyles\.researchIdentityTitle\}>Selected security<\/h1>/, 'V7 selected-security state must expose one page heading');
assert.match(dashboard, /ticker=\{selected\.symbol\}/, 'Dashboard must pass the selected ticker directly');
assert.match(dashboard, /record=\{savedSelectedRecord\}/, 'Dashboard must pass the selected saved record directly');
assert.match(dashboard, /snapshot=\{liveSnapshots\.current\.get\(selected\.symbol\)/, 'Dashboard must share the selected provider snapshot');
assert.match(dock, /data-testid="research-memory-dock"/, 'Decision-memory surface must remain test-addressable');
assert.doesNotMatch(dock, /createPortal|document\.querySelector|document\.createElement|MutationObserver/, 'Decision memory must remain in the React tree without DOM injection');
assert.doesNotMatch(dock, /\/api\/research\/watchlist|\/api\/research\/symbol\//, 'Decision memory must reuse dashboard-owned Research state');
assert.match(reviewTools, /data-testid="research-review-tools"/, 'Review tools must have one integrated owner');
assert.match(reviewTools, /activeTool === 'memory'/, 'Decision memory must be conditionally mounted by the integrated owner');
assert.match(reviewTools, /activeTool === 'expectations'/, 'Expectation review must be conditionally mounted by the integrated owner');
assert.match(reviewTools, /activeTool === 'valuation'/, 'Valuation review must be conditionally mounted by the integrated owner');
assert.match(reviewTools, /activeTool === 'decision-review'/, 'Decision review must be conditionally mounted by the integrated owner');
assert.doesNotMatch(reviewTools, /createPortal|document\.querySelector|document\.createElement|MutationObserver/, 'Review tools must remain in deterministic React source order');
assert.match(detail, /onSnapshotState\(ticker\.symbol, 'error', message\)/, 'Provider failure must become an explicit Decision Memory state');
assert.match(dock, /workspace=replay/, 'Decision memory must preserve a handoff to the existing Replay workspace');
assert.match(adapter, /signal-research-memory-history-v1/, 'Point-in-time history must use a versioned storage key');
assert.match(adapter, /slice\(-maxSnapshotsPerTicker\)/, 'Local point-in-time history must stay bounded');
assert.doesNotMatch(adapter, /forwardPe:\s*snapshot\.valuation\.priceEarnings/, 'Trailing provider P\/E must never be relabeled as forward P\/E');
assert.match(dock, /Forward EPS is not available/, 'Missing forward valuation evidence must be disclosed rather than inferred');
const productionCopy = [dashboard, dock, today, controls, marketDashboard, marketCalibration].join('\n');
assert.doesNotMatch(productionCopy, /Live (?:Research|Market) V7|mutation boundary|data owner|(?:provider|scoring|URL-state) contract|validated workflow state|Workspace-specific controls remain/i, 'Production copy must describe user benefit instead of implementation architecture');
assert.match(dashboard, /footer="Data sources · Methodology · Limitations"/, 'Research footer must direct users to provenance and limitations');
assert.match(today, /Signal never recommends a trade or changes your research/, 'Today must explain its user-facing safety boundary');
assert.match(today, /data-testid="today-health-list" role="list"/, 'Today secondary status must use one compact Research health list');
assert.ok(today.indexOf('Top 3 priority actions') < today.indexOf('data-testid="today-health-list"'), 'Priority action cards must remain ahead of secondary Research health');
assert.match(today, /data-quiet=\{quiet \? 'true' : 'false'\}/, 'Today must distinguish quiet zero-state rows');

// Feed the Memory adapter through the real saved-record store mapping and watchlist route.
const fixture = researchReadFixture();
const legacyRow = fixture.getRows()[0];
const savedRecord = async (row) => {
    fixture.setRows([row]);
    const response = await fixture.route.GET();
    assert.equal(response.status, 200);
    return (await response.json()).data[0];
};
const bookmarkRow = {
    ...legacyRow,
    decision_journal: { ...legacyRow.decision_journal, decision: 'Not recorded', confidence: 'unrecorded' },
    thesis_strength: 'unknown', why_interested: '', notes: '', review_history: [],
    position_plan: { ...legacyRow.position_plan, plannedEntryPrice: 90 },
    accepted_evidence: [{
        id: 'saved-evidence', title: 'Saved filing fact', summary: 'Evidence retained before a decision.',
        target: 'notes', tone: 'neutral', mode: 'evidence', acceptedAt: '2026-08-01T12:00:00.000Z',
        sources: [{ id: 'filing', label: 'Filing', value: 'Saved fact', source: 'Fixture filing', sourceUrl: 'https://example.com/filing', reportingPeriod: '2026-06-30' }],
    }],
};
const bookmark = await savedRecord(bookmarkRow);
const bookmarkBefore = structuredClone(bookmark);
const bookmarkMemory = buildResearchMemoryStateFromRecord(bookmark);
assert.equal(bookmarkMemory.thesisVersions.length, 0, 'A bookmark does not invent a dated Memory thesis.');
assert.equal(bookmarkMemory.decisions.length, 0, 'Not recorded never becomes a watch decision or dated entry trigger.');
assert.equal(bookmarkMemory.evidence[0]?.id, 'saved-evidence', 'Unreviewed bookmarks retain accepted evidence.');
assert.equal(bookmarkMemory.evidence[0]?.detail, bookmark.acceptedEvidence[0].summary);
assert.deepEqual(bookmark, bookmarkBefore, 'Memory import does not mutate the saved Research journal.');

const historyOnlyRow = {
    ...bookmarkRow,
    review_history: [{ ...bookmark, id: 'review-without-decision', reviewedAt: '2026-08-15T12:00:00.000Z', whyInterested: 'Reviewed evidence; decision remains unrecorded.' }],
};
const historyOnly = await savedRecord(historyOnlyRow);
const historyOnlyBefore = structuredClone(historyOnly);
const historyOnlyMemory = buildResearchMemoryStateFromRecord(historyOnly);
assert.equal(historyOnlyMemory.thesisVersions.length, 0, 'A saved review without a decision cannot enter the decision-dependent Memory thesis model.');
assert.equal(historyOnlyMemory.decisions.length, 0, 'Review history alone never converts Not recorded to watch.');
assert.equal(historyOnlyMemory.evidence.length, 1);
assert.deepEqual(historyOnly, historyOnlyBefore, 'The primary journal retains the review without a decision.');

const authored = await savedRecord({
    ...historyOnlyRow,
    decision_journal: { ...legacyRow.decision_journal, decision: 'DCA' },
    why_interested: 'An explicit authored decision.',
    review_history: [...historyOnlyRow.review_history, { ...historyOnly.reviewHistory[0], id: 'authored-review', decisionJournal: { ...legacyRow.decision_journal, decision: 'Avoid' } }],
});
const authoredMemory = buildResearchMemoryStateFromRecord(authored);
assert.deepEqual(authoredMemory.thesisVersions.map((entry) => entry.decision), ['avoid', 'dca'], 'Explicit historical and current decisions survive while unrecorded entries are skipped.');
assert.equal(authoredMemory.decisions[0]?.decision, 'dca');
assert.equal(authoredMemory.decisions[0]?.decidedAt, `${authored.lastReviewedAt}T00:00:00.000Z`);
assert.equal(authoredMemory.decisions[0]?.triggers[0]?.threshold, 90);
const legacyMemory = buildResearchMemoryStateFromRecord(await savedRecord(legacyRow));
assert.equal(legacyMemory.decisions[0]?.decision, 'watch', 'Legacy explicit Watch decisions retain their existing import behavior.');
assert.equal(fixture.calls.filter((query) => /^(CREATE|ALTER|INSERT|UPDATE|DELETE) /.test(query)).length, 0);

console.log('research-memory V7 integration: ok; saved-record bookmark/history authorship, evidence preservation and explicit decisions passed');
