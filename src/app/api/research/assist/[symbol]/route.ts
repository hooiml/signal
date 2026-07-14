import { NextResponse } from 'next/server';
import { generateAssistedResearch } from '@/lib/research/assistant';
import { getResearchSnapshot } from '@/lib/research/snapshot';
import type { ResearchMarket } from '@/lib/types/research';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

export const POST = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { symbol: rawSymbol } = await context.params;
    const symbol = rawSymbol.trim().toUpperCase();
    const market = new URL(request.url).searchParams.get('market');
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) return NextResponse.json({ success: false, error: 'Invalid symbol.' }, { status: 400 });
    if (market !== 'US' && market !== 'MY') return NextResponse.json({ success: false, error: 'Invalid market. Use US or MY.' }, { status: 400 });
    try {
        const researchMarket: ResearchMarket = market;
        const snapshot = await getResearchSnapshot(symbol, researchMarket);
        return NextResponse.json({ success: true, data: await generateAssistedResearch(snapshot) });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Assisted research is unavailable.' }, { status: 502 });
    }
};
