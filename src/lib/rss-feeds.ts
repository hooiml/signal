import Parser from 'rss-parser';

export interface NewsItem {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet?: string;
    source: string;
}

const parser = new Parser();

const US_FEEDS = [
    { url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories', source: 'MarketWatch' },
    { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664', source: 'CNBC Finance' }
];

const MY_FEEDS = [
    { url: 'https://www.thestar.com.my/rss/business/business-news', source: 'The Star' },
    { url: 'https://news.google.com/rss/search?q=business+finance+malaysia&hl=en-MY&gl=MY&ceid=MY:en', source: 'Google News (MY)' }
];

export const fetchMarketNews = async (market: 'US' | 'MY'): Promise<NewsItem[]> => {
    const feeds = market === 'US' ? US_FEEDS : MY_FEEDS;

    const promises = feeds.map(async (feed) => {
        try {
            const feedData = await parser.parseURL(feed.url);
            return feedData.items.slice(0, 12).map(item => ({
                title: item.title || '',
                link: item.link || '',
                pubDate: item.pubDate || '',
                contentSnippet: item.contentSnippet,
                source: feed.source
            }));
        } catch (error) {
            console.error(`Error fetching RSS ${feed.source}:`, error);
            return [];
        }
    });

    const results = await Promise.all(promises);
    return results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
};
