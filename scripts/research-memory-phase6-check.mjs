import assert from 'node:assert/strict';
import { appendResearchMemorySnapshot, appendResearchMemoryThesisVersion, createResearchMemoryState, recordResearchMemoryDecision } from '../src/lib/research/research-memory.ts';
import { calculateResearchMemoryImpliedEpsGrowth, calculateResearchMemoryValuation, calculateResearchMemoryValuationRange } from '../src/lib/research/research-memory-valuation.ts';
import { buildResearchMemoryWorkflow } from '../src/lib/research/research-memory-workflow.ts';

const scenario={id:'base',label:'Base',currentEps:16,epsCagrPct:10,terminalPe:25,years:5,annualDiscountRatePct:9};
const valued=calculateResearchMemoryValuation(scenario);
const implied=calculateResearchMemoryImpliedEpsGrowth({marketPrice:valued.presentValue,currentEps:16,terminalPe:25,years:5,annualDiscountRatePct:9});
assert.ok(Math.abs(implied.impliedEpsCagrPct-10)<1e-9,'valuation and implied-growth views must be mathematical inverses');
const range=calculateResearchMemoryValuationRange([
  {...scenario,id:'bear',label:'Bear',epsCagrPct:5,terminalPe:20},
  scenario,
  {...scenario,id:'bull',label:'Bull',epsCagrPct:15,terminalPe:30},
]);
assert.ok(range.low<range.midpoint && range.midpoint<range.high);

let state=createResearchMemoryState('MSFT');
state=appendResearchMemorySnapshot(state,{id:'s1',ticker:'MSFT',observedAt:'2026-08-01',price:520,forwardPe:33,forwardEps:16,evidence:[]});
state=appendResearchMemorySnapshot(state,{id:'s2',ticker:'MSFT',observedAt:'2026-08-29',price:485,forwardPe:29,forwardEps:16.8,evidence:[]});
state=appendResearchMemoryThesisVersion(state,{id:'tv1',createdAt:'2026-08-01',thesis:'Quality intact',invalidation:['Growth breaks'],decision:'wait',evidenceIds:[]});
state=recordResearchMemoryDecision(state,{id:'d1',decidedAt:'2026-08-01',decision:'wait',reason:'Expensive',triggers:[{id:'t1',ticker:'MSFT',type:'price_below',threshold:490,description:'Reassess entry',createdAt:'2026-08-01'}]});
const workflow=buildResearchMemoryWorkflow({state,previousSnapshot:state.snapshots[0],currentSnapshot:state.snapshots[1],now:'2026-08-29',valuation:{marketPrice:485,scenarios:[scenario],impliedTerminalPe:25,impliedYears:5,impliedDiscountRatePct:9}});
assert.equal(workflow.changeSummary?.changed,true);
assert.equal(workflow.decisionMemory.matchedTriggers.length,1);
assert.equal(workflow.reviewSummary.critical,1);
assert.ok(workflow.valuation?.implied);
assert.throws(()=>calculateResearchMemoryValuation({...scenario,currentEps:0}),/positive finite/);
console.log('research-memory phase 6: ok');
