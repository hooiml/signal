'use client';

import React from 'react';
import { SignalTier } from '@/lib/types/signal-v2';
import { CockpitTheme, formatDateLabel, getSignalAction, getThemeClasses } from './cockpit-utils';

interface ArticleCardProps {
    articles: Array<{
        title: string;
        source: string;
        url?: string;
        pubDate?: string;
        sentiment?: 'bullish' | 'bearish' | 'neutral';
    }>;
    market: 'US' | 'MY';
    compositeTier: SignalTier;
    theme: CockpitTheme;
}

export const ArticleList = ({ articles, market, compositeTier, theme }: ArticleCardProps) => {
    const themeClasses = getThemeClasses(theme);
    if (!articles || articles.length === 0) {
        return null;
    }

    const compositeAction = getSignalAction(compositeTier);

    return (
        <section className={`rounded-3xl border p-5 ${themeClasses.panel}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Latest developments</div>
                    <h2 className={`mt-2 text-2xl font-semibold ${themeClasses.textPrimary}`}>Recent context tied to the current read</h2>
                    <p className={`mt-1 text-sm leading-6 ${themeClasses.textMuted}`}>
                        Context only. Feed items appear only when signal-relevant and are not individually weighted in the composite score.
                    </p>
                </div>
                <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${themeClasses.textSubtle}`}>
                    {market === 'US' ? 'US context feed' : 'MY context feed'}
                </span>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
                {articles.slice(0, 3).map((article, index) => {
                    const tag = getArticleTag(article.sentiment, compositeAction, theme);
                    const content = (
                        <div className={`flex h-full flex-col gap-3 rounded-2xl border p-4 transition hover:border-slate-400/60 ${themeClasses.panelSoft}`}>
                            <div className="flex items-start justify-between gap-3">
                                <h3 className={`text-base font-semibold leading-7 ${themeClasses.textPrimary}`}>{article.title}</h3>
                                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tag.tone}`}>
                                    {tag.label}
                                </span>
                            </div>
                            <div className={`grid gap-2 rounded-xl border px-3 py-2 text-xs ${themeClasses.panelMuted} ${themeClasses.textMuted}`}>
                                <span><span className={`font-semibold ${themeClasses.textSecondary}`}>Signal impact:</span> {tag.impact}</span>
                                <span><span className={`font-semibold ${themeClasses.textSecondary}`}>Affected driver:</span> {market === 'MY' ? 'news context' : 'sentiment context'}</span>
                            </div>
                            <div className={`mt-auto flex items-center justify-between gap-3 text-sm ${themeClasses.textMuted}`}>
                                <span>{article.source}</span>
                                <span>{formatDateLabel(article.pubDate, true)}</span>
                            </div>
                        </div>
                    );

                    return article.url ? (
                        <a key={`${article.title}-${index}`} href={article.url} target="_blank" rel="noopener noreferrer">
                            {content}
                        </a>
                    ) : (
                        <div key={`${article.title}-${index}`}>{content}</div>
                    );
                })}
            </div>
        </section>
    );
};

function getArticleTag(sentiment: 'bullish' | 'bearish' | 'neutral' | undefined, compositeAction: ReturnType<typeof getSignalAction>, theme: CockpitTheme) {
    if (!sentiment || sentiment === 'neutral' || compositeAction === 'NEUTRAL') {
        return {
            label: 'Context',
            impact: 'neutral',
            tone: theme === 'light' ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-slate-700 bg-slate-900/70 text-slate-300',
        };
    }

    const supports = (compositeAction === 'BUY' && sentiment === 'bullish') || (compositeAction === 'SELL' && sentiment === 'bearish');

    if (supports) {
        return {
            label: 'Supports',
            impact: 'supports',
            tone: theme === 'light' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
        };
    }

    return {
        label: 'Opposes',
        impact: 'opposes',
        tone: theme === 'light' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/40 bg-rose-500/10 text-rose-200',
    };
}

