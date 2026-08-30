import { NextResponse } from 'next/server';
import { getStoredResearchValuationPlan, saveStoredResearchValuationPlan } from '@/lib/research/research-valuation-plan-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ ticker: string }> };

export const GET = async (_request: Request, context: RouteContext) => {
    try {
        const { ticker } = await context.params;
        const plan = await getStoredResearchValuationPlan(ticker);
        return NextResponse.json({ success: true, data: plan });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};

export const POST = async (request: Request, context: RouteContext) => {
    try {
        const { ticker } = await context.params;
        const payload = await request.json();
        const plan = await saveStoredResearchValuationPlan({ ...payload, ticker, updatedAt: new Date().toISOString() });
        return NextResponse.json({ success: true, data: plan });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};
