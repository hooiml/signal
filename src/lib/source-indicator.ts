type SourceIndicatorCounts = {
    readonly reddit: number;
    readonly stockTwits: number;
    readonly news: number;
};

export const getSourceIndicatorCount = (source: 'social' | 'news', counts: SourceIndicatorCounts) =>
    source === 'news' ? counts.news + counts.reddit : counts.reddit + counts.stockTwits;

export const shouldEnableSourceIndicator = (
    requested: boolean,
    source: 'social' | 'news',
    counts: SourceIndicatorCounts,
) => requested && getSourceIndicatorCount(source, counts) > 0;
