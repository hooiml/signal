import type { ResearchMarket } from '../types/research';

export type SecuritySearchResult = {
    readonly symbol: string;
    readonly name: string;
    readonly market: ResearchMarket;
    readonly exchange: string;
    readonly instrumentType: 'EQUITY' | 'ETF';
    readonly sector: string | null;
    readonly industry: string | null;
};

const object = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, limit: number): string | null =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim() : null;
const usExchanges = new Set(['NMS', 'NGM', 'NCM', 'NYQ', 'ASE', 'PCX', 'BTS']);

export function validSecurityQuery(value: string): boolean {
    return value.trim().length >= 1 && value.length <= 80 && /^[\p{L}\p{N} .&'’(),-]+$/u.test(value);
}

/** Only return identities from explicitly supported exchanges; never infer market from a name. */
export function parseSecuritySearch(payload: unknown, market: ResearchMarket): SecuritySearchResult[] {
    const quotes = object(payload)?.quotes;
    if (!Array.isArray(quotes)) throw new Error('Search provider returned an invalid response.');
    const found = new Map<string, SecuritySearchResult>();
    for (const raw of quotes.slice(0, 50)) {
        const row = object(raw);
        if (!row || row.isYahooFinance === false) continue;
        const symbol = text(row.symbol, 15)?.toUpperCase();
        const name = text(row.longname, 180) ?? text(row.shortname, 180);
        const exchangeCode = text(row.exchange, 12);
        const type = row.quoteType;
        if (!symbol || !/^[A-Z0-9.-]{1,15}$/.test(symbol) || !name || !exchangeCode || (type !== 'EQUITY' && type !== 'ETF')) continue;
        const identifiedMarket = exchangeCode === 'KLS' && symbol.endsWith('.KL') ? 'MY'
            : usExchanges.has(exchangeCode) && !symbol.endsWith('.KL') ? 'US' : null;
        if (identifiedMarket !== market) continue;
        const exchange = text(row.exchDisp, 80) ?? exchangeCode;
        found.set(symbol, { symbol, name, market, exchange, instrumentType: type, sector: text(row.sector, 80), industry: text(row.industry, 120) });
        if (found.size === 8) break;
    }
    return [...found.values()];
}

export function parseSecuritySearchResponse(payload: unknown, market: ResearchMarket): SecuritySearchResult[] {
    const root = object(payload);
    if (root?.success !== true || !Array.isArray(root.data) || root.data.length > 8) throw new Error('Search response is unavailable.');
    return root.data.map((raw: unknown) => {
        const row = object(raw);
        if (!row || !text(row.symbol, 15) || !/^[A-Z0-9.-]{1,15}$/.test(String(row.symbol))
            || !text(row.name, 180) || !text(row.exchange, 80) || row.market !== market
            || (row.instrumentType !== 'EQUITY' && row.instrumentType !== 'ETF')
            || (row.sector !== null && !text(row.sector, 80)) || (row.industry !== null && !text(row.industry, 120))) throw new Error('Search response is invalid.');
        return row as unknown as SecuritySearchResult;
    });
}

export async function searchSecurities(query: string, market: ResearchMarket): Promise<SecuritySearchResult[]> {
    if (!validSecurityQuery(query)) throw new Error('Enter a company name or ticker (up to 80 characters).');
    const params = new URLSearchParams({ q: query.trim(), quotesCount: '20', newsCount: '0', enableFuzzyQuery: 'false' });
    const response = await fetch(`https://query1.finance.yahoo.com/v1/finance/search?${params}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 Signal research dashboard' },
        cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error('Security search is temporarily unavailable.');
    const body = await response.text();
    if (body.length > 512_000) throw new Error('Search response is too large.');
    return parseSecuritySearch(JSON.parse(body), market);
}
