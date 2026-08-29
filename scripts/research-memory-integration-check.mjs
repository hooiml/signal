import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(path, 'utf8');

const [page, wrapper, dock, adapter] = await Promise.all([
    read('src/app/research/page.tsx'),
    read('src/components/v7/ResearchIntegratedPageV7.tsx'),
    read('src/components/v7/ResearchMemoryDockV7.tsx'),
    read('src/lib/research/research-memory-integration.ts'),
]);

assert.match(page, /ResearchIntegratedPageV7/, 'Research route must mount the integrated V7 page');
assert.match(wrapper, /ResearchDashboardV7/, 'Integrated page must preserve the existing Research dashboard');
assert.match(wrapper, /ResearchMemoryDockV7/, 'Integrated page must mount decision memory');
assert.match(dock, /data-testid="research-memory-dock"/, 'Decision-memory surface must remain test-addressable');
assert.match(dock, /data-testid=\"since-last-visit\"/, 'Decision memory must anchor to the existing Since last visit surface');
assert.match(dock, /createPortal/, 'Decision memory must render inside the Research utility flow rather than after the dashboard');
assert.match(dock, /research-memory-dock-slot/, 'Decision memory must expose a deterministic in-flow portal slot');
assert.match(dock, /\/api\/research\/watchlist/, 'Decision memory must reuse saved Research records');
assert.match(dock, /\/api\/research\/symbol\//, 'Decision memory must use the existing provider snapshot route');
assert.match(dock, /workspace=replay/, 'Decision memory must preserve a handoff to the existing Replay workspace');
assert.match(adapter, /signal-research-memory-history-v1/, 'Point-in-time history must use a versioned storage key');
assert.match(adapter, /slice\(-maxSnapshotsPerTicker\)/, 'Local point-in-time history must stay bounded');
assert.doesNotMatch(adapter, /forwardPe:\s*snapshot\.valuation\.priceEarnings/, 'Trailing provider P\/E must never be relabeled as forward P\/E');
assert.match(dock, /Forward EPS is not available/, 'Missing forward valuation evidence must be disclosed rather than inferred');

console.log('research-memory V7 integration: ok');
