export interface StockTwit {
    id: number;
    body: string;
    created_at: string;
    sentiment?: 'Bullish' | 'Bearish';
    symbols: Array<{
        id: number;
        symbol: string;
        title: string;
    }>;
    likes_count: number;
    reshares_count: number;
    user: {
        username: string;
        followers: number;
    };
}

interface StockTwitsApiMessage {
    id: number;
    body: string;
    created_at: string;
    entities?: {
        sentiment?: {
            basic?: 'Bullish' | 'Bearish';
        };
    };
    symbols?: StockTwit['symbols'];
    likes?: {
        total?: number;
    };
    reshares?: {
        reshared_count?: number;
    };
    user: {
        username: string;
        followers?: number;
    };
}

interface StockTwitsApiResponse {
    messages?: StockTwitsApiMessage[];
}

const mapStockTwit = (msg: StockTwitsApiMessage): StockTwit => ({
    id: msg.id,
    body: msg.body,
    created_at: msg.created_at,
    sentiment: msg.entities?.sentiment?.basic,
    symbols: msg.symbols || [],
    likes_count: msg.likes?.total || 0,
    reshares_count: msg.reshares?.reshared_count || 0,
    user: {
        username: msg.user.username,
        followers: msg.user.followers || 0
    }
});

/**
 * Fetch trending market posts from StockTwits
 * No authentication required for public streams
 * Rate limit: 200 calls/hour
 */
export const fetchTrendingTwits = async (limit = 10): Promise<StockTwit[]> => {
    try {
        const url = `https://api.stocktwits.com/api/2/streams/trending.json?limit=${limit}`;

        console.log(`Fetching StockTwits: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Signal/1.0.0',
                'Accept': 'application/json',
            },
            next: { revalidate: 0 }
        });

        console.log(`StockTwits response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`StockTwits API error ${response.status}:`, errorText);
            throw new Error(`StockTwits API error: ${response.status}`);
        }

        const data = await response.json() as StockTwitsApiResponse;

        if (!data?.messages) {
            console.error('Invalid StockTwits response structure');
            return [];
        }

        console.log(`Fetched ${data.messages.length} StockTwits posts`);

        return data.messages.map(mapStockTwit);
    } catch (error) {
        console.error('Error fetching StockTwits:', error);
        return [];
    }
};

/**
 * Fetch posts for a specific stock ticker
 */
export const fetchTickerTwits = async (ticker: string, limit = 10): Promise<StockTwit[]> => {
    try {
        const url = `https://api.stocktwits.com/api/2/streams/symbol/${ticker}.json?limit=${limit}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Signal/1.0.0',
                'Accept': 'application/json',
            },
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            throw new Error(`StockTwits API error: ${response.status}`);
        }

        const data = await response.json() as StockTwitsApiResponse;

        if (!data?.messages) {
            return [];
        }

        return data.messages.map(mapStockTwit);
    } catch (error) {
        console.error(`Error fetching StockTwits for ${ticker}:`, error);
        return [];
    }
};

/**
 * Calculate sentiment score from StockTwits posts
 * Returns a score between -1 (bearish) and 1 (bullish)
 */
export const calculateStockTwitsSentiment = (twits: StockTwit[]): number => {
    if (twits.length === 0) return 0;

    let bullishCount = 0;
    let bearishCount = 0;

    twits.forEach(twit => {
        if (twit.sentiment === 'Bullish') bullishCount++;
        if (twit.sentiment === 'Bearish') bearishCount++;
    });

    const total = bullishCount + bearishCount;
    if (total === 0) return 0;

    // Score: -1 (all bearish) to 1 (all bullish)
    return (bullishCount - bearishCount) / total;
};
