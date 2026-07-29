import type { ResearchQuoteBatchResult, ResearchQuoteData, ResearchQuoteRequest } from '../types/research-quote';
import { getResearchQuote } from './quote';

export const researchQuoteBatchLimits = {
    maxBodyBytes: 8_192,
    maxItems: 50,
    concurrency: 6,
} as const;

export class ResearchQuoteBatchInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchQuoteBatchInputError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseItem = (value: unknown): ResearchQuoteRequest => {
    if (!isRecord(value) || Object.keys(value).some((key) => key !== 'symbol' && key !== 'market')) {
        throw new ResearchQuoteBatchInputError('Invalid quote request item.');
    }
    const symbol = typeof value.symbol === 'string' ? value.symbol.trim().toUpperCase() : '';
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)) {
        throw new ResearchQuoteBatchInputError('Invalid quote symbol.');
    }
    if (value.market !== 'US' && value.market !== 'MY') {
        throw new ResearchQuoteBatchInputError('Invalid quote market.');
    }
    return { symbol, market: value.market };
};

export const parseResearchQuoteBatchRequest = (value: unknown): readonly ResearchQuoteRequest[] => {
    if (!Array.isArray(value) || value.length === 0 || value.length > researchQuoteBatchLimits.maxItems) {
        throw new ResearchQuoteBatchInputError('Provide between 1 and 50 quote requests.');
    }
    const requests = value.map(parseItem);
    const identities = requests.map((request) => `${request.market}:${request.symbol}`);
    if (new Set(identities).size !== identities.length) {
        throw new ResearchQuoteBatchInputError('Duplicate quote request.');
    }
    return requests;
};

export const getResearchQuoteBatch = async (
    requests: readonly ResearchQuoteRequest[],
    loadQuote: (symbol: string, market: ResearchQuoteRequest['market']) => Promise<ResearchQuoteData> = getResearchQuote,
): Promise<readonly ResearchQuoteBatchResult[]> => {
    const results: ResearchQuoteBatchResult[] = [];
    for (let start = 0; start < requests.length; start += researchQuoteBatchLimits.concurrency) {
        const batch = requests.slice(start, start + researchQuoteBatchLimits.concurrency);
        results.push(...await Promise.all(batch.map(async (request): Promise<ResearchQuoteBatchResult> => {
            try {
                return { success: true, data: await loadQuote(request.symbol, request.market) };
            } catch {
                return {
                    success: false,
                    symbol: request.symbol,
                    market: request.market,
                    error: 'Live quote unavailable.',
                };
            }
        })));
    }
    return results;
};
