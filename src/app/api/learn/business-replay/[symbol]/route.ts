import { NextResponse } from 'next/server';
import { getHistoricalValuationReport } from '@/lib/research/historical-valuation-service';
import { HistoricalValuationRequestError, parseHistoricalValuationRequest } from '@/lib/research/historical-valuation-request';
import { eligibleBusinessReplayObservationsV02 } from '@/lib/learn/v0-2';
import { isReplayCommitmentV01 } from '@/lib/learn/v0-1';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };
type RevealRequest = { readonly market?: unknown; readonly replayId?: unknown; readonly commitment?: unknown };

export const runtime = 'nodejs';
export const maxDuration = 30;

const unavailable = (message: string, status = 422) => NextResponse.json({ success: false, error: message }, { status });

const load = async (rawSymbol: string, rawMarket: string | null) => {
    const parsed = parseHistoricalValuationRequest(rawSymbol, rawMarket);
    if (parsed.market !== 'US') return { available: false as const, error: 'Business Replay is currently limited to US companies because Signal has no approved point-in-time Malaysia fundamentals source.' };
    const report = await getHistoricalValuationReport(parsed.symbol, parsed.market);
    const observations = eligibleBusinessReplayObservationsV02(report.observations);
    if (observations.length < 2) return { available: false as const, error: `Signal cannot build a safe business replay for ${parsed.symbol} from the approved filing-aligned dataset.` };
    return { available: true as const, symbol: parsed.symbol, report, observations };
};

export const GET = async (request: Request, context: RouteContext) => {
    const { symbol } = await context.params;
    try {
        const loaded = await load(symbol, new URL(request.url).searchParams.get('market'));
        if (!loaded.available) return unavailable(loaded.error);
        const index = loaded.observations.length - 2;
        const observation = loaded.observations[index];
        return NextResponse.json({ success: true, data: { symbol: loaded.symbol, companyName: loaded.report.companyName, replayId: observation.id, knownAsOf: observation.priceDate, observation, sources: loaded.report.sources.map((source) => source.name), warnings: loaded.report.warnings } }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        if (error instanceof HistoricalValuationRequestError) return unavailable(error.message, 400);
        return unavailable(error instanceof Error ? error.message : 'Business Replay is unavailable.', 502);
    }
};

export const POST = async (request: Request, context: RouteContext) => {
    const { symbol } = await context.params;
    try {
        let body: RevealRequest;
        try { body = await request.json() as RevealRequest; } catch { return unavailable('Invalid reveal request.', 400); }
        if (typeof body.replayId !== 'string' || !isReplayCommitmentV01(body.commitment)) return unavailable('Commit a complete view, evidence, risk, invalidation condition, and confidence before revealing the next filing.', 400);
        const loaded = await load(symbol, typeof body.market === 'string' ? body.market : null);
        if (!loaded.available) return unavailable(loaded.error);
        const index = loaded.observations.findIndex((observation) => observation.id === body.replayId);
        if (index < 0 || index >= loaded.observations.length - 1) return unavailable('This business replay checkpoint cannot be revealed.', 400);
        const observation = loaded.observations[index];
        return NextResponse.json({ success: true, data: { symbol: loaded.symbol, companyName: loaded.report.companyName, replayId: observation.id, knownAsOf: observation.priceDate, observation, nextObservation: loaded.observations[index + 1], sources: loaded.report.sources.map((source) => source.name), warnings: loaded.report.warnings } }, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (error) {
        if (error instanceof HistoricalValuationRequestError) return unavailable(error.message, 400);
        return unavailable(error instanceof Error ? error.message : 'Business Replay is unavailable.', 502);
    }
};
