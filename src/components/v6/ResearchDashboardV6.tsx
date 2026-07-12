'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { watchlist } from '@/components/research/ResearchDashboardV2';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { parseResearchRecord, ResearchInputError } from '@/lib/research/input';
import type { ResearchCreateInput, ResearchRecord } from '@/lib/types/research';
import { ResearchDetailV6 } from './ResearchDetailV6';
import {
    ResearchHeaderV6,
    type ResearchActionFilterV6,
    type ResearchMarketFilterV6,
} from './ResearchHeaderV6';
import { ResearchWatchlistV6 } from './ResearchWatchlistV6';
import { TrendDiscoveryV6 } from './TrendDiscoveryV6';
import { ResearchAlertsV6 } from './ResearchAlertsV6';
import { ResearchComparisonV6 } from './ResearchComparisonV6';
import { ResearchWorkspaceTabsV6, type ResearchWorkspaceV6 } from './ResearchWorkspaceTabsV6';
import { applyResearchRecordV6, createWatchlistItemV6, toResearchRecordV6 } from './research-records-v6';
import {
    getResearchActionV6,
    getThemeV6,
} from './research-v6';
import { useThemeV6 } from './ThemeProviderV6';

const formatSnapshotLabel = (date: string) => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
}).format(new Date(date + 'T00:00:00Z'));

export const ResearchDashboardV6 = () => {
    const searchParams = useSearchParams();
    const requestedSymbol = searchParams.get('ticker')?.toUpperCase();
    const initialSymbol = requestedSymbol ?? 'MSFT';
    const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
    const { theme, toggleTheme } = useThemeV6();
    const [query, setQuery] = useState('');
    const [market, setMarket] = useState<ResearchMarketFilterV6>('ALL');
    const [action, setAction] = useState<ResearchActionFilterV6>('ALL');
    const [items, setItems] = useState<ResearchWatchlistItem[]>(watchlist);
    const [records, setRecords] = useState<ResearchRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [adding, setAdding] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [workspace, setWorkspace] = useState<ResearchWorkspaceV6>('research');
    const filteredItems = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return items.filter((item) => {
            const matchesQuery = !normalizedQuery
                || item.symbol.toLowerCase().includes(normalizedQuery)
                || item.name.toLowerCase().includes(normalizedQuery);
            const matchesMarket = market === 'ALL' || item.market === market;
            const matchesAction = action === 'ALL' || getResearchActionV6(item) === action;
            return matchesQuery && matchesMarket && matchesAction;
        });
    }, [action, items, market, query]);
    const selected = useMemo(
        () => filteredItems.find((item) => item.symbol === selectedSymbol) ?? filteredItems[0] ?? null,
        [filteredItems, selectedSymbol],
    );
    const latestSnapshot = useMemo(
        () => [...items].sort((left, right) => right.lastReviewedAt.localeCompare(left.lastReviewedAt))[0]?.lastReviewedAt ?? new Date().toISOString().slice(0, 10),
        [items],
    );
    const selectedRecord = selected
        ? records.find((record) => record.symbol === selected.symbol) ?? toResearchRecordV6(selected)
        : null;
    const themeClasses = getThemeV6(theme);

    useEffect(() => {
        let active = true;
        const loadRecords = async () => {
            try {
                const response = await fetch('/api/research/watchlist');
                const payload: unknown = await response.json();
                if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new ResearchInputError('Invalid research API response.');
                const data = Object.fromEntries(Object.entries(payload)).data;
                const archivedData = Object.fromEntries(Object.entries(payload)).archivedSymbols;
                if (!response.ok || !Array.isArray(data)) throw new ResearchInputError('Unable to load saved research.');
                const stored = data.map(parseResearchRecord);
                const archivedSymbols = Array.isArray(archivedData) ? archivedData.filter((item): item is string => typeof item === 'string') : [];
                if (!active) return;
                const seeded = watchlist.filter((item) => !archivedSymbols.includes(item.symbol)).map((item) => {
                    const record = stored.find((candidate) => candidate.symbol === item.symbol);
                    return record ? applyResearchRecordV6(item, record) : item;
                });
                const additions = stored
                    .filter((record) => !watchlist.some((item) => item.symbol === record.symbol))
                    .map((record, index) => createWatchlistItemV6(record, 100 + index));
                setRecords(stored);
                setItems([...seeded, ...additions]);
            } catch (error) {
                if (active) setSaveError(error instanceof Error ? error.message : 'Unable to load saved research.');
            }
        };
        void loadRecords();
        return () => { active = false; };
    }, []);

    const selectTicker = (symbol: string) => {
        setWorkspace('research');
        setSelectedSymbol(symbol);
        const nextUrl = window.location.pathname + '?ticker=' + symbol;
        window.history.replaceState({ ...window.history.state, as: nextUrl, url: nextUrl }, '', nextUrl);
    };

    const addDiscoveryCandidate = async (candidate: { readonly symbol: string; readonly name: string }) => {
        await addRecord({ symbol: candidate.symbol, market: 'US', companyName: candidate.name });
        setWorkspace('research');
    };

    const readRecordResponse = async (response: Response): Promise<ResearchRecord> => {
        const payload: unknown = await response.json();
        if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new ResearchInputError('Invalid research API response.');
        const body = Object.fromEntries(Object.entries(payload));
        if (!response.ok) throw new ResearchInputError(typeof body.error === 'string' ? body.error : 'Research request failed.');
        return parseResearchRecord(body.data);
    };

    const saveRecord = async (record: ResearchRecord) => {
        setSaving(true);
        setSaveError(null);
        try {
            if (!records.some((item) => item.symbol === record.symbol)) {
                await readRecordResponse(await fetch('/api/research/watchlist', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol: record.symbol, market: record.market, companyName: record.companyName }),
                }));
            }
            const saved = await readRecordResponse(await fetch('/api/research/watchlist/' + encodeURIComponent(record.symbol), {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
            }));
            setRecords((current) => [...current.filter((item) => item.symbol !== saved.symbol), saved]);
            setItems((current) => current.map((item) => item.symbol === saved.symbol ? applyResearchRecordV6(item, saved) : item));
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Unable to save research.');
        } finally {
            setSaving(false);
        }
    };

    const addRecord = async (input: ResearchCreateInput) => {
        setAdding(true);
        setSaveError(null);
        try {
            const saved = await readRecordResponse(await fetch('/api/research/watchlist', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
            }));
            setRecords((current) => [...current.filter((item) => item.symbol !== saved.symbol), saved]);
            setItems((current) => current.some((item) => item.symbol === saved.symbol)
                ? current.map((item) => item.symbol === saved.symbol ? applyResearchRecordV6(item, saved) : item)
                : [...current, createWatchlistItemV6(saved, 100 + current.length)]);
            selectTicker(saved.symbol);
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Unable to add ticker.');
            throw error;
        } finally {
            setAdding(false);
        }
    };

    const deleteRecord = async () => {
        if (!selected || !window.confirm(`Remove ${selected.symbol} from saved research?`)) return;
        setSaveError(null);
        try {
            const response = await fetch('/api/research/watchlist/' + encodeURIComponent(selected.symbol), { method: 'DELETE' });
            if (!response.ok) throw new ResearchInputError('Unable to remove saved research.');
            setRecords((current) => current.filter((item) => item.symbol !== selected.symbol));
            setItems((current) => current.filter((item) => item.symbol !== selected.symbol));
            setSelectedSymbol('');
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Unable to remove saved research.');
        }
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
                onThemeToggle={toggleTheme}
            />
            <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 pb-5 pt-4 min-[700px]:px-5">
                <ResearchWorkspaceTabsV6 active={workspace} theme={theme} onChange={setWorkspace} />
                <main className={'flex flex-col gap-4 rounded-[10px] border p-3 backdrop-blur min-[700px]:flex-row min-[700px]:p-4 ' + themeClasses.panel}>
                    {workspace === 'alerts' ? (
                        <ResearchAlertsV6 items={items} theme={theme} onOpen={selectTicker} />
                    ) : workspace === 'compare' ? (
                        <ResearchComparisonV6 items={items} theme={theme} onOpen={selectTicker} />
                    ) : workspace === 'discovery' ? (
                        <TrendDiscoveryV6 theme={theme} savedSymbols={items.map((item) => item.symbol)} adding={adding} onAdd={addDiscoveryCandidate} onOpen={selectTicker} />
                    ) : (<>
                    <ResearchWatchlistV6
                        items={filteredItems}
                        selectedSymbol={selected?.symbol ?? ''}
                        theme={theme}
                        onSelect={selectTicker}
                        onAdd={addRecord}
                        adding={adding}
                    />
                    {selected && selectedRecord ? (
                        <ResearchDetailV6 key={selected.symbol} ticker={selected} theme={theme} record={selectedRecord} saving={saving} saveError={saveError} onSave={saveRecord} onDelete={deleteRecord} />
                    ) : (
                        <section className="flex min-h-72 flex-1 items-center justify-center px-6 text-center">
                            <div>
                                <h1 className={'text-lg font-bold ' + themeClasses.textPrimary}>No research matches</h1>
                                <p className={'mt-2 text-sm ' + themeClasses.textMuted}>Adjust the ticker, market, or decision filter.</p>
                            </div>
                        </section>
                    )}
                    </>)}
                </main>
            </div>
        </div>
    );
};
