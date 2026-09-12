import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { researchReadFixture } from './research-read-fixture.mjs';

const fixture = researchReadFixture();
const runs = [];
for (let run = 0; run < 5; run++) {
    fixture.calls.length = 0;
    const start = performance.now();
    const response = await fixture.route.GET();
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data[0].symbol, 'AAPL');
    assert.equal(payload.data[0].revision, 7);
    assert.equal(payload.data[0].notes, 'Fixture saved note');
    assert.deepEqual(payload.archivedSymbols, ['ARCHIVED']);
    assert.equal(fixture.calls.length, 2);
    assert.equal(fixture.calls.filter(query => /^(CREATE|ALTER) /.test(query)).length, 0);
    assert.match(response.headers.get('server-timing'), /records;dur=.*archived;dur=.*mapping;dur=.*watchlist;dur=/);
    runs.push({ run: run + 1, elapsedMs: performance.now() - start, sql: [...fixture.calls], serverTiming: response.headers.get('server-timing'), payload });
}
{
    const originalRows = fixture.getRows();
    fixture.setRows([{ ...originalRows[0], symbol: 'MSFT', company_name: 'Fixture Microsoft', revision: 9 }, ...originalRows]);
    const ordered = await fixture.store.listResearchState();
    assert.deepEqual(ordered.records.map(record => [record.symbol, record.revision]), [['MSFT', 9], ['AAPL', 7]]);
    fixture.setRows([]); fixture.setArchived([]);
    assert.deepEqual(await fixture.store.listResearchState(), { records: [], archivedSymbols: [] });
    fixture.setRows(originalRows);
    for (const match of ['SELECT *', 'SELECT symbol']) {
        fixture.setFailure({ match, message: 'Required Research schema unavailable' });
        await assert.rejects(fixture.store.listResearchState(), /schema unavailable/);
        const originalError = console.error;
        let response;
        try { console.error = () => {}; response = await fixture.route.GET(); }
        finally { console.error = originalError; }
        assert.equal(response.status, 500);
        assert.equal((await response.json()).success, false);
    }
    fixture.setFailure(null);
    fixture.setRows([{ ...originalRows[0], symbol: '' }]);
    await assert.rejects(fixture.store.listResearchState());
}
const outputArg = process.argv.indexOf('--output');
if (outputArg >= 0) {
    const output = process.argv[outputArg + 1];
    await mkdir(output, { recursive: true });
    await writeFile(`${output}/after-store.json`, JSON.stringify({
        profile: 'isolated SQL fixture, zero network latency; timings are NOT production speed evidence', runs,
    }, null, 2));
}
console.log('Research read regression passed: 2 SELECTs / 0 DDL.');
