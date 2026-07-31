'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    addPickerRun,
    createPickerRun,
    explainPickerSelection,
    pickerCohortEvidence,
    pickerObservedMovePercent,
    pickerRunSummary,
    removePickerRun,
    resolvePickerRuns,
    type PickerConfig,
    type PickerRun,
    type PickerStrategySnapshot,
} from '@/lib/research/picker';
import { loadPickerRuns, savePickerRuns } from '@/lib/research/picker-client';
import {
    DISCOVERY_UNIVERSES_STORAGE_KEY,
    parseSavedDiscoveryUniverses,
    type SavedDiscoveryUniverse,
} from '@/lib/research/discovery-policy';
import { parseResearchQuoteResponse } from '@/lib/research/snapshot-input';
import type { DiscoveryResponse, QualityDiscoveryResult } from '@/lib/types/research-discovery';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { parseDiscoveryResponseV6 } from './research-discovery-response-v6';
import { ResearchSelectionJourneyV6 } from './ResearchSelectionJourneyV6';
import { ResearchShortlistBriefV6 } from './ResearchShortlistBriefV6';

const defaultConfig: PickerConfig = {
    horizon: '1M',
    riskProfile: 'balanced',
    minimumScore: 70,
    pickCount: 5,
    maximumPerSector: 2,
    excludeSavedSymbols: false,
};

const formatDateTime = (value: string) => new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
}).format(new Date(value));

const signedPercent = (value: number | null) =>
    value === null ? 'Collecting' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const outcomePercent = (value: number | null) =>
    value === null ? 'Unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

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
    const [savedStrategies, setSavedStrategies] = useState<readonly SavedDiscoveryUniverse[]>([]);
    const [selectedStrategyId, setSelectedStrategyId] = useState('default');
    const [basketPrices, setBasketPrices] = useState<ReadonlyMap<string, number>>(new Map());
    const [basketQuoteState, setBasketQuoteState] = useState<'idle' | 'loading' | 'ready' | 'partial'>('idle');
    const [startingBasket, setStartingBasket] = useState(false);
    const [status, setStatus] = useState<'setup' | 'loading' | 'ready' | 'error'>('setup');
    const [error, setError] = useState('');
    const [savedMessage, setSavedMessage] = useState('');

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setRuns(loadPickerRuns());
            try {
                const stored = localStorage.getItem(DISCOVERY_UNIVERSES_STORAGE_KEY);
                setSavedStrategies(stored ? parseSavedDiscoveryUniverses(JSON.parse(stored) as unknown) : []);
            } catch {
                setSavedStrategies([]);
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    const activeStrategy = useMemo(
        () => savedStrategies.find((strategy) => strategy.id === selectedStrategyId) ?? null,
        [savedStrategies, selectedStrategyId],
    );
    const selectionTrace = useMemo(
        () => data ? explainPickerSelection(data, config, {
            policy: activeStrategy?.policy,
            savedSymbols,
        }) : null,
        [activeStrategy?.policy, config, data, savedSymbols],
    );
    const picks = selectionTrace?.selected ?? [];
    const basketAvailable = useMemo(
        () => data !== null && runs.some((run) => run.discoveryGeneratedAt === data.generatedAt
            && JSON.stringify(run.config) === JSON.stringify(config)
            && (run.strategy?.id ?? 'default') === selectedStrategyId),
        [config, data, runs, selectedStrategyId],
    );
    const cohort = useMemo(
        () => pickerCohortEvidence(data?.performance ?? [], config.horizon),
        [config.horizon, data],
    );
    const basketTargetKey = useMemo(
        () => [...new Set(runs.flatMap((run) => [...run.picks.map((pick) => pick.symbol), run.benchmark.symbol]))].sort().join('|'),
        [runs],
    );

    const persistRuns = (next: readonly PickerRun[]) => {
        setRuns(next);
        return savePickerRuns(next);
    };

    useEffect(() => {
        const symbols = basketTargetKey ? basketTargetKey.split('|') : [];
        if (symbols.length === 0) {
            setBasketQuoteState('idle');
            return;
        }
        const controller = new AbortController();
        setBasketQuoteState('loading');
        const load = async () => {
            const results = await Promise.allSettled(symbols.map(async (symbol) => {
                const response = await fetch(`/api/research/quote/${encodeURIComponent(symbol)}?market=US`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(`Quote unavailable for ${symbol}.`);
                const quote = parseResearchQuoteResponse(payload);
                if (quote.price === null || quote.price <= 0) throw new Error(`Quote unavailable for ${symbol}.`);
                return { symbol, price: quote.price };
            }));
            if (controller.signal.aborted) return;
            const observedAt = new Date().toISOString();
            const prices = new Map<string, number>();
            for (const result of results) {
                if (result.status === 'fulfilled') prices.set(result.value.symbol, result.value.price);
            }
            setBasketPrices(prices);
            setBasketQuoteState(prices.size === symbols.length ? 'ready' : 'partial');
            setRuns((current) => {
                const resolved = resolvePickerRuns(current, prices, observedAt);
                if (JSON.stringify(resolved) === JSON.stringify(current)) return current;
                savePickerRuns(resolved);
                return resolved;
            });
        };
        void load();
        return () => controller.abort();
    }, [basketTargetKey]);

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

    const startBasket = async () => {
        if (!data || picks.length === 0) return;
        setStartingBasket(true);
        let benchmarkEntryPrice: number | null = null;
        try {
            const response = await fetch('/api/research/quote/VOO?market=US');
            const payload: unknown = await response.json();
            if (response.ok) benchmarkEntryPrice = parseResearchQuoteResponse(payload).price;
        } catch {
            benchmarkEntryPrice = null;
        }
        const createdAt = new Date().toISOString();
        const strategy: PickerStrategySnapshot | null = activeStrategy ? {
            id: activeStrategy.id,
            name: activeStrategy.name,
            policy: activeStrategy.policy,
        } : null;
        const persisted = persistRuns(addPickerRun(runs, createPickerRun(
            createdAt,
            data.generatedAt,
            config,
            picks,
            { strategy, benchmarkEntryPrice },
        )));
        setSavedMessage(persisted
            ? `Paper basket started with ${picks.length} candidate${picks.length === 1 ? '' : 's'}${benchmarkEntryPrice === null ? '; VOO entry was unavailable.' : ' and a VOO observation.'}`
            : 'Paper basket is available for this session, but browser storage is unavailable.');
        setStartingBasket(false);
    };

    return (
        <section className="min-w-0 flex-1" aria-labelledby="research-picker-title">
            <header className={'border-b pb-4 ' + styles.divider}>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Automated research</p>
                <h1 id="research-picker-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Stock Picker</h1>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>
                    Apply a saved Discovery strategy, build a diversified bounded US shortlist, and measure a paper basket against VOO.
                </p>
                <p className={'mt-2 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                    Scores describe current trend, quality, and risk evidence. Top-10 history is observational and is not a candidate-specific probability, price target, or buy recommendation.
                </p>
            </header>

            <ResearchSelectionJourneyV6
                theme={theme}
                runStatus={status}
                trace={selectionTrace}
                basketAvailable={basketAvailable}
            />

            <div className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.55fr)]">
                <section data-testid="picker-setup" className={'rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="picker-setup-title">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Selection rule</p>
                            <h2 id="picker-setup-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Set the selection rule</h2>
                        </div>
                        <span className={'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ' + styles.divider + ' ' + styles.textSecondary}>US universe</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Saved Discovery strategy
                            <select aria-label="Picker saved strategy" value={selectedStrategyId} onChange={(event) => setSelectedStrategyId(event.target.value)} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}>
                                <option value="default">Default Discovery rank</option>
                                {savedStrategies.map((strategy) => <option key={strategy.id} value={strategy.id}>{strategy.name}</option>)}
                            </select>
                        </label>
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Measurement horizon
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
                        <label className={'text-xs font-semibold ' + styles.textMuted}>Maximum per sector
                            <select aria-label="Picker maximum per sector" value={config.maximumPerSector} onChange={(event) => setConfig((current) => ({ ...current, maximumPerSector: Number(event.target.value) as PickerConfig['maximumPerSector'] }))} className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}>
                                <option value="1">1 per sector</option>
                                <option value="2">2 per sector</option>
                                <option value="3">3 per sector</option>
                                <option value="10">No practical cap</option>
                            </select>
                        </label>
                    </div>
                    <label className={'mt-3 flex min-h-10 items-center gap-2 text-xs font-semibold ' + styles.textSecondary}>
                        <input type="checkbox" checked={config.excludeSavedSymbols} onChange={(event) => setConfig((current) => ({ ...current, excludeSavedSymbols: event.target.checked }))} />
                        Exclude symbols already in the Research watchlist
                    </label>
                    <details data-testid="picker-methodology" className={'group mt-2 rounded-md border ' + styles.divider}>
                        <summary className={'flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 [&::-webkit-details-marker]:hidden ' + styles.textSecondary}>
                            <span>How this selection rule works</span>
                            <span aria-hidden="true" className={'text-base transition-transform group-open:rotate-45 ' + styles.textMuted}>+</span>
                        </summary>
                        <p className={'border-t px-3 py-3 text-xs leading-5 ' + styles.divider + ' ' + styles.textMuted}>
                            {activeStrategy
                                ? `${activeStrategy.name} reuses its saved sector, liquidity, risk, valuation, and ranking preferences. Every adjustment remains visible.`
                                : 'The default strategy preserves the existing Discovery score order; basket constraints do not create another score.'}
                        </p>
                    </details>
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

            {status === 'ready' && data && selectionTrace ? (
                <section data-testid="picker-results" className={'border-t pt-4 ' + styles.divider} aria-labelledby="picker-results-title">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Current shortlist</p>
                            <h2 id="picker-results-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Review current candidates</h2>
                            <p className={'mt-1 text-xs ' + styles.textMuted}>Scanned {data.scannedCount}/{data.universeSize} symbols · Generated {formatDateTime(data.generatedAt)}</p>
                        </div>
                        <button type="button" onClick={() => void startBasket()} disabled={picks.length === 0 || startingBasket} className={'min-h-10 rounded-md border px-4 text-xs font-bold disabled:opacity-50 ' + styles.panelAction}>{startingBasket ? 'Capturing entries…' : 'Start paper basket'}</button>
                    </div>
                    <p role="status" aria-live="polite" className={'mt-2 min-h-5 text-xs ' + styles.positive}>{savedMessage}</p>
                    {picks.length === 0 ? (
                        <div className={'mt-3 rounded-lg border p-5 ' + styles.panelSecondary}>
                            <p className={'text-sm font-bold ' + styles.textPrimary}>No candidates meet this rule</p>
                            <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Relax the minimum score, risk profile, saved strategy, sector cap, or existing-watchlist exclusion.</p>
                        </div>
                    ) : (
                        <ResearchShortlistBriefV6
                            theme={theme}
                            candidates={picks}
                            trace={selectionTrace}
                            savedSymbols={savedSymbols}
                            adding={adding}
                            onAdd={onAdd}
                            onOpen={onOpen}
                        />
                    )}
                    {data.warnings.length > 0 ? <div className={'mt-3 rounded-md border p-3 text-xs leading-5 ' + styles.panelUtility + ' ' + styles.textMuted}>
                        {data.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                    </div> : null}
                </section>
            ) : null}

            <section className={'mt-5 border-t pt-4 ' + styles.divider} aria-labelledby="picker-baskets-title">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Measurement</p>
                    <h2 id="picker-baskets-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Paper baskets</h2>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Browser-local snapshots preserve the strategy and entry observations. Every saved symbol refreshes independently; due outcomes are frozen at the first available observation on or after the selected horizon.</p>
                    {basketQuoteState === 'loading' ? <p role="status" className={'mt-2 text-xs ' + styles.textMuted}>Refreshing saved basket quotes…</p> : null}
                    {basketQuoteState === 'partial' ? <p role="status" className={'mt-2 text-xs ' + styles.risk}>Some basket quotes are unavailable; available symbols remain usable.</p> : null}
                </div>
                {runs.length === 0 ? <p className={'mt-3 rounded-lg border p-4 text-sm ' + styles.panelSecondary + ' ' + styles.textMuted}>No paper basket started yet.</p> : (
                    <div className="mt-3 space-y-3">
                        {runs.map((run) => {
                            const summary = pickerRunSummary(run, basketPrices, new Date().toISOString());
                            const stateLabel = summary.state === 'resolved' ? 'Resolved'
                                : summary.state === 'partial' ? 'Partially resolved'
                                    : summary.state === 'due' ? 'Outcome due'
                                        : `Measures ${formatDateTime(summary.dueAt)}`;
                            return (
                                <details key={run.id} className={'rounded-lg border ' + styles.panelSecondary}>
                                    <summary className="flex min-h-12 cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                                        <span><span className={'block text-sm font-bold ' + styles.textPrimary}>{run.picks.length} picks · {run.config.horizon} · {run.config.riskProfile}</span><span className={'block text-xs ' + styles.textMuted}>{formatDateTime(run.createdAt)} · {run.strategy?.name ?? 'Default Discovery rank'} · minimum score {run.config.minimumScore}</span></span>
                                        <span className={'text-right text-xs font-semibold ' + styles.textSecondary}>{stateLabel}<span className={'mt-1 block font-mono ' + styles.textPrimary}>{outcomePercent(summary.averageReturnPercent)}</span></span>
                                    </summary>
                                    <div className={'border-t p-3 ' + styles.divider}>
                                        <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Basket average</dt><dd className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{outcomePercent(summary.averageReturnPercent)}</dd></div>
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Positive names</dt><dd className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{summary.positiveRatePercent === null ? 'Unavailable' : `${summary.positiveRatePercent}%`}</dd></div>
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>VOO observation</dt><dd className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{outcomePercent(summary.benchmarkReturnPercent)}</dd></div>
                                            <div><dt className={'text-[10px] uppercase ' + styles.textMuted}>Relative to VOO</dt><dd className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{outcomePercent(summary.relativeReturnPercent)}</dd></div>
                                        </dl>
                                        <div className="research-scrollbar overflow-x-auto">
                                            <table className="w-full min-w-[720px] text-left text-xs">
                                                <thead><tr className={styles.textMuted}><th className="px-2 py-2">Ticker</th><th className="px-2 py-2">Sector</th><th className="px-2 py-2">Entry</th><th className="px-2 py-2">Score</th><th className="px-2 py-2">{summary.state === 'collecting' ? 'Current observed' : 'Horizon observed'}</th><th className="px-2 py-2">Move</th></tr></thead>
                                                <tbody className={'divide-y ' + styles.divider}>
                                                    {run.picks.map((pick) => {
                                                        const observedPrice = pick.outcome?.price ?? basketPrices.get(pick.symbol) ?? null;
                                                        const move = pickerObservedMovePercent(pick.price, observedPrice);
                                                        return <tr key={pick.symbol}>
                                                            <td className="px-2 py-2"><button type="button" onClick={() => onOpen(pick.symbol)} className={'min-h-10 font-mono font-bold ' + styles.textPrimary}>{pick.symbol}</button></td>
                                                            <td className={'px-2 py-2 ' + styles.textSecondary}>{pick.sector}</td>
                                                            <td className={'px-2 py-2 font-mono ' + styles.textSecondary}>${pick.price.toFixed(2)}</td>
                                                            <td className={'px-2 py-2 font-mono ' + styles.textSecondary}>{pick.discoveryScore}</td>
                                                            <td className={'px-2 py-2 font-mono ' + styles.textSecondary}>{observedPrice === null ? 'Unavailable' : `$${observedPrice.toFixed(2)}`}</td>
                                                            <td className={'px-2 py-2 font-mono font-bold ' + (move === null ? styles.textMuted : move < 0 ? styles.risk : styles.positive)}>{move === null ? 'Unavailable' : `${move >= 0 ? '+' : ''}${move.toFixed(2)}%`}</td>
                                                        </tr>;
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <button type="button" onClick={() => persistRuns(removePickerRun(runs, run.id))} className={'mt-3 min-h-10 text-xs font-semibold ' + styles.risk}>Remove basket</button>
                                    </div>
                                </details>
                            );
                        })}
                    </div>
                )}
            </section>
        </section>
    );
};
