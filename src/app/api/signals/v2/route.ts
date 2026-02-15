
import { NextRequest, NextResponse } from 'next/server';
import { getSmartSignal } from '@/lib/signal';
import { MarketRegion, MarketMode } from '@/hooks/use-signal-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const market = (searchParams.get('market') as MarketRegion) || 'US';
    const mode = (searchParams.get('mode') as MarketMode) || 'standard';
    const enableSocial = searchParams.get('enableSocial') !== 'false'; // Default to true

    try {
        const signal = await getSmartSignal(market, mode, enableSocial);

        // Handle engine-level errors returned by the orchestrator
        if (signal.meta.status === 'ERROR') {
            return NextResponse.json({
                success: false,
                error: signal.meta.error || 'Signal engine failure'
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            data: signal.v2
        });
    } catch (error) {
        console.error('[Signal V2 API Error]:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
