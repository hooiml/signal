'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    getResearchWorkflowTemplate,
    researchWorkflowTemplates,
    sortResearchWorkflowTasks,
    upsertResearchWorkflowTask,
    type ResearchWorkflowTask,
    type ResearchWorkflowSource,
    type ResearchWorkflowTemplateId,
} from '@/lib/research/workflow-queue';
import {
    readResearchWorkflowTasks,
    RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT,
    RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY,
    writeResearchWorkflowTasks,
} from '@/lib/research/workflow-queue-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const sourceLabels: Readonly<Record<ResearchWorkflowSource, string>> = {
    manual: 'Manual',
    'thesis-change': 'Thesis change',
    'evidence-coverage': 'Evidence coverage',
    'policy-guardrail': 'Policy guardrail',
    'document-diff': 'Filing evidence',
    calendar: 'Calendar',
    alert: 'Alert',
    'structured-trigger': 'Structured trigger',
    'market-exposure': 'Market exposure',
};

export const ResearchWorkflowQueueV6 = ({ records, theme, onStart }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onStart: (symbol: string, templateId: ResearchWorkflowTemplateId) => void;
}) => {
    const styles = getThemeV6(theme);
    const [tasks, setTasks] = useState<readonly ResearchWorkflowTask[]>([]);
    const [symbol, setSymbol] = useState(records[0]?.symbol ?? '');
    const [templateId, setTemplateId] = useState<ResearchWorkflowTemplateId>('earnings-update');
    const [dueAt, setDueAt] = useState('');
    const ordered = useMemo(() => sortResearchWorkflowTasks(tasks), [tasks]);
    const today = new Date().toISOString().slice(0, 10);
    const pending = ordered.filter((task) => task.completedAt === null);
    const overdue = pending.filter((task) => task.dueAt !== null && task.dueAt < today);

    useEffect(() => {
        const refresh = () => setTasks(readResearchWorkflowTasks());
        const refreshFromStorage = (event: StorageEvent) => {
            if (event.key === RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY) refresh();
        };
        refresh();
        window.addEventListener(RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT, refresh);
        window.addEventListener('storage', refreshFromStorage);
        return () => {
            window.removeEventListener(RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT, refresh);
            window.removeEventListener('storage', refreshFromStorage);
        };
    }, []);

    const updateTasks = (next: readonly ResearchWorkflowTask[]) => setTasks(writeResearchWorkflowTasks(next));
    const createTask = () => {
        if (!symbol) return;
        const task: ResearchWorkflowTask = {
            id: crypto.randomUUID(),
            symbol,
            templateId,
            source: 'manual',
            dedupeKey: null,
            dueAt: dueAt || null,
            createdAt: new Date().toISOString(),
            completedAt: null,
        };
        updateTasks(upsertResearchWorkflowTask(tasks, task));
        setDueAt('');
    };

    return <section data-testid="research-workflow-queue" aria-labelledby="research-workflow-title" className="min-w-0 flex-1">
        <div className="max-w-3xl">
            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Structured review planning</p>
            <h1 id="research-workflow-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Research workflow queue</h1>
            <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>Queue a focused review template without creating a second research record. Templates reduce narrative fields while keeping the full checklist, decision state, risk controls, and explicit save.</p>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
            <section className={'rounded border p-4 ' + styles.panelUtility} aria-labelledby="new-workflow-title">
                <h2 id="new-workflow-title" className={'text-sm font-bold ' + styles.textPrimary}>Queue a review</h2>
                {records.length > 0 ? <div className="mt-4 grid gap-3">
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Ticker
                        <select value={symbol} onChange={(event) => setSymbol(event.target.value)} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary}>
                            {records.map((record) => <option key={record.symbol} value={record.symbol}>{record.symbol} · {record.companyName}</option>)}
                        </select>
                    </label>
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Template
                        <select value={templateId} onChange={(event) => setTemplateId(event.target.value as ResearchWorkflowTemplateId)} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary}>
                            {researchWorkflowTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                        </select>
                    </label>
                    <p className={'rounded border p-3 text-xs leading-5 ' + styles.row + ' ' + styles.textSecondary}>{getResearchWorkflowTemplate(templateId).description}</p>
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Due date <span className="font-normal">(optional)</span>
                        <input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={'mt-1 h-11 w-full rounded border px-3 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary} />
                    </label>
                    <button type="button" onClick={createTask} className="min-h-11 rounded bg-emerald-500 px-4 text-sm font-bold text-slate-950">Add to queue</button>
                </div> : <p className={'mt-3 text-sm ' + styles.textMuted}>Add a saved research record before creating a workflow task.</p>}
            </section>

            <section className="min-w-0" aria-labelledby="queued-reviews-title">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div><h2 id="queued-reviews-title" className={'text-sm font-bold ' + styles.textPrimary}>Queued reviews</h2><p className={'mt-1 text-xs ' + styles.textMuted}>{pending.length} pending · {overdue.length} overdue · {ordered.length - pending.length} completed</p></div>
                </div>
                {ordered.length > 0 ? <ul className={'mt-3 divide-y border-y ' + styles.divider}>
                    {ordered.map((task) => {
                        const template = getResearchWorkflowTemplate(task.templateId);
                        const isOverdue = task.completedAt === null && task.dueAt !== null && task.dueAt < today;
                        return <li key={task.id} className={'py-4 ' + (task.completedAt ? 'opacity-65' : '')}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className={'text-sm font-bold ' + styles.textPrimary}>{task.symbol} · {template.name}</p>
                                        <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + styles.row}>{sourceLabels[task.source]}</span>
                                        {isOverdue ? <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + styles.risk}>Overdue</span> : null}
                                        {task.completedAt ? <span className={'rounded border px-2 py-0.5 text-[10px] font-bold uppercase ' + styles.positive}>Completed</span> : null}
                                    </div>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{template.description}</p>
                                    <p className={'mt-1 text-[11px] ' + styles.textMuted}>{task.dueAt ? `Due ${task.dueAt}` : 'No due date'} · queued {new Date(task.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    {task.completedAt === null ? <button type="button" onClick={() => onStart(task.symbol, task.templateId)} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">Start review</button> : null}
                                    <button type="button" onClick={() => updateTasks(upsertResearchWorkflowTask(tasks, { ...task, completedAt: task.completedAt ? null : new Date().toISOString() }))} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>{task.completedAt ? 'Reopen' : 'Mark complete'}</button>
                                    <button type="button" aria-label={`Remove ${task.symbol} ${template.name} task`} onClick={() => updateTasks(tasks.filter((item) => item.id !== task.id))} className={'min-h-10 px-2 text-xs font-semibold ' + styles.risk}>Remove</button>
                                </div>
                            </div>
                        </li>;
                    })}
                </ul> : <div className={'mt-3 rounded border p-8 text-center ' + styles.panelUtility}><h3 className={'text-base font-bold ' + styles.textPrimary}>No queued reviews</h3><p className={'mt-2 text-sm ' + styles.textMuted}>Choose a ticker and template to create the first focused review.</p></div>}
            </section>
        </div>
        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>Queue tasks are stored only in this browser. Completing or removing a task never changes a saved research record; only Save review does.</p>
    </section>;
};
