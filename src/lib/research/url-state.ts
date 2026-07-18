export type ResearchUrlChanges = Readonly<Record<string, string | null>>;

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
