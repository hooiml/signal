import { NextResponse } from 'next/server';
import { isTradeConstructionV04 } from '@/lib/learn/v0-4';
import { advanceTradingReplayV04, getTradingReplayIntroV04, isTradingReplayCaseIdV04 } from '@/lib/learn/v0-4-replay';

type RouteContext = { readonly params: Promise<{ readonly caseId: string }> };
const errorResponse = (message: string, status: number) => NextResponse.json({ success: false, error: message }, { status, headers: { 'Cache-Control': 'private, no-store' } });

export const GET = async (_request: Request, context: RouteContext): Promise<NextResponse> => { const { caseId } = await context.params; if (!isTradingReplayCaseIdV04(caseId)) return errorResponse('Unknown trading replay case.', 404); return NextResponse.json({ success: true, data: getTradingReplayIntroV04(caseId) }, { headers: { 'Cache-Control': 'private, no-store' } }); };

export const POST = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { caseId } = await context.params; if (!isTradingReplayCaseIdV04(caseId)) return errorResponse('Unknown trading replay case.', 404); let body: unknown;
    try { body = await request.json(); } catch { return errorResponse('Invalid replay request.', 400); }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) return errorResponse('Invalid replay request.', 400); const payload = body as Record<string, unknown>;
    if (typeof payload.replayId !== 'string' || typeof payload.fromOpenTime !== 'string' || !isTradeConstructionV04(payload.commitment)) return errorResponse('A complete trade or No Trade commitment is required before advancing.', 400);
    const advance = advanceTradingReplayV04(caseId, payload.replayId, payload.fromOpenTime); if (!advance) return errorResponse('Replay checkpoint is unavailable or out of sequence.', 400);
    return NextResponse.json({ success: true, data: advance }, { headers: { 'Cache-Control': 'private, no-store' } });
};
