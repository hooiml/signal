'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { parseResearchQuoteResponse } from '@/lib/research/snapshot-input';
import type { DiscoveryScan } from './ResearchDiscoverV8';
import { direction, ScanStatus, signedPercent } from './ResearchTrendingV8';
import { retrievedAt } from './research-v8-connected-data';
import styles from './research-discover-v8.module.css';

const defaultConfig: PickerConfig = { horizon: '1M', riskProfile: 'balanced', minimumScore: 60, pickCount: 5, maximumPerSector: 2, excludeSavedSymbols: false };
const outcome = (value: number | null) => value === null ? 'Unavailable' : signedPercent(value);

async function readUsPrice(symbol: string, signal?: AbortSignal): Promise<number> {
    const response = await fetch(`/api/research/quote/${encodeURIComponent(symbol)}?market=US`, { signal });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(`Quote unavailable for ${symbol}.`);
    const price = parseResearchQuoteResponse(payload).price;
    if (price === null || price <= 0) throw new Error(`Quote unavailable for ${symbol}.`);
    return price;
}

function Select<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
    return <label>{label}<select value={String(value)} onChange={event => { const next = options.find(([option]) => String(option) === event.target.value); if (next) onChange(next[0]); }}>{options.map(([option, text]) => <option key={String(option)} value={String(option)}>{text}</option>)}</select></label>;
}

// V8 Stock Picker: the existing picker rules applied to the shared Trend Discovery scan, with browser-local paper baskets measured against VOO.
export function ResearchPickerV8({ scan, savedSymbols, onSelect }: { scan: DiscoveryScan; savedSymbols: readonly string[]; onSelect: (symbol: string) => void }) {
    const [config, setConfig] = useState<PickerConfig>(defaultConfig);
    const [runs, setRuns] = useState<readonly PickerRun[]>([]);
    const [prices, setPrices] = useState<ReadonlyMap<string, number>>(new Map());
    const [quoteState, setQuoteState] = useState<'idle' | 'loading' | 'ready' | 'partial'>('idle');
    const [starting, setStarting] = useState(false);
    const [message, setMessage] = useState('');
    const update = <K extends keyof PickerConfig>(key: K) => (value: PickerConfig[K]) => setConfig(current => ({ ...current, [key]: value }));
    useEffect(() => {
        const timer = window.setTimeout(() => setRuns(loadPickerRuns()), 0);
        return () => window.clearTimeout(timer);
    }, []);
    const trace = useMemo(() => scan.data ? explainPickerSelection(scan.data, config, { savedSymbols }) : null, [scan.data, config, savedSymbols]);
    const rejections = trace ? buildPickerRejectionSummary(trace) : [];
    const cohort = pickerCohortEvidence(scan.data?.performance ?? [], config.horizon);
    const basketSymbols = useMemo(() => [...new Set(runs.flatMap(run => [...run.picks.map(pick => pick.symbol), run.benchmark.symbol]))].sort().join('|'), [runs]);
    useEffect(() => {
        if (!basketSymbols) return;
        const controller = new AbortController();
        const symbols = basketSymbols.split('|');
        const timer = window.setTimeout(() => setQuoteState('loading'), 0);
        Promise.allSettled(symbols.map(async symbol => ({ symbol, price: await readUsPrice(symbol, controller.signal) }))).then(results => {
            if (controller.signal.aborted) return;
            const next = new Map(results.flatMap(result => result.status === 'fulfilled' ? [[result.value.symbol, result.value.price] as const] : []));
            setPrices(next);
            setQuoteState(next.size === symbols.length ? 'ready' : 'partial');
            setRuns(current => {
                const resolved = resolvePickerRuns(current, next, new Date().toISOString());
                if (JSON.stringify(resolved) === JSON.stringify(current)) return current;
                savePickerRuns(resolved);
                return resolved;
            });
        });
        return () => { window.clearTimeout(timer); controller.abort(); };
    }, [basketSymbols]);
    function persist(next: readonly PickerRun[]) { setRuns(next); return savePickerRuns(next); }
    async function startBasket() {
        if (!scan.data || !trace?.selected.length) return;
        setStarting(true);
        const benchmarkEntryPrice = await readUsPrice('VOO').catch(() => null);
        const saved = persist(addPickerRun(runs, createPickerRun(new Date().toISOString(), scan.data.generatedAt, config, trace.selected, { strategy: null, benchmarkEntryPrice })));
        setMessage(saved ? `Paper basket started with ${trace.selected.length} ${trace.selected.length === 1 ? 'stock' : 'stocks'}${benchmarkEntryPrice === null ? '; the VOO entry price was unavailable.' : ' and a VOO entry price.'}` : 'Paper basket kept for this session only; browser storage is unavailable.');
        setStarting(false);
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
        {!scan.data || !trace ? <ScanStatus scan={scan} /> : <section aria-label="Picker shortlist">
            <div className={styles.resultHead}>
                <p className={styles.meta}>{trace.selected.length} of {trace.counts.scanned} scanned stocks selected · scan {retrievedAt(scan.data.generatedAt)}</p>
                <button className={styles.primary} disabled={!trace.selected.length || starting} onClick={() => void startBasket()}>{starting ? 'Capturing entry prices…' : 'Start paper basket'}</button>
            </div>
            <p role="status" className={styles.meta}>{message}</p>
            {trace.selected.length === 0 ? <p>No stocks meet this rule. Lower the minimum score, switch to Balanced, raise the sector cap, or include saved securities.</p>
                : <ol className={styles.picks}>{trace.selected.map((pick, index) => {
                    const brief = buildPickerCandidateBrief(pick);
                    return <li key={pick.symbol}><button onClick={() => onSelect(pick.symbol)} aria-label={`Read ${pick.symbol}, ${pick.name}`}>
                        <span className={styles.rank}>{index + 1}</span>
                        <span className={styles.name}><b>{pick.symbol}</b><small>{pick.name} · {pick.sector}</small></span>
                        <span className={styles.score}><b>{pick.discoveryScore}</b><small>{pick.outlook}</small></span>
                        <span className={styles.move} data-direction={direction(pick.momentum3MonthPercent)}><small>3M </small>{signedPercent(pick.momentum3MonthPercent)}</span>
                        <span className={styles.brief}><span>{brief.support}</span><small>{brief.riskOrUnknown} · evidence {brief.evidenceStatus}</small></span>
                    </button></li>;
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
