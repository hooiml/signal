import { NextResponse } from 'next/server';
import { researchBackupLimits } from '@/lib/research/backup';
import { getResearchSyncVault, writeResearchSyncVault } from '@/lib/research/sync-store';
import {
    authorizeResearchSyncBearer,
    parseResearchSyncWriteRequest,
    ResearchSyncError,
} from '@/lib/research/sync-vault';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const authorized = (request: Request): void => {
    authorizeResearchSyncBearer(request.headers.get('authorization'), process.env.RESEARCH_SYNC_BEARER_SECRET);
};

const response = (data: unknown, status = 200): NextResponse => NextResponse.json(
    { success: status < 400, ...(status < 400 ? { data } : { error: data }) },
    { status, headers: { 'Cache-Control': 'no-store' } },
);

export const GET = async (request: Request): Promise<NextResponse> => {
    try {
        authorized(request);
        return response(await getResearchSyncVault());
    } catch (error) {
        if (error instanceof ResearchSyncError) return response(error.message, error.status);
        return response('Private sync is unavailable.', 503);
    }
};

export const PUT = async (request: Request): Promise<NextResponse> => {
    try {
        authorized(request);
        const contentLength = Number(request.headers.get('content-length') ?? 0);
        if (Number.isFinite(contentLength) && contentLength > researchBackupLimits.maxFileBytes + 1_000) {
            return response('Private sync request is too large.', 413);
        }
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > researchBackupLimits.maxFileBytes + 1_000) {
            return response('Private sync request is too large.', 413);
        }
        const input = parseResearchSyncWriteRequest(JSON.parse(rawBody));
        const saved = await writeResearchSyncVault(input.envelope, input.expectedRevision);
        if (!saved) return response('The remote sync vault changed. Check it again before replacing the ciphertext.', 409);
        return response(saved);
    } catch (error) {
        if (error instanceof ResearchSyncError) return response(error.message, error.status);
        if (error instanceof SyntaxError) return response('Private sync request must be valid JSON.', 400);
        return response('Private sync is unavailable.', 503);
    }
};
