'use client';

import { useMemo, useState } from 'react';

const fields = ['Business summary', 'Financial health', 'Valuation', 'Expectations', 'Macro context', 'Evidence for', 'Evidence against', 'Scenarios', 'Thesis', 'Invalidation'] as const;
const labelClass = 'grid gap-1.5 text-xs font-semibold text-[var(--v7-text-secondary)]';

export const LearnInvestmentApplyV3 = ({ completed, onComplete }: { readonly completed: boolean; readonly onComplete: () => void }) => {
    const [symbol, setSymbol] = useState(''); const [answers, setAnswers] = useState<Record<string, string>>({}); const [confidence, setConfidence] = useState(50);
    const missing = useMemo(() => fields.filter((field) => (answers[field] ?? '').trim().length < 8), [answers]);
    const challenge = missing.length > 0 ? `Omission check: ${missing.join(', ')} ${missing.length === 1 ? 'needs' : 'need'} evidence.` : answers['Evidence against']!.length < answers['Evidence for']!.length / 3 ? 'Challenge: contrary evidence is much thinner than supporting evidence. Is that evidence-based?' : 'Challenge: identify the weakest source and the assumption with the greatest scenario sensitivity.';
    return <section data-testid="investment-apply"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Current-market exercise</p><h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Build the view. Signal checks the reasoning, not the answer.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">Use current evidence you have verified. No hidden answer key, forecast, rating, or buy/sell decision is generated.</p>
        <label className={`${labelClass} mt-5 max-w-xs`}>Company / ticker<input aria-label="Current company" className="min-h-10 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 text-sm" value={symbol} onChange={(event) => setSymbol(event.target.value.slice(0, 30))} /></label>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{fields.map((field) => <label key={field} className={labelClass}>{field}<textarea aria-label={`Current ${field}`} className="min-h-24 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm" value={answers[field] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [field]: event.target.value }))} /></label>)}</div>
        <label className={`${labelClass} mt-4 max-w-md`}>Confidence: {confidence}%<input aria-label="Current analysis confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label>
        <div data-testid="apply-reasoning-challenge" className="mt-5 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-accent-quiet)] p-4 text-xs leading-5"><strong>Reasoning challenger</strong><p className="mt-1">{challenge}</p><p className="mt-2 text-[var(--v7-text-muted)]">This prompt is derived from completeness and balance only. It does not know or select the correct market decision.</p></div>
        <button type="button" disabled={!symbol.trim() || missing.length > 0} onClick={onComplete} className="mt-4 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white disabled:opacity-40">{completed ? 'Analysis complete' : 'Complete current analysis'}</button>
    </section>;
};
