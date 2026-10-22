import Parser from 'rss-parser';

export interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet?: string;
    source: string;
}

const parser = new Parser();
const myParser = new Parser({ timeout: 8_000 });

const US_FEEDS = [
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', source: 'CNBC Finance' }
];

const MY_FEEDS = [
    { url: 'https://news.google.com/rss/search?q=business+finance+malaysia+when%3A1d&hl=en-MY&gl=MY&ceid=MY:en', source: 'Google News (MY)' }
];

const NEWS_ITEM_LIMIT = 12;

/** Validate, deduplicate and order a feed before limiting the retained items. */
export function normalizeNewsItems(items: readonly NewsItem[], limit = NEWS_ITEM_LIMIT, now = Date.now()): NewsItem[] {
    const unique = new Map<string, NewsItem>();
    const keysByUrl = new Map<string, string>();
    const keysByTitle = new Map<string, string>();

    for (const item of items) {
        if (!item || typeof item.title !== 'string') continue;
        const title = item.title.trim();
        if (!title) continue;

        const titleKey = title.toLowerCase().replace(/\s+/g, ' ');
        let link = typeof item.link === 'string' ? item.link.trim() : '';
        try {
            const url = new URL(link);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') link = '';
            else {
                url.hash = '';
                for (const key of [...url.searchParams.keys()]) {
                    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
                }
                link = url.toString();
            }
        } catch {
            link = '';
        }

        const pubDate = typeof item.pubDate === 'string' ? item.pubDate : '';
        const normalized = { ...item, title, link, pubDate };
        const key = (link ? keysByUrl.get(link) : undefined) ?? keysByTitle.get(titleKey) ?? `item:${unique.size}`;
        const existing = unique.get(key);
        const nextDate = Date.parse(normalized.pubDate);
        const existingDate = existing ? Date.parse(existing.pubDate) : Number.NaN;
        const nextRank = !Number.isFinite(nextDate) ? 2 : nextDate > now ? 1 : 0;
        const existingRank = !Number.isFinite(existingDate) ? 2 : existingDate > now ? 1 : 0;
        if (!existing || nextRank < existingRank || (nextRank === existingRank && nextDate > existingDate)) {
            unique.set(key, normalized);
        }
        if (link) keysByUrl.set(link, key);
        keysByTitle.set(titleKey, key);
    }

    return [...unique.values()]
        .sort((left, right) => {
            const leftDate = Date.parse(left.pubDate);
            const rightDate = Date.parse(right.pubDate);
            const leftValid = Number.isFinite(leftDate);
            const rightValid = Number.isFinite(rightDate);
            const leftRank = !leftValid ? 2 : leftDate > now ? 1 : 0;
            const rightRank = !rightValid ? 2 : rightDate > now ? 1 : 0;
            if (leftRank !== rightRank) return leftRank - rightRank;
            return leftValid ? rightDate - leftDate : 0;
        })
        .slice(0, Math.max(0, limit));
}

export const fetchMarketNews = async (market: 'US' | 'MY'): Promise<NewsItem[]> => {
    const feeds = market === 'US' ? US_FEEDS : MY_FEEDS;

    const promises = feeds.map(async (feed) => {
        try {
            const feedData = await (market === 'MY' ? myParser : parser).parseURL(feed.url);
            const items = (market === 'MY' ? feedData.items : feedData.items.slice(0, NEWS_ITEM_LIMIT)).map(item => ({
                title: item.title || '',
                link: item.link || '',
                pubDate: item.pubDate || '',
                contentSnippet: item.contentSnippet,
                source: feed.source
            }));
            return market === 'MY' ? normalizeNewsItems(items) : items;
        } catch (error) {
            console.error(`Error fetching RSS ${feed.source}:`, error);
            return [];
        }
    });

    const results = await Promise.all(promises);
    return market === 'MY'
        ? results.flat()
        : results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
};
