import { fetchVIX, fetchIndicesWithChart, fetchQuotes, fetchHistoricalCurrencyVol, MarketData as YahooMarketData } from '@/lib/yahoo-finance';
import { fetchMultipleSubreddits, RedditPost } from '@/lib/reddit';
import { fetchMarketNews, NewsItem } from '@/lib/rss-feeds';
import { fetchTrendingTwits, calculateStockTwitsSentiment, StockTwit } from '@/lib/stocktwits';
import { calculateSentimentScore, getScoreDescription, SentimentOutput } from '@/lib/sentiment-calculator';
import { sql } from '@/lib/db';
import { calculateCompositeScoreV2 } from './sentiment-calculator-v2';
import { IndicatorData, MarketSignal, SignalTier } from './types/signal-v2';
import { getLatestInstitutionalData } from './institutional-service';
import { BuffettIndicatorData, fetchBuffettIndicator, fetchCboePutCallRatio, fetchNaaimExposure, normalizeNaaimExposure, normalizePutCallRatio, NaaimExposureData, PutCallRatioData } from './market-indicators';
import { fetchMarketContext } from './market-context';
import { getIndicatorDisplayName } from './indicator-registry';
import { calculateDriverChanges, parseStoredComponentContributions, parseStoredDriverContributions } from './signal-change';
import type { MarketContextData } from './types/market-context';
import { getSourceIndicatorCount, shouldEnableSourceIndicator } from './source-indicator';
import { getMarketCalibration } from './market-calibration-service';

interface AggregateMarketData {
    vixData: { price: number; change: number };
    marketIndices: YahooMarketData[];
    popularStocks: YahooMarketData[];
    activeStocks: YahooMarketData[];
    redditPosts: RedditPost[];
    newsItems: NewsItem[];
    stockTwits: StockTwit[];
    putCallRatio: PutCallRatioData | null;
    naaimExposure: NaaimExposureData | null;
    buffettIndicator: BuffettIndicatorData | null;
    marketContext: MarketContextData;
    combinedSentiment: number;
    redditSentiment: number;
    stockTwitsSentiment: number;
    newsSentiment: number;
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
type MarketMode = 'standard' | 'contrarian';

interface SnapshotSummaryRow {
    snapshot_date: string;
    composite_score: number;
    tier: SignalTier;
    origin?: 'observed' | 'reconstructed';
    coverage_note?: string | null;
    components?: unknown;
    score_drivers?: unknown;
}

export const CONFIG = {
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
    const [vixData, priorityQuotes, deferredQuotes, myrVol, putCallRatio, naaimExposure, buffettIndicator, marketContext] = await Promise.all([
        fetchVIX(),
        fetchIndicesWithChart(prioritySymbols),  // Full chart data
        fetchQuotes(deferredSymbols),            // Fast batch (no sparklines)
        market === 'MY' ? fetchHistoricalCurrencyVol('USDMYR=X') : Promise.resolve(null),
        market === 'US' ? fetchCboePutCallRatio() : Promise.resolve(null),
        market === 'US' ? fetchNaaimExposure() : Promise.resolve(null),
        market === 'US' ? fetchBuffettIndicator() : Promise.resolve(null),
        fetchMarketContext(market)
    ]);

    // Combine and categorize
    const allQuotes = [...priorityQuotes, ...deferredQuotes];
    const indicesData = allQuotes.filter((q: YahooMarketData) => config.indices.includes(q.symbol));
    const popularData = allQuotes.filter((q: YahooMarketData) => config.popular.includes(q.symbol));
    const activeData = allQuotes.filter((q: YahooMarketData) => config.active.includes(q.symbol));

    return { vixData, indicesData, popularData, activeData, config, myrVol, putCallRatio, naaimExposure, buffettIndicator, marketContext };
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
    ]) as [RedditPost[], NewsItem[], StockTwit[]];


    return { redditPosts, newsItems, stockTwits };
};

/**
 * Step 1 (Legacy): Gather all raw data - uses both Core and Social
 */
export const fetchRawMarketData = async (
    market: MarketType,
    enableSocial = true,
    loadSocialData = enableSocial
): Promise<AggregateMarketData> => {

    // FETCH CORE + SOCIAL IN PARALLEL
    const [coreData, socialData] = await Promise.all([
        fetchCoreMarketData(market),
        loadSocialData
            ? enableSocial
                ? fetchSocialData(market)
                : fetchSocialData(market).catch(error => {
                    console.warn('Counterfactual social fetch failed:', error);
                    return { redditPosts: [], newsItems: [], stockTwits: [] };
                })
            : Promise.resolve({ redditPosts: [], newsItems: [], stockTwits: [] })
    ]);

    const { vixData, indicesData, popularData, activeData, myrVol, putCallRatio, naaimExposure, buffettIndicator, marketContext } = coreData;
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
        putCallRatio,
        naaimExposure,
        buffettIndicator,
        marketContext,
        combinedSentiment,
        redditSentiment,
        stockTwitsSentiment,
        newsSentiment,
        sentimentOutput,
    };
};

async function ensureSignalSnapshotsTable() {
    await sql`
        CREATE TABLE IF NOT EXISTS signal_snapshots (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            market_type VARCHAR(10) NOT NULL CHECK (market_type IN ('US', 'MY')),
            mode VARCHAR(20) NOT NULL CHECK (mode IN ('standard', 'contrarian')),
            enable_social BOOLEAN NOT NULL DEFAULT true,
            snapshot_date DATE NOT NULL,
            composite_score INTEGER NOT NULL CHECK (composite_score BETWEEN 0 AND 100),
            tier VARCHAR(20) NOT NULL,
            confidence_level VARCHAR(20) NOT NULL,
            agreement_pct INTEGER NOT NULL,
            majority_signal VARCHAR(20) NOT NULL,
            components JSONB NOT NULL,
            score_drivers JSONB NOT NULL,
            index_trend JSONB NOT NULL,
            signal_quality JSONB NOT NULL,
            interpretation_context JSONB NOT NULL,
            metadata_snapshot JSONB NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(market_type, mode, enable_social, snapshot_date)
        )
    `;

    await sql`
        CREATE INDEX IF NOT EXISTS idx_signal_snapshots_lookup
        ON signal_snapshots(market_type, mode, enable_social, snapshot_date DESC)
    `;

    await sql`ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'observed'`;
    await sql`ALTER TABLE signal_snapshots ADD COLUMN IF NOT EXISTS coverage_note TEXT`;
}

async function persistSignalSnapshot(
    signal: MarketSignal,
    options: { market: MarketType; mode: MarketMode; enableSocial: boolean }
) {
    try {
        await ensureSignalSnapshotsTable();

        const today = new Date().toISOString().slice(0, 10);
        const previousRows = await sql`
            SELECT snapshot_date::text as snapshot_date, composite_score, tier, components, score_drivers
            FROM signal_snapshots
            WHERE market_type = ${options.market}
              AND mode = ${options.mode}
              AND enable_social = ${options.enableSocial}
              AND snapshot_date < CURRENT_DATE
            ORDER BY snapshot_date DESC
            LIMIT 1
        ` as SnapshotSummaryRow[];

        const historyBefore = await sql`
            SELECT snapshot_date::text as snapshot_date, composite_score, tier, origin, coverage_note
            FROM signal_snapshots
            WHERE market_type = ${options.market}
              AND mode = ${options.mode}
              AND enable_social = ${options.enableSocial}
            ORDER BY snapshot_date DESC
            LIMIT 89
        ` as SnapshotSummaryRow[];

        const componentsSnapshot = Object.fromEntries(
            Object.entries(signal.components).map(([key, component]) => [
                key,
                {
                    raw_value: component.value,
                    score: component.score,
                    weight: component.weight,
                    signal: component.signal,
                    last_updated: component.last_updated,
                    display_name: component.display_name,
                }
            ])
        );
        const metadataSnapshot = {
            data_freshness: signal.metadata.data_freshness,
            weight_distribution: signal.metadata.weight_distribution,
            mode_note: signal.metadata.interpretation_context?.mode_note,
            article_feed_role: signal.metadata.interpretation_context?.article_feed_role,
            counterfactuals: signal.metadata.counterfactuals,
            valuation_backdrop: signal.metadata.valuation_backdrop,
            market_context: signal.metadata.market_context,
        };

        await sql`
            INSERT INTO signal_snapshots (
                market_type, mode, enable_social, snapshot_date, composite_score, tier,
                confidence_level, agreement_pct, majority_signal, components, score_drivers,
                index_trend, signal_quality, interpretation_context, metadata_snapshot
            ) VALUES (
                ${options.market},
                ${options.mode},
                ${options.enableSocial},
                CURRENT_DATE,
                ${signal.composite_score},
                ${signal.tier},
                ${signal.confidence.level},
                ${signal.confidence.agreement_pct},
                ${signal.confidence.majority_signal},
                ${JSON.stringify(componentsSnapshot)},
                ${JSON.stringify(signal.metadata.score_drivers || [])},
                ${JSON.stringify(signal.metadata.index_trend || [])},
                ${JSON.stringify(signal.metadata.signal_quality || {})},
                ${JSON.stringify(signal.metadata.interpretation_context || {})},
                ${JSON.stringify(metadataSnapshot)}
            )
            ON CONFLICT (market_type, mode, enable_social, snapshot_date)
            DO UPDATE SET
                composite_score = EXCLUDED.composite_score,
                tier = EXCLUDED.tier,
                confidence_level = EXCLUDED.confidence_level,
                agreement_pct = EXCLUDED.agreement_pct,
                majority_signal = EXCLUDED.majority_signal,
                components = EXCLUDED.components,
                score_drivers = EXCLUDED.score_drivers,
                index_trend = EXCLUDED.index_trend,
                signal_quality = EXCLUDED.signal_quality,
                interpretation_context = EXCLUDED.interpretation_context,
                metadata_snapshot = EXCLUDED.metadata_snapshot,
                origin = 'observed',
                coverage_note = NULL,
                updated_at = NOW()
        `;

        const previous = previousRows[0];
        const delta = previous ? signal.composite_score - Number(previous.composite_score) : null;
        const previousContributions = previous
            ? parseStoredComponentContributions(previous.components)
                ?? parseStoredDriverContributions(previous.score_drivers)
            : null;
        const driverChangesAvailable = previous !== undefined && previousContributions !== null;
        const driverChanges = driverChangesAvailable
            ? calculateDriverChanges(signal.metadata.score_drivers ?? [], previousContributions)
            : [];
        const history = [
            { snapshot_date: today, composite_score: signal.composite_score, tier: signal.tier },
            ...historyBefore.filter(row => row.snapshot_date !== today)
        ].slice(0, 90);

        return {
            scoreDelta: {
                previous_score: previous ? Number(previous.composite_score) : null,
                delta,
                previous_date: previous?.snapshot_date ?? null,
                snapshot_date: today,
                label: delta === null
                    ? 'Baseline snapshot logged today'
                    : delta === 0
                        ? `No change since ${previous.snapshot_date}`
                        : `${delta >= 0 ? '+' : ''}${delta} since ${previous.snapshot_date}`
            },
            driverChanges,
            driverChangesAvailable,
            history: history
                .reverse()
                .map(row => ({
                    date: row.snapshot_date,
                    score: Number(row.composite_score),
                    tier: row.tier,
                    origin: row.origin ?? 'observed',
                    coverage_note: row.coverage_note ?? null,
                }))
        };
    } catch (error) {
        console.error('Signal snapshot logging failed:', error);
        return null;
    }
}

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
export const getSmartSignal = async (market: MarketType = 'US', mode: 'standard' | 'contrarian' = 'standard', enableSocial: boolean = true) => {
    const fetchStart = Date.now();

    try {
        const marketData = await fetchRawMarketData(market, enableSocial, true);
        const aura = await getAuraAnalysis(marketData, market);

        const fetchDurationMs = Date.now() - fetchStart;

        // Assess data quality
        const hasNews = marketData.newsItems.length > 0;
        const hasVix = marketData.vixData.price > 0;
        const dataQuality = hasNews && hasVix ? 'GOOD' : (!hasVix ? 'DEGRADED' : 'LIMITED');

        // V2 INTEGRATION (Hybrid Phase)
        // -----------------------------
        // Fetch Phase 2 Institutional Data
        const institutionalRaw = (await getLatestInstitutionalData()).filter(entry =>
            !(entry.indicator_name === 'naaim' && marketData.naaimExposure)
        );

        // Normalize Institutional Scores (0-100)
        // Higher score = More Bullish/Greedy (Sell signal in contrarian logic)
        const normalizeInst = (name: string, val: number): number => {
            if (name === 'aaii') {
                // AAII Bullish %: 20% (Fear) to 50% (Greed)
                return Math.min(Math.max((val - 20) / (50 - 20) * 100, 0), 100);
            }
            if (name === 'naaim') {
                // NAAIM Exposure: 40% (Fear) to 90% (Greed)
                return normalizeNaaimExposure(val);
            }
            if (name === 'bofa') {
                // BofA SSI: Standardized score (placeholder range 50-60)
                return Math.min(Math.max((val - 50) / (60 - 50) * 100, 0), 100);
            }
            return 50;
        };

        const instIndicators: IndicatorData[] = institutionalRaw.map(entry => {
            const score = normalizeInst(entry.indicator_name, entry.value);
            return {
                name: entry.indicator_name,
                display_name: entry.indicator_name.toUpperCase(),
                value: entry.value,
                score: score,
                weight: 0,
                signal: getSignalFromScore(score),
                enabled: true,
                last_updated: entry.report_date
            };
        });

        // Construct IndicatorData for V2 calculator
        const vixIndicator: IndicatorData = {
            name: 'vix',
            display_name: market === 'MY' ? 'USD/MYR Volatility' : 'VIX Index',
            value: marketData.vixData.price,
            score: marketData.sentimentOutput.components.vixScore,
            weight: 0, // Will be calculated by V2
            signal: getSignalFromScore(marketData.sentimentOutput.components.vixScore),
            enabled: true,
            last_updated: new Date().toISOString()
        };

        const sourceName = market === 'MY' ? 'news' as const : 'social' as const;
        const sourceCounts = {
            reddit: marketData.redditPosts.length,
            stockTwits: marketData.stockTwits.length,
            news: marketData.newsItems.length,
        };
        const socialIndicator: IndicatorData = {
            name: sourceName,
            display_name: market === 'MY' ? 'News Sentiment' : 'Social Sentiment',
            value: marketData.combinedSentiment, // -1 to +1
            score: marketData.sentimentOutput.components.socialScore,
            weight: 0, // Will be calculated by V2
            signal: getSignalFromScore(marketData.sentimentOutput.components.socialScore),
            enabled: shouldEnableSourceIndicator(enableSocial, sourceName, sourceCounts),
            last_updated: new Date().toISOString(),
            metadata: {
                source_breakdown: market === 'MY'
                    ? { news: marketData.newsSentiment, reddit: marketData.redditSentiment }
                    : { reddit: marketData.redditSentiment, stocktwits: marketData.stockTwitsSentiment },
                cadence: 'Daily / tactical',
                horizon: '1-5 trading days',
                mode_note: market === 'MY'
                    ? 'News sentiment blends market news at 80% with Bursa-focused Reddit sentiment at 20%.'
                    : 'Social sentiment blends Reddit and StockTwits sentiment equally.'
            }
        };
        const putCallIndicator: IndicatorData | null = market === 'US' && marketData.putCallRatio
            ? {
                name: 'put_call',
                display_name: getIndicatorDisplayName('put_call'),
                value: marketData.putCallRatio.ratio,
                score: normalizePutCallRatio(marketData.putCallRatio.ratio),
                weight: 0,
                signal: getSignalFromScore(normalizePutCallRatio(marketData.putCallRatio.ratio)),
                enabled: true,
                last_updated: marketData.putCallRatio.reportDate,
                metadata: {
                    source_url: marketData.putCallRatio.sourceUrl,
                    cadence: 'Daily / tactical',
                    horizon: '1-5 trading days',
                    mode_note: 'Options positioning. High put/call can indicate fear or hedging; low put/call can indicate complacency.'
                }
            }
            : null;
        const naaimIndicator: IndicatorData | null = market === 'US' && marketData.naaimExposure
            ? {
                name: 'naaim',
                display_name: getIndicatorDisplayName('naaim'),
                value: marketData.naaimExposure.exposure,
                score: normalizeNaaimExposure(marketData.naaimExposure.exposure),
                weight: 0,
                signal: getSignalFromScore(normalizeNaaimExposure(marketData.naaimExposure.exposure)),
                enabled: true,
                last_updated: marketData.naaimExposure.reportDate,
                metadata: {
                    source_url: marketData.naaimExposure.sourceUrl,
                    cadence: 'Weekly / positioning',
                    horizon: '1-4 weeks',
                    mode_note: 'Weekly active-manager exposure. High exposure can confirm momentum but may also flag crowding in contrarian mode.'
                }
            }
            : null;

        const signalInputs = [
            vixIndicator,
            socialIndicator,
            ...(putCallIndicator ? [putCallIndicator] : []),
            ...(naaimIndicator ? [naaimIndicator] : []),
            ...instIndicators
        ];
        const v2Signal = calculateCompositeScoreV2(signalInputs, { market, mode });
        v2Signal.metadata.counterfactuals = {
            source_toggle: buildSourceToggleCounterfactual(signalInputs, sourceName, socialIndicator.display_name, { market, mode }, enableSocial, marketData)
        };

        // Populate stock data in metadata
        v2Signal.metadata.stocks = market === 'US'
            ? marketData.popularStocks.slice(0, 10).map(s => ({
                symbol: s.symbol,
                price: s.price,
                change: s.change,
                changePercent: s.changePercent
            }))
            : marketData.activeStocks.slice(0, 10).map(s => ({
                symbol: s.symbol,
                price: s.price,
                change: s.change,
                changePercent: s.changePercent
            }));
        if (marketData.buffettIndicator) {
            v2Signal.metadata.valuation_backdrop = {
                name: 'Buffett Indicator',
                ratio_pct: marketData.buffettIndicator.ratioPct,
                market_value_billions: marketData.buffettIndicator.marketValueBillions,
                gdp_billions: marketData.buffettIndicator.gdpBillions,
                report_date: marketData.buffettIndicator.reportDate,
                label: marketData.buffettIndicator.label,
                detail: marketData.buffettIndicator.detail,
                source_url: marketData.buffettIndicator.sourceUrl,
            };
        }
        v2Signal.metadata.market_context = marketData.marketContext;

        // Populate article data from news and reddit
        const oneMonthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days in milliseconds

        const articlesData = enableSocial ? [
            ...marketData.newsItems
                .filter(n => {
                    if (!n.pubDate) return true; // Include if no date
                    const newsDate = new Date(n.pubDate).getTime();
                    return newsDate >= oneMonthAgo;
                })
                .slice(0, 5)
                .map(n => ({
                    title: n.title,
                    source: n.source || 'News',
                    url: n.link,
                    pubDate: n.pubDate,
                    sentiment: undefined as 'bullish' | 'bearish' | 'neutral' | undefined
                })),
            ...marketData.redditPosts
                .filter(p => (p.created_utc * 1000) >= oneMonthAgo) // Only posts from last 30 days
                .slice(0, 5)
                .map(p => ({
                    title: p.title,
                    source: p.subreddit,
                    url: `https://reddit.com${p.permalink}`,
                    pubDate: new Date(p.created_utc * 1000).toISOString(),
                    sentiment: undefined as 'bullish' | 'bearish' | 'neutral' | undefined
                }))
        ] : [];

        v2Signal.metadata.articles = articlesData;
        v2Signal.metadata.index_trend = marketData.marketIndices.map(index => ({
            symbol: index.symbol,
            price: index.price,
            changePercent: index.changePercent,
            trend: index.changePercent > 0.15 ? 'positive' : index.changePercent < -0.15 ? 'negative' : 'flat'
        }));

        const componentEntries = Object.values(v2Signal.components);
        const staleComponents = componentEntries.filter(component => {
            const updatedAt = new Date(component.last_updated).getTime();
            if (Number.isNaN(updatedAt)) return true;
            const ageDays = (Date.now() - updatedAt) / (24 * 60 * 60 * 1000);
            return ageDays > 14;
        });

        const freshness = staleComponents.length === 0
            ? 'fresh'
            : staleComponents.length === componentEntries.length ? 'stale' : 'mixed';

        const sourceCoverage = componentEntries.length >= 4
            ? 'strong'
            : componentEntries.length >= 3 ? 'moderate' : 'limited';

        const socialAbs = Math.abs(marketData.combinedSentiment);
        const socialVolume = marketData.redditPosts.length + marketData.stockTwits.length;
        const noiseLevel = !enableSocial || socialVolume === 0
            ? 'low'
            : socialAbs > 0.75 || socialVolume < 5 ? 'elevated' : 'moderate';

        const positiveIndexCount = marketData.marketIndices.filter(index => index.changePercent > 0).length;
        const negativeIndexCount = marketData.marketIndices.filter(index => index.changePercent < 0).length;
        const marketRegime = marketData.vixData.price >= 30
            ? 'High-Volatility Stress'
            : v2Signal.composite_score >= 65 && positiveIndexCount >= negativeIndexCount
                ? 'Risk-On Momentum'
                : v2Signal.composite_score <= 35 && negativeIndexCount > positiveIndexCount
                    ? 'Risk-Off Negative'
                    : 'Mixed / Neutral';

        const qualityWarnings = [
            ...staleComponents.map(component => `${component.display_name} data is stale (${component.last_updated}).`),
            ...(sourceCoverage === 'limited' ? ['Source coverage is limited; treat signal alignment as directional only.'] : []),
            ...(noiseLevel === 'elevated' ? ['Social signal is elevated or sparse; retail sentiment may be noisy.'] : []),
            ...(marketData.marketIndices.length === 0 ? ['Index trend data is unavailable for this market.'] : [])
        ];

        const majoritySignal = v2Signal.confidence.majority_signal;
        const getComponentAction = (signal: string) => {
            if (signal === 'strong-buy' || signal === 'buy') return 'BUY';
            if (signal === 'strong-sell' || signal === 'sell') return 'SELL';
            return 'NEUTRAL';
        };
        const readAction = getComponentAction(v2Signal.tier);
        const agreeingSignals = componentEntries
            .filter(component => getComponentAction(component.signal) === majoritySignal)
            .map(component => component.display_name);
        const conflictingSignals = componentEntries
            .filter(component => getComponentAction(component.signal) !== majoritySignal)
            .map(component => component.display_name);
        const breadthAction = positiveIndexCount > negativeIndexCount
            ? 'BUY'
            : negativeIndexCount > positiveIndexCount ? 'SELL' : 'NEUTRAL';
        const breadthConflicts = breadthAction !== 'NEUTRAL' && breadthAction !== majoritySignal;
        const aaiiComponent = componentEntries.find(component => component.name === 'aaii');
        const aaiiNote = aaiiComponent
            ? mode === 'contrarian'
                ? `AAII is read contrarian in this mode: ${aaiiComponent.value.toFixed(1)}% bullish is treated as ${aaiiComponent.score >= 65 ? 'crowding risk' : aaiiComponent.score <= 35 ? 'fear/opportunity context' : 'neutral sentiment context'}. Survey date: ${aaiiComponent.last_updated}.`
                : `AAII is read as momentum confirmation in this mode, but extreme bullishness can still signal crowding. Latest bullish reading: ${aaiiComponent.value.toFixed(1)}% on ${aaiiComponent.last_updated}.`
            : undefined;
        const disagreementNote = conflictingSignals.length > 0
            ? `${conflictingSignals.join(', ')} ${conflictingSignals.length === 1 ? 'does' : 'do'} not align with the majority ${majoritySignal} read.`
            : breadthConflicts
                ? `Index breadth points ${breadthAction.toLowerCase()} while the component majority is ${majoritySignal.toLowerCase()}.`
                : undefined;
        const breadthNote = marketData.marketIndices.length > 0
            ? `${positiveIndexCount} of ${marketData.marketIndices.length} tracked indexes ${positiveIndexCount === 1 ? 'is' : 'are'} positive and ${negativeIndexCount} ${negativeIndexCount === 1 ? 'is' : 'are'} negative as of this request.`
            : undefined;

        v2Signal.metadata.signal_quality = {
            freshness,
            source_coverage: sourceCoverage,
            noise_level: noiseLevel,
            market_regime: marketRegime,
            warnings: [
                ...qualityWarnings,
                ...(disagreementNote ? [disagreementNote] : [])
            ],
            confidence_explanation: v2Signal.confidence.cap_reason
                ? `Signal alignment measures indicator agreement, not forecast accuracy. ${v2Signal.confidence.cap_reason}`
                : 'Signal alignment measures indicator agreement, not forecast accuracy.'
        };

        v2Signal.metadata.score_drivers = componentEntries
            .map(component => {
                const componentAction = getComponentAction(component.signal);
                const impact = componentAction === 'NEUTRAL' || readAction === 'NEUTRAL'
                    ? 'neutral' as const
                    : componentAction === readAction ? 'positive' as const : 'negative' as const;

                return {
                    key: component.name,
                    name: component.display_name,
                    impact,
                    contribution: component.score * component.weight,
                    score: component.score,
                    weight: component.weight,
                    raw_value: component.value,
                    last_updated: component.last_updated,
                    detail: `${component.score.toFixed(0)} score at ${(component.weight * 100).toFixed(0)}% weight`,
                    mode_note: component.metadata?.mode_note ?? (component.name === 'aaii' ? aaiiNote : undefined)
                };
            })
            .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

        v2Signal.metadata.interpretation_context = {
            regime: marketRegime,
            agreeing_signals: agreeingSignals,
            conflicting_signals: conflictingSignals,
            disagreement_note: disagreementNote,
            limitation: v2Signal.confidence.cap_reason
                ? `${v2Signal.confidence.cap_reason} Signal alignment reflects indicator agreement only; it is not a probability forecast or trading advice.`
                : 'Signal alignment reflects indicator agreement only; it is not a probability forecast or trading advice.',
            mode_note: mode === 'standard'
                ? 'Standard mode reads high scores as momentum/trend confirmation.'
                : 'Contrarian mode reads high scores as crowding risk and low scores as fear/opportunity context.',
            aaii_note: aaiiNote,
            article_feed_role: 'Context feed; articles are not individually weighted as score components.',
            breadth_note: breadthNote
        };

        v2Signal.metadata.trend_context = {
            score_trend: 'Not tracked yet',
            last_signal_change: 'Not tracked yet',
            note: 'Historical score snapshots are needed before this dashboard can show signal changes and hit-rate evidence.'
        };

        const snapshotState = await persistSignalSnapshot(v2Signal, { market, mode, enableSocial });
        if (snapshotState) {
            v2Signal.metadata.score_delta = snapshotState.scoreDelta;
            v2Signal.metadata.score_history = snapshotState.history;
            v2Signal.metadata.driver_changes = snapshotState.driverChanges;
            v2Signal.metadata.driver_changes_available = snapshotState.driverChangesAvailable;
            v2Signal.metadata.trend_context = {
                score_trend: snapshotState.scoreDelta.label,
                last_signal_change: snapshotState.scoreDelta.previous_date
                    ? `Compared with ${snapshotState.scoreDelta.previous_date}`
                    : 'Baseline snapshot created',
                note: snapshotState.history.length > 1
                    ? `${snapshotState.history.length} daily snapshots are available for this market/mode.`
                    : 'Daily snapshot logging has started. Trend context will become more useful as history accumulates.'
            };
            try {
                v2Signal.metadata.historical_validation = await getMarketCalibration({ market, mode, enableSocial });
            } catch (error) {
                console.warn('Market calibration is temporarily unavailable:', error instanceof Error ? error.message : String(error));
            }
        }

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
            v2: v2Signal,
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

function getSignalFromScore(score: number): SignalTier {
    if (score < 20) return 'strong-buy';
    if (score < 40) return 'buy';
    if (score < 65) return 'neutral';
    if (score < 85) return 'sell';
    return 'strong-sell';
}

function buildSourceToggleCounterfactual(
    indicators: IndicatorData[],
    sourceName: 'social' | 'news',
    sourceLabel: string,
    config: { market: MarketType; mode: MarketMode },
    active: boolean,
    marketData: AggregateMarketData
): NonNullable<MarketSignal['metadata']['counterfactuals']>['source_toggle'] {
    const socialDataCount = getSourceIndicatorCount(sourceName, {
        reddit: marketData.redditPosts.length,
        stockTwits: marketData.stockTwits.length,
        news: marketData.newsItems.length,
    });

    if (socialDataCount === 0) {
        return {
            source: sourceName,
            source_label: sourceLabel,
            active,
            current_score: calculateCompositeScoreV2(indicators, config).composite_score,
            with_source_score: null,
            without_source_score: null,
            delta_without_source: null,
            summary: `${sourceLabel} comparison unavailable because no current source data was fetched.`,
            unavailable_reason: 'No current source data available.'
        };
    }

    const withSource = calculateCompositeScoreV2(
        indicators.map(indicator => indicator.name === sourceName ? { ...indicator, enabled: true } : indicator),
        config
    );
    const withoutSource = calculateCompositeScoreV2(
        indicators.map(indicator => indicator.name === sourceName ? { ...indicator, enabled: false } : indicator),
        config
    );
    const deltaWithoutSource = withoutSource.composite_score - withSource.composite_score;

    return {
        source: sourceName,
        source_label: sourceLabel,
        active,
        current_score: active ? withSource.composite_score : withoutSource.composite_score,
        with_source_score: withSource.composite_score,
        without_source_score: withoutSource.composite_score,
        delta_without_source: deltaWithoutSource,
        summary: `${sourceLabel} impact: ${withSource.composite_score} with source vs ${withoutSource.composite_score} without (${deltaWithoutSource >= 0 ? '+' : ''}${deltaWithoutSource}).`
    };
}
