import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { marketRequestFixture } from './market-request-fixture.mjs';

const cache = new Map();
function loadTs(file) {
    const absolute = path.resolve(file);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = { exports: {} };
    cache.set(absolute, mod);
    const req = id => {
        const resolved = id.startsWith('@/')
            ? path.resolve('src', id.slice(2))
            : path.resolve(path.dirname(absolute), id);
        return loadTs(`${resolved}.ts`);
    };
    const code = ts.transpileModule(readFileSync(absolute, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
    return mod.exports;
}

const { computeScoreAnatomy, indicatorCadenceInfo } = loadTs('src/lib/market-score-anatomy.ts');

const fixture = marketRequestFixture({
    providerReadings: {
        putCallRatio: {
            ratio: 1.08,
            reportDate: '2026-09-11',
            observedAt: '2026-09-11T20:00:00Z',
            source: 'Cboe',
            totalCalls: 1200000,
            totalPuts: 1296000,
            sourceUrl: 'https://www.cboe.com/',
        },
    },
});
const res = await fixture.route.GET(fixture.request('market=US&mode=standard&enableSocial=false'));
const payload = await res.json();
const signal = payload.data;

// 1. Cadence labels are present and accurate for known indicators.
assert.equal(indicatorCadenceInfo('vix')?.shortLabel, 'Live · daily');
assert.equal(indicatorCadenceInfo('aaii')?.shortLabel, 'Weekly · Thu');
assert.equal(indicatorCadenceInfo('put_call')?.shortLabel, 'Daily · EOD');
assert.equal(indicatorCadenceInfo('bofa')?.shortLabel, 'Monthly');
assert.equal(indicatorCadenceInfo('unknown_xyz'), null);

// 2. Empty exclusion reproduces the official composite score with zero delta.
const base = computeScoreAnatomy(signal, new Set());
assert.equal(base.officialScore, signal.composite_score);
assert.equal(base.exploringScore, signal.composite_score);
assert.equal(base.delta, 0);
assert.equal(base.excludedNames.length, 0);
assert.ok(base.items.length >= 2, 'Expected at least two active scored indicators');

// 3. Excluding VIX recalculates score proportionally across remaining active inputs without mutating signal.
const beforeScore = signal.composite_score;
const withoutVix = computeScoreAnatomy(signal, new Set(['vix']));
assert.equal(signal.composite_score, beforeScore, 'computeScoreAnatomy must not mutate signal');
assert.equal(withoutVix.excludedNames.length, 1);
assert.ok(withoutVix.exploringScore !== null && withoutVix.exploringScore >= 0 && withoutVix.exploringScore <= 100);
assert.equal(withoutVix.delta, withoutVix.exploringScore - Math.round(signal.composite_score));
assert.equal(withoutVix.items.find(i => i.key === 'vix')?.included, false);

// 4. Excluding all active indicators returns null exploringScore rather than inventing a number.
const allKeys = new Set(base.items.map(i => i.key));
const emptyActive = computeScoreAnatomy(signal, allKeys);
assert.equal(emptyActive.exploringScore, null);
assert.equal(emptyActive.exploringTier, null);
assert.equal(emptyActive.delta, null);

console.log('market-score-anatomy regression: ok');
