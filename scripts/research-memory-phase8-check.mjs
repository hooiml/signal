import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compareResearchExpectationEvent, createResearchExpectationDraft } from '../src/lib/research/research-expectation.ts';

const draft = createResearchExpectationDraft('msft', new Date('2026-08-29T00:00:00.000Z'));
const event = {
    ...draft,
    title: 'Q1 earnings',
    status: 'reported',
    metrics: [
        { id: 'revenue', label: 'Revenue', unit: 'B', expected: 68.4, actual: 69.1, importance: 'primary', higherIsBetter: true },
        { id: 'eps', label: 'EPS', unit: '$', expected: 3.12, actual: 3.21, importance: 'primary', higherIsBetter: true },
        { id: 'cost', label: 'Cost ratio', unit: '%', expected: 25, actual: 24, importance: 'secondary', higherIsBetter: false },
    ],
    reactionPercent: -4.5,
    actualNarrative: 'Headline metrics beat, but the market focused elsewhere.',
    updatedAt: '2026-08-29T12:00:00.000Z',
};
const comparison = compareResearchExpectationEvent(event);
assert.equal(comparison.primaryOutcome, 'beat');
assert.equal(comparison.beatCount, 3);
assert.equal(comparison.missCount, 0);
assert.equal(comparison.reactionDivergence, 'positive-results-negative-reaction');
assert.equal(comparison.metrics[0].outcome, 'beat');
assert.ok(comparison.metrics[0].variancePercent > 1);

const mixed = compareResearchExpectationEvent({
    ...event,
    reactionPercent: 3,
    metrics: [
        { ...event.metrics[0], actual: 69.1 },
        { ...event.metrics[1], actual: 3.0 },
    ],
});
assert.equal(mixed.primaryOutcome, 'mixed');
assert.equal(mixed.reactionDivergence, 'unknown');

const [store, route, panel, reviewTools, wrapper, workflow] = await Promise.all([
    readFile('src/lib/research/research-expectation-store.ts', 'utf8'),
    readFile('src/app/api/research/expectations/[ticker]/route.ts', 'utf8'),
    readFile('src/components/v8/ResearchExpectationRealityV8.tsx', 'utf8'),
    readFile('src/components/v12/ResearchReviewToolsV12.tsx', 'utf8'),
    readFile('src/components/v7/ResearchIntegratedPageV7.tsx', 'utf8'),
    readFile('.github/workflows/research-memory-gate.yml', 'utf8'),
]);
assert.match(store, /CREATE TABLE IF NOT EXISTS research_expectation_events/);
assert.match(store, /OFFSET \$\{MAX_EVENTS_PER_TICKER\}/);
assert.match(route, /export const GET/);
assert.match(route, /export const POST/);
assert.match(panel, /data-testid="expectation-reality"/);
assert.match(panel, /Capture expectations before the event/);
assert.match(panel, /Signal evaluates the gap without treating the outcome as proof/);
assert.match(panel, /overflow-x-auto/);
assert.match(panel, /data-testid="expectation-metric-cards"/);
assert.match(panel, /min-h-11/);
assert.match(reviewTools, /id: 'expectations'/);
assert.match(reviewTools, /<ResearchExpectationRealityV8/);
assert.doesNotMatch(reviewTools, /createPortal|document\.querySelector|document\.createElement|MutationObserver/);
assert.doesNotMatch(wrapper, /ResearchExpectationDockV8/);
assert.match(workflow, /research-memory-phase8-check\.mjs/);
assert.match(workflow, /research-expectation-v8-qa\.mjs/);
console.log('research-memory phase8 expectation-vs-reality: ok');
