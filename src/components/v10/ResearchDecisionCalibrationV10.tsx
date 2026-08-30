'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    calibrationRatings,
    createResearchDecisionCalibration,
    parseResearchDecisionCalibration,
    summarizeResearchDecisionCalibration,
    type CalibrationRating,
    type CalibrationVerdict,
    type ResearchDecisionCalibration,
} from '@/lib/research/research-decision-calibration';
import type { ResearchRecord, ResearchReviewSnapshot } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';

type Props = {
    readonly ticker: string;
    readonly record: ResearchRecord | null;
    readonly snapshot: ResearchSnapshot | null;
};
const ratingLabels: Record<CalibrationRating, string> = { strong: 'Strong', mixed: 'Mixed', weak: 'Weak', 'not-applicable': 'N/A' };
const price = (value: number | null) => value === null ? 'Unavailable' : new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

export const ResearchDecisionCalibrationV10 = ({ ticker, record, snapshot }: Props) => {
    const [reviews, setReviews] = useState<ResearchDecisionCalibration[]>([]);
    const [selectedReview, setSelectedReview] = useState<ResearchReviewSnapshot | null>(null);
    const [draft, setDraft] = useState<ResearchDecisionCalibration | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const laterPrice = snapshot?.symbol === ticker ? snapshot.quote.price ?? null : null;

    const load = useCallback(async () => {
        setLoading(true); setMessage(null);
        if (!record || record.symbol !== ticker) {
            setReviews([]); setSelectedReview(null); setDraft(null);
            setMessage('Save this security to Research before reviewing decisions.');
            setLoading(false);
            return;
        }
        try {
            const calibrationResponse = await fetch(`/api/research/calibration/${encodeURIComponent(ticker)}`, { cache: 'no-store' });
            const calibrationPayload: unknown = await calibrationResponse.json();
            const parsedCalibrations = calibrationResponse.ok && typeof calibrationPayload === 'object' && calibrationPayload !== null && !Array.isArray(calibrationPayload) && Array.isArray((calibrationPayload as Record<string, unknown>).data)
                ? ((calibrationPayload as Record<string, unknown>).data as unknown[]).map(parseResearchDecisionCalibration)
                : [];
            const latestReview = record.reviewHistory.at(-1) ?? null;
            setReviews(parsedCalibrations); setSelectedReview(latestReview);
            if (latestReview) {
                const existing = parsedCalibrations.find((entry) => entry.reviewId === latestReview.id);
                setDraft(existing ?? createResearchDecisionCalibration({ ticker, reviewId: latestReview.id, reviewedAt: latestReview.reviewedAt, originalDecision: latestReview.decisionJournal.decision, originalObservedPrice: latestReview.decisionJournal.observedPrice }));
            } else setDraft(null);
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Decision review is unavailable.'); }
        finally { setLoading(false); }
    }, [record, ticker]);
    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        if (laterPrice === null) return;
        setDraft((current) => current && !reviews.some((entry) => entry.id === current.id)
            ? { ...current, laterPrice }
            : current);
    }, [laterPrice, reviews]);

    const selectHistoricalReview = (review: ResearchReviewSnapshot) => {
        setSelectedReview(review);
        const existing = reviews.find((entry) => entry.reviewId === review.id);
        setDraft(existing ?? { ...createResearchDecisionCalibration({ ticker, reviewId: review.id, reviewedAt: review.reviewedAt, originalDecision: review.decisionJournal.decision, originalObservedPrice: review.decisionJournal.observedPrice }), laterPrice });
        setMessage(null);
    };

    const summary = useMemo(() => draft ? summarizeResearchDecisionCalibration(draft) : null, [draft]);
    const subsequentReturn = draft?.originalObservedPrice && draft.laterPrice
        ? ((draft.laterPrice - draft.originalObservedPrice) / draft.originalObservedPrice) * 100 : null;
    const setRating = (key: 'thesisQuality' | 'evidenceQuality' | 'valuationDiscipline' | 'triggerDiscipline', value: CalibrationRating) => setDraft((current) => current ? ({ ...current, [key]: value, updatedAt: new Date().toISOString() }) : current);

    const save = async () => {
        if (!draft) return;
        setSaving(true); setMessage(null);
        try {
            const normalized = parseResearchDecisionCalibration({ ...draft, updatedAt: new Date().toISOString() });
            const response = await fetch(`/api/research/calibration/${encodeURIComponent(ticker)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(normalized) });
            const payload: unknown = await response.json();
            if (!response.ok || typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Could not save process review.');
            const saved = parseResearchDecisionCalibration((payload as Record<string, unknown>).data);
            setDraft(saved); setReviews((current) => [saved, ...current.filter((item) => item.id !== saved.id)]); setMessage('Process review saved.');
        } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save process review.'); }
        finally { setSaving(false); }
    };

    if (loading) return <section data-testid="decision-calibration-v10" className="mt-3 rounded-lg border border-zinc-700/40 p-3 text-xs text-zinc-500">Loading decision review…</section>;
    if (!record || record.reviewHistory.length === 0 || !selectedReview || !draft) return <section data-testid="decision-calibration-v10" className="mt-3 rounded-lg border border-zinc-700/40 p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-500">Decision review</p><p className="mt-1 text-xs text-zinc-500">{message ?? 'Complete and save at least one Research review before calibrating your decision process.'}</p></section>;

    return (
        <section data-testid="decision-calibration-v10" className="mt-3 rounded-lg border border-zinc-700/40 p-3" aria-label={`Decision process review for ${ticker}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-500">Decision review</p><h3 className="mt-1 text-sm font-semibold">Was the process reasonable with what was knowable then?</h3><p className="mt-1 max-w-2xl text-xs text-zinc-500">Review the process, not just the return. A stock rising after a WAIT decision does not automatically make the decision poor; unexpected information and the quality of the original evidence matter.</p></div>
                <select aria-label="Historical review" value={selectedReview.id} onChange={(event) => { const review = record.reviewHistory.find((item) => item.id === event.target.value); if (review) selectHistoricalReview(review); }} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3 text-xs">
                    {[...record.reviewHistory].reverse().map((review) => <option key={review.id} value={review.id}>{new Date(review.reviewedAt).toLocaleDateString()} · {review.decisionJournal.decision}</option>)}
                </select>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-zinc-700/30 p-3 text-xs"><span className="text-zinc-500">Original decision</span><strong className="mt-1 block">{draft.originalDecision}</strong></div>
                <div className="rounded-lg border border-zinc-700/30 p-3 text-xs"><span className="text-zinc-500">Observed then</span><strong className="mt-1 block">{price(draft.originalObservedPrice)}</strong></div>
                <div className="rounded-lg border border-zinc-700/30 p-3 text-xs"><span className="text-zinc-500">Later price · context only</span><strong className="mt-1 block">{price(draft.laterPrice)}{subsequentReturn !== null ? ` · ${subsequentReturn >= 0 ? '+' : ''}${subsequentReturn.toFixed(1)}%` : ''}</strong></div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {([['thesisQuality','Thesis quality'],['evidenceQuality','Evidence quality'],['valuationDiscipline','Valuation discipline'],['triggerDiscipline','Trigger discipline']] as const).map(([key,label]) => (
                    <label key={key} className="grid gap-1 text-xs"><span className="font-semibold">{label}</span><select aria-label={label} value={draft[key]} onChange={(event) => setRating(key, event.target.value as CalibrationRating)} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3">{calibrationRatings.map((rating) => <option key={rating} value={rating}>{ratingLabels[rating]}</option>)}</select></label>
                ))}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs"><span className="font-semibold">Unexpected information after the decision</span><textarea aria-label="Unexpected information" rows={3} value={draft.unexpectedInformation} onChange={(event) => setDraft((current) => current ? ({ ...current, unexpectedInformation: event.target.value, updatedAt: new Date().toISOString() }) : current)} className="rounded-lg border border-zinc-700/50 bg-transparent p-3" placeholder="What happened later that could not reasonably have been known?" /></label>
                <label className="grid gap-1 text-xs"><span className="font-semibold">Process note</span><textarea aria-label="Process note" rows={3} value={draft.note} onChange={(event) => setDraft((current) => current ? ({ ...current, note: event.target.value, updatedAt: new Date().toISOString() }) : current)} className="rounded-lg border border-zinc-700/50 bg-transparent p-3" placeholder="What would you keep or change next time?" /></label>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex min-h-10 items-center gap-2"><input aria-label="Hindsight risk" type="checkbox" checked={draft.hindsightRisk} onChange={(event) => setDraft((current) => current ? ({ ...current, hindsightRisk: event.target.checked, updatedAt: new Date().toISOString() }) : current)} />I may be judging this with hindsight</label>
                <label className="flex items-center gap-2"><span className="font-semibold">With the same information:</span><select aria-label="Process verdict" value={draft.processVerdict} onChange={(event) => setDraft((current) => current ? ({ ...current, processVerdict: event.target.value as CalibrationVerdict, updatedAt: new Date().toISOString() }) : current)} className="min-h-10 rounded-lg border border-zinc-700/50 bg-transparent px-3"><option value="repeat">Repeat the process</option><option value="adjust">Adjust the process</option><option value="insufficient-evidence">Insufficient evidence to judge</option></select></label>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-700/30 p-3 text-xs"><div><strong>{summary?.strong ?? 0} strong · {summary?.weak ?? 0} weak process dimensions</strong><p className="mt-1 text-zinc-500">This is descriptive evidence, not an investor score and not a prediction of future returns.</p></div><button type="button" onClick={() => void save()} disabled={saving} className="min-h-10 rounded-lg border border-emerald-600 px-4 py-2 font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-500">{saving ? 'Saving…' : 'Save process review'}</button></div>
            {message && <p role="status" className="mt-2 text-xs text-zinc-500">{message}</p>}
        </section>
    );
};
