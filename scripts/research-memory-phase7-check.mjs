import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');
const [store, route, dock] = await Promise.all([
    read('src/lib/research/research-memory-store.ts'),
    read('src/app/api/research/memory/[ticker]/route.ts'),
    read('src/components/v7/ResearchMemoryDockV7.tsx'),
]);

assert.match(store, /CREATE TABLE IF NOT EXISTS research_memory_snapshots/, 'Phase 7 must create a durable checkpoint table');
assert.match(store, /PRIMARY KEY \(user_id, ticker, snapshot_id\)/, 'Checkpoint identity must be idempotent per user/ticker');
assert.match(store, /OFFSET \$\{MAX_SNAPSHOTS_PER_TICKER\}/, 'Server checkpoint retention must remain bounded');
assert.match(store, /appendResearchMemorySnapshot/, 'Persisted snapshots must pass through the existing memory validator');
assert.match(route, /listStoredResearchMemorySnapshots/, 'Memory API must expose server history');
assert.match(route, /saveStoredResearchMemorySnapshot/, 'Memory API must persist checkpoints');
assert.match(dock, /\/api\/research\/memory\//, 'V7 dock must use the server memory API');
assert.match(dock, /readResearchMemoryHistory/, 'V7 dock must keep local fallback resilience');
assert.match(dock, /historySource === 'server'/, 'V7 dock must disclose whether history is server-backed or local fallback');
assert.doesNotMatch(store, /research_memory_thesis_versions|research_memory_decisions|research_memory_evidence/, 'Phase 7 must not duplicate thesis, decision, or evidence data already authoritative in research_records');

console.log('research-memory phase 7 server persistence: ok');
