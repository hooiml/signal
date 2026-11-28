import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { neon, neonConfig } from '@neondatabase/serverless';
import ts from 'typescript';

const config = { market: 'US', mode: 'standard', enableSocial: true };
const myConfig = { market: 'MY', mode: 'contrarian', enableSocial: false };
const modules = new Map();

function load(filename) {
    const file = path.resolve(filename);
    if (modules.has(file)) return modules.get(file).exports;
    const compiled = { exports: {} };
    modules.set(file, compiled);
    const require = dependency => {
        if (dependency === 'server-only') return {};
        if (dependency === '@neondatabase/serverless') return { neon };
        assert.ok(dependency.startsWith('.'), `Unexpected dependency ${dependency}`);
        return load(path.resolve(path.dirname(file), `${dependency}.ts`));
    };
    const code = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', code)(require, compiled, compiled.exports);
    return compiled.exports;
}

const fields = Object.entries({
    market_type: 25, mode: 25, enable_social: 16, snapshot_date: 25, composite_score: 23,
    tier: 25, origin: 25, coverage_note: 25, has_evidence: 16, updated_at: 1184,
}).map(([name, dataTypeID]) => ({ name, dataTypeID }));
const requests = [];
let rows = [];
let unavailable = false;
neonConfig.fetchFunction = async (url, init) => {
    requests.push({ url, payload: JSON.parse(init.body), signal: init.signal });
    if (unavailable) throw new Error('Private archive failure');
    return Response.json({ fields, rows });
};

const { readSavedMarketPulses } = load('src/lib/v9-market-pulse.ts');
delete process.env.DATABASE_URL;
assert.equal(await readSavedMarketPulses(), null);
assert.equal(requests.length, 0);
process.env.DATABASE_URL = 'postgresql://fixture:fixture@archive.test/signal';

const row = (date, score, {
    market = 'US', mode = 'standard', social = 't', tier = 'neutral', origin = 'observed',
    note = null, hasEvidence = origin === 'observed' ? 't' : 'f', updatedAt = null,
} = {}) => [market, mode, social, date, String(score), tier, origin, note, hasEvidence, updatedAt];

const latest = row('2026-11-26', 71, { tier: 'buy', updatedAt: '2026-11-26 20:01:30+00' });
const earlier = row('2026-11-25', 49);
const reconstructed = row('2026-11-24', 37, { tier: 'sell', origin: 'reconstructed', note: 'Limited reconstructed evidence.' });
const emptyObserved = row('2026-11-23', 50, { hasEvidence: 'f' });
rows = [latest, row('2026-11-25', 90, { mode: 'contrarian' }), earlier, reconstructed, emptyObserved];
assert.deepEqual(await readSavedMarketPulses(), [{
    config, snapshotDate: '2026-11-26', savedAt: '2026-11-26T20:01:30.000Z', score: 71, tier: 'buy',
    history: [
        { date: '2026-11-24', score: 37, tier: 'sell', origin: 'reconstructed', coverageNote: 'Limited reconstructed evidence.' },
        { date: '2026-11-25', score: 49, tier: 'neutral', origin: 'observed', coverageNote: null },
        { date: '2026-11-26', score: 71, tier: 'buy', origin: 'observed', coverageNote: null },
    ],
}]);
const [{ payload, signal }] = requests;
assert.deepEqual(payload.params, []);
const statement = payload.query.replace(/\s+/g, ' ').trim();
assert.match(statement, /\(VALUES \('US'\), \('MY'\)\).*\(VALUES \('standard'\), \('contrarian'\)\).*\(VALUES \(TRUE\), \(FALSE\)\)/);
assert.match(statement, /archive AS NOT MATERIALIZED .*FROM signal_snapshots/);
assert.match(statement, /jsonb_each\(CASE WHEN jsonb_typeof\(components\) = 'object' THEN components ELSE '\{\}'::jsonb END\)/);
assert.match(statement, /jsonb_typeof\(reading->'weight'\) = 'number'.*jsonb_typeof\(reading->'score'\) = 'number'.*jsonb_typeof\(reading->'raw_value'\) = 'number'.*\(reading->>'weight'\)::numeric > 0/);
assert.match(statement, /CROSS JOIN LATERAL \( SELECT snapshot_date FROM archive WHERE market_type = p.market_type AND mode = p.mode AND enable_social = p.enable_social AND origin = 'observed' AND has_evidence .* ORDER BY snapshot_date DESC LIMIT 1 \) AS latest/);
assert.match(statement, /CROSS JOIN LATERAL \( SELECT \* FROM archive WHERE market_type = p.market_type AND mode = p.mode AND enable_social = p.enable_social AND snapshot_date <= latest.snapshot_date AND \(origin = 'reconstructed' OR \(origin = 'observed' AND has_evidence\)\) ORDER BY snapshot_date DESC LIMIT 90 \) AS s/);
assert.doesNotMatch(statement, /\b(INSERT|UPDATE|DELETE|ALTER|CREATE)\b/);
assert.ok(signal instanceof AbortSignal);

const myLatest = row('2026-11-26', 0, { market: 'MY', mode: 'contrarian', social: 'f', tier: 'strong-sell', updatedAt: '2026-11-26 20:20:00+00' });
rows = [myLatest, latest, earlier];
const beforeBatch = requests.length;
assert.deepEqual((await readSavedMarketPulses()).map(profile => [profile.config, profile.score, profile.history.length]), [[myConfig, 0, 1], [config, 71, 2]]);
assert.equal(requests.length, beforeBatch + 1);

for (const invalid of [reconstructed, row('2026-11-26', 101, { updatedAt: '2026-11-26 20:01:30+00' }),
    row('2026-11-26', 51, { tier: 'unknown', updatedAt: '2026-11-26 20:01:30+00' }),
    row('2026-11-31', 60, { updatedAt: '2026-11-30 20:01:30+00' }), row('2026-11-26', 54),
    row('2026-11-26', 50, { hasEvidence: 'f', updatedAt: '2026-11-26 20:01:30+00' }),
    row('2026-11-26', 54, { updatedAt: '2026-11-25 20:01:30+00' })]) {
    rows = [invalid, earlier];
    assert.deepEqual(await readSavedMarketPulses(), []);
}

rows = [];
assert.deepEqual(await readSavedMarketPulses(), []);
unavailable = true;
assert.equal(await readSavedMarketPulses(), null);
console.log('Saved Market Pulse regression passed for config batches, bounded reads, positive evidence, archive ordering, persisted provenance and fallbacks.');

const { getLivePulseSnapshot, isCompletePulse } = load('src/lib/v9-live-market-pulse.ts');
const savedDate = '2026-11-26';
const savedAt = `${savedDate}T20:01:30.000Z`;
const nextDate = '2026-11-27';
const priorPoint = { date: '2026-11-25', score: 65, tier: 'buy', origin: 'observed' };
const point = { date: savedDate, score: 73, tier: 'buy', origin: 'observed' };
const baseline = { snapshotDate: savedDate, savedAt, history: [priorPoint, { ...point, score: 71 }] };
const livePulse = (options = {}) => ({
    mode: options.mode ?? 'standard',
    composite_score: point.score,
    tier: point.tier,
    components: { vix: { enabled: true, weight: options.weight ?? 0.35 } },
    metadata: {
        market: options.market ?? 'US',
        source_included: options.social ?? true,
        snapshot_persistence: {
            status: 'persisted',
            snapshot_date: options.date ?? savedDate,
            updated_at: 'updatedAt' in options ? options.updatedAt : `${savedDate}T21:00:00.000Z`,
        },
        score_history: options.history ?? [priorPoint, point],
    },
});

const refreshed = livePulse();
assert.deepEqual(getLivePulseSnapshot(refreshed), {
    snapshotDate: savedDate,
    savedAt: `${savedDate}T21:00:00.000Z`,
    history: [priorPoint, point],
});
assert.equal(isCompletePulse(refreshed, config, baseline), true);
assert.equal(isCompletePulse(refreshed, config, getLivePulseSnapshot(refreshed)), true, 'A valid retry can return the same stored reading');
assert.equal(isCompletePulse(livePulse({ date: nextDate, updatedAt: undefined, history: [point, { ...point, date: nextDate }] }), config, baseline), true, 'A later UTC day establishes freshness');
assert.equal(isCompletePulse(livePulse({ history: [point] }), config, { ...baseline, history: [point] }), true, 'An archive can start with a single point');

for (const [label, options] of [
    ['wrong market', { market: 'MY' }],
    ['wrong mode', { mode: 'contrarian' }],
    ['wrong source setting', { social: false }],
    ['zero scored weight', { weight: 0 }],
    ['earlier snapshot', { date: priorPoint.date, history: [priorPoint] }],
    ['earlier save on the same day', { updatedAt: `${savedDate}T19:00:00.000Z` }],
    ['unknown save on the same day', { updatedAt: undefined }],
    ['invalid save clock', { updatedAt: 'Malformed' }],
    ['history missing', { history: [] }],
    ['existing trend collapsed to a single point', { history: [point] }],
    ['history excludes the reported snapshot', { history: [priorPoint] }],
    ['history uses a different score', { history: [priorPoint, { ...point, score: 76 }] }],
    ['history uses a different tier', { history: [priorPoint, { ...point, tier: 'neutral' }] }],
    ['matching point was reconstructed', { history: [priorPoint, { ...point, origin: 'reconstructed' }] }],
    ['plotted observed duplicate carries the wrong score', { history: [priorPoint, point, { ...point, score: 76 }] }],
    ['chart ends after the reported snapshot', { history: [priorPoint, point, { ...point, date: nextDate }] }],
]) assert.equal(isCompletePulse(livePulse(options), config, baseline), false, label);

const transient = livePulse({ history: [] });
delete transient.metadata.snapshot_persistence;
assert.equal(getLivePulseSnapshot(transient), null, 'An unsaved response has no snapshot time');
assert.equal(isCompletePulse(transient, config, baseline), false, 'An unsaved response cannot displace a complete archive');
assert.equal(isCompletePulse(transient, config), true, 'A usable unsaved score can show when no archive exists');
console.log('Live Market Pulse regression passed for score/chart pairing, freshness, configuration, and partial responses.');
