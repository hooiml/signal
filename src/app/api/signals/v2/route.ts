
import { NextRequest, NextResponse } from 'next/server';
import { getSmartSignal } from '@/lib/signal';
import { MarketRegion, MarketMode } from '@/hooks/use-signal-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isMarketRegion = (value: string): value is MarketRegion => value === 'US' || value === 'MY';
const isMarketMode = (value: string): value is MarketMode => value === 'standard' || value === 'contrarian';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const marketParam = searchParams.get('market') || 'US';
    const modeParam = searchParams.get('mode') || 'standard';
    const enableSocial = searchParams.get('enableSocial') !== 'false'; // Default to true

    if (!isMarketRegion(marketParam)) {
        return NextResponse.json({ success: false, error: 'Invalid market. Use US or MY.' }, { status: 400 });
    }

    if (!isMarketMode(modeParam)) {
        return NextResponse.json({ success: false, error: 'Invalid mode. Use standard or contrarian.' }, { status: 400 });
    }

    try {
        const signal = await getSmartSignal(marketParam, modeParam, enableSocial);

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
