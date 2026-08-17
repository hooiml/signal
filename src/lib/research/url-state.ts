import type { ResearchLayoutDensity, SavedResearchLayout } from './saved-layouts';

export type ResearchUrlChanges = Readonly<Record<string, string | null>>;
export type ResearchUrlMarket = SavedResearchLayout['market'];
export type ResearchUrlDecision = SavedResearchLayout['action'];

const researchUrlMarkets: readonly ResearchUrlMarket[] = ['ALL', 'US', 'MY'];
const researchUrlDecisions: readonly ResearchUrlDecision[] = ['ALL', 'Ready', 'DCA', 'Wait for price', 'Watch', 'Avoid'];
const researchUrlDensities: readonly ResearchLayoutDensity[] = ['comfortable', 'compact'];

const parseEnum = <T extends string>(value: string | null, options: readonly T[], fallback: T): T =>
    value !== null && options.some((option) => option === value) ? value as T : fallback;

export const parseResearchUrlQuery = (value: string | null): string =>
    value !== null && value.length <= 80 && !/[\u0000-\u001f\u007f]/.test(value) ? value : '';

export const parseResearchUrlMarket = (value: string | null): ResearchUrlMarket =>
    parseEnum(value, researchUrlMarkets, 'ALL');

export const parseResearchUrlDecision = (value: string | null): ResearchUrlDecision =>
    parseEnum(value, researchUrlDecisions, 'ALL');

export const parseResearchUrlDensity = (value: string | null): ResearchLayoutDensity | null =>
    value !== null && researchUrlDensities.some((density) => density === value) ? value as ResearchLayoutDensity : null;

export const resolveVisibleResearchSymbol = (
    items: readonly { readonly symbol: string }[],
    requestedSymbol: string,
): string | null => items.some((item) => item.symbol === requestedSymbol)
    ? requestedSymbol
    : items[0]?.symbol ?? null;

export const mergeResearchSearchParams = (
    current: URLSearchParams,
    changes: ResearchUrlChanges,
): URLSearchParams => {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
    }
    return next;
};

export const buildResearchRelativeUrl = (
    pathname: string,
    searchParams: URLSearchParams,
    hash = '',
): string => {
    const search = searchParams.toString();
    return pathname + (search ? `?${search}` : '') + hash;
};
