import { NextResponse } from 'next/server';
import {
    deleteStoredResearchExpectationEvent,
    listStoredResearchExpectationEvents,
    saveStoredResearchExpectationEvent,
} from '@/lib/research/research-expectation-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ ticker: string }> };

export const GET = async (_request: Request, context: RouteContext) => {
    try {
        const { ticker } = await context.params;
        const events = await listStoredResearchExpectationEvents(ticker);
        return NextResponse.json({ success: true, data: events });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};

export const POST = async (request: Request, context: RouteContext) => {
    try {
        const { ticker } = await context.params;
        const payload = await request.json();
        const event = await saveStoredResearchExpectationEvent({ ...payload, ticker });
        return NextResponse.json({ success: true, data: event }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};

export const DELETE = async (request: Request, context: RouteContext) => {
    try {
        const { ticker } = await context.params;
        const url = new URL(request.url);
        const eventId = url.searchParams.get('eventId') ?? '';
        const deleted = await deleteStoredResearchExpectationEvent(ticker, eventId);
        return NextResponse.json({ success: true, deleted });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
    }
};
