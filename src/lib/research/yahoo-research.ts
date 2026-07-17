import type { ResearchMarket } from '../types/research';
import type { ResearchChartPoint } from '../types/research-snapshot';
import { calculateTechnicals, type TechnicalSnapshot } from './technicals';
import { calculateTechnicalSeries } from './technical-series';

export type YahooResearchResult = {
    readonly name: string | null;
    readonly currency: string | null;
    readonly price: number | null;
    readonly dailyChangePercent: number | null;
    readonly technicals: TechnicalSnapshot;
    readonly chart: {
        readonly interval: '1d';
        readonly points: readonly ResearchChartPoint[];
    };
    readonly history: {
        readonly closes: readonly number[];
        readonly adjustedCloses: readonly number[];
        readonly volumes: readonly number[];
    };
};

export type YahooQuoteResult = Pick<YahooResearchResult, 'name' | 'currency' | 'price' | 'dailyChangePercent'>;

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const numberValue = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const stringValue = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const numericArray = (value: unknown): number[] => Array.isArray(value) ? value.filter((item): item is number => numberValue(item) !== null) : [];
const rawArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

const chartPoints = (result: Record<string, unknown>, quote: Record<string, unknown>): readonly ResearchChartPoint[] => {
    const timestamps = rawArray(result.timestamp);
    const opens = rawArray(quote.open);
    const highs = rawArray(quote.high);
    const lows = rawArray(quote.low);
    const closes = rawArray(quote.close);
    const volumes = rawArray(quote.volume);
    const rows = timestamps.flatMap((timestamp, index) => {
        const seconds = numberValue(timestamp);
        const open = numberValue(opens[index]);
        const high = numberValue(highs[index]);
        const low = numberValue(lows[index]);
        const close = numberValue(closes[index]);
        if (seconds === null || open === null || high === null || low === null || close === null) return [];
        return [{
            time: new Date(seconds * 1_000).toISOString().slice(0, 10),
            open,
            high,
            low,
            close,
            volume: numberValue(volumes[index]),
        }];
    });
    const indicators = calculateTechnicalSeries(rows);
    return rows.map((row, index) => ({
        ...row,
        ...indicators[index],
    }));
};

const malaysiaYahooAliases: Readonly<Record<string, string>> = {
    MAYBANK: '1155.KL',
    KLCI: '^KLSE',
};

export const toYahooSymbol = (symbol: string, market: ResearchMarket) => {
    if (market !== 'MY') return symbol;
    return malaysiaYahooAliases[symbol.toUpperCase()] ?? `${symbol}.KL`;
};

export const parseYahooResearchChart = (payload: unknown): YahooResearchResult => {
    const root = objectValue(payload);
    const chart = objectValue(root?.chart);
    const results = chart?.result;
    const result = Array.isArray(results) ? objectValue(results[0]) : null;
    const meta = objectValue(result?.meta);
    const indicators = objectValue(result?.indicators);
    const quoteEntries = indicators?.quote;
    const quote = Array.isArray(quoteEntries) ? objectValue(quoteEntries[0]) : null;
    const adjustedCloseEntries = indicators?.adjclose;
    const adjustedClose = Array.isArray(adjustedCloseEntries) ? objectValue(adjustedCloseEntries[0]) : null;
    if (!result || !meta || !quote) throw new Error('Yahoo Finance returned an invalid chart response.');

    const closes = numericArray(quote.close);
    const adjustedCloses = numericArray(adjustedClose?.adjclose);
    const points = chartPoints(result, quote);
    const price = numberValue(meta.regularMarketPrice) ?? closes.at(-1) ?? null;
    const previousClose = closes.at(-2) ?? null;
    const calculated = calculateTechnicals(closes, numericArray(quote.volume));
    const latest = points.at(-1);
    return {
        name: stringValue(meta.longName) ?? stringValue(meta.shortName) ?? stringValue(meta.symbol),
        currency: stringValue(meta.currency),
        price,
        dailyChangePercent: price === null || previousClose === null || previousClose === 0
            ? null
            : Number((((price - previousClose) / previousClose) * 100).toFixed(2)),
        technicals: {
            ...calculated,
            ma50: latest?.ma50 ?? calculated.ma50,
            ma200: latest?.ma200 ?? calculated.ma200,
            averageVolume20: latest?.averageVolume20 ?? calculated.averageVolume20,
            rsi14: latest?.rsi14 ?? calculated.rsi14,
            macd: latest?.macd ?? calculated.macd,
        },
        chart: { interval: '1d', points },
        history: { closes, adjustedCloses, volumes: numericArray(quote.volume) },
    };
};

const fetchYahooChart = async (providerSymbol: string, range: '5d' | '1y' | '5y') => {
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1d&range=${range}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 Signal research dashboard' },
        cache: 'force-cache',
    });
    if (!response.ok) throw new Error(`Yahoo Finance request failed (${response.status}).`);
    return response.json();
};

export const fetchYahooResearch = async (symbol: string, market: ResearchMarket): Promise<YahooResearchResult> => {
    const providerSymbol = toYahooSymbol(symbol, market);
    return parseYahooResearchChart(await fetchYahooChart(providerSymbol, '1y'));
};

export const fetchYahooResearchChart = async (symbol: string, market: ResearchMarket, range: '1y' | '5y') => {
    const providerSymbol = toYahooSymbol(symbol, market);
    return parseYahooResearchChart(await fetchYahooChart(providerSymbol, range)).chart;
};

export const fetchYahooQuote = async (symbol: string, market: ResearchMarket): Promise<YahooQuoteResult> => {
    const providerSymbol = toYahooSymbol(symbol, market);
    const { name, currency, price, dailyChangePercent } = parseYahooResearchChart(await fetchYahooChart(providerSymbol, '5d'));
    return { name, currency, price, dailyChangePercent };
};
