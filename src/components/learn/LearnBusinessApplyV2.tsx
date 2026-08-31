'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchMarket } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';

const percentChange = (current: number | null, previous: number | null) => current === null || previous === null || previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
const percentRatio = (numerator: number | null, denominator: number | null) => numerator === null || denominator === null || denominator === 0 ? null : (numerator / denominator) * 100;
const formatted = (value: number | null, suffix = '', compact = false) => value === null ? 'Unavailable' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, notation: compact ? 'compact' : 'standard' }).format(value)}${suffix}`;
const dateTime = (value: string) => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed); };

export const LearnBusinessApplyV2 = ({ completed, onComplete }: { readonly completed: boolean; readonly onComplete: () => void }) => {
    const [symbolInput, setSymbolInput] = useState('MSFT');
    const [symbol, setSymbol] = useState('MSFT');
    const [market, setMarket] = useState<ResearchMarket>('US');
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reloadKey, setReloadKey] = useState(0);
    const [driver, setDriver] = useState('');
    const [evidence, setEvidence] = useState('');
    const [implication, setImplication] = useState('');
    const [limitation, setLimitation] = useState('');

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading'); setError(null); setSnapshot(null);
            try {
                const response = await fetch(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${market}`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error('Current business evidence is unavailable.');
                setSnapshot(parseResearchSnapshotResponse(payload)); setState('ready');
            } catch (caught) {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : 'Current business evidence is unavailable.'); setState('error');
            }
        };
        void load();
        return () => controller.abort();
    }, [market, reloadKey, symbol]);

    const metrics = useMemo(() => {
        if (!snapshot) return [];
        const history = snapshot.fundamentals.history;
        const latest = history[0] ?? null;
        const previous = history[1] ?? null;
        const latestEps = latest?.annualNetIncome !== null && latest?.annualNetIncome !== undefined && latest.shares ? latest.annualNetIncome / latest.shares : null;
        const previousEps = previous?.annualNetIncome !== null && previous?.annualNetIncome !== undefined && previous.shares ? previous.annualNetIncome / previous.shares : null;
        return [
            ['Revenue growth', formatted(snapshot.fundamentals.revenueGrowthPercent, '%'), 'Reported/derived by the connected fundamentals source'],
            ['EPS growth', formatted(percentChange(latestEps, previousEps), '%'), 'Derived: comparable annual EPS periods'],
            ['FCF growth', formatted(percentChange(latest?.freeCashFlow ?? null, previous?.freeCashFlow ?? null), '%'), 'Derived: annual FCF change'],
            ['Gross margin', formatted(snapshot.fundamentals.grossMarginPercent, '%'), 'Derived from sourced annual values'],
            ['Operating margin', formatted(snapshot.fundamentals.operatingMarginPercent, '%'), 'Derived from sourced annual values'],
            ['Net margin', formatted(percentRatio(snapshot.fundamentals.annualNetIncome, snapshot.fundamentals.annualRevenue), '%'), 'Derived: net income / revenue'],
            ['FCF margin', formatted(percentRatio(snapshot.fundamentals.freeCashFlow, snapshot.fundamentals.annualRevenue), '%'), 'Derived: FCF / revenue'],
            ['Cash', formatted(snapshot.fundamentals.cash, '', true), 'Reported annual value where available'],
            ['Debt', formatted(snapshot.fundamentals.debt, '', true), 'Reported annual value where available'],
            ['Net debt', formatted(snapshot.valuation.netCash === null ? null : -snapshot.valuation.netCash, '', true), 'Derived: debt - cash'],
            ['Interest coverage', 'Unavailable', 'The current provider contract has no approved interest-expense input'],
            ['ROIC', 'Unavailable', 'The current provider contract has no approved invested-capital methodology'],
            ['Share-count trend', formatted(snapshot.fundamentals.shareChangePercent, '%'), 'Derived from comparable diluted annual shares'],
            ['P/E', formatted(snapshot.valuation.priceEarnings, 'x'), 'Current price / latest positive annual EPS basis'],
            ['Forward P/E', 'Unavailable', 'No approved estimate-history provider'],
            ['FCF yield', formatted(snapshot.valuation.freeCashFlowYieldPercent, '%'), 'Derived: annual FCF / current market capitalization'],
        ] as const;
    }, [snapshot]);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        const next = symbolInput.trim().toUpperCase();
        if (!/^[A-Z0-9.-]{1,15}$/.test(next)) { setError('Use a valid 1-15 character ticker.'); setState('error'); return; }
        if (next === symbol) setReloadKey((value) => value + 1); else setSymbol(next);
        setDriver(''); setEvidence(''); setImplication(''); setLimitation('');
    };
    const ready = Boolean(snapshot && driver.trim() && evidence.trim() && implication.trim() && limitation.trim());

    return (
        <section data-testid="business-apply" aria-labelledby="business-apply-title" className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Apply live</p><h2 id="business-apply-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">Connect current business evidence to valuation</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">Select the business driver that most changes your interpretation. Missing accounting inputs stay unavailable rather than being invented.</p></div><form onSubmit={submit} className="flex w-full gap-2 lg:w-auto"><select value={market} onChange={(event) => setMarket(event.target.value as ResearchMarket)} aria-label="Business analysis market" className="min-h-10 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3"><option value="US">US</option><option value="MY">MY</option></select><input value={symbolInput} onChange={(event) => setSymbolInput(event.target.value.toUpperCase())} aria-label="Business analysis ticker" className="min-h-10 min-w-0 flex-1 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono uppercase lg:w-28" /><button type="submit" className="min-h-10 rounded-[8px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-4 font-semibold">Load</button></form></div>
            {state === 'loading' ? <p role="status" className="mt-4 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-sm">Loading current business evidence for {symbol}...</p> : null}
            {state === 'error' ? <div role="alert" className="mt-4 flex items-center justify-between gap-3 rounded-[8px] border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm"><span>{error}</span><button type="button" onClick={() => setReloadKey((value) => value + 1)} className="min-h-10 rounded-[8px] border border-[var(--v7-border)] px-3 font-semibold">Retry</button></div> : null}
            {state === 'ready' && snapshot ? <><div className="mt-4 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-lg font-bold text-[var(--v7-text)]">{snapshot.quote.name ?? snapshot.symbol} <span className="font-mono text-sm text-[var(--v7-text-muted)]">{snapshot.symbol}</span></h3><span className="text-xs text-[var(--v7-text-muted)]">Fetched {dateTime(snapshot.fetchedAt)}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{metrics.map(([label, value, note]) => <article key={label} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--v7-text-muted)]">{label}</p><p className="mt-1 font-mono text-lg font-bold text-[var(--v7-text)]">{value}</p><p className="mt-2 text-xs leading-5 text-[var(--v7-text-secondary)]">{note}</p></article>)}</div><p className="mt-3 text-xs text-[var(--v7-text-muted)]">Reporting period: {snapshot.fundamentals.reportingPeriod ?? 'Unavailable'} | Sources: {snapshot.sources.join(' | ') || 'Unavailable'} | Warnings: {snapshot.warnings.join(' | ') || 'None'}</p><form className="mt-5 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4" onSubmit={(event) => { event.preventDefault(); if (ready && !completed) onComplete(); }}><p className="font-bold text-[var(--v7-text)]">Which business driver most affects your current valuation interpretation?</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Selected driver<select value={driver} onChange={(event) => setDriver(event.target.value)} className="min-h-10 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal"><option value="">Choose one</option><option>Revenue growth quality</option><option>Margin direction</option><option>Cash conversion and CapEx</option><option>Debt and interest resilience</option><option>Capital efficiency</option><option>Dilution</option></select></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Evidence supporting the selection<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} maxLength={700} rows={3} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Valuation and thesis implication<textarea value={implication} onChange={(event) => setImplication(event.target.value)} maxLength={700} rows={3} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label><label className="grid gap-1 text-sm font-semibold text-[var(--v7-text)]">Evidence limitation or missing input<textarea value={limitation} onChange={(event) => setLimitation(event.target.value)} maxLength={700} rows={3} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" /></label></div><button type="submit" disabled={!ready || completed} className="mt-4 min-h-11 rounded-[8px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-[var(--v7-on-accent)] disabled:opacity-50">{completed ? 'Apply reflection saved' : 'Mark Apply complete'}</button></form></> : null}
        </section>
    );
};
