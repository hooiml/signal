import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { formatPriceV6, getActionToneV6, getResearchActionV6, getThemeV6, type ResearchThemeV6 } from './research-v6';

type ResearchWatchlistV6Props = {
    items: ResearchWatchlistItem[];
    selectedSymbol: string;
    theme: ResearchThemeV6;
    onSelect: (symbol: string) => void;
};

export const ResearchWatchlistV6 = ({
    items,
    selectedSymbol,
    theme,
    onSelect,
}: ResearchWatchlistV6Props) => {
    const themeClasses = getThemeV6(theme);

    return (
        <aside className={'min-w-0 border-b pb-4 min-[700px]:w-[220px] min-[700px]:shrink-0 min-[700px]:border-b-0 min-[700px]:border-r min-[700px]:pb-0 min-[700px]:pr-4 ' + themeClasses.divider}>
            <div className={'mb-4 flex items-center justify-between gap-3 border-b px-1 pb-3 ' + themeClasses.divider}>
                <h2 className={'text-xs font-semibold ' + themeClasses.textMuted}>Watchlist</h2>
                <span className={'text-[11px] font-semibold ' + themeClasses.textMuted}>{items.length} shown</span>
            </div>
            {items.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-2 min-[700px]:flex-col min-[700px]:overflow-visible min-[700px]:pb-0">
                    {items.map((item) => {
                        const selected = item.symbol === selectedSymbol;
                        const action = getResearchActionV6(item);
                        const rowClass = selected ? themeClasses.selectedRow : themeClasses.row;
                        return (
                            <button
                                key={item.symbol}
                                type="button"
                                onClick={() => onSelect(item.symbol)}
                                aria-pressed={selected}
                                className={'min-h-12 min-w-[154px] rounded-[7px] border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-[700px]:min-w-0 ' + rowClass}
                            >
                                <span className="flex items-center justify-between gap-3">
                                    <span className={'font-mono text-sm font-bold tracking-normal ' + (selected ? themeClasses.positive : themeClasses.textPrimary)}>{item.symbol}</span>
                                    <span className={'font-mono text-[11px] font-semibold tabular-nums ' + (selected ? themeClasses.positive : themeClasses.textSecondary)}>{formatPriceV6(item)}</span>
                                </span>
                                <span className={'mt-0.5 block text-[11px] font-semibold ' + getActionToneV6(action, theme)}>{action}</span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className={'rounded-[7px] border px-3 py-5 text-center text-xs font-semibold ' + themeClasses.row + ' ' + themeClasses.textMuted}>
                    No matching tickers
                </div>
            )}
        </aside>
    );
};
