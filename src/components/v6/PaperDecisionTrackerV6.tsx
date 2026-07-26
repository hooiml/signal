'use client';

import { useEffect, useState } from 'react';
import {
    addPaperDecision,
    paperDecisionMarketMovePercent,
    removePaperDecision,
    resolvePaperDecision,
    type PaperDecision,
    type PaperDecisionAction,
} from '@/lib/research/paper-decisions';
import { loadPaperDecisions, savePaperDecisions } from '@/lib/research/paper-decisions-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
}).format(new Date(value));

export const PaperDecisionTrackerV6 = ({ records, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const [decisions, setDecisions] = useState<readonly PaperDecision[]>([]);
    const [symbol, setSymbol] = useState(records[0]?.symbol ?? '');
    const [action, setAction] = useState<PaperDecisionAction>('act');
    const [price, setPrice] = useState('');
    const [note, setNote] = useState('');
    const styles = getThemeV6(theme);
    const selectedRecord = records.find((record) => record.symbol === symbol) ?? records[0];

    useEffect(() => {
        const timer = window.setTimeout(() => setDecisions(loadPaperDecisions()), 0);
        return () => window.clearTimeout(timer);
    }, []);

    const persist = (next: readonly PaperDecision[]) => {
        setDecisions(next);
        savePaperDecisions(next);
    };

    const add = () => {
        const decisionPrice = Number(price);
        if (!selectedRecord || !Number.isFinite(decisionPrice) || decisionPrice <= 0) return;
        const recordedAt = new Date().toISOString();
        persist(addPaperDecision(decisions, {
            id: `${selectedRecord.symbol}:${recordedAt}`,
            symbol: selectedRecord.symbol,
            market: selectedRecord.market,
            action,
            decisionPrice,
            note,
            recordedAt,
            outcomePrice: null,
            resolvedAt: null,
        }));
        setPrice('');
        setNote('');
    };

    return (
        <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="paper-decisions-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="paper-decisions-title" className={'text-sm font-bold ' + styles.textPrimary}>Paper decision tracker</h2>
                    <p className={'mt-1 max-w-2xl text-xs leading-5 ' + styles.textMuted}>Record a hypothetical act-or-pass decision, then resolve it with a later observed price. This browser-local journal is not a brokerage account, position ledger, or return calculation.</p>
                </div>
                {records.length > 0 ? (
                    <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[7rem_7rem_8rem_minmax(10rem,1fr)_auto]">
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
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Observed price
                            <input aria-label="Paper decision price" type="number" min="0.0001" step="any" value={price} onChange={(event) => setPrice(event.target.value)} className={'mt-1 min-h-10 w-full rounded-md border px-3 font-mono ' + styles.panelSolid} />
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Short rationale
                            <input aria-label="Paper decision rationale" maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid} />
                        </label>
                        <button type="button" disabled={!selectedRecord || !(Number(price) > 0)} onClick={add} className={'min-h-10 rounded-md border px-4 text-xs font-bold disabled:opacity-50 ' + styles.panelAction}>Record</button>
                    </div>
                ) : null}
            </div>
            {decisions.length === 0 ? <p className={'mt-4 text-xs ' + styles.textMuted}>No paper decisions recorded.</p> : (
                <ul className={'mt-3 divide-y ' + styles.divider}>
                    {decisions.map((decision) => {
                        const move = paperDecisionMarketMovePercent(decision);
                        return (
                            <li key={decision.id} className="grid gap-3 py-3 lg:grid-cols-[7rem_minmax(0,1fr)_10rem_auto] lg:items-center">
                                <button type="button" onClick={() => onOpen(decision.symbol)} className={'min-h-10 text-left font-mono text-sm font-bold ' + styles.textPrimary}>{decision.symbol}</button>
                                <div>
                                    <p className={'text-sm font-semibold ' + styles.textSecondary}>{decision.action === 'act' ? 'Acted on paper' : 'Passed on paper'} at {decision.decisionPrice.toFixed(2)} · {formatDate(decision.recordedAt)}</p>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{decision.note || 'No rationale recorded.'}</p>
                                </div>
                                {decision.outcomePrice === null ? (
                                    <form className="flex items-end gap-2" onSubmit={(event) => {
                                        event.preventDefault();
                                        const form = new FormData(event.currentTarget);
                                        const outcomePrice = Number(form.get('outcomePrice'));
                                        if (Number.isFinite(outcomePrice) && outcomePrice > 0) persist(resolvePaperDecision(decisions, decision.id, outcomePrice, new Date().toISOString()));
                                    }}>
                                        <label className={'text-xs font-semibold ' + styles.textMuted}>Later price
                                            <input aria-label={`Later price for ${decision.symbol}`} name="outcomePrice" type="number" min="0.0001" step="any" className={'mt-1 min-h-10 w-24 rounded-md border px-2 font-mono ' + styles.panelSolid} />
                                        </label>
                                        <button type="submit" className={'min-h-10 rounded-md border px-3 text-xs font-bold ' + styles.row}>Resolve</button>
                                    </form>
                                ) : (
                                    <div className={'font-mono text-xs font-bold ' + (move !== null && move < 0 ? styles.risk : styles.positive)}>
                                        {move === null ? 'Unresolved' : `${move >= 0 ? '+' : ''}${move.toFixed(2)}% market move`}
                                    </div>
                                )}
                                <button type="button" aria-label={`Remove paper decision ${decision.symbol} ${decision.recordedAt}`} onClick={() => persist(removePaperDecision(decisions, decision.id))} className={'min-h-10 px-2 text-xs font-semibold ' + styles.risk}>Remove</button>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
