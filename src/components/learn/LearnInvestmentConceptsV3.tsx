'use client';

import { learnModulesV03, type LearnModuleIdV03 } from '@/lib/learn/v0-3';

type Props = {
    readonly moduleId: LearnModuleIdV03;
    readonly completed: boolean;
    readonly onComplete: () => void;
};

export const LearnInvestmentConceptsV3 = ({ moduleId, completed, onComplete }: Props) => {
    const lesson = learnModulesV03.find((item) => item.id === moduleId)!;
    return (
        <article className="min-w-0 border-y border-[var(--v7-border)] bg-[var(--v7-surface)] py-5" data-testid="investment-concept">
            <p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Module {lesson.eyebrow}</p>
            <h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">{lesson.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">{lesson.principle}</p>
            <div className="mt-5 grid gap-px overflow-hidden rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-border)] sm:grid-cols-2">
                {lesson.concepts.map((concept) => <div key={concept} className="bg-[var(--v7-surface-quiet)] px-4 py-3 text-sm font-medium text-[var(--v7-text)]">{concept}</div>)}
            </div>
            <div className="mt-5 border-l-2 border-[var(--v7-accent)] pl-4">
                <p className="text-[11px] font-bold uppercase text-[var(--v7-text-muted)]">Investigate</p>
                <p className="mt-1 text-sm leading-6 text-[var(--v7-text)]">{lesson.prompt}</p>
            </div>
            <textarea aria-label="Concept reasoning" placeholder="Record the evidence and reasoning you would use." className="mt-4 min-h-24 w-full rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm text-[var(--v7-text)]" />
            <button type="button" onClick={onComplete} className="mt-3 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white">{completed ? 'Mark for review' : 'Mark understood'}</button>
        </article>
    );
};
