'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    addPickerRun,
    createPickerRun,
    pickerCohortEvidence,
    pickerObservedMovePercent,
    removePickerRun,
    selectPickerCandidates,
    type PickerConfig,
    type PickerRun,
} from '@/lib/research/picker';
import { loadPickerRuns, savePickerRuns } from '@/lib/research/picker-client';
import type { DiscoveryResponse, QualityDiscoveryResult } from '@/lib/types/research-discovery';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { parseDiscoveryResponseV6 } from './research-discovery-response-v6';

const defaultConfig: PickerConfig = {
    horizon: '1M',
    riskProfile: 'balanced',
    minimumScore: 70,
    pickCount: 5,
};

const formatDateTime = (value: string) => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
}).format(new Date(value));

const signedPercent = (value: number | null) =>
    value === null ? 'Collecting' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const evidenceLabel = {
    collecting: 'Collecting evidence',
    limited: 'Limited evidence',
    observational: 'Observational history',
} as const;

export const ResearchPickerV6 = ({ theme, savedSymbols, adding, onAdd, onOpen }: {
    readonly theme: ResearchThemeV6;
    readonly savedSymbols: readonly string[];
    readonly adding: boolean;
    readonly onAdd: (candidate: QualityDiscoveryResult) => void;
    readonly onOpen: (symbol: string) => void;
}) => {
    const styles = getThemeV6(theme);
    const [config, setConfig] = useState<PickerConfig>(defaultConfig);
    const [data, setData] = useState<DiscoveryResponse | null>(null);
    const [runs, setRuns] = useState<readonly PickerRun[]>([]);
    const [status, setStatus] = useState<'setup' | 'loading' | 'ready' | 'error'>('setup');
    const [error, setError] = useState('');
    const [savedMessage, setSavedMessage] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => setRuns(loadPickerRuns()), 0);
        return () => window.clearTimeout(timer);
    }, []);

    const picks = useMemo(
        () => data ? selectPickerCandidates(data, config) : [],
        [config, data],
    );
    const cohort = useMemo(
        () => pickerCohortEvidence(data?.performance ?? [], config.horizon),
        [config.horizon, data],
    );
    const currentPrices = useMemo(() => new Map(
        data ? [...data.candidates, ...data.contenders].map((candidate) => [candidate.symbol, candidate.price]) : [],
    ), [data]);

    const persistRuns = (next: readonly PickerRun[]) => {
        setRuns(next);
        savePickerRuns(next);
    };

    const runPicker = async () => {
        setStatus('loading');
        setError('');
        setSavedMessage('');
        try {
            const response = await fetch('/api/research/discovery');
            if (!response.ok) throw new Error(`Picker scan failed with HTTP ${response.status}.`);
            setData(parseDiscoveryResponseV6(await response.json()));
            setStatus('ready');
        } catch (caught) {
            setStatus('error');
            setError(caught instanceof Error ? caught.message : 'Picker scan is unavailable.');
        }
    };

    const startBasket = () => {
        if (!data || picks.length === 0) return;
        const createdAt = new Date().toISOString();
        persistRuns(addPickerRun(runs, createPickerRun(createdAt, data.generatedAt, config, picks)));
        setSavedMessage(`Paper basket started with ${picks.length} candidate${picks.length === 1 ? '' : 's'}.`);
    };

    return (
        <section className="min-w-0 flex-1" aria-labelledby="research-picker-title">
            <header className={'border-b pb-4 ' + styles.divider}>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Automated research</p>
                <h1 id="research-picker-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Stock Picker</h1>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>
                    Configure one bounded US scan, rank current candidates with the existing Discovery model, and preserve a paper basket for later review.
                </p>
                <p className={'mt-2 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                    Scores describe current trend, quality, and risk evidence. Top-10 history is observational and is not a candidate-specific probability, price target, or buy recommendation.
                </p>
            </header>

            <div className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.55fr)]">
                <section data-testid="picker-setup" className={'rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="picker-setup-title">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Step 1</p>
                            <h2 id="picker-setup-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Set the selection rule</h2>
                        </div>
                        <span className={'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ' + styles.divider + ' ' + styles.textSecondary}>US universe</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Review horizon
                            <select aria-label="Picker review horizon" value={config.horizon} onChange={(event) => setConfig((current) => ({ ...current, horizon: event.target.value as PickerConfig['horizon'] }))} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}>
                                <option value="1D">1 day</option>
                                <option value="1W">1 week</option>
                                <option value="1M">1 month</option>
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Risk profile
                            <select aria-label="Picker risk profile" value={config.riskProfile} onChange={(event) => setConfig((current) => ({ ...current, riskProfile: event.target.value as PickerConfig['riskProfile'] }))} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}>
                                <option value="conservative">Conservative</option>
                                <option value="balanced">Balanced</option>
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Minimum score
                            <select aria-label="Picker minimum score" value={config.minimumScore} onChange={(event) => setConfig((current) => ({ ...current, minimumScore: Number(event.target.value) as PickerConfig['minimumScore'] }))} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}>
                                <option value="60">60</option>
                                <option value="70">70</option>
                                <option value="80">80</option>
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Number of picks
                            <select aria-label="Picker pick count" value={config.pickCount} onChange={(event) => setConfig((current) => ({ ...current, pickCount: Number(event.target.value) as PickerConfig['pickCount'] }))} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}>
                                <option value="3">3</option>
                                <option value="5">5</option>
                                <option value="10">10</option>
                            </select>
                        </label>
                    </div>
                    <button type="button" onClick={runPicker} disabled={status === 'loading'} className={'mt-4 min-h-10 rounded-md border px-4 text-sm font-bold disabled:opacity-50 ' + styles.panelAction}>
                        {status === 'loading' ? 'Scanning current data…' : data ? 'Run again with current data' : 'Run picker'}
                    </button>
                    {status === 'error' ? <div role="alert" className={'mt-3 rounded-md border p-3 text-sm ' + styles.risk + ' ' + styles.divider}>
                        <p>{error}</p>
                        <button type="button" onClick={runPicker} className="mt-2 min-h-10 text-xs font-bold underline">Retry scan</button>
                    </div> : null}
                </section>

                <aside className={'rounded-lg border p-4 ' + styles.panelUtility} aria-labelledby="picker-evidence-title">
                    <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Evidence boundary</p>
                    <h2 id="picker-evidence-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>{evidenceLabel[cohort.state]}</h2>
                    <dl className="mt-4 grid grid-cols-2 gap-3">
                        <div><dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Top-10 average</dt><dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{signedPercent(cohort.averageReturnPercent)}</dd></div>
                        <div><dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Positive periods</dt><dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{cohort.positiveRatePercent === null ? 'Collecting' : `${cohort.positiveRatePercent}%`}</dd></div>
                        <div><dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Tracked names</dt><dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{cohort.trackedCount}</dd></div>
                        <div><dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Horizon</dt><dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{config.horizon}</dd></div>
                    </dl>
                    <p className={'mt-3 text-xs leading-5 ' + styles.textMuted}>This cohort covers prior Top-10 candidates, not score-matched individual stocks. It excludes fees and is not an out-of-sample forecast.</p>
                </aside>
            </div>

            {status === 'ready' && data ? (
                <section data-testid="picker-results" className={'border-t pt-4 ' + styles.divider} aria-labelledby="picker-results-title">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Step 2</p>
                            <h2 id="picker-results-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Review current candidates</h2>
                            <p className={'mt-1 text-xs ' + styles.textMuted}>Scanned {data.scannedCount}/{data.universeSize} symbols · Generated {formatDateTime(data.generatedAt)}</p>
                        </div>
                        <button type="button" onClick={startBasket} disabled={picks.length === 0} className={'min-h-10 rounded-md border px-4 text-xs font-bold disabled:opacity-50 ' + styles.panelAction}>Start paper basket</button>
                    </div>
                    <p role="status" aria-live="polite" className={'mt-2 min-h-5 text-xs ' + styles.positive}>{savedMessage}</p>
                    {picks.length === 0 ? (
                        <div className={'mt-3 rounded-lg border p-5 ' + styles.panelSecondary}>
                            <p className={'text-sm font-bold ' + styles.textPrimary}>No candidates meet this rule</p>
                            <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Lower the minimum score or switch from Conservative to Balanced, then run the current scan again.</p>
                        </div>
                    ) : (
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                            {picks.map((candidate, index) => {
                                const saved = savedSymbols.includes(candidate.symbol);
                                return (
                                    <article key={candidate.symbol} className={'rounded-lg border p-4 ' + styles.row}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={'text-xs font-semibold uppercase ' + styles.textMuted}>#{index + 1} · {candidate.outlook}</p>
                                                <h3 className={'mt-1 truncate text-lg font-bold ' + styles.textPrimary}>{candidate.symbol} <span className={'text-sm font-normal ' + styles.textSecondary}>{candidate.name}</span></h3>
                                            </div>
                                            <div className="text-right">
                                                <p className={'font-mono text-2xl font-bold ' + styles.positive}>{candidate.discoveryScore}</p>
                                                <p className={'text-[10px] uppercase ' + styles.textMuted}>Discovery score</p>
                                            </div>
                                        </div>
                                        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Price</dt><dd className={'mt-1 font-mono text-sm font-semibold ' + styles.textPrimary}>${candidate.price.toFixed(2)}</dd></div>
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Trend</dt><dd className={'mt-1 font-mono text-sm font-semibold ' + styles.textPrimary}>{candidate.trendScore}</dd></div>
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Quality</dt><dd className={'mt-1 font-mono text-sm font-semibold ' + styles.textPrimary}>{candidate.qualityScore ?? 'Unconfirmed'}</dd></div>
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Risk</dt><dd className={'mt-1 text-sm font-semibold capitalize ' + styles.textPrimary}>{candidate.risk}</dd></div>
                                        </dl>
                                        <p className={'mt-3 text-xs leading-5 ' + styles.textSecondary}>{candidate.reasons[0] ?? candidate.qualityReasons[0] ?? 'Current score is based on the available trend, quality, and risk evidence.'}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button type="button" onClick={() => onOpen(candidate.symbol)} className={'min-h-10 rounded-md border px-3 text-xs font-bold ' + styles.row}>Open research</button>
                                            <button type="button" disabled={adding || saved} onClick={() => onAdd(candidate)} className={'min-h-10 rounded-md border px-3 text-xs font-bold disabled:opacity-50 ' + styles.panelAction}>{saved ? 'In watchlist' : 'Add to watchlist'}</button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                    {data.warnings.length > 0 ? <div className={'mt-3 rounded-md border p-3 text-xs leading-5 ' + styles.panelUtility + ' ' + styles.textMuted}>
                        {data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                    </div> : null}
                </section>
            ) : null}

            <section className={'mt-5 border-t pt-4 ' + styles.divider} aria-labelledby="picker-baskets-title">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Step 3</p>
                    <h2 id="picker-baskets-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Paper baskets</h2>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Browser-local snapshots preserve the selection rule and entry observations. Current moves appear only when the symbol remains in the latest bounded scan.</p>
                </div>
                {runs.length === 0 ? <p className={'mt-3 rounded-lg border p-4 text-sm ' + styles.panelSecondary + ' ' + styles.textMuted}>No paper basket started yet.</p> : (
                    <div className="mt-3 space-y-3">
                        {runs.map((run) => (
                            <details key={run.id} className={'rounded-lg border ' + styles.panelSecondary}>
                                <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                                    <span><span className={'block text-sm font-bold ' + styles.textPrimary}>{run.picks.length} picks · {run.config.horizon} · {run.config.riskProfile}</span><span className={'block text-xs ' + styles.textMuted}>{formatDateTime(run.createdAt)} · minimum score {run.config.minimumScore}</span></span>
                                    <span className={'text-xs font-semibold ' + styles.textSecondary}>Review basket</span>
                                </summary>
                                <div className={'border-t p-3 ' + styles.divider}>
                                    <div className="research-scrollbar overflow-x-auto">
                                        <table className="w-full min-w-[620px] text-left text-xs">
                                            <thead><tr className={styles.textMuted}><th className="px-2 py-2">Ticker</th><th className="px-2 py-2">Entry</th><th className="px-2 py-2">Score</th><th className="px-2 py-2">Current observed</th><th className="px-2 py-2">Move</th></tr></thead>
                                            <tbody className={'divide-y ' + styles.divider}>
                                                {run.picks.map((pick) => {
                                                    const currentPrice = currentPrices.get(pick.symbol) ?? null;
                                                    const move = pickerObservedMovePercent(pick.price, currentPrice);
                                                    return <tr key={pick.symbol}>
                                                        <td className="px-2 py-2"><button type="button" onClick={() => onOpen(pick.symbol)} className={'min-h-10 font-mono font-bold ' + styles.textPrimary}>{pick.symbol}</button></td>
                                                        <td className={'px-2 py-2 font-mono ' + styles.textSecondary}>${pick.price.toFixed(2)}</td>
                                                        <td className={'px-2 py-2 font-mono ' + styles.textSecondary}>{pick.discoveryScore}</td>
                                                        <td className={'px-2 py-2 font-mono ' + styles.textSecondary}>{currentPrice === null ? 'Run scan' : `$${currentPrice.toFixed(2)}`}</td>
                                                        <td className={'px-2 py-2 font-mono font-bold ' + (move === null ? styles.textMuted : move < 0 ? styles.risk : styles.positive)}>{move === null ? 'Unavailable' : `${move >= 0 ? '+' : ''}${move.toFixed(2)}%`}</td>
                                                    </tr>;
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button type="button" onClick={() => persistRuns(removePickerRun(runs, run.id))} className={'mt-3 min-h-10 text-xs font-semibold ' + styles.risk}>Remove basket</button>
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </section>
        </section>
    );
};
