import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchVIX } from '@/lib/yahoo-finance';
import { fetchMultipleSubreddits } from '@/lib/reddit';
import { fetchMarketNews } from '@/lib/rss-feeds';
import { fetchTrendingTwits, calculateStockTwitsSentiment } from '@/lib/stocktwits';
import { generateMarketAura } from '@/lib/gemini';
import { calculateSentimentScore, getScoreDescription } from '@/lib/sentiment-calculator';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Force refresh endpoint - bypasses cache and updates DB
 * Use this when data is stale or after making formula changes
 */
export const GET = async (request: Request): Promise<NextResponse> => {
    // Security: Require CRON_SECRET for this expensive endpoint
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.warn('⚠️ Unauthorized refresh attempt');
        return NextResponse.json(
            { error: 'Unauthorized. Provide valid CRON_SECRET in Authorization header.' },
            { status: 401 }
        );
    }

    try {
        console.log('🔄 FORCE REFRESH: Bypassing cache...');

        // 1. Fetch all data sources
        const [vixData, redditPosts, newsItems, stockTwits] = await Promise.all([
            fetchVIX(),
            fetchMultipleSubreddits(['wallstreetbets', 'stocks', 'investing'], 10),
            fetchMarketNews('US'),
            fetchTrendingTwits(20)
        ]);

        // 2. Calculate sentiment scores
        const keywords = (text: string) => {
            const t = text.toLowerCase();
            const bullish = (t.match(/bull|call|moon|buy|long|breakout|rally|surge|soar/g) || []).length;
            const bearish = (t.match(/bear|put|crash|sell|short|dump|plunge|collapse/g) || []).length;
            return bullish - bearish;
        };

        let redditScore = 0;
        redditPosts.forEach(p => redditScore += keywords(p.title + (p.selftext || '')));
        const redditSentiment = Math.max(-1, Math.min(1, redditScore / 15));
        const stockTwitsSentiment = calculateStockTwitsSentiment(stockTwits);
        const combinedSentiment = (redditSentiment * 0.4) + (stockTwitsSentiment * 0.6);

        // 3. Calculate using the new robust formula
        // Fix #7: vixChangePct should be actual percent, not raw change
        const vixChangePct = vixData.price > 0 ? (vixData.change / vixData.price) * 100 : 0;
        const sentimentOutput = calculateSentimentScore({
            vix: vixData.price,
            social: combinedSentiment,
            vixChangePct: vixChangePct,
        });

        console.log('📊 Calculated:', {
            vix: vixData.price,
            social: combinedSentiment,
            score: sentimentOutput.score,
            auraLevel: sentimentOutput.auraLevel,
        });

        // 4. Generate fresh AI analysis (this costs tokens!)
        console.log('🧠 Generating fresh AI analysis...');
        const aura = await generateMarketAura(
            vixData.price,
            sentimentOutput.auraLevel,
            combinedSentiment,
            redditPosts.map(p => p.title),
            newsItems.map(n => n.title),
            stockTwits.map(t => `${t.body.substring(0, 80)} [${t.sentiment || 'N/A'}]`)
        );

        // 5. Upsert to DB (Fix #6: Use ON CONFLICT instead of DELETE+INSERT)
        await sql`
            INSERT INTO market_signals (
                market_type, aura_level, aura_score, summary, key_drivers, outlook,
                vix_value, social_sentiment_score, data_sources, model_version, signal_date
            ) VALUES (
                'US', 
                ${sentimentOutput.auraLevel}, 
                ${sentimentOutput.score}, 
                ${aura.summary}, 
                ${JSON.stringify(aura.keyDrivers)}, 
                ${aura.outlook},
                ${vixData.price}, 
                ${combinedSentiment}, 
                ${JSON.stringify(['yahoo', 'reddit', 'stocktwits', 'gemini'])}, 
                'v0.6-quantfix', 
                CURRENT_DATE
            )
            ON CONFLICT (market_type, signal_date) DO UPDATE SET
                aura_level = EXCLUDED.aura_level,
                aura_score = EXCLUDED.aura_score,
                summary = EXCLUDED.summary,
                key_drivers = EXCLUDED.key_drivers,
                outlook = EXCLUDED.outlook,
                vix_value = EXCLUDED.vix_value,
                social_sentiment_score = EXCLUDED.social_sentiment_score,
                data_sources = EXCLUDED.data_sources,
                model_version = EXCLUDED.model_version,
                updated_at = NOW()
        `;

        console.log('✅ DB updated successfully');

        return NextResponse.json({
            success: true,
            message: 'Force refresh complete. Cache cleared and DB updated.',
            data: {
                auraLevel: sentimentOutput.auraLevel,
                auraScore: sentimentOutput.score,
                scoreDescription: getScoreDescription(sentimentOutput.score),
                vix: vixData.price,
                socialSentiment: combinedSentiment,
                components: sentimentOutput.components,
            }
        });

    } catch (error) {
        console.error('Force refresh error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};
