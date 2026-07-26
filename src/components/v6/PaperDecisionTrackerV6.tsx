'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
    addPaperDecision,
    buildDecisionReviewAnalytics,
    decisionReviewDueAt,
    decisionReviewHistoryKey,
    decisionReviewHorizons,
    removePaperDecision,
    resolveDuePaperDecisions,
    resolvePaperDecision,
    type DecisionReviewHorizon,
    type PaperDecision,
    type PaperDecisionAction,
} from '@/lib/research/paper-decisions';
import { loadPaperDecisions, savePaperDecisions } from '@/lib/research/paper-decisions-client';
import { parseResearchChartResponse, parseResearchQuoteResponse } from '@/lib/research/snapshot-input';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchChartPoint } from '@/lib/types/research-snapshot';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
}).format(new Date(value));

const percent = (value: number | null) =>
    value === null ? 'Unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const benchmarkLabel = (symbol: 'VOO' | 'KLCI') => symbol === 'VOO' ? 'VOO' : 'FBM KLCI';

const fetchQuotePrice = async (
    symbol: string,
    market: ResearchRecord['market'],
): Promise<number | null> => {
    const response = await fetch(`/api/research/quote/${encodeURIComponent(symbol)}?market=${market}`);
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(`Quote unavailable for ${symbol}.`);
    return parseResearchQuoteResponse(payload).price;
};

const fetchChartHistory = async (
    symbol: string,
    market: ResearchRecord['market'],
    signal: AbortSignal,
): Promise<readonly ResearchChartPoint[]> => {
    const response = await fetch(`/api/research/chart/${encodeURIComponent(symbol)}?market=${market}`, { signal });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(`History unavailable for ${symbol}.`);
    return parseResearchChartResponse(payload).points;
};

export const PaperDecisionTrackerV6 = ({ records, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const [decisions, setDecisions] = useState<readonly PaperDecision[]>([]);
    const [symbol, setSymbol] = useState(records[0]?.symbol ?? '');
    const [action, setAction] = useState<PaperDecisionAction>('act');
    const [horizon, setHorizon] = useState<DecisionReviewHorizon>('3M');
    const [price, setPrice] = useState('');
    const [note, setNote] = useState('');
    const [recording, setRecording] = useState(false);
    const [reviewStatus, setReviewStatus] = useState<string | null>(null);
    const [reviewClock] = useState(() => Date.now());
    const attemptedReviewIds = useRef(new Set<string>());
    const styles = getThemeV6(theme);
    const selectedRecord = records.find((record) => record.symbol === symbol) ?? records[0];
    const analytics = useMemo(() => buildDecisionReviewAnalytics(decisions), [decisions]);
    const resultById = useMemo(() =>
        new Map(analytics.results.map((result) => [result.decision.id, result])), [analytics.results]);

    useEffect(() => {
        const timer = window.setTimeout(() => setDecisions(loadPaperDecisions()), 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        const due = decisions.filter((decision) =>
            decision.outcomePrice === null
            && !attemptedReviewIds.current.has(decision.id)
            && reviewClock >= Date.parse(decisionReviewDueAt(decision)));
        if (due.length === 0) return;
        due.forEach((decision) => attemptedReviewIds.current.add(decision.id));
        const controller = new AbortController();
        const load = async () => {
            setReviewStatus('Checking due decisions against five-year price history...');
            const requests = new Map<string, { readonly symbol: string; readonly market: ResearchRecord['market'] }>();
            for (const decision of due) {
                requests.set(
                    decisionReviewHistoryKey(decision.symbol, decision.market),
                    { symbol: decision.symbol, market: decision.market },
                );
                requests.set(
                    decisionReviewHistoryKey(decision.benchmark.symbol, decision.market),
                    { symbol: decision.benchmark.symbol, market: decision.market },
                );
            }
            const settled = await Promise.allSettled([...requests].map(async ([key, request]) => ({
                key,
                points: await fetchChartHistory(request.symbol, request.market, controller.signal),
            })));
            if (controller.signal.aborted) return;
            const histories = new Map<string, readonly ResearchChartPoint[]>();
            const failed: string[] = [];
            for (const result of settled) {
                if (result.status === 'fulfilled') histories.set(result.value.key, result.value.points);
                else if (!(result.reason instanceof DOMException && result.reason.name === 'AbortError')) {
                    failed.push(result.reason instanceof Error ? result.reason.message : 'History unavailable.');
                }
            }
            const next = resolveDuePaperDecisions(decisions, histories);
            const resolvedCount = next.filter((decision, index) =>
                decisions[index]?.outcomePrice === null && decision.outcomePrice !== null).length;
            if (resolvedCount > 0) {
                setDecisions(next);
                savePaperDecisions(next);
            }
            setReviewStatus([
                resolvedCount > 0 ? `${resolvedCount} due decision${resolvedCount === 1 ? '' : 's'} resolved.` : 'No due decision could be resolved yet.',
                failed.length > 0 ? failed.join(' ') : '',
            ].filter(Boolean).join(' '));
        };
        void load();
        return () => controller.abort();
    }, [decisions, reviewClock]);

    const persist = (next: readonly PaperDecision[]) => {
        setDecisions(next);
        savePaperDecisions(next);
    };

    const add = async () => {
        const decisionPrice = Number(price);
        if (!selectedRecord || !Number.isFinite(decisionPrice) || decisionPrice <= 0) return;
        setRecording(true);
        const recordedAt = new Date().toISOString();
        const benchmarkSymbol = selectedRecord.market === 'US' ? 'VOO' : 'KLCI';
        let benchmarkEntryPrice: number | null = null;
        try {
            benchmarkEntryPrice = await fetchQuotePrice(benchmarkSymbol, selectedRecord.market);
        } catch {
            setReviewStatus(`${benchmarkLabel(benchmarkSymbol)} entry price was unavailable. Signal will backfill it from historical data when the review becomes due.`);
        }
        persist(addPaperDecision(decisions, {
            id: `${selectedRecord.symbol}:${recordedAt}`,
            symbol: selectedRecord.symbol,
            market: selectedRecord.market,
            action,
            decisionPrice,
            note,
            recordedAt,
            horizon,
            researchDecision: selectedRecord.decisionJournal.decision,
            confidence: selectedRecord.decisionJournal.confidence,
            benchmark: {
                symbol: benchmarkSymbol,
                entryPrice: benchmarkEntryPrice,
                outcomePrice: null,
                observedAt: null,
            },
            outcomePrice: null,
            resolvedAt: null,
            maxDrawdownPercent: null,
            maxFavorableMovePercent: null,
        }));
        setPrice('');
        setNote('');
        setRecording(false);
    };

    return (
        <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="paper-decisions-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="paper-decisions-title" className={'text-sm font-bold ' + styles.textPrimary}>Decision Review Lab</h2>
                    <p className={'mt-1 max-w-2xl text-xs leading-5 ' + styles.textMuted}>Record an act-or-pass decision with a measurement horizon. When it becomes due, Signal freezes the first available candidate and benchmark sessions, then reports the path and decision effect without claiming a trade return.</p>
                </div>
                {records.length > 0 ? (
                    <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:w-auto xl:grid-cols-[7rem_7rem_6rem_8rem_minmax(10rem,1fr)_auto]">
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Ticker
                            <select aria-label="Paper decision ticker" value={selectedRecord?.symbol ?? ''} onChange={(event) => setSymbol(event.target.value)} className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}>
                                {records.map((record) => <option key={record.symbol} value={record.symbol}>{record.symbol}</option>)}
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Decision
                            <select aria-label="Paper decision action" value={action} onChange={(event) => setAction(event.target.value as PaperDecisionAction)} className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}>
                                <option value="act">Act</option>
                                <option value="pass">Pass</option>
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Horizon
                            <select aria-label="Paper decision horizon" value={horizon} onChange={(event) => setHorizon(event.target.value as DecisionReviewHorizon)} className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}>
                                {decisionReviewHorizons.map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Observed price
                            <input aria-label="Paper decision price" type="number" min="0.0001" step="any" value={price} onChange={(event) => setPrice(event.target.value)} className={'mt-1 min-h-10 w-full rounded-md border px-3 font-mono ' + styles.panelSolid} />
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Short rationale
                            <input aria-label="Paper decision rationale" maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid} />
                        </label>
                        <button type="button" disabled={recording || !selectedRecord || !(Number(price) > 0)} onClick={() => void add()} className={'min-h-10 rounded-md border px-4 text-xs font-bold disabled:opacity-50 ' + styles.panelAction}>{recording ? 'Recording...' : 'Record'}</button>
                    </div>
                ) : null}
            </div>

            {reviewStatus ? <p role="status" className={'mt-3 rounded border px-3 py-2 text-xs leading-5 ' + styles.panelUtility + ' ' + styles.textMuted}>{reviewStatus}</p> : null}

            <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                    ['Resolved', String(analytics.resolvedCount), `${decisions.length - analytics.resolvedCount} still collecting`],
                    ['Benchmarked', String(analytics.benchmarkedCount), `Against ${records.some((record) => record.market === 'MY') ? 'VOO or FBM KLCI' : 'VOO'}`],
                    ['Average vs benchmark', percent(analytics.averageRelativeReturnPercent), 'Descriptive across benchmarked reviews'],
                    ['Evidence level', analytics.evidenceLevel, analytics.evidenceLevel === 'established' ? '20 or more benchmarked reviews' : analytics.evidenceLevel === 'preliminary' ? '5–19 benchmarked reviews' : 'Cohort statistics need at least 5 reviews'],
                ].map(([label, value, detail]) => (
                    <div key={label} className={'rounded-lg border p-3 ' + styles.panelUtility}>
                        <dt className={'text-[11px] font-semibold ' + styles.textMuted}>{label}</dt>
                        <dd className={'mt-1 font-mono text-base font-bold tabular-nums ' + styles.textPrimary}>{value}</dd>
                        <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>{detail}</p>
                    </div>
                ))}
            </dl>

            {decisions.length === 0 ? <p className={'mt-4 text-xs ' + styles.textMuted}>No paper decisions recorded.</p> : (
                <ul className={'mt-3 divide-y ' + styles.divider}>
                    {decisions.map((decision) => {
                        const result = resultById.get(decision.id);
                        const dueAt = decisionReviewDueAt(decision);
                        const due = reviewClock >= Date.parse(dueAt);
                        return (
                            <li key={decision.id} className="grid gap-3 py-4 lg:grid-cols-[7rem_minmax(0,1fr)_minmax(13rem,18rem)_auto] lg:items-center">
                                <button type="button" onClick={() => onOpen(decision.symbol)} className={'min-h-10 text-left font-mono text-sm font-bold ' + styles.textPrimary}>{decision.symbol}</button>
                                <div>
                                    <p className={'text-sm font-semibold ' + styles.textSecondary}>{decision.action === 'act' ? 'Acted on paper' : 'Passed on paper'} at {decision.decisionPrice.toFixed(2)} · {decision.horizon} horizon · {formatDate(decision.recordedAt)}</p>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{decision.note || 'No rationale recorded.'}</p>
                                    <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>
                                        {decision.researchDecision ? `${decision.researchDecision} · ` : ''}{decision.confidence ? `${decision.confidence} confidence · ` : ''}due {formatDate(dueAt)}
                                    </p>
                                </div>
                                {decision.outcomePrice === null ? (
                                    due ? (
                                        <form className="flex items-end gap-2" onSubmit={(event) => {
                                            event.preventDefault();
                                            const form = new FormData(event.currentTarget);
                                            const outcomePrice = Number(form.get('outcomePrice'));
                                            if (Number.isFinite(outcomePrice) && outcomePrice > 0) persist(resolvePaperDecision(decisions, decision.id, outcomePrice, new Date().toISOString()));
                                        }}>
                                            <label className={'text-xs font-semibold ' + styles.textMuted}>Manual fallback price
                                                <input aria-label={`Later price for ${decision.symbol}`} name="outcomePrice" type="number" min="0.0001" step="any" className={'mt-1 min-h-10 w-28 rounded-md border px-2 font-mono ' + styles.panelSolid} />
                                            </label>
                                            <button type="submit" className={'min-h-10 rounded-md border px-3 text-xs font-bold ' + styles.row}>Resolve</button>
                                        </form>
                                    ) : <p className={'text-xs leading-5 ' + styles.textMuted}>Collecting until {formatDate(dueAt)}. The result remains frozen once measured.</p>
                                ) : (
                                    <div className="space-y-1 font-mono text-xs tabular-nums">
                                        <p className={'font-bold ' + (result && result.decisionEffectPercent < 0 ? styles.risk : styles.positive)}>Decision effect {percent(result?.decisionEffectPercent ?? null)}</p>
                                        <p className={styles.textSecondary}>Security {percent(result?.marketReturnPercent ?? null)} · vs {benchmarkLabel(decision.benchmark.symbol)} {percent(result?.relativeReturnPercent ?? null)}</p>
                                        <p className={styles.textMuted}>Drawdown {percent(decision.maxDrawdownPercent)} · favorable {percent(decision.maxFavorableMovePercent)}</p>
                                    </div>
                                )}
                                <button type="button" aria-label={`Remove paper decision ${decision.symbol} ${decision.recordedAt}`} onClick={() => persist(removePaperDecision(decisions, decision.id))} className={'min-h-10 px-2 text-xs font-semibold ' + styles.risk}>Remove</button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {analytics.resolvedCount > 0 ? (
                <section className={'mt-4 rounded-lg border p-3 ' + styles.panelUtility} aria-labelledby="decision-review-cohorts">
                    <h3 id="decision-review-cohorts" className={'text-sm font-bold ' + styles.textPrimary}>Evidence-gated cohorts</h3>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Statistics remain hidden below five resolved observations. Preliminary means 5–19; established means 20 or more. These overlapping, user-recorded observations are descriptive and not out-of-sample validation.</p>
                    <div className="mt-3 grid gap-3 xl:grid-cols-3">
                        {([
                            ['Action', analytics.byAction],
                            ['Confidence', analytics.byConfidence],
                            ['Horizon', analytics.byHorizon],
                        ] as const).map(([title, groups]) => (
                            <div key={title} className="research-scrollbar overflow-x-auto">
                                <table className="w-full min-w-[340px] text-left text-xs">
                                    <caption className={'pb-2 text-left font-bold ' + styles.textSecondary}>{title}</caption>
                                    <thead><tr className={styles.textMuted}><th className="pb-2">Group</th><th className="pb-2 text-right">n</th><th className="pb-2 text-right">Effect</th><th className="pb-2 text-right">Vs benchmark</th></tr></thead>
                                    <tbody>{groups.map((group) => (
                                        <tr key={group.label} className={'border-t ' + styles.divider}>
                                            <th className={'py-2 font-semibold ' + styles.textSecondary}>{group.label} <span className={'block text-[10px] font-normal ' + styles.textMuted}>{group.evidenceLevel}</span></th>
                                            <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{group.sampleSize}</td>
                                            <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{percent(group.averageDecisionEffectPercent)}</td>
                                            <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{percent(group.averageRelativeReturnPercent)}</td>
                                        </tr>
                                    ))}</tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}
        </section>
    );
};
