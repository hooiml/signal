import assert from 'node:assert/strict';
import { assertResearchMemoryReplayIntegrity, compareResearchMemoryExpectationToReality, createResearchMemoryPointInTimeObservation, getLatestResearchMemoryObservationAsOf, getResearchMemoryReplayFrame } from '../src/lib/research/research-memory-point-in-time.ts';

const observations=[
  createResearchMemoryPointInTimeObservation({id:'eps-est-1',ticker:'msft',series:'q1-eps',effectiveAt:'2026-09-30',observedAt:'2026-08-01',value:3.2,source:'consensus',kind:'expectation'}),
  createResearchMemoryPointInTimeObservation({id:'eps-est-2',ticker:'MSFT',series:'q1-eps',effectiveAt:'2026-09-30',observedAt:'2026-08-20',value:3.3,source:'consensus',kind:'expectation'}),
  createResearchMemoryPointInTimeObservation({id:'eps-actual',ticker:'MSFT',series:'q1-eps',effectiveAt:'2026-09-30',observedAt:'2026-10-20',value:3.5,source:'filing',kind:'actual'}),
];
const frame=getResearchMemoryReplayFrame(observations,'MSFT','2026-08-25');
assert.equal(frame.observations.length,2);
assert.equal(assertResearchMemoryReplayIntegrity(frame),true);
assert.equal(getLatestResearchMemoryObservationAsOf(observations,{ticker:'MSFT',series:'q1-eps',asOf:'2026-08-25',kind:'expectation'})?.value,3.3);
const comparison=compareResearchMemoryExpectationToReality(observations,{ticker:'MSFT',series:'q1-eps',decisionAsOf:'2026-08-25',revealAsOf:'2026-10-21'});
assert.equal(comparison.expectation?.value,3.3);
assert.equal(comparison.actual?.value,3.5);
assert.equal(comparison.actualWasKnownAtDecision,false,'future actual must never leak into historical decision state');
const preActual=getResearchMemoryReplayFrame(observations,'MSFT','2026-10-19');
assert.equal(preActual.observations.some(x=>x.kind==='actual'),false);
console.log('research-memory phase 5: ok');
