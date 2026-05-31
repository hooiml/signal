import { NextResponse } from 'next/server';
import { requireBearerSecret } from '@/lib/route-auth';
import { fetchRawMarketData } from '@/lib/signal';

export const revalidate = 0;

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
        // Fetch raw data for both markets to compare
        const usData = await fetchRawMarketData('US');
        const myData = await fetchRawMarketData('MY');

        // Reconstruct the calculation step-by-step for the user to verify
        // Using CORRECTED formula: VIX center = 19.5 (historical median)

        // --- US CALCULATION ---
        const usVixScore = 100 / (1 + Math.exp((usData.vixData.price - 19.5) / 5)); // Corrected center
        const usSocialNormalized = (Math.max(-1, Math.min(1, usData.combinedSentiment)) + 1) * 50;

        // Gradient weighting
        const usVolPenalty = Math.max(0, (50 - usVixScore) / 50);
        const usVixWeight = Math.min(0.90, 0.65 + (0.25 * usVolPenalty));
        const usCalculatedScore = (usVixScore * usVixWeight) + (usSocialNormalized * (1 - usVixWeight));

        // --- MY CALCULATION ---
        const myVixScore = 100 / (1 + Math.exp((myData.vixData.price - 19.5) / 5)); // Same global VIX
        const myNewsNormalized = (Math.max(-1, Math.min(1, myData.combinedSentiment)) + 1) * 50;

        // Gradient weighting for MY (lower baseline)
        const myVolPenalty = Math.max(0, (50 - myVixScore) / 50);
        const myVixWeight = Math.min(0.90, 0.40 + (0.25 * myVolPenalty));
        const myCalculatedScore = (myVixScore * myVixWeight) + (myNewsNormalized * (1 - myVixWeight));

        return NextResponse.json({
            explanation: 'Comparing how the score is derived for US vs MY using current live data. VIX center corrected to 19.5 (historical median).',
            timestamp: new Date().toISOString(),
            US: {
                logic: 'Gradient VIX Weight (65%-90%), Social (10%-35%)',
                raw_inputs: {
                    vix_value: usData.vixData.price,
                    social_raw: `${usData.combinedSentiment.toFixed(3)} (Reddit/StockTwits)`,
                },
                normalized_scores: {
                    vix_score_0_100: Math.round(usVixScore),
                    social_score_0_100: Math.round(usSocialNormalized),
                },
                weights: {
                    vix_weight: `${(usVixWeight * 100).toFixed(0)}%`,
                    social_weight: `${((1 - usVixWeight) * 100).toFixed(0)}%`,
                    volatility_penalty: usVolPenalty.toFixed(2),
                },
                calculation: `(${Math.round(usVixScore)} * ${usVixWeight.toFixed(2)}) + (${Math.round(usSocialNormalized)} * ${(1 - usVixWeight).toFixed(2)})`,
                FINAL_SCORE: Math.round(usCalculatedScore),
                ACTUAL_SYSTEM_SCORE: usData.sentimentOutput.score,
            },
            MY: {
                logic: 'Lower VIX Weight (40%-65%), Higher News Weight (35%-60%)',
                raw_inputs: {
                    vix_value: `${myData.vixData.price} (Global Proxy)`,
                    news_raw: `${myData.combinedSentiment.toFixed(3)} (Headline Keywording)`,
                },
                normalized_scores: {
                    vix_score_0_100: Math.round(myVixScore),
                    news_score_0_100: Math.round(myNewsNormalized),
                },
                weights: {
                    vix_weight: `${(myVixWeight * 100).toFixed(0)}%`,
                    news_weight: `${((1 - myVixWeight) * 100).toFixed(0)}%`,
                    volatility_penalty: myVolPenalty.toFixed(2),
                },
                calculation: `(${Math.round(myVixScore)} * ${myVixWeight.toFixed(2)}) + (${Math.round(myNewsNormalized)} * ${(1 - myVixWeight).toFixed(2)})`,
                FINAL_SCORE: Math.round(myCalculatedScore),
                ACTUAL_SYSTEM_SCORE: myData.sentimentOutput.score,
            },
        }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to run debug calculation', details: error }, { status: 500 });
    }
}
