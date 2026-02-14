import { fetchVIX, fetchIndicesWithChart, fetchQuotes, fetchHistoricalCurrencyVol, MarketData as YahooMarketData } from '@/lib/yahoo-finance';
import { fetchMultipleSubreddits, RedditPost } from '@/lib/reddit';
import { fetchMarketNews, NewsItem } from '@/lib/rss-feeds';
import { fetchTrendingTwits, calculateStockTwitsSentiment, StockTwit } from '@/lib/stocktwits';
import { calculateSentimentScore, getScoreDescription, SentimentOutput } from '@/lib/sentiment-calculator';
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
export function calculateRedditSentiment(posts: RedditPost[]): number {
    const keywords = (text: string) => {
        const t = text.toLowerCase();
        const bullish = (t.match(/bull|call|moon|buy|long|breakout|rally|surge|soar/g) || []).length;
        const bearish = (t.match(/bear|put|crash|sell|short|dump|plunge|collapse/g) || []).length;
        return bullish - bearish;
    };

    let score = 0;
    posts.forEach(p => {
        // Include both title and post body for deeper sentiment judgement
        score += keywords(p.title + ' ' + (p.selftext || ''));
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
export function calculateNewsSentiment(news: NewsItem[]): number {
    const keywords = (text: string) => {
        const t = text.toLowerCase();
        // Weighted keywords for financial news
        const bullish = (t.match(/profit|record|dividend|grow|surge|jump|gain|high|strong|buy|upgrade|deal|agong/g) || []).length;
        const bearish = (t.match(/loss|drop|fall|weak|cut|debt|scandal|crash|low|sell|downgrade|risk|fail|court|suit/g) || []).length;
        return bullish - bearish;
    };

    let score = 0;
    const now = Date.now();

    // Analyze last 10 headlines
    news.slice(0, 10).forEach(n => {
        const sentiment = keywords(n.title + (n.contentSnippet || ''));

        // AGE DECAY: Headlines older than 4h lose half their weight. (Quant Audit Recommendation)
        let weight = 1.0;
        if (n.pubDate) {
            const pubDate = new Date(n.pubDate).getTime();
            const ageHours = (now - pubDate) / (1000 * 60 * 60);
            if (ageHours > 0) {
                // Half-life: 4 hours
                weight = Math.pow(2, -(ageHours / 4));
            }
        }

        score += (sentiment * weight);
    });

    // CONFIDENCE ADJUSTMENT: Dampen score if headlines are sparse (Quant Audit Recommendation)
    // Threshold: 5 headlines for 100% confidence.
    const confidence = Math.min(1.0, news.length / 5);
    const finalScore = score * confidence;

    // Normalize: News is usually more neutral, so any signal is significant.
    // Scale slightly more aggressively than reddit.
    return Math.max(-1, Math.min(1, finalScore / 8));
}

/**
 * Step 1a: Fetch CORE market data (Tiered Strategy)
 * - Priority: Indices + Top 4 Popular = Full chart data (sparklines)
 * - Deferred: Rest of stocks = Batch API (fast, no sparklines)
 */
export const fetchCoreMarketData = async (market: MarketType) => {
    const config = CONFIG[market];

    // Split into priority (sparklines) and deferred (batch) groups
    const prioritySymbols = [...config.indices, ...config.popular.slice(0, 4)];
    const deferredSymbols = [...config.popular.slice(4), ...config.active];

    // Fetch VIX + Priority (with sparklines) + Deferred (batch) in parallel
    // For MY, we also fetch currency volatility as a local proxy
    const [vixData, priorityQuotes, deferredQuotes, myrVol] = await Promise.all([
        fetchVIX(),
        fetchIndicesWithChart(prioritySymbols),  // Full chart data
        fetchQuotes(deferredSymbols),            // Fast batch (no sparklines)
        market === 'MY' ? fetchHistoricalCurrencyVol('USDMYR=X') : Promise.resolve(null)
    ]);

    // Combine and categorize
    const allQuotes = [...priorityQuotes, ...deferredQuotes];
    const indicesData = allQuotes.filter((q: YahooMarketData) => config.indices.includes(q.symbol));
    const popularData = allQuotes.filter((q: YahooMarketData) => config.popular.includes(q.symbol));
    const activeData = allQuotes.filter((q: YahooMarketData) => config.active.includes(q.symbol));

    return { vixData, indicesData, popularData, activeData, config, myrVol };
};

/**
 * Step 1b: Fetch SOCIAL data (Slower - Reddit, RSS, StockTwits)
 */
export const fetchSocialData = async (market: MarketType) => {
    const config = CONFIG[market];

    const [redditPosts, newsItems, stockTwits] = await Promise.all([
        fetchMultipleSubreddits(config.subreddits, 10),
        fetchMarketNews(market),
        // StockTwits is only relevant for US market
        market === 'US' ? fetchTrendingTwits(config.stocktwitsLimit) : Promise.resolve([])
    ]) as [RedditPost[], any[], any[]];

    // DIAGNOSTIC MOCK: If Malaysia and empty, add a indicator post
    if (market === 'MY' && redditPosts.length === 0) {
        redditPosts.push({
            title: "📡 [DIAGNOSTIC] Reddit Sync Active - Waiting for Subreddit Signal...",
            selftext: "This is a fallback message showing that the UI is working but the Reddit API is currently returning 0 results for Bursa subreddits.",
            score: 1,
            num_comments: 0,
            url: "https://www.reddit.com/r/bursabets",
            permalink: "/r/bursabets",
            created_utc: Date.now() / 1000,
            subreddit: "r/System"
        });
    }

    return { redditPosts, newsItems, stockTwits };
};

/**
 * Step 1 (Legacy): Gather all raw data - uses both Core and Social
 */
export const fetchRawMarketData = async (market: MarketType): Promise<AggregateMarketData> => {

    // FETCH CORE + SOCIAL IN PARALLEL
    const [coreData, socialData] = await Promise.all([
        fetchCoreMarketData(market),
        fetchSocialData(market)
    ]);

    const { vixData, indicesData, popularData, activeData, myrVol } = coreData;
    const { redditPosts, newsItems, stockTwits } = socialData;

    // Calculate sentiment scores
    const redditSentiment = calculateRedditSentiment(redditPosts);
    const stockTwitsSentiment = market === 'US' ? calculateStockTwitsSentiment(stockTwits) : 0;
    const newsSentiment = calculateNewsSentiment(newsItems);

    // Weighted combination
    let combinedSentiment: number;

    if (market === 'US') {
        // US: Tech-heavy, retail-heavy. Balanced Reddit/StockTwits.
        combinedSentiment = (redditSentiment * 0.5) + (stockTwitsSentiment * 0.5);
    } else {
        // MY: News is the primary driver (earnings, politics, macro).
        // Reddit (BursaBets) is a secondary retail signal.
        combinedSentiment = (redditSentiment * 0.2) + (newsSentiment * 0.8);
    }

    // Proxy Selection: For MY, use scaled Currency Volatility instead of US VIX
    let fearGaugeValue = vixData.price;
    let fearGaugeChangePct = vixData.price > 0 ? (vixData.change / vixData.price) * 100 : 0;

    if (market === 'MY' && myrVol && myrVol.vol20d > 0) {
        // Scale FX Vol to VIX-equivalent (e.g. 0.005 std-dev * 4000 = 20 VIX)
        // High FX vol = Higher fearGaugeValue = Lower sentiment score
        fearGaugeValue = myrVol.vol20d * 4000;
        fearGaugeChangePct = myrVol.currentPrice > 0 ? (myrVol.change / myrVol.currentPrice) * 100 : 0;

        // Clamp proxy to reasonable VIX-like bounds (10 to 80)
        fearGaugeValue = Math.max(10, Math.min(80, fearGaugeValue));
    }

    const sentimentOutput = calculateSentimentScore({
        vix: fearGaugeValue,
        social: combinedSentiment,
        vixChangePct: fearGaugeChangePct,
    }, {
        // Optimized weights: US is VIX-anchored, MY is News-anchored.
        vixBaseWeight: market === 'MY' ? 0.30 : 0.60,
        socialBaseWeight: market === 'MY' ? 0.70 : 0.40,
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
    // 1. Try to read LATEST analysis from DB (regardless of date, just get the last known good state)
    try {
        const cached = await sql`
      SELECT * FROM market_signals 
      WHERE market_type = ${market} 
      ORDER BY updated_at DESC, signal_date DESC
      LIMIT 1
    `;

        if (cached.length > 0) {
            // Check staleness (optional log)
            const isStale = new Date(cached[0].signal_date).toDateString() !== new Date().toDateString();
            if (isStale) console.log(`⚠️ Serving stale AI analysis for ${market} from ${cached[0].signal_date}`);

            return injectLiveAuraData({
                // Use the DB's stored level/score if available, or current live calculation?
                // Ideally, "Aura" (Text) matches the stored record, but "Score" (Number) is live.
                // Hybrid approach: Live score, Stored Text.
                auraLevel: marketData.sentimentOutput.auraLevel,
                auraScore: marketData.sentimentOutput.score,

                // Text content from DB
                summary: cached[0].summary,
                keyDrivers: typeof cached[0].key_drivers === 'string' ? JSON.parse(cached[0].key_drivers) : cached[0].key_drivers,
                outlook: cached[0].outlook || "Market conditions are evolving. Monitor key drivers for changes.",
                generatedAt: cached[0].updated_at || cached[0].created_at || cached[0].signal_date
            }, marketData);
        }
    } catch (e) {
        console.error('DB Read failed:', e);
    }

    // 2. Fallback if DB is empty or fails (DO NOT generate fresh on render)
    console.warn(`⚠️ No AI analysis found in DB for ${market}. Returning fallback.`);

    const fallbackAura = {
        auraLevel: marketData.sentimentOutput.auraLevel,
        auraScore: marketData.sentimentOutput.score,
        summary: "Market intelligence is currently compiling. Live data suggests " + marketData.sentimentOutput.auraLevel.replace('_', ' ') + " conditions.",
        keyDrivers: [
            { factor: "VIX Index", impact: "neutral", description: `VIX is at ${marketData.vixData.price.toFixed(2)}` },
            { factor: "Social Volume", impact: "neutral", description: "Analyzing current social chatter intensity." }
        ],
        outlook: "Awaiting updated analysis. Check back shortly."
    };

    return injectLiveAuraData(fallbackAura, marketData);
};

interface AuraData {
    auraLevel: string;
    auraScore: number;
    summary: string;
    keyDrivers: Array<{ factor: string; impact: string; description: string }>;
    outlook: string;
    generatedAt?: string;
}

/**
 * Trust Layer: Inject live data into potentially stale AI text
 */
function injectLiveAuraData(aura: AuraData, marketData: AggregateMarketData) {
    if (!aura || !aura.summary) return aura;

    // 1. Sync VIX numbers
    const liveVix = marketData.vixData.price.toFixed(2);
    // Permissive regex for VIX mentions (VIX at 20, VIX of 20, VIX is 20, etc.)
    let updatedSummary = aura.summary.replace(
        /(?:VIX Index|VIX|volatility index) (?:at|is|level of|of|around)?\s*\d+\.?\d*/gi,
        `VIX at ${liveVix}`
    );

    // 2. Sync Sentiment Levels (e.g., replace stale 'GREED' with live 'FEAR')
    if (marketData.sentimentOutput.auraLevel) {
        const liveLevel = marketData.sentimentOutput.auraLevel.replace(/_/g, ' ');
        // List of all possible levels to search and replace
        const allLevels = ['EXTREME GREED', 'GREED', 'NEUTRAL', 'ANXIETY', 'FEAR', 'EXTREME FEAR'];

        allLevels.forEach(level => {
            if (level !== liveLevel) {
                const levelRegex = new RegExp(`\\b${level}\\b`, 'gi');
                updatedSummary = updatedSummary.replace(levelRegex, liveLevel);
            }
        });
    }

    return {
        ...aura,
        summary: updatedSummary
    };
}


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
                vixSource: market === 'MY' ? 'USD/MYR_VOL_PROXY' : 'CBOE_VIX',
                vixDisclaimer: market === 'MY' ? 'Using 20-day Rolling Ringgit Volatility as local fear gauge. Scaled for VIX-parity.' : null,
                sentimentVelocity: marketData.sentimentOutput.components.vixScore > 0 ? (marketData.sentimentOutput.components.socialScore / marketData.sentimentOutput.components.vixScore).toFixed(2) : 'N/A', // Simple ratio as proxy for velocity for now
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
                stocktwits: marketData.stockTwits.slice(0, 10).map((t: StockTwit) => `${t.body.substring(0, 80)} [${t.sentiment || 'N/A'}]`),
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
