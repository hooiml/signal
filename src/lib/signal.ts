import { fetchVIX, fetchQuotes, MarketData as YahooMarketData } from '@/lib/yahoo-finance';
import { fetchMultipleSubreddits, RedditPost } from '@/lib/reddit';
import { fetchMarketNews, NewsItem } from '@/lib/rss-feeds';
import { fetchTrendingTwits, calculateStockTwitsSentiment, StockTwit } from '@/lib/stocktwits';
import { generateMarketAura } from '@/lib/gemini';
import { calculateSentimentScore, getScoreDescription, SentimentOutput, getScoreBucket } from '@/lib/sentiment-calculator';
import { sql } from '@/lib/db';

interface AggregateMarketData {
    vixData: { price: number; change: number };
    marketIndices: YahooMarketData[];
    popularStocks: YahooMarketData[];
    activeStocks: YahooMarketData[];
    redditPosts: RedditPost[];
    newsItems: NewsItem[];
    stockTwits: StockTwit[];
    combinedSentiment: number;
    redditSentiment: number;
    stockTwitsSentiment: number;
    sentimentOutput: SentimentOutput;
}

/**
 * Calculate social sentiment from Reddit posts using keyword analysis
 */
function calculateRedditSentiment(posts: RedditPost[]): number {
    const keywords = (text: string) => {
        const t = text.toLowerCase();
        const bullish = (t.match(/bull|call|moon|buy|long|breakout|rally|surge|soar/g) || []).length;
        const bearish = (t.match(/bear|put|crash|sell|short|dump|plunge|collapse/g) || []).length;
        return bullish - bearish;
    };

    let score = 0;
    posts.forEach(p => {
        score += keywords(p.title + (p.selftext || ''));
    });

    // Normalize to -1 to +1, with softer scaling
    return Math.max(-1, Math.min(1, score / 15));
}

export type MarketType = 'US' | 'MY';

const CONFIG = {
    US: {
        indices: ['^GSPC', '^IXIC', '^DJI', '^RUT'],
        popular: ['NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'NFLX', 'AMD', 'AVGO'],
        active: ['PLTR', 'COIN', 'SOFI', 'MARA', 'MSTR', 'GME', 'AMC', 'HOOD', 'ROKU', 'DKNG', 'INTC', 'PYPL', 'JPM', 'BAC'],
        subreddits: ['wallstreetbets', 'stocks', 'investing'],
        stocktwitsLimit: 20
    },
    MY: {
        indices: ['^KLSE'], // FTSE Bursa Malaysia KLCI
        popular: ['1155.KL', '1295.KL', '1023.KL', '5347.KL', '5183.KL', '6033.KL', '4065.KL'], // Maybank, Public, CIMB, Tenaga, PetChem, Digi, KLK
        active: ['7113.KL', '4677.KL', '3182.KL', '5238.KL', '5296.KL', '0166.KL', '5099.KL'], // Top Glove, YTL, Genting, AAX, MR DIY, Inari, AirAsia
        subreddits: ['bursabets', 'malaysianpf'], // Removed r/malaysia (too noisy/political)
        stocktwitsLimit: 10 // Less active for MY
    }
};

/**
 * Calculate sentiment from News Headlines (Simple Keyword Match)
 * Essential for markets like MY where Reddit/StockTwits volume is low.
 */
function calculateNewsSentiment(news: NewsItem[]): number {
    const keywords = (text: string) => {
        const t = text.toLowerCase();
        // Weighted keywords for financial news
        const bullish = (t.match(/profit|record|dividend|grow|surge|jump|gain|high|strong|buy|upgrade|deal|agong/g) || []).length;
        const bearish = (t.match(/loss|drop|fall|weak|cut|debt|scandal|crash|low|sell|downgrade|risk|fail|court|suit/g) || []).length;
        return bullish - bearish;
    };

    let score = 0;
    // Analyze last 10 headlines
    news.slice(0, 10).forEach(n => {
        score += keywords(n.title + (n.contentSnippet || ''));
    });

    // Normalize: News is usually more neutral, so any signal is significant.
    // Scale slightly more aggressively than reddit.
    return Math.max(-1, Math.min(1, score / 8));
}

/**
 * Step 1: Gather all raw data (Cheap & Fast)
 */
export const fetchRawMarketData = async (market: MarketType): Promise<AggregateMarketData> => {
    const config = CONFIG[market];

    // FETCH EVERYTHING IN PARALLEL
    const [vixData, redditPosts, newsItems, stockTwits, indicesData, popularData, activeData] = await Promise.all([
        fetchVIX(), // Always global VIX for now as baseline
        fetchMultipleSubreddits(config.subreddits, 10),
        fetchMarketNews(market),
        fetchTrendingTwits(config.stocktwitsLimit),
        fetchQuotes(config.indices),
        fetchQuotes(config.popular),
        fetchQuotes(config.active)
    ]);

    // Calculate sentiment scores
    const redditSentiment = calculateRedditSentiment(redditPosts);
    const stockTwitsSentiment = market === 'US' ? calculateStockTwitsSentiment(stockTwits) : 0;
    const newsSentiment = calculateNewsSentiment(newsItems);

    // Weighted combination
    let combinedSentiment: number;

    if (market === 'US') {
        // US: Tech-heavy, retail-heavy. Reddit/StockTwits are dominant signal providers.
        combinedSentiment = (redditSentiment * 0.4) + (stockTwitsSentiment * 0.6);
    } else {
        // MY: Retail social is weak. News is the primary driver of sentiment.
        // We use News Sentiment as the "Social/Narrative" component.
        combinedSentiment = newsSentiment;
    }

    // Calculate using robust formula with DYNAMIC CONFIG based on market
    const sentimentOutput = calculateSentimentScore({
        vix: vixData.price,
        social: combinedSentiment,
        vixChangePct: vixData.change,
    }, {
        // OVERRIDE WEIGHTS FOR MALAYSIA
        // If MY: Global VIX (40%) + Local News (60%)
        // We reduce VIX influence because low US volatility doesn't always equal KLCI Euphoria.
        vixBaseWeight: market === 'MY' ? 0.40 : 0.65,
        socialBaseWeight: market === 'MY' ? 0.60 : 0.35,
    });

    return {
        vixData,
        marketIndices: indicesData,
        popularStocks: popularData,
        activeStocks: activeData,
        redditPosts,
        newsItems,
        stockTwits,
        combinedSentiment,
        redditSentiment,
        stockTwitsSentiment,
        sentimentOutput,
    };
};

/**
 * Step 2: Get AI Analysis (Expensive - Check Cache First)
 */
export const getAuraAnalysis = async (marketData: AggregateMarketData, market: MarketType) => {
    // Check Cache
    try {
        const cached = await sql`
      SELECT * FROM market_signals 
      WHERE market_type = ${market} 
      AND signal_date = CURRENT_DATE
      LIMIT 1
    `;

        if (cached.length > 0) {
            console.log(`✅ Using cached AI analysis for ${market}`);
            return {
                auraLevel: marketData.sentimentOutput.auraLevel,
                auraScore: marketData.sentimentOutput.score,
                summary: cached[0].summary,
                keyDrivers: cached[0].key_drivers,
                outlook: cached[0].outlook || "Market conditions are evolving. Monitor key drivers for changes."
            };
        }
    } catch (e) {
        console.warn('Cache check failed, generating fresh:', e);
    }

    // Generate Fresh
    console.log(`🧠 Generating fresh AI analysis for ${market}...`);
    const aura = await generateMarketAura(
        marketData.vixData.price,
        marketData.sentimentOutput.auraLevel,
        marketData.combinedSentiment,
        marketData.redditPosts.map(p => p.title),
        marketData.newsItems.map(n => n.title),
        market === 'US' ? marketData.stockTwits.map(t => `${t.body.substring(0, 80)} [${t.sentiment || 'N/A'}]`) : []
    );

    // Save to DB (Async, don't block return)
    (async () => {
        try {
            await sql`
        INSERT INTO market_signals (
          market_type, aura_level, aura_score, summary, key_drivers, outlook,
          vix_value, social_sentiment_score, data_sources, model_version, signal_date
        ) VALUES (
          ${market}, ${aura.auraLevel}, ${marketData.sentimentOutput.score}, ${aura.summary}, ${JSON.stringify(aura.keyDrivers)}, ${aura.outlook},
          ${marketData.vixData.price}, ${marketData.combinedSentiment}, 
          ${JSON.stringify(['yahoo', 'reddit', 'stocktwits', 'gemini'])}, 'v0.5-quant', CURRENT_DATE
        )
        ON CONFLICT (market_type, signal_date) DO UPDATE SET
          aura_level = EXCLUDED.aura_level,
          aura_score = EXCLUDED.aura_score,
          summary = EXCLUDED.summary,
          key_drivers = EXCLUDED.key_drivers,
          outlook = EXCLUDED.outlook,
          updated_at = NOW()
      `;
        } catch (err) {
            console.error('Failed to save signal to DB:', err);
        }
    })();

    return {
        ...aura,
        auraScore: marketData.sentimentOutput.score,
        auraLevel: marketData.sentimentOutput.auraLevel,
    };
};

/**
 * Main Orchestrator
 */
export const getSmartSignal = async (market: MarketType = 'US') => {
    const fetchStart = Date.now();

    try {
        const marketData = await fetchRawMarketData(market);
        const aura = await getAuraAnalysis(marketData, market);

        const fetchDurationMs = Date.now() - fetchStart;

        // Assess data quality
        const hasNews = marketData.newsItems.length > 0;
        const hasVix = marketData.vixData.price > 0;
        const dataQuality = hasNews && hasVix ? 'GOOD' : (!hasVix ? 'DEGRADED' : 'LIMITED');

        return {
            // METADATA (Production-grade additions)
            meta: {
                market,
                lastUpdated: new Date().toISOString(),
                fetchDurationMs,
                status: 'OK',
                dataQuality,
                vixSource: market === 'MY' ? 'US_VIX_PROXY' : 'CBOE_VIX',
                vixDisclaimer: market === 'MY' ? 'Using US VIX as global risk proxy. Local KLSE volatility coming in Phase 2.' : null,
            },
            marketAura: aura,
            marketPulse: {
                indices: marketData.marketIndices,
                popular: marketData.popularStocks,
                active: marketData.activeStocks
            },
            rawMetrics: {
                vix: marketData.vixData.price,
                vixChange: marketData.vixData.change,
                vixAuraLevel: marketData.sentimentOutput.auraLevel,
                socialSentiment: parseFloat(marketData.combinedSentiment.toFixed(3)),
                scoreDescription: getScoreDescription(marketData.sentimentOutput.score),
                breakdown: {
                    reddit: parseFloat(marketData.redditSentiment.toFixed(3)),
                    stocktwits: parseFloat(marketData.stockTwitsSentiment.toFixed(3)),
                },
                components: marketData.sentimentOutput.components,
            },
            sources: {
                reddit: marketData.redditPosts,
                news: marketData.newsItems,
                stocktwits: marketData.stockTwits,
            },
        };
    } catch (error) {
        // Defensive: Return graceful error state instead of crashing
        console.error('getSmartSignal failed:', error);
        return {
            meta: {
                market,
                lastUpdated: new Date().toISOString(),
                fetchDurationMs: Date.now() - fetchStart,
                status: 'ERROR',
                dataQuality: 'UNAVAILABLE',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            marketAura: null,
            marketPulse: null,
            rawMetrics: null,
            sources: null,
        };
    }
};
