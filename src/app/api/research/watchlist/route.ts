import { NextResponse } from 'next/server';
import { ResearchInputError } from '@/lib/research/input';
import { createStoredResearchRecord, listResearchState, ResearchConflictError } from '@/lib/research/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async () => {
    try {
        const state = await listResearchState();
        return NextResponse.json({ success: true, data: state.records, archivedSymbols: state.archivedSymbols });
    } catch (error) {
        console.error('[Research API GET]', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
};

export const POST = async (request: Request) => {
    try {
        const record = await createStoredResearchRecord(await request.json());
        return NextResponse.json({ success: true, data: record }, { status: 201 });
    } catch (error) {
        if (error instanceof ResearchInputError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        if (error instanceof ResearchConflictError) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
        console.error('[Research API POST]', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
};
