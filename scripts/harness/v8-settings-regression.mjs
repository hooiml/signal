import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = { exports: {} };
const source = readFileSync('src/lib/signal-config.ts', 'utf8');
new Function('module', 'exports', ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(compiled, compiled.exports);
const { readSignalConfig, writeSignalConfig, DEFAULT_SIGNAL_CONFIG, SIGNAL_CONFIG_KEY } = compiled.exports;
const values = new Map();
let writes = 0;
let blockRead = false;
let blockWrite = false;
globalThis.window = { localStorage: {
    getItem: key => { if (blockRead) throw new Error('blocked'); return values.get(key) ?? null; },
    setItem: (key, value) => { if (blockWrite) throw new Error('quota'); writes++; values.set(key, value); },
} };
assert.deepEqual(readSignalConfig(), { config: DEFAULT_SIGNAL_CONFIG, error: '' });
assert.equal(writes, 0);
for (const raw of ['', '{bad', 'null', '[]', '{"market":"GB","mode":"standard","enableSocial":true}', '{"market":"MY","mode":"contrarian","enableSocial":"false"}', '{"market":"MY","mode":"contrarian","enableSocial":false,"extra":1}']) {
    values.set(SIGNAL_CONFIG_KEY, raw);
    assert.ok(readSignalConfig().error);
    assert.equal(values.get(SIGNAL_CONFIG_KEY), raw, 'invalid storage survives reading');
}
blockRead = true;
assert.deepEqual(readSignalConfig().config, DEFAULT_SIGNAL_CONFIG);
assert.match(readSignalConfig().error, /Could not read/);
blockRead = false;
assert.equal(writes, 0, 'reads never persist a fallback');
const saved = { mode: 'contrarian', market: 'MY', enableSocial: false };
writeSignalConfig(saved);
assert.equal(values.get(SIGNAL_CONFIG_KEY), JSON.stringify(saved), 'legacy key and shape stay exact');
assert.deepEqual(readSignalConfig(), { config: saved, error: '' });
blockWrite = true;
assert.throws(() => writeSignalConfig(DEFAULT_SIGNAL_CONFIG), /Could not save/);
assert.deepEqual(readSignalConfig().config, saved, 'failed save preserves prior defaults');
blockWrite = false;
assert.throws(() => writeSignalConfig({ ...saved, market: 'GB' }), /valid market/);
assert.equal(writes, 1);
console.log('V8 settings regression passed: validated explicit writes, legacy format, corrupt and blocked storage preservation');
