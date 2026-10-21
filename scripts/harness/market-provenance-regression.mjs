import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { marketRequestFixture } from './market-request-fixture.mjs';

// Execute the actual reconciliation, archive and client boundaries without providers or a database.
const modules = new Map();
let archivedRow;
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const require = id => {
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        if (path.basename(resolved) === 'db') return { sql: async strings => {
            assert.match(strings.join('?'), /^\s*SELECT /, 'Archive fixture permits reads only.');
            return [archivedRow];
        } };
        assert.ok(id.startsWith('.') || id.startsWith('@/'), `Unexpected import: ${id}`);
        return load(`${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        fileName: absolute,
    }).outputText;
    new Function('require', 'module', 'exports', 'fetch', code)(require, compiled, compiled.exports, () => {
        throw new Error('Network access forbidden in provenance regression.');
    });
    return compiled.exports;
}

const { parseStoredComponentReadings, reconcileScoreChange } = load('src/lib/signal-change.ts');
const { parseConnectedSignal, indicatorStatus, archivedSeries } = load('src/components/v8/MarketV8ConnectedData.ts');
const { marketEvidenceCoverage } = load('src/lib/market-evidence-coverage.ts');
const { getMarketReplaySnapshot } = load('src/lib/market-replay.ts');
const { parseMarketReplaySnapshot } = load('src/lib/types/market-replay.ts');
const observed = '2026-10-20T20:00:00.000Z';
const earlier = '2026-10-19T20:00:00.000Z';
const later = '2026-10-21T20:00:00.000Z';
const base = {
    display_name: 'VIX Index', score: 40, weight: 0.3, raw_value: 20,
    last_updated: observed, timestamp_basis: 'observed', retrieved_at: observed, unit: 'VIX points',
};
const reading = (changes = {}) => parseStoredComponentReadings({ vix: { ...base, ...changes } })[0];
const reconcile = (before, current, scores = {}) => reconcileScoreChange({
    previous: [before], current: [current], previousScore: 47, currentScore: 47,
    previousModelVersion: '2.0.0', currentModelVersion: '2.0.0', ...scores,
});
const row = (before, current) => reconcile(before, current).components[0];

const offset = reconcile(reading(), reading({ score: 60, weight: 0.2 }), { currentScore: 52 });
assert.equal(offset.components[0].status, 'changed', 'Offsetting score and weight effects must remain visible.');
assert.equal(offset.components[0].delta, 0);
assert.equal(offset.components[0].score_effect, 6);
assert.equal(offset.components[0].weight_effect, -6);
assert.equal(offset.weights_changed, true);
assert.equal(offset.component_delta + offset.neutral_fallback.delta + offset.rounding_residual, offset.reported_delta);

const refetched = row(reading(), reading({ retrieved_at: later }));
assert.equal(refetched.status, 'unchanged');
assert.equal(refetched.observation_change, 'same');
assert.equal(refetched.new_observation, false);
assert.equal(refetched.current_observed_at, observed);
assert.equal(refetched.current_retrieved_at, later);
assert.equal(refetched.current_unit, 'VIX points');

for (const [time, expected, isNewer] of [[later, 'newer', true], [earlier, 'older', false]]) {
    const change = row(reading(), reading({ last_updated: time, retrieved_at: later }));
    assert.equal(change.observation_change, expected);
    assert.equal(change.new_observation, isNewer);
    assert.equal(change.status, 'changed', 'Changed observation times remain visible even when the raw value is identical.');
}
assert.equal(row(reading(), reading({ last_updated: '2026-10-20T16:00:00-04:00' })).observation_change, 'same');
const changedAtSameTime = row(reading(), reading({ raw_value: 21 }));
assert.equal(changedAtSameTime.observation_change, 'different');
assert.equal(changedAtSameTime.new_observation, false);
assert.equal(row(reading(), reading({ unit: 'scaled model points' })).status, 'changed');

const unknown = row(reading({ timestamp_basis: undefined, unit: undefined }), reading({ last_updated: later }));
assert.equal(unknown.previous_last_updated, observed);
assert.equal(unknown.previous_timestamp_basis, null);
assert.equal(unknown.previous_observed_at, null);
assert.equal(unknown.previous_unit, null);
assert.equal(unknown.observation_change, 'unknown');
assert.equal(unknown.new_observation, null);
const retrievalOnly = row(
    reading({ timestamp_basis: 'retrieved', retrieved_at: undefined }),
    reading({ timestamp_basis: 'retrieved', last_updated: later, retrieved_at: undefined }),
);
assert.equal(retrievalOnly.current_retrieved_at, later, 'An explicitly retrieved date remains usable without a duplicate retrieved_at field.');
assert.equal(retrievalOnly.current_observed_at, null);
assert.equal(retrievalOnly.observation_change, 'unknown');
assert.equal(retrievalOnly.status, 'unchanged', 'A new retrieval clock alone is not a changed observation.');
const malformed = reading({ timestamp_basis: 'invented', retrieved_at: 'not-a-date', unit: 42 });
assert.equal(malformed.timestamp_basis, null);
assert.equal(malformed.retrieved_at, null);
assert.equal(malformed.unit, null);

// Real orchestration writes the provenance with the snapshot, without changing its score.
const fixture = marketRequestFixture();
const response = await fixture.signal.getSmartSignal('US', 'standard', false, undefined, { includeAura: false });
const current = response.v2;
const write = fixture.calls.find(call => call.query.startsWith('INSERT INTO signal_snapshots'));
assert.ok(write, 'The real request persists a snapshot.');
const stored = write.values.filter(value => typeof value === 'string').map(value => {
    try { return JSON.parse(value); } catch { return null; }
}).find(value => value?.vix?.raw_value !== undefined);
assert.equal(stored.vix.timestamp_basis, 'retrieved');
assert.equal(stored.vix.retrieved_at, '2026-09-12T00:00:00.000Z');
assert.equal(stored.vix.unit, 'VIX points');
assert.equal(stored.vix.score, current.components.vix.score);
assert.equal(stored.vix.weight, current.components.vix.weight);

current.metadata.change_reconciliation = offset;
assert.equal(parseConnectedSignal({ success: true, data: current }, 'US', 'standard').metadata.change_reconciliation.components[0].status, 'changed');
for (const [field, value] of [['current_timestamp_basis', 'invented'], ['current_retrieved_at', 'not-a-date'], ['current_unit', 42], ['observation_change', 'new']]) {
    const invalid = structuredClone(current);
    invalid.metadata.change_reconciliation.components[0][field] = value;
    assert.throws(() => parseConnectedSignal({ success: true, data: invalid }, 'US', 'standard'), /invalid/);
}
const legacyResponse = structuredClone(current);
for (const key of Object.keys(legacyResponse.metadata.change_reconciliation.components[0])) {
    if (/_(last_updated|timestamp_basis|retrieved_at|unit)$/.test(key) || key === 'observation_change') delete legacyResponse.metadata.change_reconciliation.components[0][key];
}
assert.ok(parseConnectedSignal({ success: true, data: legacyResponse }, 'US', 'standard'), 'Earlier additive contracts remain readable.');
delete current.components.vix.metadata.timestamp_basis;
assert.equal(indicatorStatus(current, 'vix', '2026-09-12'), 'Freshness unknown');
assert.ok(marketEvidenceCoverage(current, '2026-09-12').unknownDateKeys.includes('vix'));
assert.equal(marketEvidenceCoverage(current, '2026-09-12').freshPct, null);

archivedRow = {
    snapshot_date: '2026-10-20', composite_score: 47, tier: 'neutral', origin: 'observed',
    coverage_note: null, confidence_level: 'low', agreement_pct: 50, majority_signal: 'NEUTRAL',
    updated_at: later, score_drivers: [], index_trend: [], signal_quality: {}, interpretation_context: {}, metadata_snapshot: {},
    components: {
        vix: base,
        old: { display_name: 'Old input', raw_value: null, score: 40, weight: 0.1, last_updated: observed },
        fetched: { ...base, timestamp_basis: 'retrieved', retrieved_at: undefined },
    },
};
const archived = await getMarketReplaySnapshot('US', 'standard', false, '2026-10-20');
const replay = parseMarketReplaySnapshot({ success: true, data: archived });
assert.equal(replay.components[0].timestampBasis, 'observed');
assert.equal(replay.components[0].retrievedAt, observed);
assert.equal(replay.components[0].unit, 'VIX points');
assert.equal(replay.components[1].rawValue, null, 'Missing archived readings must not become zero.');
assert.equal(replay.components[1].timestampBasis, null);
assert.equal(replay.components[1].retrievedAt, null);
assert.equal(replay.components[1].unit, null);
assert.equal(replay.components[2].retrievedAt, observed);
const legacyArchive = structuredClone(archived);
for (const component of legacyArchive.components) {
    delete component.timestampBasis;
    delete component.retrievedAt;
    delete component.unit;
}
const parsedLegacy = parseMarketReplaySnapshot({ success: true, data: legacyArchive });
assert.equal(parsedLegacy.components[0].timestampBasis, null);
assert.equal(parsedLegacy.components[0].unit, null);
const seriesSnapshots = {
    '2026-10-19': parsedLegacy,
    '2026-10-20': replay,
    '2026-10-21': { ...replay, components: [{ ...replay.components[0], unit: 'scaled model points' }] },
};
assert.deepEqual(archivedSeries('vix', Object.keys(seriesSnapshots).map(date => ({ date })), seriesSnapshots, 'VIX Index', 'VIX points'), [
    [{ date: '2026-10-20', value: 20 }],
], 'An archive chart never labels unknown or incompatible units with the current unit.');

console.log('Market provenance regression passed: offsetting effects, later/earlier/refetched readings, unknown legacy clocks, snapshot/replay preservation, boundary validation, missing values and comparable chart units.');
