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
        assert.equal(fixture.calls.length, baseline ? 8 : 4);
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
        assert.equal(fixture.calls.length, baseline ? 8 : 4);
        const refresh = await request(fixture, `${query}&refresh=true`);
        assert.equal(refresh.cache, 'bypass');
        assert.equal(fixture.calls.length, baseline ? 16 : 8);
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
    if (compareIndex >= 0) {
        const before = JSON.parse(await readFile(process.argv[compareIndex+1], 'utf8'));
        assert.equal(before.results.length, results.length);
        for (const [i, result] of results.entries()) {
            assert.equal(result.scenario, before.results[i].scenario);
            assert.equal(result.status, before.results[i].status);
            assert.deepEqual(result.body, before.results[i].body);
            if (result.calls) assert.deepEqual(result.calls, before.results[i].calls.filter(c => !/^(CREATE|ALTER)/.test(c.query)));
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
console.log(`Market request regression passed: ${results.length} payload scenarios; cache hit/bypass/shared, validation, and failure checks passed; ${baseline ? 'baseline DDL intercepted' : 'zero DDL'}.`);
