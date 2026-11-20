import { ownerAccessIssue, ownerAccessMessage, type OwnerAccessIssue } from '@/lib/owner-access-client';
import type { ResearchCreateInput, ResearchRecord, ResearchUpdateMode } from '@/lib/types/research';
import { parseResearchRecord, ResearchInputError } from './input';

export class ResearchWriteAccessError extends ResearchInputError {
    constructor(readonly issue: OwnerAccessIssue) { super(ownerAccessMessage(issue)); }
}

async function readSavedRecord(response: Response, expected: Pick<ResearchRecord, 'symbol' | 'market'>) {
    const payload: unknown = await response.json().catch(() => null);
    const body = typeof payload === 'object' && payload !== null && !Array.isArray(payload) ? Object.fromEntries(Object.entries(payload)) : null;
    const issue = ownerAccessIssue(response.status, body?.code);
    if (issue) throw new ResearchWriteAccessError(issue);
    if (!body) throw new ResearchInputError('Invalid research API response.');
    if (!response.ok) throw new ResearchInputError(typeof body.error === 'string' ? body.error : 'Research request failed.');
    const saved = parseResearchRecord(body.data);
    if (saved.symbol !== expected.symbol.trim().toUpperCase() || saved.market !== expected.market) throw new ResearchInputError('Saved security did not match the request.');
    return saved;
}

export async function createOwnerResearchRecord(input: ResearchCreateInput) {
    return readSavedRecord(await fetch('/api/research/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
    }), input);
}

export async function updateOwnerResearchRecord(record: ResearchRecord, mode: ResearchUpdateMode, revision = record.revision) {
    return readSavedRecord(await fetch('/api/research/watchlist/' + encodeURIComponent(record.symbol), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...record, revision, mode }),
    }), record);
}
