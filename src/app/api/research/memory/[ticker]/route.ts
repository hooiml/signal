import { NextResponse } from 'next/server';
import {
    listStoredResearchMemorySnapshots,
    saveStoredResearchMemorySnapshot,
} from '@/lib/research/research-memory-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (_request: Request, context: { params: Promise<{ ticker: string }> }) => {
    try {
        const { ticker } = await context.params;
        const snapshots = await listStoredResearchMemorySnapshots(ticker);
        return NextResponse.json({ success: true, data: snapshots });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};

export const POST = async (request: Request, context: { params: Promise<{ ticker: string }> }) => {
    try {
        const { ticker } = await context.params;
        const payload: unknown = await request.json();
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload) || (payload as Record<string, unknown>).ticker !== ticker.toUpperCase()) {
            return NextResponse.json({ success: false, error: 'Ticker does not match snapshot payload.' }, { status: 400 });
        }
        const snapshot = await saveStoredResearchMemorySnapshot(payload);
        return NextResponse.json({ success: true, data: snapshot }, { status: 201 });
    } catch (error) {
        console.error('[Research memory API]', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
};
