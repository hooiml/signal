import { NextResponse } from 'next/server';
import { fetchYahooQuote, toYahooSymbol } from '@/lib/research/yahoo-research';
import type { ResearchMarket } from '@/lib/types/research';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

export const revalidate = 900;

export const GET = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { symbol: rawSymbol } = await context.params;
    const symbol = rawSymbol.trim().toUpperCase();
    const market = new URL(request.url).searchParams.get('market');
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) return NextResponse.json({ success: false, error: 'Invalid symbol.' }, { status: 400 });
    if (market !== 'US' && market !== 'MY') return NextResponse.json({ success: false, error: 'Invalid market. Use US or MY.' }, { status: 400 });
    try {
        const researchMarket: ResearchMarket = market;
        return NextResponse.json({
            success: true,
            data: {
                symbol,
                market: researchMarket,
                providerSymbol: toYahooSymbol(symbol, researchMarket),
                fetchedAt: new Date().toISOString(),
                quote: await fetchYahooQuote(symbol, researchMarket),
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Live quote unavailable.' }, { status: 502 });
    }
};
