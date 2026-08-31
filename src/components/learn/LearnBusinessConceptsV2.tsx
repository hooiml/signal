'use client';

import { useState } from 'react';
import { learnModulesV02, type LearnModuleIdV02 } from '@/lib/learn/v0-2';

export const LearnBusinessConceptsV2 = ({ moduleId, completed, onComplete }: {
    readonly moduleId: LearnModuleIdV02;
    readonly completed: boolean;
    readonly onComplete: () => void;
}) => {
    const [response, setResponse] = useState('');
    const lesson = learnModulesV02.find((candidate) => candidate.id === moduleId) ?? learnModulesV02[0];

    return (
        <section aria-labelledby="business-concept-title" className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Module {lesson.eyebrow}</p>
                    <h2 id="business-concept-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">{lesson.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">{lesson.objective}</p>
                </div>
                <button type="button" disabled={!completed && !response.trim()} onClick={onComplete} className="min-h-11 shrink-0 rounded-[8px] border border-[var(--v7-border)] px-4 text-sm font-semibold text-[var(--v7-text)] disabled:cursor-not-allowed disabled:opacity-50">
                    {completed ? 'Mark incomplete' : 'Mark understood'}
                </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {lesson.concepts.map((concept) => (
                    <article key={concept} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3">
                        <p className="text-sm font-semibold text-[var(--v7-text)]">{concept}</p>
                    </article>
                ))}
            </div>

            <section className="mt-5 rounded-[8px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4">
                <p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Required exercise</p>
                <p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">{lesson.exercise}</p>
                <label className="mt-3 grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">
                    {lesson.question}
                    <textarea value={response} onChange={(event) => setResponse(event.target.value)} maxLength={700} rows={4} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal leading-6" placeholder="Record the evidence and reasoning you would use." />
                </label>
                <details className="mt-3">
                    <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--v7-text)]">Evidence checklist</summary>
                    <p className="mt-1 text-sm leading-6 text-[var(--v7-text-secondary)]">{lesson.evidenceNeeded}</p>
                </details>
            </section>

            <div className="mt-4 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3 text-sm leading-6 text-[var(--v7-text-secondary)]">
                <strong className="text-[var(--v7-text)]">Valuation connection:</strong> {lesson.connectedConcept}
            </div>
        </section>
    );
};
