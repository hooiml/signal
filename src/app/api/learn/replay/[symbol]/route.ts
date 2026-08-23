import { NextResponse } from 'next/server';
import { getHistoricalValuationReport } from '@/lib/research/historical-valuation-service';
import { HistoricalValuationRequestError, parseHistoricalValuationRequest } from '@/lib/research/historical-valuation-request';
import {
    eligibleReplayObservationsV01,
    isReplayCommitmentV01,
    type LearnReplayIntroV01,
    type LearnReplayRevealV01,
} from '@/lib/learn/v0-1';

type RouteContext = { readonly params: Promise<{ readonly symbol: string }> };

type RevealRequest = {
    readonly market?: unknown;
    readonly replayId?: unknown;
    readonly commitment?: unknown;
};

export const runtime = 'nodejs';
export const maxDuration = 30;

const replayUnavailable = (message: string, status = 422) =>
    NextResponse.json({ success: false, error: message }, { status });

const loadReplay = async (rawSymbol: string, rawMarket: string | null) => {
    const { symbol, market } = parseHistoricalValuationRequest(rawSymbol, rawMarket);
    if (market !== 'US') {
        return {
            error: 'Historical Learn Replay is currently available only for US companies because Signal has no approved point-in-time Malaysia fundamentals source.',
        } as const;
    }

    const report = await getHistoricalValuationReport(symbol, market);
    const eligible = eligibleReplayObservationsV01(report.observations);
    if (eligible.length < 2) {
        return {
            error: `Signal cannot build a hindsight-safe P/E replay for ${symbol} from the currently approved point-in-time data.`,
        } as const;
    }

    return { symbol, market, report, eligible } as const;
};

const hasReplayError = (
    loaded: Awaited<ReturnType<typeof loadReplay>>,
): loaded is Extract<Awaited<ReturnType<typeof loadReplay>>, { readonly error: string }> =>
    'error' in loaded && typeof loaded.error === 'string';

const introFrom = (
    loaded: Exclude<Awaited<ReturnType<typeof loadReplay>>, { readonly error: string }>,
    replayIndex: number,
): LearnReplayIntroV01 => {
    const observation = loaded.eligible[replayIndex];
    return {
        symbol: loaded.symbol,
        companyName: loaded.report.companyName,
        replayId: observation.id,
        knownAsOf: observation.priceDate,
        observation,
        sourceLabels: loaded.report.sources.map((source) => source.name),
        warnings: loaded.report.warnings,
    };
};

export const GET = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { symbol: rawSymbol } = await context.params;
    try {
        const market = new URL(request.url).searchParams.get('market');
        const loaded = await loadReplay(rawSymbol, market);
        if (hasReplayError(loaded)) return replayUnavailable(loaded.error);

        // Use the newest observation that still has a later annual checkpoint. The response deliberately
        // contains no future observation, future price, later filing, or later metric.
        const replayIndex = loaded.eligible.length - 2;
        return NextResponse.json(
            { success: true, data: introFrom(loaded, replayIndex) },
            { headers: { 'Cache-Control': 'private, no-store' } },
        );
    } catch (error) {
        if (error instanceof HistoricalValuationRequestError) {
            return replayUnavailable(error.message, 400);
        }
        return replayUnavailable(error instanceof Error ? error.message : 'Learn Replay is unavailable.', 502);
    }
};

export const POST = async (request: Request, context: RouteContext): Promise<NextResponse> => {
    const { symbol: rawSymbol } = await context.params;
    try {
        let body: RevealRequest;
        try {
            body = await request.json() as RevealRequest;
        } catch {
            return replayUnavailable('Invalid reveal request.', 400);
        }

        const rawMarket = typeof body.market === 'string' ? body.market : null;
        if (typeof body.replayId !== 'string' || !isReplayCommitmentV01(body.commitment)) {
            return replayUnavailable('A complete view, confidence, supporting evidence, contrary evidence, and invalidation condition are required before reveal.', 400);
        }

        const loaded = await loadReplay(rawSymbol, rawMarket);
        if (hasReplayError(loaded)) return replayUnavailable(loaded.error);
        const replayIndex = loaded.eligible.findIndex((observation) => observation.id === body.replayId);
        if (replayIndex < 0 || replayIndex >= loaded.eligible.length - 1) {
            return replayUnavailable('This replay checkpoint is unavailable for reveal.', 400);
        }

        const intro = introFrom(loaded, replayIndex);
        const data: LearnReplayRevealV01 = {
            ...intro,
            nextObservation: loaded.eligible[replayIndex + 1],
        };
        return NextResponse.json(
            { success: true, data },
            { headers: { 'Cache-Control': 'private, no-store' } },
        );
    } catch (error) {
        if (error instanceof HistoricalValuationRequestError) {
            return replayUnavailable(error.message, 400);
        }
        return replayUnavailable(error instanceof Error ? error.message : 'Learn Replay is unavailable.', 502);
    }
};
