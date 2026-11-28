'use client';

import { useContext, useEffect, useMemo, useState } from 'react';
import { V9Navigation } from '@/components/v9/v9-navigation';
import {
    addPickerRun,
    buildPickerCandidateBrief,
    buildPickerRejectionSummary,
    createPickerRun,
    explainPickerSelection,
    pickerCohortEvidence,
    pickerObservedMovePercent,
    pickerRunSummary,
    removePickerRun,
    resolvePickerRuns,
    type PickerConfig,
    type PickerRun,
} from '@/lib/research/picker';
import { loadPickerRuns, savePickerRuns } from '@/lib/research/picker-client';
import {
    addPickerPreset,
    loadPickerPresets,
    removePickerPreset,
    savePickerPresets,
    type PickerPreset,
} from '@/lib/research/picker-presets';
import { parseResearchQuoteBatchResponse } from '@/lib/research/snapshot-input';
import type { DiscoveryScan } from './ResearchDiscoverV8';
import { direction, ScanStatus, signedPercent } from './ResearchTrendingV8';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

const defaultConfig: PickerConfig = { horizon: '1M', riskProfile: 'balanced', minimumScore: 60, pickCount: 5, maximumPerSector: 2, excludeSavedSymbols: false };
const outcome = (value: number | null) => value === null ? 'Unavailable' : signedPercent(value);
const maxBatchQuotes = 50;

async function fetchUsQuoteBatch(symbols: readonly string[], signal?: AbortSignal): Promise<Map<string, number>> {
    const clean = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))].sort();
    const prices = new Map<string, number>();
    for (let start = 0; start < clean.length; start += maxBatchQuotes) {
        const chunk = clean.slice(start, start + maxBatchQuotes);
        const response = await fetch('/api/research/quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(chunk.map(symbol => ({ symbol, market: 'US' as const }))),
            signal,
        });
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error('Live quotes are temporarily unavailable.');
        for (const item of parseResearchQuoteBatchResponse(payload)) {
            if (item.success && typeof item.data.quote.price === 'number' && Number.isFinite(item.data.quote.price) && item.data.quote.price > 0) {
                prices.set(item.data.symbol.trim().toUpperCase(), item.data.quote.price);
            }
        }
    }
    return prices;
}

function Select<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
    return <label>{label}<select value={String(value)} onChange={event => { const next = options.find(([option]) => String(option) === event.target.value); if (next) onChange(next[0]); }}>{options.map(([option, text]) => <option key={String(option)} value={String(option)}>{text}</option>)}</select></label>;
}

// V8 Stock Picker: the existing picker rules applied to the shared Trend Discovery scan, with browser-local paper baskets measured against VOO.
export function ResearchPickerV8({
    scan,
    savedSymbols,
    onSelect,
    onSaveToWatchlist,
}: {
    scan: DiscoveryScan;
    savedSymbols: readonly string[];
    onSelect: (symbol: string) => void;
    onSaveToWatchlist?: (symbol: string, name: string) => Promise<{ ok: boolean; error?: string }>;
}) {
    const isV9 = Boolean(useContext(V9Navigation));
    const [config, setConfig] = useState<PickerConfig>(defaultConfig);
    const [runs, setRuns] = useState<readonly PickerRun[]>([]);
    const [presets, setPresets] = useState<readonly PickerPreset[]>([]);
    const [presetStatus, setPresetStatus] = useState<'ready' | 'invalid' | 'unavailable'>('ready');
    const [presetName, setPresetName] = useState('');
    const [presetMessage, setPresetMessage] = useState('');
    const [savingSymbol, setSavingSymbol] = useState<string | null>(null);
    const [rowSaveError, setRowSaveError] = useState('');
    const [prices, setPrices] = useState<ReadonlyMap<string, number>>(new Map());
    const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'partial'>('idle');
    const [starting, setStarting] = useState(false);
    const [message, setMessage] = useState('');
    const update = <K extends keyof PickerConfig>(key: K) => (value: PickerConfig[K]) => setConfig(current => ({ ...current, [key]: value }));

    const savedSet = useMemo(
        () => new Set(savedSymbols.map(symbol => symbol.trim().toUpperCase())),
        [savedSymbols],
    );

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setRuns(loadPickerRuns());
            if (isV9) {
                const loaded = loadPickerPresets();
                setPresets(loaded.presets);
                setPresetStatus(loaded.status);
                if (loaded.status !== 'ready') {
                    setPresetMessage(loaded.error);
                }
            }
        }, 0);
        return () => window.clearTimeout(timer);
    }, [isV9]);

    const trace = useMemo(() => scan.data ? explainPickerSelection(scan.data, config, { savedSymbols }) : null, [scan.data, config, savedSymbols]);
    const rejections = trace ? buildPickerRejectionSummary(trace) : [];
    const cohort = pickerCohortEvidence(scan.data?.performance ?? [], config.horizon);
    const basketSymbols = useMemo(() => [...new Set(runs.flatMap(run => [...run.picks.map(pick => pick.symbol), run.benchmark.symbol]))].sort().join('|'), [runs]);

    useEffect(() => {
        if (!basketSymbols) return;
        const controller = new AbortController();
        const symbols = basketSymbols.split('|');
        const timer = window.setTimeout(() => setQuoteState('loading'), 0);
        fetchUsQuoteBatch(symbols, controller.signal)
            .then(next => {
                if (controller.signal.aborted) return;
                setPrices(next);
                setQuoteState(next.size === symbols.length ? 'ready' : 'partial');
                setRuns(current => {
                    const resolved = resolvePickerRuns(current, next, new Date().toISOString());
                    if (JSON.stringify(resolved) === JSON.stringify(current)) return current;
                    savePickerRuns(resolved);
                    return resolved;
                });
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setPrices(new Map());
                setQuoteState('partial');
            });
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [basketSymbols]);

    function persist(next: readonly PickerRun[]) { setRuns(next); return savePickerRuns(next); }

    async function startBasket() {
        if (!scan.data || !trace?.selected.length) return;
        setStarting(true);
        const batch = await fetchUsQuoteBatch(['VOO']).catch(() => new Map<string, number>());
        const benchmarkEntryPrice = batch.get('VOO') ?? null;
        const saved = persist(addPickerRun(runs, createPickerRun(new Date().toISOString(), scan.data.generatedAt, config, trace.selected, { strategy: null, benchmarkEntryPrice })));
        setMessage(saved ? `Paper basket started with ${trace.selected.length} ${trace.selected.length === 1 ? 'stock' : 'stocks'}${benchmarkEntryPrice === null ? '; the VOO entry price was unavailable.' : ' and a VOO entry price.'}` : 'Paper basket kept for this session only; browser storage is unavailable.');
        setStarting(false);
    }

    function handleSavePreset() {
        try {
            const next = addPickerPreset(presets, presetName, config, new Date().toISOString());
            setPresets(next);
            setPresetName('');
            const stored = savePickerPresets(next);
            setPresetStatus(stored.ok ? 'ready' : 'unavailable');
            setPresetMessage(stored.ok ? 'Preset saved on this device.' : (stored.error ?? 'Preset kept for this session only.'));
        } catch (cause) {
            setPresetMessage(cause instanceof Error ? cause.message : 'Unable to save preset.');
        }
    }

    function handleDeletePreset(id: string) {
        const next = removePickerPreset(presets, id);
        setPresets(next);
        const stored = savePickerPresets(next);
        setPresetStatus(stored.ok ? 'ready' : 'unavailable');
        setPresetMessage(stored.ok ? 'Preset removed.' : (stored.error ?? 'Preset removed for this session only.'));
    }

    async function handleSaveCandidate(symbol: string, name: string) {
        if (!onSaveToWatchlist) return;
        setSavingSymbol(symbol);
        setRowSaveError('');
        const outcomeResult = await onSaveToWatchlist(symbol, name);
        setSavingSymbol(null);
        if (!outcomeResult.ok && outcomeResult.error) {
            setRowSaveError(outcomeResult.error);
        }
    }

    return <div className={styles.picker}>
        <p className={styles.meta}>Set a rule and the Picker builds a diversified shortlist from the current trend scan. Scores describe current trend, quality and risk evidence; they are not a probability, price target or buy recommendation.</p>
        <div className={styles.controls}>
            <Select label="Measure over" value={config.horizon} options={[['1D', '1 day'], ['1W', '1 week'], ['1M', '1 month']]} onChange={update('horizon')} />
            <Select label="Risk profile" value={config.riskProfile} options={[['conservative', 'Conservative'], ['balanced', 'Balanced']]} onChange={update('riskProfile')} />
            <Select label="Minimum score" value={config.minimumScore} options={[[60, '60'], [70, '70'], [80, '80']]} onChange={update('minimumScore')} />
            <Select label="Picks" value={config.pickCount} options={[[3, '3'], [5, '5'], [10, '10']]} onChange={update('pickCount')} />
            <Select label="Per sector" value={config.maximumPerSector} options={[[1, '1'], [2, '2'], [3, '3'], [10, 'No cap']]} onChange={update('maximumPerSector')} />
            <label className={styles.check}><input type="checkbox" checked={config.excludeSavedSymbols} onChange={event => update('excludeSavedSymbols')(event.target.checked)} />Skip saved securities</label>
        </div>
        {isV9 && (
            <section className={styles.presetBar} data-testid="picker-presets-bar" aria-label="Saved picker presets">
                <div className={styles.presetHead}>
                    <div>
                        <strong>Saved presets</strong>
                        <span className={styles.meta}> · Saved on this device</span>
                    </div>
                    <form className={styles.presetForm} onSubmit={event => { event.preventDefault(); handleSavePreset(); }}>
                        <label className={styles.srOnly} htmlFor="picker-preset-name">Preset name</label>
                        <input
                            id="picker-preset-name"
                            type="text"
                            maxLength={40}
                            placeholder="Preset name (e.g. Low risk 80+)"
                            value={presetName}
                            onChange={event => setPresetName(event.target.value)}
                        />
                        <button type="submit" className={styles.secondary} disabled={!presetName.trim()}>
                            Save preset
                        </button>
                    </form>
                </div>
                {presets.length > 0 && (
                    <div className={styles.presetList}>
                        {presets.map(preset => (
                            <div key={preset.id} className={styles.presetChip}>
                                <button
                                    type="button"
                                    className={styles.presetApply}
                                    onClick={() => { setConfig({ ...preset.config }); setPresetMessage(`Applied “${preset.name}”.`); }}
                                >
                                    {preset.name}
                                </button>
                                <button
                                    type="button"
                                    className={styles.presetRemove}
                                    aria-label={`Delete preset ${preset.name}`}
                                    onClick={() => handleDeletePreset(preset.id)}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                {presetMessage && (
                    <p role={presetStatus === 'invalid' ? 'alert' : 'status'} className={styles.meta}>{presetMessage}</p>
                )}
            </section>
        )}
        {!scan.data || !trace ? <ScanStatus scan={scan} /> : <section aria-label="Picker shortlist">
            <div className={styles.resultHead}>
                <p className={styles.meta}>{trace.selected.length} of {trace.counts.scanned} scanned stocks selected · scan {retrievedAt(scan.data.generatedAt)}</p>
                <button className={styles.primary} disabled={!trace.selected.length || starting} onClick={() => void startBasket()}>{starting ? 'Capturing entry prices…' : 'Start paper basket'}</button>
            </div>
            <p role="status" className={styles.meta}>{message}</p>
            {rowSaveError && <p role="alert" className={styles.meta}>{rowSaveError}</p>}
            {trace.selected.length === 0 ? <p>No stocks meet this rule. Lower the minimum score, switch to Balanced, raise the sector cap, or include saved securities.</p>
                : <ol className={styles.picks}>{trace.selected.map((pick, index) => {
                    const brief = buildPickerCandidateBrief(pick);
                    const isSaved = savedSet.has(pick.symbol.trim().toUpperCase());
                    const rowButton = (
                        <button type="button" onClick={() => onSelect(pick.symbol)} aria-label={`Read ${pick.symbol}, ${pick.name}`}>
                            <span className={styles.rank}>{index + 1}</span>
                            <span className={styles.name}>
                                <span className={styles.titleLine}>
                                    <b>{pick.symbol}</b>
                                    {isV9 && isSaved && <span className={styles.savedBadge} data-testid="picker-saved-badge">Saved</span>}
                                </span>
                                <small>{pick.name} · {pick.sector}</small>
                            </span>
                            <span className={styles.score}><b>{pick.discoveryScore}</b><small>{pick.outlook}</small></span>
                            <span className={styles.move} data-direction={direction(pick.momentum3MonthPercent)}><small>3M </small>{signedPercent(pick.momentum3MonthPercent)}</span>
                            <span className={styles.brief}><span>{brief.support}</span><small>{brief.riskOrUnknown} · evidence {brief.evidenceStatus}</small></span>
                        </button>
                    );

                    if (!isV9) {
                        return <li key={pick.symbol}>{rowButton}</li>;
                    }

                    return (
                        <li key={pick.symbol} className={styles.pickerRowWrap}>
                            {rowButton}
                            <div className={styles.rowActions}>
                                <button
                                    type="button"
                                    className={styles.rowActionLink}
                                    onClick={() => onSelect(pick.symbol)}
                                >
                                    Open in Research
                                </button>
                                {onSaveToWatchlist && (
                                    <button
                                        type="button"
                                        className={styles.rowActionSave}
                                        disabled={isSaved || savingSymbol === pick.symbol}
                                        onClick={() => void handleSaveCandidate(pick.symbol, pick.name)}
                                    >
                                        {isSaved ? 'Saved ✓' : savingSymbol === pick.symbol ? 'Saving…' : 'Save to Watchlist'}
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}</ol>}
            {rejections.length > 0 && <details className={styles.small}><summary>Why other stocks were left out</summary><ul>{rejections.map(item => <li key={item.code}><b>{item.label}</b> · {item.count}{item.exampleSymbols.length ? ` (${item.exampleSymbols.join(', ')})` : ''}</li>)}</ul></details>}
            <p className={styles.meta}>Past Top-10 cohort over {config.horizon}: {cohort.averageReturnPercent === null ? 'still collecting' : `${signedPercent(cohort.averageReturnPercent)} average, ${cohort.positiveRatePercent ?? '—'}% positive across ${cohort.trackedCount} names`}. Observational history, excludes fees, not a forecast.</p>
        </section>}
        <section aria-label="Paper baskets" className={styles.baskets}>
            <h3>Paper baskets</h3>
            <p className={styles.meta}>Saved in this browser. Each basket records entry prices and is measured against VOO at the chosen horizon.{quoteState === 'loading' ? ' Refreshing prices…' : quoteState === 'partial' ? ' Some prices are unavailable right now.' : ''}</p>
            {runs.length === 0 ? <p className={styles.meta}>No paper basket yet.</p> : runs.map(run => {
                const summary = pickerRunSummary(run, prices, new Date().toISOString());
                const state = summary.state === 'resolved' ? 'Resolved' : summary.state === 'partial' ? 'Partly resolved' : summary.state === 'due' ? 'Outcome due' : `Measures ${retrievedAt(summary.dueAt)}`;
                return <details key={run.id} className={styles.basket}>
                    <summary><span><b>{run.picks.length} {run.picks.length === 1 ? 'pick' : 'picks'} ·{run.config.horizon} · {run.config.riskProfile}</b><small>Started {retrievedAt(run.createdAt)} · {state}</small></span><span className={styles.move} data-direction={summary.averageReturnPercent === null ? 'flat' : direction(summary.averageReturnPercent)}>{outcome(summary.averageReturnPercent)}</span></summary>
                    <p className={styles.meta}>VOO {outcome(summary.benchmarkReturnPercent)} · relative {outcome(summary.relativeReturnPercent)} · positive names {summary.positiveRatePercent === null ? '—' : `${summary.positiveRatePercent}%`}</p>
                    <ul className={styles.basketRows}>{run.picks.map(pick => {
                        const observed = pick.outcome?.price ?? prices.get(pick.symbol) ?? null;
                        const move = pickerObservedMovePercent(pick.price, observed);
                        return <li key={pick.symbol}><button className={styles.link} onClick={() => onSelect(pick.symbol)}>{pick.symbol}</button><span>${pick.price.toFixed(2)} → {observed === null ? '—' : `$${observed.toFixed(2)}`}</span><span className={styles.move} data-direction={move === null ? 'flat' : direction(move)}>{outcome(move)}</span></li>;
                    })}</ul>
                    <button className={styles.secondary} onClick={() => persist(removePickerRun(runs, run.id))}>Remove basket</button>
                </details>;
            })}
        </section>
    </div>;
}
