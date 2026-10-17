import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Deterministic source-level coverage contracts; no providers, DB, network or browser.
const cache = new Map();
function load(filename) {
    const file = path.resolve(filename);
    if (cache.has(file)) return cache.get(file).exports;
    const compiledModule = { exports: {} };
    cache.set(file, compiledModule);
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        fileName: file,
    }).outputText;
    const require = (id) => {
        assert.ok(id.startsWith('.'), 'Unexpected module import: ' + id);
        return load(path.resolve(path.dirname(file), id) + '.ts');
    };
    new Function('require', 'module', 'exports', compiled)(require, compiledModule, compiledModule.exports);
    return compiledModule.exports;
}
const { marketEvidenceCoverage, hasRetrievalTimestamp } = load('src/lib/market-evidence-coverage.ts');
const { calculateCompositeScoreV2 } = load('src/lib/sentiment-calculator-v2.ts');
const { MARKET_SCORE_TIER_THRESHOLDS } = load('src/lib/market-score-thresholds.ts');
assert.deepEqual(MARKET_SCORE_TIER_THRESHOLDS, {
    strongNegative: 20, neutralLower: 40, neutralUpper: 65, strongPositive: 85,
});
const date = '2026-10-16';
const mk = (name, weight, last_updated = '2026-10-16T00:00:00Z') => ({
    name, display_name: name, enabled: true, value: 16, score: 50, weight,
    last_updated, metadata: { timestamp_basis: 'observed' },
    signal: 'neutral',
});
const components = {
    vix: mk('vix', .35),
    put_call: mk('put_call', .10),
    aaii: mk('aaii', .20, '2026-07-08T00:00:00Z'),
};
const sample = {
    components,
    metadata: {
        market: 'US',
        coverage_adjustment: {
            active_weight: .65, missing_weight: .35, neutral_baseline: 50,
            active_points: 30, neutral_points: 17.5,
        },
    },
};
const p = marketEvidenceCoverage(sample, date);
assert.deepEqual([p.configuredCount, p.scoredCount, p.unavailableKeys.length], [6, 3, 3]);
assert.equal(p.verifiedPartition, true);
assert.ok(Math.abs(p.freshPct - 45) < 1e-9);
assert.ok(Math.abs(p.stalePct - 20) < 1e-9);
assert.ok(Math.abs(p.fallbackPct - 35) < 1e-9);
assert.ok(Math.abs(p.freshPct + p.stalePct + p.fallbackPct - 100) < 1e-9);
assert.deepEqual(p.staleKeys, ['aaii']);

const retrievedOnly = structuredClone(sample);
retrievedOnly.components.put_call.metadata.timestamp_basis = 'retrieved';
const unknown = marketEvidenceCoverage(retrievedOnly, date);
assert.equal(unknown.verifiedPartition, false);
assert.equal(unknown.freshPct, null);
assert.deepEqual(unknown.unknownDateKeys, ['put_call']);
assert.equal(unknown.observedPct, 65);
assert.equal(unknown.fallbackPct, 35);

for (const [name, market] of [['social', 'US'], ['news', 'MY']]) {
    const legacy = structuredClone(sample);
    legacy.metadata.market = market;
    const input = mk(name, .2);
    delete input.metadata.timestamp_basis;
    legacy.components[name] = input;
    assert.equal(hasRetrievalTimestamp(input), true);
    assert.ok(marketEvidenceCoverage(legacy, date).unknownDateKeys.includes(name));
    assert.equal(marketEvidenceCoverage(legacy, date).freshPct, null);
    input.metadata.timestamp_basis = 'observed';
    assert.equal(hasRetrievalTimestamp(input), false, 'Explicit observation provenance takes precedence.');
}

const misweighted = structuredClone(sample);
misweighted.components.vix.weight = .34;
assert.equal(marketEvidenceCoverage(misweighted, date).verifiedPartition, false);

const noCoverage = structuredClone(sample);
delete noCoverage.metadata.coverage_adjustment;
assert.equal(marketEvidenceCoverage(noCoverage, date).observedPct, null);

const noSnapshot = marketEvidenceCoverage(sample, null);
assert.equal(noSnapshot.verifiedPartition, false);
assert.equal(noSnapshot.unknownDateKeys.length, 3);

const future = structuredClone(sample);
future.components.vix.last_updated = '2026-10-17T00:00:00Z';
assert.equal(marketEvidenceCoverage(future, date).verifiedPartition, false);

const stressed = structuredClone(sample);
stressed.components = { vix: { ...mk('vix', .85), value: 35 } };
stressed.metadata.coverage_adjustment = { active_weight: .85, missing_weight: .15, neutral_baseline: 50, active_points: 50, neutral_points: 7.5 };
const panic = marketEvidenceCoverage(stressed, date);
assert.deepEqual([panic.configuredCount, panic.scoredCount], [2, 1]);
assert.equal(panic.verifiedPartition, true);
assert.equal(panic.freshPct, 85);
assert.equal(panic.fallbackPct, 15);

const contextOnly = structuredClone(sample);
contextOnly.components.example_context = mk('example_context', .4);
assert.deepEqual([
    marketEvidenceCoverage(contextOnly, date).configuredCount,
    marketEvidenceCoverage(contextOnly, date).observedPct,
], [6, 65]);

const response = calculateCompositeScoreV2(Object.values(components), { market: 'US', mode: 'standard' });
assert.ok(Math.abs(response.metadata.coverage_adjustment.active_weight - .65) < 1e-9);
assert.ok(Math.abs(response.metadata.coverage_adjustment.missing_weight - .35) < 1e-9);
assert.equal(response.tier, 'neutral');

console.log('PASS V8.1 coverage: disjoint fresh/stale/fallback weights, unknown dates, mismatches, high-volatility overrides and model thresholds.');
