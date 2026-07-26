'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseResearchAssistantResponse } from '@/lib/research/assistant-input';
import {
    buildThesisChangeItems,
    stageThesisChangeEvidence,
    type ThesisChangeItem,
} from '@/lib/research/thesis-change';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import type { AcceptedResearchEvidence, ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const dismissedStorageKey = 'signal-thesis-change-dismissed-v1';
const targetLabels: Readonly<Record<ThesisChangeItem['finding']['target'], string>> = {
    whyInterested: 'Why interested',
    bullCase: 'Bull case',
    bearCase: 'Bear case',
    thesisBreak: 'Thesis invalidation',
    buyTrigger: 'Buy trigger',
    sellTrigger: 'Sell trigger',
    notes: 'Review notes',
};

const readDismissed = () => {
    try {
        const parsed: unknown = JSON.parse(localStorage.getItem(dismissedStorageKey) ?? '[]');
        return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(-100) : []);
    } catch {
        return new Set<string>();
    }
};

const writeDismissed = (values: ReadonlySet<string>) => {
    localStorage.setItem(dismissedStorageKey, JSON.stringify([...values].slice(-100)));
};

export const ThesisChangeInboxV6 = ({ records, theme, onStage }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onStage: (symbol: string, evidence: AcceptedResearchEvidence) => void;
}) => {
    const styles = getThemeV6(theme);
    const [items, setItems] = useState<readonly ThesisChangeItem[]>([]);
    const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => typeof window === 'undefined' ? new Set() : readDismissed());
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [failedSymbols, setFailedSymbols] = useState<readonly string[]>([]);
    const [showSeen, setShowSeen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [queueStatus, setQueueStatus] = useState<string | null>(null);

    const scan = useCallback(async (signal: AbortSignal) => {
        const next: ThesisChangeItem[] = [];
        const failures: string[] = [];
        const candidates = records.slice(0, 8);
        for (let index = 0; index < candidates.length; index += 2) {
            const batch = candidates.slice(index, index + 2);
            const results = await Promise.allSettled(batch.map(async (record) => {
                const response = await fetch(`/api/research/assist/${encodeURIComponent(record.symbol)}?market=${record.market}`, {
                    method: 'POST',
                    signal,
                });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error('Unable to prepare change evidence.');
                return buildThesisChangeItems(record, parseResearchAssistantResponse(payload));
            }));
            if (signal.aborted) return;
            results.forEach((result, batchIndex) => {
                if (result.status === 'fulfilled') next.push(...result.value);
                else if (batch[batchIndex]) failures.push(batch[batchIndex].symbol);
            });
        }
        if (signal.aborted) return;
        setItems(next.sort((left, right) =>
            Number(right.status === 'changed') - Number(left.status === 'changed')
            || Number(right.finding.tone === 'risk') - Number(left.finding.tone === 'risk')
            || left.symbol.localeCompare(right.symbol)));
        setFailedSymbols(failures);
        setState(next.length === 0 && failures.length === candidates.length && candidates.length > 0 ? 'error' : 'ready');
    }, [records]);

    useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => void scan(controller.signal), 0);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [refreshKey, scan]);

    const visible = useMemo(() => items.filter((item) =>
        !dismissed.has(item.id) && (showSeen || item.status !== 'unchanged')), [dismissed, items, showSeen]);
    const pendingCount = items.filter((item) => item.status !== 'unchanged' && !dismissed.has(item.id)).length;
    const changedCount = items.filter((item) => item.status === 'changed' && !dismissed.has(item.id)).length;

    const dismiss = (id: string) => {
        const next = new Set([...dismissed, id]);
        setDismissed(next);
        writeDismissed(next);
    };

    const queueReview = (item: ThesisChangeItem) => {
        const result = enqueueResearchWorkflowTaskClient({
            symbol: item.symbol,
            templateId: 'thesis-challenge',
            source: 'thesis-change',
            dueAt: new Date().toISOString().slice(0, 10),
        });
        setQueueStatus(result.created
            ? `${item.symbol} thesis challenge added to the Queue.`
            : `${item.symbol} already has this thesis-change review in the Queue.`);
    };

    return <section data-testid="thesis-change-inbox" aria-labelledby="thesis-change-title" className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Evidence change queue</p>
                <h1 id="thesis-change-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Thesis-change inbox</h1>
                <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>
                    Compare current sourced findings with the evidence already accepted into each record. Staging evidence opens an editable review but never rewrites the saved thesis.
                </p>
            </div>
            <button type="button" disabled={state === 'loading'} onClick={() => {
                setState('loading');
                setFailedSymbols([]);
                setRefreshKey((value) => value + 1);
            }} className={'min-h-10 rounded border px-3 text-xs font-bold disabled:opacity-50 ' + styles.row}>
                {state === 'loading' ? 'Checking evidence...' : 'Check again'}
            </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
                ['Needs review', pendingCount, 'New or changed sourced findings'],
                ['Changed evidence', changedCount, 'Previously accepted source value changed'],
                ['Coverage', `${Math.min(records.length, 8) - failedSymbols.length}/${Math.min(records.length, 8)}`, 'Records checked in this bounded scan'],
            ].map(([label, value, detail]) => <div key={String(label)} className={'rounded border p-3 ' + styles.panelUtility}>
                <p className={'text-xs ' + styles.textMuted}>{label}</p>
                <p className={'mt-1 text-xl font-bold ' + styles.textPrimary}>{value}</p>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{detail}</p>
            </div>)}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className={'text-xs ' + styles.textMuted}>Up to 8 saved records · 2 requests at a time · Yahoo/SEC evidence already used by assisted review</p>
            <label className={'flex min-h-10 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}>
                <input type="checkbox" checked={showSeen} onChange={(event) => setShowSeen(event.target.checked)} />
                Show unchanged evidence
            </label>
        </div>

        {failedSymbols.length > 0 ? <p role="status" className={'mt-3 text-xs ' + styles.risk}>Evidence was unavailable for {failedSymbols.join(', ')}. Other records remain usable.</p> : null}
        {queueStatus ? <p role="status" className={'mt-3 text-xs ' + styles.positive}>{queueStatus}</p> : null}
        {state === 'error' ? <div className={'mt-4 rounded border p-6 text-center ' + styles.panelUtility}><h2 className={'text-base font-bold ' + styles.textPrimary}>Evidence scan unavailable</h2><p className={'mt-2 text-sm ' + styles.textMuted}>Use Check again when the connected research sources recover.</p></div> : null}

        {state === 'ready' && visible.length > 0 ? <ul className={'mt-4 divide-y border-y ' + styles.divider}>
            {visible.map((item) => {
                const tone = item.finding.tone === 'risk' ? styles.risk : item.finding.tone === 'positive' ? styles.positive : styles.textSecondary;
                return <li key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={'text-xs font-bold ' + styles.textPrimary}>{item.symbol}</span>
                                <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ' + (item.status === 'changed' ? styles.risk : styles.row)}>{item.status}</span>
                                <span className={'text-[11px] ' + styles.textMuted}>{targetLabels[item.finding.target]}</span>
                            </div>
                            <h2 className={'mt-2 text-sm font-bold ' + tone}>{item.finding.title}</h2>
                            <p className={'mt-1 text-sm leading-6 ' + styles.textPrimary}>{item.finding.summary}</p>
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                {item.sources.map((source) => <a key={source.id + source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer" className={'text-[11px] underline decoration-dotted underline-offset-2 ' + styles.textMuted}>
                                    {source.label}: {source.value} · {source.source}{source.reportingPeriod ? ` · ${source.reportingPeriod}` : ''}
                                </a>)}
                            </div>
                            <div className={'mt-3 rounded border p-3 text-xs leading-5 ' + styles.panelUtility}>
                                <p className={'font-semibold ' + styles.textSecondary}>{item.relationship === 'updated-evidence' ? 'Accepted source changed' : item.relationship === 'reflected' ? 'Finding text already appears in the saved field' : 'Finding is not copied into the saved field'}</p>
                                <p className={'mt-1 line-clamp-3 whitespace-pre-wrap ' + styles.textMuted}>{item.savedText.trim() || `${targetLabels[item.finding.target]} is currently empty.`}</p>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            {item.status !== 'unchanged' ? <button type="button" onClick={() => onStage(item.symbol, stageThesisChangeEvidence(item))} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">Stage evidence</button> : null}
                            {item.status !== 'unchanged' ? <button type="button" aria-label={`Queue ${item.symbol} thesis challenge`} onClick={() => queueReview(item)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Queue challenge</button> : null}
                            <button type="button" onClick={() => dismiss(item.id)} className={'min-h-10 px-2 text-xs font-semibold ' + styles.textMuted}>Dismiss</button>
                        </div>
                    </div>
                </li>;
            })}
        </ul> : null}

        {state === 'ready' && visible.length === 0 ? <div className={'mt-4 rounded border p-8 text-center ' + styles.panelUtility}>
            <h2 className={'text-base font-bold ' + styles.textPrimary}>{pendingCount === 0 ? 'No new thesis evidence' : 'All visible changes are dismissed'}</h2>
            <p className={'mt-2 text-sm ' + styles.textMuted}>{pendingCount === 0 ? 'Current findings match previously accepted source versions, or connected sources returned no material finding.' : 'Check again later or show unchanged evidence.'}</p>
        </div> : null}

        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>This queue compares source IDs, values, and reporting periods. It does not infer whether wording is economically material, verify causation, or decide whether a thesis remains valid.</p>
    </section>;
};
