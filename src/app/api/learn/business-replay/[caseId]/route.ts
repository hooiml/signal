import { NextResponse } from 'next/server';
import { isBusinessReplayCommitmentV02 } from '@/lib/learn/v0-2';
import { getBusinessReplayIntroV02, isBusinessReplayCaseIdV02, revealBusinessReplayV02 } from '@/lib/learn/v0-2-replay';

type RouteContext = { readonly params: Promise<{ readonly caseId: string }> };

const errorResponse = (message: string, status: number) =>
    NextResponse.json({ success: false, error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export const GET = async (_request: Request, context: RouteContext): Promise<NextResponse> => {
    const { caseId } = await context.params;
    if (!isBusinessReplayCaseIdV02(caseId)) return errorResponse('Unknown business replay case.', 404);
    return NextResponse.json(
        { success: true, data: getBusinessReplayIntroV02(caseId) },
        { headers: { 'Cache-Control': 'private, no-store' } },
    );
};

export const POST = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { caseId } = await context.params;
    if (!isBusinessReplayCaseIdV02(caseId)) return errorResponse('Unknown business replay case.', 404);
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid reveal request.', 400);
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return errorResponse('Invalid reveal request.', 400);
    const payload = body as Record<string, unknown>;
    if (typeof payload.replayId !== 'string' || !isBusinessReplayCommitmentV02(payload.commitment)) {
        return errorResponse('A complete driver, contrary evidence, valuation implication, interpretation, and confidence are required before reveal.', 400);
    }
    const reveal = revealBusinessReplayV02(caseId, payload.replayId);
    if (!reveal) return errorResponse('This replay checkpoint is unavailable for reveal.', 400);
    return NextResponse.json({ success: true, data: reveal }, { headers: { 'Cache-Control': 'private, no-store' } });
};
