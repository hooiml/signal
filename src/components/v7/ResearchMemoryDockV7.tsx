'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { parseResearchRecord } from '@/lib/research/input';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import type { ResearchMemorySnapshot } from '@/lib/research/research-memory';
import { parseResearchSnapshotResponse } from '@/components/v6/research-snapshot-v6';
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

const readServerHistory = async (ticker: string, signal: AbortSignal): Promise<ResearchMemorySnapshot[]> => {
    const response = await fetch(`/api/research/memory/${encodeURIComponent(ticker)}`, { signal, cache: 'no-store' });
    const payload: unknown = await response.json();
    if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Server memory unavailable.');
    const data = (payload as Record<string, unknown>).data;
    if (!Array.isArray(data)) throw new Error('Server memory unavailable.');
    return data as ResearchMemorySnapshot[];
};

export const ResearchMemoryDockV7 = () => {
    const searchParams = useSearchParams();
    const requested = searchParams.get('ticker')?.trim().toUpperCase();
    const ticker = requested && /^[A-Z0-9.-]{1,20}$/.test(requested) ? requested : 'MSFT';
    const [record, setRecord] = useState<ResearchRecord | null>(null);
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
    const [message, setMessage] = useState<string | null>(null);
    const [history, setHistory] = useState<readonly ResearchMemorySnapshot[]>([]);
    const [historySource, setHistorySource] = useState<'server' | 'local'>('server');
    const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const anchor = document.querySelector<HTMLElement>('[data-testid="since-last-visit"]');
        if (!anchor?.parentElement) return;
        const host = document.createElement('div');
        host.dataset.testid = 'research-memory-dock-slot';
        anchor.parentElement.insertBefore(host, anchor.nextSibling);
        setPortalHost(host);
        return () => {
            setPortalHost(null);
            host.remove();
        };
    }, []);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();
        const load = async () => {
            setStatus('loading');
            setMessage(null);
            try {
                const watchlistResponse = await fetch('/api/research/watchlist', { signal: controller.signal, cache: 'no-store' });
                const watchlistPayload: unknown = await watchlistResponse.json();
                if (!watchlistResponse.ok || typeof watchlistPayload !== 'object' || watchlistPayload === null || Array.isArray(watchlistPayload)) {
                    throw new Error('Saved research is unavailable.');
                }
                const data = (watchlistPayload as Record<string, unknown>).data;
                if (!Array.isArray(data)) throw new Error('Saved research is unavailable.');
                const parsed = data.map((item) => parseResearchRecord(item));
                const selected = parsed.find((item) => item.symbol === ticker) ?? null;
                if (!selected) {
                    if (active) {
                        setRecord(null);
                        setSnapshot(null);
                        setHistory(readResearchMemoryHistory(ticker));
                        setHistorySource('local');
                        setStatus('unavailable');
                        setMessage('Save this security to Research before Signal can build persistent decision memory for it.');
                    }
                    return;
                }

                const [providerResponse, memoryResult] = await Promise.all([
                    fetch(`/api/research/symbol/${encodeURIComponent(ticker)}?market=${selected.market}`, { signal: controller.signal, cache: 'no-store' }),
                    readServerHistory(ticker, controller.signal)
                        .then((serverHistory) => ({ source: 'server' as const, history: serverHistory }))
                        .catch(() => ({ source: 'local' as const, history: readResearchMemoryHistory(ticker) })),
                ]);
                const providerPayload: unknown = await providerResponse.json();
                if (!providerResponse.ok) throw new Error('Current provider snapshot is unavailable.');
                const current = parseResearchSnapshotResponse(providerPayload);
                if (active) {
                    setRecord(selected);
                    setSnapshot(current);
                    setHistory(memoryResult.history);
                    setHistorySource(memoryResult.source);
                    setStatus('ready');
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                if (active) {
                    setStatus('unavailable');
                    setMessage(error instanceof Error ? error.message : 'Research memory is unavailable.');
                }
            }
        };
        void load();
        return () => {
            active = false;
            controller.abort();
        };
    }, [ticker]);

    const model = useMemo(() => {
        if (!record || !snapshot) return null;
        const current = buildResearchMemorySnapshotFromProvider(record, snapshot);
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
    }, [history, record, snapshot]);

    useEffect(() => {
        if (!model) return;
        writeResearchMemorySnapshot(model.current);
        void fetch(`/api/research/memory/${encodeURIComponent(ticker)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(model.current),
        }).catch(() => undefined);
    }, [model, ticker]);

    const inResearchFlow = (content: ReactNode) => portalHost ? createPortal(content, portalHost) : null;

    if (status === 'loading') {
        return inResearchFlow(
            <section data-testid="research-memory-dock" aria-busy="true" className="mb-3 w-full">
                <div className="rounded-[10px] border border-zinc-700/40 bg-zinc-900/20 p-4 text-sm text-zinc-500">Building decision memory for {ticker}…</div>
            </section>,
        );
    }

    if (!model || !record) {
        return inResearchFlow(
            <section data-testid="research-memory-dock" className="mb-3 w-full">
                <div className="rounded-[10px] border border-zinc-700/40 bg-zinc-900/20 p-4">
                    <strong className="text-sm">Decision memory · {ticker}</strong>
                    <p className="mt-1 text-xs text-zinc-500">{message ?? 'No memory is available yet.'}</p>
                </div>
            </section>,
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
    const historyLabel = historySource === 'server' ? 'synced across devices' : 'local fallback';

    return inResearchFlow(
        <section data-testid="research-memory-dock" className="mb-3 w-full" aria-label={`Decision memory for ${ticker}`}>
            <div className="rounded-[10px] border border-zinc-700/40 bg-zinc-950/30 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Decision memory</p>
                        <h2 className="mt-1 text-lg font-bold">{ticker} · What changed and what needs review</h2>
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
                        <p className="mt-1 text-xs text-zinc-500">Forward EPS is not available in the current provider contract, so Signal does not infer it from trailing P/E.</p>
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
        </section>,
    );
};
