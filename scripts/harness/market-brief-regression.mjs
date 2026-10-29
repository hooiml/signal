import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Exercise the public brief processor with real scoring and reconciliation helpers.
// No route, provider, clock, persistence, or browser dependency belongs in this contract.
const modules = new Map();
function load(filename) {
    const file = path.resolve(filename);
    if (modules.has(file)) return modules.get(file).exports;
    const compiledModule = { exports: {} };
    modules.set(file, compiledModule);
    const output = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        fileName: file,
    }).outputText;
    const require = (id) => {
        assert.ok(id.startsWith('.'), `Unexpected dependency: ${id}`);
        const resolved = path.resolve(path.dirname(file), id);
        return load(`${resolved}${existsSync(`${resolved}.ts`) ? '.ts' : ''}`);
    };
    new Function('require', 'module', 'exports', output)(require, compiledModule, compiledModule.exports);
    return compiledModule.exports;
}

const { calculateCompositeScoreV2 } = load('src/lib/sentiment-calculator-v2.ts');
const { reconcileScoreChange } = load('src/lib/signal-change.ts');
const { buildMarketBrief } = load('src/lib/market-brief.ts');

const referenceDate = '2026-10-20';
const input = (name, score, options = {}) => ({
    name,
    display_name: options.display_name ?? name.toUpperCase(),
    enabled: options.enabled ?? true,
    // VIX's raw value controls the high-volatility regime and is not its normalized score.
    value: options.value ?? (name === 'vix' ? 20 : score),
    score,
    weight: 0,
    signal: 'neutral',
    last_updated: options.last_updated ?? referenceDate,
    metadata: options.metadata ?? { timestamp_basis: 'observed' },
});

function inputs(market, scores = {}, options = {}) {
    const names = market === 'US'
        ? ['vix', 'social', 'put_call', 'aaii', 'naaim', 'bofa']
        : ['vix', 'news', 'aaii'];
    return names.map((name) => input(name, scores[name] ?? 70, options[name]));
}

function signal(market = 'US', mode = 'standard', scores = {}, options = {}) {
    const value = calculateCompositeScoreV2(inputs(market, scores, options), { market, mode });
    value.metadata.scoring_model_version = options.scoringModelVersion ?? 'brief-fixture-v1';
    if (market === 'MY') value.metadata.my_news_eligibility_version = options.eligibilityVersion ?? 1;
    if (options.snapshotPersistence) value.metadata.snapshot_persistence = options.snapshotPersistence;
    return value;
}

function readings(value) {
    return Object.entries(value.components).map(([key, component]) => ({
        key,
        name: component.display_name,
        score: component.score,
        weight: component.weight,
        raw_value: component.value,
        last_updated: component.last_updated,
        timestamp_basis: component.metadata?.timestamp_basis,
        retrieved_at: component.metadata?.retrieved_at,
        unit: component.metadata?.unit,
    }));
}

function withComparison(current, previous, options = {}) {
    current.metadata.change_reconciliation = reconcileScoreChange({
        current: readings(current), previous: readings(previous),
        currentScore: current.composite_score, previousScore: previous.composite_score,
        currentModelVersion: 'currentModelVersion' in options ? options.currentModelVersion : current.metadata.scoring_model_version,
        previousModelVersion: 'previousModelVersion' in options ? options.previousModelVersion : previous.metadata.scoring_model_version,
        currentNewsEligibilityVersion: 'currentEligibilityVersion' in options ? options.currentEligibilityVersion : current.metadata.my_news_eligibility_version,
        previousNewsEligibilityVersion: 'previousEligibilityVersion' in options ? options.previousEligibilityVersion : previous.metadata.my_news_eligibility_version,
    });
    current.metadata.score_delta = {
        previous_score: previous.composite_score,
        delta: current.composite_score - previous.composite_score,
        previous_date: options.previousDate ?? '2026-10-19',
        snapshot_date: options.snapshotDate ?? referenceDate,
        label: 'Fixture comparison',
    };
    return current;
}

function assertBrief(value, expectedStatus, context) {
    assert.equal(value.status, expectedStatus, `${context}: status`);
    assert.equal(typeof value.conclusion, 'string', `${context}: conclusion`);
    assert.ok(value.conclusion.length > 0, `${context}: nonempty conclusion`);
    assert.ok(Array.isArray(value.reasons), `${context}: reasons are structured`);
    assert.equal(typeof value.change?.code, 'string', `${context}: structured change code`);
    assert.equal(typeof value.change?.text, 'string', `${context}: structured change text`);
    assert.ok(value.referenceDate === null || /^\d{4}-\d{2}-\d{2}$/.test(value.referenceDate), `${context}: typed reference date`);
    assert.ok(value.comparisonDate === null || /^\d{4}-\d{2}-\d{2}$/.test(value.comparisonDate), `${context}: typed comparison date`);
    assert.ok(Array.isArray(value.watch) && value.watch.length <= 2, `${context}: at most two evidence-linked watch conditions`);
}

function assertText(value, fragment, context) {
    assert.match(`${value.conclusion} ${value.change.text} ${value.reasons.map((reason) => reason.text).join(' ')}`, new RegExp(fragment, 'i'), context);
}

function assertChange(value, code, context) {
    assert.equal(value.change.code, code, `${context}: change code`);
}

// Complete US coverage is the ordinary available path in both modes. The selected support and
// conflict must be stable, even when object construction order changes.
for (const mode of ['standard', 'contrarian']) {
    const complete = signal('US', mode, { vix: 90, social: 85, put_call: 75, aaii: 35, naaim: 72, bofa: 68 });
    const before = JSON.stringify(complete);
    const brief = buildMarketBrief(complete, referenceDate);
    assertBrief(brief, 'available', `US ${mode} complete`);
    assert.equal(brief.referenceDate, referenceDate, `US ${mode} complete: reference date`);
    assert.equal(brief.comparisonDate, null, `US ${mode} complete: no unsupported comparison date`);
    assert.equal(JSON.stringify(complete), before, `US ${mode} complete: input remains immutable`);
    assert.ok(brief.supportKey, `US ${mode} complete: has fresh leading support`);
    assert.equal(brief.conflictKey, 'aaii', `US ${mode} complete: selects the fresh conflict by configured weight`);
    assert.deepEqual(buildMarketBrief(structuredClone(complete), referenceDate), brief, `US ${mode} complete: deterministic output`);
    const reordered = structuredClone(complete);
    reordered.components = Object.fromEntries(Object.entries(reordered.components).reverse());
    assert.deepEqual(buildMarketBrief(reordered, referenceDate), brief, `US ${mode} complete: selection does not depend on component insertion order`);
}

// The documented concentration policy deliberately keeps both of these complete readings limited.
for (const scenario of [
    { label: 'MY news-heavy', value: signal('MY', 'standard', { vix: 75, news: 70, aaii: 65 }) },
    { label: 'US high-volatility override', value: signal('US', 'standard', { vix: 75, social: 70 }, { vix: { value: 35 } }) },
]) {
    const brief = buildMarketBrief(scenario.value, referenceDate);
    assertBrief(brief, 'limited', scenario.label);
    assert.ok(brief.reasons.some((reason) => reason.code === 'concentration'), `${scenario.label}: concentration reason code`);
}

const impossibleReference = buildMarketBrief(signal(), '2026-02-30');
assertBrief(impossibleReference, 'unavailable', 'impossible calendar reference date');
assert.equal(impossibleReference.referenceDate, null, 'impossible calendar reference date: no normalized reference date');
assert.equal(impossibleReference.comparisonDate, null, 'impossible calendar reference date: no comparison date');
assert.ok(impossibleReference.reasons.some((reason) => reason.code === 'reference-date'), 'impossible calendar reference date: rejects normalized calendar dates');

const futureObservation = buildMarketBrief(signal('US', 'standard', {}, { vix: { last_updated: '2026-10-21' } }), referenceDate);
assertBrief(futureObservation, 'limited', 'future-dated observation');
assert.ok(futureObservation.reasons.some((reason) => reason.code === 'unknown-date' && reason.key === 'vix'), 'future-dated observation: does not become fresh evidence');

const unmatchedConflict = signal();
unmatchedConflict.confidence.conflicting_indicators = ['not-an-included-input'];
const unmatchedConflictBrief = buildMarketBrief(unmatchedConflict, referenceDate);
assertBrief(unmatchedConflictBrief, 'limited', 'unmatched reported conflict');
assert.ok(unmatchedConflictBrief.reasons.some((reason) => reason.code === 'unmatched-conflict'), 'unmatched reported conflict: records the limitation');

for (const scenario of [
    { label: 'partial missing', value: signal('US', 'standard', { vix: 70 }, { social: { enabled: false } }), reasonCode: 'missing' },
    { label: 'stale', value: signal('US', 'standard', {}, { aaii: { last_updated: '2026-09-01' } }), reasonCode: 'stale' },
    { label: 'unknown observation date', value: signal('US', 'standard', {}, { social: { metadata: { timestamp_basis: 'retrieved' } } }), reasonCode: 'unknown-date' },
]) {
    const brief = buildMarketBrief(scenario.value, referenceDate);
    assertBrief(brief, 'limited', scenario.label);
    assert.ok(brief.reasons.some((reason) => reason.code === scenario.reasonCode), `${scenario.label}: records the evidence limitation`);
}

for (const scenario of [
    { label: 'all missing', value: signal('US', 'standard', {}, Object.fromEntries(['vix', 'social', 'put_call', 'aaii', 'naaim', 'bofa'].map((key) => [key, { enabled: false }]))), reasonCode: 'no-fresh-evidence' },
    { label: 'invalid configured accounting', value: (() => { const value = signal(); value.components.vix.weight = .34; return value; })(), reasonCode: 'accounting' },
    { label: 'unrecognized positive-weight input', value: (() => {
        const value = signal();
        value.components.unrecognized = { ...input('unrecognized', 70), weight: .01 };
        return value;
    })(), reasonCode: 'accounting' },
    { label: 'no reference date', value: signal(), reasonCode: 'reference-date' },
]) {
    const brief = buildMarketBrief(scenario.value, scenario.label === 'no reference date' ? null : referenceDate);
    assertBrief(brief, 'unavailable', scenario.label);
    assert.ok(brief.reasons.some((reason) => reason.code === scenario.reasonCode), `${scenario.label}: reports the unavailable reason`);
}

// A score rise is directionally opposite in the two modes, but only new observations permit the
// market-change wording. The reconciliation is generated from the real scorer's components.
for (const [mode, wording] of [['standard', 'strengthen'], ['contrarian', 'weaken']]) {
    const previous = signal('US', mode, { vix: 55, social: 55, put_call: 55, aaii: 55, naaim: 55, bofa: 55 }, {
        vix: { last_updated: '2026-10-19' }, social: { last_updated: '2026-10-19' }, put_call: { last_updated: '2026-10-19' },
        aaii: { last_updated: '2026-10-19' }, naaim: { last_updated: '2026-10-19' }, bofa: { last_updated: '2026-10-19' },
    });
    const current = withComparison(signal('US', mode, { vix: 90, social: 80, put_call: 75, aaii: 70, naaim: 68, bofa: 65 }), previous);
    const brief = buildMarketBrief(current, referenceDate);
    assertBrief(brief, 'available', `${mode} new observation score rise`);
    assertChange(brief, mode === 'standard' ? 'strengthened' : 'weakened', `${mode} new observation score rise`);
    assertText(brief, wording, `${mode} new observation score rise`);
}

// Reconciliation edge cases must remain distinctions rather than a generic score-delta claim.
const changeCases = [
    {
        label: 'zero-effect new observation',
        current: signal('US', 'standard', { vix: 70 }),
        previous: signal('US', 'standard', { vix: 70 }, { vix: { last_updated: '2026-10-19' } }),
        expected: 'new observation',
        status: 'available',
    },
    {
        label: 'offsetting effects',
        current: signal('US', 'standard', { vix: 80, social: 45 }),
        previous: signal('US', 'standard', { vix: 60, social: 80 }, { vix: { last_updated: '2026-10-19' }, social: { last_updated: '2026-10-19' } }),
        expected: 'offset',
        status: 'available',
    },
    {
        label: 'returning input',
        current: signal('US', 'standard'),
        previous: signal('US', 'standard', {}, { naaim: { enabled: false } }),
        expected: 'coverage',
        status: 'available',
        changeCode: 'coverage-or-weights',
    },
    {
        label: 'missing input',
        current: signal('US', 'standard', {}, { naaim: { enabled: false } }),
        previous: signal('US', 'standard'),
        expected: 'coverage',
        status: 'limited',
        changeCode: 'coverage-or-weights',
    },
    {
        label: 'unknown observations',
        current: signal('US', 'standard', {}, { vix: { metadata: { timestamp_basis: 'retrieved' } } }),
        previous: signal('US', 'standard'),
        expected: 'cannot',
        status: 'limited',
        changeCode: 'observation-uncertain',
    },
    {
        label: 'older observation',
        current: signal('US', 'standard', {}, { vix: { last_updated: '2026-10-18' } }),
        previous: signal('US', 'standard'),
        expected: 'older',
        status: 'limited',
        changeCode: 'observation-uncertain',
    },
    {
        label: 'same-date observation',
        current: signal('US', 'standard'),
        previous: signal('US', 'standard'),
        expected: 'no new observation',
        status: 'available',
        changeCode: 'unchanged',
    },
    {
        label: 'same-date changed observation',
        current: signal('US', 'standard', { vix: 75 }, { vix: { value: 22 } }),
        previous: signal('US', 'standard', { vix: 55 }),
        expected: 'same observation date',
        status: 'available',
        changeCode: 'observation-uncertain',
    },
    {
        label: 'changed observation units',
        current: signal('US', 'standard', {}, { vix: { metadata: { timestamp_basis: 'observed', unit: 'ratio' } } }),
        previous: signal('US', 'standard', {}, { vix: { metadata: { timestamp_basis: 'observed', unit: 'index' } } }),
        expected: 'units changed',
        status: 'available',
        changeCode: 'observation-uncertain',
    },
    {
        label: 'tiny new-observation effect crossing no rounded score boundary',
        current: signal('US', 'standard', { vix: 70.01 }),
        previous: signal('US', 'standard', { vix: 70 }, { vix: { last_updated: '2026-10-19' } }),
        expected: 'rounded score is unchanged',
        status: 'available',
        changeCode: 'strengthened',
    },
    {
        label: 'tiny new-observation effect crossing a rounded score boundary',
        current: signal('US', 'standard', { vix: 50.501, social: 50.501, put_call: 50.501, aaii: 50.501, naaim: 50.501, bofa: 50.501 }),
        previous: signal('US', 'standard', { vix: 50.499, social: 50.499, put_call: 50.499, aaii: 50.499, naaim: 50.499, bofa: 50.499 }, {
            vix: { last_updated: '2026-10-19' }, social: { last_updated: '2026-10-19' }, put_call: { last_updated: '2026-10-19' },
            aaii: { last_updated: '2026-10-19' }, naaim: { last_updated: '2026-10-19' }, bofa: { last_updated: '2026-10-19' },
        }),
        expected: 'strengthened',
        status: 'available',
        changeCode: 'strengthened',
    },
];
for (const testCase of changeCases) {
    const compared = withComparison(testCase.current, testCase.previous);
    if (testCase.label === 'changed observation units') {
        assert.equal(compared.components.vix.metadata?.unit, 'ratio', 'changed observation units: current fixture retains its unit');
        assert.equal(compared.metadata.change_reconciliation.components.find((row) => row.key === 'vix')?.previous_unit, 'index', 'changed observation units: reconciliation keeps previous unit');
        assert.equal(compared.metadata.change_reconciliation.components.find((row) => row.key === 'vix')?.current_unit, 'ratio', 'changed observation units: reconciliation keeps current unit');
    }
    const brief = buildMarketBrief(compared, referenceDate);
    assertBrief(brief, testCase.status, testCase.label);
    assert.equal(brief.referenceDate, referenceDate, `${testCase.label}: reference date`);
    assert.equal(brief.comparisonDate, '2026-10-19', `${testCase.label}: comparison date`);
    assertChange(brief, testCase.changeCode ?? (testCase.label === 'zero-effect new observation' ? 'new-unchanged' : testCase.label === 'offsetting effects' ? 'offsetting' : undefined), testCase.label);
    assertText(brief, testCase.expected, testCase.label);
}

for (const scenario of [
    { label: 'model changed', market: 'US', options: { currentModelVersion: 'brief-fixture-v2', previousModelVersion: 'brief-fixture-v1' }, changeCode: 'configuration' },
    { label: 'model unknown', market: 'US', options: { previousModelVersion: null }, changeCode: 'compatibility-unknown' },
    { label: 'MY eligibility changed', market: 'MY', options: { currentEligibilityVersion: 2, previousEligibilityVersion: 1 }, changeCode: 'configuration' },
    { label: 'MY eligibility unknown', market: 'MY', options: { previousEligibilityVersion: null }, changeCode: 'compatibility-unknown' },
]) {
    const current = signal(scenario.market, 'standard');
    const previous = signal(scenario.market, 'standard');
    const brief = buildMarketBrief(withComparison(current, previous, scenario.options), referenceDate);
    assertBrief(brief, scenario.market === 'MY' ? 'limited' : 'available', scenario.label);
    assertChange(brief, scenario.changeCode, scenario.label);
    assertText(brief, 'comparison|configur|cannot', scenario.label);
}

const staleCurrent = signal('US', 'standard', {}, { aaii: { last_updated: '2026-09-01' } });
const stalePrevious = signal('US', 'standard', {}, { aaii: { last_updated: '2026-08-31' } });
const staleBrief = buildMarketBrief(withComparison(staleCurrent, stalePrevious), referenceDate);
assertBrief(staleBrief, 'limited', 'stale current evidence with otherwise reconcilable history');
assertChange(staleBrief, 'observation-uncertain', 'stale current evidence with otherwise reconcilable history');
assertText(staleBrief, 'still stale', 'stale current evidence with otherwise reconcilable history');

const persistenceFailure = signal('US', 'standard', {}, { snapshotPersistence: { status: 'unavailable', snapshot_date: null } });
const persistenceBrief = buildMarketBrief(persistenceFailure, referenceDate);
assertBrief(persistenceBrief, 'available', 'failed persistence with explicit usable reference date');

console.log('PASS market brief: status qualification, concentration, coverage/date limits, score-change provenance, configuration compatibility, stable selection and immutable inputs.');
