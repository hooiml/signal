import { NextResponse } from 'next/server';
import { getMarketReplaySnapshot, listMarketReplaySnapshots } from '@/lib/market-replay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isIsoDate = (value: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const GET = async (request: Request): Promise<NextResponse> => {
    const url = new URL(request.url);
    const market = url.searchParams.get('market') ?? 'US';
    const mode = url.searchParams.get('mode') ?? 'standard';
    const social = url.searchParams.get('enableSocial') ?? 'true';
    const date = url.searchParams.get('date');
    if (market !== 'US' && market !== 'MY') return NextResponse.json({ success: false, error: 'Invalid market.' }, { status: 400 });
    if (mode !== 'standard' && mode !== 'contrarian') return NextResponse.json({ success: false, error: 'Invalid mode.' }, { status: 400 });
    if (social !== 'true' && social !== 'false') return NextResponse.json({ success: false, error: 'Invalid social setting.' }, { status: 400 });
    if (date !== null && !isIsoDate(date)) return NextResponse.json({ success: false, error: 'Invalid snapshot date.' }, { status: 400 });
    try {
        const enableSocial = social === 'true';
        if (date) {
            const snapshot = await getMarketReplaySnapshot(market, mode, enableSocial, date);
            return snapshot
                ? NextResponse.json({ success: true, data: snapshot })
                : NextResponse.json({ success: false, error: 'A full observed snapshot is unavailable for this date.' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: await listMarketReplaySnapshots(market, mode, enableSocial) });
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Historical replay is unavailable.' }, { status: 503 });
    }
};
