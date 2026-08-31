'use client';

import { useEffect, useMemo, useState } from 'react';
import { LearnBusinessApplyV2 } from './LearnBusinessApplyV2';
import { LearnBusinessConceptsV2 } from './LearnBusinessConceptsV2';
import { LearnBusinessReplayV2 } from './LearnBusinessReplayV2';
import { LearnFinancialsLabV2 } from './LearnFinancialsLabV2';
import {
    emptyLearnProgressV02,
    learnModulesV02,
    parseLearnProgressV02,
    type LearnModuleIdV02,
    type LearnProgressV02,
    type LearnReflectionV02,
} from '@/lib/learn/v0-2';

type BusinessWorkspace = 'concepts' | 'lab' | 'replay' | 'apply';
const progressKey = 'signal-learn-v0.2-progress';

export const LearnBusinessWorkspaceV2 = () => {
    const [workspace, setWorkspace] = useState<BusinessWorkspace>('concepts');
    const [moduleId, setModuleId] = useState<LearnModuleIdV02>('revenue');
    const [progressState, setProgressState] = useState<LearnProgressV02>(emptyLearnProgressV02);
    const [progressReady, setProgressReady] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try {
                const raw = window.localStorage.getItem(progressKey);
                setProgressState(parseLearnProgressV02(raw ? JSON.parse(raw) : null));
            } catch {
                setProgressState(emptyLearnProgressV02());
            }
            setProgressReady(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (progressReady) window.localStorage.setItem(progressKey, JSON.stringify(progressState));
    }, [progressReady, progressState]);

    const completed = progressState.completedModules;
    const completedCount = completed.length;
    const completedCases = progressState.reflections.map((item) => item.caseId);
    const nextModule = useMemo(() => learnModulesV02.find((module) => !completed.includes(module.id)) ?? learnModulesV02.at(-1)!, [completed]);

    const toggleModule = () => setProgressState((current) => ({
        ...current,
        completedModules: current.completedModules.includes(moduleId)
            ? current.completedModules.filter((id) => id !== moduleId)
            : [...current.completedModules, moduleId],
    }));
    const saveReflection = (reflection: LearnReflectionV02) => setProgressState((current) => ({
        ...current,
        reflections: [...current.reflections.filter((item) => item.caseId !== reflection.caseId), reflection].slice(-3),
    }));

    return (
        <div data-testid="learn-v0-2">
            <section className="grid gap-5 border-b border-[var(--v7-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-end">
                <div><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Signal Learn - v0.2</p><h1 className="mt-2 max-w-3xl text-2xl font-bold text-[var(--v7-text)] sm:text-3xl">Understand the business behind the valuation.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)] sm:text-[15px]">Trace revenue, margins, cash flow, capital needs, debt, and dilution into EPS and valuation. Reported facts, calculated ratios, and missing inputs remain visibly distinct.</p></div>
                <div data-testid="business-mastery" className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[var(--v7-text-secondary)]">Business foundations</span><span className="font-mono text-xs text-[var(--v7-text-muted)]">{completedCount}/{learnModulesV02.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-[var(--v7-border)]"><div className="h-full bg-[var(--v7-accent)]" style={{ width: `${Math.round((completedCount / learnModulesV02.length) * 100)}%` }} /></div><p className="mt-3 text-xs text-[var(--v7-text-muted)]">Next concept: <button type="button" onClick={() => { setWorkspace('concepts'); setModuleId(nextModule.id); }} className="min-h-10 font-semibold text-[var(--v7-text)] underline underline-offset-2">{nextModule.title}</button></p><dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--v7-border)] pt-3 text-center"><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Understand</dt><dd className="mt-1 font-mono text-xs font-bold">{completedCount}/9</dd></div><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Interpret</dt><dd className="mt-1 font-mono text-xs font-bold">{Math.min(completedCases.length, 2)}/2</dd></div><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Apply</dt><dd className="mt-1 font-mono text-xs font-bold">{progressState.applyCompleted ? '1/1' : '0/1'}</dd></div></dl></div>
            </section>

            <nav aria-label="Business learning workspace" className="research-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">{([
                ['concepts', 'Business concepts', 'Nine connected modules'],
                ['lab', 'Financials Lab', 'Manipulate and trace'],
                ['replay', 'Business replay', 'Commit before reveal'],
                ['apply', 'Apply live', 'Connect drivers to valuation'],
            ] as const).map(([id, label, note]) => <button key={id} type="button" aria-pressed={workspace === id} onClick={() => setWorkspace(id)} className={`min-h-11 min-w-[190px] shrink-0 rounded-[8px] border px-4 text-left ${workspace === id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}><span className="block text-sm font-bold text-[var(--v7-text)]">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--v7-text-muted)]">{note}</span></button>)}</nav>

            <div className="mt-5">
                {workspace === 'concepts' ? <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]"><aside className="min-w-0 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3 lg:self-start"><p className="px-2 pb-2 text-[11px] font-bold uppercase text-[var(--v7-text-muted)]">v0.2 path</p><div className="research-scrollbar flex gap-2 overflow-x-auto lg:grid lg:overflow-visible" aria-label="Business foundation modules">{learnModulesV02.map((module) => { const selected = module.id === moduleId; const done = completed.includes(module.id); return <button key={module.id} type="button" aria-pressed={selected} onClick={() => setModuleId(module.id)} className={`min-h-11 min-w-[190px] rounded-[8px] border px-3 py-2 text-left lg:min-w-0 ${selected ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-transparent hover:border-[var(--v7-border)]'}`}><span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[var(--v7-text)]">{module.eyebrow} - {module.title}</span><span aria-label={done ? 'Completed' : 'Not completed'} className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? 'bg-[var(--v7-accent)]' : 'border border-[var(--v7-border-strong)]'}`} /></span></button>; })}</div></aside><LearnBusinessConceptsV2 key={moduleId} moduleId={moduleId} completed={completed.includes(moduleId)} onComplete={toggleModule} /></div>
                    : workspace === 'lab' ? <LearnFinancialsLabV2 />
                        : workspace === 'replay' ? <LearnBusinessReplayV2 completedCaseIds={completedCases} onReflectionSave={saveReflection} />
                            : <LearnBusinessApplyV2 completed={progressState.applyCompleted} onComplete={() => setProgressState((current) => ({ ...current, applyCompleted: true }))} />}
            </div>

            <section className="mt-5 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-xs leading-5 text-[var(--v7-text-muted)] sm:flex sm:justify-between sm:gap-6"><p><strong className="text-[var(--v7-text-secondary)]">Signal Learn rule:</strong> business metrics explain an economic engine; they do not become an automatic stock score.</p><p className="mt-2 shrink-0 sm:mt-0">Educational analysis, not investment advice.</p></section>
        </div>
    );
};
