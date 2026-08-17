import { useEffect, useRef, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchMarket } from '@/lib/types/research';
import { formatPriceV6, getActionToneV6, getResearchActionV6, getThemeV6, type ResearchThemeV6 } from './research-v6';

type ResearchWatchlistV6Props = {
    items: ResearchWatchlistItem[];
    selectedSymbol: string;
    theme: ResearchThemeV6;
    onSelect: (symbol: string) => void;
    onAdd: (input: { readonly symbol: string; readonly market: ResearchMarket; readonly companyName: string }) => Promise<void>;
    adding: boolean;
    initiallyOpen?: boolean;
    presentation?: 'v6' | 'v7';
    selectedHidden?: boolean;
    filterSummary?: string | null;
    quoteStatus?: string | null;
    onShowSelected?: () => void;
    onClearFilters?: () => void;
};

export const ResearchWatchlistV6 = ({
    items,
    selectedSymbol,
    theme,
    onSelect,
    onAdd,
    adding,
    initiallyOpen = false,
    presentation = 'v6',
    selectedHidden = false,
    filterSummary = null,
    quoteStatus = null,
    onShowSelected,
    onClearFilters,
}: ResearchWatchlistV6Props) => {
    const [showAdd, setShowAdd] = useState(initiallyOpen);
    const [symbol, setSymbol] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [market, setMarket] = useState<ResearchMarket>('US');
    const [addError, setAddError] = useState<string | null>(null);
    const themeClasses = getThemeV6(theme);
    const itemRefs = useRef(new Map<string, HTMLButtonElement>());
    const symbolInputRef = useRef<HTMLInputElement>(null);
    const previousSelectedSymbol = useRef(selectedSymbol);

    useEffect(() => {
        if (!selectedSymbol) return;
        if (previousSelectedSymbol.current === selectedSymbol) return;
        previousSelectedSymbol.current = selectedSymbol;
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        itemRefs.current.get(selectedSymbol)?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
    }, [selectedSymbol]);

    useEffect(() => {
        if (showAdd) symbolInputRef.current?.focus();
    }, [showAdd]);

    return (
        <aside data-testid="research-watchlist-owner" className={'min-w-0 border-b pb-4 min-[700px]:shrink-0 min-[700px]:border-b-0 min-[700px]:border-r min-[700px]:pb-0 min-[700px]:pr-4 ' + (presentation === 'v7' ? 'min-[700px]:w-auto ' : 'min-[700px]:w-64 ') + themeClasses.divider}>
            <div className={'mb-4 flex items-center justify-between gap-3 border-b px-1 pb-3 ' + themeClasses.divider}>
                <h2 className={'text-sm font-semibold ' + themeClasses.textMuted}>Watchlist</h2>
                <button
                    type="button"
                    aria-expanded={showAdd}
                    aria-controls="research-add-company-form"
                    onClick={() => {
                        setAddError(null);
                        setShowAdd((current) => !current);
                    }}
                    className={'min-h-10 rounded px-3 text-xs font-bold ' + themeClasses.positive}
                >{showAdd ? 'Close' : '+ Add'}</button>
            </div>
            {quoteStatus ? <p data-testid="research-quote-status" role="status" className={'mb-3 rounded-md border px-3 py-2 text-xs leading-5 ' + themeClasses.row + ' ' + themeClasses.risk}>{quoteStatus}</p> : null}
            {selectedHidden ? (
                <div data-testid="research-selected-hidden" role="status" aria-live="polite" className={'mb-3 rounded-md border px-3 py-2 text-xs leading-5 ' + themeClasses.panelAction}>
                    <p className={'font-bold ' + themeClasses.textPrimary}>{selectedSymbol} · Hidden by current filters</p>
                    <p className={'mt-1 ' + themeClasses.textMuted}>The selected security remains open and has not been replaced.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                        {onShowSelected ? <button type="button" onClick={onShowSelected} className={'min-h-10 rounded border px-3 font-bold ' + themeClasses.selectedRow}>Show selected</button> : null}
                        {onClearFilters ? <button type="button" onClick={onClearFilters} className={'min-h-10 rounded border px-3 font-bold ' + themeClasses.row}>Clear filters</button> : null}
                    </div>
                </div>
            ) : null}
            {showAdd ? (
                <form id="research-add-company-form" className={'mb-3 space-y-2 rounded-[7px] border p-2 ' + themeClasses.row} onSubmit={(event) => {
                    event.preventDefault();
                    setAddError(null);
                    void onAdd({ symbol, market, companyName }).then(() => {
                        setSymbol(''); setCompanyName(''); setShowAdd(false);
                    }, (error: unknown) => {
                        setAddError(error instanceof Error ? error.message : 'Unable to add ticker.');
                    });
                }}>
                    <input ref={symbolInputRef} aria-label="Ticker symbol" aria-describedby={addError ? 'research-add-company-error' : undefined} required maxLength={20} placeholder="Ticker" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className={'h-10 w-full rounded border bg-transparent px-2 text-xs ' + themeClasses.textPrimary} />
                    <input aria-label="Company name" required maxLength={120} placeholder="Company name" value={companyName} onChange={(event) => setCompanyName(event.target.value)} className={'h-10 w-full rounded border bg-transparent px-2 text-xs ' + themeClasses.textPrimary} />
                    <div className="flex gap-2">
                        <select aria-label="Market" value={market} onChange={(event) => setMarket(event.target.value === 'MY' ? 'MY' : 'US')} className={'h-10 min-w-0 flex-1 rounded border bg-transparent px-2 text-xs ' + themeClasses.textPrimary}><option value="US">US</option><option value="MY">MY</option></select>
                        <button type="submit" disabled={adding} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950 disabled:opacity-50">{adding ? 'Adding…' : 'Add'}</button>
                    </div>
                    {addError ? <p id="research-add-company-error" role="alert" className={'text-xs leading-5 ' + themeClasses.risk}>{addError}</p> : null}
                </form>
            ) : null}
            {items.length > 0 ? (
                <div className="research-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 min-[700px]:flex-col min-[700px]:overflow-visible min-[700px]:pb-0">
                    {items.map((item) => {
                        const selected = item.symbol === selectedSymbol;
                        const action = getResearchActionV6(item);
                        const rowClass = selected ? themeClasses.selectedRow : themeClasses.row;
                        return (
                            <button
                                key={item.symbol}
                                type="button"
                                ref={(node) => {
                                    if (node) itemRefs.current.set(item.symbol, node);
                                    else itemRefs.current.delete(item.symbol);
                                }}
                                onClick={() => onSelect(item.symbol)}
                                aria-pressed={selected}
                                className={'min-h-12 min-w-[154px] snap-start rounded-[7px] border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-[700px]:min-w-0 ' + rowClass}
                            >
                                <span className="flex items-center justify-between gap-3">
                                    <span className={'font-mono text-sm font-bold tracking-normal ' + (selected ? themeClasses.positive : themeClasses.textPrimary)}>{item.symbol}</span>
                                    <span className={'font-mono text-xs font-semibold tabular-nums ' + (selected ? themeClasses.positive : themeClasses.textSecondary)}>{formatPriceV6(item)}</span>
                                </span>
                                <span className={'mt-0.5 block text-xs font-semibold ' + getActionToneV6(action, theme)}>{action}</span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div data-testid="research-no-results" className={'rounded-[7px] border px-3 py-5 text-center text-xs font-semibold ' + themeClasses.row + ' ' + themeClasses.textMuted}>
                    <p className={themeClasses.textPrimary}>No matching tickers</p>
                    <p className="mt-1">{filterSummary ?? 'No active watchlist filters.'}</p>
                    {onClearFilters ? <button type="button" onClick={onClearFilters} className={'mt-3 min-h-10 rounded border px-3 font-bold ' + themeClasses.selectedRow}>Clear filters</button> : null}
                </div>
            )}
        </aside>
    );
};
