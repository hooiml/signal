import assert from 'node:assert/strict';
import {
  addResearchMemoryEvidence,
  appendResearchMemorySnapshot,
  appendResearchMemoryThesisVersion,
  createResearchMemoryEvidence,
  createResearchMemoryState,
  getLatestResearchMemoryDecision,
  getLatestResearchMemorySnapshot,
  getLatestResearchMemoryThesis,
  recordResearchMemoryDecision,
} from '../src/lib/research/research-memory.ts';

let state = createResearchMemoryState(' msft ');
assert.equal(state.ticker, 'MSFT');

const evidence = createResearchMemoryEvidence({
  id: 'ev-1', ticker: 'msft', domain: 'fundamentals', label: 'Azure growth', detail: 'Growth improved',
  direction: 'supports', strength: 1.4, observedAt: '2026-08-29T08:00:00Z', sourceDate: '2026-08-28', freshness: 'fresh',
});
assert.equal(evidence.strength, 1);
assert.equal(evidence.ticker, 'MSFT');
state = addResearchMemoryEvidence(state, evidence);
assert.equal(state.evidence.length, 1);

state = appendResearchMemorySnapshot(state, {
  id: 'snap-1', ticker: 'MSFT', observedAt: '2026-08-29T08:00:00Z', price: 500, forwardPe: 30, forwardEps: 16,
  evidence: [evidence],
});
assert.equal(getLatestResearchMemorySnapshot(state)?.id, 'snap-1');
assert.equal(state.evidence.length, 1, 'snapshot merge must deduplicate evidence by id');

state = appendResearchMemoryThesisVersion(state, {
  id: 'thesis-1', createdAt: '2026-08-29T08:01:00Z', thesis: 'Durable cloud growth', invalidation: ['Cloud demand slows'],
  decision: 'watch', evidenceIds: ['ev-1'], reason: 'Quality intact, entry not compelling',
});
assert.equal(getLatestResearchMemoryThesis(state)?.version, 1);

state = recordResearchMemoryDecision(state, {
  id: 'decision-1', decidedAt: '2026-08-29T08:02:00Z', decision: 'watch', thesisVersionId: 'thesis-1',
  reason: 'Wait for valuation', triggers: [{ id: 'trigger-1', ticker: 'IGNORED', type: 'forward_pe_below', threshold: 28, description: 'Review below 28x', createdAt: '2026-08-29T08:02:00Z' }],
});
assert.equal(getLatestResearchMemoryDecision(state)?.triggers[0]?.ticker, 'MSFT');

assert.throws(() => createResearchMemoryState('$$$'), /Invalid research-memory ticker/);
assert.throws(() => appendResearchMemorySnapshot(state, { id: 'bad', ticker: 'GOOGL', observedAt: '2026-08-29T08:00:00Z', evidence: [] }), /does not match/);

console.log('research-memory phase 1: ok');
