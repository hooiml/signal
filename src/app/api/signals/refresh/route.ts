import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchVIX, fetchHistoricalCurrencyVol } from '@/lib/yahoo-finance';
import { fetchMultipleSubreddits } from '@/lib/reddit';
import type { RedditPost } from '@/lib/reddit';
import { fetchMarketNews } from '@/lib/rss-feeds';
import type { NewsItem } from '@/lib/rss-feeds';
import { fetchTrendingTwits, calculateStockTwitsSentiment } from '@/lib/stocktwits';
import type { StockTwit } from '@/lib/stocktwits';
import {
    calculateRedditSentiment,
    calculateNewsSentiment
} from '@/lib/signal';
import { generateMarketAura } from '@/lib/gemini';
import { calculateSentimentScore } from '@/lib/sentiment-calculator';

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
        const { searchParams } = new URL(request.url);
        const marketParam = searchParams.get('market') || 'US';
        if (marketParam !== 'US' && marketParam !== 'MY') {
            return NextResponse.json({ error: 'Invalid market. Use US or MY.' }, { status: 400 });
        }
        const market = marketParam;

        console.log(`🔄 FORCE REFRESH (${market}): Bypassing cache...`);

        // 1. Fetch all data sources (Optimized: Skip StockTwits for MY, Add MYR Vol)
        const vixPromise = fetchVIX(); // Always US VIX as proxy
        const redditPromise = fetchMultipleSubreddits(
            market === 'MY' ? ['bursabets', 'malaysianpf'] : ['wallstreetbets', 'stocks', 'investing'],
            10
        );
        const newsPromise = fetchMarketNews(market);
        const stockTwitsPromise: Promise<StockTwit[]> = market === 'US' ? fetchTrendingTwits(20) : Promise.resolve([]);
        const myrVolPromise: ReturnType<typeof fetchHistoricalCurrencyVol> | Promise<null> =
            market === 'MY' ? fetchHistoricalCurrencyVol('USDMYR=X') : Promise.resolve(null);

        const [vixData, redditPosts, newsItems, stockTwits, myrVol] = await Promise.all([
            vixPromise,
            redditPromise,
            newsPromise,
            stockTwitsPromise,
            myrVolPromise
        ]);

        // 2. Calculate sentiment scores with market-specific weighting
        const redditSentiment = calculateRedditSentiment(redditPosts);
        const stockTwitsSentiment = market === 'US' ? calculateStockTwitsSentiment(stockTwits) : 0;
        const newsSentiment = calculateNewsSentiment(newsItems);

        // Calculate combined sentiment (Unified with signal.ts)
        const combinedSentiment = market === 'MY'
            ? (redditSentiment * 0.2) + (newsSentiment * 0.8) // MY: News-heavy
            : (redditSentiment * 0.5) + (stockTwitsSentiment * 0.5); // US: Balanced Social

        // Proxy Selection: For MY, use scaled Currency Volatility instead of US VIX
        let fearGaugeValue = vixData.price;
        let fearGaugeChangePct = vixData.price > 0 ? (vixData.change / vixData.price) * 100 : 0;

        if (market === 'MY' && myrVol && myrVol.vol20d > 0) {
            fearGaugeValue = Math.max(10, Math.min(80, myrVol.vol20d * 4000));
            fearGaugeChangePct = myrVol.currentPrice > 0 ? (myrVol.change / myrVol.currentPrice) * 100 : 0;
        }

        // 3. Calculate using the new robust formula
        const sentimentOutput = calculateSentimentScore({
            vix: fearGaugeValue,
            social: combinedSentiment,
            vixChangePct: fearGaugeChangePct,
        }, {
            // Unified Optimized Weights
            vixBaseWeight: market === 'MY' ? 0.30 : 0.60,
            socialBaseWeight: market === 'MY' ? 0.70 : 0.40,
        });

        console.log(`📊 Calculated (${market}):`, {
            vix: vixData.price,
            social: combinedSentiment,
            score: sentimentOutput.score,
            auraLevel: sentimentOutput.auraLevel,
        });

        // 4. Generate fresh AI analysis
        console.log(`🧠 Generating fresh AI analysis for ${market}...`);

        // Pass real data or empty arrays based on market
        const inputStockTwits = stockTwits;

        const aura = await generateMarketAura(
            market,
            vixData.price,
            sentimentOutput.auraLevel,
            combinedSentiment,
            redditPosts.map((p: RedditPost) => p.title),
            newsItems.map((n: NewsItem) => n.title),
            inputStockTwits.slice(0, 10).map((t: StockTwit) => `${t.body.substring(0, 80)} [${t.sentiment || 'N/A'}]`)
        );

        // 5. Upsert to DB with accurate metadata
        const dataSources = market === 'MY'
            ? ['yahoo', 'reddit', 'rss-news', 'gemini']
            : ['yahoo', 'reddit', 'stocktwits', 'gemini'];

        await sql`
            INSERT INTO market_signals (
                market_type, aura_level, aura_score, summary, key_drivers, outlook, 
                vix_value, social_sentiment_score, data_sources, model_version, signal_date
            ) VALUES (
                ${market}, 
                ${sentimentOutput.auraLevel}, 
                ${sentimentOutput.score}, 
                ${aura.summary}, 
                ${JSON.stringify(aura.keyDrivers)}, 
                ${aura.outlook}, 
                ${vixData.price}, 
                ${combinedSentiment}, 
                ${JSON.stringify(dataSources)},
                'v0.8-alpha-optimized', 
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
            market,
            timestamp: new Date().toISOString(),
            score: sentimentOutput.score,
            level: sentimentOutput.auraLevel
        });

    } catch (error) {
        console.error('❌ Refresh error:', error);
        return NextResponse.json(
            { error: 'Refresh failed', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
};
