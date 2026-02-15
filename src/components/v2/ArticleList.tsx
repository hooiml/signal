'use client';

import React from 'react';

interface ArticleCardProps {
    articles: Array<{
        title: string;
        source: string;
        url?: string;
        pubDate?: string;
        sentiment?: 'bullish' | 'bearish' | 'neutral';
    }>;
    market: 'US' | 'MY';
}

export const ArticleList = ({ articles, market }: ArticleCardProps) => {
    if (!articles || articles.length === 0) {
        return null;
    }

    const getSentimentColor = (sentiment?: string) => {
        if (sentiment === 'bullish') return 'text-emerald-400 bg-emerald-500/10';
        if (sentiment === 'bearish') return 'text-rose-400 bg-rose-500/10';
        return 'text-slate-400 bg-slate-500/10';
    };

    const getSentimentLabel = (sentiment?: string) => {
        if (sentiment === 'bullish') return '📈 Bull';
        if (sentiment === 'bearish') return '📉 Bear';
        return '⚖️ Neutral';
    };

    return (
        <div className="w-full mt-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    Articles in Sentiment Calculation
                </h3>
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                    {market === 'US' ? 'Reddit + StockTwits' : 'News + Reddit'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {articles.slice(0, 10).map((article, index) => (
                    <a
                        key={index}
                        href={article.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-blue-500/20 transition-all"
                    >
                        <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs text-slate-200 font-medium leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors">
                                    {article.title}
                                </h4>
                                {article.sentiment && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${getSentimentColor(article.sentiment)}`}>
                                        {getSentimentLabel(article.sentiment)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                                <span className="font-medium">{article.source}</span>
                                {article.pubDate && (
                                    <span>{new Date(article.pubDate).toLocaleDateString()}</span>
                                )}
                            </div>
                        </div>
                    </a>
                ))}
            </div>
        </div>
    );
};
