import {
    appendJournalUpdateV03,
    calculateMultipleBridgeV03,
    calculatePortfolioExposuresV03,
    calculateScenarioV03,
    calculateValuationMetricsV03,
    calculateWeightedScenarioValueV03,
    isInvestmentReplayCommitmentV03,
    learnModulesV03,
    parseLearnProgressV03,
    parseDecisionJournalEntryV03,
    scenarioProbabilityTotalV03,
    type DecisionJournalEntryV03,
    type ScenarioV03,
} from '../../src/lib/learn/v0-3';

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

assert(learnModulesV03.length === 14, 'v0.3 must expose all fourteen investment-analysis modules');

const metrics = calculateValuationMetricsV03({ marketCap: 120, enterpriseValue: 125, revenue: 20, ebitda: 5, freeCashFlow: 4, bookValue: 12 });
assert(metrics['price-sales'] === 6, 'P/S must use market cap and revenue');
assert(metrics['ev-sales'] === 6.25, 'EV/Sales must use enterprise value and revenue');
assert(metrics['ev-ebitda'] === 25, 'EV/EBITDA must use enterprise value and EBITDA');
assert(metrics['price-fcf'] === 30, 'Price/FCF must use market cap and FCF');
assert(metrics['fcf-yield'] !== null && Math.abs(metrics['fcf-yield']! - 3.3333333333333335) < 0.0001, 'FCF yield must invert Price/FCF');
assert(calculateValuationMetricsV03({ marketCap: 120, enterpriseValue: 125, revenue: 20, ebitda: 0, freeCashFlow: -1, bookValue: 12 })['ev-ebitda'] === null, 'invalid denominators must remain unavailable');

const bridge = calculateMultipleBridgeV03({ startingEps: 5, endingEps: 7, startingMultiple: 30, endingMultiple: 20, dividends: 0 });
assert(bridge?.startingPrice === 150 && bridge.endingPrice === 140, 'multiple bridge must expose start and end price');
assert(bridge?.earningsContributionPercent === 40, 'earnings contribution must isolate EPS change at the starting multiple');
assert(bridge !== null && Math.abs(bridge.multipleContributionPercent - -46.666666666666664) < 0.0001, 'multiple contribution must isolate repricing at ending earnings');
assert(bridge !== null && Math.abs(bridge.totalReturnPercent - -6.666666666666667) < 0.0001, 'strong earnings plus compression must produce the correct total return');

const scenarios: readonly ScenarioV03[] = [
    { id: 'bear', name: 'Bear', revenueGrowth: 2, margin: 10, earningsPower: 3, multipleLow: 10, multipleHigh: 12, probability: 20, trigger: 'weakness', risk: 'loss', provenance: 'learner' },
    { id: 'base', name: 'Base', revenueGrowth: 8, margin: 18, earningsPower: 5, multipleLow: 18, multipleHigh: 22, probability: 50, trigger: 'plan', risk: 'execution', provenance: 'learner' },
    { id: 'bull', name: 'Bull', revenueGrowth: 15, margin: 24, earningsPower: 7, multipleLow: 25, multipleHigh: 30, probability: 30, trigger: 'upside', risk: 'valuation', provenance: 'learner' },
];
assert(calculateScenarioV03(scenarios[0])?.impliedLow === 30, 'scenario range must use earnings power and multiple');
assert(scenarioProbabilityTotalV03(scenarios) === 100, 'probabilities must remain explicit');
assert(calculateWeightedScenarioValueV03(scenarios) !== null, 'weighted value may be calculated only for a complete 100% set');
assert(calculateWeightedScenarioValueV03(scenarios.map((scenario) => ({ ...scenario, probability: 20 }))) === null, 'probabilities must never be invisibly normalized');

const exposure = calculatePortfolioExposuresV03([
    { ticker: 'A', weight: 30, sector: 'Software', factor: 'Duration' },
    { ticker: 'B', weight: 25, sector: 'Chips', factor: 'Duration' },
    { ticker: 'C', weight: 20, sector: 'Banks', factor: 'Credit' },
], 'factor');
assert(exposure[0].key === 'Duration' && exposure[0].weight === 55 && exposure[0].holdingCount === 2, 'portfolio exposure must reveal shared factor concentration');

const journal: DecisionJournalEntryV03 = { id: 'j1', createdAt: '2026-01-01T00:00:00.000Z', original: { business: 'Recurring software revenue.', quality: 'Switching costs.', growth: 'Ten percent.', valuation: 'Twenty times FCF.', expectations: 'Stable growth.', risks: 'Competition.', catalysts: 'Product launch.', contraryEvidence: 'Slower bookings.', invalidation: 'Retention below threshold.', confidence: 60, horizon: '3 years' }, evidenceRefs: ['e1'], scenarioRefs: ['base'], updates: [] };
const updated = appendJournalUpdateV03(journal, { id: 'u1', createdAt: '2026-02-01T00:00:00.000Z', reason: 'New retention data.', currentThesis: 'Confidence reduced.', confidence: 45, newEvidenceRefs: ['e2'] });
assert(updated.original === journal.original && updated.original.confidence === 60, 'journal updates must preserve the immutable original object');
assert(journal.updates.length === 0 && updated.updates.length === 1, 'journal updates must append without mutating the prior entry');
assert(parseDecisionJournalEntryV03(updated)?.updates.length === 1, 'persisted journal must round-trip through validation');
assert(parseDecisionJournalEntryV03({ ...updated, original: { ...updated.original, confidence: 101 } }) === null, 'malformed persisted journal must fail closed');

assert(isInvestmentReplayCommitmentV03({ thesis: 'Growth may slow.', scenario: 'base', supportingEvidence: 'Margins remain durable.', contraryEvidence: 'Revisions are negative.', invalidation: 'Margins fall below 15%.', confidence: 55 }), 'complete replay commitment must validate');
assert(!isInvestmentReplayCommitmentV03({ thesis: '', scenario: 'certain', supportingEvidence: '', contraryEvidence: '', invalidation: '', confidence: 101 }), 'unbounded or incomplete replay commitment must fail');

const parsed = parseLearnProgressV03({ version: 3, completedModules: ['valuation-metrics', 'unknown', 'valuation-metrics'], completedWorkspaces: ['valuation', 'valuation'], reflections: [] });
assert(parsed.completedModules.length === 1 && parsed.completedModules[0] === 'valuation-metrics', 'progress parser must deduplicate and reject unknown modules');
assert(parsed.completedWorkspaces.length === 1, 'progress parser must deduplicate workspace mastery');
assert(parseLearnProgressV03({ version: 2, completedModules: ['valuation-metrics'] }).completedModules.length === 0, 'older progress must not be interpreted as v0.3 progress');

console.log('Signal Learn v0.3 regression tests passed.');
