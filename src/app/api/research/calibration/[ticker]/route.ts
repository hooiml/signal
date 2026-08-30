import { NextResponse } from 'next/server';
import { listStoredDecisionCalibrations, saveStoredDecisionCalibration } from '@/lib/research/research-decision-calibration-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = async (_request: Request, context: { params: Promise<{ ticker: string }> }) => {
    try {
        const { ticker } = await context.params;
        return NextResponse.json({ success: true, data: await listStoredDecisionCalibrations(ticker) });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};

export const POST = async (request: Request, context: { params: Promise<{ ticker: string }> }) => {
    try {
        const { ticker } = await context.params;
        const payload = await request.json();
        const saved = await saveStoredDecisionCalibration({ ...payload, ticker });
        return NextResponse.json({ success: true, data: saved }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};
