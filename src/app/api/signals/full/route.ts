import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchVIX } from '@/lib/yahoo-finance';
import { fetchMultipleSubreddits } from '@/lib/reddit';
import { fetchMarketNews } from '@/lib/rss-feeds';
import { fetchTrendingTwits, calculateStockTwitsSentiment } from '@/lib/stocktwits';
import { generateMarketAura } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 30; // Allow longer runtime for AI processing

export const GET = async (request: Request): Promise<NextResponse> => {
    // Security: Require CRON_SECRET for this expensive endpoint
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
            { error: 'Unauthorized. Provide valid CRON_SECRET in Authorization header.' },
            { status: 401 }
        );
    }

    try {
        // 1. Fetch all data sources in parallel
        const [vixData, redditPosts, newsItems, stockTwits] = await Promise.all([
            fetchVIX(),
            fetchMultipleSubreddits(['wallstreetbets', 'stocks', 'investing'], 5),
            fetchMarketNews('US'),
            fetchTrendingTwits(15)
        ]);

        // 2. Calculate base sentiment scores
        const keywords = (text: string) => {
            const t = text.toLowerCase();
            return (t.match(/bull|call|moon|buy/g) || []).length - (t.match(/bear|put|crash|sell/g) || []).length;
        };

        let redditScore = 0;
        redditPosts.forEach(p => redditScore += keywords(p.title + p.selftext));
        const redditSentiment = Math.max(-1, Math.min(1, redditScore / 20));
        const stockTwitsSentiment = calculateStockTwitsSentiment(stockTwits);
        const combinedSentiment = (redditSentiment * 0.4 + stockTwitsSentiment * 0.6);

        // 3. Calculate VIX aura level
        const getVixAuraLevel = (vix: number): string => {
            if (vix < 13) return 'EXTREME_GREED';
            if (vix < 17) return 'GREED';
            if (vix < 23) return 'NEUTRAL';
            if (vix < 30) return 'FEAR';
            return 'EXTREME_FEAR';
        };

        const vixAuraLevel = getVixAuraLevel(vixData.price);

        // 4. Generate AI-powered Market Aura via Gemini
        const aura = await generateMarketAura(
            vixData.price,
            vixAuraLevel,
            combinedSentiment,
            redditPosts.map(p => p.title),
            newsItems.map(n => n.title),
            stockTwits.map(t => `${t.body.substring(0, 80)} [${t.sentiment || 'N/A'}]`)
        );

        // 5. Store in database
        await sql`
      INSERT INTO market_signals (
        market_type,
        aura_level,
        aura_score,
        summary,
        key_drivers,
        vix_value,
        social_sentiment_score,
        data_sources,
        model_version,
        signal_date
      ) VALUES (
        'US',
        ${aura.auraLevel},
        ${Math.round(aura.auraScore)},
        ${aura.summary},
        ${JSON.stringify(aura.keyDrivers)},
        ${vixData.price},
        ${combinedSentiment},
        ${JSON.stringify(['yahoo-finance', 'reddit', 'stocktwits', 'rss-news', 'gemini-2.5-flash-lite'])},
        'v0.4-gemini',
        CURRENT_DATE
      )
      ON CONFLICT (market_type, signal_date)
      DO UPDATE SET
        aura_level = EXCLUDED.aura_level,
        aura_score = EXCLUDED.aura_score,
        summary = EXCLUDED.summary,
        key_drivers = EXCLUDED.key_drivers,
        vix_value = EXCLUDED.vix_value,
        social_sentiment_score = EXCLUDED.social_sentiment_score,
        data_sources = EXCLUDED.data_sources,
        model_version = EXCLUDED.model_version,
        updated_at = NOW()
    `;

        // 6. Log the fetch
        await sql`
      INSERT INTO data_fetch_log (fetch_type, status, records_fetched, duration_ms)
      VALUES ('full-aura-generation', 'success', ${redditPosts.length + newsItems.length + stockTwits.length}, 0)
    `;

        return NextResponse.json({
            success: true,
            data: {
                marketAura: aura,
                rawMetrics: {
                    vix: vixData.price,
                    vixAuraLevel,
                    socialSentiment: parseFloat(combinedSentiment.toFixed(3)),
                    breakdown: {
                        reddit: parseFloat(redditSentiment.toFixed(3)),
                        stocktwits: parseFloat(stockTwitsSentiment.toFixed(3))
                    }
                },
                sourceCounts: {
                    reddit: redditPosts.length,
                    news: newsItems.length,
                    stocktwits: stockTwits.length
                }
            }
        });

    } catch (error) {
        console.error('Full aggregation error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};
