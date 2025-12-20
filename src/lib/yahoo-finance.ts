export interface MarketData {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    fiftyTwoWeekChangePercent: number;
    timestamp: Date;
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
    // Yahoo's chart API is per-symbol, so we fetch in parallel
    const promises = symbols.map(s => fetchMarketIndex(s).catch(e => {
        console.error(`Failed to fetch ${s}:`, e);
        return null;
    }));

    const results = await Promise.all(promises);
    return results.filter((r): r is MarketData => r !== null);
};
