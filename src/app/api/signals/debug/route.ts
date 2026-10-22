import { NextResponse } from 'next/server';
import { requireBearerSecret } from '@/lib/route-auth';
import { fetchRawMarketData } from '@/lib/signal';

export const revalidate = 0;

const describeMarket = (data: Awaited<ReturnType<typeof fetchRawMarketData>>, market: 'US' | 'MY') => ({
    status: 'OK',
    logic: data.fearGauge.isFxProxy
        ? 'USD/MYR volatility proxy with Malaysian news/social sentiment.'
        : market === 'MY' ? 'US VIX fallback with Malaysian news/social sentiment.' : 'US VIX with US social sentiment.',
    raw_inputs: {
        vix_value: data.vixData?.price ?? null,
        vix_available: data.vixData !== null,
        fear_gauge_value: data.fearGauge.value,
        fear_gauge_source: data.fearGauge.isFxProxy ? 'USD/MYR volatility proxy' : 'US VIX',
        fear_gauge_unit: data.fearGauge.isFxProxy ? 'scaled model points' : 'VIX points',
        fear_gauge_observed_at: data.fearGauge.observedAt?.toISOString() ?? null,
        sentiment_raw: data.combinedSentiment,
    },
    normalized_scores: {
        fear_gauge_score_0_100: data.sentimentOutput.components.vixScore,
        sentiment_score_0_100: data.sentimentOutput.components.socialScore,
    },
    weights: {
        fear_gauge_weight: data.sentimentOutput.components.vixWeight,
        sentiment_weight: data.sentimentOutput.components.socialWeight,
    },
    FINAL_SCORE: data.sentimentOutput.score,
    ACTUAL_SYSTEM_SCORE: data.sentimentOutput.score,
});

export async function GET(request: Request) {
    const authError = requireBearerSecret(
        request,
        process.env.CRON_SECRET,
        'CRON_SECRET is not configured'
    );
    if (authError) {
        return authError;
    }

    try {
        const [us, my] = await Promise.allSettled([
            fetchRawMarketData('US'),
            fetchRawMarketData('MY'),
        ]);
        const describeResult = (result: typeof us, market: 'US' | 'MY') => result.status === 'fulfilled'
            ? describeMarket(result.value, market)
            : { status: 'UNAVAILABLE', error: result.reason instanceof Error ? result.reason.message : 'Market inputs unavailable.' };

        return NextResponse.json({
            explanation: 'Current inputs and returned legacy sentiment-calculator outputs for each market. The V2 composite is calculated separately.',
            timestamp: new Date().toISOString(),
            US: describeResult(us, 'US'),
            MY: describeResult(my, 'MY'),
        }, { status: us.status === 'rejected' && my.status === 'rejected' ? 500 : 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to run debug calculation', details: error }, { status: 500 });
    }
}
