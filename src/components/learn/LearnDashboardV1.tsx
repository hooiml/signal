'use client';

import { useEffect, useMemo, useState } from 'react';
import { V7Shell } from '@/components/v7/foundation/V7Foundation';
import { LearnConceptLabV1 } from './LearnConceptLabV1';
import { LearnApplyV1 } from './LearnApplyV1';
import { LearnCompareV1 } from './LearnCompareV1';
import { LearnReplayV1 } from './LearnReplayV1';
import { LearnBusinessWorkspaceV2 } from './LearnBusinessWorkspaceV2';
import {
    emptyLearnProgressV01,
    learnModulesV01,
    parseLearnProgressV01,
    type LearnModuleIdV01,
    type LearnProgressV01,
    type LearnReflectionV01,
} from '@/lib/learn/v0-1';

type LearnWorkspace = 'learn' | 'compare' | 'apply' | 'replay';
type LearnRelease = 'v0.1' | 'v0.2';

const progressKey = 'signal-learn-v0.1-progress';

export const LearnDashboardV1 = () => {
    const [release, setRelease] = useState<LearnRelease>('v0.2');
    const [workspace, setWorkspace] = useState<LearnWorkspace>('learn');
    const [moduleId, setModuleId] = useState<LearnModuleIdV01>('evidence');
    const [progressState, setProgressState] = useState<LearnProgressV01>(emptyLearnProgressV01);
    const [progressReady, setProgressReady] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try {
                const raw = window.localStorage.getItem(progressKey);
                const parsed: unknown = raw ? JSON.parse(raw) : null;
                setProgressState(parseLearnProgressV01(parsed));
            } catch {
                setProgressState(emptyLearnProgressV01());
            }
            setProgressReady(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!progressReady) return;
        window.localStorage.setItem(progressKey, JSON.stringify(progressState));
    }, [progressReady, progressState]);

    const completed = progressState.completedModules;
    const completedCount = completed.length;
    const progress = Math.round((completedCount / learnModulesV01.length) * 100);
    const nextModule = useMemo(() => learnModulesV01.find((module) => !completed.includes(module.id)) ?? learnModulesV01[learnModulesV01.length - 1], [completed]);

    const toggleComplete = () => {
        setProgressState((current) => ({
            ...current,
            completedModules: current.completedModules.includes(moduleId)
                ? current.completedModules.filter((id) => id !== moduleId)
                : [...current.completedModules, moduleId],
        }));
    };

    const completeApply = () => setProgressState((current) => ({ ...current, applyCompleted: true }));
    const saveReflection = (reflection: LearnReflectionV01) => setProgressState((current) => ({
        ...current,
        reflections: [...current.reflections.filter((item) => item.caseId !== reflection.caseId), reflection].slice(-2),
    }));
    const completedCaseIds = progressState.reflections.map((item) => item.caseId);

    const commands = [
        { id: 'learn-business', label: 'Open business foundations', group: 'Learn', keywords: ['financial statements cash flow debt roic'], run: () => setRelease('v0.2') },
        { id: 'learn-concepts', label: 'Open valuation concepts', group: 'Learn', keywords: ['education modules'], run: () => { setRelease('v0.1'); setWorkspace('learn'); } },
        { id: 'learn-compare', label: 'Open valuation comparison', group: 'Learn', keywords: ['peer valuation evidence'], run: () => { setRelease('v0.1'); setWorkspace('compare'); } },
        { id: 'learn-apply', label: 'Open valuation Apply Today', group: 'Learn', keywords: ['current market evidence'], run: () => { setRelease('v0.1'); setWorkspace('apply'); } },
        { id: 'learn-replay', label: 'Open valuation Historical Replay', group: 'Learn', keywords: ['history hindsight'], run: () => { setRelease('v0.1'); setWorkspace('replay'); } },
    ] as const;

    return (
        <V7Shell active="learn" commands={commands} footer={`Signal Learn ${release} · Evidence over shortcuts · Educational analysis, not investment advice`} testId="learn-shell">
            <main className="min-h-[calc(100dvh-132px)] bg-[var(--v7-surface)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                <div className="mx-auto w-full max-w-[1180px]">
                    <nav aria-label="Learn release" className="mb-5 inline-flex rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-1">
                        <button type="button" aria-pressed={release === 'v0.2'} onClick={() => setRelease('v0.2')} className={`min-h-10 rounded-[6px] px-4 text-sm font-semibold ${release === 'v0.2' ? 'bg-[var(--v7-surface)] text-[var(--v7-text)] shadow-sm' : 'text-[var(--v7-text-secondary)]'}`}>Business foundations v0.2</button>
                        <button type="button" aria-pressed={release === 'v0.1'} onClick={() => setRelease('v0.1')} className={`min-h-10 rounded-[6px] px-4 text-sm font-semibold ${release === 'v0.1' ? 'bg-[var(--v7-surface)] text-[var(--v7-text)] shadow-sm' : 'text-[var(--v7-text-secondary)]'}`}>Valuation foundations v0.1</button>
                    </nav>
                    {release === 'v0.2' ? <LearnBusinessWorkspaceV2 /> : <div data-testid="learn-v0-1">
                    <section className="grid gap-5 border-b border-[var(--v7-border)] pb-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--v7-accent)]">Signal Learn · v0.1</p>
                            <h1 className="mt-2 max-w-3xl text-2xl font-bold tracking-tight text-[var(--v7-text)] sm:text-3xl">Understand the evidence before trusting the indicator.</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)] sm:text-[15px]">Learn how earnings, P/E, growth, and expectations connect. Then test the same reasoning against point-in-time history and today&apos;s unresolved market.</p>
                        </div>
                        <div className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4" data-testid="learn-mastery">
                            <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[var(--v7-text-secondary)]">Valuation foundations</span><span className="font-mono text-xs text-[var(--v7-text-muted)]">{completedCount}/{learnModulesV01.length}</span></div>
                            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--v7-border)]" aria-label={`${progress}% complete`}><div className="h-full rounded-full bg-[var(--v7-accent)] transition-[width] motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div>
                            <p className="mt-3 text-xs leading-5 text-[var(--v7-text-muted)]">Next concept: <button type="button" onClick={() => { setWorkspace('learn'); setModuleId(nextModule.id); }} className="min-h-10 font-semibold text-[var(--v7-text)] underline underline-offset-2">{nextModule.title}</button></p>
                            <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--v7-border)] pt-3 text-center"><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Understand</dt><dd className="mt-1 font-mono text-xs font-bold text-[var(--v7-text)]">{completedCount}/6</dd></div><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Interpret</dt><dd className="mt-1 font-mono text-xs font-bold text-[var(--v7-text)]">{completedCaseIds.length}/2</dd></div><div><dt className="text-[10px] uppercase text-[var(--v7-text-muted)]">Apply</dt><dd className="mt-1 font-mono text-xs font-bold text-[var(--v7-text)]">{progressState.applyCompleted ? '1/1' : '0/1'}</dd></div></dl>
                        </div>
                    </section>

                    <nav aria-label="Learn workspace" className="research-scrollbar -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
                        {([
                            ['learn', 'Learn concepts', 'Build the mental model'],
                            ['compare', 'Compare', 'No automatic winner'],
                            ['apply', 'Apply today', 'Use unresolved evidence'],
                            ['replay', 'Historical replay', 'Commit before the future'],
                        ] as const).map(([id, label, note]) => {
                            const selected = workspace === id;
                            return <button key={id} type="button" aria-pressed={selected} onClick={() => setWorkspace(id)} className={`min-h-11 min-w-[180px] shrink-0 rounded-[9px] border px-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-accent)] ${selected ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)] bg-[var(--v7-surface)] hover:border-[var(--v7-border-strong)]'}`}><span className="block text-sm font-bold text-[var(--v7-text)]">{label}</span><span className="mt-0.5 block text-[11px] text-[var(--v7-text-muted)]">{note}</span></button>;
                        })}
                    </nav>

                    <div className="mt-5">
                        {workspace === 'learn' ? (
                            <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
                                <aside className="min-w-0 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3 lg:self-start">
                                    <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">v0.1 path</p>
                                    <div className="research-scrollbar flex gap-2 overflow-x-auto lg:grid lg:overflow-visible" aria-label="Valuation foundation modules">
                                        {learnModulesV01.map((module) => {
                                            const selected = module.id === moduleId;
                                            const done = completed.includes(module.id);
                                            return <button key={module.id} type="button" aria-pressed={selected} onClick={() => setModuleId(module.id)} className={`min-h-11 min-w-[190px] rounded-[9px] border px-3 py-2 text-left lg:min-w-0 ${selected ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-transparent bg-transparent hover:border-[var(--v7-border)] hover:bg-[var(--v7-surface)]'}`}><span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[var(--v7-text)]">{module.eyebrow} · {module.title}</span><span aria-label={done ? 'Completed' : 'Not completed'} className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? 'bg-[var(--v7-accent)]' : 'border border-[var(--v7-border-strong)]'}`} /></span></button>;
                                        })}
                                    </div>
                                </aside>
                                <LearnConceptLabV1 moduleId={moduleId} completed={completed.includes(moduleId)} onComplete={toggleComplete} />
                            </div>
                        ) : workspace === 'compare' ? <LearnCompareV1 />
                            : workspace === 'apply' ? <LearnApplyV1 completed={progressState.applyCompleted} onComplete={completeApply} />
                                : <LearnReplayV1 completedCaseIds={completedCaseIds} onReflectionSave={saveReflection} />}
                    </div>

                    <section className="mt-5 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-xs leading-5 text-[var(--v7-text-muted)] sm:flex sm:items-start sm:justify-between sm:gap-6">
                        <p><strong className="text-[var(--v7-text-secondary)]">Signal Learn rule:</strong> a metric is evidence, not a conclusion. Historical outcomes are used to review reasoning, not to imply the same result will repeat.</p>
                        <p className="mt-2 shrink-0 sm:mt-0">No automatic Buy/Sell score.</p>
                    </section>
                    </div>}
                </div>
            </main>
        </V7Shell>
    );
};
