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
const { parseCboePutCallRatio, parseNaaimExposure } = load('src/lib/market-indicators.ts');
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

// Use actual provider parsers through real orchestration, snapshot writing and readers.
// An unchanged source fetched on another day must not become fresh financial evidence.
const ratioTable = '<table><tr><td>TOTAL PUT/CALL RATIO</td><td>0.74</td></tr></table>';
const datedCboe = date => `<input type="text" placeholder="yyyy/mm/dd" value="${date}"/>${ratioTable}`;
const naaimTable = '<table><tr><td>09/09/2026</td><td>65.00</td><td>0</td></tr></table>';
const firstRetrieval = '2026-09-10T23:00:00.000Z';
const secondRetrieval = '2026-09-11T23:00:00.000Z';
const sourceReadings = (cboeHtml, naaimHtml, retrieval) => ({
    putCallRatio: parseCboePutCallRatio(cboeHtml, retrieval),
    naaimExposure: parseNaaimExposure(naaimHtml, retrieval),
});
async function providerSnapshot(providerReadings, previousSnapshot) {
    const providerFixture = marketRequestFixture({ providerReadings, previousSnapshot });
    const result = await providerFixture.signal.getSmartSignal('US', 'standard', false, undefined, { includeAura: false });
    assert.equal(result.meta.status, 'OK');
    const insert = providerFixture.calls.find(call => call.query.startsWith('INSERT INTO signal_snapshots'));
    const components = insert.values.filter(value => typeof value === 'string').map(value => {
        try { return JSON.parse(value); } catch { return null; }
    }).find(value => value?.put_call?.raw_value !== undefined);
    assert.ok(components, 'The parsed provider readings reach the real snapshot write.');
    return {
        signal: result.v2,
        snapshot: { snapshot_date: '2026-09-11', composite_score: result.v2.composite_score, tier: result.v2.tier,
            components, score_drivers: [], origin: 'observed', coverage_note: null,
            metadata_snapshot: { scoring_model_version: '2.0.0' } },
    };
}
const datedReadings = sourceReadings(datedCboe('10 September 2026'), naaimTable, firstRetrieval);
const initialProvider = await providerSnapshot(datedReadings);
const repeatedProvider = await providerSnapshot(sourceReadings(datedCboe('10 September 2026'), naaimTable, secondRetrieval), initialProvider.snapshot);
for (const key of ['put_call', 'naaim']) {
    const component = repeatedProvider.signal.components[key];
    assert.equal(component.metadata.timestamp_basis, 'observed');
    assert.equal(component.metadata.retrieved_at, secondRetrieval);
    assert.equal(repeatedProvider.snapshot.components[key].last_updated, initialProvider.snapshot.components[key].last_updated);
    const comparison = repeatedProvider.signal.metadata.change_reconciliation.components.find(item => item.key === key);
    assert.equal(comparison.status, 'unchanged');
    assert.equal(comparison.observation_change, 'same');
    assert.equal(comparison.new_observation, false);
    assert.equal(comparison.current_retrieved_at, secondRetrieval);
}
assert.equal(repeatedProvider.signal.composite_score, initialProvider.signal.composite_score);
const newerProvider = await providerSnapshot(sourceReadings(datedCboe('11 September 2026'), naaimTable, secondRetrieval), initialProvider.snapshot);
assert.equal(newerProvider.signal.metadata.change_reconciliation.components.find(item => item.key === 'put_call').observation_change, 'newer');
const revisedProvider = await providerSnapshot(sourceReadings(datedCboe('10 September 2026').replace('0.74', '0.75'), naaimTable, secondRetrieval), initialProvider.snapshot);
const revision = revisedProvider.signal.metadata.change_reconciliation.components.find(item => item.key === 'put_call');
assert.equal(revision.observation_change, 'different');
assert.equal(revision.new_observation, false);

const undatedNaaim = "<h2>This week's NAAIM Exposure Index number is: 65.00</h2>";
const unknownProvider = await providerSnapshot(sourceReadings(ratioTable, undatedNaaim, firstRetrieval));
const unknownRefetch = await providerSnapshot(sourceReadings(ratioTable, undatedNaaim, secondRetrieval), unknownProvider.snapshot);
assert.equal(unknownRefetch.signal.composite_score, initialProvider.signal.composite_score, 'Provenance correction preserves scoring and eligibility.');
assert.deepEqual(unknownRefetch.signal.metadata.weight_distribution, initialProvider.signal.metadata.weight_distribution);
for (const key of ['put_call', 'naaim']) {
    const component = unknownRefetch.signal.components[key];
    assert.equal(component.last_updated, secondRetrieval);
    assert.equal(component.metadata.timestamp_basis, 'retrieved');
    assert.match(indicatorStatus(unknownRefetch.signal, key, '2026-09-12'), /unavailable|unknown/i);
    assert.ok(marketEvidenceCoverage(unknownRefetch.signal, '2026-09-12').unknownDateKeys.includes(key));
    const comparison = unknownRefetch.signal.metadata.change_reconciliation.components.find(item => item.key === key);
    assert.equal(comparison.status, 'unchanged');
    assert.equal(comparison.observation_change, 'unknown');
    assert.equal(comparison.new_observation, null);
    assert.equal(comparison.current_observed_at, null);
}

// Do not rewrite old records or trust their former retrieval-as-observation labels.
const legacyProviderSnapshot = structuredClone(initialProvider.snapshot);
for (const key of ['put_call', 'naaim']) {
    legacyProviderSnapshot.components[key].last_updated = firstRetrieval;
    legacyProviderSnapshot.components[key].timestamp_basis = 'observed';
}
const legacyComponentsBefore = structuredClone(legacyProviderSnapshot.components);
const legacyProviderComparison = await providerSnapshot(datedReadings, legacyProviderSnapshot);
for (const key of ['put_call', 'naaim']) {
    const comparison = legacyProviderComparison.signal.metadata.change_reconciliation.components.find(item => item.key === key);
    assert.equal(comparison.previous_timestamp_basis, null);
    assert.equal(comparison.previous_last_updated, firstRetrieval);
    assert.equal(comparison.previous_retrieved_at, firstRetrieval);
    assert.equal(comparison.previous_observed_at, null);
    assert.equal(comparison.observation_change, 'unknown');
    assert.equal(comparison.new_observation, null);
}
assert.deepEqual(legacyProviderSnapshot.components, legacyComponentsBefore, 'Legacy provenance normalization does not mutate archived records.');
const futureProviderSnapshot = structuredClone(initialProvider.snapshot);
for (const key of ['put_call', 'naaim']) futureProviderSnapshot.components[key].last_updated = '2026-09-11';
const futureProviderComparison = await providerSnapshot(datedReadings, futureProviderSnapshot);
for (const key of ['put_call', 'naaim']) {
    const comparison = futureProviderComparison.signal.metadata.change_reconciliation.components.find(item => item.key === key);
    assert.equal(comparison.previous_timestamp_basis, null, 'An archived observation after its explicit retrieval day is unverified.');
    assert.equal(comparison.previous_last_updated, '2026-09-11');
    assert.equal(comparison.previous_retrieved_at, firstRetrieval);
    assert.equal(comparison.observation_change, 'unknown');
}
const malformedRetrievalSnapshot = structuredClone(initialProvider.snapshot);
for (const key of ['put_call', 'naaim']) {
    malformedRetrievalSnapshot.components[key].last_updated = '2026-03-01';
    malformedRetrievalSnapshot.components[key].retrieved_at = '2026-02-30T12:00:00.000Z';
}
const malformedRetrievalComparison = await providerSnapshot(datedReadings, malformedRetrievalSnapshot);
for (const key of ['put_call', 'naaim']) {
    const comparison = malformedRetrievalComparison.signal.metadata.change_reconciliation.components.find(item => item.key === key);
    assert.equal(comparison.previous_timestamp_basis, null, 'An impossible archived retrieval day cannot validate an observation through date rollover.');
    assert.equal(comparison.previous_last_updated, '2026-03-01');
    assert.equal(comparison.previous_retrieved_at, '2026-02-30T12:00:00.000Z');
    assert.equal(comparison.observation_change, 'unknown');
}
const legacyDated = structuredClone(initialProvider.snapshot.components);
for (const key of ['put_call', 'naaim']) delete legacyDated[key].retrieved_at;
assert.ok(parseStoredComponentReadings(legacyDated).filter(item => ['put_call', 'naaim'].includes(item.key)).every(item => item.timestamp_basis === 'observed'), 'Genuine calendar-dated legacy observations do not require a missing retrieval clock to be invented.');

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

const originalArchive = archivedRow;
for (const [record, expectedBasis] of [[repeatedProvider.snapshot, 'observed'], [unknownRefetch.snapshot, 'retrieved'], [legacyProviderSnapshot, null], [futureProviderSnapshot, null], [malformedRetrievalSnapshot, null]]) {
    archivedRow = { ...originalArchive, ...record, updated_at: secondRetrieval };
    const providerReplay = parseMarketReplaySnapshot({ success: true, data: await getMarketReplaySnapshot('US', 'standard', false, '2026-09-11') });
    for (const key of ['put_call', 'naaim']) {
        const item = providerReplay.components.find(component => component.key === key);
        assert.equal(item.timestampBasis, expectedBasis, 'Replay and reconciliation apply the same observation trust rule.');
        assert.equal(item.lastUpdated, record.components[key].last_updated);
        assert.equal(item.retrievedAt, record.components[key].retrieved_at);
        assert.equal(item.rawValue, record.components[key].raw_value);
    }
}

console.log('Market provenance regression passed: provider dates through real orchestration, same/new/revised/undated observations, legacy clock normalization, unchanged scoring, snapshot/replay preservation and comparable chart units.');
