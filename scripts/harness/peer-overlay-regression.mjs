import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const file = path.resolve('src/lib/research/peer-overlay.ts');
const mod = { exports: {} };
const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function('require', 'module', 'exports', code)(() => { throw new Error('unexpected import'); }, mod, mod.exports);

const { buildRebasedPeerOverlay } = mod.exports;

const subject = [
    { time: '2026-08-01', close: 100 },
    { time: '2026-08-02', close: 110 },
    { time: '2026-08-03', close: 120 },
];
const peerA = [
    { time: '2026-08-01', close: 200 },
    { time: '2026-08-02', close: 210 },
    { time: '2026-08-03', close: 220 },
];
const peerB = [
    { time: '2026-07-01', close: 50 }, // no overlap with August range
];

const result = buildRebasedPeerOverlay(subject, [
    { symbol: 'MSFT', points: peerA },
    { symbol: 'NVDA', points: peerB },
]);

assert.ok(result);
assert.equal(result.subject[0].pct, 0);
assert.equal(result.subject[2].pct, 20);
assert.equal(result.peers.length, 2);
assert.equal(result.peers[0].available, true);
assert.equal(result.peers[0].points[0].pct, 0);
assert.equal(result.peers[0].latestPct, 10);
assert.equal(result.peers[1].available, false);
assert.equal(result.peers[1].latestPct, null);
assert.ok(result.minPct <= 0 && result.maxPct >= 20);

// Fewer than 2 valid subject points returns null cleanly.
assert.equal(buildRebasedPeerOverlay([{ time: '2026-08-01', close: 100 }], []), null);

console.log('peer-overlay regression: ok');
