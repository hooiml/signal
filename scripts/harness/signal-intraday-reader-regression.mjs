import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const day = '2026-11-20';
let now = `${day}T20:00:00Z`;
class FixedDate extends Date {
    constructor(value) { super(value ?? now); }
}
const config = { market: 'US', mode: 'standard', enableSocial: true };
const queries = [];
let stored = [];
let failure;
const sql = async (strings, ...values) => {
    const statement = strings.join('?').replace(/\s+/g, ' ').trim();
    queries.push({ statement, values });
    if (failure) throw failure;
    const [market, mode, social, date, before, upperBound, limit] = values;
    assert.equal(before, upperBound);
    return stored.filter(row => row.market_type === market && row.mode === mode && row.enable_social === social
        && row.snapshot_date === date && (before === null || BigInt(row.id) < BigInt(before)))
        .sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : 1).slice(0, limit);
};
const modules = new Map();
function load(filename) {
    const file = path.resolve(filename);
    if (modules.has(file)) return modules.get(file).exports;
    const compiledModule = { exports: {} };
    modules.set(file, compiledModule);
    const require = dependency => {
        if (dependency === 'next/server') return { NextResponse: { json: (value, init) => Response.json(value, init) } };
        const resolved = dependency.startsWith('@/') ? path.resolve('src', dependency.slice(2)) : path.resolve(path.dirname(file), dependency);
        if (resolved === path.resolve('src/lib/db')) return { sql };
        assert.ok(dependency.startsWith('.') || dependency.startsWith('@/'), `Unexpected dependency ${dependency}`);
        return load(`${resolved}.ts`);
    };
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function('require', 'module', 'exports', 'Date', source)(require, compiledModule, compiledModule.exports, FixedDate);
    return compiledModule.exports;
}

const { GET } = load('src/app/api/signals/intraday/route.ts');
const { buildSignalIntradayPage } = load('src/lib/signal-intraday.ts');
const { calculateCompositeScoreV2 } = load('src/lib/sentiment-calculator-v2.ts');
const { MARKET_SCORE_MODEL_VERSION } = load('src/lib/market-calibration.ts');

function row(id, slot, value, score, options = {}) {
    const rowConfig = { ...config, ...options.config };
    const date = options.date ?? day;
    const at = `${date}T0${slot}:00:00.000Z`;
    const signal = calculateCompositeScoreV2([{
        name: 'vix', display_name: rowConfig.market === 'US' ? 'VIX Index' : 'USD/MYR volatility proxy',
        enabled: true, score, value, weight: 0, signal: 'neutral', last_updated: options.observedAt ?? at,
        metadata: { timestamp_basis: options.basis ?? 'observed', unit: rowConfig.market === 'US' ? 'VIX points' : 'scaled model points' },
    }], rowConfig);
    const components = Object.fromEntries(Object.entries(signal.components).map(([key, observation]) => [key, {
        display_name: observation.display_name, raw_value: observation.value, score: observation.score, weight: observation.weight,
        last_updated: observation.last_updated, timestamp_basis: observation.metadata.timestamp_basis,
        unit: observation.metadata.unit, retrieved_at: at,
    }]));
    return {
        id: String(id), market_type: rowConfig.market, mode: rowConfig.mode, enable_social: rowConfig.enableSocial, snapshot_date: date,
        recorded_at: at, composite_score: signal.composite_score, tier: signal.tier, components,
        metadata_snapshot: { scoring_model_version: options.model ?? MARKET_SCORE_MODEL_VERSION,
            ...(rowConfig.market === 'MY' ? { my_news_eligibility_version: options.eligibility ?? 1 } : {}) },
    };
}

const baseline = row(1, 1, 23, 55);
const equalScore = row(2, 2, 23.4, 55);
const thresholdEntered = row(3, 3, 28, 42);
const unchanged = row(4, 4, 28, 42, { observedAt: thresholdEntered.recorded_at });
const thresholdExited = row(5, 5, 25, 55);
stored = [baseline, equalScore, thresholdEntered, unchanged, thresholdExited,
    row(6, 1, 26, 49, { date: '2026-11-19' }),
    row(7, 1, 31, 50, { config: { market: 'MY' } }),
    row(8, 1, 32, 51, { config: { mode: 'contrarian' } }),
    row(9, 1, 33, 52, { config: { enableSocial: false } }),
];

const request = query => GET(new Request(`http://localhost/api/signals/intraday?${query}`));
async function read(query = '') {
    const response = await request(query);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    const body = await response.json();
    assert.equal(body.success, true);
    return body.data;
}

const full = await read();
assert.deepEqual(full.entries.map(entry => entry.id), ['5', '4', '3', '2', '1']);
assert.equal(full.day, day);
assert.equal(full.hasEarlierCaptures, false);
const [exit, same, entry, offset, first] = full.entries;
assert.equal(first.status, 'baseline');
assert.equal(first.previousScore, null);
assert.equal(first.delta, null);
assert.equal(first.capturedAt, baseline.recorded_at);
assert.equal(same.status, 'unchanged');
assert.equal(same.delta, 0);
assert.equal(offset.status, 'changed');
assert.equal(offset.delta, 0);
assert.equal(offset.reason.code, 'inputs-changed');
assert.deepEqual(offset.accounting.drivers.map(driver => [driver.beforeValue, driver.afterValue, driver.delta]), [[23, 23.4, 0]]);
assert.equal(exit.reason.code, 'vix-threshold-exited');
assert.equal(entry.reason.code, 'vix-threshold-entered');
assert.match(entry.reason.text, /23\.4 to 28/);
assert.equal(entry.previousScore, equalScore.composite_score);
assert.equal(entry.accounting.drivers[0].key, 'vix');
assert.equal(entry.accounting.drivers[0].beforeValue, 23.4);
assert.equal(entry.accounting.drivers[0].afterValue, 28);
assert.equal(entry.accounting.drivers[0].beforeWeight, 0.4);
assert.ok(Math.abs(entry.accounting.drivers[0].afterWeight - 0.44) < 1e-9);
assert.ok(Math.abs(entry.accounting.neutralDelta - (-2)) < 1e-6);
assert.ok(Math.abs(entry.accounting.componentDelta + entry.accounting.neutralDelta + entry.accounting.roundingResidual - entry.delta) < 0.000001);

const home = await read('limit=1');
assert.deepEqual(home.entries, [exit]);
assert.equal(home.hasEarlierCaptures, true);
const pageTwo = await read(`before=${home.entries[0].id}&day=${day}&limit=2`);
assert.deepEqual(pageTwo.entries, [same, entry]);
assert.equal(pageTwo.hasEarlierCaptures, true);
const lastPage = await read(`before=${pageTwo.entries.at(-1).id}&day=${day}&limit=2`);
assert.deepEqual(lastPage.entries, [offset, first]);
assert.equal(lastPage.hasEarlierCaptures, false);
assert.deepEqual((await read('market=MY')).entries.map(item => item.id), ['7']);
assert.deepEqual((await read('mode=contrarian')).entries.map(item => item.id), ['8']);
assert.deepEqual((await read('enableSocial=false')).entries.map(item => item.id), ['9']);
assert.deepEqual((await read('mode=contrarian&enableSocial=false')).entries, []);

assert.match(queries[0].statement, /^SELECT id::text AS id, .* FROM signal_intraday_observations WHERE market_type = \? AND mode = \? AND enable_social = \? AND snapshot_date = \?::date AND \(\?::bigint IS NULL OR id < \?::bigint\) ORDER BY id DESC LIMIT \?$/);
assert.equal(queries[0].values.at(-1), 61);
assert.equal(queries[1].values.at(-1), 2);
assert.ok(queries.every(item => /^SELECT\b/.test(item.statement)));

const validationStart = queries.length;
for (const query of ['market=GB', 'market=US&market=MY', 'mode=', 'enableSocial=1', 'limit=0', 'limit=1.0', 'limit=61', 'before=2', `before=01&day=${day}`, `before=9223372036854775808&day=${day}`, 'before=2&day=2026-02-30']) {
    assert.equal((await request(query)).status, 400, query);
}
now = '2026-11-21T00:00:00Z';
assert.equal((await request(`before=5&day=${day}`)).status, 409);
assert.equal(queries.length, validationStart, 'invalid keys and rollovers perform no read');
assert.deepEqual((await read()).entries, [], 'new UTC day never borrows a baseline from yesterday');
now = `${day}T20:00:00Z`;
failure = new Error('Private datastore details');
const unavailable = await request('');
assert.equal(unavailable.status, 503);
assert.doesNotMatch(await unavailable.text(), /Private datastore details/);
failure = undefined;

function compare(current, earlier, comparisonConfig = config) {
    return buildSignalIntradayPage([current, earlier], comparisonConfig, day, 1, null).entries[0];
}
const corrupted = { ...thresholdEntered, composite_score: 99 };
assert.equal(compare(corrupted, equalScore).reason.code, 'evidence-unavailable');
assert.equal(compare(corrupted, equalScore).accounting, null);
assert.equal(compare({ ...thresholdEntered, metadata_snapshot: {} }, equalScore).reason.code, 'configuration-unknown');
assert.equal(compare(row(3, 3, 31.2, 42, { model: 'future' }), equalScore).reason.code, 'configuration-changed');
const myConfig = { ...config, market: 'MY' };
assert.equal(compare(row(2, 2, 31, 42, { config: myConfig, eligibility: 2 }), row(1, 1, 29, 55, { config: myConfig }), myConfig).reason.code, 'configuration-changed');
assert.equal(compare(row(2, 2, 31, 42, { config: myConfig }), row(1, 1, 29, 55, { config: myConfig }), myConfig).reason.code, 'inputs-changed');
const unverifiedCrossing = compare(row(3, 3, 28, 42, { basis: 'retrieved' }), equalScore);
assert.equal(unverifiedCrossing.reason.code, 'coverage-or-weights');
assert.match(unverifiedCrossing.reason.text, /23\.4 to 28.*40% to 44%.*cannot establish a market crossing/);
assert.equal(compare(row(2, 2, 23.4, 55, { basis: 'retrieved' }), baseline).reason.code, 'observation-uncertain');
assert.equal(compare(row(2, 2, 23.4, 55, { observedAt: baseline.recorded_at }), baseline).reason.code, 'observation-uncertain');
assert.equal(compare(row(2, 2, 23.4, 55, { observedAt: `${day}T09:00:00Z` }), baseline).reason.code, 'observation-uncertain');
assert.throws(() => compare({ ...thresholdEntered, recorded_at: day }, equalScore), /Invalid intraday capture/);
assert.throws(() => compare(equalScore, thresholdEntered), /Invalid intraday capture order/);

console.log('Intraday read regression passed: bounds, configuration and day isolation, capture times, keyset rollover, reconciliation and VIX attribution.');
