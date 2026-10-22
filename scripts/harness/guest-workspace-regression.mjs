import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';

const modules = new Map();
function load(file) {
    const absolute = path.resolve(file);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const compiled = { exports: {} };
    modules.set(absolute, compiled);
    const localRequire = id => {
        if (!id.startsWith('.') && !id.startsWith('@/')) return createRequire(absolute)(id);
        const resolved = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(absolute), id);
        const target = [resolved, `${resolved}.ts`, `${resolved}.tsx`].find(candidate => {
            try { return readFileSync(candidate) !== undefined; } catch { return false; }
        });
        if (!target) throw new Error(`Harness could not resolve ${id} from ${file}.`);
        return load(path.relative(process.cwd(), target));
    };
    const source = readFileSync(absolute, 'utf8');
    const code = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
        fileName: absolute,
    }).outputText;
    new Function('require', 'module', 'exports', code)(localRequire, compiled, compiled.exports);
    return compiled.exports;
}

const values = new Map();
let blockRead = false;
let blockWrite = false;
let writes = 0;
class QueuedLockManager {
    queue = [];
    active = false;

    request(name, options, callback) {
        assert.equal(name, 'signal.guest-research.v1');
        assert.equal(options.mode, 'exclusive');
        return new Promise((resolve, reject) => {
            this.queue.push({ name, callback, resolve, reject });
            this.pump();
        });
    }

    async pump() {
        if (this.active || this.queue.length === 0) return;
        this.active = true;
        const task = this.queue.shift();
        try {
            task.resolve(await task.callback({ name: task.name, mode: 'exclusive' }));
        } catch (error) {
            task.reject(error);
        } finally {
            this.active = false;
            queueMicrotask(() => this.pump());
        }
    }

    async hold(name) {
        let release;
        let acquired;
        const acquiredPromise = new Promise(resolve => { acquired = resolve; });
        const completed = this.request(name, { mode: 'exclusive' }, async () => {
            acquired();
            await new Promise(resolve => { release = resolve; });
        });
        await acquiredPromise;
        return { release, completed };
    }
}
const lockManager = new QueuedLockManager();
const localStorage = {
    getItem(key) {
        if (blockRead) throw new Error('blocked');
        return values.get(key) ?? null;
    },
    setItem(key, value) {
        if (blockWrite) throw new Error('quota');
        values.set(key, value);
        writes += 1;
    },
    removeItem(key) { values.delete(key); },
};
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: lockManager } });

const {
    clearGuestWorkspace,
    exportGuestWorkspace,
    readGuestRecords,
    removeGuestSecurity,
    saveGuestSecurity,
    updateGuestNote,
} = load('src/lib/research/guest-workspace.ts');
const storageKey = 'signal.guest-research.v1';

assert.deepEqual(readGuestRecords(), [], 'an absent workspace reads empty');
assert.equal(writes, 0, 'an absent read does not create storage');

const us = await saveGuestSecurity('aapl', 'US', 'Apple');
assert.equal(us.symbol, 'AAPL');
assert.equal(us.decisionJournal.decision, 'Not recorded', 'guest bookmarks use saveOnly defaults');
assert.equal(readGuestRecords().length, 1);
const guestId = JSON.parse(values.get(storageKey)).guestId;
assert.match(guestId, /^[0-9a-f-]{36}$/i, 'the first write creates a guest ID');
await saveGuestSecurity('AAPL', 'US', 'Apple Inc.');
assert.equal(JSON.parse(values.get(storageKey)).guestId, guestId, 'the guest ID stays stable');
const my = await saveGuestSecurity('AAPL', 'MY', 'Apple on Malaysia market');
assert.equal(readGuestRecords().length, 2, 'same ticker in two markets stays distinct');
assert.equal(readGuestRecords().find(record => record.market === 'MY').companyName, my.companyName);

const updated = await updateGuestNote('AAPL', 'US', '  Compare services growth.  ', '');
assert.equal(updated.notes, 'Compare services growth.');
await assert.rejects(updateGuestNote('AAPL', 'US', 'Overwrite stale draft', ''), error => error.name === 'GuestWorkspaceConflictError');
assert.equal(readGuestRecords().find(record => record.market === 'US').notes, 'Compare services growth.', 'conflict preserves newer text');
await assert.rejects(updateGuestNote('AAPL', 'US', 'x'.repeat(5_001), updated.notes), /5,000 characters/);

const exported = JSON.parse(exportGuestWorkspace());
assert.equal(exported.version, 1);
assert.deepEqual(Object.keys(exported.records[0]).sort(), ['companyName', 'market', 'notes', 'symbol']);
assert.equal(JSON.stringify(exported).includes('acceptedEvidence'), false, 'provider and owner data are not exported');
await removeGuestSecurity('AAPL', 'US');
assert.equal(readGuestRecords().length, 1);
await removeGuestSecurity('AAPL', 'MY');
assert.equal(readGuestRecords().length, 0, 'removing the last security retains an empty workspace');
assert.equal(JSON.parse(values.get(storageKey)).guestId, guestId, 'the guest ID survives removal of the final security');

for (let index = 0; index < 100; index += 1) await saveGuestSecurity(`T${index}`, 'US', `Ticker ${index}`);
assert.equal(readGuestRecords().length, 100);
await assert.rejects(saveGuestSecurity('OVER', 'US', 'Over limit'), /up to 100 securities/);
let payloadLimitReached = false;
for (let index = 0; index < 100 && !payloadLimitReached; index += 1) {
    const record = readGuestRecords().find(item => item.symbol === `T${index}`);
    try {
        await updateGuestNote(record.symbol, record.market, '\u0000'.repeat(5_000), record.notes);
    } catch (error) {
        assert.match(error.message, /1 MB browser-storage limit/);
        payloadLimitReached = true;
    }
}
assert.equal(payloadLimitReached, true, 'UTF-8 payload limit is enforced');

const malformed = '{ not valid json';
values.set(storageKey, malformed);
assert.throws(() => readGuestRecords(), /original browser data was left untouched/);
assert.equal(values.get(storageKey), malformed, 'invalid raw data remains available for recovery');
await assert.rejects(saveGuestSecurity('NEW', 'US', 'New Security'), /original browser data was left untouched/);
assert.equal(values.get(storageKey), malformed, 'mutations refuse malformed data without replacing it');
const unsupported = JSON.stringify({ version: 1, guestId, records: [{ symbol: 'AAPL', market: 'US', companyName: 'Apple', notes: '', providerData: { price: 1 } }] });
values.set(storageKey, unsupported);
assert.throws(() => readGuestRecords(), /unsupported data/);
assert.equal(values.get(storageKey), unsupported, 'unsupported provider data is preserved but never accepted');
const oversized = ' '.repeat(1_048_577);
values.set(storageKey, oversized);
assert.throws(() => readGuestRecords(), /1 MB storage limit/);
assert.equal(values.get(storageKey), oversized, 'oversized raw data is left untouched');

values.delete(storageKey);
blockRead = true;
assert.throws(() => readGuestRecords(), /storage settings/);
blockRead = false;
blockWrite = true;
await assert.rejects(saveGuestSecurity('FULL', 'US', 'Storage Full'), /blocked or full/);
blockWrite = false;
assert.equal(values.has(storageKey), false, 'failed storage writes leave workspace absent');

await saveGuestSecurity('CLEAR', 'US', 'Clear Test');
await clearGuestWorkspace();
assert.deepEqual(readGuestRecords(), []);

const [firstAdd, secondAdd] = await Promise.all([
    saveGuestSecurity('RACE1', 'US', 'Race One'),
    saveGuestSecurity('RACE2', 'US', 'Race Two'),
]);
assert.equal(firstAdd.symbol, 'RACE1');
assert.equal(secondAdd.symbol, 'RACE2');
assert.deepEqual(readGuestRecords().map(record => record.symbol).sort(), ['RACE1', 'RACE2'], 'queued concurrent adds do not overwrite each other');
await Promise.all([
    removeGuestSecurity('RACE1', 'US'),
    saveGuestSecurity('RACE3', 'US', 'Race Three'),
]);
assert.deepEqual(readGuestRecords().map(record => record.symbol).sort(), ['RACE2', 'RACE3'], 'queued add and remove preserve both operations');
await saveGuestSecurity('NOTE-RACE', 'US', 'Note Race');
const competingNotes = await Promise.allSettled([
    updateGuestNote('NOTE-RACE', 'US', 'First tab draft', ''),
    updateGuestNote('NOTE-RACE', 'US', 'Second tab draft', ''),
]);
assert.equal(competingNotes.filter(result => result.status === 'fulfilled').length, 1, 'only one simultaneous note edit with the same baseline can save');
assert.equal(competingNotes.filter(result => result.status === 'rejected' && result.reason.name === 'GuestWorkspaceConflictError').length, 1, 'the stale simultaneous note edit reports a conflict');

const held = await lockManager.hold(storageKey);
const queuedWrite = saveGuestSecurity('RESURRECT', 'US', 'Queued Before Clear');
const queuedClear = clearGuestWorkspace();
await Promise.resolve();
assert.equal(lockManager.queue.length, 2, 'both operations wait behind the held exclusive lock');
held.release();
await Promise.all([held.completed, queuedWrite, queuedClear]);
assert.deepEqual(readGuestRecords(), [], 'clear reads after earlier writes and cannot be undone by stale storage state');
assert.equal(values.has(storageKey), false, 'queued clear removes the entire workspace after the earlier write');

// Queued mutations cannot change a replacement workspace with identical records/baselines.
for (const action of ['note', 'remove', 'bookmark']) {
    await saveGuestSecurity('IDENTITY', 'US', 'Original');
    const identityLock = await lockManager.hold(storageKey);
    const operation = action === 'note' ? updateGuestNote('IDENTITY', 'US', 'Old guest draft', '')
        : action === 'remove' ? removeGuestSecurity('IDENTITY', 'US') : saveGuestSecurity('IDENTITY', 'US', 'Old guest name');
    const rejection = assert.rejects(operation, /workspace changed/);
    const replacement = JSON.stringify({ version: 1, guestId: crypto.randomUUID(), records: [{ symbol: 'IDENTITY', market: 'US', companyName: 'Replacement', notes: '' }] });
    values.set(storageKey, replacement);
    identityLock.release(); await identityLock.completed; await rejection;
    assert.equal(values.get(storageKey), replacement, `${action} must not modify the replacement guest`);
    await clearGuestWorkspace();
}

const beforeUnavailableLock = values.get(storageKey);
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
await assert.rejects(saveGuestSecurity('NOLOCK', 'US', 'No Lock'), /cannot safely save.*locks are unavailable/i);
assert.equal(values.get(storageKey), beforeUnavailableLock, 'missing Web Locks never falls back to an unlocked mutation');
assert.deepEqual(readGuestRecords(), [], 'reads remain available when Web Locks are unavailable');
console.log('guest workspace regression passed: schema bounds, storage errors, Web Locks serialization, conflicts, markets, removal and clear');
