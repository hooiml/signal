import { NextResponse } from 'next/server';
import { isInvestmentReplayCommitmentV03 } from '@/lib/learn/v0-3';
import { getInvestmentReplayIntroV03, isInvestmentReplayCaseIdV03, revealInvestmentReplayV03 } from '@/lib/learn/v0-3-replay';

type RouteContext = { readonly params: Promise<{ readonly caseId: string }> };

const errorResponse = (message: string, status: number) =>
    NextResponse.json({ success: false, error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export const GET = async (_request: Request, context: RouteContext): Promise<NextResponse> => {
    const { caseId } = await context.params;
    if (!isInvestmentReplayCaseIdV03(caseId)) return errorResponse('Unknown investment replay case.', 404);
    return NextResponse.json({ success: true, data: getInvestmentReplayIntroV03(caseId) }, { headers: { 'Cache-Control': 'private, no-store' } });
};

export const POST = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { caseId } = await context.params;
    if (!isInvestmentReplayCaseIdV03(caseId)) return errorResponse('Unknown investment replay case.', 404);
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid reveal request.', 400);
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return errorResponse('Invalid reveal request.', 400);
    const payload = body as Record<string, unknown>;
    if (typeof payload.replayId !== 'string' || !isInvestmentReplayCommitmentV03(payload.commitment)) {
        return errorResponse('A thesis, scenario, supporting evidence, contrary evidence, invalidation, and bounded confidence are required before reveal.', 400);
    }
    const reveal = revealInvestmentReplayV03(caseId, payload.replayId);
    if (!reveal) return errorResponse('This replay checkpoint is unavailable for reveal.', 400);
    return NextResponse.json({ success: true, data: reveal }, { headers: { 'Cache-Control': 'private, no-store' } });
};
