'use client';

import React from 'react';
import { MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, formatDateLabel, getThemeClasses } from './cockpit-utils';

interface SupportingContextProps {
    signal: MarketSignal;
    market: 'US' | 'MY';
    theme: CockpitTheme;
    hasDevelopments: boolean;
}

export const SupportingContext = ({ signal, market, theme, hasDevelopments }: SupportingContextProps) => {
    const themeClasses = getThemeClasses(theme);
    const trendContext = signal.metadata.trend_context;
    const interpretationContext = signal.metadata.interpretation_context;
    const indices = signal.metadata.index_trend || [];
    const stocks = signal.metadata.stocks || [];
    const aaiiNote = interpretationContext?.aaii_note;

    return (
        <section className={`rounded-3xl border p-5 ${themeClasses.panelSoft}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Supporting context</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                    <Panel themeClasses={themeClasses} title="Index breadth" detail="Context only. Breadth helps interpret the signal but does not replace weighted evidence.">
                        {indices.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {indices.map((index) => (
                                    <span
                                        key={index.symbol}
                                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${index.trend === 'positive'
                                            ? theme === 'light' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                                            : index.trend === 'negative'
                                                ? theme === 'light' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
                                                : themeClasses.panelMuted + ' ' + themeClasses.textSecondary}`}
                                    >
                                        {index.symbol} {index.changePercent >= 0 ? '+' : ''}{index.changePercent.toFixed(2)}%
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <p className={`text-sm leading-6 ${themeClasses.textMuted}`}>Index breadth is unavailable for this snapshot.</p>
                        )}
                    </Panel>

                    <Panel themeClasses={themeClasses} title="Historical context" detail="Context from the current score history and interpretation helpers.">
                        <p className={`text-sm leading-6 ${themeClasses.textSecondary}`}>{trendContext?.note || 'Historical movement context will appear as additional snapshots accumulate.'}</p>
                    </Panel>

                    {aaiiNote && (
                        <Panel themeClasses={themeClasses} title="AAII cadence" detail="AAII is weekly, so several days of age can still be normal.">
                            <p className={`text-sm leading-6 ${themeClasses.textSecondary}`}>{aaiiNote}</p>
                        </Panel>
                    )}
                </div>

                <div className="space-y-4">
                    {stocks.length > 0 && (
                        <Panel themeClasses={themeClasses} title={market === 'US' ? 'Watchlist context' : 'Bursa watchlist context'} detail="Live price context only. These tickers are not weighted evidence unless they appear in a scored source.">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {stocks.slice(0, 4).map((stock) => (
                                    <div key={stock.symbol} className={`rounded-2xl border p-3 ${themeClasses.panelMuted}`}>
                                        <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${themeClasses.textSubtle}`}>{stock.symbol}</div>
                                        <div className={`mt-2 font-mono text-xl ${themeClasses.textPrimary}`}>{market === 'MY' ? 'RM' : '$'}{stock.price.toFixed(2)}</div>
                                        <div className={`mt-1 text-sm font-medium ${stock.change >= 0 ? (theme === 'light' ? 'text-emerald-700' : 'text-emerald-200') : (theme === 'light' ? 'text-rose-700' : 'text-rose-200')}`}>
                                            {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    )}

                    <Panel themeClasses={themeClasses} title="Data notes" detail="Operational notes for interpreting the dashboard.">
                        <ul className={`space-y-2 text-sm leading-6 ${themeClasses.textSecondary}`}>
                            <li>Confidence measures agreement between active indicators, not the probability of success.</li>
                            <li>{interpretationContext?.article_feed_role || 'Latest developments provide context only and are not individually weighted in the composite score.'}</li>
                            {!hasDevelopments && <li>News/social feed unavailable; not included in the current read.</li>}
                            <li>Snapshot recorded {formatDateLabel(signal.metadata.score_delta?.snapshot_date, true)}.</li>
                        </ul>
                    </Panel>
                </div>
            </div>

            <div className={`mt-5 flex flex-col gap-2 border-t pt-4 text-[11px] uppercase tracking-[0.24em] sm:flex-row sm:items-center sm:justify-between ${themeClasses.divider} ${themeClasses.textSubtle}`}>
                <span>Engine: Alpha-Sent-V2</span>
                <span>Signal cockpit · verified context layer</span>
            </div>
        </section>
    );
};

const Panel = ({ title, detail, children, themeClasses }: { title: string; detail: string; children: React.ReactNode; themeClasses: ReturnType<typeof getThemeClasses> }) => (
    <div className={`rounded-2xl border p-4 ${themeClasses.panelMuted}`}>
        <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>{title}</div>
        <div className={`mt-1 text-sm leading-6 ${themeClasses.textMuted}`}>{detail}</div>
        <div className="mt-4">{children}</div>
    </div>
);
