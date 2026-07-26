'use client';

import { useMemo, useState } from 'react';
import {
    buildEvidenceCoverage,
    type EvidenceCoverageItem,
    type EvidenceCoverageStatus,
} from '@/lib/research/evidence-coverage';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const statusLabels: Readonly<Record<EvidenceCoverageStatus, string>> = {
    supported: 'Supported',
    stale: 'Stale',
    conflicting: 'Conflicting',
    assumption: 'Assumption',
    missing: 'Missing',
};

const statusExplanation = (item: EvidenceCoverageItem): string => {
    if (item.status === 'supported') return `Current evidence is within the ${item.freshnessDays}-day rule.`;
    if (item.status === 'stale') return `Latest evidence exceeds the ${item.freshnessDays}-day rule.`;
    if (item.status === 'conflicting') return 'Accepted evidence contains both positive and risk findings.';
    if (item.status === 'assumption') return 'Saved analysis has no accepted source evidence.';
    return item.evidence.length > 0
        ? 'Accepted evidence exists, but the saved analysis field is empty.'
        : 'Both saved analysis and accepted evidence are missing.';
};

export const EvidenceCoverageDashboardV6 = ({ records, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const [symbol, setSymbol] = useState(records[0]?.symbol ?? '');
    const [queueStatus, setQueueStatus] = useState<string | null>(null);
    const record = records.find((item) => item.symbol === symbol) ?? records[0] ?? null;
    const coverage = useMemo(() => record ? buildEvidenceCoverage(record) : null, [record]);

    if (!record || !coverage) return <section className="min-w-0 flex-1 p-8 text-center">
        <h1 className={'text-lg font-bold ' + styles.textPrimary}>Evidence coverage</h1>
        <p className={'mt-2 text-sm ' + styles.textMuted}>Add a saved research record before reviewing evidence coverage.</p>
    </section>;

    return <section data-testid="evidence-coverage-dashboard" aria-labelledby="evidence-coverage-title" className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Decision evidence quality</p>
                <h1 id="evidence-coverage-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Evidence coverage and freshness</h1>
                <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>
                    Map every saved thesis field to accepted evidence and an explicit freshness rule. Coverage is a research-quality prompt, not a recommendation score.
                </p>
            </div>
            <label className={'min-w-52 text-xs font-semibold ' + styles.textMuted}>Ticker
                <select value={record.symbol} onChange={(event) => {
                    setSymbol(event.target.value);
                    setQueueStatus(null);
                }} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary}>
                    {records.map((item) => <option key={item.symbol} value={item.symbol}>{item.symbol} · {item.companyName}</option>)}
                </select>
            </label>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
                ['Supported', coverage.supported, styles.positive],
                ['Stale', coverage.stale, styles.risk],
                ['Conflicting', coverage.conflicting, styles.risk],
                ['Assumptions', coverage.assumption, styles.textSecondary],
                ['Missing', coverage.missing, styles.textMuted],
            ].map(([label, value, tone]) => <div key={String(label)} className={'rounded border p-3 ' + styles.panelUtility}>
                <p className={'text-xs ' + styles.textMuted}>{label}</p>
                <p className={'mt-1 text-2xl font-bold ' + tone}>{value}</p>
            </div>)}
        </div>

        <div className={'mt-4 rounded border p-4 ' + styles.panelAction}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className={'text-sm font-bold ' + styles.textPrimary}>{coverage.coveragePercent}% currently supported</p>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Supported fields have saved analysis, accepted evidence, no mixed positive/risk conflict, and evidence inside the field-specific freshness window.</p>
                </div>
                <button type="button" onClick={() => onOpen(record.symbol)} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">Open research</button>
            </div>
        </div>

        {queueStatus ? <p role="status" className={'mt-3 text-xs ' + styles.positive}>{queueStatus}</p> : null}

        <ul className={'mt-4 divide-y border-y ' + styles.divider}>
            {coverage.items.map((item) => <li key={item.target} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className={'text-sm font-bold ' + styles.textPrimary}>{item.label}</h2>
                            <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + (item.status === 'supported' ? styles.positive : item.status === 'stale' || item.status === 'conflicting' ? styles.risk : styles.row)}>
                                {statusLabels[item.status]}
                            </span>
                            <span className={'text-[11px] ' + styles.textMuted}>{item.freshnessDays}-day rule</span>
                        </div>
                        <p className={'mt-1 text-xs leading-5 ' + styles.textSecondary}>{statusExplanation(item)}</p>
                        <p className={'mt-1 text-[11px] ' + styles.textMuted}>
                            {item.evidence.length} accepted finding{item.evidence.length === 1 ? '' : 's'}
                            {item.latestEvidenceAt ? ` · latest basis ${item.latestEvidenceAt.slice(0, 10)}` : ''}
                            {item.ageDays !== null ? ` · ${item.ageDays} days old` : ''}
                        </p>
                        {item.evidence.length > 0 ? <div className="mt-2 flex flex-wrap gap-2">
                            {item.evidence.map((evidence) => <span key={evidence.id} className={'rounded border px-2 py-1 text-[11px] ' + styles.row}>{evidence.title}</span>)}
                        </div> : null}
                    </div>
                    {item.status !== 'supported' ? <button type="button" aria-label={`Queue ${record.symbol} ${item.label} evidence review`} onClick={() => {
                        const result = enqueueResearchWorkflowTaskClient({
                            symbol: record.symbol,
                            templateId: 'thesis-challenge',
                            source: 'evidence-coverage',
                            dueAt: new Date().toISOString().slice(0, 10),
                        });
                        setQueueStatus(result.created
                            ? `${record.symbol} evidence review added to the Queue.`
                            : `${record.symbol} already has an evidence review in the Queue.`);
                    }} className={'min-h-10 shrink-0 rounded border px-3 text-xs font-semibold ' + styles.row}>Queue review</button> : null}
                </div>
            </li>)}
        </ul>

        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>
            Freshness uses the latest valid reporting period when available and otherwise the accepted date. Empty fields remain missing even when evidence is attached; evidence must be reviewed and saved explicitly.
        </p>
    </section>;
};
