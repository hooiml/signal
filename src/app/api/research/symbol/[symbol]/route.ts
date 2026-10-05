import { NextResponse } from 'next/server';
import { getResearchSnapshot } from '@/lib/research/snapshot';
import type { ResearchMarket } from '@/lib/types/research';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

export const revalidate = 900;

export const GET = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { symbol: rawSymbol } = await context.params;
    const symbol = rawSymbol.trim().toUpperCase();
    const market = new URL(request.url).searchParams.get('market');
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) return NextResponse.json({ success: false, error: 'Invalid symbol.' }, { status: 400 });
    if (market !== 'US' && market !== 'MY') return NextResponse.json({ success: false, error: 'Invalid market. Use US or MY.' }, { status: 400 });
    const started = performance.now();
    const timings: string[] = [];
    const headers = () => ({ 'Server-Timing': [...timings, `research;dur=${(performance.now() - started).toFixed(1)}`].join(', ') });
    try {
        const researchMarket: ResearchMarket = market;
        const data = await getResearchSnapshot(symbol, researchMarket, (stage, duration) => timings.push(`${stage};dur=${duration.toFixed(1)}`));
        return NextResponse.json({ success: true, data }, { headers: headers() });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Free data sources unavailable.' }, { status: 502, headers: headers() });
    }
};
