import { NextResponse } from 'next/server';
import {
    fetchNasdaqDividendDiscovery,
    NasdaqDividendUnavailableError,
} from '@/lib/research/nasdaq-dividends';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

export const revalidate = 21_600;

export const GET = async (_request: Request, context: RouteContext): Promise<NextResponse> => {
    const symbol = (await context.params).symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) {
        return NextResponse.json({ success: false, error: 'Invalid US symbol.' }, { status: 400 });
    }
    try {
        return NextResponse.json({ success: true, data: await fetchNasdaqDividendDiscovery(symbol) });
    } catch (error) {
        const unavailable = error instanceof NasdaqDividendUnavailableError;
        if (!unavailable) console.error('[Research Nasdaq dividends]', error);
        return NextResponse.json({
            success: false,
            unavailable,
            error: unavailable
                ? 'No declared Nasdaq dividend metadata is available for this symbol.'
                : 'Official Nasdaq dividend metadata is temporarily unavailable.',
        }, { status: unavailable ? 404 : 502 });
    }
};
