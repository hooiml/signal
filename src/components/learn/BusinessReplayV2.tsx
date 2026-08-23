'use client';

import { useEffect, useState } from 'react';
import type { ReplayCommitmentV01, ReplayViewV01 } from '@/lib/learn/v0-1';
import type { BusinessReplayObservationV02 } from '@/lib/learn/v0-2';

type Intro = { readonly symbol: string; readonly companyName: string | null; readonly replayId: string; readonly knownAsOf: string; readonly observation: BusinessReplayObservationV02; readonly sources: readonly string[]; readonly warnings: readonly string[] };
type Reveal = Intro & { readonly nextObservation: BusinessReplayObservationV02 };

const money = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);
const date = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

const Snapshot = ({ observation, label }: { readonly observation: BusinessReplayObservationV02; readonly label: string }) => (
    <section className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">{label}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-[11px] text-[var(--v7-text-muted)]">Annual revenue</p><p className="mt-1 font-mono font-bold">{money(observation.annualRevenue)}</p></div>
            <div><p className="text-[11px] text-[var(--v7-text-muted)]">Annual net income</p><p className="mt-1 font-mono font-bold">{money(observation.annualNetIncome)}</p></div>
            <div><p className="text-[11px] text-[var(--v7-text-muted)]">Free cash flow</p><p className="mt-1 font-mono font-bold">{money(observation.freeCashFlow)}</p></div>
            <div><p className="text-[11px] text-[var(--v7-text-muted)]">P/E after filing</p><p className="mt-1 font-mono font-bold">{observation.priceEarnings.toFixed(2)}×</p></div>
        </div>
        <p className="mt-3 text-xs text-[var(--v7-text-muted)]">Fiscal period {observation.fiscalPeriodEnd} · filed {date(observation.filedAt)} · evidence known through {date(observation.priceDate)} · <a className="underline" href={observation.filingUrl} target="_blank" rel="noreferrer">{observation.form}</a></p>
    </section>
);

export const BusinessReplayV2 = () => {
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

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            try {
                const response = await fetch('/api/learn/business-replay/MSFT?market=US', { signal: controller.signal });
                const payload = await response.json() as { success?: boolean; data?: Intro; error?: string };
                if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Business Replay is unavailable.');
                setIntro(payload.data); setState('ready');
            } catch (caught) {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : 'Business Replay is unavailable.'); setState('error');
            }
        };
        void load();
        return () => controller.abort();
    }, []);

    const canReveal = Boolean(intro && supportingEvidence.trim() && contraryEvidence.trim() && invalidation.trim());
    const commit = async () => {
        if (!intro || !canReveal) return;
        setRevealing(true); setError(null);
        const commitment: ReplayCommitmentV01 = { view, confidence, supportingEvidence: supportingEvidence.trim(), contraryEvidence: contraryEvidence.trim(), invalidation: invalidation.trim() };
        try {
            const response = await fetch(`/api/learn/business-replay/${intro.symbol}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ market: 'US', replayId: intro.replayId, commitment }) });
            const payload = await response.json() as { success?: boolean; data?: Reveal; error?: string };
            if (!response.ok || !payload.success || !payload.data) throw new Error(payload.error ?? 'Reveal failed.');
            setReveal(payload.data);
        } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reveal failed.'); }
        finally { setRevealing(false); }
    };

    return (
        <section data-testid="business-replay" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="border-b border-[var(--v7-border)] pb-4"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Business Replay · v0.2</p><h2 className="mt-1 text-xl font-bold">Read the business before you know the next filing.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">Signal exposes only filing-aligned evidence known at the replay checkpoint. The next annual observation remains server-side until you commit your reasoning.</p></div>
            {state === 'loading' ? <div role="status" className="mt-4 rounded border border-[var(--v7-border)] p-4 text-sm">Loading filing-aligned business evidence…</div> : null}
            {state === 'error' ? <div role="alert" className="mt-4 rounded border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm">{error}</div> : null}
            {state === 'ready' && intro ? <div className="mt-4 grid gap-4">
                <Snapshot observation={intro.observation} label={`${intro.companyName ?? intro.symbol} · what was knowable`} />
                {!reveal ? <div data-testid="business-replay-locked" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="grid gap-3">
                        <fieldset><legend className="text-xs font-bold text-[var(--v7-text)]">Current interpretation</legend><div className="mt-2 flex flex-wrap gap-2">{(['attractive', 'neutral', 'unattractive'] as const).map((candidate) => <button key={candidate} type="button" aria-pressed={view === candidate} onClick={() => setView(candidate)} className={`min-h-10 rounded border px-3 text-xs font-semibold capitalize ${view === candidate ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{candidate}</button>)}</div></fieldset>
                        <label className="grid gap-1 text-xs font-semibold">Confidence · {confidence}%<input aria-label="Business replay confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label>
                        <label className="grid gap-1 text-xs font-semibold">Supporting evidence<textarea aria-label="Business supporting evidence" value={supportingEvidence} onChange={(event) => setSupportingEvidence(event.target.value)} rows={3} maxLength={700} className="rounded border border-[var(--v7-border)] bg-transparent p-3 text-sm" /></label>
                        <label className="grid gap-1 text-xs font-semibold">Contrary evidence<textarea aria-label="Business contrary evidence" value={contraryEvidence} onChange={(event) => setContraryEvidence(event.target.value)} rows={3} maxLength={700} className="rounded border border-[var(--v7-border)] bg-transparent p-3 text-sm" /></label>
                        <label className="grid gap-1 text-xs font-semibold">What would change your mind?<textarea aria-label="Business invalidation" value={invalidation} onChange={(event) => setInvalidation(event.target.value)} rows={3} maxLength={700} className="rounded border border-[var(--v7-border)] bg-transparent p-3 text-sm" /></label>
                    </div>
                    <aside className="rounded-[11px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-4 text-sm leading-6 text-[var(--v7-text-secondary)]"><strong className="text-[var(--v7-text)]">Future locked.</strong><p className="mt-2">The next filing, later price-aligned multiple, and later cash-flow result are absent from this response.</p><button type="button" disabled={!canReveal || revealing} onClick={() => void commit()} className="mt-4 min-h-11 w-full rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-3 font-bold text-[var(--v7-text)] disabled:opacity-50">{revealing ? 'Revealing…' : 'Commit & reveal next filing'}</button></aside>
                </div> : <div data-testid="business-replay-revealed" className="grid gap-4"><Snapshot observation={reveal.nextObservation} label="Next filing checkpoint · revealed after commitment" /><div className="rounded-[11px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4 text-sm leading-6"><strong>Your original commitment remains the reference point.</strong><p className="mt-2 text-[var(--v7-text-secondary)]">Review which business driver changed and whether your reasoning process was sound. Do not treat the subsequent outcome as proof the same setup will repeat.</p></div></div>}
                {error ? <p role="alert" className="text-sm text-[var(--v7-risk)]">{error}</p> : null}
            </div> : null}
        </section>
    );
};
