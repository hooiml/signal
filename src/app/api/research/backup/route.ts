import { NextResponse } from 'next/server';
import { parseResearchRestoreRequest, ResearchBackupError, researchBackupLimits } from '@/lib/research/backup';
import { restoreStoredResearchRecords } from '@/lib/research/store';

export async function POST(request: Request) {
    try {
        const contentLength = Number(request.headers.get('content-length') ?? 0);
        if (Number.isFinite(contentLength) && contentLength > researchBackupLimits.maxFileBytes) {
            return NextResponse.json({ success: false, error: 'Restore request is too large.' }, { status: 413 });
        }
        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).byteLength > researchBackupLimits.maxFileBytes) {
            return NextResponse.json({ success: false, error: 'Restore request is too large.' }, { status: 413 });
        }
        const { records, conflictPolicy } = parseResearchRestoreRequest(JSON.parse(rawBody));
        const result = await restoreStoredResearchRecords(records, conflictPolicy);
        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        if (error instanceof ResearchBackupError || error instanceof SyntaxError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        console.error('Research backup restore error:', error);
        return NextResponse.json({ success: false, error: 'Unable to restore research backup.' }, { status: 500 });
    }
}
