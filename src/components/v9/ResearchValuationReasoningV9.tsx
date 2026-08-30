'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import {
    createResearchValuationPlan,
    evaluateResearchValuationPlan,
    parseResearchValuationPlan,
    type ResearchValuationPlan,
} from '@/lib/research/research-valuation-plan';

type Props = {
    readonly ticker: string;
    readonly snapshot: ResearchSnapshot | null;
};

const inputNumber = (value: number | null) => value === null ? '' : String(value);
const money = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export const ResearchValuationReasoningV9 = ({ ticker, snapshot }: Props) => {
    const [plan, setPlan] = useState<ResearchValuationPlan>(() => createResearchValuationPlan(ticker));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setMessage(null);
        try {
            const planResponse = await fetch(`/api/research/valuation-plan/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
            const planPayload: unknown = await planResponse.json();
            if (!planResponse.ok || typeof planPayload !== 'object' || planPayload === null || Array.isArray(planPayload)) throw new Error('Valuation assumptions are unavailable.');
            setPlan(parseResearchValuationPlan((planPayload as Record<string, unknown>).data));
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Valuation assumptions are unavailable.');
        } finally {
            setLoading(false);
        }
    }, [ticker]);

    useEffect(() => { void load(); }, [load]);

    const marketPrice = snapshot?.symbol === ticker ? snapshot.quote.price ?? null : null;

    const evaluation = useMemo(() => {
        try {
            return { result: evaluateResearchValuationPlan(plan, marketPrice), error: null as string | null };
        } catch (error) {
            return { result: null, error: error instanceof Error ? error.message : 'Check the valuation assumptions.' };
        }
    }, [plan, marketPrice]);
    const result = evaluation.result;

    const updateShared = (key: 'currentEps' | 'years' | 'annualDiscountRatePct', value: string) => {
        if (value.trim() === '') {
            if (key === 'currentEps') setPlan((current) => ({ ...current, currentEps: null, updatedAt: new Date().toISOString() }));
            return;
        }
        setPlan((current) => ({ ...current, [key]: Number(value), updatedAt: new Date().toISOString() }));
    };

    const updateScenario = (id: string, key: 'epsCagrPct' | 'terminalPe', value: string) => {
        if (value.trim() === '') return;
        setPlan((current) => ({
            ...current,
            scenarios: current.scenarios.map((scenario) => scenario.id === id ? { ...scenario, [key]: Number(value) } : scenario),
            updatedAt: new Date().toISOString(),
        }));
    };

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const normalized = parseResearchValuationPlan({ ...plan, ticker, updatedAt: new Date().toISOString() });
            const response = await fetch(`/api/research/valuation-plan/${encodeURIComponent(ticker)}`, {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(normalized),
            });
            const payload: unknown = await response.json();
            if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Could not save valuation assumptions.');
            setPlan(parseResearchValuationPlan((payload as Record<string, unknown>).data));
            setMessage('Valuation assumptions saved.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save valuation assumptions.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <section data-testid="valuation-reasoning-v9" className="mt-3 rounded-lg border border-zinc-700/40 p-3 text-xs text-zinc-500">Loading valuation reasoning…</section>;

    return (
        <section data-testid="valuation-reasoning-v9" className="mt-3 rounded-lg border border-zinc-700/40 p-3" aria-label={`Valuation reasoning for ${ticker}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-500">Valuation reasoning</p>
                    <h3 className="mt-1 text-sm font-semibold">What assumptions make today&apos;s price reasonable?</h3>
                    <p className="mt-1 max-w-2xl text-xs text-zinc-500">This is an assumption model, not a fair-value oracle. Current EPS is explicit because Signal does not infer forward earnings from trailing P/E.</p>
                </div>
                <div className="text-right text-xs"><span className="block text-zinc-500">Market price</span><strong>{marketPrice ? money(marketPrice) : 'Unavailable'}</strong></div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1 text-xs"><span className="font-semibold">Current EPS</span><input aria-label="Current EPS" inputMode="decimal" value={inputNumber(plan.currentEps)} onChange={(event) => updateShared('currentEps', event.target.value)} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3" placeholder="Enter evidence-backed EPS" /></label>
                <label className="grid gap-1 text-xs"><span className="font-semibold">Forecast years</span><input aria-label="Forecast years" type="number" min="1" max="10" value={plan.years} onChange={(event) => updateShared('years', event.target.value)} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3" /></label>
                <label className="grid gap-1 text-xs"><span className="font-semibold">Discount rate %</span><input aria-label="Discount rate percent" inputMode="decimal" value={plan.annualDiscountRatePct} onChange={(event) => updateShared('annualDiscountRatePct', event.target.value)} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3" /></label>
            </div>

            {evaluation.error && <p role="alert" className="mt-2 text-xs text-zinc-500">{evaluation.error} Adjust the assumptions before saving.</p>}

            {plan.currentEps === null ? (
                <div className="mt-3 rounded-lg border border-zinc-700/30 p-3 text-xs text-zinc-500">Enter a current EPS supported by your source before scenario values are calculated. This prevents trailing P/E from being silently re-labeled as forward earnings evidence.</div>
            ) : result ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {plan.scenarios.map((scenario) => {
                        const evaluated = result.scenarioResults.find((item) => item.id === scenario.id);
                        return (
                            <article key={scenario.id} className="rounded-lg border border-zinc-700/40 p-3">
                                <div className="flex items-center justify-between gap-2"><strong className="text-sm">{scenario.label}</strong><span className="text-xs text-zinc-500">{evaluated ? money(evaluated.presentValue) : '—'}</span></div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <label className="grid gap-1 text-xs"><span>EPS CAGR %</span><input aria-label={`${scenario.label} EPS CAGR percent`} inputMode="decimal" value={scenario.epsCagrPct} onChange={(event) => updateScenario(scenario.id, 'epsCagrPct', event.target.value)} className="min-h-10 min-w-0 rounded-md border border-zinc-700/50 bg-transparent px-2" /></label>
                                    <label className="grid gap-1 text-xs"><span>Terminal P/E</span><input aria-label={`${scenario.label} terminal PE`} inputMode="decimal" value={scenario.terminalPe} onChange={(event) => updateScenario(scenario.id, 'terminalPe', event.target.value)} className="min-h-10 min-w-0 rounded-md border border-zinc-700/50 bg-transparent px-2" /></label>
                                </div>
                                {evaluated && <p className="mt-3 text-xs text-zinc-500">Terminal EPS {evaluated.terminalEps.toFixed(2)}{evaluated.gapPct !== null ? ` · scenario value ${evaluated.gapPct >= 0 ? '+' : ''}${evaluated.gapPct.toFixed(1)}% vs market` : ''}</p>}
                            </article>
                        );
                    })}
                </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-700/30 p-3">
                <div className="text-xs">
                    <strong>{!result || result.impliedEpsCagrPct === null ? 'Implied growth unavailable' : `Market-implied EPS CAGR: ${result.impliedEpsCagrPct.toFixed(1)}%`}</strong>
                    <p className="mt-1 text-zinc-500">Uses the Base terminal P/E, your forecast horizon and discount rate. Change those assumptions to see how sensitive the implied expectation is.</p>
                </div>
                <button type="button" onClick={() => void save()} disabled={saving || Boolean(evaluation.error)} className="min-h-10 rounded-lg border border-emerald-600 px-4 py-2 text-xs font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-500">{saving ? 'Saving…' : 'Save assumptions'}</button>
            </div>
            {message && <p role="status" className="mt-2 text-xs text-zinc-500">{message}</p>}
        </section>
    );
};
