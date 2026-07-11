import { useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { OverviewPanelV6 } from './OverviewPanelV6';
import { ResearchPanelsV6 } from './ResearchPanelsV6';
import {
    formatPriceV6,
    getActionToneV6,
    getResearchActionV6,
    getThemeV6,
    researchTabsV6,
    type ResearchTabV6,
    type ResearchThemeV6,
} from './research-v6';

export const ResearchDetailV6 = ({ ticker, theme }: {
    ticker: ResearchWatchlistItem;
    theme: ResearchThemeV6;
}) => {
    const [activeTab, setActiveTab] = useState<ResearchTabV6>('overview');
    const action = getResearchActionV6(ticker);
    const change = ticker.dailyChange ?? 0;
    const themeClasses = getThemeV6(theme);

    return (
        <article className="min-w-0 flex-1">
            <header className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                    <h1 className={'font-mono text-2xl font-bold leading-none tracking-normal ' + themeClasses.textPrimary}>{ticker.symbol}</h1>
                    <p className={'mt-1 truncate text-sm font-semibold ' + themeClasses.textSecondary}>{ticker.name}</p>
                </div>
                <div className="shrink-0 text-right">
                    <p className={'font-mono text-2xl font-bold leading-none tracking-normal tabular-nums ' + themeClasses.textPrimary}>{formatPriceV6(ticker)}</p>
                    <p className={'mt-1 font-mono text-sm font-semibold tabular-nums ' + (change >= 0 ? themeClasses.positive : themeClasses.risk)}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </p>
                </div>
            </header>

            <nav className={'mt-5 overflow-x-auto border-b ' + themeClasses.divider} aria-label="Research sections">
                <div className="flex min-w-max gap-1">
                    {researchTabsV6.map((tab) => {
                        const tabClass = activeTab === tab.id
                            ? 'border-emerald-500 ' + themeClasses.textPrimary
                            : 'border-transparent ' + themeClasses.textMuted + ' hover:text-emerald-500';
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={'min-h-10 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-500 ' + tabClass}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </nav>

            <div className="mt-5">
                {activeTab === 'overview'
                    ? <OverviewPanelV6 ticker={ticker} action={action} theme={theme} />
                    : <ResearchPanelsV6 ticker={ticker} tab={activeTab} theme={theme} />}
            </div>

            <footer className={'mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] ' + themeClasses.textMuted}>
                <span>Last reviewed {ticker.lastReviewedAt}</span>
                <span className={getActionToneV6(action, theme)}>Current decision: {action}</span>
            </footer>
        </article>
    );
};
