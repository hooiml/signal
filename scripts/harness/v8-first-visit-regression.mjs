import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = { exports: {} };
new Function('module', 'exports', ts.transpileModule(readFileSync('src/lib/v8-first-visit.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(compiled, compiled.exports);
const { FIRST_VISIT_KEY: key, FIRST_VISIT_EVENT, parseFirstVisit, readFirstVisit, advanceFirstVisit, restartFirstVisit, subscribeFirstVisit } = compiled.exports;
const values = new Map();
const events = new EventTarget();
let writes = 0;
let denyRead = false;
let denyWrite = false;
let queue = Promise.resolve();
globalThis.window = {
    localStorage: {
        getItem: name => { if (denyRead) throw Error('blocked'); return values.get(name) ?? null; },
        setItem: (name, value) => { if (denyWrite) throw Error('quota'); writes++; values.set(name, value); },
    },
    addEventListener: (...args) => events.addEventListener(...args),
    removeEventListener: (...args) => events.removeEventListener(...args),
    dispatchEvent: event => events.dispatchEvent(event),
};
const locks = { request: (name, options, operation) => {
    assert.equal(name, key); assert.equal(options.mode, 'exclusive');
    const result = queue.then(operation); queue = result.catch(() => {}); return result;
} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks } });
const current = () => readFirstVisit().state;
const seed = (stage, revision) => values.set(key, JSON.stringify({ version: 1, stage, revision }));
assert.equal(readFirstVisit().status, 'missing');
assert.equal(writes, 0);
for (const input of [null, [], {}, { version: 2, stage: 'market', revision: 0 }, { version: 1, stage: 'unknown', revision: 0 }, { version: 1, stage: 'save', revision: -1 }, { version: 1, stage: 'save', revision: 1.5 }, { version: 1, stage: 'save', revision: Infinity }, { version: 1, stage: 'save', revision: 0, ticker: 'PRIVATE' }]) assert.throws(() => parseFirstVisit(input));
for (const raw of ['', '{bad', 'null', '[]', '{"version":9,"stage":"market","revision":0}']) {
    values.set(key, raw); assert.equal(readFirstVisit().status, 'invalid');
    await assert.rejects(advanceFirstVisit({ version: 1, stage: 'market', revision: 0 }, 'stock'), /could not be read/);
    assert.equal(values.get(key), raw);
}
assert.equal(writes, 0, 'invalid reads/transitions never overwrite bytes');
await restartFirstVisit();
assert.equal(current().stage, 'market'); assert.ok(current().revision >= 2 ** 40);
let notifications = 0;
const unsubscribe = subscribeFirstVisit(() => notifications++);
await advanceFirstVisit(current(), 'stock'); assert.equal(notifications, 1);
const storageEvent = new Event('storage'); Object.defineProperty(storageEvent, 'key', { value: key });
events.dispatchEvent(storageEvent); assert.equal(notifications, 2);
const clearEvent = new Event('storage'); Object.defineProperty(clearEvent, 'key', { value: null });
events.dispatchEvent(clearEvent); assert.equal(notifications, 3);
const otherEvent = new Event('storage'); Object.defineProperty(otherEvent, 'key', { value: 'unrelated' });
events.dispatchEvent(otherEvent); assert.equal(notifications, 3);
unsubscribe(); events.dispatchEvent(new Event(FIRST_VISIT_EVENT)); assert.equal(notifications, 3);

const stock = current();
assert.equal(await advanceFirstVisit(stock, 'save'), true);
assert.equal(await advanceFirstVisit(stock, 'save'), false, 'duplicate/stale observation cannot advance');
const save = current();
await restartFirstVisit(); await advanceFirstVisit(current(), 'stock'); await advanceFirstVisit(current(), 'save');
assert.equal(await advanceFirstVisit(save, 'complete'), false, 'old Save cannot complete restarted tour at the same stage');
const freshSave = current();
await Promise.all([advanceFirstVisit(freshSave, 'skipped'), advanceFirstVisit(freshSave, 'complete')]);
assert.equal(current().stage, 'skipped', 'skip wins over queued stale completion');
await assert.rejects(advanceFirstVisit(current(), 'stock'), /Invalid tour transition/);
await restartFirstVisit();
await Promise.all([advanceFirstVisit(current(), 'stock'), advanceFirstVisit(current(), 'stock')]);
assert.equal(current().stage, 'stock', 'concurrent duplicate writes apply once');

seed('save', 100); const beforeClear = current();
values.delete(key);
await advanceFirstVisit(current(), 'stock'); await advanceFirstVisit(current(), 'save');
assert.equal(await advanceFirstVisit(beforeClear, 'complete'), false, 'cleared storage creates a distinct tour lifetime');
const rawBefore = values.get(key); const writesBefore = writes;
denyWrite = true;
await assert.rejects(advanceFirstVisit(current(), 'complete'), /Tour progress was not saved/);
assert.equal(values.get(key), rawBefore); assert.equal(writes, writesBefore);
denyWrite = false; denyRead = true;
assert.equal(readFirstVisit().status, 'unavailable'); await assert.rejects(restartFirstVisit(), /could not be read/);
assert.equal(values.get(key), rawBefore); denyRead = false;
navigator.locks = undefined;
await assert.rejects(restartFirstVisit(), /cannot safely coordinate/);
assert.equal(values.get(key), rawBefore); navigator.locks = locks;
seed('market', Number.MAX_SAFE_INTEGER);
await assert.rejects(advanceFirstVisit(current(), 'stock'), /revision limit/);
await assert.rejects(restartFirstVisit(), /revision limit/);
assert.equal(current().revision, Number.MAX_SAFE_INTEGER);
assert.deepEqual([...values.keys()], [key], 'tour touches only its own key');
console.log('V8 first-visit regression passed: strict privacy schema, guarded persistence, subscription cleanup, serialized transitions, restart/clear ABA and failure preservation.');
