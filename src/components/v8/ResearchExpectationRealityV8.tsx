'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    compareResearchExpectationEvent,
    createResearchExpectationDraft,
    parseResearchExpectationEvent,
    type ResearchExpectationEvent,
} from '@/lib/research/research-expectation';

type Props = { readonly ticker: string };

const numberValue = (value: number | null) => value === null ? '' : String(value);
const outcomeLabel = (value: string) => value === 'in-line' ? 'IN LINE' : value.toUpperCase();

export const ResearchExpectationRealityV8 = ({ ticker }: Props) => {
    const [events, setEvents] = useState<ResearchExpectationEvent[]>([]);
    const [draft, setDraft] = useState<ResearchExpectationEvent>(() => createResearchExpectationDraft(ticker));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setMessage(null);
        try {
            const response = await fetch(`/api/research/expectations/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
            const payload: unknown = await response.json();
            if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Expectation history is unavailable.');
            const data = (payload as Record<string, unknown>).data;
            if (!Array.isArray(data)) throw new Error('Expectation history is unavailable.');
            const parsed = data.map(parseResearchExpectationEvent);
            setEvents(parsed);
            setDraft(parsed[0] ?? createResearchExpectationDraft(ticker));
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Expectation history is unavailable.');
        } finally {
            setLoading(false);
        }
    }, [ticker]);

    useEffect(() => { void load(); }, [load]);

    const comparison = useMemo(() => compareResearchExpectationEvent(draft), [draft]);

    const updateMetric = (id: string, key: 'expected' | 'actual', value: string) => {
        setDraft((current) => ({
            ...current,
            metrics: current.metrics.map((metric) => metric.id === id
                ? { ...metric, [key]: value.trim() === '' ? null : Number(value) }
                : metric),
            updatedAt: new Date().toISOString(),
        }));
    };

    const save = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const now = new Date().toISOString();
            const normalized = parseResearchExpectationEvent({ ...draft, ticker, updatedAt: now });
            const response = await fetch(`/api/research/expectations/${encodeURIComponent(ticker)}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(normalized),
            });
            const payload: unknown = await response.json();
            if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Could not save expectation review.');
            const saved = parseResearchExpectationEvent((payload as Record<string, unknown>).data);
            setEvents((current) => [saved, ...current.filter((event) => event.id !== saved.id)].sort((a, b) => b.eventDate.localeCompare(a.eventDate)));
            setDraft(saved);
            setMessage('Expectation review saved.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not save expectation review.');
        } finally {
            setSaving(false);
        }
    };

    const startNew = () => {
        const next = createResearchExpectationDraft(ticker);
        setDraft({ ...next, id: `${next.id}-${Date.now()}` });
        setMessage(null);
    };

    if (loading) return <section data-testid="expectation-reality" className="mt-3 rounded-lg border border-zinc-700/40 p-3 text-xs text-zinc-500">Loading expectation history…</section>;

    return (
        <section data-testid="expectation-reality" className="mt-3 rounded-lg border border-zinc-700/40 p-3" aria-label={`Expectation versus reality for ${ticker}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-500">Expectation vs reality</p>
                    <h3 className="mt-1 text-sm font-semibold">Was the result different from what mattered?</h3>
                    <p className="mt-1 max-w-2xl text-xs text-zinc-500">Capture expectations before the event. Add actuals and the stock reaction afterward. Signal evaluates the gap without treating the outcome as proof that the original decision was good or bad.</p>
                </div>
                <button type="button" onClick={startNew} className="min-h-10 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold hover:border-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-500">New event</button>
            </div>

            {events.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Saved expectation events">
                    {events.slice(0, 6).map((event) => (
                        <button key={event.id} type="button" onClick={() => setDraft(event)} aria-pressed={draft.id === event.id} className={`min-h-10 shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${draft.id === event.id ? 'border-emerald-500' : 'border-zinc-700/50'}`}>
                            <strong className="block">{event.title}</strong><span className="text-zinc-500">{event.eventDate}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-xs"><span className="font-semibold">Event title</span><input aria-label="Event title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value, updatedAt: new Date().toISOString() }))} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3" /></label>
                <label className="grid gap-1 text-xs"><span className="font-semibold">Event date</span><input aria-label="Event date" type="date" value={draft.eventDate} onChange={(event) => setDraft((current) => ({ ...current, eventDate: event.target.value, updatedAt: new Date().toISOString() }))} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3" /></label>
                <label className="grid gap-1 text-xs"><span className="font-semibold">Stage</span><select aria-label="Event stage" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ResearchExpectationEvent['status'], updatedAt: new Date().toISOString() }))} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3"><option value="pre-event">Pre-event</option><option value="reported">Reported</option><option value="reviewed">Reviewed</option></select></label>
            </div>

            <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="text-zinc-500"><tr><th className="pb-2 pr-3">Metric</th><th className="pb-2 pr-3">Expected</th><th className="pb-2 pr-3">Actual</th><th className="pb-2">Outcome</th></tr></thead>
                    <tbody>{comparison.metrics.map((metric) => (
                        <tr key={metric.id} className="border-t border-zinc-700/30">
                            <th className="py-2 pr-3 font-semibold">{metric.label}{metric.unit ? ` (${metric.unit})` : ''}</th>
                            <td className="py-2 pr-3"><input aria-label={`${metric.label} expected`} inputMode="decimal" value={numberValue(metric.expected)} onChange={(event) => updateMetric(metric.id, 'expected', event.target.value)} className="min-h-9 w-28 rounded-md border border-zinc-700/50 bg-transparent px-2" /></td>
                            <td className="py-2 pr-3"><input aria-label={`${metric.label} actual`} inputMode="decimal" value={numberValue(metric.actual)} onChange={(event) => updateMetric(metric.id, 'actual', event.target.value)} className="min-h-9 w-28 rounded-md border border-zinc-700/50 bg-transparent px-2" /></td>
                            <td className="py-2"><strong>{outcomeLabel(metric.outcome)}</strong>{metric.variancePercent !== null && <span className="ml-2 text-zinc-500">{metric.variancePercent >= 0 ? '+' : ''}{metric.variancePercent.toFixed(1)}%</span>}</td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs"><span className="font-semibold">What was expected?</span><textarea aria-label="Expected narrative" rows={3} value={draft.expectedNarrative} onChange={(event) => setDraft((current) => ({ ...current, expectedNarrative: event.target.value, updatedAt: new Date().toISOString() }))} className="rounded-lg border border-zinc-700/50 bg-transparent p-3" placeholder="What did investors appear to require? Which metric mattered most?" /></label>
                <label className="grid gap-1 text-xs"><span className="font-semibold">What actually happened?</span><textarea aria-label="Actual narrative" rows={3} value={draft.actualNarrative} onChange={(event) => setDraft((current) => ({ ...current, actualNarrative: event.target.value, updatedAt: new Date().toISOString() }))} className="rounded-lg border border-zinc-700/50 bg-transparent p-3" placeholder="Record the result before explaining it with hindsight." /></label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <label className="grid gap-1 text-xs"><span className="font-semibold">Stock reaction %</span><input aria-label="Stock reaction percent" inputMode="decimal" value={numberValue(draft.reactionPercent)} onChange={(event) => setDraft((current) => ({ ...current, reactionPercent: event.target.value.trim() === '' ? null : Number(event.target.value), updatedAt: new Date().toISOString() }))} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3" /></label>
                <label className="grid gap-1 text-xs"><span className="font-semibold">Interpretation</span><input aria-label="Expectation interpretation" value={draft.interpretation} onChange={(event) => setDraft((current) => ({ ...current, interpretation: event.target.value, updatedAt: new Date().toISOString() }))} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3" placeholder="Why might the reaction differ from the headline result?" /></label>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-700/30 p-3">
                <div className="text-xs"><strong>Primary result: {outcomeLabel(comparison.primaryOutcome)}</strong><span className="ml-2 text-zinc-500">{comparison.beatCount} beat · {comparison.missCount} miss · {comparison.inlineCount} in line</span>{comparison.reactionDivergence === 'positive-results-negative-reaction' && <p className="mt-1 text-zinc-500">Headline results were positive, but the stock reaction was negative. Review expectations, guidance and the metric investors cared about most.</p>}{comparison.reactionDivergence === 'negative-results-positive-reaction' && <p className="mt-1 text-zinc-500">Headline results were negative, but the stock reaction was positive. The market may have expected worse or focused on forward guidance.</p>}</div>
                <button type="button" onClick={() => void save()} disabled={saving} className="min-h-10 rounded-lg border border-emerald-600 px-4 py-2 text-xs font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-500">{saving ? 'Saving…' : 'Save review'}</button>
            </div>
            {message && <p role="status" className="mt-2 text-xs text-zinc-500">{message}</p>}
        </section>
    );
};
