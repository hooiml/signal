'use client';

import { hasRetrievalTimestamp } from '@/lib/market-evidence-coverage';
import { useMemo, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { getIndicatorBaseWeights, INDICATOR_REGISTRY } from '@/lib/indicator-registry';
import { simulateMarketScore } from '@/lib/market-sensitivity';
import { marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { formatRawValue, getIndicatorCadence } from '@/components/v2/cockpit-utils';
import type { IndicatorData, MarketSignal } from '@/lib/types/signal-v2';
import styles from './market-v8.module.css';
import { missingInputExplanation, newsEvidenceText } from './MarketV8Coverage';
import { fullDate, formatMarketDates } from './MarketV8ConnectedData';

type Point = { date: string; value: number };
export type ScenarioState = { overrides: Record<string, number>; baseline: MarketSignal | null; selectedKey: string };
export const emptyScenario = (): ScenarioState => ({ overrides: {}, baseline: null, selectedKey: '' });
export type IndicatorHistoryState = {
    readonly loading: boolean;
    readonly error: string;
    readonly loaded: number;
    readonly pending: number;
    readonly failed: number;
    readonly unavailable: number;
    readonly total: number;
};

type ConnectedPanelsProps = {
    readonly advanced?: boolean;
    readonly signal: MarketSignal;
    readonly tab: string;
    readonly onSelect: (key: string, element: HTMLButtonElement) => void;
    readonly scenario: ScenarioState;
    readonly setScenario: Dispatch<SetStateAction<ScenarioState>>;
};

type ConnectedIndicatorProps = {
    readonly advanced?: boolean;
    readonly signal: MarketSignal;
    readonly indicatorKey: string;
    readonly onClose: () => void;
    /** Raw observations from the signal history endpoint, when the parent has them. */
    readonly history?: readonly (readonly Point[])[];
    readonly historyState: IndicatorHistoryState;
    readonly onRetryHistory: () => void;
    readonly sourceEnabled?: boolean;
};

const unavailableText = 'Unavailable · the current signal does not supply this record.';

function finiteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function safeHttpUrls(value: unknown): string[] {
    if (typeof value !== 'string' || !value.trim()) return [];
    return (value.match(/https?:\/\/[^\s]+/gi) ?? [])
        .map((candidate) => candidate.replace(/[),.;]+$/, ''))
        .map((candidate) => {
            try {
                const url = new URL(candidate);
                return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
            } catch {
                return null;
            }
        })
        .filter((url): url is string => url !== null);
}

function safeHttpUrl(value: unknown): string | null {
    return safeHttpUrls(value)[0] ?? null;
}

function formatDate(value: string | null | undefined): string {
    if (!value) return 'Unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : fullDate(value);
}

function signed(value: number | null | undefined, digits = 2): string {
    if (!finiteNumber(value)) return 'Unavailable';
    return `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}`;
}

function scoreLabel(value: number | null | undefined): string {
    return finiteNumber(value) ? `${value.toFixed(2)} / 100` : 'Unavailable';
}

function validHistory(points: readonly Point[] | undefined): Point[] {
    return (points ?? [])
        .filter((point) => typeof point.date === 'string' && Number.isFinite(Date.parse(point.date)) && finiteNumber(point.value))
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

function normalizationNote(key: string): string {
    if (key === 'vix') return 'The production VIX normalizer is inverted: lower volatility maps to a higher score. It uses either a supplied 52-week range or a logistic curve centered at VIX 24 with steepness 6; the current payload does not expose which branch or range was used.';
    if (key === 'social' || key === 'news') return 'The production sentiment normalizer clamps the raw −1 to +1 reading, then maps it to 0–100 with (reading + 1) × 50.';
    if (key === 'put_call') return 'The production put/call normalizer clamps the ratio to 0.55–1.25, then inverts that range to 0–100.';
    if (key === 'naaim') return 'The production NAAIM normalizer clamps exposure to 40–90%, then maps that range linearly to 0–100.';
    if (key === 'aaii') return 'The production AAII normalizer clamps bullishness to 20–50%, then maps that range linearly to 0–100.';
    if (key === 'bofa') return 'The production BofA normalizer clamps the supplied SSI value to 50–60, then maps that range linearly to 0–100.';
    return 'The service supplies the normalized 0–100 score. No indicator-specific normalization formula is exposed for this registry key.';
}

function rawValue(indicator: IndicatorData | undefined, driver: NonNullable<MarketSignal['metadata']['score_drivers']>[number] | undefined, market: MarketSignal['metadata']['market']): string {
    const value = indicator?.value ?? driver?.raw_value;
    if (!finiteNumber(value)) return 'Unavailable';
    if (indicator) return formatRawValue(indicator, market);
    return value.toFixed(2);
}

function cadence(indicator: IndicatorData | undefined, key: string): string {
    if (indicator) return getIndicatorCadence(indicator);
    return INDICATOR_REGISTRY[key]?.frequency ?? 'Unavailable';
}

function horizon(indicator: IndicatorData | undefined): string {
    return indicator?.metadata?.horizon ?? 'Unavailable';
}

function usesHighVolatilityWeights(signal: MarketSignal): boolean {
    return signal.metadata.market === 'US' && finiteNumber(signal.components.vix?.value) && signal.components.vix.value > 30;
}

function modelWeights(signal: MarketSignal): Record<string, number> {
    return getIndicatorBaseWeights(signal.metadata.market, { highVolatilityOverride: usesHighVolatilityWeights(signal) });
}

function configuredWeightLabel(signal: MarketSignal): string {
    return usesHighVolatilityWeights(signal) ? 'High-volatility model weight' : 'Normal registry weight';
}

function freshnessStatus(signal: MarketSignal, indicator: IndicatorData | undefined, key: string): string {
    if (!indicator) return 'No supplied input';
    if (hasRetrievalTimestamp(indicator)) return 'Observation date unavailable';
    if (indicator.enabled === false) return 'Disabled';
    if (indicator.metadata?.timestamp_basis !== 'observed') return 'Observation freshness unknown';
    const staleAfterDays = INDICATOR_REGISTRY[key]?.staleAfterDays;
    const snapshotDate = signal.metadata.score_delta?.snapshot_date;
    if (!snapshotDate) return 'Freshness unavailable';
    const age = Date.parse(snapshotDate.slice(0,10)) - Date.parse(indicator.last_updated.slice(0,10));
    if (!finiteNumber(staleAfterDays) || !Number.isFinite(age) || age < 0) return 'Freshness unavailable';
    return age / 86_400_000 > staleAfterDays ? 'Stale · included by service' : 'Included by service';
}

function modeText(signal: MarketSignal, key?: string): string {
    if (key) {
        const driver = signal.metadata.score_drivers?.find((item) => item.key === key);
        const component = signal.components[key];
        return component?.metadata?.mode_note ?? driver?.mode_note ?? 'Unavailable';
    }
    return signal.metadata.interpretation_context?.mode_note ?? 'Unavailable';
}

function SectionHeading({ eyebrow, title, tag }: { eyebrow: string; title: string; tag?: string }) {
    return <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>{eyebrow}</span><h2>{title}</h2></div>{tag ? <span className={styles.tag}>{tag}</span> : null}</div>;
}

function Unavailable({ title, detail = unavailableText }: { title: string; detail?: string }) {
    return <div className={styles.unavailable}><h2>{title}</h2><p>{detail}</p></div>;
}

function RawHistoryChart({ groups, unit }: { groups: readonly (readonly Point[])[]; unit?: string }) {
    const points = groups.flat();
    if (!points.length) return null;
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const firstDate = Date.parse(points[0].date);
    const lastDate = Date.parse(points.at(-1)!.date);
    const duration = lastDate - firstDate || 1;
    const locations = points.map((point) => ({
        x: ((Date.parse(point.date) - firstDate) / duration) * 160,
        y: 40 - ((point.value - min) / span) * 34,
    }));
    const starts = new Set(groups.map(group => group[0]?.date));
    const path = locations.map((point, index) => `${starts.has(points[index].date) ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const latest = points.at(-1)!;
    return <div className={styles.chart} aria-label="Archived raw readings">
        <div className={styles.chartTopline}><span>Snapshot dates · gaps retained</span><output>{formatDate(latest.date)} <b>{latest.value.toFixed(2)} {unit ?? '· unit unverified'}</b></output></div>
        <svg className={styles.sparkline} viewBox="-3 -3 166 50" role="img" aria-label={`Archived raw readings through ${formatDate(latest.date)}`}><path d={path} fill="none" stroke="currentColor" strokeWidth="2" />{locations.map((point,index)=><circle key={points[index].date} cx={point.x} cy={point.y} r="2" fill="currentColor" />)}</svg>
        <div className={styles.chartDates}><span>{formatDate(points[0].date)}</span><span>{formatDate(latest.date)}</span></div>
    </div>;
}

function IndicatorHistory({ groups, state, onRetry, unit }: { groups: readonly (readonly Point[])[]; state: IndicatorHistoryState; onRetry: () => void; unit?: string }) {
    const readingCount = groups.reduce((count, group) => count + group.length, 0);
    const hasPoints = readingCount > 0;
    const readingsLabel = `${readingCount} archived reading${readingCount === 1 ? '' : 's'}`;
    const message = state.loading
        ? hasPoints ? state.pending > 0 ? `Showing ${readingsLabel}; ${state.pending} archive date${state.pending === 1 ? '' : 's'} still loading.` : 'Refreshing archive; showing previously loaded history.' : 'Loading archived readings…'
        : state.error
            ? hasPoints ? 'Showing previously loaded history. Some archived records could not be loaded.' : 'Archived readings could not be loaded.'
            : hasPoints ? `Showing ${readingsLabel}.`
                : state.total === 0 ? 'No archived readings have been stored.'
                    : 'No comparable raw readings are available in the loaded snapshots.';
    return <section className={styles.indicatorHistory} aria-label="Indicator history">
        <h3>Archived readings</h3>
        <p role="status" aria-live="polite">{message}{state.failed > 0 ? ` ${state.failed} archive date${state.failed === 1 ? '' : 's'} failed.` : ''}{state.unavailable > 0 ? ` ${state.unavailable} date${state.unavailable === 1 ? ' has' : 's have'} a stored score only.` : ''}</p>
        <button className={styles.secondaryButton} aria-disabled={state.loading} onClick={() => { if (!state.loading) onRetry(); }}>{state.loading ? 'Loading history…' : state.error ? 'Retry history' : hasPoints ? 'Reload history' : 'Check history again'}</button>
        {hasPoints && <RawHistoryChart groups={groups} unit={unit} />}
        {!state.loading && !state.error && !hasPoints && state.total > 0 && <p className={styles.muted}>The indicator or its comparable unit may be absent from these snapshots. A score alone cannot supply a raw reading.</p>}
    </section>;
}

export function ConnectedIndicator({ signal, indicatorKey, onClose, history, historyState, onRetryHistory, sourceEnabled = true, advanced = false }: ConnectedIndicatorProps) {
    const indicator = signal.components[indicatorKey];
    const driver = signal.metadata.score_drivers?.find((item) => item.key === indicatorKey);
    const registry = INDICATOR_REGISTRY[indicatorKey];
    const contribution = driver?.contribution ?? (indicator ? indicator.score * indicator.weight : null);
    const normalized = indicator?.score ?? driver?.score;
    const configuredWeight = modelWeights(signal)[indicatorKey];
    const historyGroups = (history ?? []).map(group => validHistory(group)).filter(group => group.length > 0);
    const rawHistory = historyGroups.flat();
    const sourceUrls = safeHttpUrls(indicator?.metadata?.source_url);
    const sourceBlend = indicator?.metadata?.source_breakdown;
    const sourceAvailability = signal.metadata.source_availability;
    const newsEvidence = signal.metadata.news_evidence;
    const status = freshnessStatus(signal, indicator, indicatorKey);
    const historyPanel = <IndicatorHistory groups={historyGroups} state={historyState} onRetry={onRetryHistory} unit={indicator?.metadata?.unit} />;
    const interpretationNotes = [modeText(signal, indicatorKey), advanced ? driver?.detail : undefined, indicator?.metadata?.mode_note]
        .filter((text): text is string => !!text)
        .filter((text, index, notes) => notes.findIndex(note => note.trim().replace(/\s+/g, ' ') === text.trim().replace(/\s+/g, ' ')) === index);

    if (!indicator) {
        return <>
            <div className={styles.railHeading}><span className={styles.eyebrow}>Indicator detail</span><button onClick={onClose} aria-label="Close indicator detail" className={styles.closeButton}>×</button></div>
            <h2>{registry?.displayName ?? indicatorKey}</h2>
            <Unavailable title={(indicatorKey === 'social' || indicatorKey === 'news') && !sourceEnabled ? 'Input switched off' : 'Current value unavailable'} detail={missingInputExplanation(indicatorKey, sourceEnabled, sourceAvailability)} />
            <dl className={styles.keyValues}><div><dt>Configured model weight</dt><dd>{finiteNumber(configuredWeight) && configuredWeight > 0 ? `${(configuredWeight * 100).toFixed(1)}% · held as neutral reserve` : 'No configured scoring weight'}</dd></div></dl>
            {indicatorKey === 'news' && newsEvidence && <p className={styles.muted}>{newsEvidenceText(newsEvidence)}</p>}
            <p className={styles.muted}>The current raw value, normalized score and observation date remain unavailable.</p>
            {rawHistory.length > 0 && <p className={styles.muted}>Historical readings only · these snapshots do not supply a current value.</p>}
            {historyPanel}<p className={styles.muted}>Review source coverage for the existing model’s missing-input accounting.</p>
        </>;
    }

    return <>
        <div className={styles.railHeading}><span className={styles.eyebrow}>Indicator detail</span><button onClick={onClose} aria-label="Close indicator detail" className={styles.closeButton}>×</button></div>
        <h2>{indicator?.display_name ?? driver?.name ?? registry?.displayName ?? indicatorKey}</h2>
        <div className={styles.tagLine}><span className={styles.tag}>{status}</span><span className={styles.muted}>{registry?.category ?? 'Unclassified'}</span></div>
        <div className={styles.rawValue}>{rawValue(indicator, driver, signal.metadata.market)} <small>{indicator ? '' : 'raw value'}</small></div>
        <dl className={`${styles.keyValues} ${styles.observationTimes}`}>
            <div><dt>{indicator.metadata?.timestamp_basis === 'observed' ? 'Observed' : indicator.metadata?.timestamp_basis === 'retrieved' ? 'Retrieved' : 'Recorded time · basis unavailable'}</dt><dd>{marketTimestampLabel(indicator.last_updated)}</dd></div>
            {indicator.metadata?.timestamp_basis !== 'retrieved' && indicator.metadata?.retrieved_at && <div><dt>Retrieved</dt><dd>{marketTimestampLabel(indicator.metadata.retrieved_at)}</dd></div>}
        </dl>
        <p className={styles.muted}>{cadence(indicator, indicatorKey)} · horizon {horizon(indicator)}</p>
        {historyPanel}

        <details className={styles.disclosure} open={advanced}><summary>Scoring details</summary><dl className={styles.keyValues}>
            <div><dt>Normalized score</dt><dd>{scoreLabel(normalized)}</dd></div>
            <div><dt>Contribution</dt><dd>{finiteNumber(contribution) ? `${signed(contribution)} points` : 'Unavailable'}</dd></div>
            <div><dt>Active weight</dt><dd>{finiteNumber(indicator?.weight ?? driver?.weight) ? `${((indicator?.weight ?? driver?.weight) * 100).toFixed(1)}%` : 'Unavailable'}</dd></div>
            <div><dt>{configuredWeightLabel(signal)}</dt><dd>{finiteNumber(configuredWeight) ? `${(configuredWeight * 100).toFixed(1)}%` : 'Unavailable'}</dd></div>
            <div><dt>Historical percentile</dt><dd>{finiteNumber(indicator?.percentile) ? `${indicator.percentile.toFixed(1)}th` : 'Unavailable'}</dd></div>
        </dl></details>

        {sourceBlend && Object.keys(sourceBlend).length > 0 ? <div className={styles.explanation}><b>Source readings</b><p>{Object.entries(sourceBlend).map(([name, value]) => `${name}: ${finiteNumber(value) ? value.toFixed(3) : 'Unavailable'}`).join(' · ')}</p><p className={styles.muted}>These values are source readings from the payload, not mixture percentages.</p></div> : null}
        {(indicatorKey === 'social' || indicatorKey === 'news') && sourceAvailability && <div className={styles.explanation}><b>Returned source counts</b><p>{indicatorKey === 'social'
            ? [sourceAvailability.reddit && `Reddit ${sourceAvailability.reddit.count} posts · ${sourceAvailability.reddit.status}`, sourceAvailability.stocktwits && `StockTwits ${sourceAvailability.stocktwits.count} messages · ${sourceAvailability.stocktwits.status}`].filter(Boolean).join(' · ')
            : `${sourceAvailability.news?.count ?? 0} news items returned`}</p>{indicatorKey === 'news' && newsEvidence && <p className={styles.muted}>{newsEvidenceText(newsEvidence)}</p>}<p className={styles.muted}>Returned-item counts describe source coverage; the sentiment formula and input eligibility are unchanged.</p></div>}
        <h3>Interpretation context</h3>{interpretationNotes.map((text, index) => <p key={text} className={index ? styles.muted : undefined}>{text}</p>)}
        <details className={styles.disclosure}><summary>Normalization rule</summary><p>{normalizationNote(indicatorKey)}</p><p className={styles.muted}>The displayed raw value, normalized score and contribution are read from the payload; this panel does not recompute the service score.</p></details>
        <h3>Source</h3>
        {sourceUrls.length ? <div>{sourceUrls.map((sourceUrl) => <p key={sourceUrl}><a className={styles.textButton} href={sourceUrl} target="_blank" rel="noreferrer">Open source record →</a></p>)}</div> : <p className={styles.muted}>{unavailableText}</p>}
    </>;
}

function ChangePanel({ signal, onSelect }: { signal: MarketSignal; onSelect: ConnectedPanelsProps['onSelect'] }) {
    const scoreDelta = signal.metadata.score_delta;
    const changes = signal.metadata.driver_changes ?? [];
    const hasDriverChanges = signal.metadata.driver_changes_available === true && changes.length > 0;
    const comparisonAvailable = signal.metadata.driver_changes_available === true;

    return <>
        <SectionHeading eyebrow="What changed" title="Reported score changes" tag={formatMarketDates(scoreDelta?.label ?? 'Latest comparison')} />
        {scoreDelta && finiteNumber(scoreDelta.delta) && Math.abs(scoreDelta.delta) < 0.005 ? <p className={styles.unchangedScore} data-testid="what-changed-unchanged"><strong>{signal.composite_score.toFixed(0)}</strong><span>Score unchanged since {scoreDelta.previous_date ? formatDate(scoreDelta.previous_date) : 'the previous snapshot'} · snapshot {formatDate(scoreDelta.snapshot_date)}. Individual inputs can still move in offsetting directions; see the accounting below.</span></p> : scoreDelta && finiteNumber(scoreDelta.delta) ? <div className={styles.studyMetrics}><div><span>Current score</span><strong>{signal.composite_score.toFixed(0)}</strong><small>Snapshot {formatDate(scoreDelta.snapshot_date)}</small></div><div><span>Previous score</span><strong>{finiteNumber(scoreDelta.previous_score) ? scoreDelta.previous_score.toFixed(0) : 'Unavailable'}</strong><small>{scoreDelta.previous_date ? formatDate(scoreDelta.previous_date) : 'No prior date'}</small></div><div><span>Score delta</span><strong>{signed(scoreDelta.delta, 0)}</strong><small>Reported comparison</small></div></div> : <Unavailable title="Score change unavailable" detail="No comparable previous score is available." />}

        <section className={styles.calibration} aria-label="Driver changes">
            <h3>Reported contribution changes</h3>
            {hasDriverChanges ? <div className={styles.contextList}>{[...changes].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map((change) => <button key={change.key} className={styles.contributor} onClick={(event) => onSelect(change.key, event.currentTarget)}><span>{change.name}</span><span className={styles.barTrack} aria-hidden="true"><span className={change.delta < 0 ? styles.negativeBar : styles.positiveBar} style={{ width: `${Math.min(100, Math.abs(change.delta) * 10)}%` }} /></span><b>{signed(change.delta)} <small>pts</small></b><span aria-hidden="true">↗</span></button>)}</div> : <div className={styles.unavailable}><b>{comparisonAvailable ? 'No weighted-contribution changes.' : 'Driver comparison unavailable.'}</b><p>{comparisonAvailable ? 'Comparable inputs are available. Observation times, raw readings, or offsetting score and weight effects may still differ below.' : 'A comparable earlier indicator reading is unavailable.'}</p></div>}
        </section>

        <ChangeAccounting signal={signal} />
    </>;
}

const statusLabels = { changed: 'Changed', unchanged: 'Unchanged', 'became-available': 'Became available', 'became-unavailable': 'Became unavailable' } as const;
type ChangeRow = NonNullable<MarketSignal['metadata']['change_reconciliation']>['components'][number];

function observationText(row: ChangeRow) {
    if (row.status === 'became-available') return 'Input became available in the current snapshot.';
    if (row.status === 'became-unavailable') return 'No reading for this input in the current snapshot.';
    if (row.previous_timestamp_basis !== 'observed' || row.current_timestamp_basis !== 'observed'
        || !Number.isFinite(Date.parse(row.previous_observed_at ?? '')) || !Number.isFinite(Date.parse(row.current_observed_at ?? ''))) {
        return 'Observation timing unavailable for at least one snapshot. Retrieval alone does not establish a new observation.';
    }
    switch (row.observation_change) {
        case 'newer': return 'Newer observed reading.';
        case 'older': return 'An older observed reading was returned.';
        case 'different': return 'Raw value changed at the same observed timestamp.';
        case 'same': return 'Same observed reading.';
        default: return 'Observation timing unavailable for at least one snapshot. Retrieval alone does not establish a new observation.';
    }
}

function ComparisonValues({ previous, current }: { previous: ReactNode; current: ReactNode }) {
    return <dd className={styles.comparisonValues}><span><small>Previous</small><span>{previous}</span></span><span><small>Current</small><span>{current}</span></span></dd>;
}

function RawComparisonValue({ value, unit }: { value: number | null; unit: string | null | undefined }) {
    return finiteNumber(value) ? <><b className={styles.metricNumber}>{value.toFixed(2)}</b> {unit ?? '· unit unavailable'}</> : 'Unavailable';
}

function RecordedClock({ row, side }: { row: ChangeRow; side: 'previous' | 'current' }) {
    const basis = row[`${side}_timestamp_basis`];
    const observed = row[`${side}_observed_at`];
    const retrieved = row[`${side}_retrieved_at`];
    const recorded = row[`${side}_last_updated`];
    if (basis === 'observed') return <><span>Observed {marketTimestampLabel(observed)}</span>{retrieved && <span>Retrieved {marketTimestampLabel(retrieved)}</span>}</>;
    if (basis === 'retrieved') return <><span>Retrieved {marketTimestampLabel(retrieved ?? recorded)}</span><span>Observation time unavailable</span></>;
    return <><span>Timestamp basis unavailable</span>{(recorded ?? observed) && <span>Recorded {marketTimestampLabel(recorded ?? observed)}</span>}{retrieved && <span>Retrieved {marketTimestampLabel(retrieved)}</span>}</>;
}

function ChangeAccounting({ signal }: { signal: MarketSignal }) {
    const accounting = signal.metadata.change_reconciliation;
    if (!accounting) {
        return <p className={styles.studyNotice}>Changes are in normalized-score × weight points. A complete accounting is unavailable: {signal.metadata.change_reconciliation_note ?? 'the earlier snapshot is missing the archived inputs needed to reconcile.'}</p>;
    }
    // Earlier payloads may classify offsetting score/weight effects as unchanged.
    const moved = accounting.components.filter(row => row.status !== 'unchanged' || row.previous_score !== row.current_score || row.previous_weight !== row.current_weight);
    const unchanged = accounting.components.length - moved.length;
    return <section className={`${styles.calibration} ${styles.changeAccounting}`} aria-label="Complete score change accounting">
        <h3>Complete accounting</h3>
        <dl className={`${styles.keyValues} ${styles.accountingTotals}`}>
            <div><dt>Input contributions</dt><dd>{signed(accounting.component_delta)} points</dd></div>
            <div><dt>Missing-input fallback</dt><dd>{signed(accounting.neutral_fallback.delta)} points</dd></div>
            <div><dt>Rounding and clamp residual</dt><dd>{signed(accounting.rounding_residual)} points</dd></div>
            <div><dt>Reported score delta</dt><dd>{signed(accounting.reported_delta, 0)} points</dd></div>
        </dl>
        <details className={styles.disclosure}>
            <summary>Fallback, applied weights and model</summary>
            <dl className={`${styles.keyValues} ${styles.accountingValues}`}>
                <div><dt>Missing input weight</dt><ComparisonValues previous={`${(accounting.neutral_fallback.previous_missing_weight * 100).toFixed(1)}%`} current={`${(accounting.neutral_fallback.current_missing_weight * 100).toFixed(1)}%`} /></div>
                <div><dt>Neutral baseline</dt><dd>50 / 100 for missing weight</dd></div>
                <div><dt>Applied weights</dt><dd>{accounting.weights_changed ? 'Changed; inspect each input below' : 'Unchanged'}</dd></div>
                <div><dt>Model version</dt><ComparisonValues previous={accounting.model_version.previous ?? 'Not recorded'} current={accounting.model_version.current} /></div>
            </dl>
            <p>Missing-input fallback changed by {signed(accounting.neutral_fallback.delta)} points. This accounts for unavailable weight; it is not an observed neutral reading.</p>
        </details>
        {moved.map(row => {
            const scoresChanged = row.previous_score !== row.current_score;
            const weightsChanged = row.previous_weight !== row.current_weight;
            const status = row.delta === 0 && (row.status === 'changed' || scoresChanged || weightsChanged)
                ? `${scoresChanged && weightsChanged ? 'Score and weight changed' : 'Reading changed'} · net contribution unchanged`
                : statusLabels[row.status];
            return <details key={row.key} className={`${styles.disclosure} ${styles.changeRow}`}>
                <summary><span>{row.name}<small>{status}</small></span><strong>{signed(row.delta)} points</strong><span aria-hidden="true">+</span></summary>
                <dl className={`${styles.keyValues} ${styles.accountingValues}`}>
                    <div><dt>Raw reading</dt><ComparisonValues previous={<RawComparisonValue value={row.previous_raw_value} unit={row.previous_unit} />} current={<RawComparisonValue value={row.current_raw_value} unit={row.current_unit} />} /></div>
                    <div><dt>Normalized score</dt><ComparisonValues previous={scoreLabel(row.previous_score)} current={scoreLabel(row.current_score)} /></div>
                    <div><dt>Applied weight</dt><ComparisonValues previous={finiteNumber(row.previous_weight) ? `${(row.previous_weight * 100).toFixed(1)}%` : 'Not applied'} current={finiteNumber(row.current_weight) ? `${(row.current_weight * 100).toFixed(1)}%` : 'Not applied'} /></div>
                    {row.score_effect !== null && <div><dt>Score effect</dt><dd>{signed(row.score_effect)} points</dd></div>}
                    {row.weight_effect !== null && <div><dt>Weight effect</dt><dd>{signed(row.weight_effect)} points</dd></div>}
                    <div><dt>Source timestamps</dt><ComparisonValues previous={<RecordedClock row={row} side="previous" />} current={<RecordedClock row={row} side="current" />} /></div>
                </dl>
                <p>{observationText(row)}</p>
            </details>;
        })}
        {unchanged > 0 && <p className={styles.muted}>{unchanged} input{unchanged === 1 ? '' : 's'} unchanged between snapshots.</p>}
        <p className={styles.studyNotice}>Points are normalized score × applied weight. Input contributions, missing-input fallback and residual sum to the reported delta.</p>
    </section>;
}

function configuredRows(signal: MarketSignal) {
    const weights = modelWeights(signal);
    const keys = new Set([...Object.keys(weights), ...Object.keys(signal.components)]);
    return [...keys].map((key) => {
        const indicator = signal.components[key];
        const registry = INDICATOR_REGISTRY[key];
        const driver = signal.metadata.score_drivers?.find((item) => item.key === key);
        return { key, indicator, registry, driver, configuredWeight: weights[key] ?? null, appliedWeight: signal.metadata.weight_distribution?.[key] ?? null, contribution: driver?.contribution ?? (indicator ? indicator.score * indicator.weight : null) };
    }).filter((row) => row.configuredWeight !== 0 || row.indicator || row.driver).sort((a, b) => Math.abs(b.contribution ?? 0) - Math.abs(a.contribution ?? 0));
}

function EvidencePanel({ signal, onSelect, advanced }: { signal: MarketSignal; onSelect: ConnectedPanelsProps['onSelect']; advanced: boolean }) {
    const rows = configuredRows(signal);
    const coverage = signal.metadata.coverage_adjustment;
    const active = Object.values(signal.components).filter((component) => component.enabled);
    const drivers = signal.metadata.score_drivers ?? [];
    const reserve = coverage?.neutral_points;

    return <>
        <SectionHeading eyebrow="Evidence" title="The inputs behind the reading" tag={`${active.length} active`} />
        <p className={styles.panelIntro}>{advanced ? `Values, normalized scores and contributions come from the current reading. ${configuredWeightLabel(signal)} are shown for the active model.` : 'Explore the observations behind the reading. Select an input for its source, history and explanation. Missing inputs are not neutral evidence.'}</p>
        <div className={styles.evidenceList}>{rows.map((row) => {
            const name = row.indicator?.display_name ?? row.driver?.name ?? row.registry?.displayName ?? row.key;
            const isActive = row.indicator?.enabled === true;
            const status = !row.indicator ? 'Reserve' : isActive ? 'Active' : 'Disabled';
            const button = <button className={styles.evidenceButton} onClick={(event) => onSelect(row.key, event.currentTarget)}><span><b>{name}</b><small>{advanced ? `${status} · ${configuredWeightLabel(signal)} ${row.configuredWeight === null ? 'Unavailable' : `${(row.configuredWeight * 100).toFixed(1)}%`} · applied ${row.appliedWeight === null ? 'Unavailable' : `${(row.appliedWeight * 100).toFixed(1)}%`}` : freshnessStatus(signal, row.indicator, row.key)} · {cadence(row.indicator, row.key)}</small><small>{isActive ? `Reading: ${rawValue(row.indicator, row.driver, signal.metadata.market)}${advanced ? ` · contribution ${finiteNumber(row.contribution) ? `${signed(row.contribution)} pts` : 'Unavailable'}` : ''}` : 'No included observation'}</small></span><span className={styles.evidenceScore}>{advanced && isActive ? <>{scoreLabel(row.indicator?.score ?? row.driver?.score)}<small>{row.indicator ? marketReadingLabel(row.indicator.signal) : 'Direction unavailable'}</small></> : 'Details'} <span aria-hidden="true">↗</span></span></button>;
            return row.indicator || row.driver ? <span key={row.key}>{button}</span> : <div key={row.key} className={styles.evidenceButton}><span><b>{name}</b><small>Registry configured · reserve</small></span><span className={styles.muted}>No supplied input</span></div>;
        })}</div>
        <details className={styles.disclosure}><summary>Coverage, active weight and neutral reserve</summary><dl className={styles.keyValues}><div><dt>Configured registry entries</dt><dd>{rows.filter((row) => (row.configuredWeight ?? 0) > 0).length}</dd></div><div><dt>Active payload inputs</dt><dd>{active.length}</dd></div><div><dt>Active configured weight</dt><dd>{coverage && finiteNumber(coverage.active_weight) ? `${(coverage.active_weight * 100).toFixed(1)}%` : 'Unavailable'}</dd></div><div><dt>Reserve weight</dt><dd>{coverage && finiteNumber(coverage.missing_weight) ? `${(coverage.missing_weight * 100).toFixed(1)}%` : 'Unavailable'}</dd></div><div><dt>Neutral reserve points</dt><dd>{finiteNumber(reserve) ? reserve.toFixed(2) : 'Unavailable'}</dd></div></dl><p>{finiteNumber(reserve) ? `The composite is calculated from ${drivers.length} payload driver${drivers.length === 1 ? '' : 's'} plus ${reserve.toFixed(2)} neutral-reserve points.` : 'The payload does not include neutral-reserve accounting.'} Reserve points are accounting for missing or ineligible configured weight, not market evidence.</p></details>
        {signal.metadata.interpretation_context?.limitation ? <p className={styles.studyNotice}>{signal.metadata.interpretation_context.limitation}</p> : null}
    </>;
}

function ContextPanel({ signal }: { signal: MarketSignal }) {
    const context = signal.metadata.market_context;
    const backdrop = signal.metadata.valuation_backdrop;
    const backdropUrls = safeHttpUrls(backdrop?.source_url);
    const indices = signal.metadata.index_trend ?? [];

    return <>
        <SectionHeading eyebrow="Context" title="Market context outside the score" tag="Context only" />
        <p className={styles.panelIntro}>These dated records provide context and do not change the composite score.</p>
        {backdrop ? <section className={styles.calibration} aria-label="Valuation backdrop"><h3>{backdrop.name}</h3><dl className={styles.keyValues}><div><dt>Ratio</dt><dd>{backdrop.ratio_pct.toFixed(1)}%</dd></div><div><dt>Label</dt><dd>{backdrop.label}</dd></div><div><dt>Market value</dt><dd>{backdrop.market_value_billions.toFixed(1)}bn</dd></div><div><dt>GDP</dt><dd>{backdrop.gdp_billions.toFixed(1)}bn</dd></div><div><dt>Report date</dt><dd>{formatDate(backdrop.report_date)}</dd></div></dl><p>{backdrop.detail}</p>{backdropUrls.length ? <div>{backdropUrls.map((sourceUrl) => <p key={sourceUrl}><a className={styles.textButton} href={sourceUrl} target="_blank" rel="noreferrer">Open valuation source →</a></p>)}</div> : <p className={styles.muted}>Source URL unavailable.</p>}</section> : <Unavailable title="Valuation backdrop unavailable" />}

        <section className={styles.calibration} aria-label="Market context"><h3>Market context</h3>{context ? <ContextData context={context} /> : <Unavailable title="Market context unavailable" />}</section>
        <section className={styles.calibration} aria-label="Index trend"><h3>Index trend</h3>{indices.length ? <div className={styles.contextList}>{indices.map((index) => <div key={index.symbol} className={styles.evidenceButton}><span><b>{index.symbol}</b><small>{finiteNumber(index.price) ? `Price ${index.price.toFixed(2)}` : 'Price unavailable'} · {index.trend}</small></span><span className={index.changePercent >= 0 ? styles.support : styles.conflict}>{signed(index.changePercent)}%</span></div>)}</div> : <Unavailable title="Index trend unavailable" />}</section>
        <section className={styles.calibration} aria-label="Market headlines"><h3>Market headlines</h3><p>Headlines are withheld here because market relevance has not been verified. They are not score-attribution evidence.</p></section>
    </>;
}

function ContextData({ context }: { context: NonNullable<MarketSignal['metadata']['market_context']> }) {
    if (context.market === 'US') {
        return <div className={styles.contextList}>{context.yield_curve ? <ContextItem label="10Y–3M yield curve" value={`${context.yield_curve.spread_pct.toFixed(2)}% · ${context.yield_curve.state}`} date={context.yield_curve.report_date} href={context.yield_curve.source_url} /> : <ContextItem label="10Y–3M yield curve" unavailable />}{context.financial_conditions ? <ContextItem label="Financial conditions" value={`${context.financial_conditions.value.toFixed(2)} · ${context.financial_conditions.stance}`} date={context.financial_conditions.report_date} href={context.financial_conditions.source_url} /> : <ContextItem label="Financial conditions" unavailable />}{context.breadth ? <ContextItem label={`Breadth · ${context.breadth.period_label}`} value={`Equal-weight ${signed(context.breadth.equal_weight_return_pct)}% · cap-weight ${signed(context.breadth.cap_weight_return_pct)}% · relative ${signed(context.breadth.relative_return_pct)} pp`} date={context.breadth.report_date} href={context.breadth.source_urls[0]} /> : <ContextItem label="Breadth" unavailable />}</div>;
    }
    const rates = context.malaysia_rates;
    return <div className={styles.contextList}>{rates ? <><ContextItem label="MGS curve" value={`3Y ${rates.mgs_3y_pct.toFixed(2)}% · 10Y ${rates.mgs_10y_pct.toFixed(2)}% · spread ${signed(rates.curve_spread_pct)} pp`} date={rates.report_date} href={rates.source_url} /><ContextItem label="OPR" value={`${rates.opr_pct.toFixed(2)}%`} date={rates.opr_report_date} href={rates.source_url} /><ContextItem label="MYOR and short-term bill" value={`MYOR ${rates.myor_pct.toFixed(2)}%${rates.short_term_bill_3m_pct === null ? '' : ` · ${rates.short_term_bill_name ?? '3M bill'} ${rates.short_term_bill_3m_pct.toFixed(2)}%`}`} date={rates.report_date} href={rates.source_url} /></> : <ContextItem label="Malaysia rates" unavailable />}</div>;
}

function ContextItem({ label, value, date, href, unavailable = false }: { label: string; value?: string; date?: string; href?: string; unavailable?: boolean }) {
    const safeHref = safeHttpUrl(href);
    return <div className={styles.evidenceButton}><span><b>{label}</b><small>{unavailable ? 'Unavailable' : `${value} · ${formatDate(date)}`}</small></span>{safeHref ? <a className={styles.textButton} href={safeHref} target="_blank" rel="noreferrer">Source →</a> : <span className={styles.muted}>{unavailable ? 'No record' : 'Source unavailable'}</span>}</div>;
}

function ScenarioPanel({ signal, scenario, setScenario }: Pick<ConnectedPanelsProps, 'signal' | 'scenario' | 'setScenario'>) {
    const { overrides, baseline, selectedKey } = scenario;
    const reading = baseline ?? signal;
    const result = simulateMarketScore(reading, overrides);
    const effectiveKey = result.drivers.some((driver) => driver.key === selectedKey) ? selectedKey : result.drivers[0]?.key ?? '';
    const selected = result.drivers.find((driver) => driver.key === effectiveKey);

    if (!result.drivers.length) return <Unavailable title="Scenarios unavailable" detail="No active score inputs are available to simulate." />;
    return <>
        <SectionHeading eyebrow="Scenarios" title="What would change the reading?" tag="Hypothetical" />
        {baseline && baseline !== signal && <p role="status">Newer reading available. Your assumptions still use their original reading.</p>}
        <p className={styles.panelIntro}>Adjust an existing normalized input to inspect sensitivity. Raw observations, weights and reserve accounting remain as supplied by the signal. Nothing is persisted.</p>
        <div className={styles.scenarioGrid}><div><label className={styles.field}>Input to explore<select aria-label="Scenario input" value={effectiveKey} onChange={(event) => setScenario(current => ({ ...current, selectedKey: event.target.value }))}>{result.drivers.map((driver) => <option key={driver.key} value={driver.key}>{driver.name}</option>)}</select></label>{selected ? <><label className={styles.sliderLabel} htmlFor="connected-scenario-score">Hypothetical normalized score <b>{overrides[effectiveKey] ?? selected.baseScore.toFixed(2)}</b></label><input id="connected-scenario-score" type="range" min="0" max="100" step="1" value={overrides[effectiveKey] ?? selected.baseScore} onChange={(event) => { setScenario(current => ({ ...current, baseline: current.baseline ?? signal, overrides: { ...current.overrides, [effectiveKey]: Number(event.target.value) } })); }} /><div className={styles.scaleLabels}><span>0</span><span>50 · neutral</span><span>100</span></div></> : null}<button className={styles.secondaryButton} onClick={() => { setScenario(emptyScenario()); }}>Reset to latest reading</button></div><div className={styles.simulated} data-reading={result.simulatedTier.includes('buy') ? 'positive' : result.simulatedTier.includes('sell') ? 'negative' : 'neutral'} aria-live="polite"><span>Simulated score</span><strong>{result.simulatedScore}<small>/100</small></strong><b>{signed(result.scoreDelta, 0)} vs baseline {reading.composite_score}</b><p>Simulated reading: {marketReadingLabel(result.simulatedTier)} · {reading.mode === 'contrarian' ? 'Contrarian' : 'Momentum'} · hypothetical</p></div></div>
        <details className={styles.disclosure}><summary>Active assumptions & accounting</summary>{result.drivers.filter((driver) => driver.baseScore !== driver.simulatedScore).map((driver) => <p key={driver.key}>{driver.name}: {driver.baseScore.toFixed(2)} → {driver.simulatedScore.toFixed(2)} · contribution {signed(driver.contributionDelta)} points.</p>)}<p>Neutral reserve retained: {result.neutralPoints.toFixed(2)} points. This is sensitivity arithmetic only; no raw data, score, or scenario is saved.</p></details>
    </>;
}

export function ConnectedPanels({ signal, tab, onSelect, scenario, setScenario, advanced = false }: ConnectedPanelsProps) {
    const normalizedTab = tab.trim().toLowerCase();
    const panel = useMemo(() => {
        if (normalizedTab === 'what changed') return <ChangePanel signal={signal} onSelect={onSelect} />;
        if (normalizedTab === 'evidence') return <EvidencePanel advanced={advanced} signal={signal} onSelect={onSelect} />;
        if (normalizedTab === 'context') return <ContextPanel signal={signal} />;
        if (normalizedTab === 'scenarios') return <ScenarioPanel signal={signal} scenario={scenario} setScenario={setScenario} />;
        return <Unavailable title="Panel unavailable" detail={`No connected V8 panel is defined for “${tab}”.`} />;
    }, [normalizedTab, onSelect, signal, tab, scenario, setScenario, advanced]);
    return <div data-testid={`market-v8-connected-${normalizedTab.replace(/\s+/g, '-')}`}>{panel}</div>;
}
