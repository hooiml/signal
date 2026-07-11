'use client';

import { useState } from 'react';
import type { ResearchRecord } from '@/lib/types/research';
import { checklistLabelsV6, getThemeV6, type ResearchThemeV6 } from './research-v6';

const checklistKeys = [
    'understandBusiness', 'revenueGrowingOrStable', 'marginsHealthyOrImproving',
    'debtManageable', 'freeCashFlowPositiveOrImproving', 'valuationReasonable',
    'catalystOrCompoundingReason', 'downsideAcceptable', 'betterThanCashOrIndex',
] as const satisfies readonly (keyof ResearchRecord['checklist'])[];

type ResearchEditorV6Props = {
    readonly initial: ResearchRecord;
    readonly theme: ResearchThemeV6;
    readonly saving: boolean;
    readonly error: string | null;
    readonly onSave: (record: ResearchRecord) => Promise<void>;
};

export const ResearchEditorV6 = ({ initial, theme, saving, error, onSave }: ResearchEditorV6Props) => {
    const [draft, setDraft] = useState(initial);
    const styles = getThemeV6(theme);
    const field = 'w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-emerald-500 ' + (theme === 'light' ? 'border-slate-300 bg-white text-slate-950' : 'border-[#334354] bg-[#0b1118] text-[#eef2f7]');
    const updateText = (key: 'whyInterested' | 'bullCase' | 'thesisBreak' | 'targetBuyZone' | 'notes', value: string) => setDraft((current) => ({ ...current, [key]: value }));

    return (
        <section className={'rounded-lg border p-4 ' + styles.panel}>
            <div className="flex items-center justify-between gap-3">
                <h2 className={'text-sm font-semibold ' + styles.textSecondary}>Research journal</h2>
                <span className={'text-[11px] ' + styles.textMuted}>Saved reviews update the decision automatically</span>
            </div>
            <div className="mt-4 grid gap-3 min-[900px]:grid-cols-2">
                <label className={'text-xs font-medium ' + styles.textMuted}>Why interested
                    <textarea value={draft.whyInterested} onChange={(event) => updateText('whyInterested', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Bull case
                    <textarea value={draft.bullCase} onChange={(event) => updateText('bullCase', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Thesis invalidation
                    <textarea value={draft.thesisBreak} onChange={(event) => updateText('thesisBreak', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Review notes
                    <textarea value={draft.notes} onChange={(event) => updateText('notes', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className={'text-xs font-medium ' + styles.textMuted}>Thesis strength
                    <select value={draft.thesisStrength} onChange={(event) => setDraft((current) => ({ ...current, thesisStrength: event.target.value === 'high' ? 'high' : event.target.value === 'low' ? 'low' : 'medium' }))} className={'mt-1 ' + field}>
                        <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                    </select>
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Valuation
                    <select value={draft.valuationState} onChange={(event) => setDraft((current) => ({ ...current, valuationState: event.target.value === 'cheap' ? 'cheap' : event.target.value === 'fair' ? 'fair' : event.target.value === 'expensive' ? 'expensive' : 'unknown' }))} className={'mt-1 ' + field}>
                        <option value="unknown">Unknown</option><option value="cheap">Cheap</option><option value="fair">Fair</option><option value="expensive">Expensive</option>
                    </select>
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Target buy zone
                    <input value={draft.targetBuyZone} onChange={(event) => updateText('targetBuyZone', event.target.value)} className={'mt-1 ' + field} />
                </label>
                <div className="flex flex-col justify-end gap-2 pb-1">
                    <label className={'flex items-center gap-2 text-xs font-medium ' + styles.textSecondary}><input type="checkbox" checked={draft.positionState === 'owned'} onChange={(event) => setDraft((current) => ({ ...current, positionState: event.target.checked ? 'owned' : 'not-owned' }))} />Owned</label>
                    <label className={'flex items-center gap-2 text-xs font-medium ' + styles.textSecondary}><input type="checkbox" checked={draft.inBuyZone} onChange={(event) => setDraft((current) => ({ ...current, inBuyZone: event.target.checked }))} />Price is in buy zone</label>
                </div>
            </div>
            <fieldset className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <legend className={'mb-2 text-xs font-semibold ' + styles.textMuted}>Investment checklist</legend>
                {checklistKeys.map((key) => (
                    <label key={key} className={'flex items-start gap-2 text-xs leading-5 ' + styles.textSecondary}>
                        <input type="checkbox" checked={draft.checklist[key]} onChange={(event) => setDraft((current) => ({ ...current, checklist: { ...current.checklist, [key]: event.target.checked } }))} className="mt-1" />
                        {checklistLabelsV6[key]}
                    </label>
                ))}
            </fieldset>
            <div className="mt-4 flex items-center justify-end gap-3">
                {error ? <p className={'mr-auto text-xs ' + styles.risk}>{error}</p> : null}
                <button type="button" disabled={saving} onClick={() => void onSave(draft)} className="rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save review'}
                </button>
            </div>
        </section>
    );
};
