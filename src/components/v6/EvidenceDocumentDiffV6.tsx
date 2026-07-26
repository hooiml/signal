'use client';

import { useMemo, useState } from 'react';
import {
    buildEvidenceDocumentDiff,
    evidenceDocumentCategories,
    type EvidenceDocumentCategory,
    type EvidenceDocumentChangeKind,
} from '@/lib/research/evidence-document-diff';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type DiffFilter = 'all' | Exclude<EvidenceDocumentChangeKind, 'unchanged'>;

const kindLabels: Readonly<Record<EvidenceDocumentChangeKind, string>> = {
    added: 'Added',
    changed: 'Changed',
    removed: 'Removed',
    unchanged: 'Unchanged',
};

const categoryLabels: Readonly<Record<EvidenceDocumentCategory, string>> = {
    guidance: 'Guidance',
    risk: 'Risk',
    margin: 'Margins',
    debt: 'Debt',
    'cash-flow': 'Cash flow',
    growth: 'Growth / earnings',
    other: 'Other evidence',
};

export const EvidenceDocumentDiffV6 = ({ records, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const [symbol, setSymbol] = useState(records[0]?.symbol ?? '');
    const [filter, setFilter] = useState<DiffFilter>('all');
    const [category, setCategory] = useState<EvidenceDocumentCategory | 'all'>('all');
    const [showUnchanged, setShowUnchanged] = useState(false);
    const [queueStatus, setQueueStatus] = useState<string | null>(null);
    const record = records.find((item) => item.symbol === symbol) ?? records[0] ?? null;
    const diff = useMemo(() => record ? buildEvidenceDocumentDiff(record) : null, [record]);
    const visible = useMemo(() => (diff?.items ?? []).filter((item) =>
        (showUnchanged || item.kind !== 'unchanged')
        && (filter === 'all' || item.kind === filter)
        && (category === 'all' || item.category === category)), [category, diff?.items, filter, showUnchanged]);
    const actionableCount = (diff?.items ?? []).filter((item) => item.kind !== 'unchanged').length;

    if (!record || !diff) return <section className="min-w-0 flex-1 p-8 text-center"><h1 className={'text-lg font-bold ' + styles.textPrimary}>Filing and earnings evidence diff</h1><p className={'mt-2 text-sm ' + styles.textMuted}>Add a saved research record to compare evidence versions.</p></section>;

    return <section data-testid="evidence-document-diff" aria-labelledby="evidence-document-diff-title" className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Cited version comparison</p>
                <h1 id="evidence-document-diff-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Filing and earnings evidence diff</h1>
                <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>Compare structured accepted evidence with the prior saved review. This is not a raw filing-prose or management-language diff; only provider values, reporting periods, and citations already retained by Signal are compared.</p>
            </div>
            <label className={'min-w-52 text-xs font-semibold ' + styles.textMuted}>Ticker
                <select aria-label="Evidence ticker" value={record.symbol} onChange={(event) => {
                    setSymbol(event.target.value);
                    setQueueStatus(null);
                }} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary}>
                    {records.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.companyName}</option>)}
                </select>
            </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
                ['Evidence changes', actionableCount],
                ['Current version', diff.currentAt.slice(0, 10)],
                ['Prior baseline', diff.baselineAt?.slice(0, 10) ?? 'Unavailable'],
            ].map(([label, value]) => <div key={String(label)} className={'rounded border p-3 ' + styles.panelUtility}><p className={'text-xs ' + styles.textMuted}>{label}</p><p className={'mt-1 text-lg font-bold ' + styles.textPrimary}>{value}</p></div>)}
        </div>

        {!diff.hasBaseline ? <p role="status" className={'mt-3 rounded border px-3 py-2 text-xs leading-5 ' + styles.row + ' ' + styles.textMuted}>This record does not have two saved review versions. Current evidence is shown as added against an empty baseline.</p> : null}

        <div className={'mt-4 grid gap-3 rounded border p-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto] ' + styles.panelUtility}>
            <label className={'text-xs font-semibold ' + styles.textMuted}>Change
                <select aria-label="Evidence change" value={filter} onChange={(event) => setFilter(event.target.value as DiffFilter)} className={'mt-1 h-10 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary}>
                    <option value="all">All changes</option><option value="added">Added</option><option value="changed">Changed</option><option value="removed">Removed</option>
                </select>
            </label>
            <label className={'text-xs font-semibold ' + styles.textMuted}>Category
                <select aria-label="Evidence category" value={category} onChange={(event) => setCategory(event.target.value as EvidenceDocumentCategory | 'all')} className={'mt-1 h-10 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary}>
                    <option value="all">All categories</option>{evidenceDocumentCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
                </select>
            </label>
            <label className={'flex min-h-10 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}><input type="checkbox" checked={showUnchanged} onChange={(event) => setShowUnchanged(event.target.checked)} />Show unchanged</label>
        </div>

        {queueStatus ? <p role="status" className={'mt-3 text-xs ' + styles.positive}>{queueStatus}</p> : null}

        {visible.length > 0 ? <ul className={'mt-4 divide-y border-y ' + styles.divider}>
            {visible.map((item) => {
                const current = item.after ?? item.before;
                return <li key={item.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + (item.kind === 'changed' || item.kind === 'removed' ? styles.risk : item.kind === 'added' ? styles.positive : styles.row)}>{kindLabels[item.kind]}</span>
                                <span className={'text-[11px] font-semibold ' + styles.textMuted}>{categoryLabels[item.category]}</span>
                                <h2 className={'text-sm font-bold ' + styles.textPrimary}>{current?.label}</h2>
                            </div>
                            <p className={'mt-1 text-xs ' + styles.textMuted}>{current?.findingTitle}</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className={'rounded border p-3 ' + styles.panelUtility}><p className={'text-[11px] font-semibold uppercase ' + styles.textMuted}>Prior</p><p className={'mt-1 text-sm ' + styles.textPrimary}>{item.before?.value ?? 'Not present'}</p><p className={'mt-1 text-[11px] ' + styles.textMuted}>{item.before?.reportingPeriod ?? 'No reporting period'}</p></div>
                                <div className={'rounded border p-3 ' + styles.panelUtility}><p className={'text-[11px] font-semibold uppercase ' + styles.textMuted}>Current</p><p className={'mt-1 text-sm ' + styles.textPrimary}>{item.after?.value ?? 'Removed'}</p><p className={'mt-1 text-[11px] ' + styles.textMuted}>{item.after?.reportingPeriod ?? 'No reporting period'}</p></div>
                            </div>
                            {current ? <a href={current.sourceUrl} target="_blank" rel="noreferrer" className={'mt-2 inline-flex min-h-10 items-center text-xs underline decoration-dotted underline-offset-2 ' + styles.textSecondary}>{current.source} citation</a> : null}
                        </div>
                        {item.kind !== 'unchanged' ? <button type="button" aria-label={`Queue ${record.symbol} filing evidence review`} onClick={() => {
                            const result = enqueueResearchWorkflowTaskClient({
                                symbol: record.symbol,
                                templateId: 'post-event',
                                source: 'document-diff',
                                dueAt: new Date().toISOString().slice(0, 10),
                            });
                            setQueueStatus(result.created
                                ? `${record.symbol} filing evidence review added to the Queue.`
                                : `${record.symbol} already has a filing evidence review in the Queue.`);
                        }} className="min-h-10 shrink-0 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">Queue review</button> : null}
                    </div>
                </li>;
            })}
        </ul> : <div className={'mt-4 rounded border p-8 text-center ' + styles.panelUtility}><h2 className={'text-base font-bold ' + styles.textPrimary}>No evidence changes in this view</h2><p className={'mt-2 text-sm ' + styles.textMuted}>Change the filters, show unchanged evidence, or save another sourced review.</p></div>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className={'text-xs leading-5 ' + styles.textMuted}>Categories are deterministic label matching for navigation only; they do not infer materiality or management intent.</p>
            <button type="button" onClick={() => onOpen(record.symbol)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Open research</button>
        </div>
    </section>;
};
