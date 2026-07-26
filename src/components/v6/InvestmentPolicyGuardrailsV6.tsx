'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    assessInvestmentPolicy,
    defaultInvestmentPolicy,
    type InvestmentPolicy,
} from '@/lib/research/investment-policy';
import { readInvestmentPolicy, writeInvestmentPolicy } from '@/lib/research/investment-policy-client';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const percentFields: readonly {
    readonly key: 'maxSingleAllocationPercent' | 'maxSectorAllocationPercent' | 'minEvidenceCoveragePercent';
    readonly label: string;
}[] = [
    { key: 'maxSingleAllocationPercent', label: 'Maximum single-name allocation' },
    { key: 'maxSectorAllocationPercent', label: 'Maximum sector allocation' },
    { key: 'minEvidenceCoveragePercent', label: 'Minimum evidence coverage' },
];

export const InvestmentPolicyGuardrailsV6 = ({ records, items, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const [policy, setPolicy] = useState<InvestmentPolicy>(defaultInvestmentPolicy);
    const [savedStatus, setSavedStatus] = useState<string | null>(null);
    const [queueStatus, setQueueStatus] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => setPolicy(readInvestmentPolicy()), 0);
        return () => window.clearTimeout(timer);
    }, []);

    const assessments = useMemo(() => assessInvestmentPolicy(records.map((record) => ({
        record,
        sector: items.find((item) => item.symbol === record.symbol)?.sector ?? 'Unclassified',
    })), policy), [items, policy, records]);
    const violationCount = assessments.reduce((total, item) => total + item.violations.length, 0);
    const compliantCount = assessments.filter((item) => item.compliant).length;

    return <section data-testid="investment-policy-guardrails" aria-labelledby="investment-policy-title" className="min-w-0 flex-1">
        <div className="max-w-3xl">
            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Personal decision discipline</p>
            <h1 id="investment-policy-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Investment-policy guardrails</h1>
            <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>
                Compare saved plans and decisions with your browser-local limits. Violations are review prompts only and never block, downgrade, or rewrite a saved decision.
            </p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.28fr)]">
            <section className={'rounded border p-4 ' + styles.panelUtility} aria-labelledby="policy-limits-title">
                <h2 id="policy-limits-title" className={'text-sm font-bold ' + styles.textPrimary}>Policy limits</h2>
                <div className="mt-4 grid gap-3">
                    {percentFields.map((field) => <label key={field.key} className={'text-xs font-semibold ' + styles.textMuted}>{field.label}
                        <span className="relative mt-1 block">
                            <input type="number" min="1" max="100" step="1" value={policy[field.key]} onChange={(event) => setPolicy((current) => ({
                                ...current,
                                [field.key]: Math.min(100, Math.max(1, Number(event.target.value) || 1)),
                            }))} className={'h-11 w-full rounded border px-3 pr-8 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary} />
                            <span className={'pointer-events-none absolute right-3 top-3 text-sm ' + styles.textMuted}>%</span>
                        </span>
                    </label>)}
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Maximum review age
                        <span className="relative mt-1 block">
                            <input type="number" min="1" max="730" step="1" value={policy.maxReviewAgeDays} onChange={(event) => setPolicy((current) => ({
                                ...current,
                                maxReviewAgeDays: Math.min(730, Math.max(1, Number(event.target.value) || 1)),
                            }))} className={'h-11 w-full rounded border px-3 pr-14 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary} />
                            <span className={'pointer-events-none absolute right-3 top-3 text-sm ' + styles.textMuted}>days</span>
                        </span>
                    </label>
                    <label className={'flex min-h-11 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}>
                        <input type="checkbox" checked={policy.requireFairOrCheapForReady} onChange={(event) => setPolicy((current) => ({ ...current, requireFairOrCheapForReady: event.target.checked }))} />
                        Require cheap or fair valuation for Ready/DCA
                    </label>
                    <button type="button" onClick={() => {
                        setPolicy(writeInvestmentPolicy(policy));
                        setSavedStatus('Policy saved in this browser.');
                    }} className="min-h-11 rounded bg-emerald-500 px-4 text-sm font-bold text-slate-950">Save policy</button>
                    {savedStatus ? <p role="status" className={'text-xs ' + styles.positive}>{savedStatus}</p> : null}
                </div>
            </section>

            <section className="min-w-0" aria-labelledby="policy-assessment-title">
                <div className="grid gap-3 sm:grid-cols-3">
                    {[
                        ['Records checked', assessments.length],
                        ['Within policy', compliantCount],
                        ['Violations', violationCount],
                    ].map(([label, value]) => <div key={String(label)} className={'rounded border p-3 ' + styles.panelUtility}>
                        <p className={'text-xs ' + styles.textMuted}>{label}</p>
                        <p className={'mt-1 text-2xl font-bold ' + styles.textPrimary}>{value}</p>
                    </div>)}
                </div>
                {queueStatus ? <p role="status" className={'mt-3 text-xs ' + styles.positive}>{queueStatus}</p> : null}
                <h2 id="policy-assessment-title" className="sr-only">Policy assessment</h2>
                {assessments.length > 0 ? <ul className={'mt-4 divide-y border-y ' + styles.divider}>
                    {assessments.map((assessment) => <li key={assessment.symbol} className="py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className={'text-sm font-bold ' + styles.textPrimary}>{assessment.symbol}</h3>
                                    <span className={'text-xs ' + styles.textMuted}>{assessment.sector}</span>
                                    <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + (assessment.compliant ? styles.positive : styles.risk)}>
                                        {assessment.compliant ? 'Within policy' : `${assessment.violations.length} violation${assessment.violations.length === 1 ? '' : 's'}`}
                                    </span>
                                </div>
                                <p className={'mt-1 text-[11px] ' + styles.textMuted}>{assessment.evidenceCoveragePercent}% evidence coverage · reviewed {assessment.reviewAgeDays} days ago</p>
                                {assessment.violations.length > 0 ? <ul className="mt-2 space-y-1">
                                    {assessment.violations.map((violation) => <li key={violation.kind} className={'text-xs leading-5 ' + styles.risk}>{violation.message}</li>)}
                                </ul> : <p className={'mt-2 text-xs ' + styles.textSecondary}>No current saved input exceeds these guardrails.</p>}
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                                <button type="button" onClick={() => onOpen(assessment.symbol)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Open research</button>
                                {!assessment.compliant ? <button type="button" aria-label={`Queue ${assessment.symbol} policy review`} onClick={() => {
                                    const result = enqueueResearchWorkflowTaskClient({
                                        symbol: assessment.symbol,
                                        templateId: 'thesis-challenge',
                                        source: 'policy-guardrail',
                                        dueAt: new Date().toISOString().slice(0, 10),
                                    });
                                    setQueueStatus(result.created
                                        ? `${assessment.symbol} policy review added to the Queue.`
                                        : `${assessment.symbol} already has a policy review in the Queue.`);
                                }} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">Queue review</button> : null}
                            </div>
                        </div>
                    </li>)}
                </ul> : <div className={'mt-4 rounded border p-8 text-center ' + styles.panelUtility}><p className={'text-sm ' + styles.textMuted}>Add saved research records to evaluate this policy.</p></div>}
            </section>
        </div>

        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>Policy settings stay in this browser. Sector totals use positive planned allocations only; missing allocations are excluded rather than treated as risk-free.</p>
    </section>;
};
