'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    businessReplayCasesV02,
    calculateDerivedMetricsV02,
    learnModulesV02,
    type BusinessReplayCaseIdV02,
    type BusinessReplayCommitmentV02,
    type BusinessReplayIntroV02,
    type BusinessReplayRevealV02,
    type LearnModuleIdV02,
    type LearnReflectionV02,
} from '@/lib/learn/v0-2';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const readPayload = <T,>(payload: unknown): T => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
        throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Business Replay is unavailable.');
    }
    return payload.data as T;
};
const money = (value: number | null) => value === null ? 'Unavailable' : `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}m`;
const ratio = (value: number | null, suffix = 'x') => value === null ? 'Unavailable' : `${value.toFixed(2)}${suffix}`;
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

const SnapshotMetrics = ({ intro, later = false }: { readonly intro: BusinessReplayIntroV02 | BusinessReplayRevealV02; readonly later?: boolean }) => {
    const snapshot = later && 'nextSnapshot' in intro ? intro.nextSnapshot : intro.snapshot;
    const sharePrice = later && 'nextSharePrice' in intro ? intro.nextSharePrice : intro.sharePrice;
    const derived = calculateDerivedMetricsV02(snapshot, sharePrice);
    const items = [
        ['Revenue', money(snapshot.values.revenue), 'Reported exercise input'],
        ['Operating margin', ratio(derived.operatingMargin.value, '%'), derived.operatingMargin.formula],
        ['Net income', money(snapshot.values.netIncome), 'Reported exercise input'],
        ['Free cash flow', money(snapshot.values.freeCashFlow), 'Operating cash flow - CapEx'],
        ['Net debt', money(derived.netDebt.value), derived.netDebt.formula],
        ['Interest coverage', ratio(derived.interestCoverage.value), derived.interestCoverage.formula],
        ['Diluted shares', snapshot.values.sharesDiluted === null ? 'Unavailable' : `${snapshot.values.sharesDiluted.toLocaleString()}m`, 'Reported exercise input'],
        ['P/E', ratio(derived.pe.value), derived.pe.formula],
    ] as const;
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map(([label, value, note]) => <article key={label} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--v7-text-muted)]">{label}</p><p className="mt-1 font-mono text-lg font-bold text-[var(--v7-text)]">{value}</p><p className="mt-2 text-xs leading-5 text-[var(--v7-text-secondary)]">{note}</p></article>)}</div>;
};

export const LearnBusinessReplayV2 = ({ completedCaseIds, onReflectionSave }: {
    readonly completedCaseIds: readonly BusinessReplayCaseIdV02[];
    readonly onReflectionSave: (reflection: LearnReflectionV02) => void;
}) => {
    const [caseId, setCaseId] = useState<BusinessReplayCaseIdV02>('margin-expansion');
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [intro, setIntro] = useState<BusinessReplayIntroV02 | null>(null);
    const [reveal, setReveal] = useState<BusinessReplayRevealV02 | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [interpretation, setInterpretation] = useState<BusinessReplayCommitmentV02['interpretation']>('mixed');
    const [confidence, setConfidence] = useState(50);
    const [primaryDriver, setPrimaryDriver] = useState('');
    const [contraryEvidence, setContraryEvidence] = useState('');
    const [valuationImplication, setValuationImplication] = useState('');
    const [committed, setCommitted] = useState<BusinessReplayCommitmentV02 | null>(null);
    const [revealing, setRevealing] = useState(false);
    const [driverHeldUp, setDriverHeldUp] = useState('');
    const [missedEvidence, setMissedEvidence] = useState('');
    const [valuationLesson, setValuationLesson] = useState('');
    const [revisitConcept, setRevisitConcept] = useState<LearnModuleIdV02>('margins');

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading'); setError(null); setIntro(null); setReveal(null); setCommitted(null);
            setPrimaryDriver(''); setContraryEvidence(''); setValuationImplication('');
            setDriverHeldUp(''); setMissedEvidence(''); setValuationLesson('');
            try {
                const response = await fetch(`/api/learn/business-replay/${caseId}`, { cache: 'no-store', signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Business Replay is unavailable.');
                setIntro(readPayload<BusinessReplayIntroV02>(payload));
                setState('ready');
            } catch (caught) {
                if (controller.signal.aborted) return;
                setState('error'); setError(caught instanceof Error ? caught.message : 'Business Replay is unavailable.');
            }
        };
        void load();
        return () => controller.abort();
    }, [caseId, retryKey]);

    const commitment = useMemo<BusinessReplayCommitmentV02>(() => ({
        interpretation, confidence, primaryDriver: primaryDriver.trim(), contraryEvidence: contraryEvidence.trim(), valuationImplication: valuationImplication.trim(),
    }), [confidence, contraryEvidence, interpretation, primaryDriver, valuationImplication]);
    const commitmentReady = Boolean(commitment.primaryDriver && commitment.contraryEvidence && commitment.valuationImplication);

    const revealNext = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!intro || !commitmentReady || revealing) return;
        setRevealing(true); setError(null);
        try {
            const response = await fetch(`/api/learn/business-replay/${caseId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ replayId: intro.replayId, commitment }) });
            const payload: unknown = await response.json();
            if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Unable to reveal the next report.');
            setReveal(readPayload<BusinessReplayRevealV02>(payload));
            setCommitted(commitment);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to reveal the next report.');
        } finally {
            setRevealing(false);
        }
    };

    const saveReflection = (event: React.FormEvent) => {
        event.preventDefault();
        if (!intro || !reveal || !driverHeldUp.trim() || !missedEvidence.trim() || !valuationLesson.trim()) return;
        onReflectionSave({ caseId, replayId: intro.replayId, createdAt: new Date().toISOString(), driverHeldUp: driverHeldUp.trim(), missedEvidence: missedEvidence.trim(), valuationLesson: valuationLesson.trim(), revisitConcept });
    };

    return (
        <section data-testid="business-replay" aria-labelledby="business-replay-title" className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="grid gap-2 sm:grid-cols-3" aria-label="Business replay cases">{businessReplayCasesV02.map((item) => <button key={item.id} type="button" aria-pressed={caseId === item.id} onClick={() => setCaseId(item.id)} className={`min-h-11 rounded-[8px] border p-3 text-left ${caseId === item.id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)] bg-[var(--v7-surface-quiet)]'}`}><span className="text-sm font-bold text-[var(--v7-text)]">{item.title}</span><span className="mt-1 block text-xs leading-5 text-[var(--v7-text-secondary)]">{item.pattern}</span><span className="mt-1 block text-[11px] font-semibold text-[var(--v7-accent)]">{completedCaseIds.includes(item.id) ? 'Debrief completed' : 'Future locked'}</span></button>)}</div>
            <div className="mt-5 border-b border-[var(--v7-border)] pb-4"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Historical Financial Replay</p><h2 id="business-replay-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">Commit to the business drivers before revealing the next report</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">The GET response contains one report only. The later statement remains server-side until a bounded commitment is posted.</p></div>
            {state === 'loading' ? <p role="status" className="mt-4 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-sm">Loading a point-in-time case...</p> : null}
            {state === 'error' ? <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-[8px] border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm"><span>{error}</span><button type="button" onClick={() => setRetryKey((value) => value + 1)} className="min-h-10 rounded-[8px] border border-[var(--v7-border)] px-3 font-semibold">Retry</button></div> : null}

            {state === 'ready' && intro ? <>
                <div data-testid="business-replay-locked" className="mt-4 rounded-[8px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4"><p className="text-xs font-bold uppercase text-[var(--v7-accent)]">Future report locked</p><p className="mt-1 text-sm text-[var(--v7-text-secondary)]">{intro.snapshot.companyName} - FY {intro.snapshot.fiscalPeriod.slice(0, 4)} - known as of {date(intro.knownAsOf)}</p><p className="mt-2 text-xs text-[var(--v7-text-muted)]">{intro.sourceNote}</p></div>
                <div className="mt-3"><SnapshotMetrics intro={intro} /></div>
                {!committed ? <form onSubmit={revealNext} className="mt-5 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><h3 className="font-bold text-[var(--v7-text)]">Commit before reveal</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Business direction<select value={interpretation} onChange={(event) => setInterpretation(event.target.value as BusinessReplayCommitmentV02['interpretation'])} className="min-h-10 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal"><option value="improving">Improving</option><option value="mixed">Mixed</option><option value="deteriorating">Deteriorating</option></select></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Confidence <span className="font-mono font-normal">{confidence}%</span><input type="range" min="0" max="100" step="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="min-h-10 accent-[var(--v7-accent)]" /></label></div><div className="mt-3 grid gap-3 lg:grid-cols-3"><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Primary business driver<textarea value={primaryDriver} onChange={(event) => setPrimaryDriver(event.target.value)} maxLength={700} rows={4} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Contrary evidence<textarea value={contraryEvidence} onChange={(event) => setContraryEvidence(event.target.value)} maxLength={700} rows={4} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Valuation implication<textarea value={valuationImplication} onChange={(event) => setValuationImplication(event.target.value)} maxLength={700} rows={4} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label></div>{error ? <p role="alert" className="mt-3 text-sm text-[var(--v7-risk)]">{error}</p> : null}<button type="submit" disabled={!commitmentReady || revealing} className="mt-4 min-h-11 rounded-[8px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-[var(--v7-on-accent)] disabled:opacity-50">{revealing ? 'Revealing...' : 'Commit reasoning and reveal'}</button></form> : null}
                {committed && reveal ? <div data-testid="business-replay-revealed" className="mt-5 grid gap-4"><section className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Original commitment locked</p><p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]"><strong>{committed.interpretation}</strong> at {committed.confidence}% confidence. Driver: {committed.primaryDriver}</p><p className="mt-1 text-sm leading-6 text-[var(--v7-text-secondary)]">Valuation implication: {committed.valuationImplication}</p></section><section className="rounded-[8px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Next report revealed</p><p className="mt-1 text-sm text-[var(--v7-text-secondary)]">FY {reveal.nextSnapshot.fiscalPeriod.slice(0, 4)}, known as of {date(reveal.nextSnapshot.knownAsOf)}</p><div className="mt-3"><SnapshotMetrics intro={reveal} later /></div><ul className="mt-4 grid gap-2 text-sm leading-6 text-[var(--v7-text-secondary)]">{reveal.debrief.map((item) => <li key={item}>- {item}</li>)}</ul></section><form onSubmit={saveReflection} className="rounded-[8px] border border-[var(--v7-border)] p-4"><h3 className="font-bold text-[var(--v7-text)]">Debrief the reasoning</h3><div className="mt-3 grid gap-3 lg:grid-cols-3"><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Which driver reasoning held up?<textarea value={driverHeldUp} onChange={(event) => setDriverHeldUp(event.target.value)} maxLength={700} rows={3} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Which evidence did you miss?<textarea value={missedEvidence} onChange={(event) => setMissedEvidence(event.target.value)} maxLength={700} rows={3} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">What changed in the valuation interpretation?<textarea value={valuationLesson} onChange={(event) => setValuationLesson(event.target.value)} maxLength={700} rows={3} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label></div><label className="mt-3 grid max-w-sm gap-1 text-sm font-semibold text-[var(--v7-text)]">Concept to revisit<select value={revisitConcept} onChange={(event) => setRevisitConcept(event.target.value as LearnModuleIdV02)} className="min-h-10 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal">{learnModulesV02.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label><button type="submit" disabled={completedCaseIds.includes(caseId) || !driverHeldUp.trim() || !missedEvidence.trim() || !valuationLesson.trim()} className="mt-4 min-h-11 rounded-[8px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-[var(--v7-on-accent)] disabled:opacity-50">{completedCaseIds.includes(caseId) ? 'Reflection saved' : 'Save reflection'}</button></form></div> : null}
            </> : null}
        </section>
    );
};
