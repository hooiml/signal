'use client';

import { useMemo, useState, type ComponentProps } from 'react';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchBenchmark } from '@/lib/types/research-snapshot';
import { calculatePositionPlanRisk } from '@/lib/research/position-plan';
import type { ResearchFindingTarget } from '@/lib/types/research-assistant';
import { ResearchAssistantV6 } from './ResearchAssistantV6';
import { checklistLabelsV6, getThemeV6, type ResearchActionV6, type ResearchThemeV6 } from './research-v6';

const checklistKeys = [
    'understandBusiness', 'revenueGrowingOrStable', 'marginsHealthyOrImproving',
    'debtManageable', 'freeCashFlowPositiveOrImproving', 'valuationReasonable',
    'catalystOrCompoundingReason', 'downsideAcceptable', 'betterThanCashOrIndex',
] as const satisfies readonly (keyof ResearchRecord['checklist'])[];

const targetLabels: Record<ResearchFindingTarget, string> = {
    whyInterested: 'Why interested', bullCase: 'Bull case', bearCase: 'Bear case',
    thesisBreak: 'Thesis invalidation', buyTrigger: 'Buy trigger', sellTrigger: 'Sell trigger', notes: 'Review notes',
};

const detailText = (value: string) => value.trim() || 'Not recorded';

const detailChoice = (value: string) => value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

type ResearchEditorV6Props = {
    readonly initial: ResearchRecord;
    readonly theme: ResearchThemeV6;
    readonly saving: boolean;
    readonly error: string | null;
    readonly onSave: (record: ResearchRecord) => Promise<boolean>;
    readonly decision: ResearchActionV6;
    readonly observedPrice: number | null;
    readonly benchmark: ResearchBenchmark | null;
    readonly startEditing?: boolean;
};

const prepareReviewDraft = (initial: ResearchRecord, decision: ResearchActionV6, observedPrice: number | null, benchmark: ResearchBenchmark | null): ResearchRecord => ({
    ...initial,
    decisionJournal: {
        ...initial.decisionJournal,
        decision,
        observedPrice,
        benchmarkLabel: benchmark?.baselineReturnPercent !== null && benchmark?.baselineReturnPercent !== undefined ? benchmark.baselineName : null,
        benchmarkReturnPercent: benchmark?.baselineReturnPercent ?? null,
        priorReviewId: initial.reviewHistory[0]?.id ?? null,
        priorOutcome: 'unresolved',
        outcomeNote: '',
    },
});

export const ResearchEditorV6 = ({ initial, theme, saving, error, onSave, decision, observedPrice, benchmark, startEditing = false }: ResearchEditorV6Props) => {
    const [draft, setDraft] = useState(() => startEditing ? prepareReviewDraft(initial, decision, observedPrice, benchmark) : initial);
    const [isEditing, setIsEditing] = useState(startEditing);
    const [isExpanded, setIsExpanded] = useState(startEditing);
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
    const styles = getThemeV6(theme);
    const isDirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial), [draft, initial]);
    const completedChecklist = checklistKeys.filter((key) => draft.checklist[key]).length;
    const positionRisk = calculatePositionPlanRisk(draft.positionPlan, observedPrice);
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
    const handleSave = async () => {
        const saved = await onSave(draft);
        if (saved) {
            setLastSavedAt(new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()));
            setIsEditing(false);
            setIsExpanded(false);
        }
    };
    const handleCancel = () => {
        setDraft(initial);
        setLastSavedAt(null);
        setIsEditing(false);
        setIsExpanded(false);
    };
    const beginReview = () => {
        setDraft(prepareReviewDraft(initial, decision, observedPrice, benchmark));
        setIsEditing(true);
        setIsExpanded(true);
    };
    const renderDetail = (label: string, value: string, className = '') => (
        <div className={className}>
            <dt className={'text-xs font-medium ' + styles.textMuted}>{label}</dt>
            <dd className={'mt-1 whitespace-pre-wrap text-sm leading-5 ' + styles.textPrimary}>{value}</dd>
        </div>
    );

    return (
        <section data-testid="research-decision-journal" data-surface-tier="secondary" className={'rounded-lg border p-4 ' + styles.panelSecondary}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    {isEditing ? (
                        <h2 className={'text-base font-bold ' + styles.textPrimary}>Research journal</h2>
                    ) : (
                        <button
                            type="button"
                            data-testid="research-journal-toggle"
                            aria-expanded={isExpanded}
                            aria-controls="research-journal-details"
                            onClick={() => setIsExpanded((current) => !current)}
                            className={'flex min-h-10 items-center gap-2 rounded text-left text-base font-bold transition-colors hover:text-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.textPrimary}
                        >
                            <span>Research journal</span>
                            <svg aria-hidden="true" viewBox="0 0 20 20" className={'size-4 transition-transform duration-200 ' + (isExpanded ? 'rotate-180' : '')} fill="none" stroke="currentColor" strokeWidth="1.75">
                                <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    )}
                    <p className={'text-xs leading-5 ' + styles.textMuted}>{isEditing
                        ? 'Update the saved thesis and decision checklist, then save the review.'
                        : `${detailChoice(draft.decisionJournal.decision)} · ${completedChecklist}/${checklistKeys.length} checks · reviewed ${draft.lastReviewedAt}`}</p>
                </div>
                {!isEditing ? (
                    <button type="button" onClick={beginReview} data-testid="submit-research-review" className="min-h-10 rounded-md bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
                        Submit review
                    </button>
                ) : null}
            </div>

            {!isEditing && isExpanded ? (
                <>
                    <div id="research-journal-details">
                    <section className={'mt-5 border-t pt-4 ' + styles.divider} aria-labelledby="thesis-triggers-title">
                        <h3 id="thesis-triggers-title" className={'text-sm font-semibold ' + styles.textSecondary}>Thesis and triggers</h3>
                        <dl className="mt-3 grid gap-4 min-[900px]:grid-cols-2">
                            {renderDetail('Why interested', detailText(draft.whyInterested))}
                            {renderDetail('Bull case', detailText(draft.bullCase))}
                            {renderDetail('Bear case', detailText(draft.bearCase))}
                            {renderDetail('Thesis invalidation', detailText(draft.thesisBreak))}
                            {renderDetail('Buy trigger', detailText(draft.buyTrigger))}
                            {renderDetail('Sell trigger', detailText(draft.sellTrigger))}
                            {renderDetail('Review notes', detailText(draft.notes), 'min-[900px]:col-span-2')}
                        </dl>
                    </section>
                    <section className={'mt-4 border-t pt-4 ' + styles.divider} aria-labelledby="research-state-title">
                        <h3 id="research-state-title" className={'text-sm font-semibold ' + styles.textSecondary}>Research state</h3>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {renderDetail('Thesis strength', detailChoice(draft.thesisStrength))}
                            {renderDetail('Valuation', detailChoice(draft.valuationState))}
                            {renderDetail('Target buy zone', detailText(draft.targetBuyZone))}
                            {renderDetail('Position', detailChoice(draft.positionState))}
                            {renderDetail('Price in buy zone', draft.inBuyZone ? 'Yes' : 'No')}
                        </dl>
                    </section>
                    <section className={'mt-4 border-t pt-4 ' + styles.divider} aria-labelledby="saved-decision-title">
                        <h3 id="saved-decision-title" className={'text-sm font-semibold ' + styles.textSecondary}>Saved decision</h3>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {renderDetail('Saved decision', draft.decisionJournal.decision)}
                            {renderDetail('Decision confidence', detailChoice(draft.decisionJournal.confidence))}
                            {renderDetail('Observed price', draft.decisionJournal.observedPrice === null ? 'Not recorded' : String(draft.decisionJournal.observedPrice))}
                            {renderDetail('Next review', draft.decisionJournal.nextReviewAt ?? 'Not scheduled')}
                            {draft.decisionJournal.priorReviewId ? renderDetail('Prior decision outcome', detailChoice(draft.decisionJournal.priorOutcome)) : null}
                            {draft.decisionJournal.outcomeNote ? renderDetail('Outcome note', draft.decisionJournal.outcomeNote, 'sm:col-span-2 xl:col-span-5') : null}
                        </dl>
                    </section>
                    <section className={'mt-4 border-t pt-4 ' + styles.divider} aria-labelledby="position-plan-title">
                        <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="position-plan-title" className={'text-sm font-semibold ' + styles.textSecondary}>Position plan</h3><span className={'text-xs ' + styles.textMuted}>Planning only · no transaction tracking</span></div>
                        <dl className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            {renderDetail('Planned allocation', draft.positionPlan.plannedAllocationPercent === null ? 'Not set' : `${draft.positionPlan.plannedAllocationPercent}%`)}
                            {renderDetail('Average cost', draft.positionPlan.averageCost === null ? 'Not set' : String(draft.positionPlan.averageCost))}
                            {renderDetail('Planned entry', draft.positionPlan.plannedEntryPrice === null ? 'Not set' : String(draft.positionPlan.plannedEntryPrice))}
                            {renderDetail('Invalidation price', draft.positionPlan.invalidationPrice === null ? 'Not set' : String(draft.positionPlan.invalidationPrice))}
                            {renderDetail('Portfolio at risk', positionRisk ? `${positionRisk.portfolioRiskPercent}%` : 'Needs allocation, reference, and lower invalidation')}
                        </dl>
                    </section>
                    <section className={'mt-4 border-t pt-4 ' + styles.divider} aria-labelledby="investment-checklist-title">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 id="investment-checklist-title" className={'text-sm font-semibold ' + styles.textSecondary}>Investment checklist</h3>
                            <span className={'text-xs ' + styles.textMuted}>{completedChecklist}/{checklistKeys.length} complete</span>
                        </div>
                        <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {checklistKeys.map((key) => (
                                <li key={key} className={'flex min-h-10 items-start gap-2 text-xs leading-5 ' + styles.textSecondary}>
                                    <span aria-label={draft.checklist[key] ? 'Complete' : 'Open'} className={'shrink-0 font-semibold ' + (draft.checklist[key] ? styles.positive : styles.textMuted)}>{draft.checklist[key] ? '✓' : 'Open'}</span>
                                    <span>{checklistLabelsV6[key]}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                    {error ? <p role="alert" className={'mt-4 text-xs ' + styles.risk}>{error}</p> : null}
                    </div>
                </>
            ) : (
                isEditing ? <div className="mt-4">
                    <ResearchAssistantV6 symbol={draft.symbol} market={draft.market} theme={theme} onApply={applyFinding} />
                </div> : null
            )}

            {draft.acceptedEvidence.length > 0 && (isEditing || isExpanded) ? (
                <section className={'mt-4 border-b pb-4 ' + styles.divider} aria-labelledby="accepted-evidence-title">
                    <div className="flex items-center justify-between gap-3">
                        <h3 id="accepted-evidence-title" className={'text-sm font-semibold ' + styles.textSecondary}>Accepted evidence</h3>
                        <span className={'text-xs ' + styles.textMuted}>{draft.acceptedEvidence.length} retained finding{draft.acceptedEvidence.length === 1 ? '' : 's'}</span>
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
                                                <a key={source.id + source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer" className={'text-xs underline decoration-dotted underline-offset-2 ' + styles.textMuted}>
                                                    {source.label}: {source.value} · {source.source}{source.reportingPeriod ? ` · ${source.reportingPeriod}` : ''}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                    {isEditing ? <button type="button" onClick={() => setDraft((current) => ({ ...current, acceptedEvidence: current.acceptedEvidence.filter((candidate) => candidate.id !== item.id) }))} className={'min-h-10 shrink-0 px-2 text-xs font-semibold ' + styles.risk} aria-label={`Remove evidence ${item.title}`}>Remove</button> : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            ) : null}
            {isEditing ? <>
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
                    <label className={'flex min-h-10 items-center gap-2 text-xs font-medium ' + styles.textSecondary}><input type="checkbox" checked={draft.positionState === 'owned'} onChange={(event) => setDraft((current) => ({ ...current, positionState: event.target.checked ? 'owned' : 'not-owned' }))} />Owned</label>
                    <label className={'flex min-h-10 items-center gap-2 text-xs font-medium ' + styles.textSecondary}><input type="checkbox" checked={draft.inBuyZone} onChange={(event) => setDraft((current) => ({ ...current, inBuyZone: event.target.checked }))} />Price is in buy zone</label>
                </div>
            </div>
            <fieldset className={'mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 xl:grid-cols-5 ' + styles.divider}>
                <legend className={'mb-2 text-xs font-semibold ' + styles.textMuted}>Decision record</legend>
                <label className={'text-xs font-medium ' + styles.textMuted}>Calculated decision
                    <input value={draft.decisionJournal.decision} readOnly className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Confidence
                    <select value={draft.decisionJournal.confidence} onChange={(event) => setDraft((current) => ({ ...current, decisionJournal: { ...current.decisionJournal, confidence: event.target.value === 'high' ? 'high' : event.target.value === 'low' ? 'low' : 'medium' } }))} className={'mt-1 ' + field}>
                        <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Observed price
                    <input value={draft.decisionJournal.observedPrice ?? ''} readOnly className={'mt-1 ' + field} />
                </label>
                <label className={'text-xs font-medium ' + styles.textMuted}>Next review date
                    <input type="date" value={draft.decisionJournal.nextReviewAt ?? ''} onChange={(event) => setDraft((current) => ({ ...current, decisionJournal: { ...current.decisionJournal, nextReviewAt: event.target.value || null } }))} className={'mt-1 ' + field} />
                </label>
                {draft.decisionJournal.priorReviewId ? <>
                    <label className={'text-xs font-medium ' + styles.textMuted}>Prior decision outcome
                        <select value={draft.decisionJournal.priorOutcome} onChange={(event) => setDraft((current) => ({ ...current, decisionJournal: { ...current.decisionJournal, priorOutcome: event.target.value === 'correct' ? 'correct' : event.target.value === 'mixed' ? 'mixed' : event.target.value === 'incorrect' ? 'incorrect' : 'unresolved' } }))} className={'mt-1 ' + field}>
                            <option value="unresolved">Unresolved</option><option value="correct">Correct</option><option value="mixed">Mixed</option><option value="incorrect">Incorrect</option>
                        </select>
                    </label>
                    <label className={'text-xs font-medium sm:col-span-1 xl:col-span-5 ' + styles.textMuted}>Outcome note
                        <input value={draft.decisionJournal.outcomeNote} maxLength={1000} onChange={(event) => setDraft((current) => ({ ...current, decisionJournal: { ...current.decisionJournal, outcomeNote: event.target.value } }))} className={'mt-1 ' + field} />
                    </label>
                </> : <p className={'self-end text-xs leading-5 sm:col-span-2 xl:col-span-5 ' + styles.textMuted}>Save the first decision before evaluating an outcome. Later reviews will link their assessment to this snapshot.</p>}
            </fieldset>
            <fieldset className={'mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 xl:grid-cols-5 ' + styles.divider}>
                <legend className={'mb-2 text-xs font-semibold ' + styles.textMuted}>Position plan</legend>
                {([
                    ['plannedAllocationPercent', 'Planned allocation %', 100],
                    ['averageCost', 'Average cost', 1_000_000_000],
                    ['plannedEntryPrice', 'Planned entry price', 1_000_000_000],
                    ['invalidationPrice', 'Invalidation price', 1_000_000_000],
                ] as const).map(([key, label, max]) => <label key={key} className={'text-xs font-medium ' + styles.textMuted}>{label}
                    <input type="number" min="0" max={max} step="0.01" value={draft.positionPlan[key] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, positionPlan: { ...current.positionPlan, [key]: event.target.value === '' ? null : Number(event.target.value) } }))} className={'mt-1 ' + field} />
                </label>)}
                <p className={'text-xs leading-5 sm:col-span-2 xl:col-span-5 ' + styles.textMuted}>{positionRisk ? `${positionRisk.downsidePercent.toFixed(1)}% downside from ${positionRisk.referencePrice.toFixed(2)} implies approximately ${positionRisk.portfolioRiskPercent.toFixed(2)}% of portfolio at risk.` : 'Portfolio-at-risk appears when allocation, an average cost or planned entry, and a lower invalidation price are set.'}</p>
            </fieldset>
            <fieldset className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <legend className={'mb-2 text-xs font-semibold ' + styles.textMuted}>Investment checklist</legend>
                {checklistKeys.map((key) => (
                    <label key={key} className={'flex min-h-10 items-start gap-2 text-xs leading-5 ' + styles.textSecondary}>
                        <input type="checkbox" checked={draft.checklist[key]} onChange={(event) => setDraft((current) => ({ ...current, checklist: { ...current.checklist, [key]: event.target.checked } }))} className="mt-1" />
                        {checklistLabelsV6[key]}
                    </label>
                ))}
            </fieldset>
            <div className={'sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-end gap-3 rounded-md border px-3 py-2 backdrop-blur ' + styles.row}>
                <p role={error ? 'alert' : 'status'} aria-live="polite" className={'mr-auto text-xs ' + (error ? styles.risk : isDirty ? styles.textSecondary : styles.textMuted)}>
                    {error ?? (isDirty ? 'Unsaved changes' : lastSavedAt ? `Saved at ${lastSavedAt}` : 'Saved review')}
                </p>
                <button type="button" disabled={saving} onClick={handleCancel} className={'min-h-10 rounded-md border px-4 py-2 text-xs font-bold disabled:opacity-50 ' + styles.row}>Cancel</button>
                <button type="button" disabled={saving} onClick={() => void handleSave()} className="min-h-10 rounded-md bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 active:scale-95 disabled:opacity-50">
                    {saving ? 'Saving...' : 'Save review'}
                </button>
            </div>
            </> : null}
        </section>
    );
};
