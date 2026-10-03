import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Execute the real currency, record and calibration boundaries without providers or SQL.
const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = id => {
        assert.ok(id.startsWith('.'), `Unexpected external dependency: ${id}`);
        const resolved = path.resolve(path.dirname(absolute), id);
        return load(resolved.endsWith('.ts') ? resolved : `${resolved}.ts`);
    };
    new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports);
    return compiled.exports;
}
const { formatResearchPrice, researchPriceCurrency } = load('src/lib/research/price-format.ts');
assert.equal(formatResearchPrice(10.02, 'MYR'), '10.02 MYR');
assert.equal(formatResearchPrice(517.53, 'USD'), '517.53 USD');
assert.equal(formatResearchPrice(125.75, 'GBp'), '125.75 GBp');
assert.equal(formatResearchPrice(0.012345, 'USD'), '0.012345 USD');
assert.equal(formatResearchPrice(0, 'MYR'), '0.00 MYR');
assert.equal(formatResearchPrice(null, 'MYR'), 'Unavailable');
assert.equal(formatResearchPrice(11.2, undefined), '11.20 (currency not recorded)');
assert.equal(researchPriceCurrency('not a currency'), null);

const { createResearchRecord, appendResearchReview } = load('src/lib/research/records.ts');
const { parseResearchRecord } = load('src/lib/research/input.ts');
const record = createResearchRecord({ symbol: 'MAYBANK', market: 'MY', companyName: 'Maybank' });
const legacy = parseResearchRecord(record);
assert.equal(legacy.decisionJournal.observedCurrency, undefined, 'Do not infer historical currency');
const withCurrency = parseResearchRecord({ ...record, decisionJournal: { ...record.decisionJournal, observedPrice: 10.02, observedCurrency: 'MYR' } });
const reviewed = appendResearchReview(withCurrency, '2026-10-03T00:00:00.000Z');
assert.equal(parseResearchRecord(reviewed).reviewHistory[0].decisionJournal.observedCurrency, 'MYR');

const { createResearchDecisionCalibration, parseResearchDecisionCalibration } = load('src/lib/research/research-decision-calibration.ts');
const calibration = createResearchDecisionCalibration({ ticker: 'MAYBANK', reviewId: 'review', reviewedAt: '2026-10-03', originalDecision: 'Watch', originalObservedPrice: 10.02, originalCurrency: 'MYR' });
const saved = parseResearchDecisionCalibration({ ...calibration, laterPrice: 10.12, laterCurrency: 'MYR' });
assert.equal(saved.originalCurrency, 'MYR');
assert.equal(saved.laterCurrency, 'MYR');
const old = { ...saved };
delete old.originalCurrency; delete old.laterCurrency;
assert.equal(parseResearchDecisionCalibration(old).originalCurrency, null);
assert.equal(parseResearchDecisionCalibration(old).laterCurrency, null);
console.log('Research currency regression passed: units, precision, legacy gaps and persisted review currencies.');
