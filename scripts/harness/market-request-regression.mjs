import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { marketRequestFixture } from './market-request-fixture.mjs';

const baseline = process.argv.includes('--capture-baseline');
const compareIndex = process.argv.indexOf('--compare');
const outputIndex = process.argv.indexOf('--output');
const sourceIndex = process.argv.indexOf('--baseline-source');
const signalSource = sourceIndex < 0 ? undefined : await readFile(process.argv[sourceIndex+1], 'utf8');
assert.ok(!signalSource || baseline, '--baseline-source requires --capture-baseline');
const fixtureOptions = { allowSchema: baseline, signalSource };
const results = [];
const request = async (fixture, query = '') => {
    const response = await fixture.route.GET(fixture.request(query));
    return { status: response.status, body: await response.json(), cache: response.headers.get('x-signal-cache'), timing: response.headers.get('server-timing') };
};
const assertTimings = result => {
    assert.match(result.timing, /(?:^|, )signal;dur=\d+\.\d(?:,|$)/);
    for (const entry of result.timing.split(', ')) assert.match(entry, /^[a-z_]+;dur=\d+\.\d$/);
};
const assertProviderIsolation = async () => {
    const unavailableVix = () => { throw new Error('Fixture VIX unavailable'); };
    const fx = { currentPrice: 4.2, vol20d: .003, change: .01, observedAt: new Date('2026-09-11T08:00:00.000Z') };
    const writes = fixture => fixture.calls.filter(call => call.query.startsWith('INSERT INTO signal_snapshots'));
    const persistedVix = fixture => writes(fixture)[0].values
        .filter(value => typeof value === 'string').map(value => { try { return JSON.parse(value); } catch { return null; } })
        .find(value => value?.vix?.raw_value !== undefined).vix;

    // These outputs were captured from the real healthy orchestration before isolation changed.
    for (const [market, value, score, composite, components] of [
        ['US', 20, 60, 56, { vixScore: 66.08, socialScore: 50, vixWeight: .6, socialWeight: .4 }],
        ['MY', 12, 61, 60, { vixScore: 88.08, socialScore: 50, vixWeight: .3, socialWeight: .7 }],
    ]) {
        const healthy = marketRequestFixture({ providerOverrides: {} });
        const raw = await healthy.signal.fetchRawMarketData(market, false, false);
        assert.equal(raw.fearGauge.value, value);
        assert.deepEqual(raw.sentimentOutput, { score, auraLevel: 'NEUTRAL', components });
        const result = await request(healthy, `market=${market}&enableSocial=false`);
        assert.equal(result.body.data.composite_score, composite, 'Healthy scoring remains unchanged.');
        assert.equal(result.body.data.metadata.signal_quality.market_regime, 'Mixed / Neutral');
        if (market === 'US') assert.ok(!healthy.events.includes('fetchHistoricalCurrencyVol'));
    }

    for (const mode of ['standard', 'contrarian']) for (const social of [true, false]) {
        const query = `market=MY&mode=${mode}&enableSocial=${social}`;
        const healthy = await request(marketRequestFixture({ providerOverrides: {} }), query);
        const isolated = marketRequestFixture({ providerOverrides: { fetchVIX: unavailableVix } });
        const result = await request(isolated, query);
        assert.equal(result.status, 200, 'MY succeeds from valid FX when the independent VIX provider rejects.');
        isolated.parseSignal(result.body, 'MY', mode);
        assert.equal(result.body.data.composite_score, healthy.body.data.composite_score);
        assert.deepEqual(result.body.data.components, healthy.body.data.components, 'VIX availability cannot change selected FX scoring, weighting or provenance.');
        assert.equal(writes(isolated).length, 1);
        assert.equal(persistedVix(isolated).raw_value, 12);
        assert.equal(persistedVix(isolated).last_updated, fx.observedAt.toISOString());
        assert.equal(persistedVix(isolated).unit, 'scaled model points');
        assert.deepEqual(isolated.providerTimeouts, [3000]);
    }
    for (const auraRows of [[], [{ signal_date: '2026-09-12', summary: 'VIX at 99 signals stress.', key_drivers: [{ factor: 'VIX Index', impact: 'negative', description: 'VIX at 99.' }], outlook: 'VIX at 99 may persist.' }]]) {
        const isolated = marketRequestFixture({ auraRows, providerOverrides: {
            fetchVIX: unavailableVix,
            fetchMarketNews: () => [{ title: 'Fixture company update', pubDate: '2026-09-12T00:00:00.000Z' }],
        } });
        const result = await isolated.signal.getSmartSignal('MY', 'standard', false);
        assert.equal(result.meta.status, 'OK', 'Legacy Aura callers also survive VIX failure.');
        assert.equal(result.rawMetrics.vix, null);
        assert.equal(result.rawMetrics.vixChange, null);
        assert.equal(result.meta.dataQuality, 'GOOD', 'Quality is assessed from the selected usable gauge.');
        assert.equal(result.meta.vixSource, 'USD/MYR_VOL_PROXY');
        assert.match(result.marketAura.keyDrivers[0].factor, /USD\/MYR/);
        assert.match(result.marketAura.keyDrivers[0].description, /12\.00.*scaled model points/);
        assert.doesNotMatch(JSON.stringify(result.marketAura), /VIX(?: Index)? (?:at|is)|99/);
        assert.equal(writes(isolated).length, 1, 'A successful write cannot be followed by a late raw-VIX dereference error.');
    }
    const highFx = marketRequestFixture({ providerOverrides: { fetchVIX: unavailableVix, fetchHistoricalCurrencyVol: () => ({ ...fx, vol20d: .01 }) } });
    const high = await highFx.signal.getSmartSignal('MY', 'standard', false, undefined, { includeAura: false });
    assert.equal(high.v2.metadata.signal_quality.market_regime, 'High-Volatility Stress');

    for (const fxReading of [null, { ...fx, vol20d: 0 }, { ...fx, vol20d: NaN }, { ...fx, vol20d: Infinity }]) {
        const fallback = marketRequestFixture({ providerOverrides: { fetchHistoricalCurrencyVol: () => fxReading } });
        const result = await fallback.signal.getSmartSignal('MY', 'standard', false, undefined, { includeAura: false });
        assert.equal(result.meta.status, 'OK');
        assert.equal(result.meta.vixSource, 'CBOE_VIX');
        assert.match(result.meta.vixDisclaimer, /USD\/MYR.*unavailable.*US VIX/i);
        assert.equal(result.v2.components.vix.value, 20);
        assert.equal(result.v2.components.vix.last_updated, '2026-09-11T20:00:00.000Z');
        assert.equal(result.v2.components.vix.metadata.unit, 'VIX points');
        assert.match(result.v2.components.vix.display_name, /US VIX/);
    }
    for (const price of [0, NaN, Infinity]) {
        const invalidVix = marketRequestFixture({ providerOverrides: { fetchVIX: () => ({ price, change: 0 }) } });
        const result = await invalidVix.signal.getSmartSignal('MY', 'standard', false, undefined, { includeAura: false });
        assert.equal(result.meta.status, 'OK');
        assert.equal(result.rawMetrics.vix, null, 'An invalid optional VIX reading stays unavailable instead of becoming a fabricated raw value.');
        assert.equal(result.v2.components.vix.value, 12);
    }
    let fxAvailable = false;
    const unavailable = marketRequestFixture({ providerOverrides: { fetchVIX: unavailableVix, fetchHistoricalCurrencyVol: () => fxAvailable ? fx : null } });
    const failed = await request(unavailable, 'market=MY&enableSocial=false');
    assert.equal(failed.status, 500);
    assert.equal(failed.body.success, false);
    assert.equal(writes(unavailable).length, 0, 'No usable fear gauge means no snapshot.');
    fxAvailable = true;
    assert.equal((await request(unavailable, 'market=MY&enableSocial=false')).cache, 'miss', 'Unavailable results cannot become cached successes.');
    const failedUs = marketRequestFixture({ providerOverrides: { fetchVIX: unavailableVix } });
    assert.equal((await request(failedUs, 'market=US')).status, 500, 'US retains its required VIX dependency.');
    assert.equal(writes(failedUs).length, 0);
    assert.deepEqual(failedUs.providerTimeouts, [], 'The optional MY timeout does not change US requests.');

    // Run the real Yahoo adapter with a held HTTP response that only ends through its AbortSignal.
    let cancelled = false;
    const held = marketRequestFixture({ providerOverrides: {}, providerFetch: async (url, init) => {
        assert.match(url, /\^VIX\?interval=1d&range=1d$/);
        assert.ok(init.signal instanceof AbortSignal, 'The MY cancellation signal reaches the actual fetch boundary.');
        return new Promise((resolve, reject) => {
            const watchdog = setTimeout(() => reject(new Error('VIX cancellation did not arrive')), 10_000);
            init.signal.addEventListener('abort', () => {
                clearTimeout(watchdog);
                cancelled = true;
                reject(init.signal.reason);
            }, { once: true });
        });
    } });
    const recovered = await request(held, 'market=MY&enableSocial=false');
    assert.equal(cancelled, true);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.data.components.vix.value, 12);
    assert.deepEqual(held.providerTimeouts, [3000]);

    const previousSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'fixture-debug-secret';
    try {
        const debug = marketRequestFixture({ providerOverrides: { fetchVIX: unavailableVix } });
        const route = debug.debugRoute();
        assert.equal((await route.GET(new Request('http://fixture.invalid/api/signals/debug'))).status, 401);
        assert.deepEqual(debug.events, [], 'Unauthorized diagnostics do not fetch providers.');
        const response = await route.GET(new Request('http://fixture.invalid/api/signals/debug', { headers: { authorization: 'Bearer fixture-debug-secret' } }));
        const body = await response.json();
        assert.equal(response.status, 200);
        assert.equal(body.US.status, 'UNAVAILABLE');
        assert.equal(body.MY.status, 'OK');
        assert.equal(body.MY.raw_inputs.vix_value, null);
        assert.equal(body.MY.raw_inputs.vix_available, false);
        assert.equal(body.MY.raw_inputs.fear_gauge_value, 12);
        assert.equal(body.MY.raw_inputs.fear_gauge_unit, 'scaled model points');
        assert.equal(body.MY.FINAL_SCORE, 61);
        assert.deepEqual(writes(debug), [], 'Diagnostics never persist a signal.');
    } finally {
        if (previousSecret === undefined) delete process.env.CRON_SECRET;
        else process.env.CRON_SECRET = previousSecret;
    }
};
const originalError = console.error, originalWarn = console.warn;
try {
    // Expected dependency failures below must retain the existing graceful error contracts.
    console.error = () => {};
    console.warn = () => {};
    for (const market of ['US', 'MY']) for (const mode of ['standard', 'contrarian']) for (const social of [true, false]) {
        const fixture = marketRequestFixture(fixtureOptions);
        const query = `market=${market}&mode=${mode}&enableSocial=${social}`;
        const result = await request(fixture, query);
        assert.equal(result.status, 200);
        assert.equal(result.body.success, true);
        fixture.parseSignal(result.body, market, mode);
        assert.equal(result.body.data.metadata.market, market);
        assert.equal(result.body.data.mode, mode);
        assert.equal(result.cache, 'miss');
        assertTimings(result);
        if (!baseline) assert.doesNotMatch(result.timing, /(?:^|, )aura;/);
        assert.equal(fixture.calls.length, baseline ? 8 : 3);
        assert.equal(fixture.calls.filter(c => /^(CREATE|ALTER)/.test(c.query)).length, baseline ? 4 : 0);
        const write = fixture.calls.find(c => c.query.startsWith('INSERT'));
        assert.deepEqual(write.values.slice(0,3), [market, mode, social]);
        assert.match(write.query, /origin = 'observed', coverage_note = NULL/);
        assert.equal(result.body.data.metadata.score_delta.previous_score, 45);
        assert.equal(result.body.data.metadata.score_history.length, 2);
        assert.deepEqual(fixture.events, ['providers', 'institutional', 'calibration']);
        results.push({ scenario: query, ...result, calls: structuredClone(fixture.calls) });
        const hit = await request(fixture, query);
        assert.equal(hit.cache, 'hit');
        assert.deepEqual(hit.body, result.body);
        assert.doesNotMatch(hit.timing, /providers|snapshot|calibration/);
        assert.equal(fixture.calls.length, baseline ? 8 : 3);
        const refresh = await request(fixture, `${query}&refresh=true`);
        assert.equal(refresh.cache, 'bypass');
        assert.equal(fixture.calls.length, baseline ? 16 : 6);
    }
    for (const failure of ['providers', 'FROM market_signals', 'snapshot_date < CURRENT_DATE', 'LIMIT 89', 'INSERT INTO signal_snapshots', 'calibration']) {
        const fixture = marketRequestFixture(fixtureOptions);
        fixture.setFailure(failure);
        const result = await request(fixture);
        assertTimings(result);
        assert.equal(result.status, failure === 'providers' ? 500 : 200);
        if (failure === 'providers') {
            assert.equal(fixture.calls.length, 0);
            fixture.setFailure('');
            assert.equal((await request(fixture)).cache, 'miss', 'Engine errors must not be cached');
        } else if (['snapshot_date < CURRENT_DATE', 'LIMIT 89', 'INSERT INTO signal_snapshots'].includes(failure)) {
            assert.equal(result.body.data.metadata.score_history, undefined);
            assert.ok(!fixture.events.includes('calibration'), 'Do not calibrate after failed persistence');
        } else if (failure === 'calibration') assert.equal(result.body.data.metadata.historical_validation, undefined);
        results.push({ scenario: failure, status: result.status, body: result.body });
    }
    for (const query of ['market=bad', 'mode=bad', 'enableSocial=bad', 'refresh=bad']) {
        const fixture = marketRequestFixture();
        const result = await request(fixture, query);
        assert.equal(result.status, 400);
        assertTimings(result);
        assert.deepEqual(fixture.events, []);
        assert.deepEqual(fixture.calls, []);
    }
    const shared = marketRequestFixture(fixtureOptions);
    let release;
    shared.setHold(new Promise(resolve => { release = resolve; }));
    const first = request(shared);
    const second = request(shared);
    release();
    const [owner, waiter] = await Promise.all([first, second]);
    assert.equal(owner.cache, 'miss');
    assert.equal(waiter.cache, 'shared');
    assert.deepEqual(owner.body, waiter.body);
    assert.doesNotMatch(waiter.timing, /providers|snapshot|calibration/);
    assert.equal(shared.events.filter(e => e === 'providers').length, 1);
    if (!baseline) {
        const concurrent = marketRequestFixture();
        let releaseProviders;
        concurrent.setHold(new Promise(resolve => { releaseProviders = resolve; }));
        const pending = request(concurrent);
        assert.deepEqual(concurrent.events, ['providers', 'institutional'], 'Start independent inputs together');
        releaseProviders();
        await pending;
        const snapshots = marketRequestFixture();
        let releaseSql;
        snapshots.setSqlHold(new Promise(resolve => { releaseSql = resolve; }));
        const snapshotRequest = request(snapshots);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(snapshots.calls.filter(c => c.query.includes('FROM signal_snapshots')).length, 2);
        assert.equal(snapshots.calls.some(c => c.query.startsWith('INSERT')), false, 'Do not write until reads resolve');
        releaseSql();
        await snapshotRequest;
        const legacy = marketRequestFixture();
        const full = await legacy.signal.getSmartSignal();
        assert.ok(full.marketAura, 'Legacy callers retain Aura');
        assert.ok(legacy.calls.some(c => c.query.includes('FROM market_signals')));
        await assertProviderIsolation();
    }
    if (compareIndex >= 0) {
        const before = JSON.parse(await readFile(process.argv[compareIndex+1], 'utf8'));
        assert.equal(before.results.length, results.length);
        for (const [i, result] of results.entries()) {
            assert.equal(result.scenario, before.results[i].scenario);
            assert.equal(result.status, before.results[i].status);
            assert.deepEqual(result.body, before.results[i].body);
            if (result.calls) assert.deepEqual(result.calls, before.results[i].calls.filter(c => !/^(CREATE|ALTER)/.test(c.query) && !c.query.includes('FROM market_signals')));
        }
    }
} finally {
    console.error = originalError;
    console.warn = originalWarn;
}
if (outputIndex >= 0) {
    const file = process.argv[outputIndex+1];
    await mkdir((await import('node:path')).dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ dataMode: 'isolated SQL/providers; no real latency claim', baseline, results }, null, 2));
}
console.log(`Market request regression passed: ${results.length} payload scenarios; cache hit/bypass/shared, validation, and failure checks passed; ${baseline ? 'baseline DDL intercepted' : 'zero DDL; real MY provider isolation, timeout, Aura, snapshot and debug checks passed'}.`);
