import { NextResponse } from 'next/server';
import { discoverRecentSecFilings } from '@/lib/research/sec-filings';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

export const GET = async (_request: Request, context: RouteContext) => {
    const symbol = (await context.params).symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) {
        return NextResponse.json({ success: false, error: 'Invalid US symbol.' }, { status: 400 });
    }
    try {
        const data = await discoverRecentSecFilings(symbol);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'SEC filing discovery is unavailable.';
        const configuration = detail.includes('SEC_USER_AGENT');
        if (!configuration) console.error('[Research SEC filings]', error);
        return NextResponse.json({
            success: false,
            degraded: true,
            reason: configuration ? 'configuration' : 'upstream',
            error: configuration
                ? 'Official SEC discovery is unavailable until the operator configures a compliant SEC contact.'
                : 'Official SEC discovery is temporarily unavailable. Manual primary-source capture remains available.',
        }, { status: 503 });
    }
};
