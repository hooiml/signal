'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { parseResearchInboxResponse } from '@/lib/research/inbox-input';
import { emptyInboxState, inboxItemChange, inboxItemSignature, parseInboxState, RESEARCH_INBOX_STATE_KEY, snapshotInboxItems } from '@/lib/research/inbox-state';
import { latestReviewChanges } from '@/lib/research/records';
import { defaultResearchMonitoringRules, type ResearchRecord, type ResearchUpdateMode } from '@/lib/types/research';
import type { ResearchInboxResponse, ResearchInboxUrgency } from '@/lib/types/research-inbox';
import { ResearchInboxWorkflowV6 } from './ResearchInboxWorkflowV6';
import { ResearchInboxRowV6 } from './ResearchInboxRowV6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type InboxFilter = 'all' | 'snoozed' | ResearchInboxUrgency;
type Props = {
    readonly items: readonly ResearchWatchlistItem[];
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
    readonly onSave: (record: ResearchRecord, mode: ResearchUpdateMode) => Promise<boolean>;
};
const filters = ['all', 'action', 'upcoming', 'snoozed'] as const;
const labels: Readonly<Record<InboxFilter, string>> = { all: 'All', action: 'Action needed', upcoming: 'Upcoming', snoozed: 'Snoozed' };

const responseError = (payload: unknown): string => {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return 'Research inbox is unavailable.';
    const error = Object.fromEntries(Object.entries(payload)).error;
    return typeof error === 'string' ? error : 'Research inbox is unavailable.';
};

export const ResearchInboxV6 = ({ items, records, theme, onOpen, onSave }: Props) => {
    const [data, setData] = useState<ResearchInboxResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<InboxFilter>('all');
    const [expanded, setExpanded] = useState(false);
    const [menuId, setMenuId] = useState<string | null>(null);
    const [local, setLocal] = useState(emptyInboxState);
    const [previousSnapshot, setPreviousSnapshot] = useState(emptyInboxState().snapshot);
    const [hadPriorCheck, setHadPriorCheck] = useState(false);
    const [hydrated, setHydrated] = useState(false);
    const [clock, setClock] = useState(() => Date.now());
    const styles = getThemeV6(theme);
    const recordBySymbol = useMemo(() => new Map(records.map((record) => [record.symbol, record])), [records]);

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
        if (items.length === 0) return;
        const controller = new AbortController();
        const load = async () => {
            try {
                setError(null); setData(null);
                const response = await fetch('/api/research/inbox', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(items.map(({ symbol, market, targetBuyZone, lastReviewedAt }) => ({
                        symbol,
                        market,
                        targetBuyZone,
                        lastReviewedAt,
                        monitoringRules: recordBySymbol.get(symbol)?.monitoringRules ?? defaultResearchMonitoringRules,
                    }))),
                    signal: controller.signal,
                });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(responseError(payload));
                setData(parseResearchInboxResponse(payload));
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === 'AbortError') return;
                setError(caught instanceof Error ? caught.message : 'Research inbox is unavailable.');
            }
        };
        void load(); return () => controller.abort();
    }, [items, recordBySymbol]);

    useEffect(() => {
        if (!data || !hydrated) return;
        setLocal((current) => ({ ...current, snapshot: snapshotInboxItems(data.items), checkedAt: data.generatedAt }));
    }, [data, hydrated]);

    const snoozedIds = useMemo(() => new Set(Object.entries(local.snoozed).filter(([, until]) => new Date(until).getTime() > clock).map(([id]) => id)), [clock, local.snoozed]);
    const activeItems = data?.items.filter((item) => !snoozedIds.has(item.id)) ?? [];
    const snoozedItems = data?.items.filter((item) => snoozedIds.has(item.id)) ?? [];
    const visibleItems = filter === 'snoozed' ? snoozedItems : activeItems.filter((item) => filter === 'all' || item.urgency === filter);
    const counts = { all: activeItems.length, action: activeItems.filter((item) => item.urgency === 'action').length, upcoming: activeItems.filter((item) => item.urgency === 'upcoming').length, snoozed: snoozedItems.length };
    const unreadCount = activeItems.filter((item) => local.seen[item.id] !== inboxItemSignature(item)).length;
    const displayed = expanded ? visibleItems : visibleItems.slice(0, 4);
    const empty = filter === 'snoozed' ? 'No items are snoozed.' : filter === 'upcoming' ? 'No US earnings catalysts are scheduled in the next 21 days.' : filter === 'action' ? 'No risk, opportunity, or stale-review items need action.' : 'Nothing needs review right now. Monitoring remains current.';
    const updateSeen = (ids: readonly string[]) => setLocal((current) => ({ ...current, seen: { ...current.seen, ...Object.fromEntries((data?.items ?? []).filter((item) => ids.includes(item.id)).map((item) => [item.id, inboxItemSignature(item)])) } }));
    const snooze = (id: string, days: number) => { const until = new Date(Date.now() + days * 86_400_000).toISOString(); setClock(Date.now()); setLocal((current) => ({ ...current, snoozed: { ...current.snoozed, [id]: until } })); setMenuId(null); };
    const wake = (id: string) => setLocal((current) => { const snoozed = { ...current.snoozed }; delete snoozed[id]; return { ...current, snoozed }; });

    return <section aria-labelledby="research-inbox-title" className={'mb-4 rounded-[10px] border p-3 backdrop-blur min-[700px]:p-4 ' + styles.panel}>
        <header className="flex flex-col gap-3 min-[700px]:flex-row min-[700px]:items-end min-[700px]:justify-between">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 min-[700px]:block">
                <div><p className={'text-xs font-bold uppercase tracking-[0.14em] ' + styles.positive}>Daily attention</p><h1 id="research-inbox-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Today</h1></div>
                {unreadCount > 0 && <button type="button" onClick={() => updateSeen(activeItems.map((item) => item.id))} className={'min-h-10 rounded px-3 text-xs font-semibold min-[700px]:hidden ' + styles.textSecondary}>Mark all seen</button>}
                <p className={'col-span-2 mt-1 text-xs leading-5 ' + styles.textMuted}>{unreadCount} unread · {counts.action} need review · {counts.upcoming} upcoming · {data?.monitoredCount ?? items.length} monitored</p>
            </div>
            <div className="flex flex-col gap-2 min-[700px]:items-end">
                {unreadCount > 0 && <button type="button" onClick={() => updateSeen(activeItems.map((item) => item.id))} className={'hidden min-h-10 rounded px-3 text-xs font-semibold min-[700px]:block ' + styles.textSecondary}>Mark all seen</button>}
                <div role="group" aria-label="Filter research inbox" className={'research-scrollbar flex max-w-full gap-1 overflow-x-auto rounded border p-1 ' + styles.row}>{filters.map((id) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); setExpanded(false); setMenuId(null); }} className={'min-h-10 shrink-0 rounded px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + (filter === id ? styles.selectedRow : styles.textMuted)}>{labels[id]} · {counts[id]}</button>)}</div>
            </div>
        </header>
        {items.length === 0 ? <p className={'mt-4 border-t pt-4 text-sm ' + styles.textMuted}>Add a ticker to begin daily monitoring.</p> : error ? <p role="alert" className={'mt-4 border-t pt-4 text-sm ' + styles.risk}>{error}</p> : !data ? <p role="status" className={'mt-4 border-t pt-4 text-sm ' + styles.textMuted}>Checking watchlist conditions and upcoming catalysts...</p> : visibleItems.length === 0 ? <p className={'mt-4 border-t pt-4 text-sm ' + styles.textMuted}>{empty}</p> : <><ol className={'mt-4 border-t ' + styles.divider}>{displayed.map((item) => {
            const record = recordBySymbol.get(item.symbol);
            const thesisChanges = record
                ? record.reviewHistory.length >= 2 ? latestReviewChanges(record) : ['No prior review comparison']
                : [];
            return <ResearchInboxRowV6 key={item.id} item={item} theme={theme} unread={local.seen[item.id] !== inboxItemSignature(item)} change={inboxItemChange(item, previousSnapshot, hadPriorCheck)} thesisChanges={thesisChanges} snoozed={snoozedIds.has(item.id)} menuOpen={menuId === item.id} onOpen={() => onOpen(item.symbol)} onToggleMenu={() => setMenuId((current) => current === item.id ? null : item.id)} onMarkSeen={() => updateSeen([item.id])} onSnooze={(days) => snooze(item.id, days)} onWake={() => wake(item.id)} workflow={record ? <ResearchInboxWorkflowV6 key={`${record.symbol}-${JSON.stringify(record.monitoringRules)}`} record={record} theme={theme} onSave={onSave} /> : null} />;
        })}</ol>{visibleItems.length > 4 && <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)} className={'mt-2 min-h-10 rounded px-3 text-xs font-semibold ' + styles.textSecondary}>{expanded ? 'Show less' : `Show ${visibleItems.length - displayed.length} more`}</button>}</>}
        {data?.warnings.map((warning) => <p key={warning} role="status" className={'mt-2 text-xs ' + styles.textMuted}>{warning}</p>)}
    </section>;
};
