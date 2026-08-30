import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { rankResearchAttentionItems } from '../src/lib/research/research-attention-rank.ts';

const base = { symbol: 'MSFT', urgency: 'action', detail: '', proximity: '', eventDate: null, structuredTriggerRuleId: null };
const ranked = rankResearchAttentionItems([
    { ...base, id: 'stale', kind: 'stale', title: 'Stale', source: 'Research journal' },
    { ...base, id: 'valuation', kind: 'valuation', title: 'Valuation', source: 'Valuation plan' },
    { ...base, id: 'risk', kind: 'risk', title: 'Risk', source: 'Yahoo Finance' },
    { ...base, id: 'decision', kind: 'decision', title: 'Decision', source: 'Decision review' },
    { ...base, id: 'expectation', kind: 'expectation', title: 'Expectation', source: 'Expectation journal' },
]);
assert.deepEqual(ranked.map((item) => item.id), ['risk', 'expectation', 'decision', 'valuation', 'stale']);

const [attention, route, types, parser, row, workflow] = await Promise.all([
    readFile('src/lib/research/research-attention.ts', 'utf8'),
    readFile('src/app/api/research/inbox/route.ts', 'utf8'),
    readFile('src/lib/types/research-inbox.ts', 'utf8'),
    readFile('src/lib/research/inbox-input.ts', 'utf8'),
    readFile('src/components/v6/ResearchInboxRowV6.tsx', 'utf8'),
    readFile('.github/workflows/research-memory-gate.yml', 'utf8'),
]);
assert.match(attention, /Complete expectation vs reality/);
assert.match(attention, /Complete valuation evidence input/);
assert.match(attention, /Review the prior decision process/);
assert.equal((attention.match(/listResearchState\(\)/g) ?? []).length, 1);
assert.match(route, /enrichResearchInboxWithAttention/);
assert.match(types, /'expectation' \| 'valuation' \| 'decision'/);
assert.match(parser, /Expectation journal/);
assert.match(row, /Decision review/);
assert.match(workflow, /research-memory-phase11-check\.mjs/);
assert.match(workflow, /research-attention-v11-qa\.mjs/);
console.log('research-memory phase11 attention engine: ok');
