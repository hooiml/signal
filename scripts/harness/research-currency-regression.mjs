import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Execute the real currency, record and calibration boundaries without providers or SQL.
const modules = new Map();
const sqlCalls = [];
let storedRow;
const jsonColumns = new Set(['checklist', 'monitoring_rules', 'accepted_evidence', 'decision_journal', 'position_plan', 'review_history']);
const sql = async (strings, ...values) => {
    const query = strings.join('?').replace(/\s+/g, ' ').trim();
    sqlCalls.push(query);
    if (/^(CREATE|ALTER) /.test(query)) return []; // Isolated schema spy, never a real database.
    if (query === "SELECT * FROM research_records WHERE user_id = 'default' AND symbol = ? LIMIT 1") return [structuredClone(storedRow)];
    if (query.startsWith('UPDATE research_records SET ')) {
        assert.equal(values.at(-1), storedRow.revision, 'Expected revision reaches the SQL boundary');
        const assignments = [...query.split(' WHERE ')[0].matchAll(/(\w+) = \?/g)];
        assignments.forEach((match, index) => {
            storedRow[match[1]] = jsonColumns.has(match[1]) ? JSON.parse(values[index]) : values[index];
        });
        storedRow.revision += 1;
        return [structuredClone(storedRow)];
    }
    throw new Error(`Unexpected currency-regression SQL: ${query}`);
};
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = id => {
        if (id === '@/lib/db') return { sql };
        if (id === '@/lib/owner-access') return { requireOwnerAccess: async () => null };
        if (id === 'next/server') return createRequire(absolute)(id);
        assert.ok(id.startsWith('.') || id.startsWith('@/'), `Unexpected external dependency: ${id}`);
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        return load(resolved.endsWith('.ts') ? resolved : `${resolved}.ts`);
    };
    new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports);
    return compiled.exports;
}
const { formatResearchPrice, researchPriceCurrency, normalizeCurrencyCode } = load('src/lib/research/price-format.ts');
assert.equal(formatResearchPrice(10.02, 'MYR'), '10.02 MYR');
assert.equal(formatResearchPrice(517.53, 'USD'), '517.53 USD');
assert.equal(formatResearchPrice(125.75, 'GBp'), '125.75 GBp');
assert.equal(formatResearchPrice(0.012345, 'USD'), '0.012345 USD');
assert.equal(formatResearchPrice(0, 'MYR'), '0.00 MYR');
assert.equal(formatResearchPrice(null, 'MYR'), 'Unavailable');
assert.equal(formatResearchPrice(11.2, undefined), '11.20 (currency not recorded)');
assert.equal(researchPriceCurrency('not a currency'), null);

const { createResearchRecord, appendResearchReview, prepareStoredResearchRecord } = load('src/lib/research/records.ts');
const { parseResearchRecord, parseResearchUpdateInput } = load('src/lib/research/input.ts');
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


// Ordinary user-entered codes are case insensitive; provider subunits retain their scale.
for (const value of ['USD', 'usd', 'Usd', 'uSd', ' UsD ']) assert.equal(normalizeCurrencyCode(value), 'USD');
for (const value of ['GBp', 'ZAc', 'ILa']) assert.equal(normalizeCurrencyCode(value), value);
assert.equal(normalizeCurrencyCode('gbp'), 'GBP');
assert.equal(researchPriceCurrency('GBp'), 'GBp');

const { calculateCurrencyPerformance, defaultCurrencyPerformanceSettings } = load('src/lib/research/currency-performance.ts');
const { positionPlanPriceFields, PositionPlanCurrencyError } = load('src/lib/research/position-plan.ts');
const base = createResearchRecord({ symbol: 'MSFT', market: 'US', companyName: 'Microsoft' });
for (const currency of [undefined, null, '', 'not a currency']) {
    const result = calculateCurrencyPerformance({ ...base, positionPlan: { ...base.positionPlan, averageCost: 100, currency } }, 110, defaultCurrencyPerformanceSettings);
    assert.equal(result.available, false, 'Unknown currency cannot produce performance');
    assert.equal(result.costCurrencyUnknown, true);
    assert.equal(result.costCurrencyMismatch, false, 'Unknown is not a known mismatch');
    for (const key of ['priceReturnPercent', 'fxReturnPercent', 'totalReturnPercent', 'relativeToSavedBenchmarkPercent']) assert.equal(result[key], null);
}
for (const currency of ['USD', 'usd', 'Usd', 'uSd']) {
    const result = calculateCurrencyPerformance({ ...base, positionPlan: { ...base.positionPlan, averageCost: 100, currency } }, 110, defaultCurrencyPerformanceSettings);
    assert.equal(result.priceReturnPercent, 10);
    assert.equal(result.costCurrencyMismatch, false);
}
for (const currency of ['MYR', 'GBp']) {
    const result = calculateCurrencyPerformance({ ...base, positionPlan: { ...base.positionPlan, averageCost: 100, currency } }, 110, defaultCurrencyPerformanceSettings);
    assert.equal(result.available, false);
    assert.equal(result.costCurrencyMismatch, true);
}

// Execute the real PATCH -> input parser -> store -> save preparation path with SQL isolated.
const { PATCH } = load('src/app/api/research/watchlist/[symbol]/route.ts');
const setRecord = (plan = base.positionPlan) => {
    storedRow = {
        symbol: base.symbol, market_type: base.market, company_name: base.companyName,
        position_state: base.positionState, in_buy_zone: base.inBuyZone, research_status: base.status,
        target_buy_zone: '', valuation_state: base.valuationState, thesis_strength: base.thesisStrength,
        why_interested: 'Preserved thesis', bull_case: '', bear_case: '', buy_trigger: '', sell_trigger: '',
        thesis_break: '', notes: 'Preserved note', checklist: base.checklist, monitoring_rules: base.monitoringRules,
        accepted_evidence: [], decision_journal: base.decisionJournal, position_plan: plan,
        review_history: [], last_reviewed_at: '2026-10-01', updated_at: '2026-10-01T00:00:00.000Z', revision: 7,
    };
    sqlCalls.length = 0;
};
const patch = async (body) => PATCH(new Request('http://localhost/api/research/watchlist/MSFT', {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision: storedRow.revision, ...body }),
}), { params: Promise.resolve({ symbol: 'MSFT' }) });
for (const field of positionPlanPriceFields) {
    for (const currency of [undefined, null, '']) {
        for (const existingPrice of [null, 90]) {
            setRecord({ ...base.positionPlan, [field]: existingPrice });
            const before = structuredClone(storedRow);
            const response = await patch({ positionPlan: { ...base.positionPlan, [field]: 100, currency } });
            assert.equal(response.status, 400, `New/changed ${field} cannot omit currency`);
            assert.match((await response.json()).error, /currency/);
            assert.ok(!sqlCalls.some(query => query.startsWith('UPDATE ')), 'Rejected request never updates a record');
            assert.deepEqual(storedRow, before, 'Rejected request leaves the record and history unchanged');
        }
        setRecord({ ...base.positionPlan, [field]: 100, currency: 'MYR' });
        assert.equal((await patch({ positionPlan: { ...base.positionPlan, [field]: 100, currency } })).status, 400, 'Cannot clear currency and keep a price');
        assert.ok(!sqlCalls.some(query => query.startsWith('UPDATE ')));
    }
}
setRecord({ ...base.positionPlan, averageCost: 100 });
let response = await patch({ notes: 'Edited note', positionPlan: { ...storedRow.position_plan } });
assert.equal(response.status, 200, 'Unchanged legacy prices remain editable');
let payload = await response.json();
assert.equal(payload.data.positionPlan.currency, undefined);
assert.equal(payload.data.notes, 'Edited note');
assert.equal(payload.data.whyInterested, 'Preserved thesis');
assert.equal(payload.data.reviewHistory.length, 1);
assert.equal(payload.data.reviewHistory[0].positionPlan.currency, undefined);
assert.equal(payload.data.revision, 8);

setRecord({ ...base.positionPlan, averageCost: 100, currency: 'USD' });
response = await patch({ positionPlan: { ...base.positionPlan, currency: null } });
assert.equal(response.status, 200, 'Currency may be cleared with all prices removed');
assert.equal((await response.json()).data.positionPlan.averageCost, null);

setRecord();
response = await patch({ positionPlan: { ...base.positionPlan, averageCost: 100, currency: ' Usd ' } });
assert.equal(response.status, 200);
payload = await response.json();
assert.equal(payload.data.positionPlan.currency, 'USD');
assert.equal(payload.data.reviewHistory[0].positionPlan.currency, 'USD');
assert.equal(payload.data.whyInterested, 'Preserved thesis');

// A store caller cannot bypass the same invariant by skipping the API parser.
assert.throws(() => prepareStoredResearchRecord(base, { positionPlan: { ...base.positionPlan, averageCost: 1 } }, 'review'), PositionPlanCurrencyError);
const normalized = prepareStoredResearchRecord(base, { positionPlan: { ...base.positionPlan, averageCost: 1, currency: 'Usd' } }, 'review');
assert.equal(normalized.positionPlan.currency, 'USD');
assert.equal(normalized.reviewHistory[0].positionPlan.currency, 'USD');
const settings = prepareStoredResearchRecord(base, parseResearchUpdateInput({ positionPlan: { averageCost: 1 } }), 'settings');
assert.deepEqual(settings.positionPlan, base.positionPlan, 'Settings mode does not apply unrelated plan edits');
assert.deepEqual(settings.reviewHistory, base.reviewHistory, 'Settings mode does not add a review');
console.log('Research currency regression passed: PATCH/save validation, legacy preservation, unknown/mismatched units, case normalization and review history. No real SQL/providers.');
