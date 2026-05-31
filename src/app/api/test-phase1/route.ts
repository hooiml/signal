
import { NextResponse } from 'next/server';
import { requireAnyBearerSecret } from '@/lib/route-auth';
import { calculateCompositeScoreV2 } from '@/lib/sentiment-calculator-v2';
import { IndicatorData } from '@/lib/types/signal-v2';

export async function GET(request: Request) {
    const authError = requireAnyBearerSecret(
        request,
        [process.env.CRON_SECRET, process.env.ADMIN_SECRET],
        'CRON_SECRET or ADMIN_SECRET must be configured'
    );
    if (authError) {
        return authError;
    }

    // --- Scenario A: Normal US Market ---
    // Standard condition: VIX=18 (Fear/Neutral), Social=60 (Neutral/Greed)
    const scenarioA_Indicators: IndicatorData[] = [
        {
            name: 'vix', display_name: 'VIX Index', value: 18, score: 50, weight: 0, signal: 'neutral', enabled: true, last_updated: new Date().toISOString(),
        },
        {
            name: 'social', display_name: 'Social Sentiment', value: 0.2, score: 60, weight: 0, signal: 'neutral', enabled: true, last_updated: new Date().toISOString(),
        },
    ];

    const resultA = calculateCompositeScoreV2(scenarioA_Indicators, { market: 'US', mode: 'standard' });

    // --- Scenario B: VIX Only (Social Failed) ---
    // Condition: Social is missing/disabled. VIX should take 100% weight.
    const scenarioB_Indicators: IndicatorData[] = [
        {
            name: 'vix', display_name: 'VIX Index', value: 22, score: 40, weight: 0, signal: 'buy', enabled: true, last_updated: new Date().toISOString(),
        },
    ];

    const resultB = calculateCompositeScoreV2(scenarioB_Indicators, { market: 'US', mode: 'standard' });

    // --- Scenario C: High Volatility Override ---
    // Condition: VIX=35 (Panic). Should trigger dynamic override (VIX weight > 80%).
    const scenarioC_Indicators: IndicatorData[] = [
        {
            name: 'vix', display_name: 'VIX Index', value: 35, score: 10, weight: 0, signal: 'buy', enabled: true, last_updated: new Date().toISOString(),
        },
        {
            name: 'social', display_name: 'Social Sentiment', value: -0.5, score: 20, weight: 0, signal: 'buy', enabled: true, last_updated: new Date().toISOString(),
        },
    ];

    const resultC = calculateCompositeScoreV2(scenarioC_Indicators, { market: 'US', mode: 'standard' });

    // --- Scenario D: MY Market Mode ---
    // Condition: MY market. VIX(USDMYR)=Low, News=High, Social=Mid.
    const scenarioD_Indicators: IndicatorData[] = [
        {
            name: 'vix', display_name: 'USD/MYR Volatility', value: 4.1, score: 60, weight: 0, signal: 'neutral', enabled: true, last_updated: new Date().toISOString(),
        },
        {
            name: 'social', display_name: 'BursaBets', value: 0.1, score: 55, weight: 0, signal: 'neutral', enabled: true, last_updated: new Date().toISOString(),
        },
        {
            name: 'news', display_name: 'News Sentiment', value: 0.6, score: 80, weight: 0, signal: 'sell', enabled: true, last_updated: new Date().toISOString(),
        },
    ];

    const resultD = calculateCompositeScoreV2(scenarioD_Indicators, { market: 'MY', mode: 'standard' });

    // --- Scenario E: Full DSS Mode (US) ---
    // Condition: VIX, Social, and AAII are all active.
    const scenarioE_Indicators: IndicatorData[] = [
        {
            name: 'vix', display_name: 'VIX Index', value: 18, score: 50, weight: 0, signal: 'neutral', enabled: true, last_updated: new Date().toISOString(),
        },
        {
            name: 'social', display_name: 'Social Sentiment', value: 0.2, score: 60, weight: 0, signal: 'neutral', enabled: true, last_updated: new Date().toISOString(),
        },
        {
            name: 'aaii', display_name: 'AAII Sentiment', value: 45, score: 80, weight: 0, signal: 'sell', enabled: true, last_updated: new Date().toISOString(),
        },
    ];

    const resultE = calculateCompositeScoreV2(scenarioE_Indicators, { market: 'US', mode: 'standard' });

    return NextResponse.json({
        ok: true,
        phase: '2 - Institutional Integration',
        timestamp: new Date().toISOString(),
        tests: {
            scenario_A_NormalUS: {
                desc: 'Standard US Market (VIX+Social)',
                input: { vix: 18, socialScore: 60 },
                output: {
                    score: resultA.composite_score,
                    tier: resultA.tier,
                    weights: resultA.metadata.weight_distribution,
                },
                // VIX weight should be scaled up from 0.40 since inst indicators are missing
                pass: resultA.metadata.weight_distribution.vix > 0.60,
            },
            scenario_B_VixOnly: {
                desc: 'Social Data Failure (VIX Only)',
                input: { vix: 22 },
                output: {
                    score: resultB.composite_score,
                    tier: resultB.tier,
                    weights: resultB.metadata.weight_distribution,
                    confidence: resultB.confidence,
                },
                pass: resultB.metadata.weight_distribution.vix === 1.0 && resultB.confidence.level === 'low',
            },
            scenario_C_HighVol: {
                desc: 'Panic Mode Over institutional',
                input: { vix: 35 },
                output: {
                    score: resultC.composite_score,
                    tier: resultC.tier,
                    weights: resultC.metadata.weight_distribution,
                },
                pass: resultC.metadata.weight_distribution.vix >= 0.85,
            },
            scenario_D_MYMarket: {
                desc: 'Malaysia Market (News Dominant)',
                input: { vixScore: 60, socialScore: 55, newsScore: 80 },
                output: {
                    score: resultD.composite_score,
                    tier: resultD.tier,
                    weights: resultD.metadata.weight_distribution,
                },
                pass: resultD.metadata.weight_distribution.news === 0.50,
            },
            scenario_E_FullDSS: {
                desc: 'Full DSS (VIX+Social+AAII)',
                input: { vix: 18, social: 60, aaii: 80 },
                output: {
                    score: resultE.composite_score,
                    tier: resultE.tier,
                    weights: resultE.metadata.weight_distribution,
                },
                // Combined weight of vix(0.40) + social(0.20) + aaii(0.15) = 0.75
                // Scaled weights: vix=0.40/0.75=0.533
                pass: Math.abs(resultE.metadata.weight_distribution.vix - 0.533) < 0.01,
            },
        },
    });
}
