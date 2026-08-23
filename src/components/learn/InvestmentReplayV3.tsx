'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateScenarioV03, scenarioProbabilityTotalV03, type ScenarioInputV03 } from '@/lib/learn/v0-3';
import type { ReplayCommitmentV01, ReplayViewV01 } from '@/lib/learn/v0-1';
import type { BusinessReplayObservationV02 } from '@/lib/learn/v0-2';

type Intro = { readonly symbol: string; readonly companyName: string | null; readonly replayId: string; readonly knownAsOf: string; readonly observation: BusinessReplayObservationV02; readonly sources: readonly string[]; readonly warnings: readonly string[] };
type Reveal = Intro & { readonly nextObservation: BusinessReplayObservationV02 };

const money = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

const Snapshot = ({ observation, label }: { readonly observation: BusinessReplayObservationV02; readonly label: string }) => <section className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">{label}</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-[11px] text-[var(--v7-text-muted)]">Annual revenue</p><p className="mt-1 font-mono font-bold">{money(observation.annualRevenue)}</p></div><div><p className="text-[11px] text-[var(--v7-text-muted)]">Annual net income</p><p className="mt-1 font-mono font-bold">{money(observation.annualNetIncome)}</p></div><div><p className="text-[11px] text-[var(--v7-text-muted)]">FCF</p><p className="mt-1 font-mono font-bold">{money(observation.freeCashFlow)}</p></div><div><p className="text-[11px] text-[var(--v7-text-muted)]">P/E after filing</p><p className="mt-1 font-mono font-bold">{observation.priceEarnings.toFixed(2)}×</p></div></div><p className="mt-3 text-xs text-[var(--v7-text-muted)]">Fiscal {observation.fiscalPeriodEnd} · filed {date(observation.filedAt)} · known through {date(observation.priceDate)} · <a className="underline" href={observation.filingUrl} target="_blank" rel="noreferrer">{observation.form}</a></p></section>;

export const InvestmentReplayV3 = () => {
    const [intro, setIntro] = useState<Intro | null>(null);
    const [reveal, setReveal] = useState<Reveal | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [view, setView] = useState<ReplayViewV01>('neutral');
    const [confidence, setConfidence] = useState(50);
    const [supportingEvidence, setSupportingEvidence] = useState('');
    const [contraryEvidence, setContraryEvidence] = useState('');
    const [invalidation, setInvalidation] = useState('');
    const [revealing, setRevealing] = useState(false);
    const [scenarios, setScenarios] = useState<ScenarioInputV03[]>([
        { name: 'Bear', earnings: 8, multiple: 22, probability: 25, note: 'Business weakens or the required multiple compresses.' },
        { name: 'Base', earnings: 10, multiple: 30, probability: 50, note: 'Current economics broadly persist.' },
        { name: 'Bull', earnings: 12, multiple: 36, probability: 25, note: 'Growth and economics exceed the base case.' },
    ]);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            try {
                const response = await fetch('/api/learn/business-replay/MSFT?market=US', { signal: controller.signal });
                const payload = await response.json() as { success?: boolean; data?: Intro; error?: string };
                if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Investment Replay is unavailable.');
                setIntro(payload.data); setState('ready');
                const epsProxy = payload.data.observation.annualNetIncome > 0 ? 10 : 8;
                const multiple = payload.data.observation.priceEarnings;
                setScenarios([
                    { name: 'Bear', earnings: epsProxy * 0.8, multiple: multiple * 0.75, probability: 25, note: 'Business or valuation assumptions deteriorate.' },
                    { name: 'Base', earnings: epsProxy, multiple, probability: 50, note: 'Current evidence broadly persists.' },
                    { name: 'Bull', earnings: epsProxy * 1.2, multiple: multiple * 1.15, probability: 25, note: 'Business economics exceed the base case.' },
                ]);
            } catch (caught) { if (controller.signal.aborted) return; setError(caught instanceof Error ? caught.message : 'Investment Replay is unavailable.'); setState('error'); }
        };
        void load(); return () => controller.abort();
    }, []);

    const total = scenarioProbabilityTotalV03(scenarios);
    const results = useMemo(() => scenarios.map(calculateScenarioV03), [scenarios]);
    const canReveal = Boolean(intro && total === 100 && supportingEvidence.trim() && contraryEvidence.trim() && invalidation.trim());
    const revealNext = async () => {
        if (!intro || !canReveal) return;
        const commitment: ReplayCommitmentV01 = { view, confidence, supportingEvidence: supportingEvidence.trim(), contraryEvidence: contraryEvidence.trim(), invalidation: invalidation.trim() };
        setRevealing(true); setError(null);
        try {
            const response = await fetch(`/api/learn/business-replay/${intro.symbol}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market: 'US', replayId: intro.replayId, commitment }) });
            const payload = await response.json() as { success?: boolean; data?: Reveal; error?: string };
            if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Reveal failed.');
            setReveal(payload.data);
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reveal failed.'); }
        finally { setRevealing(false); }
    };

    return <section data-testid="investment-replay-v3" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6"><div className="border-b border-[var(--v7-border)] pb-4"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Investment Replay · v0.3</p><h2 className="mt-1 text-xl font-bold">Form the thesis before seeing the next filing.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">This reuses Signal’s filing-aligned business replay. The future checkpoint remains server-side; scenario outputs below are your assumptions, not historical analyst estimates.</p></div>{state === 'loading' ? <p role="status" className="mt-4 rounded border border-[var(--v7-border)] p-4 text-sm">Loading point-in-time evidence…</p> : null}{state === 'error' ? <p role="alert" className="mt-4 rounded border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm">{error}</p> : null}{state === 'ready' && intro ? <div className="mt-4 grid gap-4"><Snapshot observation={intro.observation} label={`${intro.companyName ?? intro.symbol} · evidence available then`} />{!reveal ? <><section className="rounded-[11px] border border-[var(--v7-border)] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold">Historical scenario assumptions</p><p className="mt-1 text-[11px] text-[var(--v7-text-muted)]">These are learner inputs; no historical consensus dataset is available.</p></div><span className={`rounded-full border px-2 py-1 font-mono text-xs ${total === 100 ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)]'}`}>{total}%</span></div><div className="mt-3 grid gap-2 lg:grid-cols-3">{scenarios.map((scenario, index) => <article key={scenario.name} className="rounded border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-xs font-bold">{scenario.name}</p><div className="mt-2 grid grid-cols-3 gap-2"><label className="grid gap-1 text-[10px]">EPS<input aria-label={`Replay ${scenario.name} EPS`} type="number" step="0.25" value={scenario.earnings} onChange={(event) => setScenarios((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, earnings: Number(event.target.value) } : item))} className="min-h-9 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono text-xs" /></label><label className="grid gap-1 text-[10px]">P/E<input aria-label={`Replay ${scenario.name} P/E`} type="number" step="1" value={scenario.multiple} onChange={(event) => setScenarios((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, multiple: Number(event.target.value) } : item))} className="min-h-9 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono text-xs" /></label><label className="grid gap-1 text-[10px]">Probability<input aria-label={`Replay ${scenario.name} probability`} type="number" value={scenario.probability} onChange={(event) => setScenarios((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, probability: Number(event.target.value) } : item))} className="min-h-9 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono text-xs" /></label></div><p className="mt-2 text-[11px] text-[var(--v7-text-muted)]">Implied value: <span className="font-mono font-bold text-[var(--v7-text)]">{results[index].impliedValue === null ? 'N/A' : `$${results[index].impliedValue?.toFixed(2)}`}</span></p></article>)}</div></section><div data-testid="investment-replay-locked" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="grid gap-3"><fieldset><legend className="text-xs font-bold">Current interpretation</legend><div className="mt-2 flex gap-2">{(['attractive', 'neutral', 'unattractive'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={view === candidate} onClick={() => setView(candidate)} className={`min-h-10 rounded border px-3 text-xs font-semibold capitalize ${view === candidate ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{candidate}</button>)}</div></fieldset><label className="grid gap-1 text-xs font-semibold">Confidence · {confidence}%<input aria-label="Investment replay confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label><label className="grid gap-1 text-xs font-semibold">Supporting evidence<textarea aria-label="Investment replay supporting evidence" rows={3} value={supportingEvidence} onChange={(event) => setSupportingEvidence(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Contrary evidence<textarea aria-label="Investment replay contrary evidence" rows={3} value={contraryEvidence} onChange={(event) => setContraryEvidence(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label><label className="grid gap-1 text-xs font-semibold">Invalidation condition<textarea aria-label="Investment replay invalidation" rows={3} value={invalidation} onChange={(event) => setInvalidation(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-sm" /></label></div><aside className="rounded-[11px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-4 text-sm leading-6 text-[var(--v7-text-secondary)]"><strong className="text-[var(--v7-text)]">Future locked.</strong><p className="mt-2">The next filing and later valuation evidence are not in the initial response.</p>{total !== 100 ? <p className="mt-2 text-xs">Fix scenario probabilities before committing.</p> : null}<button type="button" disabled={!canReveal || revealing} onClick={() => void revealNext()} className="mt-4 min-h-11 w-full rounded border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-3 font-bold disabled:opacity-50">{revealing ? 'Revealing…' : 'Commit thesis & reveal'}</button></aside></div></> : <div data-testid="investment-replay-revealed" className="grid gap-4"><Snapshot observation={reveal.nextObservation} label="Next filing · revealed after commitment" /><div className="rounded-[11px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4 text-sm leading-6"><strong>Review the process, not just the outcome.</strong><p className="mt-2 text-[var(--v7-text-secondary)]">Compare what changed in revenue, cash generation, earnings, and valuation with the assumptions you committed before the reveal.</p></div></div>}{error ? <p role="alert" className="text-sm text-[var(--v7-risk)]">{error}</p> : null}</div> : null}</section>;
};
