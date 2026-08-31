'use client';

import { useEffect, useState } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchMarket } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';

type SnapshotState = {
    readonly status: 'loading' | 'ready' | 'error';
    readonly data: ResearchSnapshot | null;
    readonly error: string | null;
};

const emptyState: SnapshotState = { status: 'loading', data: null, error: null };

const useSnapshot = (symbol: string, market: ResearchMarket, reloadKey: number) => {
    const [state, setState] = useState<SnapshotState>(emptyState);
    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState(emptyState);
            try {
                const response = await fetch(`/api/research/symbol/${encodeURIComponent(symbol)}?market=${market}`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error('Comparison evidence is unavailable.');
                setState({ status: 'ready', data: parseResearchSnapshotResponse(payload), error: null });
            } catch (error) {
                if (controller.signal.aborted) return;
                setState({ status: 'error', data: null, error: error instanceof Error ? error.message : 'Comparison evidence is unavailable.' });
            }
        };
        void load();
        return () => controller.abort();
    }, [market, reloadKey, symbol]);
    return state;
};

const formatted = (value: number | null, suffix = '') => value === null
    ? 'Unavailable'
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

const dateTime = (value: string) => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

const companyName = (snapshot: ResearchSnapshot) => snapshot.quote.name ?? snapshot.symbol;

export const LearnCompareV1 = () => {
    const [market, setMarket] = useState<ResearchMarket>('US');
    const [leftInput, setLeftInput] = useState('MSFT');
    const [rightInput, setRightInput] = useState('NVDA');
    const [leftSymbol, setLeftSymbol] = useState('MSFT');
    const [rightSymbol, setRightSymbol] = useState('NVDA');
    const [reloadKey, setReloadKey] = useState(0);
    const [selectedEvidence, setSelectedEvidence] = useState('P/E and revenue growth');
    const [reasoning, setReasoning] = useState('');
    const [recordedReasoning, setRecordedReasoning] = useState<string | null>(null);
    const left = useSnapshot(leftSymbol, market, reloadKey);
    const right = useSnapshot(rightSymbol, market, reloadKey);

    const load = (event: React.FormEvent) => {
        event.preventDefault();
        const normalize = (value: string) => value.trim().toUpperCase();
        const nextLeft = normalize(leftInput);
        const nextRight = normalize(rightInput);
        if (!/^[A-Z0-9.-]{1,15}$/.test(nextLeft) || !/^[A-Z0-9.-]{1,15}$/.test(nextRight) || nextLeft === nextRight) return;
        setLeftSymbol(nextLeft);
        setRightSymbol(nextRight);
        setRecordedReasoning(null);
        setReloadKey((value) => value + 1);
    };

    const snapshots = left.data && right.data ? [left.data, right.data] as const : null;
    const rows = snapshots ? [
        ['Price', formatted(snapshots[0].quote.price), formatted(snapshots[1].quote.price)],
        ['P/E', formatted(snapshots[0].valuation.priceEarnings, '×'), formatted(snapshots[1].valuation.priceEarnings, '×')],
        ['Revenue growth', formatted(snapshots[0].fundamentals.revenueGrowthPercent, '%'), formatted(snapshots[1].fundamentals.revenueGrowthPercent, '%')],
        ['Operating margin', formatted(snapshots[0].fundamentals.operatingMarginPercent, '%'), formatted(snapshots[1].fundamentals.operatingMarginPercent, '%')],
        ['Cash', formatted(snapshots[0].fundamentals.cash), formatted(snapshots[1].fundamentals.cash)],
        ['Debt', formatted(snapshots[0].fundamentals.debt), formatted(snapshots[1].fundamentals.debt)],
    ] as const : [];

    return (
        <section data-testid="learn-compare" aria-labelledby="learn-compare-title" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Compare companies</p>
                    <h2 id="learn-compare-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">Compare evidence without declaring a winner</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--v7-text-secondary)]">The same ratio can mean different things for businesses with different margins, capital needs, durability, and growth expectations.</p>
                </div>
                <form onSubmit={load} className="grid w-full grid-cols-[86px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 lg:w-auto" aria-label="Company comparison selector">
                    <select value={market} onChange={(event) => setMarket(event.target.value as ResearchMarket)} aria-label="Comparison market" className="min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-2 text-sm"><option value="US">US</option><option value="MY">MY</option></select>
                    <input value={leftInput} onChange={(event) => setLeftInput(event.target.value.toUpperCase())} aria-label="First ticker" className="min-h-10 min-w-0 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono text-sm uppercase" />
                    <input value={rightInput} onChange={(event) => setRightInput(event.target.value.toUpperCase())} aria-label="Second ticker" className="min-h-10 min-w-0 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono text-sm uppercase" />
                    <button type="submit" disabled={leftInput.trim().toUpperCase() === rightInput.trim().toUpperCase()} className="min-h-10 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-3 text-sm font-semibold">Load</button>
                </form>
            </div>

            {left.status === 'loading' || right.status === 'loading' ? <p role="status" className="mt-4 text-sm text-[var(--v7-text-secondary)]">Loading both evidence sets…</p> : null}
            {left.status === 'error' || right.status === 'error' ? <div role="alert" className="mt-4 rounded-[9px] border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-3 text-sm text-[var(--v7-text-secondary)]">{left.error ?? right.error}</div> : null}

            {snapshots ? <>
                <div className="research-scrollbar mt-4 overflow-x-auto rounded-[11px] border border-[var(--v7-border)]">
                    <table className="w-full min-w-[620px] border-collapse text-left text-sm">
                        <thead className="bg-[var(--v7-surface-quiet)]"><tr><th className="p-3 text-xs text-[var(--v7-text-muted)]">Evidence</th>{snapshots.map((snapshot) => <th key={snapshot.symbol} className="p-3"><span className="font-bold text-[var(--v7-text)]">{companyName(snapshot)}</span><span className="ml-2 font-mono text-xs text-[var(--v7-text-muted)]">{snapshot.symbol}</span><span className="mt-1 block text-[11px] font-normal text-[var(--v7-text-muted)]">Fetched {dateTime(snapshot.fetchedAt)}</span></th>)}</tr></thead>
                        <tbody>{rows.map(([label, first, second]) => <tr key={label} className="border-t border-[var(--v7-border)]"><th className="p-3 text-xs font-semibold text-[var(--v7-text-secondary)]">{label}</th><td className="p-3 font-mono tabular-nums text-[var(--v7-text)]">{first}</td><td className="p-3 font-mono tabular-nums text-[var(--v7-text)]">{second}</td></tr>)}</tbody>
                    </table>
                </div>
                <div className="mt-3 rounded-[9px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-xs leading-5 text-[var(--v7-text-secondary)]">No automatic winner: confirm industry, business model, accounting basis, reporting period, and source coverage before treating these values as directly comparable.</div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_auto] lg:items-end">
                    <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Evidence that matters<select value={selectedEvidence} onChange={(event) => setSelectedEvidence(event.target.value)} className="min-h-10 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal"><option>P/E and revenue growth</option><option>Margins and growth</option><option>Cash and debt</option><option>Source coverage and periods</option></select></label>
                    <label className="grid gap-1.5 text-sm font-semibold text-[var(--v7-text)]">Why does it matter?<textarea value={reasoning} onChange={(event) => setReasoning(event.target.value)} maxLength={700} rows={3} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 font-normal" placeholder="Explain what this evidence does and does not tell you." /></label>
                    <button type="button" disabled={!reasoning.trim()} onClick={() => setRecordedReasoning(`${selectedEvidence}: ${reasoning.trim()}`)} className="min-h-11 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent)] px-4 text-sm font-bold text-[var(--v7-on-accent)]">Record reasoning</button>
                </div>
                {recordedReasoning ? <p role="status" className="mt-3 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-3 text-sm text-[var(--v7-text-secondary)]">Recorded for this session: {recordedReasoning}</p> : null}
                <p className="mt-3 text-xs text-[var(--v7-text-muted)]">Providers: {snapshots.map((snapshot) => `${snapshot.symbol}: ${snapshot.sources.join(' · ') || 'Unavailable'}`).join(' | ')}</p>
            </> : null}
        </section>
    );
};
