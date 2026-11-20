import { NextResponse } from 'next/server';
import { parseMarketReportDate } from '@/lib/market-observation-date';
import { DEFAULT_SIGNAL_CONFIG, isSignalConfig } from '@/lib/signal-config';
import { isSignalIntradayId, signalIntradayPageSize } from '@/lib/signal-intraday';
import { listSignalIntradayCaptures } from '@/lib/signal-intraday-reader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const error = (message: string, status: number) => response({ success: false, error: message }, status);

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = ['market', 'mode', 'enableSocial', 'day', 'before', 'limit'];
    if (query.some(key => searchParams.getAll(key).length > 1)) return error('Duplicate intraday query parameter.', 400);

    const social = searchParams.get('enableSocial') ?? String(DEFAULT_SIGNAL_CONFIG.enableSocial);
    const config = {
        market: searchParams.get('market') ?? DEFAULT_SIGNAL_CONFIG.market,
        mode: searchParams.get('mode') ?? DEFAULT_SIGNAL_CONFIG.mode,
        enableSocial: social === 'true',
    };
    if ((social !== 'true' && social !== 'false') || !isSignalConfig(config)) return error('Invalid market, mode or social setting.', 400);

    const limitParam = searchParams.get('limit');
    const limit = limitParam === null ? signalIntradayPageSize : Number(limitParam);
    if ((limitParam !== null && !/^[1-9]\d?$/.test(limitParam)) || limit > signalIntradayPageSize) {
        return error(`Limit must be an integer from 1 to ${signalIntradayPageSize}.`, 400);
    }

    const day = new Date().toISOString().slice(0, 10);
    const expectedDay = searchParams.get('day');
    const before = searchParams.get('before');
    if ((expectedDay !== null && !parseMarketReportDate(expectedDay)) || (before !== null && (!expectedDay || !isSignalIntradayId(before)))) {
        return error('Invalid intraday continuation.', 400);
    }
    if (expectedDay !== null && expectedDay !== day) return error('The UTC day changed. Reload Today to see new captures.', 409);

    try {
        return response({ success: true, data: await listSignalIntradayCaptures(config, day, limit, before) });
    } catch {
        return error('Intraday captures are temporarily unavailable.', 503);
    }
}
