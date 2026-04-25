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
        if (sentiment === 'bullish') return 'text-emerald-800 bg-emerald-50 border border-emerald-200';
        if (sentiment === 'bearish') return 'text-rose-800 bg-rose-50 border border-rose-200';
        return 'text-slate-700 bg-slate-100 border border-slate-200';
    };

    const getSentimentLabel = (sentiment?: string) => {
        if (sentiment === 'bullish') return 'Bullish';
        if (sentiment === 'bearish') return 'Bearish';
        return 'Neutral';
    };

    return (
        <div className="w-full mt-6">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">
                        Market Context Feed
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                        Context only. These cards are not individually weighted in the composite score.
                    </p>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {market === 'US' ? 'News + Reddit context' : 'News + Reddit context'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {articles.slice(0, 10).map((article, index) => (
                    <a
                        key={index}
                        href={article.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-3 rounded-lg border border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md transition-all shadow-sm"
                    >
                        <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm text-slate-800 font-medium leading-snug line-clamp-2 group-hover:text-blue-700 transition-colors">
                                    {article.title}
                                </h4>
                                {article.sentiment && (
                                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${getSentimentColor(article.sentiment)}`}>
                                        {getSentimentLabel(article.sentiment)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
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
