'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { watchlist } from '@/components/research/ResearchDashboardV2';
import { ResearchDetailV6 } from './ResearchDetailV6';
import {
    ResearchHeaderV6,
    type ResearchActionFilterV6,
    type ResearchMarketFilterV6,
} from './ResearchHeaderV6';
import { ResearchWatchlistV6 } from './ResearchWatchlistV6';
import {
    getResearchActionV6,
    getThemeV6,
    RESEARCH_THEME_STORAGE_KEY_V6,
    type ResearchThemeV6,
} from './research-v6';

const formatSnapshotLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
}).format(new Date(date + 'T00:00:00Z'));

export const ResearchDashboardV6 = () => {
    const searchParams = useSearchParams();
    const requestedSymbol = searchParams.get('ticker')?.toUpperCase();
    const initialSymbol = requestedSymbol && watchlist.some((item) => item.symbol === requestedSymbol)
        ? requestedSymbol
        : 'MSFT';
    const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
    const [theme, setTheme] = useState<ResearchThemeV6>('dark');
    const [isThemeLoaded, setIsThemeLoaded] = useState(false);
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState<ResearchMarketFilterV6>('ALL');
    const [action, setAction] = useState<ResearchActionFilterV6>('ALL');
    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return watchlist.filter((item) => {
            const matchesQuery = !normalizedQuery
                || item.symbol.toLowerCase().includes(normalizedQuery)
                || item.name.toLowerCase().includes(normalizedQuery);
            const matchesMarket = market === 'ALL' || item.market === market;
            const matchesAction = action === 'ALL' || getResearchActionV6(item) === action;
            return matchesQuery && matchesMarket && matchesAction;
        });
    }, [action, market, query]);
    const selected = useMemo(
        () => filteredItems.find((item) => item.symbol === selectedSymbol) ?? filteredItems[0] ?? null,
        [filteredItems, selectedSymbol],
    );
    const latestSnapshot = useMemo(
        () => [...watchlist].sort((left, right) => right.lastReviewedAt.localeCompare(left.lastReviewedAt))[0].lastReviewedAt,
        [],
    );
    const themeClasses = getThemeV6(theme);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            const storedTheme = window.localStorage.getItem(RESEARCH_THEME_STORAGE_KEY_V6);
            if (storedTheme === 'light' || storedTheme === 'dark') setTheme(storedTheme);
            setIsThemeLoaded(true);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (!isThemeLoaded) return;
        document.documentElement.setAttribute('data-cockpit-theme', theme);
        window.localStorage.setItem(RESEARCH_THEME_STORAGE_KEY_V6, theme);
    }, [isThemeLoaded, theme]);

    const selectTicker = (symbol: string) => {
        setSelectedSymbol(symbol);
        const nextUrl = window.location.pathname + '?ticker=' + symbol;
        window.history.replaceState({ ...window.history.state, as: nextUrl, url: nextUrl }, '', nextUrl);
    };

    const atmosphere = theme === 'light'
        ? 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.11),_transparent_28%),radial-gradient(circle_at_80%_10%,_rgba(14,165,233,0.08),_transparent_20%)]'
        : 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_24%),radial-gradient(circle_at_80%_10%,_rgba(52,211,153,0.1),_transparent_18%)]';
    const grid = theme === 'light'
        ? 'bg-[linear-gradient(rgba(16,185,129,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.06)_1px,transparent_1px)] opacity-45'
        : 'bg-[linear-gradient(rgba(16,185,129,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.035)_1px,transparent_1px)] opacity-55';

    return (
        <div className={'relative min-h-screen overflow-x-hidden transition-colors duration-300 ' + themeClasses.page}>
            <div className={'pointer-events-none absolute inset-0 transition-opacity duration-300 ' + atmosphere} />
            <div className={'pointer-events-none absolute inset-0 bg-[size:44px_44px] transition-opacity duration-300 ' + grid} />
            <ResearchHeaderV6
                theme={theme}
                query={query}
                market={market}
                action={action}
                snapshotLabel={formatSnapshotLabel(latestSnapshot)}
                resultCount={filteredItems.length}
                onQueryChange={setQuery}
                onMarketChange={setMarket}
                onActionChange={setAction}
                onThemeToggle={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
            />
            <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-5 pt-4 min-[700px]:px-5">
                <main className={'flex flex-col gap-4 rounded-[10px] border p-3 backdrop-blur min-[700px]:flex-row min-[700px]:p-4 ' + themeClasses.panel}>
                    <ResearchWatchlistV6
                        items={filteredItems}
                        selectedSymbol={selected?.symbol ?? ''}
                        theme={theme}
                        onSelect={selectTicker}
                    />
                    {selected ? (
                        <ResearchDetailV6 key={selected.symbol} ticker={selected} theme={theme} />
                    ) : (
                        <section className="flex min-h-72 flex-1 items-center justify-center px-6 text-center">
                            <div>
                                <h1 className={'text-lg font-bold ' + themeClasses.textPrimary}>No research matches</h1>
                                <p className={'mt-2 text-sm ' + themeClasses.textMuted}>Adjust the ticker, market, or decision filter.</p>
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
};
