import { useEffect, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
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
import { applyResearchSnapshotV6, parseResearchSnapshotResponse } from './research-snapshot-v6';

const formatProviderTimestampV6 = (timestamp: string) => new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
}).format(new Date(timestamp));

export const ResearchDetailV6 = ({ ticker, theme, record, liveQuote, saving, saveError, onSave, onSnapshot, onDelete }: {
    ticker: ResearchWatchlistItem;
    theme: ResearchThemeV6;
    record: ResearchRecord;
    liveQuote: ResearchSnapshot['quote'] | null;
    saving: boolean;
    saveError: string | null;
    onSave: (record: ResearchRecord) => Promise<boolean>;
    onSnapshot: (symbol: string, snapshot: ResearchSnapshot) => void;
    onDelete: () => Promise<void>;
}) => {
    const [activeTab, setActiveTab] = useState<ResearchTabV6>('overview');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [providerState, setProviderState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [providerError, setProviderError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const snapshotTicker = snapshot ? applyResearchSnapshotV6(ticker, snapshot) : ticker;
    const liveTicker = liveQuote ? {
        ...snapshotTicker,
        name: liveQuote.name ?? snapshotTicker.name,
        price: liveQuote.price ?? undefined,
        dailyChange: liveQuote.dailyChangePercent ?? undefined,
    } : snapshotTicker;
    const action = getResearchActionV6(liveTicker);
    const change = liveTicker.dailyChange ?? 0;
    const themeClasses = getThemeV6(theme);

    useEffect(() => {
        let active = true;
        const loadSnapshot = async () => {
            setProviderState('loading');
            setProviderError(null);
            try {
                const response = await fetch(`/api/research/symbol/${encodeURIComponent(ticker.symbol)}?market=${ticker.market}`);
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && !Array.isArray(payload) && typeof Object.fromEntries(Object.entries(payload)).error === 'string'
                    ? String(Object.fromEntries(Object.entries(payload)).error) : 'Unable to load free-source data.');
                const nextSnapshot = parseResearchSnapshotResponse(payload);
                if (active) {
                    setSnapshot(nextSnapshot);
                    onSnapshot(ticker.symbol, nextSnapshot);
                    setProviderState('ready');
                }
            } catch (error) {
                if (active) {
                    setProviderState('error');
                    setProviderError(error instanceof Error ? error.message : 'Unable to load free-source data.');
                }
            }
        };
        void loadSnapshot();
        return () => { active = false; };
    }, [onSnapshot, refreshKey, ticker.market, ticker.symbol]);

    return (
        <article id="research-detail" tabIndex={-1} className="min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500">
            <header className="flex items-start justify-between gap-5">
                <div className="min-w-0">
                    <h2 className={'font-mono text-2xl font-bold leading-none tracking-normal ' + themeClasses.textPrimary}>{ticker.symbol}</h2>
                    <p className={'mt-1 truncate text-sm font-semibold ' + themeClasses.textSecondary}>{liveTicker.name}</p>
                </div>
                <div className="shrink-0 text-right">
                    <p aria-live="polite" className={'font-mono text-2xl font-bold leading-none tracking-normal tabular-nums ' + themeClasses.textPrimary}>{providerState === 'loading' ? 'Loading...' : formatPriceV6(liveTicker)}</p>
                    <p className={'mt-1 font-mono text-sm font-semibold tabular-nums ' + (change >= 0 ? themeClasses.positive : themeClasses.risk)}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </p>
                    <button type="button" onClick={() => void onDelete()} className={'mt-1 min-h-10 rounded px-2 text-xs font-semibold ' + themeClasses.risk}>Remove</button>
                </div>
            </header>

            {providerState === 'loading' ? (
                <div role="status" className={'mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ' + themeClasses.row + ' ' + themeClasses.textSecondary}>
                    <span className="inline-block h-2 w-16 animate-pulse rounded-full bg-emerald-400/60" />
                    Loading live quote and provider facts...
                </div>
            ) : providerState === 'error' ? (
                <div role="alert" className={'mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-xs ' + themeClasses.row + ' ' + themeClasses.risk}>
                    <span>Live provider data is unavailable. Saved research remains visible.</span>
                    <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="min-h-10 rounded border border-current px-3 font-semibold transition-transform active:scale-95">Retry</button>
                </div>
            ) : snapshot ? (
                <div className={'mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-xs ' + themeClasses.row + ' ' + themeClasses.textSecondary}>
                    <span><strong className={themeClasses.textPrimary}>Live quote</strong> · {formatProviderTimestampV6(snapshot.fetchedAt)}</span>
                    <span><strong className={themeClasses.textPrimary}>Research reviewed</strong> · {ticker.lastReviewedAt}</span>
                </div>
            ) : null}

            <nav className={'research-scrollbar mt-5 overflow-x-auto border-b ' + themeClasses.divider} aria-label="Research sections">
                <div role="tablist" className="flex min-w-max gap-1">
                    {researchTabsV6.map((tab) => {
                        const tabClass = activeTab === tab.id
                            ? 'border-emerald-500 ' + themeClasses.textPrimary
                            : 'border-transparent ' + themeClasses.textMuted + ' hover:text-emerald-500';
                        return (
                            <button
                                key={tab.id}
                                id={`research-tab-${tab.id}`}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                aria-controls={`research-panel-${tab.id}`}
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

            <div id={`research-panel-${activeTab}`} role="tabpanel" aria-labelledby={`research-tab-${activeTab}`} tabIndex={0} className="mt-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-500">
                {activeTab === 'overview'
                    ? <OverviewPanelV6 ticker={liveTicker} action={action} theme={theme} record={record} benchmark={snapshot?.benchmark ?? null} saving={saving} saveError={saveError} onSave={onSave} />
                    : <ResearchPanelsV6 ticker={liveTicker} tab={activeTab} theme={theme} />}
            </div>

            <footer className={'mt-4 flex flex-wrap items-center justify-between gap-2 text-xs ' + themeClasses.textMuted}>
                <span>Research reviewed {ticker.lastReviewedAt}</span>
                <span>{providerState === 'loading' ? 'Loading free sources'
                    : providerState === 'error' ? `Live sources unavailable: ${providerError}`
                        : `${snapshot?.sources.join(' + ') || 'No provider data'} · updated ${snapshot ? formatProviderTimestampV6(snapshot.fetchedAt) : ''}`}</span>
                {snapshot?.warnings.map((warning) => <span key={warning}>{warning}</span>)}
                <span className={getActionToneV6(action, theme)}>Current decision: {action}</span>
            </footer>
        </article>
    );
};
