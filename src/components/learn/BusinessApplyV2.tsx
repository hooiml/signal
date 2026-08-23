'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';

const symbols = ['MSFT', 'AAPL', 'NVDA'] as const;

type Focus = 'growth' | 'profitability' | 'cash' | 'balance-sheet' | 'per-share';

const money = (value: number | null, currency = 'USD') => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

export const BusinessApplyV2 = () => {
    const [symbol, setSymbol] = useState<(typeof symbols)[number]>('MSFT');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [focus, setFocus] = useState<Focus>('growth');
    const [retryKey, setRetryKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading');
            setError(null);
            try {
                const response = await fetch(`/api/research/symbol/${symbol}?market=US`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error('Current business evidence is unavailable.');
                setSnapshot(parseResearchSnapshotResponse(payload));
                setState('ready');
            } catch (caught) {
                if (controller.signal.aborted) return;
                setError(caught instanceof Error ? caught.message : 'Current business evidence is unavailable.');
                setState('error');
            }
        };
        void load();
        return () => controller.abort();
    }, [retryKey, symbol]);

    const currency = snapshot?.quote.currency ?? snapshot?.fundamentals.history[0]?.currency ?? 'USD';
    const current = snapshot?.fundamentals;
    const focusedEvidence = useMemo(() => {
        if (!snapshot) return [] as readonly [string, string][];
        if (focus === 'growth') return [['Revenue growth', number(current?.revenueGrowthPercent ?? null, '%')], ['Annual revenue', money(current?.annualRevenue ?? null, currency)]] as const;
        if (focus === 'profitability') return [['Gross margin', number(current?.grossMarginPercent ?? null, '%')], ['Operating margin', number(current?.operatingMarginPercent ?? null, '%')], ['Net income', money(current?.annualNetIncome ?? null, currency)]] as const;
        if (focus === 'cash') return [['Free cash flow', money(current?.freeCashFlow ?? null, currency)], ['FCF yield', number(snapshot.valuation.freeCashFlowYieldPercent, '%')]] as const;
        if (focus === 'balance-sheet') return [['Cash', money(current?.cash ?? null, currency)], ['Debt', money(current?.debt ?? null, currency)], ['Net cash', money(snapshot.valuation.netCash, currency)]] as const;
        return [['Diluted shares', number(current?.shares ?? null)], ['Share-count change', number(current?.shareChangePercent ?? null, '%')], ['P/E context', number(snapshot.valuation.priceEarnings, '×')]] as const;
    }, [currency, current, focus, snapshot]);

    return (
        <section data-testid="business-apply" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 md:flex-row md:items-end md:justify-between">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Apply current evidence · v0.2</p><h2 className="mt-1 text-xl font-bold text-[var(--v7-text)]">Trace the business behind the multiple.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--v7-text-secondary)]">Use reported annual fundamentals and current price-derived valuation evidence. Missing values stay unavailable; Signal does not backfill them with guesses.</p></div>
                <div className="flex gap-2">{symbols.map((candidate) => <button key={candidate} type="button" aria-pressed={symbol === candidate} onClick={() => setSymbol(candidate)} className={`min-h-10 rounded-[9px] border px-3 text-xs font-bold ${symbol === candidate ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{candidate}</button>)}</div>
            </div>

            {state === 'loading' ? <div role="status" className="mt-4 rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-sm text-[var(--v7-text-secondary)]">Loading current business evidence…</div> : null}
            {state === 'error' ? <div role="alert" className="mt-4 rounded-[9px] border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm text-[var(--v7-text-secondary)]">{error}<button type="button" onClick={() => setRetryKey((value) => value + 1)} className="ml-3 min-h-10 rounded border border-[var(--v7-border)] px-3 font-semibold">Retry</button></div> : null}

            {state === 'ready' && snapshot ? <>
                <div className="mt-4 flex flex-wrap gap-2" aria-label="Business evidence lens">{([
                    ['growth', 'Growth'], ['profitability', 'Profitability'], ['cash', 'Cash generation'], ['balance-sheet', 'Balance sheet'], ['per-share', 'Per-share economics'],
                ] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={focus === id} onClick={() => setFocus(id)} className={`min-h-10 rounded-[9px] border px-3 text-xs font-semibold ${focus === id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{label}</button>)}</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{focusedEvidence.map(([label, value]) => <article key={label} className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><p className="text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--v7-text-muted)]">{label}</p><p className="mt-2 font-mono text-lg font-bold text-[var(--v7-text)]">{value}</p></article>)}</div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                    <div className="research-scrollbar overflow-x-auto rounded-[11px] border border-[var(--v7-border)]">
                        <table className="w-full min-w-[720px] text-left text-xs"><caption className="sr-only">Reported annual business history</caption><thead className="bg-[var(--v7-surface-quiet)]"><tr>{['Period', 'Revenue', 'Revenue growth', 'Operating margin', 'Net income', 'FCF', 'Share change'].map((label) => <th key={label} className="border-b border-[var(--v7-border)] px-3 py-2 text-[var(--v7-text-muted)]">{label}</th>)}</tr></thead><tbody>{snapshot.fundamentals.history.map((period) => <tr key={period.reportingPeriod} className="border-b border-[var(--v7-border)] last:border-b-0"><th className="px-3 py-3 text-[var(--v7-text)]">{period.reportingPeriod}</th><td className="px-3 py-3 font-mono">{money(period.annualRevenue, period.currency)}</td><td className="px-3 py-3 font-mono">{number(period.revenueGrowthPercent, '%')}</td><td className="px-3 py-3 font-mono">{number(period.operatingMarginPercent, '%')}</td><td className="px-3 py-3 font-mono">{money(period.annualNetIncome, period.currency)}</td><td className="px-3 py-3 font-mono">{money(period.freeCashFlow, period.currency)}</td><td className="px-3 py-3 font-mono">{number(period.shareChangePercent, '%')}</td></tr>)}</tbody></table>
                    </div>
                    <aside className="rounded-[11px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">Reasoning prompt</p><p className="mt-2 text-sm font-semibold leading-6 text-[var(--v7-text)]">Which underlying driver most changes how you interpret {symbol}&apos;s valuation?</p><p className="mt-3 text-xs leading-5 text-[var(--v7-text-secondary)]">Do not answer from the latest row alone. Compare direction across periods, identify gaps, then return to valuation.</p><div className="mt-4 border-t border-[var(--v7-border)] pt-3 text-xs leading-5 text-[var(--v7-text-muted)]"><strong className="text-[var(--v7-text-secondary)]">Sources and provenance</strong><br />Fetched {new Date(snapshot.fetchedAt).toLocaleString()}<br />{snapshot.sources.join(' · ') || 'No source labels returned.'}<br />Reporting period: {snapshot.fundamentals.reportingPeriod ?? 'Unavailable'}</div></aside>
                </div>
            </> : null}
        </section>
    );
};
