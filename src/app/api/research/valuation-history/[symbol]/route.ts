import { NextResponse } from 'next/server';
import { getHistoricalValuationReport } from '@/lib/research/historical-valuation-service';
import { HistoricalValuationRequestError, parseHistoricalValuationRequest } from '@/lib/research/historical-valuation-request';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

export const runtime = 'nodejs';
export const maxDuration = 30;

export const GET = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { symbol: rawSymbol } = await context.params;
    try {
        const { symbol, market } = parseHistoricalValuationRequest(rawSymbol, new URL(request.url).searchParams.get('market'));
        return NextResponse.json(
            { success: true, data: await getHistoricalValuationReport(symbol, market) },
            { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
        );
    } catch (error) {
        if (error instanceof HistoricalValuationRequestError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Historical valuation is unavailable.',
        }, { status: 502 });
    }
};
