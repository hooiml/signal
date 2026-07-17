'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { parseResearchInboxResponse } from '@/lib/research/inbox-input';
import { emptyInboxState, inboxItemChange, inboxItemSignature, parseInboxState, RESEARCH_INBOX_STATE_KEY, snapshotInboxItems } from '@/lib/research/inbox-state';
import { latestReviewChanges } from '@/lib/research/records';
import { defaultResearchMonitoringRules, type ResearchRecord, type ResearchUpdateMode } from '@/lib/types/research';
import type { ResearchInboxItem, ResearchInboxResponse, ResearchInboxUrgency } from '@/lib/types/research-inbox';
import { ResearchInboxWorkflowV6 } from './ResearchInboxWorkflowV6';
import { ResearchInboxRowV6, researchInboxCategoryLabel } from './ResearchInboxRowV6';
import { getThemeV6, type ResearchThemeV6, type ResearchTabV6 } from './research-v6';

type InboxFilter = 'all' | 'snoozed' | ResearchInboxUrgency;
type Props = {
    readonly items: readonly ResearchWatchlistItem[];
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string, tab: ResearchTabV6) => void;
    readonly onSave: (record: ResearchRecord, mode: ResearchUpdateMode) => Promise<boolean>;
};
type InboxGroup = { readonly symbol: string; readonly items: readonly ResearchInboxItem[] };
type SkeletonProps = { readonly groupCount: number; readonly theme: ResearchThemeV6 };

const filters = ['all', 'action', 'upcoming', 'snoozed'] as const;
const labels: Readonly<Record<InboxFilter, string>> = { all: 'All', action: 'Action needed', upcoming: 'Upcoming', snoozed: 'Snoozed' };

const groupInboxItems = (items: readonly ResearchInboxItem[]): readonly InboxGroup[] => {
    const groups = new Map<string, ResearchInboxItem[]>();
    items.forEach((item) => groups.set(item.symbol, [...(groups.get(item.symbol) ?? []), item]));
    return [...groups].map(([symbol, groupedItems]) => ({ symbol, items: groupedItems }));
};

const responseError = (payload: unknown): string => {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return 'Research inbox is unavailable.';
    const error = Object.fromEntries(Object.entries(payload)).error;
    return typeof error === 'string' ? error : 'Research inbox is unavailable.';
};

const ResearchInboxSkeletonV6 = ({ groupCount, theme }: SkeletonProps) => {
    const styles = getThemeV6(theme);
    const fill = theme === 'light' ? 'bg-slate-200/75' : 'bg-slate-700/70';
    const groups = Array.from({ length: Math.min(Math.max(groupCount, 1), 2) });

    return <div role="status" aria-live="polite" className={'mt-4 border-t ' + styles.divider}>
        <span className="sr-only">Checking watchlist conditions and upcoming catalysts...</span>
        <ol aria-hidden="true" className="motion-safe:animate-pulse">
            {groups.map((_, index) => <li key={index} className={(index === 1 ? 'hidden min-[700px]:block ' : '') + 'border-b py-3 ' + styles.divider}>
                <div className="grid gap-3 min-[700px]:grid-cols-[110px_minmax(0,1fr)_auto] min-[700px]:items-start">
                    <div className="space-y-2">
                        <div className={'h-4 w-16 rounded ' + fill} />
                        <div className={'h-3 w-24 rounded ' + fill} />
                        <div className={'h-3 w-20 rounded ' + fill} />
                    </div>
                    <div className="flex gap-1 min-[700px]:col-start-3 min-[700px]:row-start-1">
                        <div className={'h-10 w-14 rounded ' + fill} />
                        <div className={'h-10 w-[72px] rounded ' + fill} />
                    </div>
                    <div className="grid gap-2 min-[700px]:col-start-2 min-[700px]:row-start-1 min-[700px]:grid-cols-2 min-[1180px]:grid-cols-4">
                        {Array.from({ length: 2 }).map((__, itemIndex) => <div key={itemIndex} className={'min-h-24 rounded border p-3 min-[700px]:min-h-[153px] ' + styles.row}>
                            <div className={'h-3 w-16 rounded ' + fill} />
                            <div className={'mt-3 h-4 w-4/5 rounded ' + fill} />
                            <div className={'mt-2 h-3 w-full rounded ' + fill} />
                            <div className={'mt-2 h-3 w-2/3 rounded ' + fill} />
                        </div>)}
                    </div>
                </div>
            </li>)}
        </ol>
        {groupCount > 1 ? <div aria-hidden="true" className={(groupCount <= 2 ? 'min-[700px]:hidden ' : '') + 'mt-2 h-10 w-32 rounded motion-safe:animate-pulse ' + fill} /> : null}
    </div>;
};

export const ResearchInboxV6 = ({ items, records, theme, onOpen, onSave }: Props) => {
    const [data, setData] = useState<ResearchInboxResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<InboxFilter>('all');
    const [expanded, setExpanded] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [menuId, setMenuId] = useState<string | null>(null);
    const [local, setLocal] = useState(emptyInboxState);
    const [previousSnapshot, setPreviousSnapshot] = useState(emptyInboxState().snapshot);
    const [hadPriorCheck, setHadPriorCheck] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [clock, setClock] = useState(() => Date.now());
    const styles = getThemeV6(theme);
    const recordBySymbol = useMemo(() => new Map(records.map((record) => [record.symbol, record])), [records]);
    const inboxRequest = JSON.stringify(items.map(({ symbol, market, targetBuyZone, lastReviewedAt }) => ({
        symbol,
        market,
        targetBuyZone,
        lastReviewedAt,
        monitoringRules: recordBySymbol.get(symbol)?.monitoringRules ?? defaultResearchMonitoringRules,
    })));

    useEffect(() => {
        try {
            const raw = localStorage.getItem(RESEARCH_INBOX_STATE_KEY);
            const stored = raw ? parseInboxState(JSON.parse(raw) as unknown) : emptyInboxState();
            setLocal(stored); setPreviousSnapshot(stored.snapshot); setHadPriorCheck(stored.checkedAt !== null);
        } catch { setLocal(emptyInboxState()); }
        setHydrated(true);
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        localStorage.setItem(RESEARCH_INBOX_STATE_KEY, JSON.stringify(local));
    }, [hydrated, local]);

    useEffect(() => {
        if (inboxRequest === '[]') return;
        const controller = new AbortController();
        const load = async () => {
            try {
                setError(null); setLoading(true);
                const response = await fetch('/api/research/inbox', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: inboxRequest,
                    signal: controller.signal,
                });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(responseError(payload));
                setData(parseResearchInboxResponse(payload));
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === 'AbortError') return;
                setError(caught instanceof Error ? caught.message : 'Research inbox is unavailable.');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load(); return () => controller.abort();
    }, [inboxRequest]);

    useEffect(() => {
        if (!data || !hydrated) return;
        setLocal((current) => ({ ...current, snapshot: snapshotInboxItems(data.items), checkedAt: data.generatedAt }));
    }, [data, hydrated]);

    const snoozedIds = useMemo(() => new Set(Object.entries(local.snoozed).filter(([, until]) => new Date(until).getTime() > clock).map(([id]) => id)), [clock, local.snoozed]);
    const activeItems = data?.items.filter((item) => !snoozedIds.has(item.id)) ?? [];
    const snoozedItems = data?.items.filter((item) => snoozedIds.has(item.id)) ?? [];
    const visibleItems = filter === 'snoozed' ? snoozedItems : activeItems.filter((item) => filter === 'all' || item.urgency === filter);
    const activeGroups = groupInboxItems(activeItems);
    const visibleGroups = groupInboxItems(visibleItems);
    const displayedGroups = expanded ? visibleGroups : visibleGroups.slice(0, 2);
    const counts = { all: activeItems.length, action: activeItems.filter((item) => item.urgency === 'action').length, upcoming: activeItems.filter((item) => item.urgency === 'upcoming').length, snoozed: snoozedItems.length };
    const unreadCount = activeItems.filter((item) => local.seen[item.id] !== inboxItemSignature(item)).length;
    const empty = filter === 'snoozed' ? 'No items are snoozed.' : filter === 'upcoming' ? 'No US earnings catalysts are scheduled in the next 21 days.' : filter === 'action' ? 'No risk, opportunity, or stale-review items need action.' : 'Nothing needs review right now. Monitoring remains current.';
    const updateSeen = (ids: readonly string[]) => setLocal((current) => ({ ...current, seen: { ...current.seen, ...Object.fromEntries((data?.items ?? []).filter((item) => ids.includes(item.id)).map((item) => [item.id, inboxItemSignature(item)])) } }));
    const snooze = (ids: readonly string[], days: number) => {
        const until = new Date(Date.now() + days * 86_400_000).toISOString();
        setClock(Date.now());
        setLocal((current) => ({ ...current, snoozed: { ...current.snoozed, ...Object.fromEntries(ids.map((id) => [id, until])) } }));
        setMenuId(null);
    };
    const wake = (ids: readonly string[]) => setLocal((current) => {
        const snoozed = { ...current.snoozed };
        ids.forEach((id) => delete snoozed[id]);
        return { ...current, snoozed };
    });
    const openItem = (symbol: string, tab: ResearchTabV6 = 'overview') => {
        setMenuId(null);
        onOpen(symbol, tab);
        window.setTimeout(() => {
            const detail = document.getElementById('research-detail');
            if (!detail) return;
            detail.scrollIntoView({ behavior: 'auto', block: 'start' });
            detail.focus({ preventScroll: true });
        }, 0);
    };

    return <section aria-labelledby="research-inbox-title" aria-busy={items.length > 0 && (loading || (!data && !error))} data-surface-tier="secondary" className={'mb-4 rounded-[10px] border p-3 backdrop-blur min-[700px]:p-4 ' + styles.panelSecondary}>
        <header className="flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-end min-[700px]:justify-between">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 min-[700px]:block">
                <div><p className={'text-xs font-bold uppercase tracking-[0.14em] ' + styles.positive}>Daily attention</p><h2 id="research-inbox-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Today</h2></div>
                <p className={'col-span-2 mt-1 text-xs leading-5 ' + styles.textMuted}>{unreadCount} unread · {counts.all} attention item{counts.all === 1 ? '' : 's'} across {activeGroups.length} ticker{activeGroups.length === 1 ? '' : 's'} · {data?.monitoredCount ?? items.length} monitored</p>
            </div>
            <div className="flex flex-col gap-2 min-[700px]:items-end">
                <div className="flex flex-wrap justify-end gap-1">
                    {unreadCount > 0 && <button type="button" onClick={() => updateSeen(activeItems.map((item) => item.id))} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Mark all seen</button>}
                    <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((current) => !current)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>{collapsed ? 'Show details' : 'Collapse'}</button>
                </div>
                <div role="group" aria-label="Filter research inbox" className={'research-scrollbar flex max-w-full gap-1 overflow-x-auto rounded border p-1 ' + styles.row}>{filters.map((id) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setExpanded(false); setMenuId(null); }} className={'min-h-10 shrink-0 rounded px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + (filter === id ? styles.selectedRow : styles.textMuted)}>{labels[id]} · {counts[id]}</button>)}</div>
            </div>
        </header>
        {collapsed ? <p className={'mt-4 border-t pt-4 text-sm ' + styles.textMuted}>Daily attention is collapsed. {unreadCount} unread item{unreadCount === 1 ? '' : 's'} remain{unreadCount === 1 ? 's' : ''} in this inbox.</p> : items.length === 0 ? <p className={'mt-4 border-t pt-4 text-sm ' + styles.textMuted}>Add a ticker to begin daily monitoring.</p> : error && !data ? <p role="alert" className={'mt-4 border-t pt-4 text-sm ' + styles.risk}>{error}</p> : !data ? <ResearchInboxSkeletonV6 groupCount={items.length} theme={theme} /> : visibleItems.length === 0 ? <p className={'mt-4 border-t pt-4 text-sm ' + styles.textMuted}>{empty}</p> : <>
            <ol className={'mt-4 border-t ' + styles.divider}>{displayedGroups.map((group, index) => {
                const record = recordBySymbol.get(group.symbol);
                const thesisChanges = record ? record.reviewHistory.length >= 2 ? latestReviewChanges(record) : ['No prior review comparison'] : [];
                const groupIds = group.items.map((item) => item.id);
                const groupUnreadCount = group.items.filter((item) => local.seen[item.id] !== inboxItemSignature(item)).length;
                const groupSnoozed = group.items.every((item) => snoozedIds.has(item.id));
                const categories = [...new Set(group.items.map(researchInboxCategoryLabel))];
                return <li key={group.symbol} className={(index === 1 && !expanded ? 'hidden min-[700px]:block ' : '') + 'border-b py-3 ' + styles.divider}>
                    <article aria-labelledby={`research-inbox-group-${group.symbol}`} className="grid gap-3 min-[700px]:grid-cols-[110px_minmax(0,1fr)_auto] min-[700px]:items-start">
                            <button type="button" onClick={() => openItem(group.symbol)} className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 min-[700px]:col-start-1 min-[700px]:row-start-1">
                                <span className="flex flex-wrap items-center gap-2">
                                    {groupUnreadCount > 0 && <span className={'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ' + styles.statusSurface + ' ' + styles.textMuted}>{groupUnreadCount} new</span>}
                                    <span id={`research-inbox-group-${group.symbol}`} className={'font-mono text-sm font-bold ' + styles.textPrimary}>{group.symbol}</span>
                                    <span className={'text-xs font-semibold min-[700px]:block min-[700px]:w-full ' + styles.textSecondary}>{group.items.length} attention item{group.items.length === 1 ? '' : 's'}</span>
                                </span>
                                <span className="mt-1 flex flex-wrap gap-x-2 gap-y-1 min-[700px]:hidden">
                                    {categories.map((category) => <span key={category} className={'text-xs font-semibold ' + styles.textMuted}>{category}</span>)}
                                </span>
                                {thesisChanges.length > 0 && <span className={'mt-1 block line-clamp-2 text-xs leading-5 ' + styles.textSecondary}>Saved thesis · {thesisChanges.join(' · ')}</span>}
                            </button>
                            <div className="flex shrink-0 gap-1 min-[700px]:col-start-3 min-[700px]:row-start-1">
                                <button type="button" aria-label={`Open ${group.symbol} chart`} onClick={() => openItem(group.symbol, 'chart')} className={'min-h-10 rounded border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.row}>Chart</button>
                                <button type="button" aria-expanded={menuId === group.symbol} aria-label={`Manage ${group.symbol} attention items`} onClick={() => setMenuId((current) => current === group.symbol ? null : group.symbol)} className={'min-h-10 rounded border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.row}>Manage</button>
                            </div>
                        <ol className="grid gap-2 min-[700px]:col-start-2 min-[700px]:row-start-1 min-[700px]:grid-cols-2 min-[1180px]:grid-cols-4">
                            {group.items.map((item, itemIndex) => <ResearchInboxRowV6 key={item.id} item={item} theme={theme} unread={local.seen[item.id] !== inboxItemSignature(item)} change={inboxItemChange(item, previousSnapshot, hadPriorCheck)} onOpen={() => openItem(item.symbol)} className={itemIndex >= 2 && !expanded ? 'hidden min-[700px]:block' : ''} />)}
                        </ol>
                        {group.items.length > 2 && !expanded && <p className={'text-xs font-semibold min-[700px]:hidden ' + styles.textMuted}>+{group.items.length - 2} more for {group.symbol}</p>}
                        {menuId === group.symbol && <div className={'rounded border p-3 min-[700px]:col-span-2 min-[700px]:col-start-2 ' + styles.row}>
                            <div className="flex flex-wrap gap-1">
                                {groupUnreadCount > 0 && <button type="button" onClick={() => updateSeen(groupIds)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.selectedRow}>Mark {groupUnreadCount === 1 ? 'seen' : `${groupUnreadCount} seen`}</button>}
                                {groupSnoozed ? <button type="button" onClick={() => wake(groupIds)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.selectedRow}>Wake ticker</button> : <>
                                    <button type="button" onClick={() => snooze(groupIds, 1)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Snooze ticker 1 day</button>
                                    <button type="button" onClick={() => snooze(groupIds, 7)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Snooze ticker 7 days</button>
                                </>}
                                <button type="button" onClick={() => openItem(group.symbol)} className={'min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>Open research</button>
                            </div>
                            {record ? <ResearchInboxWorkflowV6 key={`${record.symbol}-${JSON.stringify(record.monitoringRules)}`} record={record} theme={theme} onSave={onSave} /> : null}
                        </div>}
                    </article>
                </li>;
            })}</ol>
            {visibleGroups.length > 1 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)} className={'mt-2 min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary + (!expanded && visibleGroups.length <= 2 ? ' min-[700px]:hidden' : '')}>{expanded ? 'Show less' : <><span className="min-[700px]:hidden">Show {visibleGroups.length - 1} more ticker{visibleGroups.length - 1 === 1 ? '' : 's'}</span><span className="hidden min-[700px]:inline">Show {visibleGroups.length - 2} more ticker{visibleGroups.length - 2 === 1 ? '' : 's'}</span></>}</button>}
        </>}
        {error && data ? <p role="alert" className={'mt-2 text-xs ' + styles.risk}>Daily attention could not refresh. Showing the previous check.</p> : null}
        {data?.warnings.map((warning) => <p key={warning} role="status" className={'mt-2 text-xs ' + styles.textMuted}>{warning}</p>)}
    </section>;
};
