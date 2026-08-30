import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createResearchValuationPlan, evaluateResearchValuationPlan, parseResearchValuationPlan } from '../src/lib/research/research-valuation-plan.ts';

const draft = createResearchValuationPlan('msft', new Date('2026-08-29T00:00:00.000Z'));
const plan = parseResearchValuationPlan({
    ...draft,
    currentEps: 12,
    years: 5,
    annualDiscountRatePct: 10,
    scenarios: [
        { ...draft.scenarios[0], epsCagrPct: 4, terminalPe: 20 },
        { ...draft.scenarios[1], epsCagrPct: 10, terminalPe: 25 },
        { ...draft.scenarios[2], epsCagrPct: 16, terminalPe: 30 },
    ],
});
const result = evaluateResearchValuationPlan(plan, 420);
assert.equal(result.scenarioResults.length, 3);
assert.ok(result.scenarioResults[0].presentValue < result.scenarioResults[1].presentValue);
assert.ok(result.scenarioResults[1].presentValue < result.scenarioResults[2].presentValue);
assert.ok(Number.isFinite(result.impliedEpsCagrPct));
assert.equal(evaluateResearchValuationPlan({ ...plan, currentEps: null }, 420).scenarioResults.length, 0);
assert.throws(() => parseResearchValuationPlan({ ...plan, annualDiscountRatePct: 60 }), /Discount rate/);

const [store, route, panel, reviewTools, wrapper, workflow] = await Promise.all([
    readFile('src/lib/research/research-valuation-plan-store.ts', 'utf8'),
    readFile('src/app/api/research/valuation-plan/[ticker]/route.ts', 'utf8'),
    readFile('src/components/v9/ResearchValuationReasoningV9.tsx', 'utf8'),
    readFile('src/components/v12/ResearchReviewToolsV12.tsx', 'utf8'),
    readFile('src/components/v7/ResearchIntegratedPageV7.tsx', 'utf8'),
    readFile('.github/workflows/research-memory-gate.yml', 'utf8'),
]);
assert.match(store, /CREATE TABLE IF NOT EXISTS research_valuation_plans/);
assert.match(route, /export const GET/);
assert.match(route, /export const POST/);
assert.match(panel, /data-testid="valuation-reasoning-v9"/);
assert.match(panel, /not a fair-value oracle/);
assert.match(panel, /does not infer forward earnings from trailing P\/E/);
assert.match(panel, /Market-implied EPS CAGR/);
assert.match(panel, /min-h-10/);
assert.match(panel, /try \{/);
assert.match(reviewTools, /id: 'valuation'/);
assert.match(reviewTools, /snapshot=\{snapshot\}/);
assert.doesNotMatch(panel, /\/api\/research\/watchlist|\/api\/research\/symbol\//);
assert.doesNotMatch(wrapper, /ResearchValuationDockV9/);
assert.match(workflow, /research-memory-phase9-check\.mjs/);
assert.match(workflow, /research-valuation-v9-qa\.mjs/);
console.log('research-memory phase9 valuation reasoning: ok');
