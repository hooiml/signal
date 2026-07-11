'use client';

import { useState } from 'react';
import {
    formatCurrency,
    formatPercent,
    getChecklistCount,
    ResearchWatchlistItem,
    watchlist,
} from '@/components/research/ResearchDashboardV2';
import {
    ActionBadge,
    ActionLabel,
    AppHeaderV4,
    computeActionLabel,
    normalizeWatchlist,
} from './v4-shared';

type AnalysisSection = 'valuation' | 'checklist' | 'feed' | 'technical';

const strengthLabel: Record<ResearchWatchlistItem['thesisStrength'], string> = {
    high: 'High thesis',
    medium: 'Med thesis',
    low: 'Low thesis',
};

const valuationLabel: Record<ResearchWatchlistItem['valuationState'], string> = {
    cheap: 'Cheap',
    fair: 'Fair',
    expensive: 'Expensive',
    unknown: 'Unknown',
};

const orderedResearchWatchlist = normalizeWatchlist(watchlist);

const getInitialSelectedSymbol = () => {
    if (typeof window === 'undefined') return orderedResearchWatchlist[0]?.symbol ?? '';

    const ticker = new URLSearchParams(window.location.search).get('ticker');
    if (ticker && orderedResearchWatchlist.some((item) => item.symbol === ticker)) {
        return ticker;
    }

    return orderedResearchWatchlist[0]?.symbol ?? '';
};

export const ResearchDashboardV4 = () => {
    const [selectedSymbol, setSelectedSymbol] = useState(getInitialSelectedSymbol);
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
    const [openSections, setOpenSections] = useState<Record<AnalysisSection, boolean>>({
        valuation: true,
        checklist: true,
        feed: true,
        technical: true,
    });
    const selected = orderedResearchWatchlist.find((item) => item.symbol === selectedSymbol) ?? orderedResearchWatchlist[0];
    const selectedAction = computeActionLabel(selected);

    const handleSelect = (symbol: string) => {
        setSelectedSymbol(symbol);
        window.history.pushState(null, '', `/research-v4?ticker=${symbol}`);
        // Full analysis intentionally resets on ticker change. Ticker is URL state; expanded analysis is local UI state.
        setIsAnalysisOpen(false);
    };

    const toggleSection = (section: AnalysisSection) => {
        setOpenSections((current) => ({ ...current, [section]: !current[section] }));
    };

    return (
        <main className="min-h-screen w-full overflow-x-hidden bg-[#FAFAF8] text-[#1A1A1A] selection:bg-[#2563EB] selection:text-white">
            <div className="bg-[#0F1117]">
                <AppHeaderV4 snapshotDate={selected.lastReviewedAt} />
            </div>

            <div className="mx-auto w-full max-w-[1280px] md:h-[calc(100dvh-48px)] md:px-6">
                <div className="grid min-h-0 w-full min-w-0 md:h-full md:grid-cols-[280px_minmax(0,1fr)]">
                    <WatchlistPanel
                        items={orderedResearchWatchlist}
                        selectedSymbol={selected.symbol}
                        onSelect={handleSelect}
                    />

                    <section className="min-w-0 border-[#E5E3DC] md:overflow-y-auto md:border-l">
                        <div className="px-4 py-5 md:px-6">
                            <TickerDetail
                                selected={selected}
                                action={selectedAction}
                                isAnalysisOpen={isAnalysisOpen}
                                onToggleAnalysis={() => setIsAnalysisOpen((current) => !current)}
                            />

                            {isAnalysisOpen ? (
                                <FullAnalysis
                                    selected={selected}
                                    openSections={openSections}
                                    onToggleSection={toggleSection}
                                />
                            ) : null}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
};

const WatchlistPanel = ({
    items,
    selectedSymbol,
    onSelect,
}: {
    items: ResearchWatchlistItem[];
    selectedSymbol: string;
    onSelect: (symbol: string) => void;
}) => (
    <aside className="min-w-0 border-[#E5E3DC] md:h-full md:overflow-y-auto">
        <div className="hidden items-center justify-between border-b border-[#E5E3DC] px-4 py-3 md:flex">
            <h1 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Watchlist</h1>
            <span className="text-xs text-[#6B7280]">{items.length}</span>
        </div>

        <div
          data-horizontal-scroll="watchlist"
          className="flex w-full min-w-0 gap-2 overflow-x-auto border-b border-[#E5E3DC] px-4 py-3 md:hidden"
        >
            {items.map((item) => {
                const action = computeActionLabel(item);
                const selected = selectedSymbol === item.symbol;

                return (
                    <button
                        key={item.symbol}
                        type="button"
                        onClick={() => onSelect(item.symbol)}
                        className={`flex h-9 shrink-0 items-center gap-2 rounded border px-3 text-sm ${
                            selected ? 'border-[#2563EB] bg-[#EFF6FF] font-semibold text-[#1A1A1A]' : 'border-[#E5E3DC] bg-white text-[#1A1A1A]'
                        }`}
                    >
                        {item.symbol}
                        <ActionBadge label={action} />
                    </button>
                );
            })}
        </div>

        <div className="hidden md:block">
            {items.length > 0 ? items.map((item) => (
                <WatchlistRow
                    key={item.symbol}
                    item={item}
                    selected={selectedSymbol === item.symbol}
                    onSelect={() => onSelect(item.symbol)}
                />
            )) : (
                <div className="px-4 py-10 text-center text-sm text-[#6B7280]">No tickers added yet. Add a ticker to get started.</div>
            )}
        </div>
    </aside>
);

const WatchlistRow = ({
    item,
    selected,
    onSelect,
}: {
    item: ResearchWatchlistItem;
    selected: boolean;
    onSelect: () => void;
}) => {
    const action = computeActionLabel(item);

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`grid min-h-14 w-full grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#E5E3DC] px-4 py-3 text-left transition hover:bg-black/[0.03] ${
                selected ? 'border-l-2 border-l-[#2563EB] bg-[#EFF6FF]' : 'border-l-2 border-l-transparent'
            }`}
        >
            <span className="truncate text-[13px] font-semibold text-[#1A1A1A]">{item.symbol}</span>
            <span className="min-w-0">
                <span className="block truncate text-sm text-[#1A1A1A]">{formatCurrency(item.price, item.market)}</span>
                <span className="block truncate text-[11px] text-[#6B7280]">
                    {valuationLabel[item.valuationState]} - {strengthLabel[item.thesisStrength]}
                </span>
            </span>
            <span className="flex flex-col items-end gap-1">
                <span className={item.dailyChange && item.dailyChange < 0 ? 'text-[13px] font-medium text-[#DC2626]' : 'text-[13px] font-medium text-[#16A34A]'}>
                    {formatPercent(item.dailyChange)}
                </span>
                <ActionBadge label={action} />
            </span>
        </button>
    );
};

const TickerDetail = ({
    selected,
    action,
    isAnalysisOpen,
    onToggleAnalysis,
}: {
    selected: ResearchWatchlistItem;
    action: ActionLabel;
    isAnalysisOpen: boolean;
    onToggleAnalysis: () => void;
}) => (
    <article className="mx-auto min-w-0 max-w-4xl">
        <header className="grid gap-4 border-b border-[#E5E3DC] pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
                <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-[22px] font-semibold leading-tight text-[#1A1A1A]">{selected.symbol}</h2>
                    <ActionBadge label={action} large />
                </div>
                <p className="mt-1 text-sm text-[#6B7280]">{selected.name} - {selected.marketCap}</p>
            </div>
            <div className="md:text-right">
                <div className="text-[22px] font-semibold text-[#1A1A1A]">{formatCurrency(selected.price, selected.market)}</div>
                <div className={selected.dailyChange && selected.dailyChange < 0 ? 'text-sm font-medium text-[#DC2626]' : 'text-sm font-medium text-[#16A34A]'}>
                    {formatPercent(selected.dailyChange)}
                </div>
            </div>
        </header>

        <MetricsStrip selected={selected} />
        <ThesisCard selected={selected} />

        <button
            type="button"
            onClick={onToggleAnalysis}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-[#2563EB] text-sm font-semibold text-white transition hover:bg-[#1D4ED8] active:scale-[0.99]"
        >
            {isAnalysisOpen ? 'Close analysis ^' : 'Full analysis ->'}
        </button>
    </article>
);

const MetricsStrip = ({ selected }: { selected: ResearchWatchlistItem }) => (
    <div className="mt-5 grid border-y border-[#E5E3DC] sm:grid-cols-4">
        <MetricCell label="Buy zone" value={selected.targetBuyZone} />
        <MetricCell label="Valuation" value={valuationLabel[selected.valuationState]} />
        <MetricCell label="Checklist" value={`${getChecklistCount(selected.checklist)} / 9`} />
        <MetricCell label="Next earnings" value={selected.event.nextEarnings} />
    </div>
);

const MetricCell = ({ label, value }: { label: string; value: string }) => (
    <div className="border-b border-[#E5E3DC] py-3 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0 sm:last:border-r-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{label}</div>
        <div className="mt-1 text-sm font-semibold text-[#1A1A1A]">{value}</div>
    </div>
);

const ThesisCard = ({ selected }: { selected: ResearchWatchlistItem }) => (
    <section className="mt-5 rounded-md border border-[#E5E3DC] bg-white p-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6B7280]">Thesis snapshot</h3>
        <p className="mt-3 text-sm leading-6 text-[#1A1A1A]">{selected.bullCase}</p>
        <p className="mt-3 text-[13px] leading-5 text-[#6B7280]">{selected.buyTrigger}</p>
        <div className="mt-4 border-t border-[#E5E3DC] pt-4">
            <p className="text-[13px] leading-5 text-[#6B7280]">Bear: {selected.bearCase}</p>
            <p className="mt-1 text-[13px] italic leading-5 text-[#DC2626]">Invalidation: {selected.thesisBreak}</p>
        </div>
    </section>
);

const FullAnalysis = ({
    selected,
    openSections,
    onToggleSection,
}: {
    selected: ResearchWatchlistItem;
    openSections: Record<AnalysisSection, boolean>;
    onToggleSection: (section: AnalysisSection) => void;
}) => (
    <div className="mx-auto mt-6 max-w-4xl space-y-3">
        <AnalysisPanel title="Valuation detail" section="valuation" open={openSections.valuation} onToggle={onToggleSection}>
            <KeyValueGrid rows={[
                ['P/E', selected.valuation.pe],
                ['Forward P/E', selected.valuation.forwardPe],
                ['Price/Sales', selected.valuation.priceSales],
                ['EV/EBITDA', selected.valuation.evEbitda],
                ['FCF yield', selected.valuation.fcfYield],
                ['Dividend yield', selected.valuation.dividendYield],
                ['5-year range', selected.valuation.fiveYearRange],
                ['Peer comparison', selected.valuation.peerNote],
            ]} />
        </AnalysisPanel>

        <AnalysisPanel title="Investment checklist" section="checklist" open={openSections.checklist} onToggle={onToggleSection}>
            <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(selected.checklist).map(([key, passed]) => (
                    <div key={key} className="flex min-h-10 items-center gap-3 border-b border-[#E5E3DC] py-2">
                        <span className={`h-2 w-2 rounded-full ${passed ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                        <span className="text-sm text-[#1A1A1A]">{humanizeKey(key)}</span>
                    </div>
                ))}
            </div>
        </AnalysisPanel>

        <AnalysisPanel title="Research feed" section="feed" open={openSections.feed} onToggle={onToggleSection}>
            {selected.feed.length > 0 ? (
                <div className="divide-y divide-[#E5E3DC]">
                    {selected.feed.map((item) => (
                        <article key={`${selected.symbol}-${item.title}`} className="py-3 first:pt-0 last:pb-0">
                            <div className="text-sm font-semibold text-[#1A1A1A]">{item.title}</div>
                            <div className="mt-1 text-xs text-[#6B7280]">{item.source} - {item.date} - {item.label}</div>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="py-6 text-center text-[13px] text-[#6B7280]">No recent items for this ticker.</div>
            )}
        </AnalysisPanel>

        <AnalysisPanel title="Technical context" section="technical" open={openSections.technical} onToggle={onToggleSection}>
            <KeyValueGrid rows={[
                ['Price vs 50d', selected.technical.ma50],
                ['Price vs 200d', selected.technical.ma200],
                ['52-week range', selected.technical.range52Week],
                ['RSI', selected.technical.rsi],
                ['MACD direction', selected.technical.macd],
                ['Volume trend', selected.technical.volume],
                ['Support/Resistance', selected.technical.supportResistance],
            ]} />
        </AnalysisPanel>
    </div>
);

const AnalysisPanel = ({
    title,
    section,
    open,
    onToggle,
    children,
}: {
    title: string;
    section: AnalysisSection;
    open: boolean;
    onToggle: (section: AnalysisSection) => void;
    children: React.ReactNode;
}) => (
    <section className="rounded-md border border-[#E5E3DC] bg-white">
        <button
            type="button"
            onClick={() => onToggle(section)}
            className="flex min-h-11 w-full items-center justify-between px-4 text-left text-sm font-semibold text-[#1A1A1A]"
            aria-expanded={open}
        >
            {title}
            <svg className={`h-3 w-3 text-[#6B7280] transition ${open ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </button>
        {open ? <div className="border-t border-[#E5E3DC] px-4 py-4">{children}</div> : null}
    </section>
);

const KeyValueGrid = ({ rows }: { rows: Array<[string, string]> }) => (
    <div className="grid gap-x-6 sm:grid-cols-2">
        {rows.map(([label, value]) => (
            <div key={label} className="border-b border-[#E5E3DC] py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B7280]">{label}</div>
                <div className="mt-1 text-sm text-[#1A1A1A]">{value}</div>
            </div>
        ))}
    </div>
);

const humanizeKey = (key: string) => key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase());
