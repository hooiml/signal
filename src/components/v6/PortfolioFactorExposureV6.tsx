'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    buildPortfolioFactorExposure,
    parseResearchFactorAssumptionSet,
    researchFactorDirectionLabels,
    researchFactorEvidenceIds,
    researchFactorMaterialityLabels,
    researchFactorTaxonomy,
} from '@/lib/research/factor-exposure';
import { reconcilePortfolioHoldings } from '@/lib/portfolio/holdings';
import {
    loadPortfolioHoldingsSnapshot,
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    PORTFOLIO_HOLDINGS_STORAGE_KEY,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import {
    researchFactorDirections,
    researchFactorIds,
    researchFactorMaterialities,
    type ResearchFactorAssumption,
    type ResearchFactorDirection,
    type ResearchFactorId,
    type ResearchFactorMateriality,
    type ResearchRecord,
    type ResearchUpdateMode,
} from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type RestoreState = { readonly status: 'loading'; readonly snapshot: null } | PortfolioHoldingsLoadResult;

const emptyAssumption = (used: ReadonlySet<ResearchFactorId>): ResearchFactorAssumption | null => {
    const factor = researchFactorIds.find((candidate) => !used.has(candidate));
    return factor ? {
        factor,
        direction: 'mixed',
        materiality: 'moderate',
        evidenceNote: '',
        evidenceDate: new Date().toISOString().slice(0, 10),
        evidenceId: null,
    } : null;
};

const money = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

const shortDirection: Readonly<Record<ResearchFactorDirection, string>> = {
    'benefits-when-rises': 'Benefits ↑',
    'harmed-when-rises': 'Harmed ↑',
    mixed: 'Mixed',
};

const directionValue = (
    aggregate: ReturnType<typeof buildPortfolioFactorExposure>[number]['aggregates'][number],
): { readonly direction: ResearchFactorDirection; readonly value: number; readonly percent: number | null } => {
    const values = [
        { direction: 'benefits-when-rises' as const, value: aggregate.benefitsKnownValue, percent: aggregate.benefitsSharePercent },
        { direction: 'harmed-when-rises' as const, value: aggregate.harmedKnownValue, percent: aggregate.harmedSharePercent },
        { direction: 'mixed' as const, value: aggregate.mixedKnownValue, percent: aggregate.mixedSharePercent },
    ];
    return values.sort((left, right) => right.value - left.value)[0]!;
};

export const PortfolioFactorExposureV6 = ({ records, items, theme, saving, saveError, onSave }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly saving: boolean;
    readonly saveError: string | null;
    readonly onSave: (record: ResearchRecord, mode?: ResearchUpdateMode) => Promise<boolean>;
}) => {
    const styles = getThemeV6(theme);
    const [restore, setRestore] = useState<RestoreState>({ status: 'loading', snapshot: null });
    const [accountFilter, setAccountFilter] = useState('all');
    const [currencyFilter, setCurrencyFilter] = useState('all');
    const [selectedSymbol, setSelectedSymbol] = useState(records[0]?.symbol ?? '');
    const selectedRecord = records.find((record) => record.symbol === selectedSymbol) ?? records[0] ?? null;
    const [assumptions, setAssumptions] = useState<readonly ResearchFactorAssumption[]>(
        selectedRecord?.factorAssumptions.assumptions ?? [],
    );
    const [draft, setDraft] = useState<ResearchFactorAssumption | null>(() =>
        emptyAssumption(new Set(selectedRecord?.factorAssumptions.assumptions.map((entry) => entry.factor) ?? [])));
    const [editingFactor, setEditingFactor] = useState<ResearchFactorId | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const editorRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const reload = () => setRestore(loadPortfolioHoldingsSnapshot());
        const timer = window.setTimeout(reload, 0);
        const storage = (event: StorageEvent) => {
            if (event.key === PORTFOLIO_HOLDINGS_STORAGE_KEY) reload();
        };
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, reload);
        window.addEventListener('storage', storage);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, reload);
            window.removeEventListener('storage', storage);
        };
    }, []);

    useEffect(() => {
        if (!selectedRecord) return;
        const timer = window.setTimeout(() => {
            setAssumptions(selectedRecord.factorAssumptions.assumptions);
            setEditingFactor(null);
            setDraft(emptyAssumption(new Set(selectedRecord.factorAssumptions.assumptions.map((entry) => entry.factor))));
        }, 0);
        return () => window.clearTimeout(timer);
    }, [selectedRecord]);

    const prices = useMemo(() => new Map(items.map((item) => [
        `${item.market}:${item.symbol}`,
        typeof item.price === 'number' ? item.price : null,
    ])), [items]);
    const recordByIdentity = useMemo(
        () => new Map(records.map((record) => [`${record.market}:${record.symbol}`, record])),
        [records],
    );
    const reconciled = useMemo(() => restore.status === 'ready'
        ? reconcilePortfolioHoldings(restore.snapshot, records, prices)
        : [], [prices, records, restore]);
    const groups = useMemo(() => buildPortfolioFactorExposure(reconciled), [reconciled]);
    const accounts = [...new Set(groups.map((group) => group.accountLabel))].sort();
    const currencies = [...new Set(groups.map((group) => group.currency))].sort();
    const filteredGroups = groups.filter((group) =>
        (accountFilter === 'all' || group.accountLabel === accountFilter)
        && (currencyFilter === 'all' || group.currency === currencyFilter));
    const visibleFactors = researchFactorIds.filter((factor) =>
        filteredGroups.some((group) => group.factors.includes(factor)));
    const evidenceOptions = selectedRecord ? [
        ...selectedRecord.acceptedEvidence.map((evidence) => ({
            id: evidence.id,
            label: `Accepted evidence · ${evidence.title}`,
        })),
        ...selectedRecord.documentEvidence.citations.map((citation) => ({
            id: citation.id,
            label: `Document citation · ${citation.title}`,
        })),
    ] : [];
    const allowedEvidenceIds = selectedRecord ? researchFactorEvidenceIds(selectedRecord) : new Set<string>();
    const dirty = selectedRecord
        ? JSON.stringify(assumptions) !== JSON.stringify(selectedRecord.factorAssumptions.assumptions)
        : false;

    const selectRecord = (symbol: string) => {
        const record = records.find((candidate) => candidate.symbol === symbol);
        setSelectedSymbol(symbol);
        setAssumptions(record?.factorAssumptions.assumptions ?? []);
        setEditingFactor(null);
        setDraft(emptyAssumption(new Set(record?.factorAssumptions.assumptions.map((entry) => entry.factor) ?? [])));
        setStatus(null);
    };

    const beginEdit = (symbol: string) => {
        selectRecord(symbol);
        window.requestAnimationFrame(() => {
            editorRef.current?.focus();
            const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            editorRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
        });
    };

    const stageAssumption = () => {
        if (!draft || !selectedRecord) return;
        try {
            const next = [
                ...assumptions.filter((assumption) => assumption.factor !== editingFactor),
                draft,
            ];
            const parsed = parseResearchFactorAssumptionSet(
                { version: 1, assumptions: next },
                allowedEvidenceIds,
            );
            setAssumptions(parsed.assumptions);
            setEditingFactor(null);
            setDraft(emptyAssumption(new Set(parsed.assumptions.map((entry) => entry.factor))));
            setStatus('Factor assumption staged. Save assumptions to persist it.');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Factor assumption is invalid.');
        }
    };

    const save = async () => {
        if (!selectedRecord) return;
        try {
            const parsed = parseResearchFactorAssumptionSet(
                { version: 1, assumptions },
                allowedEvidenceIds,
            );
            const saved = await onSave({
                ...selectedRecord,
                factorAssumptions: parsed,
            }, 'factors');
            setStatus(saved
                ? 'Factor assumptions saved with optimistic revision protection. No thesis, decision, citation, monitoring, or review-history field changed.'
                : 'Factor assumptions were not saved. Reload after resolving the conflict, then try again.');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Factor assumptions are invalid.');
        }
    };

    const queue = (symbol: string, factor: ResearchFactorId | 'coverage') => {
        const result = enqueueResearchWorkflowTaskClient({
            symbol,
            templateId: 'thesis-challenge',
            source: 'factor-exposure',
            dedupeKey: `factor:${symbol}:${factor}`,
            dueAt: new Date().toISOString().slice(0, 10),
        });
        setStatus(result.created
            ? `${symbol} factor-exposure review added to Queue.`
            : `${symbol} already has that factor-exposure review in Queue.`);
    };

    return <section data-testid="portfolio-factor-exposure" aria-labelledby="portfolio-factor-title" className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Explicit assumptions only</p>
                <h2 id="portfolio-factor-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Portfolio factor-exposure matrix</h2>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>
                    Matrix cells come only from factor assumptions you saved for an exact market + symbol research record. A blank is undeclared, never neutral. No sector, prose, AI, score, correlation, or price behavior creates an assumption.
                </p>
            </div>
            <span className={'rounded border px-2 py-1 text-xs ' + styles.row}>{visibleFactors.length} declared factor{visibleFactors.length === 1 ? '' : 's'}</span>
        </div>

        <section className={'mt-4 rounded border p-3 ' + styles.panelSolid} aria-labelledby="factor-author-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h3 id="factor-author-title" ref={editorRef} tabIndex={-1} className={'text-sm font-bold focus:outline-none ' + styles.textPrimary}>Edit a researched ticker</h3>
                    <p className={'mt-1 text-xs ' + styles.textMuted}>Saving uses a narrow factor-only revision. A later full review freezes the then-current assumptions in immutable history.</p>
                </div>
                <label className={'text-xs font-semibold ' + styles.textMuted}>Ticker
                    <select aria-label="Factor assumption ticker" value={selectedRecord?.symbol ?? ''} onChange={(event) => selectRecord(event.target.value)} className={'ml-2 min-h-10 rounded border px-3 ' + styles.panelUtility}>
                        {records.map((record) => <option key={`${record.market}:${record.symbol}`} value={record.symbol}>{record.symbol} · {record.market}</option>)}
                    </select>
                </label>
            </div>

            {!selectedRecord ? <p className={'mt-3 text-sm ' + styles.textMuted}>Add a research record before declaring factor assumptions.</p> : <>
                {selectedRecord.factorAssumptions.migrationState !== 'current' ? <p role="status" className={'mt-3 rounded border p-3 text-xs ' + (selectedRecord.factorAssumptions.migrationState === 'invalid-recovered' ? styles.risk : styles.textMuted)}>
                    {selectedRecord.factorAssumptions.migrationState === 'invalid-recovered'
                        ? 'Malformed persisted factor assumptions were recovered as an empty list. Add valid assumptions and save to repair this record.'
                        : 'This older record was migrated to an empty version-1 factor-assumption list.'}
                </p> : null}

                {assumptions.length > 0 ? <ul className={'mt-3 divide-y ' + styles.divider}>{assumptions.map((assumption) => {
                    const linked = assumption.evidenceId === null || allowedEvidenceIds.has(assumption.evidenceId);
                    return <li key={assumption.factor} className="flex flex-wrap items-start justify-between gap-3 py-3">
                        <div>
                            <p className={'text-xs font-bold ' + styles.textPrimary}>{researchFactorTaxonomy[assumption.factor].label} · {shortDirection[assumption.direction]} · {researchFactorMaterialityLabels[assumption.materiality]}</p>
                            <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{assumption.evidenceDate}{assumption.evidenceNote ? ` · ${assumption.evidenceNote}` : ' · No evidence note'}{assumption.evidenceId ? ` · ${linked ? 'Evidence linked' : 'Evidence link unavailable'}` : ' · No evidence link'}</p>
                            {!linked ? <p role="alert" className={'mt-1 text-xs ' + styles.risk}>The saved evidence ID is no longer available in this record. Select another link or None before saving.</p> : null}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => { setEditingFactor(assumption.factor); setDraft({ ...assumption }); }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Edit</button>
                            <button type="button" onClick={() => {
                                const next = assumptions.filter((entry) => entry.factor !== assumption.factor);
                                setAssumptions(next);
                                setEditingFactor(null);
                                setDraft(emptyAssumption(new Set(next.map((entry) => entry.factor))));
                                setStatus('Factor assumption removal staged. Save assumptions to persist it.');
                            }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.risk}>Remove</button>
                        </div>
                    </li>;
                })}</ul> : <p className={'mt-3 rounded border p-4 text-center text-sm ' + styles.textMuted}>No explicit factor assumptions saved or staged for {selectedRecord.symbol}.</p>}

                {draft ? <fieldset className={'mt-3 grid gap-3 rounded border p-3 sm:grid-cols-2 ' + styles.panelUtility}>
                    <legend className={'px-1 text-xs font-bold ' + styles.textPrimary}>{editingFactor ? 'Edit assumption' : 'Add assumption'}</legend>
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Factor
                        <select aria-label="Factor" value={draft.factor} onChange={(event) => setDraft({ ...draft, factor: event.target.value as ResearchFactorId })} className={'mt-1 min-h-10 w-full rounded border px-3 ' + styles.panelSolid}>
                            {researchFactorIds.map((factor) => <option key={factor} value={factor} disabled={factor !== editingFactor && assumptions.some((entry) => entry.factor === factor)}>{researchFactorTaxonomy[factor].label}</option>)}
                        </select>
                        <span className="mt-1 block text-[11px]">{researchFactorTaxonomy[draft.factor].description}</span>
                    </label>
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Direction when factor rises
                        <select aria-label="Factor direction" value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as ResearchFactorDirection })} className={'mt-1 min-h-10 w-full rounded border px-3 ' + styles.panelSolid}>
                            {researchFactorDirections.map((direction) => <option key={direction} value={direction}>{researchFactorDirectionLabels[direction]}</option>)}
                        </select>
                    </label>
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Materiality
                        <select aria-label="Factor materiality" value={draft.materiality} onChange={(event) => setDraft({ ...draft, materiality: event.target.value as ResearchFactorMateriality })} className={'mt-1 min-h-10 w-full rounded border px-3 ' + styles.panelSolid}>
                            {researchFactorMaterialities.map((materiality) => <option key={materiality} value={materiality}>{researchFactorMaterialityLabels[materiality]}</option>)}
                        </select>
                    </label>
                    <label className={'text-xs font-semibold ' + styles.textMuted}>Evidence date
                        <input aria-label="Factor evidence date" type="date" value={draft.evidenceDate} onChange={(event) => setDraft({ ...draft, evidenceDate: event.target.value })} className={'mt-1 min-h-10 w-full rounded border px-3 ' + styles.panelSolid} />
                    </label>
                    <label className={'text-xs font-semibold sm:col-span-2 ' + styles.textMuted}>Existing accepted evidence or citation (optional)
                        <select aria-label="Factor evidence link" value={draft.evidenceId ?? ''} onChange={(event) => setDraft({ ...draft, evidenceId: event.target.value || null })} className={'mt-1 min-h-10 w-full rounded border px-3 ' + styles.panelSolid}>
                            <option value="">None</option>
                            {draft.evidenceId && !allowedEvidenceIds.has(draft.evidenceId) ? <option value={draft.evidenceId}>Unavailable · {draft.evidenceId}</option> : null}
                            {evidenceOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                    </label>
                    <label className={'text-xs font-semibold sm:col-span-2 ' + styles.textMuted}>Evidence note (optional)
                        <textarea aria-label="Factor evidence note" rows={3} maxLength={500} value={draft.evidenceNote} onChange={(event) => setDraft({ ...draft, evidenceNote: event.target.value })} className={'mt-1 w-full rounded border px-3 py-2 ' + styles.panelSolid} />
                        <span className="mt-1 block text-right text-[11px]">{draft.evidenceNote.length}/500</span>
                    </label>
                    <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                        {editingFactor ? <button type="button" onClick={() => {
                            setEditingFactor(null);
                            setDraft(emptyAssumption(new Set(assumptions.map((entry) => entry.factor))));
                        }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Cancel edit</button> : null}
                        <button type="button" onClick={stageAssumption} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">{editingFactor ? 'Update staged assumption' : 'Add to draft'}</button>
                    </div>
                </fieldset> : <p className={'mt-3 text-xs ' + styles.textMuted}>All fixed version-1 factors are already declared for this ticker.</p>}

                <div className="mt-3 flex justify-end">
                    <button type="button" disabled={!dirty || saving} onClick={() => void save()} className="min-h-11 rounded bg-emerald-500 px-4 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save factor assumptions'}</button>
                </div>
            </>}
        </section>

        {(status || saveError) ? <p role={saveError ? 'alert' : 'status'} aria-live="polite" className={'mt-3 text-xs ' + (saveError ? styles.risk : styles.textSecondary)}>{saveError ?? status}</p> : null}

        {restore.status === 'loading' ? <p role="status" className={'mt-4 text-sm ' + styles.textMuted}>Restoring local holdings…</p>
            : restore.status === 'unavailable' || restore.status === 'invalid' ? <p role="alert" className={'mt-4 rounded border p-3 text-sm ' + styles.risk}>{restore.message} The factor matrix cannot use an unreadable holdings snapshot.</p>
                : restore.snapshot === null ? <div className={'mt-4 rounded border p-5 text-center ' + styles.panelUtility}><p className={'text-sm font-semibold ' + styles.textPrimary}>No imported holdings</p><p className={'mt-1 text-xs ' + styles.textMuted}>Import a read-only holdings snapshot above to build the explicit factor matrix.</p></div>
                    : <>
                        <div className="mt-4 flex flex-wrap gap-3">
                            <label className={'text-xs font-semibold ' + styles.textMuted}>Account
                                <select aria-label="Factor matrix account filter" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)} className={'ml-2 min-h-10 rounded border px-3 ' + styles.panelSolid}>
                                    <option value="all">All accounts</option>{accounts.map((account) => <option key={account}>{account}</option>)}
                                </select>
                            </label>
                            <label className={'text-xs font-semibold ' + styles.textMuted}>Currency
                                <select aria-label="Factor matrix currency filter" value={currencyFilter} onChange={(event) => setCurrencyFilter(event.target.value)} className={'ml-2 min-h-10 rounded border px-3 ' + styles.panelSolid}>
                                    <option value="all">All currencies</option>{currencies.map((currency) => <option key={currency}>{currency}</option>)}
                                </select>
                            </label>
                        </div>

                        {visibleFactors.length === 0 ? <div className={'mt-4 rounded border p-5 text-center ' + styles.panelUtility}><p className={'text-sm font-semibold ' + styles.textPrimary}>No declared assumptions for these holdings</p><p className={'mt-1 text-xs ' + styles.textMuted}>Unmatched and undeclared holdings remain visible below; no blank is converted to neutral.</p></div> : null}

                        {filteredGroups.map((group) => <section key={`${group.accountLabel}:${group.currency}`} className={'mt-4 rounded border p-3 ' + styles.panelUtility} aria-label={`${group.accountLabel} ${group.currency} factor exposure`}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div><h3 className={'text-sm font-bold ' + styles.textPrimary}>{group.accountLabel} · {group.currency}</h3><p className={'mt-1 text-xs ' + styles.textMuted}>Known holding value {money(group.knownValue, group.currency)} · {group.missingPriceCount} missing price · {group.unmatchedCount} unmatched · {group.noAssumptionCount} matched with no assumptions</p></div>
                                <span className={'text-xs ' + styles.textMuted}>{group.rows.length} holding{group.rows.length === 1 ? '' : 's'}</span>
                            </div>

                            {group.aggregates.length > 0 ? <div className="mt-3 grid gap-2 lg:grid-cols-2">{group.aggregates.map((aggregate) => {
                                const concentration = directionValue(aggregate);
                                const candidate = group.rows.find((row) => row.cells[aggregate.factor]?.assumption.direction === concentration.direction && row.matched);
                                return <article key={aggregate.factor} className={'rounded border p-3 ' + styles.panelSolid}>
                                    <p className={'text-xs font-bold ' + styles.textPrimary}>{researchFactorTaxonomy[aggregate.factor].label}</p>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textSecondary}>
                                        {concentration.percent === null ? 'Known-value share unavailable.' : `${concentration.percent.toFixed(1)}% of known ${group.currency} holding value is explicitly marked ${researchFactorDirectionLabels[concentration.direction].toLowerCase()}.`}
                                    </p>
                                    <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>
                                        {money(concentration.value, group.currency)} / {money(aggregate.knownValueDenominator, group.currency)} · {aggregate.knownValueCoveragePercent?.toFixed(1) ?? '0.0'}% known-value coverage · {aggregate.holdingsWithAssumption}/{aggregate.totalHoldings} holdings declared
                                    </p>
                                    {candidate && (concentration.percent ?? 0) >= 50 ? <button type="button" onClick={() => queue(candidate.holding.symbol, aggregate.factor)} className={'mt-2 min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Queue concentration review</button> : null}
                                </article>;
                            })}</div> : null}

                            <div className="research-scrollbar mt-3 overflow-x-auto">
                                <table className="w-full min-w-[760px] text-left text-xs">
                                    <caption className={'mb-2 text-left font-semibold ' + styles.textSecondary}>Declared direction and materiality only</caption>
                                    <thead><tr className={styles.textMuted}><th className="pb-2 pr-4">Holding</th><th className="pb-2 pr-4">Mapping / value</th>{visibleFactors.map((factor) => <th key={factor} className="min-w-[150px] pb-2 pr-4">{researchFactorTaxonomy[factor].label}</th>)}<th className="pb-2">Action</th></tr></thead>
                                    <tbody>{group.rows.map((row) => <tr key={`${row.holding.accountLabel}:${row.holding.market}:${row.holding.symbol}`} className={'border-t align-top ' + styles.divider}>
                                        <th className="py-3 pr-4 font-mono">{row.holding.symbol}<span className={'mt-1 block font-sans text-[11px] font-normal ' + styles.textMuted}>{row.holding.market}</span></th>
                                        <td className="py-3 pr-4">{!row.matched ? <span className={styles.risk}>Unmatched</span> : row.missingPrice ? <span className={styles.textMuted}>Exact match · price unavailable</span> : <span className={styles.positive}>Exact match · known value</span>}</td>
                                        {visibleFactors.map((factor) => {
                                            const cell = row.cells[factor];
                                            const owner = recordByIdentity.get(`${row.holding.market}:${row.holding.symbol}`);
                                            const evidenceAvailable = cell?.assumption.evidenceId === null
                                                || (owner ? researchFactorEvidenceIds(owner).has(cell?.assumption.evidenceId ?? '') : false);
                                            return <td key={factor} className="py-3 pr-4">{cell ? <details>
                                                <summary className={'cursor-pointer font-semibold ' + styles.textPrimary}>{shortDirection[cell.assumption.direction]} · {researchFactorMaterialityLabels[cell.assumption.materiality]}</summary>
                                                <p className={'mt-2 leading-5 ' + styles.textMuted}>{cell.assumption.evidenceDate} · {cell.assumption.evidenceNote || 'No evidence note'} · {cell.assumption.evidenceId ? evidenceAvailable ? 'Evidence linked' : 'Evidence link unavailable' : 'No evidence link'}</p>
                                            </details> : <span className={styles.textMuted}>Not declared</span>}</td>;
                                        })}
                                        <td className="py-3">{row.matched ? <div className="flex flex-col items-start gap-2"><button type="button" onClick={() => beginEdit(row.holding.symbol)} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Edit assumptions</button>{Object.keys(row.cells).length === 0 ? <button type="button" onClick={() => queue(row.holding.symbol, 'coverage')} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Queue uncovered review</button> : null}</div> : <span className={styles.textMuted}>Research record required</span>}</td>
                                    </tr>)}</tbody>
                                </table>
                            </div>
                        </section>)}
                    </>}

        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>Shares are descriptive portions of known current holding value within one exact account and currency. Missing prices are excluded from value denominators but remain in count coverage. Cash is not assigned a factor. These are declared assumptions, not beta, sensitivity estimates, forecasts, expected returns, or recommendations.</p>
    </section>;
};
