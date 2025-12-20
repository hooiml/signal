import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { fetchMultipleSubreddits } from '@/lib/reddit';
import { fetchMarketNews } from '@/lib/rss-feeds';
import { fetchTrendingTwits, calculateStockTwitsSentiment } from '@/lib/stocktwits';

export const runtime = 'nodejs';

/**
 * Interpret sentiment score (-1 to 1) into human-readable levels
 */
const interpretSentiment = (score: number): { level: string; description: string; emoji: string } => {
    if (score >= 0.6) {
        return {
            level: 'STRONG_BULLISH',
            description: 'Strong bullish sentiment. Social media is highly optimistic with aggressive buying interest.',
            emoji: '🚀'
        };
    }
    if (score >= 0.2) {
        return {
            level: 'BULLISH',
            description: 'Moderately bullish sentiment. Investors are cautiously optimistic.',
            emoji: '📈'
        };
    }
    if (score >= -0.2) {
        return {
            level: 'NEUTRAL',
            description: 'Neutral sentiment. Market mood is balanced with mixed signals.',
            emoji: '➡️'
        };
    }
    if (score >= -0.6) {
        return {
            level: 'BEARISH',
            description: 'Moderately bearish sentiment. Investors are nervous and risk-averse.',
            emoji: '📉'
        };
    }
    return {
        level: 'STRONG_BEARISH',
        description: 'Strong bearish sentiment. Social media shows high fear and selling pressure.',
        emoji: '💥'
    };
};

export const GET = async (): Promise<NextResponse> => {
    try {
        // 1. Fetch Social & News Data in parallel
        const [redditPosts, newsItems, stockTwits] = await Promise.all([
            fetchMultipleSubreddits(['wallstreetbets', 'stocks', 'investing'], 5),
            fetchMarketNews('US'),
            fetchTrendingTwits(15)
        ]);

        // 2. Calculate Sentiment Scores

        // Reddit: Simple keyword analysis
        const keywords = (text: string) => {
            const t = text.toLowerCase();
            return (t.match(/bull|call|moon|buy/g) || []).length - (t.match(/bear|put|crash|sell/g) || []).length;
        };

        let redditScore = 0;
        redditPosts.forEach(p => redditScore += keywords(p.title + p.selftext));
        const redditSentiment = Math.max(-1, Math.min(1, redditScore / 20));

        // StockTwits: Built-in sentiment labels
        const stockTwitsSentiment = calculateStockTwitsSentiment(stockTwits);

        // Combined sentiment (weighted average)
        const combinedSentiment = (redditSentiment * 0.4 + stockTwitsSentiment * 0.6);
        const interpretation = interpretSentiment(combinedSentiment);

        // 3. Store raw data log
        await sql`
      INSERT INTO data_fetch_log (fetch_type, status, records_fetched, duration_ms)
      VALUES ('social-combined', 'success', ${redditPosts.length + newsItems.length + stockTwits.length}, 0)
    `;

        return NextResponse.json({
            success: true,
            data: {
                sentimentScore: parseFloat(combinedSentiment.toFixed(3)),
                sentimentLevel: interpretation.level,
                sentimentDescription: interpretation.description,
                emoji: interpretation.emoji,
                breakdown: {
                    reddit: parseFloat(redditSentiment.toFixed(3)),
                    stocktwits: parseFloat(stockTwitsSentiment.toFixed(3))
                },
                sources: {
                    reddit: redditPosts.map(p => ({ title: p.title, score: p.score, subreddit: p.subreddit })),
                    news: newsItems.map(n => ({ title: n.title, source: n.source })),
                    stocktwits: stockTwits.map(t => ({
                        body: t.body.substring(0, 100),
                        sentiment: t.sentiment,
                        symbols: t.symbols.map(s => s.symbol).join(', ')
                    }))
                }
            }
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
};
