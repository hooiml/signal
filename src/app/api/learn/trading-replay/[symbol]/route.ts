import { NextResponse } from 'next/server';
import { getResearchSnapshot } from '@/lib/research/snapshot';
import {
    isTradingDecisionV04,
    selectTradingReplayCutoffV04,
    toTradingReplayPointV04,
    type TradingReplayIntroV04,
    type TradingReplayRevealV04,
} from '@/lib/learn/v0-4';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };
type RevealRequest = { readonly market?: unknown; readonly replayId?: unknown; readonly decision?: unknown };

export const runtime = 'nodejs';
export const maxDuration = 30;

const fail = (message: string, status = 422) => NextResponse.json({ success: false, error: message }, { status });

const parseRequest = (rawSymbol: string, rawMarket: string | null) => {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) return { valid: false as const, error: 'Invalid symbol.' };
    if (rawMarket !== 'US') return { valid: false as const, error: 'Trading Replay v0.4 currently supports US daily-price practice only.' };
    return { valid: true as const, symbol, market: 'US' as const };
};

const replayIdFor = (symbol: string, cutoffDate: string) => `${symbol}:${cutoffDate}`;

const buildIntro = async (symbol: string): Promise<{ intro: TradingReplayIntroV04; cutoffIndex: number; fullPoints: Awaited<ReturnType<typeof getResearchSnapshot>>['chart']['points'] } | { error: string }> => {
    const snapshot = await getResearchSnapshot(symbol, 'US');
    const fullPoints = snapshot.chart.points;
    const cutoffIndex = selectTradingReplayCutoffV04(fullPoints);
    if (cutoffIndex === null) return { error: `Signal cannot build a no-look-ahead trading replay for ${symbol} because the daily chart does not contain enough validated history.` };
    const current = fullPoints[cutoffIndex];
    if (!current) return { error: 'Trading Replay cutoff is unavailable.' };
    const start = Math.max(0, cutoffIndex - 39);
    const points = fullPoints.slice(start, cutoffIndex + 1).map(toTradingReplayPointV04);
    const intro: TradingReplayIntroV04 = {
        symbol,
        market: 'US',
        replayId: replayIdFor(symbol, current.time),
        cutoffDate: current.time,
        points,
        current: toTradingReplayPointV04(current),
        sources: snapshot.sources,
        fetchedAt: snapshot.fetchedAt,
        limitations: [
            'Daily historical price practice only; this is not an intraday execution simulator.',
            'Technical values at the cutoff are calculated from that bar and prior bars only.',
            'Spread, queue position, and actual fill quality are not available from this daily chart source.',
            'Subsequent bars describe one historical outcome and do not predict repetition.',
        ],
    };
    return { intro, cutoffIndex, fullPoints };
};

export const GET = async (request: Request, context: RouteContext) => {
    const { symbol: rawSymbol } = await context.params;
    const parsed = parseRequest(rawSymbol, new URL(request.url).searchParams.get('market'));
    if (!parsed.valid) return fail(parsed.error, 400);
    try {
        const built = await buildIntro(parsed.symbol);
        if ('error' in built) return fail(built.error);
        return NextResponse.json({ success: true, data: built.intro }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        return fail(error instanceof Error ? error.message : 'Trading Replay is unavailable.', 502);
    }
};

export const POST = async (request: Request, context: RouteContext) => {
    const { symbol: rawSymbol } = await context.params;
    let body: RevealRequest;
    try { body = await request.json() as RevealRequest; } catch { return fail('Invalid trading replay reveal request.', 400); }
    const parsed = parseRequest(rawSymbol, typeof body.market === 'string' ? body.market : null);
    if (!parsed.valid) return fail(parsed.error, 400);
    if (typeof body.replayId !== 'string' || !isTradingDecisionV04(body.decision)) {
        return fail('Commit either a complete trade plan or an explicit No Trade decision before revealing future bars.', 400);
    }
    try {
        const snapshot = await getResearchSnapshot(parsed.symbol, 'US');
        const prefix = `${parsed.symbol}:`;
        if (!body.replayId.startsWith(prefix)) return fail('Trading replay identifier does not match the requested symbol.', 400);
        const cutoffDate = body.replayId.slice(prefix.length);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDate)) return fail('Trading replay identifier is invalid.', 400);
        const cutoffIndex = snapshot.chart.points.findIndex((point) => point.time === cutoffDate);
        if (cutoffIndex < 0 || cutoffIndex >= snapshot.chart.points.length - 1) return fail('Trading replay cutoff is no longer available.', 400);
        const canonicalCutoff = selectTradingReplayCutoffV04(snapshot.chart.points);
        if (canonicalCutoff === null || snapshot.chart.points[canonicalCutoff]?.time !== cutoffDate) {
            return fail('Trading replay cutoff does not match the canonical no-look-ahead checkpoint.', 400);
        }
        const start = Math.max(0, cutoffIndex - 39);
        const visiblePoints = snapshot.chart.points.slice(start, cutoffIndex + 1).map(toTradingReplayPointV04);
        const current = snapshot.chart.points[cutoffIndex];
        if (!current) return fail('Trading Replay cutoff is unavailable.');
        const intro: TradingReplayIntroV04 = {
            symbol: parsed.symbol,
            market: 'US',
            replayId: body.replayId,
            cutoffDate,
            points: visiblePoints,
            current: toTradingReplayPointV04(current),
            sources: snapshot.sources,
            fetchedAt: snapshot.fetchedAt,
            limitations: [
                'Daily historical price practice only; this is not an intraday execution simulator.',
                'Technical values at the cutoff are calculated from that bar and prior bars only.',
                'Spread, queue position, and actual fill quality are not available from this daily chart source.',
                'Subsequent bars describe one historical outcome and do not predict repetition.',
            ],
        };
        const data: TradingReplayRevealV04 = {
            ...intro,
            decision: body.decision,
            nextPoints: snapshot.chart.points.slice(cutoffIndex + 1, cutoffIndex + 6).map(toTradingReplayPointV04),
        };
        return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        return fail(error instanceof Error ? error.message : 'Trading Replay reveal is unavailable.', 502);
    }
};
