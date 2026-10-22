type SourceIndicatorCounts = {
    readonly reddit: number;
    readonly stockTwits: number;
    readonly news: number;
};

export const MY_NEWS_ELIGIBILITY_VERSION = 1;
export const MY_NEWS_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;

type DatedNewsItem = { readonly pubDate: string };
type RedditEvidence = { readonly created_utc: number };

const isRecent = (timestamp: number, now: number) => Number.isFinite(timestamp)
    && timestamp <= now
    && now - timestamp <= MY_NEWS_FRESHNESS_WINDOW_MS;

export function getEligibleMyEvidence<T extends DatedNewsItem, R extends RedditEvidence>(
    news: readonly T[],
    reddit: readonly R[],
    now = Date.now(),
) {
    return {
        news: news.filter(item => isRecent(Date.parse(item.pubDate), now)),
        reddit: reddit.filter(post => isRecent(post.created_utc * 1000, now)),
    };
}

export const getSourceIndicatorCount = (source: 'social' | 'news', counts: SourceIndicatorCounts) =>
    source === 'news' ? counts.news + counts.reddit : counts.reddit + counts.stockTwits;

export const shouldEnableSourceIndicator = (
    requested: boolean,
    source: 'social' | 'news',
    counts: SourceIndicatorCounts,
) => requested && getSourceIndicatorCount(source, counts) > 0;
