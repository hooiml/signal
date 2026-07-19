import { get as httpsGet } from 'node:https';

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

const STOCKTWITS_REQUEST_TIMEOUT_MS = 10_000;
const STOCKTWITS_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const STOCKTWITS_MAX_ATTEMPTS = 3;
const STOCKTWITS_HEADERS = {
    'User-Agent': 'Signal/1.0.0',
    'Accept': 'application/json',
};

class StockTwitsRequestError extends Error {
    constructor(message: string, readonly retryable = false) {
        super(message);
        this.name = 'StockTwitsRequestError';
    }
}

function requestStockTwitsApiOnce(url: string): Promise<StockTwitsApiResponse> {
    return new Promise((resolve, reject) => {
        let settled = false;

        const fail = (error: Error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };

        const request = httpsGet(url, { headers: STOCKTWITS_HEADERS }, response => {
            const chunks: Buffer[] = [];
            let responseBytes = 0;

            response.on('data', (chunk: Buffer) => {
                responseBytes += chunk.length;

                if (responseBytes > STOCKTWITS_MAX_RESPONSE_BYTES) {
                    response.destroy();
                    fail(new Error('StockTwits API response exceeded the size limit'));
                    return;
                }

                chunks.push(chunk);
            });

            response.on('end', () => {
                if (settled) return;

                const status = response.statusCode ?? 0;
                const body = Buffer.concat(chunks).toString('utf8');

                if (status < 200 || status >= 300) {
                    const isCloudflareChallenge = status === 403 && (
                        body.includes('challenges.cloudflare.com') ||
                        body.includes('<title>Just a moment...</title>')
                    );
                    fail(new StockTwitsRequestError(
                        isCloudflareChallenge
                            ? 'StockTwits request blocked by a Cloudflare challenge (403)'
                            : `StockTwits API error: ${status}`,
                        isCloudflareChallenge
                    ));
                    return;
                }

                try {
                    const data = JSON.parse(body) as StockTwitsApiResponse;
                    settled = true;
                    resolve(data);
                } catch {
                    fail(new Error('StockTwits API returned invalid JSON'));
                }
            });

            response.on('error', fail);
        });

        request.setTimeout(STOCKTWITS_REQUEST_TIMEOUT_MS, () => {
            request.destroy(new Error('StockTwits API request timed out'));
        });
        request.on('error', fail);
    });
}

async function requestStockTwitsApi(url: string): Promise<StockTwitsApiResponse> {
    for (let attempt = 1; attempt <= STOCKTWITS_MAX_ATTEMPTS; attempt++) {
        try {
            return await requestStockTwitsApiOnce(url);
        } catch (error) {
            const shouldRetry = error instanceof StockTwitsRequestError && error.retryable;

            if (!shouldRetry || attempt === STOCKTWITS_MAX_ATTEMPTS) {
                throw error;
            }

            await new Promise(resolve => setTimeout(resolve, attempt * 150));
        }
    }

    throw new Error('StockTwits API request failed');
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

        const data = await requestStockTwitsApi(url);

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

        const data = await requestStockTwitsApi(url);

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
