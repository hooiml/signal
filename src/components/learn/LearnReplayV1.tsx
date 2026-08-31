'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    learnModulesV01,
    learnReplayCasesV01,
    type LearnModuleIdV01,
    type LearnReflectionV01,
    type LearnReplayCaseIdV01,
    type LearnReplayIntroV01,
    type LearnReplayRevealV01,
    type ReplayCommitmentV01,
    type ReplayViewV01,
} from '@/lib/learn/v0-1';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const readPayload = <T,>(payload: unknown): T => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
        throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Learn Replay is unavailable.');
    }
    return payload.data as T;
};

const money = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: Math.abs(value) >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 2 }).format(value);
const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
const date = (value: string) => new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

const ReplayMetric = ({ label, value, note }: { readonly label: string; readonly value: string; readonly note: string }) => (
    <article className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">{label}</p>
        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--v7-text)]">{value}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--v7-text-secondary)]">{note}</p>
    </article>
);

export const LearnReplayV1 = ({ completedCaseIds, onReflectionSave }: {
    readonly completedCaseIds: readonly LearnReplayCaseIdV01[];
    readonly onReflectionSave: (reflection: LearnReflectionV01) => void;
}) => {
    const [activeCaseId, setActiveCaseId] = useState<LearnReplayCaseIdV01 | null>('premium-growth');
    const [symbolInput, setSymbolInput] = useState('MSFT');
    const [symbol, setSymbol] = useState('MSFT');
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [intro, setIntro] = useState<LearnReplayIntroV01 | null>(null);
    const [reveal, setReveal] = useState<LearnReplayRevealV01 | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [view, setView] = useState<ReplayViewV01>('neutral');
    const [confidence, setConfidence] = useState(50);
    const [supportingEvidence, setSupportingEvidence] = useState('');
    const [contraryEvidence, setContraryEvidence] = useState('');
    const [invalidation, setInvalidation] = useState('');
    const [committed, setCommitted] = useState<ReplayCommitmentV01 | null>(null);
    const [revealing, setRevealing] = useState(false);
    const [reasoningHeldUp, setReasoningHeldUp] = useState('');
    const [assumptionToRevise, setAssumptionToRevise] = useState('');
    const [confidenceFit, setConfidenceFit] = useState('');
    const [nextCheck, setNextCheck] = useState('');
    const [revisitConcept, setRevisitConcept] = useState<LearnModuleIdV01>('pe');

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading');
            setError(null);
            setReveal(null);
            setCommitted(null);
            setView('neutral');
            setConfidence(50);
            setSupportingEvidence('');
            setContraryEvidence('');
            setInvalidation('');
            setReasoningHeldUp('');
            setAssumptionToRevise('');
            setConfidenceFit('');
            setNextCheck('');
            try {
                const response = await fetch(`/api/learn/replay/${encodeURIComponent(symbol)}?market=US`, { cache: 'no-store', signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Learn Replay is unavailable.');
                setIntro(readPayload<LearnReplayIntroV01>(payload));
                setState('ready');
            } catch (caught) {
                if (controller.signal.aborted) return;
                setIntro(null);
                setState('error');
                setError(caught instanceof Error ? caught.message : 'Learn Replay is unavailable.');
            }
        };
        void load();
        return () => controller.abort();
    }, [retryKey, symbol]);

    const annualEps = useMemo(() => intro ? intro.observation.annualNetIncome / intro.observation.splitAdjustedShares : null, [intro]);
    const nextAnnualEps = useMemo(() => reveal ? reveal.nextObservation.annualNetIncome / reveal.nextObservation.splitAdjustedShares : null, [reveal]);

    const changeSymbol = (event: React.FormEvent) => {
        event.preventDefault();
        const normalized = symbolInput.trim().toUpperCase();
        if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
            setError('Use a valid US ticker symbol.');
            setState('error');
            return;
        }
        if (normalized === symbol) setRetryKey((value) => value + 1);
        else setSymbol(normalized);
        setActiveCaseId(learnReplayCasesV01.find((item) => item.symbol === normalized)?.id ?? null);
    };

    const selectCase = (caseId: LearnReplayCaseIdV01) => {
        const selected = learnReplayCasesV01.find((item) => item.id === caseId) ?? learnReplayCasesV01[0];
        setActiveCaseId(selected.id);
        setSymbolInput(selected.symbol);
        if (selected.symbol === symbol) setRetryKey((value) => value + 1);
        else setSymbol(selected.symbol);
    };

    const revealOutcome = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!intro || revealing || committed) return;
        const commitment: ReplayCommitmentV01 = {
            view,
            confidence,
            supportingEvidence: supportingEvidence.trim(),
            contraryEvidence: contraryEvidence.trim(),
            invalidation: invalidation.trim(),
        };
        if (!commitment.supportingEvidence || !commitment.contraryEvidence || !commitment.invalidation) {
            setError('Commit one supporting reason, one contrary reason, and an invalidation condition before revealing the future.');
            return;
        }

        setRevealing(true);
        setError(null);
        try {
            const response = await fetch(`/api/learn/replay/${encodeURIComponent(symbol)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ market: 'US', replayId: intro.replayId, commitment }),
            });
            const payload: unknown = await response.json();
            if (!response.ok) throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Unable to reveal this checkpoint.');
            const next = readPayload<LearnReplayRevealV01>(payload);
            setCommitted(commitment);
            setReveal(next);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to reveal this checkpoint.');
        } finally {
            setRevealing(false);
        }
    };

    const saveReflection = (event: React.FormEvent) => {
        event.preventDefault();
        if (!activeCaseId || !intro || !reveal) return;
        const reflection: LearnReflectionV01 = {
            caseId: activeCaseId,
            symbol: intro.symbol,
            replayId: intro.replayId,
            createdAt: new Date().toISOString(),
            reasoningHeldUp: reasoningHeldUp.trim(),
            assumptionToRevise: assumptionToRevise.trim(),
            confidenceFit: confidenceFit.trim(),
            nextCheck: nextCheck.trim(),
            revisitConcept,
        };
        if (!reflection.reasoningHeldUp || !reflection.assumptionToRevise || !reflection.confidenceFit || !reflection.nextCheck) return;
        onReflectionSave(reflection);
    };

    return (
        <section aria-labelledby="replay-title" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="mb-4 grid gap-2 sm:grid-cols-2" aria-label="Historical replay cases">
                {learnReplayCasesV01.map((item) => <button key={item.id} type="button" aria-pressed={activeCaseId === item.id} onClick={() => selectCase(item.id)} className={`min-h-11 rounded-[9px] border p-3 text-left ${activeCaseId === item.id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)] bg-[var(--v7-surface-quiet)]'}`}><span className="flex items-center justify-between gap-2"><span className="text-sm font-bold text-[var(--v7-text)]">{item.title}</span><span className="font-mono text-xs text-[var(--v7-text-muted)]">{item.symbol}</span></span><span className="mt-1 block text-xs leading-5 text-[var(--v7-text-secondary)]">{item.objective}</span><span className="mt-1 block text-[11px] font-semibold text-[var(--v7-accent)]">{completedCaseIds.includes(item.id) ? 'Debrief completed' : 'Future remains locked'}</span></button>)}
            </div>
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Historical Replay</p>
                    <h2 id="replay-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">Reason with the evidence that existed then</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--v7-text-secondary)]">Signal sends only the selected filing-aligned checkpoint to the browser. The next annual observation stays server-side until you commit your view.</p>
                </div>
                <form onSubmit={changeSymbol} className="flex w-full gap-2 lg:w-auto" aria-label="Historical replay company selector">
                    <span className="inline-flex min-h-10 items-center rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] px-3 text-xs font-semibold text-[var(--v7-text-muted)]">US only</span>
                    <input value={symbolInput} onChange={(event) => setSymbolInput(event.target.value.toUpperCase())} aria-label="Replay ticker symbol" className="min-h-10 min-w-0 flex-1 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono text-sm uppercase text-[var(--v7-text)] lg:w-28" />
                    <button type="submit" className="min-h-10 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-4 text-sm font-semibold text-[var(--v7-text)]">Load</button>
                </form>
            </div>

            {state === 'loading' ? <div role="status" className="mt-4 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-sm text-[var(--v7-text-secondary)]">Building a filing-aligned replay without future observations…</div> : null}
            {state === 'error' ? <div role="alert" className="mt-4 flex flex-col gap-3 rounded-[11px] border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm text-[var(--v7-text-secondary)] sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button type="button" onClick={() => setRetryKey((value) => value + 1)} className="min-h-10 rounded-[9px] border border-[var(--v7-border)] px-3 font-semibold">Retry</button></div> : null}

            {state === 'ready' && intro ? <>
                <div data-testid="replay-locked-state" className="mt-4 rounded-[11px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Future locked</p><p className="mt-1 text-sm text-[var(--v7-text-secondary)]">{intro.companyName ?? intro.symbol} · evidence known by close of {date(intro.knownAsOf)}</p></div>
                        <span className="rounded-full border border-[var(--v7-accent)] px-2.5 py-1 font-mono text-xs text-[var(--v7-text-secondary)]">{intro.symbol}</span>
                    </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <ReplayMetric label="Price after filing" value={money(intro.observation.price)} note={`First safe close after ${intro.observation.form} filing on ${date(intro.observation.filedAt)}.`} />
                    <ReplayMetric label="P/E" value={number(intro.observation.priceEarnings, '×')} note="Filing-aligned annual P/E calculated from point-in-time price and annual net income." />
                    <ReplayMetric label="Annual EPS basis" value={annualEps === null ? 'Unavailable' : money(annualEps)} note="Annual net income ÷ split-aligned diluted weighted-average shares for this learning checkpoint." />
                    <ReplayMetric label="Annual revenue" value={money(intro.observation.annualRevenue)} note={`Fiscal period ended ${date(intro.observation.fiscalPeriodEnd)}.`} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--v7-text-muted)]">
                    <a href={intro.observation.filingUrl} target="_blank" rel="noreferrer" className="min-h-10 inline-flex items-center font-semibold underline underline-offset-2">Open source filing</a>
                    <span className="inline-flex min-h-10 items-center">Sources: {intro.sourceLabels.join(' · ')}</span>
                </div>

                {!committed ? <form onSubmit={revealOutcome} className="mt-5 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 sm:p-5">
                    <h3 className="text-base font-bold text-[var(--v7-text)]">Commit before reveal</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--v7-text-muted)]">This is not a prediction score. Record the reasoning you would have used with only the evidence above.</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">View<select value={view} onChange={(event) => setView(event.target.value as ReplayViewV01)} className="min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal"><option value="attractive">Attractive</option><option value="neutral">Neutral</option><option value="unattractive">Unattractive</option></select></label>
                        <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Confidence <span className="font-mono font-normal">{confidence}%</span><input type="range" min="0" max="100" step="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="min-h-10 accent-[var(--v7-accent)]" /></label>
                    </div>
                    <div className="mt-3 grid gap-3 lg:grid-cols-3">
                        <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Supporting evidence<textarea value={supportingEvidence} onChange={(event) => setSupportingEvidence(event.target.value)} maxLength={700} rows={4} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal leading-6" placeholder="What supports your interpretation?" /></label>
                        <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Contrary evidence<textarea value={contraryEvidence} onChange={(event) => setContraryEvidence(event.target.value)} maxLength={700} rows={4} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal leading-6" placeholder="What argues against it?" /></label>
                        <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Invalidation<textarea value={invalidation} onChange={(event) => setInvalidation(event.target.value)} maxLength={700} rows={4} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal leading-6" placeholder="What observable change would make you reconsider?" /></label>
                    </div>
                    {error ? <p role="alert" className="mt-3 text-sm text-[var(--v7-risk)]">{error}</p> : null}
                    <button type="submit" disabled={revealing || !supportingEvidence.trim() || !contraryEvidence.trim() || !invalidation.trim()} className="mt-4 min-h-11 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent)] px-4 text-sm font-bold text-[var(--v7-on-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-accent)]">{revealing ? 'Revealing…' : 'Commit view & reveal next checkpoint'}</button>
                </form> : null}

                {committed && reveal ? <div data-testid="replay-revealed-state" className="mt-5 grid gap-4">
                    <section className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 sm:p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Your original commitment · locked</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div><p className="text-xs text-[var(--v7-text-muted)]">View</p><p className="mt-1 font-semibold capitalize text-[var(--v7-text)]">{committed.view}</p></div>
                            <div><p className="text-xs text-[var(--v7-text-muted)]">Confidence</p><p className="mt-1 font-mono font-semibold text-[var(--v7-text)]">{committed.confidence}%</p></div>
                            <div><p className="text-xs text-[var(--v7-text-muted)]">Invalidation</p><p className="mt-1 text-sm leading-5 text-[var(--v7-text-secondary)]">{committed.invalidation}</p></div>
                        </div>
                        <details className="mt-3"><summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--v7-text)]">Show original evidence reasoning</summary><p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]"><strong>For:</strong> {committed.supportingEvidence}</p><p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]"><strong>Against:</strong> {committed.contraryEvidence}</p></details>
                    </section>
                    <section className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Next annual checkpoint revealed</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--v7-text-secondary)]">This is the next safe filing-aligned observation, not a claim that the stock outcome proves your original decision right or wrong.</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <ReplayMetric label="Later price" value={money(reveal.nextObservation.price)} note={`Safe post-filing close on ${date(reveal.nextObservation.priceDate)}.`} />
                            <ReplayMetric label="Later P/E" value={number(reveal.nextObservation.priceEarnings, '×')} note={`Previously ${number(intro.observation.priceEarnings, '×')}. Interpret the multiple and earnings together.`} />
                            <ReplayMetric label="Later annual EPS basis" value={nextAnnualEps === null ? 'Unavailable' : money(nextAnnualEps)} note={`Previously ${annualEps === null ? 'unavailable' : money(annualEps)}.`} />
                            <ReplayMetric label="Later annual revenue" value={money(reveal.nextObservation.annualRevenue)} note={`Fiscal period ended ${date(reveal.nextObservation.fiscalPeriodEnd)}.`} />
                        </div>
                    </section>
                    <section className="rounded-[11px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4 sm:p-5">
                        <h3 className="font-bold text-[var(--v7-text)]">Debrief the reasoning, not just the return</h3>
                        <ul className="mt-2 grid gap-2 text-sm leading-6 text-[var(--v7-text-secondary)] sm:grid-cols-2">
                            <li>• Did earnings change faster or slower than price?</li>
                            <li>• Did the P/E expand or compress?</li>
                            <li>• Which original evidence remained valid?</li>
                            <li>• Which assumption would you revise with the new information?</li>
                        </ul>
                    </section>
                    {activeCaseId ? <form onSubmit={saveReflection} className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5" aria-labelledby="replay-reflection-title">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Reflection</p>
                        <h3 id="replay-reflection-title" className="mt-1 font-bold text-[var(--v7-text)]">What I believed then vs. what I know now</h3>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Which reasoning held up?<textarea value={reasoningHeldUp} onChange={(event) => setReasoningHeldUp(event.target.value)} maxLength={700} rows={3} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label>
                            <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Which assumption would you revise?<textarea value={assumptionToRevise} onChange={(event) => setAssumptionToRevise(event.target.value)} maxLength={700} rows={3} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label>
                            <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Did confidence match evidence quality?<textarea value={confidenceFit} onChange={(event) => setConfidenceFit(event.target.value)} maxLength={700} rows={3} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label>
                            <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">What would you check sooner next time?<textarea value={nextCheck} onChange={(event) => setNextCheck(event.target.value)} maxLength={700} rows={3} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label>
                        </div>
                        <label className="mt-3 grid max-w-sm gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Concept to revisit<select value={revisitConcept} onChange={(event) => setRevisitConcept(event.target.value as LearnModuleIdV01)} className="min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal">{learnModulesV01.map((module) => <option key={module.id} value={module.id}>{module.title}</option>)}</select></label>
                        <button type="submit" disabled={completedCaseIds.includes(activeCaseId) || !reasoningHeldUp.trim() || !assumptionToRevise.trim() || !confidenceFit.trim() || !nextCheck.trim()} className="mt-4 min-h-11 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent)] px-4 text-sm font-bold text-[var(--v7-on-accent)]">{completedCaseIds.includes(activeCaseId) ? 'Reflection saved ✓' : 'Save reflection'}</button>
                    </form> : <p className="rounded-[9px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-xs leading-5 text-[var(--v7-text-secondary)]">Custom ticker replays remain available for practice, but only the two curated cases update v0.1 Interpret mastery.</p>}
                </div> : null}
            </> : null}
        </section>
    );
};
