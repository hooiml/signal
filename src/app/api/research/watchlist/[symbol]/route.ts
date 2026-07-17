import { NextResponse } from 'next/server';
import { parseResearchExpectedRevision, parseResearchUpdateInput, parseResearchUpdateMode, ResearchInputError } from '@/lib/research/input';
import { deleteStoredResearchRecord, ResearchStaleWriteError, updateStoredResearchRecord } from '@/lib/research/store';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

const parseSymbol = (value: string) => {
    const symbol = value.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) throw new ResearchInputError('Invalid symbol.');
    return symbol;
};

export const PATCH = async (request: Request, context: RouteContext) => {
    try {
        const symbol = parseSymbol((await context.params).symbol);
        const payload: unknown = await request.json();
        const record = await updateStoredResearchRecord(symbol, parseResearchUpdateInput(payload), parseResearchUpdateMode(payload), parseResearchExpectedRevision(payload));
        if (!record) return NextResponse.json({ success: false, error: 'Research record not found.' }, { status: 404 });
        return NextResponse.json({ success: true, data: record });
    } catch (error) {
        if (error instanceof ResearchInputError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        if (error instanceof ResearchStaleWriteError) return NextResponse.json({ success: false, error: error.message }, { status: 409 });
        console.error('[Research API PATCH]', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
};

export const DELETE = async (_request: Request, context: RouteContext) => {
    try {
        const symbol = parseSymbol((await context.params).symbol);
        const deleted = await deleteStoredResearchRecord(symbol);
        if (!deleted) return NextResponse.json({ success: false, error: 'Research record not found.' }, { status: 404 });
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof ResearchInputError) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        console.error('[Research API DELETE]', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
};
