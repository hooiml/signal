'use client';

import { useState, type ComponentProps } from 'react';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchFindingTarget } from '@/lib/types/research-assistant';
import { ResearchAssistantV6 } from './ResearchAssistantV6';
import { checklistLabelsV6, getThemeV6, type ResearchThemeV6 } from './research-v6';

const checklistKeys = [
    'understandBusiness', 'revenueGrowingOrStable', 'marginsHealthyOrImproving',
    'debtManageable', 'freeCashFlowPositiveOrImproving', 'valuationReasonable',
    'catalystOrCompoundingReason', 'downsideAcceptable', 'betterThanCashOrIndex',
] as const satisfies readonly (keyof ResearchRecord['checklist'])[];

const targetLabels: Record<ResearchFindingTarget, string> = {
    whyInterested: 'Why interested', bullCase: 'Bull case', bearCase: 'Bear case',
    thesisBreak: 'Thesis invalidation', buyTrigger: 'Buy trigger', sellTrigger: 'Sell trigger', notes: 'Review notes',
};

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
    const updateText = (key: 'whyInterested' | 'bullCase' | 'bearCase' | 'buyTrigger' | 'sellTrigger' | 'thesisBreak' | 'targetBuyZone' | 'notes', value: string) => setDraft((current) => ({ ...current, [key]: value }));
    const applyFinding: ComponentProps<typeof ResearchAssistantV6>['onApply'] = ({ finding, sources, mode }) => setDraft((current) => {
        const id = `${current.symbol}:${finding.target}:${finding.id}`;
        const alreadyAccepted = current.acceptedEvidence.some((item) => item.id === id);
        const existing = current[finding.target].trim();
        const acceptedEvidence = {
            id,
            title: finding.title,
            summary: finding.summary,
            target: finding.target,
            tone: finding.tone,
            mode,
            acceptedAt: new Date().toISOString(),
            sources,
        };
        return {
            ...current,
            [finding.target]: alreadyAccepted ? current[finding.target] : existing ? `${existing}\n\n${finding.summary}` : finding.summary,
            acceptedEvidence: [...current.acceptedEvidence.filter((item) => item.id !== id), acceptedEvidence].slice(-50),
        };
    });

    return (
        <section className={'rounded-lg border p-4 ' + styles.panel}>
            <div className="flex items-center justify-between gap-3">
                <h2 className={'text-sm font-semibold ' + styles.textSecondary}>Research journal</h2>
                <span className={'text-[11px] ' + styles.textMuted}>Saved reviews update the decision automatically</span>
            </div>
            <div className="mt-4">
                <ResearchAssistantV6 symbol={draft.symbol} market={draft.market} theme={theme} onApply={applyFinding} />
            </div>
            {draft.acceptedEvidence.length > 0 ? (
                <section className={'mt-4 border-b pb-4 ' + styles.divider} aria-labelledby="accepted-evidence-title">
                    <div className="flex items-center justify-between gap-3">
                        <h3 id="accepted-evidence-title" className={'text-sm font-semibold ' + styles.textSecondary}>Accepted evidence</h3>
                        <span className={'text-[11px] ' + styles.textMuted}>{draft.acceptedEvidence.length} retained finding{draft.acceptedEvidence.length === 1 ? '' : 's'}</span>
                    </div>
                    <ul className={'mt-2 divide-y ' + styles.divider}>
                        {draft.acceptedEvidence.map((item) => (
                            <li key={item.id} className="py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className={'text-xs font-bold ' + styles.textPrimary}>{item.title} <span className={'font-medium ' + styles.textMuted}>· {targetLabels[item.target]}</span></p>
                                        <p className={'mt-1 text-xs leading-5 ' + styles.textSecondary}>{item.summary}</p>
                                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                            {item.sources.map((source) => (
                                                <a key={source.id + source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer" className={'text-[11px] underline decoration-dotted underline-offset-2 ' + styles.textMuted}>
                                                    {source.label}: {source.value} · {source.source}{source.reportingPeriod ? ` · ${source.reportingPeriod}` : ''}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                    <button type="button" onClick={() => setDraft((current) => ({ ...current, acceptedEvidence: current.acceptedEvidence.filter((candidate) => candidate.id !== item.id) }))} className={'min-h-10 shrink-0 px-2 text-xs font-semibold ' + styles.risk} aria-label={`Remove evidence ${item.title}`}>Remove</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
            <div className="mt-4 grid gap-3 min-[900px]:grid-cols-2">
                <label className={'text-xs font-medium ' + styles.textMuted}>Why interested
                    <textarea value={draft.whyInterested} onChange={(event) => updateText('whyInterested', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Bull case
                    <textarea value={draft.bullCase} onChange={(event) => updateText('bullCase', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Bear case
                    <textarea value={draft.bearCase} onChange={(event) => updateText('bearCase', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Thesis invalidation
                    <textarea value={draft.thesisBreak} onChange={(event) => updateText('thesisBreak', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Buy trigger
                    <textarea value={draft.buyTrigger} onChange={(event) => updateText('buyTrigger', event.target.value)} rows={3} className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Sell trigger
                    <textarea value={draft.sellTrigger} onChange={(event) => updateText('sellTrigger', event.target.value)} rows={3} className={'mt-1 ' + field} />
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
