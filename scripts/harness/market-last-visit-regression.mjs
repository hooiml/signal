import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// Market "since your last visit": browser-local storage parsing, baseline rotation and impact maths.
const source = path.resolve('src/components/v8/market-last-visit.ts');
const compiled = { exports: {} };
const code = ts.transpileModule(readFileSync(source, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function('require', 'module', 'exports', code)(() => ({}), compiled, compiled.exports);
const { inputImpact, visitFromSignal, parseMarketVisits, recordMarketVisit, visitChanges } = compiled.exports;

// Impact is measured from the neutral 50, so impacts plus 50 rebuild the composite with neutral fallback.
assert.equal(inputImpact(77, 0.35), (77 - 50) * 0.35);
assert.equal(inputImpact(50, 0.2), 0);
const signal = { composite_score: 61, components: {
    vix: { score: 77.14, weight: 0.35, enabled: true },
    aaii: { score: 54.5, weight: 0.2, enabled: true },
    off: { score: 90, weight: 0.1, enabled: false },
    zero: { score: 80, weight: 0, enabled: true },
} };
const visit = visitFromSignal(signal, '2026-10-22');
assert.deepEqual(Object.keys(visit.impacts), ['vix', 'aaii'], 'Disabled and zero-weight inputs are not impacts.');
assert.ok(Math.abs(50 + visit.impacts.vix + visit.impacts.aaii + 0.45 * 0 - 60.4) < 0.01);

// Malformed storage is dropped entry by entry.
assert.deepEqual(parseMarketVisits(null), {});
assert.deepEqual(parseMarketVisits('{bad'), {});
assert.deepEqual(parseMarketVisits('[]'), {});
const mixed = parseMarketVisits(JSON.stringify({
    'US:standard': { last: { snapshotDate: '2026-10-21', score: 58, impacts: { vix: 6 } }, baseline: { snapshotDate: 'x', score: 1, impacts: {} } },
    'MY:standard': { last: { snapshotDate: '2026-10-21', score: 'high', impacts: {} } },
}));
assert.deepEqual(Object.keys(mixed), ['US:standard']);
assert.equal(mixed['US:standard'].baseline, undefined, 'An invalid baseline is discarded, the valid last visit kept.');

// First visit records without a comparison; a new snapshot rotates last into baseline; a reload keeps it.
const first = recordMarketVisit({}, 'US:standard', { snapshotDate: '2026-10-20', score: 57.4, impacts: { vix: 6.1, put_call: 1.6 } });
assert.equal(first.baseline, null);
const next = recordMarketVisit(first.store, 'US:standard', { snapshotDate: '2026-10-22', score: 61, impacts: { vix: 9.5, put_call: 0.4 } });
assert.equal(next.baseline.snapshotDate, '2026-10-20');
const reload = recordMarketVisit(next.store, 'US:standard', { snapshotDate: '2026-10-22', score: 61, impacts: { vix: 9.5, put_call: 0.4 } });
assert.equal(reload.baseline.snapshotDate, '2026-10-20', 'Reloading the same snapshot keeps the comparison.');
assert.equal(recordMarketVisit(next.store, 'MY:standard', next.store['US:standard'].last).baseline, null, 'Markets and modes are tracked separately.');

// Changes: only inputs present in both, at least half a point, largest first, limited.
const changes = visitChanges(
    { snapshotDate: '2026-10-20', score: 57, impacts: { vix: 6.1, put_call: 1.6, aaii: 0.9, gone: 3 } },
    { snapshotDate: '2026-10-22', score: 61, impacts: { vix: 9.5, put_call: 0.4, aaii: 1.1, added: 2 } },
);
assert.deepEqual(changes.map(change => change.key), ['vix', 'put_call']);
assert.ok(Math.abs(changes[0].delta - 3.4) < 1e-9 && Math.abs(changes[1].delta + 1.2) < 1e-9);
console.log('Market last-visit regression passed: impact maths, storage validation, baseline rotation and change ranking.');
