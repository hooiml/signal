
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
    const started = performance.now();
    const timings: string[] = [];
    const onTiming = (stage: string, durationMs: number) => timings.push(`${stage};dur=${durationMs.toFixed(1)}`);
    const respond = (body: unknown, status = 200, cacheStatus?: string) => NextResponse.json(body, {
        status,
        headers: {
            'Server-Timing': [...timings, `signal;dur=${(performance.now() - started).toFixed(1)}`].join(', '),
            ...(cacheStatus ? { 'X-Signal-Cache': cacheStatus } : {}),
        },
    });
    const { searchParams } = new URL(req.url);
    const marketParam = searchParams.get('market') || 'US';
    const modeParam = searchParams.get('mode') || 'standard';
    const enableSocialParam = searchParams.get('enableSocial');
    const refreshParam = searchParams.get('refresh');

    if (!isMarketRegion(marketParam)) {
        return respond({ success: false, error: 'Invalid market. Use US or MY.' }, 400);
    }

    if (!isMarketMode(modeParam)) {
        return respond({ success: false, error: 'Invalid mode. Use standard or contrarian.' }, 400);
    }

    if (!isBooleanParam(enableSocialParam)) {
        return respond({ success: false, error: 'Invalid enableSocial. Use true or false.' }, 400);
    }

    if (!isBooleanParam(refreshParam)) {
        return respond({ success: false, error: 'Invalid refresh. Use true or false.' }, 400);
    }

    const enableSocial = enableSocialParam !== 'false';
    const forceRefresh = refreshParam === 'true';

    try {
        const cacheStarted = performance.now();
        const cachedSignal = await signalCache.get(
            { market: marketParam, mode: modeParam, enableSocial },
            () => getSmartSignal(marketParam, modeParam, enableSocial, onTiming),
            { forceRefresh },
        );
        onTiming('signal_cache', performance.now() - cacheStarted);
        const signal = cachedSignal.value;

        // Handle engine-level errors returned by the orchestrator
        if (signal.meta.status === 'ERROR') {
            return respond({
                success: false,
                error: signal.meta.error || 'Signal engine failure'
            }, 500);
        }

        return respond({
            success: true,
            data: signal.v2
        }, 200, cachedSignal.status);
    } catch (error) {
        console.error('[Signal V2 API Error]:', error);
        return respond({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
}
