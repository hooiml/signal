'use client';

import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { watchlist, type ResearchWatchlistItem } from '../research/ResearchDashboardV2';
import { TopAppBarV5, ShellV5, ChevronIcon, SearchIcon, type ActionLabel } from './v5-shared';
import { TickerDetail } from './TickerDetail';

type MarketFilterV5 = 'ALL' | 'US' | 'MY';
type StatusFilterV5 = 'ALL' | ActionLabel;

const marketFilterOptions: MarketFilterV5[] = ['ALL', 'US', 'MY'];
const statusFilterOptions: StatusFilterV5[] = ['ALL', 'Ready', 'DCA', 'Wait', 'Watch', 'Avoid'];

const filterWatchlistV5 = (
    searchTerm: string,
    marketFilter: MarketFilterV5,
    statusFilter: StatusFilterV5,
) => watchlist
    .filter((item) => {
        const matchSearch =
            item.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchMarket = marketFilter === 'ALL' || item.market === marketFilter;
        const matchStatus = statusFilter === 'ALL' || computeActionLabelV5(item) === statusFilter;

        return matchSearch && matchMarket && matchStatus;
    })
    .sort((a, b) => a.order - b.order);

const getChecklistCount = (checklist: Record<string, boolean>) =>
    Object.values(checklist).filter(Boolean).length;

export const computeActionLabelV5 = (item: ResearchWatchlistItem): ActionLabel => {
    const checklistCount = getChecklistCount(item.checklist);
    const coreQualityPassed =
        item.checklist.understandBusiness &&
        item.checklist.revenueGrowingOrStable &&
        item.checklist.marginsHealthyOrImproving &&
        item.checklist.debtManageable &&
        item.checklist.freeCashFlowPositiveOrImproving &&
        item.checklist.downsideAcceptable;

    if (
        item.thesisStrength === 'low' ||
        !item.checklist.downsideAcceptable ||
        (item.valuationState === 'expensive' && item.thesisStrength !== 'high')
    ) {
        return 'Avoid';
    }

    if (
        item.positionState === 'owned' &&
        item.thesisStrength === 'high' &&
        coreQualityPassed &&
        item.valuationState !== 'expensive' &&
        item.inBuyZone &&
        item.checklist.valuationReasonable
    ) {
        return 'DCA';
    }

    if (
        checklistCount >= 8 &&
        item.inBuyZone &&
        item.checklist.valuationReasonable &&
        item.checklist.downsideAcceptable
    ) {
        return 'Ready';
    }

    if (
        (item.thesisStrength === 'high' || item.thesisStrength === 'medium') &&
        checklistCount >= 6 &&
        (item.valuationState === 'expensive' || !item.inBuyZone)
    ) {
        return 'Wait';
    }

    return 'Watch';
};

export const ResearchDashboardV5 = () => {
    const searchParams = useSearchParams();
    const tickerQuery = searchParams.get('ticker');

    const initialSymbol = useMemo(() => {
        if (!tickerQuery) return 'MSFT';
        const cleanSymbol = tickerQuery.toUpperCase();
        if (watchlist.some((item) => item.symbol.toUpperCase() === cleanSymbol)) {
            return cleanSymbol;
        }
        return 'MSFT';
    }, [tickerQuery]);

    const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [marketFilter, setMarketFilter] = useState<MarketFilterV5>('ALL');
    const [statusFilter, setStatusFilter] = useState<StatusFilterV5>('ALL');
    
    // Collapsible Filters Disclosure
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);

    const filteredWatchlist = useMemo(
        () => filterWatchlistV5(searchTerm, marketFilter, statusFilter),
        [searchTerm, marketFilter, statusFilter],
    );

    // Update active selection and replace URL query param smoothly
    const handleSelectTicker = (symbol: string) => {
        setSelectedSymbol(symbol);
        const newUrl = `${window.location.pathname}?ticker=${symbol}`;
        window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    };

    const keepSelectionVisible = (
        nextSearchTerm: string,
        nextMarketFilter: MarketFilterV5,
        nextStatusFilter: StatusFilterV5,
    ) => {
        const nextWatchlist = filterWatchlistV5(nextSearchTerm, nextMarketFilter, nextStatusFilter);
        const selectionRemainsVisible = nextWatchlist.some((item) => item.symbol === selectedSymbol);
        if (!selectionRemainsVisible && nextWatchlist[0]) {
            handleSelectTicker(nextWatchlist[0].symbol);
        }
    };

    // Keep the detail panel aligned with the currently visible results.
    const selectedItem = useMemo(() => {
        const visibleSelection = filteredWatchlist.find((item) => item.symbol === selectedSymbol);
        return visibleSelection ?? filteredWatchlist[0] ?? null;
    }, [filteredWatchlist, selectedSymbol]);

    return (
        <ShellV5>
            <TopAppBarV5 showRefresh={false} showSnapshot={false} />

            {/* Main content area */}
            <div className="flex-grow flex flex-col w-full max-w-[1240px] mx-auto px-4 py-6 space-y-4">
                
                {/* Search-led research command bar */}
                <section className="relative overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                    <div className="grid md:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="flex items-center gap-5 p-5 md:p-6">
                            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-[#b8f14b] text-[#151916]">
                                <strong className="text-xl font-black leading-none">{filteredWatchlist.length}</strong>
                                <span className="mt-1 font-mono text-[8px] font-bold uppercase">Visible</span>
                            </div>
                            <div>
                                <span className="font-mono text-[10px] font-bold uppercase text-[#17745a]">Research command center</span>
                                <h1 className="mt-1 text-2xl font-black tracking-tight text-zinc-900">Company dossiers</h1>
                                <p className="mt-1 text-xs text-zinc-500">Move from watchlist to a clear action in one view.</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-[#f7f8f5] p-4 text-xs md:border-l md:border-t-0">
                            <div className="relative flex-1 md:flex-none">
                                <SearchIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Search ticker or company"
                                    aria-label="Search ticker or company"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        const nextSearchTerm = e.target.value;
                                        setSearchTerm(nextSearchTerm);
                                        keepSelectionVisible(nextSearchTerm, marketFilter, statusFilter);
                                    }}
                                    className="w-full min-w-[210px] rounded-md border border-zinc-300 bg-white py-2 pl-9 pr-3 text-xs text-[#17201d] placeholder-zinc-400 outline-none transition-colors focus:border-[#17745a] md:w-[230px]"
                                />
                            </div>
                            <div className="flex rounded-md border border-zinc-300 bg-white p-0.5">
                                {marketFilterOptions.map((m) => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => {
                                            setMarketFilter(m);
                                            keepSelectionVisible(searchTerm, m, statusFilter);
                                        }}
                                        className={`rounded px-3 py-1.5 font-bold transition-all ${marketFilter === m ? 'bg-[#151916] text-white' : 'text-zinc-500 hover:text-zinc-900'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                                aria-expanded={isFiltersOpen}
                                className="flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
                            >
                                <span>Strategy</span>
                                <ChevronIcon className="h-3.5 w-3.5" direction={isFiltersOpen ? 'up' : 'down'} />
                            </button>
                        </div>
                    </div>
                    {isFiltersOpen && (
                        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 bg-white px-5 py-3 text-xs ">
                            <span className="mr-2 font-mono text-[10px] font-bold uppercase text-zinc-400">Show actions</span>
                            {statusFilterOptions.map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter(st);
                                        keepSelectionVisible(searchTerm, marketFilter, st);
                                    }}
                                    className={`rounded-md border px-3 py-1.5 font-bold uppercase transition-all ${statusFilter === st ? 'border-[#151916] bg-[#151916] text-white' : 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:border-zinc-400'}`}
                                >
                                    {st}
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                {/* Dossier navigation and focused detail */}
                <div className="grid flex-grow gap-6 lg:grid-cols-[232px_minmax(0,1fr)]">
                    <aside className="min-w-0 overflow-hidden rounded-[10px] border border-zinc-200 bg-[#151916] shadow-[0_18px_40px_rgba(21,25,22,0.14)]">
                        <div className="border-b border-white/10 px-4 py-3">
                            <span className="font-mono text-[9px] font-bold uppercase text-[#b8f14b]">Watchlist queue</span>
                            <p className="mt-1 text-[11px] text-zinc-500">Select a company to inspect</p>
                        </div>
                        <div className="flex gap-2 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible">
                            {filteredWatchlist.length > 0 ? (
                                filteredWatchlist.map((item) => {
                                    const isSelected = item.symbol === selectedItem?.symbol;
                                    const actionLabel = computeActionLabelV5(item);
                                    return (
                                        <button
                                            key={item.symbol}
                                            type="button"
                                            onClick={() => handleSelectTicker(item.symbol)}
                                            className={`group min-w-[150px] rounded-md border p-3 text-left transition-all lg:min-w-0 ${isSelected ? 'border-[#b8f14b] bg-[#b8f14b] text-[#151916]' : 'border-white/10 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/[0.08]'}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="font-mono text-sm font-black">{item.symbol}</span>
                                                <span className={`h-2 w-2 rounded-full ${actionLabel === 'Ready' ? 'bg-[#63d6ab]' : actionLabel === 'DCA' ? 'bg-[#6f91ff]' : actionLabel === 'Wait' ? 'bg-[#f4b84d]' : actionLabel === 'Avoid' ? 'bg-[#ff6e66]' : 'bg-zinc-400'}`} />
                                            </div>
                                            <span className={`mt-1 block truncate text-[10px] ${isSelected ? 'text-[#314125]' : 'text-zinc-500'}`}>{item.name}</span>
                                            <span className={`mt-3 inline-block font-mono text-[9px] font-bold uppercase ${isSelected ? 'text-[#151916]' : 'text-zinc-300'}`}>{actionLabel}</span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="px-2 py-8 text-center font-mono text-[10px] text-zinc-500">NO MATCHES</div>
                            )}
                        </div>
                    </aside>

                    <div className="min-w-0 flex flex-col">
                        {selectedItem ? (
                            <TickerDetail ticker={selectedItem} actionLabel={computeActionLabelV5(selectedItem)} />
                        ) : (
                            <div className="flex flex-grow items-center justify-center rounded-lg border border-zinc-200 bg-white p-8 text-center font-mono text-xs text-zinc-400">
                                Choose a dossier to begin evaluation.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ShellV5>
    );
};
