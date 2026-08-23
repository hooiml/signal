'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchMarket } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';

type EvidenceCategory = 'supports' | 'against' | 'context' | 'unknown';
type EvidenceItem = { readonly id: string; readonly category: EvidenceCategory; readonly text: string };

const categoryLabels: Record<EvidenceCategory, string> = {
    supports: 'Supports',
    against: 'Against',
    context: 'Context',
    unknown: 'Unknown',
};

const money = (value: number | null, currency: string | null) => value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: currency ?? 'USD', maximumFractionDigits: 2 }).format(value);
const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
const dateTime = (value: string) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const Metric = ({ label, value, note }: { readonly label: string; readonly value: string; readonly note: string }) => (
    <article className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">{label}</p>
        <p className="mt-1 font-mono text-xl font-bold tabular-nums text-[var(--v7-text)]">{value}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--v7-text-secondary)]">{note}</p>
    </article>
);

export const LearnApplyV1 = () => {
    const [symbolInput, setSymbolInput] = useState('MSFT');
    const [symbol, setSymbol] = useState('MSFT');
    const [market, setMarket] = useState<ResearchMarket>('US');
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [evidenceText, setEvidenceText] = useState('');
    const [evidenceCategory, setEvidenceCategory] = useState<EvidenceCategory>('context');
    const [view, setView] = useState<'attractive' | 'neutral' | 'unattractive'>('neutral');
    const [confidence, setConfidence] = useState(50);
    const [thesis, setThesis] = useState('');
    const [invalidation, setInvalidation] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading');
            setError(null);
            try {
                const response = await fetch(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${market}`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) {
                    const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
                        ? String((payload as { error: string }).error)
                        : 'Current evidence is unavailable.';
                    throw new Error(message);
                }
                setSnapshot(parseResearchSnapshotResponse(payload));
                setState('ready');
            } catch (caught) {
                if (controller.signal.aborted) return;
                setSnapshot(null);
                setError(caught instanceof Error ? caught.message : 'Current evidence is unavailable.');
                setState('error');
            }
        };
        void load();
        return () => controller.abort();
    }, [market, reloadKey, symbol]);

    const contextSuggestion = useMemo(() => {
        if (!snapshot) return '';
        const pe = snapshot.valuation.priceEarnings;
        const growth = snapshot.fundamentals.revenueGrowthPercent;
        const pieces = [
            pe === null ? null : `P/E ${pe.toFixed(2)}× on Signal's current-price/latest-annual-earnings basis`,
            growth === null ? null : `revenue growth ${growth.toFixed(2)}%`,
        ].filter((item): item is string => item !== null);
        return pieces.join('; ');
    }, [snapshot]);

    const submitSymbol = (event: React.FormEvent) => {
        event.preventDefault();
        const normalized = symbolInput.trim().toUpperCase();
        if (!/^[A-Z0-9.-]{1,15}$/.test(normalized)) {
            setError('Use a valid 1–15 character ticker symbol.');
            setState('error');
            return;
        }
        if (normalized === symbol) setReloadKey((value) => value + 1);
        else setSymbol(normalized);
    };

    const addEvidence = (event: React.FormEvent) => {
        event.preventDefault();
        const text = evidenceText.trim();
        if (!text) return;
        setEvidence((items) => [...items, { id: `${Date.now()}-${items.length}`, category: evidenceCategory, text }]);
        setEvidenceText('');
    };

    const counts = useMemo(() => Object.fromEntries((Object.keys(categoryLabels) as EvidenceCategory[]).map((category) => [category, evidence.filter((item) => item.category === category).length])) as Record<EvidenceCategory, number>, [evidence]);
    const currency = snapshot?.quote.currency ?? (market === 'MY' ? 'MYR' : 'USD');

    return (
        <div className="grid gap-5">
            <section aria-labelledby="apply-today-title" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
                <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Apply today</p>
                        <h2 id="apply-today-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">Use current evidence without pretending the answer is known</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--v7-text-secondary)]">Current market data is an unresolved exercise. Signal shows the evidence, its timestamp, and its limitations; you form the view.</p>
                    </div>
                    <form onSubmit={submitSymbol} className="flex w-full gap-2 lg:w-auto" aria-label="Current company selector">
                        <select value={market} onChange={(event) => setMarket(event.target.value as ResearchMarket)} className="min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 text-sm text-[var(--v7-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-accent)]">
                            <option value="US">US</option>
                            <option value="MY">MY</option>
                        </select>
                        <input value={symbolInput} onChange={(event) => setSymbolInput(event.target.value.toUpperCase())} aria-label="Ticker symbol" className="min-h-10 min-w-0 flex-1 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono text-sm uppercase text-[var(--v7-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-accent)] lg:w-28" />
                        <button type="submit" className="min-h-10 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-4 text-sm font-semibold text-[var(--v7-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-accent)]">Load</button>
                    </form>
                </div>

                {state === 'loading' ? <div role="status" className="mt-4 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-sm text-[var(--v7-text-secondary)]">Loading current evidence for {symbol}…</div> : null}
                {state === 'error' ? <div role="alert" className="mt-4 flex flex-col gap-3 rounded-[11px] border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm text-[var(--v7-text-secondary)] sm:flex-row sm:items-center sm:justify-between"><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="min-h-10 rounded-[9px] border border-[var(--v7-border)] px-3 font-semibold">Retry</button></div> : null}

                {state === 'ready' && snapshot ? <>
                    <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-lg font-bold text-[var(--v7-text)]">{snapshot.quote.name ?? snapshot.symbol} <span className="font-mono text-sm text-[var(--v7-text-muted)]">{snapshot.symbol}</span></h3>
                        <span className="text-xs text-[var(--v7-text-muted)]">Fetched {dateTime(snapshot.fetchedAt)}</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Metric label="Current price" value={money(snapshot.quote.price, currency)} note="Current/near-current quote from the existing Research data boundary." />
                        <Metric label="P/E" value={number(snapshot.valuation.priceEarnings, '×')} note={`Derived by Signal from current price plus latest available annual inputs; period ${snapshot.valuation.reportingPeriod ?? 'unavailable'}. Not labeled TTM.`} />
                        <Metric label="Revenue growth" value={number(snapshot.fundamentals.revenueGrowthPercent, '%')} note={`Latest available annual comparison; source ${snapshot.fundamentals.source ?? 'unavailable'}.`} />
                        <Metric label="Forward P/E" value="Unavailable" note="No approved analyst-consensus/estimate-history provider exists in the current Signal data contract. Signal does not invent one." />
                    </div>
                    {snapshot.warnings.length > 0 ? <div role="status" className="mt-3 rounded-[11px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-xs leading-5 text-[var(--v7-text-secondary)]">{snapshot.warnings.join(' ')}</div> : null}
                    <details className="mt-3 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3">
                        <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--v7-text)]">Sources and provenance</summary>
                        <div className="grid gap-2 pb-1 text-xs leading-5 text-[var(--v7-text-secondary)]">
                            <p>Valuation source: {snapshot.valuation.source ?? 'Unavailable'}</p>
                            <p>Fundamental period: {snapshot.fundamentals.reportingPeriod ?? 'Unavailable'}</p>
                            <p>Providers: {snapshot.sources.length > 0 ? snapshot.sources.join(' · ') : 'Unavailable'}</p>
                        </div>
                    </details>
                    {contextSuggestion ? <button type="button" onClick={() => setEvidenceText(contextSuggestion)} className="mt-3 min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 text-sm font-semibold text-[var(--v7-text-secondary)] hover:border-[var(--v7-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-accent)]">Use these facts in Evidence Board</button> : null}
                </> : null}
            </section>

            <section aria-labelledby="evidence-board-title" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Evidence Board</p>
                    <h2 id="evidence-board-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">Classify evidence before writing the thesis</h2>
                </div>
                <form onSubmit={addEvidence} className="mt-4 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                    <select value={evidenceCategory} onChange={(event) => setEvidenceCategory(event.target.value as EvidenceCategory)} aria-label="Evidence category" className="min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 text-sm text-[var(--v7-text)]">
                        {(Object.keys(categoryLabels) as EvidenceCategory[]).map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}
                    </select>
                    <input value={evidenceText} onChange={(event) => setEvidenceText(event.target.value)} maxLength={500} placeholder="What fact, assumption, risk, or unanswered question matters?" className="min-h-10 min-w-0 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 text-sm text-[var(--v7-text)] placeholder:text-[var(--v7-text-muted)]" />
                    <button type="submit" disabled={!evidenceText.trim()} className="min-h-10 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-4 text-sm font-semibold text-[var(--v7-text)]">Add</button>
                </form>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {(Object.keys(categoryLabels) as EvidenceCategory[]).map((category) => <div key={category} className="min-w-0 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3">
                        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-[var(--v7-text)]">{categoryLabels[category]}</h3><span className="rounded-full border border-[var(--v7-border)] px-2 py-0.5 font-mono text-xs text-[var(--v7-text-muted)]">{counts[category]}</span></div>
                        <div className="mt-3 grid gap-2">
                            {evidence.filter((item) => item.category === category).map((item) => <div key={item.id} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-2.5 text-xs leading-5 text-[var(--v7-text-secondary)]"><p>{item.text}</p><button type="button" onClick={() => setEvidence((items) => items.filter((candidate) => candidate.id !== item.id))} className="mt-2 min-h-10 text-xs font-semibold text-[var(--v7-text-muted)] underline underline-offset-2">Remove</button></div>)}
                            {counts[category] === 0 ? <p className="text-xs leading-5 text-[var(--v7-text-muted)]">No evidence classified here yet.</p> : null}
                        </div>
                    </div>)}
                </div>
            </section>

            <section aria-labelledby="thesis-title" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Thesis</p>
                <h2 id="thesis-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">State what you believe — and what would prove it wrong</h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
                    <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">View<select value={view} onChange={(event) => setView(event.target.value as typeof view)} className="min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal"><option value="attractive">Attractive</option><option value="neutral">Neutral</option><option value="unattractive">Unattractive</option></select></label>
                    <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Confidence <span className="font-mono font-normal">{confidence}%</span><input type="range" min="0" max="100" step="5" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className="min-h-10 accent-[var(--v7-accent)]" /></label>
                    <div className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3 text-xs leading-5 text-[var(--v7-text-secondary)]">Evidence balance: {counts.supports} supporting · {counts.against} against · {counts.unknown} unknown. Confidence is your calibration, not a probability Signal generated.</div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Current thesis<textarea value={thesis} onChange={(event) => setThesis(event.target.value)} maxLength={1000} rows={5} placeholder="Explain why the valuation may or may not be justified using the evidence above." className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal leading-6 text-[var(--v7-text)]" /></label>
                    <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">What would change my mind?<textarea value={invalidation} onChange={(event) => setInvalidation(event.target.value)} maxLength={700} rows={5} placeholder="Name an observable condition that would invalidate or materially weaken the thesis." className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal leading-6 text-[var(--v7-text)]" /></label>
                </div>
                {thesis.trim() && invalidation.trim() && counts.against > 0 ? <p role="status" className="mt-3 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-3 text-sm text-[var(--v7-text-secondary)]">Thesis is review-ready. Signal still does not convert it into a Buy/Sell rating.</p> : <p className="mt-3 text-xs leading-5 text-[var(--v7-text-muted)]">For a stronger thesis, include at least one contrary evidence item and a falsifiable invalidation condition.</p>}
            </section>
        </div>
    );
};
