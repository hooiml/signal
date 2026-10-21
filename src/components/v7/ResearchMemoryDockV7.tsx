'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { OwnerAccessNotice } from '@/components/OwnerAccessNotice';
import { ownerAccessIssue, type OwnerAccessIssue } from '@/lib/owner-access-client';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import type { ResearchMemorySnapshot } from '@/lib/research/research-memory';
import {
    addSnapshotToState,
    buildResearchMemorySnapshotFromProvider,
    buildResearchMemoryStateFromRecord,
    readResearchMemoryHistory,
    writeResearchMemorySnapshot,
} from '@/lib/research/research-memory-integration';
import { buildResearchMemoryWorkflow } from '@/lib/research/research-memory-workflow.ts';
import { describeResearchMemoryDecisionMemory } from '@/lib/research/research-memory-thesis.ts';

const formatValue = (value: number | undefined, suffix = '') => value === undefined ? 'Unavailable' : `${value.toFixed(2)}${suffix}`;
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const emptyHistory: readonly ResearchMemorySnapshot[] = [];

type ResearchMemoryLoadState = 'idle' | 'loading' | 'ready' | 'error';

type ResearchMemoryDockV7Props = {
    readonly ticker: string;
    readonly record: ResearchRecord | null;
    readonly recordsState: Exclude<ResearchMemoryLoadState, 'idle'>;
    readonly snapshot: ResearchSnapshot | null;
    readonly snapshotState: ResearchMemoryLoadState;
    readonly snapshotMessage: string | null;
};

type ResearchMemoryHistoryState = {
    readonly ticker: string;
    readonly status: 'loading' | 'ready';
    readonly history: readonly ResearchMemorySnapshot[];
    readonly source: 'server' | 'local';
    readonly accessIssue: OwnerAccessIssue | null;
    readonly message: string | null;
};

const readServerHistory = async (ticker: string, signal: AbortSignal): Promise<{ history: ResearchMemorySnapshot[]; accessIssue: OwnerAccessIssue | null }> => {
    const response = await fetch(`/api/research/memory/${encodeURIComponent(ticker)}`, { signal, cache: 'no-store' });
    const payload: unknown = await response.json().catch(() => null);
    const issue = ownerAccessIssue(response.status, typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'code') : undefined);
    if (issue) return { history: [], accessIssue: issue };
    if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Server memory unavailable.');
    const data = (payload as Record<string, unknown>).data;
    if (!Array.isArray(data)) throw new Error('Server memory unavailable.');
    return { history: data as ResearchMemorySnapshot[], accessIssue: null };
};

export const ResearchMemoryDockV7 = ({
    ticker,
    record,
    recordsState,
    snapshot,
    snapshotState,
    snapshotMessage,
}: ResearchMemoryDockV7Props) => {
    const [historyState, setHistoryState] = useState<ResearchMemoryHistoryState>({
        ticker,
        status: 'loading',
        history: [],
        source: 'server',
        accessIssue: null,
        message: null,
    });
    const lastPersistedSnapshot = useRef<string | null>(null);
    const lastLocalSnapshot = useRef<string | null>(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        if (recordsState === 'loading' || (recordsState === 'ready' && !record)) return;

        let active = true;
        const controller = new AbortController();
        const load = async () => {
            const memoryResult = await readServerHistory(ticker, controller.signal)
                .then(({ history, accessIssue }) => accessIssue
                    ? { source: 'local' as const, history: readResearchMemoryHistory(ticker), accessIssue, message: null }
                    : { source: 'server' as const, history, accessIssue: null, message: null })
                .catch(() => ({ source: 'local' as const, history: readResearchMemoryHistory(ticker), accessIssue: null, message: 'Server memory could not be loaded. Showing browser-local history; automatic server saves are paused.' }));
            if (active && !controller.signal.aborted) {
                setHistoryState({ ticker, status: 'ready', ...memoryResult });
            }
        };
        void load();
        return () => {
            active = false;
            controller.abort();
        };
    }, [record, recordsState, reload, ticker]);

    const localHistory = useMemo(
        () => recordsState !== 'ready' || !record ? readResearchMemoryHistory(ticker) : [],
        [record, recordsState, ticker],
    );
    const serverHistoryReady = historyState.ticker === ticker && historyState.status === 'ready';
    const history = recordsState === 'ready' && record
        ? serverHistoryReady ? historyState.history : emptyHistory
        : localHistory;
    const historyStatus = recordsState === 'ready' && record
        ? serverHistoryReady ? 'ready' as const : 'loading' as const
        : 'ready' as const;
    const historySource = recordsState === 'ready' && record && serverHistoryReady ? historyState.source : 'local';
    const accessIssue = historyState.ticker === ticker ? historyState.accessIssue : null;
    const historyMessage = historyState.ticker === ticker ? historyState.message : null;
    const currentSnapshot = snapshot?.symbol === ticker ? snapshot : null;

    const model = useMemo(() => {
        if (!record || !currentSnapshot || historyStatus !== 'ready') return null;
        const current = buildResearchMemorySnapshotFromProvider(record, currentSnapshot);
        const previous = history.at(-1) ?? null;
        let state = buildResearchMemoryStateFromRecord(record);
        for (const historical of history) state = addSnapshotToState(state, historical);
        state = addSnapshotToState(state, current);
        const workflow = buildResearchMemoryWorkflow({
            state,
            previousSnapshot: previous,
            currentSnapshot: current,
            now: new Date().toISOString(),
            scheduledReviewAt: record.decisionJournal.nextReviewAt,
        });
        return { current, previous, workflow };
    }, [currentSnapshot, history, historyStatus, record]);

    useEffect(() => {
        if (!model) return;
        const persistenceKey = `${ticker}:${model.current.id}`;
        if (lastLocalSnapshot.current !== persistenceKey) {
            lastLocalSnapshot.current = persistenceKey;
            writeResearchMemorySnapshot(model.current);
        }
        // A denied or failed history read must never trigger a background server write.
        if (accessIssue || historySource !== 'server' || !serverHistoryReady) return;
        if (lastPersistedSnapshot.current === persistenceKey) return;
        lastPersistedSnapshot.current = persistenceKey;
        void fetch(`/api/research/memory/${encodeURIComponent(ticker)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(model.current),
        }).then(async (response) => {
            if (response.ok) return;
            const payload: unknown = await response.json().catch(() => null);
            const issue = ownerAccessIssue(response.status, typeof payload === 'object' && payload !== null ? Reflect.get(payload, 'code') : undefined);
            lastPersistedSnapshot.current = null;
            setHistoryState((current) => current.ticker === ticker ? { ...current, source: 'local', accessIssue: issue, message: issue ? null : 'This memory checkpoint could not be saved to the server. Browser-local memory remains available.' } : current);
        }).catch(() => {
            lastPersistedSnapshot.current = null;
            setHistoryState((current) => current.ticker === ticker ? { ...current, source: 'local', message: 'This memory checkpoint could not be saved to the server. Browser-local memory remains available.' } : current);
        });
    }, [accessIssue, historySource, model, serverHistoryReady, ticker]);

    const loading = recordsState === 'loading'
        || (record !== null && historyStatus === 'loading')
        || (record !== null && (snapshotState === 'idle' || snapshotState === 'loading'));

    if (loading) {
        return (
            <section data-testid="research-memory-dock" aria-busy="true" className="mb-3 w-full">
                <div className="rounded-[10px] border border-zinc-700/40 bg-zinc-900/20 p-4 text-sm text-zinc-500">Building decision memory for {ticker}…</div>
            </section>
        );
    }

    if (!model || !record) {
        const message = recordsState === 'error'
            ? 'Saved research is unavailable, so Decision Memory cannot be loaded.'
            : !record
                ? 'Save this security to Research before Signal can build persistent decision memory for it.'
                : snapshotMessage ?? 'Current provider snapshot is unavailable.';
        return (
            <section data-testid="research-memory-dock" className="mb-3 w-full">
                <div className="rounded-[10px] border border-zinc-700/40 bg-zinc-900/20 p-4">
                    <strong className="text-sm">Decision memory · {ticker}</strong>
                    {accessIssue ? <OwnerAccessNotice issue={accessIssue} resource="Decision memory" onRetry={() => setReload((value) => value + 1)} /> : <p className="mt-1 text-xs text-zinc-500">{message}</p>}
                </div>
            </section>
        );
    }

    const changeSummary = model.workflow.changeSummary;
    const changeCount = changeSummary
        ? Object.values(changeSummary.counts).reduce((total, count) => total + count, 0)
        : 0;
    const evidenceChangeCount = changeSummary
        ? changeSummary.counts.added + changeSummary.counts.changed + changeSummary.counts.removed + changeSummary.counts.freshness
        : 0;
    const latestTransition = model.workflow.thesisTransitions.at(-1) ?? null;
    const queue = model.workflow.reviewQueue.slice(0, 3);
    const latestDecision = model.workflow.decisionMemory.latestDecision;
    const historyLabel = historySource === 'server' ? 'server history' : 'browser-local history · not synced';

    return (
        <section data-testid="research-memory-dock" className="mb-3 w-full" aria-label={`Decision memory for ${ticker}`}>
            <div className="rounded-[10px] border border-zinc-700/40 bg-zinc-950/30 p-4 shadow-sm">
                {accessIssue && <OwnerAccessNotice issue={accessIssue} resource="Decision memory" onRetry={() => setReload((value) => value + 1)} />}
                {historySource === 'local' && <p role="status" className="mb-3 text-xs text-zinc-500">{historyMessage ?? 'Showing browser-local memory. Server history is unavailable and automatic server saves are paused.'} {!accessIssue && <button type="button" onClick={() => setReload((value) => value + 1)} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-emerald-500">Retry server memory</button>}</p>}
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Decision memory</p>
                        <h3 className="mt-1 text-lg font-bold">{ticker} · What changed and what needs review</h3>
                        <p className="mt-1 text-xs text-zinc-500">{history.length === 0 ? 'First memory checkpoint. Future visits will compare against this snapshot.' : `Compared with ${formatDate(model.previous?.observedAt ?? model.current.observedAt)} · ${history.length} checkpoint${history.length === 1 ? '' : 's'} · ${historyLabel}.`}</p>
                    </div>
                    <a href={`/research?ticker=${encodeURIComponent(ticker)}&workspace=replay`} className="min-h-10 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-500">Open replay</a>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <article className="rounded-lg border border-zinc-700/40 p-3">
                        <span className="text-[11px] font-semibold uppercase text-zinc-500">Since last review</span>
                        <strong className="mt-1 block text-sm">{changeSummary ? `${changeCount} material change${changeCount === 1 ? '' : 's'}` : 'Baseline captured'}</strong>
                        <p className="mt-1 text-xs text-zinc-500">Price {formatValue(model.previous?.price)} → {formatValue(model.current.price)}{evidenceChangeCount > 0 ? ' · evidence changed' : ''}</p>
                    </article>
                    <article className="rounded-lg border border-zinc-700/40 p-3">
                        <span className="text-[11px] font-semibold uppercase text-zinc-500">Thesis lifecycle</span>
                        <strong className="mt-1 block text-sm">Version {latestTransition?.currentVersion ?? 1}</strong>
                        <p className="mt-1 text-xs text-zinc-500">{latestTransition?.thesisChanged ? 'Thesis changed from the prior saved review.' : 'No thesis text change detected.'}</p>
                    </article>
                    <article className="rounded-lg border border-zinc-700/40 p-3">
                        <span className="text-[11px] font-semibold uppercase text-zinc-500">Decision</span>
                        <strong className="mt-1 block text-sm">{latestDecision?.decision.toUpperCase() ?? 'UNSET'}</strong>
                        <p className="mt-1 text-xs text-zinc-500">{describeResearchMemoryDecisionMemory(model.workflow.decisionMemory)}</p>
                    </article>
                    <article className="rounded-lg border border-zinc-700/40 p-3">
                        <span className="text-[11px] font-semibold uppercase text-zinc-500">Valuation reasoning</span>
                        <strong className="mt-1 block text-sm">Input gap</strong>
                        <p className="mt-1 text-xs text-zinc-500">Forward EPS is not available from the current data sources, so Signal does not infer it from trailing P/E.</p>
                    </article>
                </div>

                <details className="mt-3 rounded-lg border border-zinc-700/40 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Review queue · {model.workflow.reviewQueue.length}</summary>
                    <div className="mt-3 grid gap-2 md:grid-cols-3">
                        {queue.length > 0 ? queue.map((item) => (
                            <div key={item.id} className="rounded-md border border-zinc-700/30 p-3">
                                <span className="text-[10px] font-bold uppercase text-zinc-500">{item.priority}</span>
                                <strong className="mt-1 block text-xs">{item.title}</strong>
                                <p className="mt-1 text-xs text-zinc-500">{item.detail}</p>
                            </div>
                        )) : <p className="text-xs text-zinc-500">No memory-derived action requires attention.</p>}
                    </div>
                </details>

                <details className="mt-2 rounded-lg border border-zinc-700/40 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">Point-in-time checkpoints · {history.length}</summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {history.length > 0 ? history.slice(-8).reverse().map((entry) => (
                            <span key={entry.id} className="rounded-md border border-zinc-700/30 px-2 py-1 text-xs text-zinc-500">{formatDate(entry.observedAt)} · {entry.price === undefined ? 'price unavailable' : `$${entry.price.toFixed(2)}`}</span>
                        )) : <span className="text-xs text-zinc-500">No prior checkpoint yet. Outcomes learned later are not backfilled into this history.</span>}
                    </div>
                </details>
            </div>
        </section>
    );
};
