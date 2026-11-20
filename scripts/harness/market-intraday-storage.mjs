import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { readMarketIntradayProvisioning } from '../../src/lib/market-intraday-schema.mjs';
import { marketRequestFixture } from './market-request-fixture.mjs';

// Real PostgreSQL only. Use task-owned loopback credentials and never read DATABASE_URL.
const pgBin = process.env.SIGNAL_TEST_PG_BIN;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('PG')));
const temp = await realpath(tmpdir());
const directory = await mkdtemp(join(temp, 'signal-intraday-pg-'));
const data = join(directory, 'data');
const host = '127.0.0.1';
const username = 'signal_intraday_test';

const executable = name => pgBin ? join(pgBin, process.platform === 'win32' ? name + '.exe' : name) : name;
function run(name, args, input) {
    const result = spawnSync(executable(name), args, {
        input, encoding: 'utf8', env, timeout: 20000, windowsHide: true,
        // A Windows postmaster can inherit open pipe handles from pg_ctl.
        ...(name === 'pg_ctl' && args.at(-1) === 'start' ? { stdio: 'ignore' } : {}),
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${name} failed\n${result.stderr}\n${result.stdout}`);
    return result.stdout?.trim() ?? '';
}

const portProbe = createServer();
await new Promise((resolve, reject) => portProbe.once('error', reject).listen(0, host, resolve));
const { port } = portProbe.address();
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
const args = ['-X', '-w', '-qAt', '-h', host, '-p', String(port), '-U', username, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'];
const timezone = "SET TIME ZONE 'Pacific/Kiritimati';";
const query = input => run('psql', args, `${timezone}\n${input}\n`);
const group = "market_type = 'US' AND mode = 'standard' AND enable_social";
const count = () => Number(query(`SELECT count(*) FROM signal_intraday_observations WHERE ${group};`));

const sqlLiteral = value => typeof value === 'string' ? "'" + value.replaceAll("'", "''") + "'" : String(value);
const fixture = marketRequestFixture();
const fixtureResponse = await fixture.route.GET(fixture.request('market=US&mode=standard&enableSocial=true'));
assert.equal(fixtureResponse.status, 200);
const upsert = fixture.calls.find(call => call.query.startsWith('INSERT INTO signal_snapshots'));
assert.equal(upsert?.values.length, 14, 'Use the application upsert and the same SQL payload produced by its writer.');
const baseline = JSON.parse(upsert.values[8]);
const baselineModel = JSON.parse(upsert.values[13]);
const withVix = value => ({
    ...baseline, vix: { ...baseline.vix, raw_value: value, timestamp_basis: 'observed', last_updated: '2026-11-19' },
});

function writeSnapshot({ market = 'US', mode = 'standard', source = true, score = 50, components = withVix(29), model = baselineModel, day } = {}) {
    const values = [...upsert.values];
    values.splice(0, 4, market, mode, source, score);
    values[8] = JSON.stringify(components);
    values[13] = JSON.stringify(model);
    let index = 0;
    const statement = upsert.query.replaceAll('?', () => sqlLiteral(values[index++]));
    assert.equal(index, values.length);
    return (day ? statement.replace("(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date", day) : statement) + ';';
}

function writerSession(application) {
    const child = spawn(executable('psql'), args, {
        env: { ...env, PGAPPNAME: application, PGOPTIONS: '-c statement_timeout=12000' },
        windowsHide: true,
    });
    let output = '';
    let errors = '';
    child.stdout.setEncoding('utf8').on('data', text => { output += text; });
    child.stderr.setEncoding('utf8').on('data', text => { errors += text; });
    const done = new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', code => code === 0 ? resolve(output) : reject(new Error(`Local writer failed: ${errors}`)));
    });
    void done.catch(() => {});
    return { child, done, output: () => output };
}

async function until(predicate, message) {
    const deadline = Date.now() + 8000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, message);
        await wait(50);
    }
}

async function raceWrites(left, right) {
    const first = writerSession('signal_intraday_first');
    let second;
    try {
        first.child.stdin.write(`${timezone}\nBEGIN;\n${left}\n\\echo daily-row-held\n`);
        await until(() => first.output().includes('daily-row-held'), 'First writer must obtain the daily row lock.');
        second = writerSession('signal_intraday_second');
        second.child.stdin.end(`${timezone}\n${right}\n`);
        await until(() => query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name = 'signal_intraday_second' AND wait_event_type = 'Lock');") === 't',
            'Second writer must wait on the first writer.');
        first.child.stdin.end('COMMIT;\n');
        await Promise.all([first.done, second.done]);
    } finally {
        first.child.kill();
        second?.child.kill();
    }
}

let startAttempted = false;
try {
    run('initdb', ['-D', data, '-U', username, '--auth=trust', '--no-locale', '-E', 'UTF8']);
    startAttempted = true;
    run('pg_ctl', ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-h ${host} -p ${port} -k ""`, '-w', 'start']);
    run('psql', [...args, '-f', 'schema.sql']);
    assert.equal(count(), 0, 'Fresh provisioning starts with no captures.');

    // Simulate an upgrade from an existing daily table, including a current daily record.
    query('DROP TRIGGER capture_signal_intraday ON signal_snapshots; DROP TABLE signal_intraday_observations;');
    query(writeSnapshot());
    query(writeSnapshot({ day: "((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date - 1)" }));
    const provisioning = await readMarketIntradayProvisioning();
    query(provisioning);
    query(provisioning);
    assert.equal(count(), 0, 'Upgrades and retries create no observations from retained rows.');

    query("UPDATE signal_snapshots SET composite_score = 51 WHERE snapshot_date < (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;");
    query(`UPDATE signal_snapshots SET origin = 'reconstructed' WHERE ${group} AND snapshot_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;`);
    assert.equal(count(), 0, 'Earlier dates and reconstructed rows cannot be captured.');
    query(writeSnapshot({ components: {} }));
    assert.equal(count(), 0, 'A fallback without scored inputs is not an observation.');

    query(writeSnapshot());
    assert.equal(count(), 1);
    assert.equal(query(`SELECT snapshot_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
        AND snapshot_date = (recorded_at AT TIME ZONE 'UTC')::date
        AND components->'vix'->>'last_updated' = '2026-11-19'
        AND NOT (metadata_snapshot ? 'market_context')
        FROM signal_intraday_observations WHERE ${group};`), 't', 'Capture day uses UTC and source dates remain distinct.');
    query(writeSnapshot());
    query(writeSnapshot({ components: {
        ...baseline, vix: { ...withVix(29).vix, last_updated: '2026-11-20', retrieved_at: '2026-11-20T01:00:00Z' },
    } }));
    assert.equal(count(), 1, 'Retry and provenance-only updates do not append.');

    query(writeSnapshot({ components: withVix(31) }));
    assert.equal(count(), 2, 'Changed raw VIX is captured even when the rounded score is unchanged.');
    query(writeSnapshot({ components: { ...baseline, vix: { ...withVix(31).vix, weight: 0.85 } } }));
    assert.equal(count(), 3, 'Applied-weight change is captured.');
    query(writeSnapshot({ components: { ...baseline, vix: { ...withVix(31).vix, weight: 0.85 } }, model: { ...baselineModel, scoring_model_version: 'fixture-next' } }));
    assert.equal(count(), 4, 'Model-version change is captured.');
    query(writeSnapshot({ source: false }));
    query(writeSnapshot({ mode: 'contrarian' }));
    query(writeSnapshot({ market: 'MY' }));
    assert.equal(count(), 4, 'Source settings, mode, and market remain independent.');

    await raceWrites(writeSnapshot({ score: 52 }), writeSnapshot({ score: 52 }));
    assert.equal(count(), 5, 'Concurrent retries append one transition.');
    await raceWrites(writeSnapshot({ score: 53 }), writeSnapshot({ score: 54 }));
    assert.equal(count(), 7, 'Concurrent differing states both append in lock order.');
    assert.equal(query(`SELECT string_agg(composite_score::text, ',' ORDER BY id DESC)
        FROM (SELECT id, composite_score FROM signal_intraday_observations WHERE ${group} ORDER BY id DESC LIMIT 3) recent;`), '54,53,52');
    query(`BEGIN;\n${writeSnapshot({ score: 71 })}\nROLLBACK;`);
    assert.equal(count(), 7, 'A rollback removes the attempted observation.');
    assert.equal(query(`SELECT composite_score FROM signal_snapshots WHERE ${group} AND snapshot_date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date;`), '54',
        'A daily write and its capture commit or roll back together.');
    query(writeSnapshot({ score: 52 }));
    assert.equal(count(), 8, 'A return to an earlier value still represents a new transition.');
    query(provisioning);
    assert.equal(count(), 8, 'Reapplying migration preserves existing captures.');
    console.log('Market intraday PostgreSQL storage passed: UTC, fresh/upgrade, provenance, configuration isolation, duplicate/change races, rollback and reapplication.');
} catch (error) {
    const serverLog = await readFile(join(directory, 'postgres.log'), 'utf8').catch(() => '');
    if (serverLog) console.error(serverLog.split('\n').slice(-15).join('\n'));
    throw error;
} finally {
    if (startAttempted && await readFile(join(data, 'postmaster.pid'), 'utf8').catch(() => null)) {
        run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    }
    assert.equal(dirname(await realpath(directory)), temp, 'Only remove the isolated test directory.');
    await rm(directory, { recursive: true, force: true, maxRetries: 5 });
}
