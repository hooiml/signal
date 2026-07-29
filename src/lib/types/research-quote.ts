import type { ResearchMarket } from './research';
import type { ResearchSnapshot } from './research-snapshot';

export type ResearchQuoteRequest = {
    readonly symbol: string;
    readonly market: ResearchMarket;
};

export type ResearchQuoteData = ResearchQuoteRequest & {
    readonly providerSymbol: string;
    readonly fetchedAt: string;
    readonly quote: ResearchSnapshot['quote'];
};

export type ResearchQuoteBatchResult =
    | {
        readonly success: true;
        readonly data: ResearchQuoteData;
    }
    | {
        readonly success: false;
        readonly symbol: string;
        readonly market: ResearchMarket;
        readonly error: string;
    };
