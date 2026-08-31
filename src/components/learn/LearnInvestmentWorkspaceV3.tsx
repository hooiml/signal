'use client';

import { useEffect, useMemo, useState } from 'react';
import { LearnInvestmentApplyV3 } from './LearnInvestmentApplyV3';
import { LearnInvestmentConceptsV3 } from './LearnInvestmentConceptsV3';
import { LearnInvestmentLabsV3, type InvestmentLabV3 } from './LearnInvestmentLabsV3';
import { LearnInvestmentReplayV3 } from './LearnInvestmentReplayV3';
import { LearnInvestmentResearchV3, type InvestmentResearchViewV3 } from './LearnInvestmentResearchV3';
import {
    emptyLearnProgressV03,
    learnModulesV03,
    parseLearnProgressV03,
    type LearnModuleIdV03,
    type LearnProgressV03,
    type LearnReflectionV03,
} from '@/lib/learn/v0-3';

type Workspace = 'concepts' | 'valuation' | 'macro' | 'research' | 'scenarios' | 'portfolio' | 'journal' | 'replay' | 'apply';
const progressKey = 'signal-learn-v0.3-progress';
const workspaces: readonly [Workspace, string, string][] = [
    ['concepts', 'Concept path', '14 connected modules'],
    ['valuation', 'Valuation Lens', 'Metrics and multiple bridge'],
    ['macro', 'Macro Context', 'Facts and uncertainty'],
    ['research', 'Research', 'Evidence and thesis'],
    ['scenarios', 'Scenarios', 'Bear, Base, Bull'],
    ['portfolio', 'Portfolio', 'Concentration and risk'],
    ['journal', 'Journal', 'Immutable commitment'],
    ['replay', 'Replay', 'Point-in-time cases'],
    ['apply', 'Apply current', 'Complete analysis'],
];

export const LearnInvestmentWorkspaceV3 = () => {
    const [workspace, setWorkspace] = useState<Workspace>('concepts');
    const [moduleId, setModuleId] = useState<LearnModuleIdV03>('valuation-metrics');
    const [progressState, setProgressState] = useState<LearnProgressV03>(emptyLearnProgressV03);
    const [progressReady, setProgressReady] = useState(false);
    useEffect(() => { const timer = window.setTimeout(() => { try { const raw = window.localStorage.getItem(progressKey); setProgressState(parseLearnProgressV03(raw ? JSON.parse(raw) : null)); } catch { setProgressState(emptyLearnProgressV03()); } setProgressReady(true); }, 0); return () => window.clearTimeout(timer); }, []);
    useEffect(() => { if (progressReady) window.localStorage.setItem(progressKey, JSON.stringify(progressState)); }, [progressReady, progressState]);
    const completed = progressState.completedModules;
    const completedWorkspaces = progressState.completedWorkspaces;
    const nextModule = useMemo(() => learnModulesV03.find((module) => !completed.includes(module.id)) ?? learnModulesV03.at(-1)!, [completed]);
    const toggleModule = () => setProgressState((current) => ({ ...current, completedModules: current.completedModules.includes(moduleId) ? current.completedModules.filter((id) => id !== moduleId) : [...current.completedModules, moduleId] }));
    const completeWorkspace = (id: string) => setProgressState((current) => ({ ...current, completedWorkspaces: current.completedWorkspaces.includes(id) ? current.completedWorkspaces : [...current.completedWorkspaces, id] }));
    const saveReflection = (reflection: LearnReflectionV03) => setProgressState((current) => ({ ...current, reflections: [...current.reflections.filter((item) => item.caseId !== reflection.caseId), reflection].slice(-3) }));
    const completedCaseIds = progressState.reflections.map((item) => item.caseId);
    const applyCompleted = completedWorkspaces.includes('apply');

    return <div data-testid="learn-v0-3">
        <section className="grid gap-5 border-b border-[var(--v7-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end"><div><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Signal Learn - v0.3</p><h1 className="mt-2 max-w-3xl text-2xl font-bold text-[var(--v7-text)] sm:text-3xl">Build an investment view that can be challenged and updated.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)] sm:text-[15px]">Connect business quality, growth, valuation, expectations, macro, risks, and scenarios. Preserve contrary evidence and invalidation without producing an automatic stock rating.</p></div>
            <div data-testid="investment-mastery" className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[var(--v7-text-secondary)]">Investment analysis</span><span className="font-mono text-xs text-[var(--v7-text-muted)]">{completed.length}/{learnModulesV03.length}</span></div><div className="mt-2 h-2 overflow-hidden rounded bg-[var(--v7-border)]"><div className="h-full bg-[var(--v7-accent)]" style={{ width: `${Math.round((completed.length / learnModulesV03.length) * 100)}%` }} /></div><p className="mt-3 text-xs text-[var(--v7-text-muted)]">Next concept: <button type="button" onClick={() => { setWorkspace('concepts'); setModuleId(nextModule.id); }} className="min-h-10 font-semibold text-[var(--v7-text)] underline underline-offset-2">{nextModule.title}</button></p><dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--v7-border)] pt-3 text-center"><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Understand</dt><dd className="mt-1 font-mono text-xs font-bold">{completed.length}/14</dd></div><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Practice</dt><dd className="mt-1 font-mono text-xs font-bold">{completedWorkspaces.length}/7</dd></div><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Replay</dt><dd className="mt-1 font-mono text-xs font-bold">{Math.min(completedCaseIds.length, 2)}/2</dd></div></dl></div>
        </section>
        <nav aria-label="Investment learning workspace" className="research-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">{workspaces.map(([id, label, note]) => <button key={id} type="button" aria-pressed={workspace === id} onClick={() => setWorkspace(id)} className={`min-h-11 min-w-[170px] shrink-0 rounded-[8px] border px-4 text-left ${workspace === id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}><span className="block text-sm font-bold text-[var(--v7-text)]">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--v7-text-muted)]">{note}</span></button>)}</nav>
        <div className="mt-5">
            {workspace === 'concepts' ? <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]"><aside className="min-w-0 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3 lg:self-start"><p className="px-2 pb-2 text-[11px] font-bold uppercase text-[var(--v7-text-muted)]">v0.3 path</p><div className="research-scrollbar flex gap-2 overflow-x-auto lg:grid lg:max-h-[680px] lg:overflow-y-auto" aria-label="Investment analysis modules">{learnModulesV03.map((module) => { const selected = module.id === moduleId; const done = completed.includes(module.id); return <button key={module.id} type="button" aria-pressed={selected} onClick={() => setModuleId(module.id)} className={`min-h-11 min-w-[190px] rounded-[8px] border px-3 py-2 text-left lg:min-w-0 ${selected ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-transparent hover:border-[var(--v7-border)]'}`}><span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[var(--v7-text)]">{module.eyebrow} - {module.title}</span><span aria-label={done ? 'Completed' : 'Not completed'} className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? 'bg-[var(--v7-accent)]' : 'border border-[var(--v7-border-strong)]'}`} /></span></button>; })}</div></aside><LearnInvestmentConceptsV3 moduleId={moduleId} completed={completed.includes(moduleId)} onComplete={toggleModule} /></div> : null}
            {['valuation', 'macro', 'portfolio'].includes(workspace) ? <LearnInvestmentLabsV3 lab={workspace as InvestmentLabV3} onComplete={completeWorkspace} /> : null}
            <div className={['research', 'scenarios', 'journal'].includes(workspace) ? '' : 'hidden'}><LearnInvestmentResearchV3 view={['research', 'scenarios', 'journal'].includes(workspace) ? workspace as InvestmentResearchViewV3 : 'research'} onComplete={completeWorkspace} /></div>
            {workspace === 'replay' ? <LearnInvestmentReplayV3 completedCaseIds={completedCaseIds} onReflectionSave={saveReflection} /> : null}
            {workspace === 'apply' ? <LearnInvestmentApplyV3 completed={applyCompleted} onComplete={() => completeWorkspace('apply')} /> : null}
        </div>
        <section className="mt-5 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-xs leading-5 text-[var(--v7-text-muted)] sm:flex sm:justify-between sm:gap-6"><p><strong className="text-[var(--v7-text-secondary)]">Signal Learn rule:</strong> evidence and scenarios support the learner&apos;s judgment; they never become an automatic buy/sell decision.</p><p className="mt-2 shrink-0 sm:mt-0">Educational analysis, not investment advice.</p></section>
    </div>;
};
