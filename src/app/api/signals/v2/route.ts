
import { NextRequest, NextResponse } from 'next/server';
import { getSmartSignal } from '@/lib/signal';
import { createSignalCache } from '@/lib/signal-cache';
import { MarketRegion, MarketMode } from '@/hooks/use-signal-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isMarketRegion = (value: string): value is MarketRegion => value === 'US' || value === 'MY';
const isMarketMode = (value: string): value is MarketMode => value === 'standard' || value === 'contrarian';
const isBooleanParam = (value: string | null) => value === null || value === 'true' || value === 'false';
const signalCache = createSignalCache<Awaited<ReturnType<typeof getSmartSignal>>>(
    (signal) => signal.meta.status !== 'ERROR',
);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const marketParam = searchParams.get('market') || 'US';
    const modeParam = searchParams.get('mode') || 'standard';
    const enableSocialParam = searchParams.get('enableSocial');
    const refreshParam = searchParams.get('refresh');

    if (!isMarketRegion(marketParam)) {
        return NextResponse.json({ success: false, error: 'Invalid market. Use US or MY.' }, { status: 400 });
    }

    if (!isMarketMode(modeParam)) {
        return NextResponse.json({ success: false, error: 'Invalid mode. Use standard or contrarian.' }, { status: 400 });
    }

    if (!isBooleanParam(enableSocialParam)) {
        return NextResponse.json({ success: false, error: 'Invalid enableSocial. Use true or false.' }, { status: 400 });
    }

    if (!isBooleanParam(refreshParam)) {
        return NextResponse.json({ success: false, error: 'Invalid refresh. Use true or false.' }, { status: 400 });
    }

    const enableSocial = enableSocialParam !== 'false';
    const forceRefresh = refreshParam === 'true';

    try {
        const cachedSignal = await signalCache.get(
            { market: marketParam, mode: modeParam, enableSocial },
            () => getSmartSignal(marketParam, modeParam, enableSocial),
            { forceRefresh },
        );
        const signal = cachedSignal.value;

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
        }, {
            headers: {
                'X-Signal-Cache': cachedSignal.status,
            },
        });
    } catch (error) {
        console.error('[Signal V2 API Error]:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
