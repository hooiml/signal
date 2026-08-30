import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createResearchDecisionCalibration, parseResearchDecisionCalibration, summarizeResearchDecisionCalibration } from '../src/lib/research/research-decision-calibration.ts';

const draft = createResearchDecisionCalibration({ ticker: 'msft', reviewId: 'review-1', reviewedAt: '2026-08-01T00:00:00Z', originalDecision: 'Wait for price', originalObservedPrice: 400 }, new Date('2026-08-30T00:00:00Z'));
const parsed = parseResearchDecisionCalibration({ ...draft, laterPrice: 460, thesisQuality: 'strong', evidenceQuality: 'strong', valuationDiscipline: 'mixed', triggerDiscipline: 'weak', hindsightRisk: true, processVerdict: 'adjust' });
assert.equal(parsed.ticker, 'MSFT');
assert.equal(parsed.laterPrice, 460);
assert.equal(parsed.hindsightRisk, true);
const summary = summarizeResearchDecisionCalibration(parsed);
assert.equal(summary.strong, 2);
assert.equal(summary.weak, 1);
assert.equal(summary.verdict, 'adjust');

const [store, route, panel, dock, wrapper, workflow] = await Promise.all([
    readFile('src/lib/research/research-decision-calibration-store.ts', 'utf8'),
    readFile('src/app/api/research/calibration/[ticker]/route.ts', 'utf8'),
    readFile('src/components/v10/ResearchDecisionCalibrationV10.tsx', 'utf8'),
    readFile('src/components/v10/ResearchDecisionCalibrationDockV10.tsx', 'utf8'),
    readFile('src/components/v7/ResearchIntegratedPageV7.tsx', 'utf8'),
    readFile('.github/workflows/research-memory-gate.yml', 'utf8'),
]);
assert.match(store, /research_decision_calibrations/);
assert.match(route, /export const GET/);
assert.match(route, /export const POST/);
assert.match(panel, /data-testid="decision-calibration-v10"/);
assert.match(panel, /Review the process, not just the return/);
assert.match(panel, /not an investor score/);
assert.match(panel, /Hindsight risk/);
assert.match(dock, /decision-calibration-slot/);
assert.match(wrapper, /ResearchDecisionCalibrationDockV10/);
assert.match(workflow, /research-memory-phase10-check\.mjs/);
assert.match(workflow, /research-decision-calibration-v10-qa\.mjs/);
console.log('research-memory phase10 decision calibration: ok');
