export interface MarketData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    fiftyTwoWeekChangePercent: number;
    timestamp: Date;
    sparkline?: number[];
}

const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

export const fetchVIX = async (): Promise<MarketData> => {
    const response = await fetch(`${YAHOO_BASE_URL}/^VIX?interval=1d&range=1d`, {
        headers: { 'User-Agent': 'Signal/1.0' },
        next: { revalidate: 0 }
    });

    if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.chart.result[0].meta;
    const price = quote.regularMarketPrice || quote.chartPreviousClose || 0;
    const prevClose = quote.chartPreviousClose || quote.previousClose || price;

    let change = 0;
    let changePercent = 0;

    if (prevClose > 0 && price > 0) {
        change = price - prevClose;
        changePercent = (change / prevClose) * 100;
    }

    return {
        symbol: '^VIX',
        price,
        change,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || price,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow || price,
        fiftyTwoWeekChangePercent: 0, // Not relevant for VIX usually
        timestamp: new Date()
    };
};

export const fetchMarketIndex = async (symbol: string): Promise<MarketData> => {
    const response = await fetch(`${YAHOO_BASE_URL}/${symbol}?interval=1d&range=1d`, {
        headers: { 'User-Agent': 'Signal/1.0' },
        next: { revalidate: 0 }
    });

    if (!response.ok) {
        throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.chart.result[0].meta;
    const price = quote.regularMarketPrice || quote.chartPreviousClose || 0;
    const prevClose = quote.chartPreviousClose || quote.previousClose || price;

    let change = 0;
    let changePercent = 0;

    if (prevClose > 0 && price > 0) {
        change = price - prevClose;
        changePercent = (change / prevClose) * 100;
    }

    // 52-week data
    const yearHigh = quote.fiftyTwoWeekHigh || price;
    const yearLow = quote.fiftyTwoWeekLow || price;
    // Calculate simple position in range or gain from low
    // For "52 Week Gainers", we'll verify if Yahoo provides this or we derive it
    // quote.fiftyTwoWeekHigh is strictly the high price.
    // We'll calculate % distance from 52w LOW as a proxy for "Yearly Strength"
    const strength = yearLow > 0 ? ((price - yearLow) / yearLow) * 100 : 0;

    return {
        symbol,
        price,
        change,
        changePercent: isNaN(changePercent) ? 0 : changePercent,
        fiftyTwoWeekHigh: yearHigh,
        fiftyTwoWeekLow: yearLow,
        fiftyTwoWeekChangePercent: strength,
        timestamp: new Date()
    };
};

export const fetchQuotes = async (symbols: string[]): Promise<MarketData[]> => {
    if (symbols.length === 0) return [];

    // Use individual chart fetches (v8 endpoint) - more reliable than batch (v7)
    // The v7/finance/quote endpoint often returns 401 errors
    const promises = symbols.map(s => fetchMarketIndex(s).catch(() => null));
    const results = await Promise.all(promises);
    return results.filter((r): r is MarketData => r !== null);
};

export const fetchIndicesWithChart = async (symbols: string[]): Promise<MarketData[]> => {
    // We must fetch charts individually to get the intraday data points
    const promises = symbols.map(async (symbol): Promise<MarketData | null> => {
        try {
            // interval=15m for a smooth intraday curve (approx 26 points)
            const response = await fetch(`${YAHOO_BASE_URL}/${symbol}?interval=15m&range=1d`, {
                headers: { 'User-Agent': 'Signal/1.0' },
                next: { revalidate: 0 }
            });

            if (!response.ok) return null;

            const data = await response.json();
            const result = data.chart.result[0];
            const meta = result.meta;
            const quotes = result.indicators.quote[0].close || [];

            // Filter out nulls and take every Nth point if too many
            const points = quotes.filter((p: number | null) => p !== null) as number[];

            // Calculate change manually from chart data to be consistent
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose;
            const change = price - prevClose;
            const changePercent = (change / prevClose) * 100;

            return {
                symbol,
                price,
                change,
                changePercent,
                fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || price,
                fiftyTwoWeekLow: meta.fiftyTwoWeekLow || price,
                fiftyTwoWeekChangePercent: 0,
                timestamp: new Date(),
                sparkline: points
            };
        } catch (e) {
            console.error(`Failed to fetch chart for ${symbol}:`, e);
            return null;
        }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is MarketData => r !== null);
};
/**
 * Fetch historical data for a currency pair and calculate its 20-day rolling volatility
 * Used as a localized 'Fear Gauge' for Malaysia (USD/MYR)
 */
export const fetchHistoricalCurrencyVol = async (symbol: string): Promise<{ currentPrice: number, vol20d: number, change: number }> => {
    try {
        // Fetch 30 days of data to get at least 20 daily changes
        const response = await fetch(`${YAHOO_BASE_URL}/${symbol}?interval=1d&range=30d`, {
            headers: { 'User-Agent': 'Signal/1.0' },
            next: { revalidate: 3600 } // Volatility doesn't change every minute, cache for 1h
        });

        if (!response.ok) throw new Error(`Yahoo Finance API error: ${response.status}`);

        const data = await response.json();
        const result = data.chart.result[0];
        const quotes = result.indicators.quote[0].close || [];
        const validQuotes = quotes.filter((q: number | null) => q !== null) as number[];

        if (validQuotes.length < 2) return { currentPrice: 0, vol20d: 0, change: 0 };

        // 1. Calculate daily % changes
        const returns: number[] = [];
        for (let i = 1; i < validQuotes.length; i++) {
            const ret = (validQuotes[i] - validQuotes[i - 1]) / validQuotes[i - 1];
            returns.push(ret);
        }

        // 2. Take the last 20 daily returns
        const windowSize = 20;
        const recentReturns = returns.slice(-windowSize);

        // 3. Calculate Standard Deviation
        const mean = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
        const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
        const stdDev = Math.sqrt(variance);

        // 4. Return raw standard deviation (usually ~0.002 to 0.01 for FX)
        // We'll scale this later in the sentiment calculator to be comparable to VIX.
        const currentPrice = validQuotes[validQuotes.length - 1];
        const prevPrice = validQuotes[validQuotes.length - 2];

        return {
            currentPrice,
            vol20d: stdDev,
            change: currentPrice - prevPrice
        };
    } catch (e) {
        console.error(`Failed to fetch historical vol for ${symbol}:`, e);
        return { currentPrice: 0, vol20d: 0, change: 0 };
    }
};
