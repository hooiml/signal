import {
    businessLabCompaniesV02,
    calculateDerivedMetricsV02,
    calculateIncomeWaterfallV02,
    isBusinessReplayCommitmentV02,
    learnModulesV02,
    parseLearnProgressV02,
} from '../../src/lib/learn/v0-2';

const assert = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
};

assert(learnModulesV02.length === 9, 'v0.2 must expose all nine business modules');

const baseline = calculateIncomeWaterfallV02({
    revenue: 1000,
    grossMarginPercent: 60,
    operatingExpenses: 300,
    interestExpense: 50,
    taxRatePercent: 20,
    dilutedShares: 100,
});
assert(baseline.grossProfit === 600, 'gross profit must follow revenue and gross margin');
assert(baseline.operatingIncome === 300, 'operating income must subtract operating expenses');
assert(baseline.netIncome === 200, 'net income must subtract interest and taxes');
assert(baseline.eps === 2, 'EPS must use diluted shares');

const diluted = calculateIncomeWaterfallV02({ ...baseline, dilutedShares: 125 });
assert(diluted.netIncome === baseline.netIncome, 'share count must not change company-level net income');
assert(diluted.eps === 1.6, 'dilution must reduce per-share economics');

const company = businessLabCompaniesV02[0];
const ratios = calculateDerivedMetricsV02(company.snapshots[0], company.sharePrice);
assert(ratios.grossMargin.value === 70, 'gross margin must expose a deterministic derived value');
assert(ratios.fcfMargin.value === 25, 'FCF margin must use free cash flow and revenue');
assert(ratios.netDebt.value === -2500, 'net debt must preserve net cash as a negative value');
assert(ratios.pe.value !== null && ratios.pe.inputs.length === 2, 'P/E must expose formula inputs');

const missingPrice = calculateDerivedMetricsV02(company.snapshots[0], null);
assert(missingPrice.pe.status === 'unavailable', 'missing valuation inputs must remain unavailable');

assert(isBusinessReplayCommitmentV02({ interpretation: 'mixed', confidence: 50, primaryDriver: 'Margins changed.', contraryEvidence: 'Cash weakened.', valuationImplication: 'The multiple needs more support.' }), 'complete replay commitment must validate');
assert(!isBusinessReplayCommitmentV02({ interpretation: 'mixed', confidence: 101, primaryDriver: '', contraryEvidence: '', valuationImplication: '' }), 'unbounded or empty replay commitment must fail');

const parsed = parseLearnProgressV02({ version: 2, completedModules: ['revenue', 'unknown', 'revenue'], applyCompleted: true, reflections: [] });
assert(parsed.completedModules.length === 1 && parsed.completedModules[0] === 'revenue', 'progress parser must deduplicate and reject unknown modules');
assert(parseLearnProgressV02({ version: 1 }).completedModules.length === 0, 'v0.1 progress must not be interpreted as v0.2 progress');

console.log('Signal Learn v0.2 regression tests passed.');
