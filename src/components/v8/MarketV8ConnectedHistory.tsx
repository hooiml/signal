'use client';

import { useMemo, useState } from 'react';
import { getCalibrationZone, selectHistoricalValidationCases, type CalibrationObservation, type CalibrationValidationCase } from '@/lib/market-calibration';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { MarketV8Timeline } from './MarketV8Timeline';
import styles from './market-v8.module.css';

type Calibration = NonNullable<MarketSignal['metadata']['historical_validation']>;
type CalibrationView = 'Timeline' | 'Forward outcomes' | 'Score zones' | 'Cases' | 'Method';
type CalibrationZone = Calibration['horizons'][number]['cohorts'][number]['zone'];
type OutcomeStats = {
    count: number;
    observed: number;
    sufficient: boolean;
    median: number | null;
    positive: number | null;
    worst: number | null;
    best: number | null;
};

const views: readonly CalibrationView[] = ['Timeline', 'Forward outcomes', 'Score zones', 'Cases', 'Method'];
const horizons = [7, 30] as const;

const dateLabel = (date: string | null) => date
    ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
    : 'Unavailable';
const signedPercent = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(2)}%`;
const evidenceLabel = (value: Calibration['horizons'][number]['cohorts'][number]['evidence_level']) => value.charAt(0).toUpperCase() + value.slice(1);
const evidenceFor = (stats: OutcomeStats, calibration: Calibration) => stats.count < calibration.minimum_sample_size
    ? 'insufficient' as const
    : stats.count >= calibration.directional_sample_size && stats.observed >= calibration.minimum_sample_size
        ? 'established' as const
        : 'preliminary' as const;

const rowsFor = (horizon: Calibration['horizons'][number] | undefined, zone?: CalibrationZone, observedOnly = false) =>
    (horizon?.observations ?? []).filter((row) => (!observedOnly || row.origin === 'observed') && (zone === undefined || getCalibrationZone(row.score) === zone));

const outcomeStats = (rows: readonly CalibrationObservation[], minimumSampleSize: number): OutcomeStats => {
    const values = rows.map((row) => row.forward_return_pct).sort((left, right) => left - right);
    const middle = Math.floor(values.length / 2);
    return {
        count: values.length,
        observed: rows.filter((row) => row.origin === 'observed').length,
        sufficient: values.length >= minimumSampleSize,
        median: values.length === 0 ? null : values.length % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle],
        positive: values.length === 0 ? null : values.filter((value) => value > 0).length / values.length * 100,
        worst: values.at(0) ?? null,
        best: values.at(-1) ?? null,
    };
};

const filteredCases = (calibration: Calibration, observedOnly: boolean) => {
    const source = observedOnly ? {
        ...calibration,
        horizons: calibration.horizons.map((horizon) => ({
            ...horizon,
            observations: horizon.observations.filter((row) => row.origin === 'observed'),
        })),
    } : calibration;
    const selected = selectHistoricalValidationCases(source);
    const filter = (rows: readonly CalibrationValidationCase[]) => rows.filter((row) => !observedOnly || row.origin === 'observed');
    return { aligned: filter(selected.aligned), mismatches: filter(selected.mismatches), neutral: filter(selected.neutral) };
};

const originLabel = (row: CalibrationObservation) => `${row.origin} score`;

function ForwardOutcomes({ calibration, zone, observedOnly, days, onDaysChange, onZoneChange, negativeOnly, onNegativeOnlyChange }: {
    calibration: Calibration;
    zone: CalibrationZone;
    observedOnly: boolean;
    days: 7 | 30;
    onDaysChange: (days: 7 | 30) => void;
    onZoneChange: (zone: CalibrationZone) => void;
    negativeOnly: boolean;
    onNegativeOnlyChange: (negativeOnly: boolean) => void;
}) {
    const horizon = calibration.horizons.find((item) => item.days === days);
    const rows = rowsFor(horizon, zone, observedOnly);
    const baselineRows = rowsFor(horizon, undefined, observedOnly);
    const stats = outcomeStats(rows, calibration.minimum_sample_size);
    const baseline = outcomeStats(baselineRows, calibration.minimum_sample_size);
    const cases = negativeOnly ? rows.filter((row) => row.forward_return_pct < 0) : rows;
    const cohort = horizon?.cohorts.find((item) => item.zone === zone);
    const outcomesThrough = (() => {
        const latestScoreDate = horizon?.observations.at(-1)?.date;
        if (!latestScoreDate) return null;
        const date = new Date(`${latestScoreDate}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + days);
        return date.toISOString().slice(0, 10);
    })();

    if (!horizon) return <div className={styles.unavailable} data-testid="calibration-forward-view"><b>No {days}-day history</b><p>This connected calibration dataset does not provide a {days}-day horizon. No replacement outcomes are inferred.</p></div>;

    return <div data-testid="calibration-forward-view">
        <div className={styles.restoreControls}><fieldset className={styles.segment}><legend className={styles.visuallyHidden}>Outcome horizon</legend>{horizons.map((option) => <button key={option} type="button" aria-pressed={days === option} onClick={() => onDaysChange(option)}>{option}-day outcomes</button>)}</fieldset><label className={styles.field}>Score zone<select aria-label="Score zone" value={zone} onChange={(event) => onZoneChange(event.target.value as CalibrationZone)}>{horizon.cohorts.map((item) => <option key={item.zone} value={item.zone}>{item.label}</option>)}</select></label></div>
        <p className={styles.studyMeta}>{calibration.benchmark_name} forward returns · {stats.count} comparable / {baseline.count} total samples · target window through {dateLabel(outcomesThrough)}</p>
        <div className={styles.studyMetrics} aria-live="polite">
            <div><span>Median subsequent return</span><strong>{stats.sufficient ? signedPercent(stats.median) : '—'}</strong><small>All-zone baseline: {baseline.sufficient ? signedPercent(baseline.median) : '—'}</small></div>
            <div><span>Positive-return frequency</span><strong>{stats.sufficient && stats.positive !== null ? `${stats.positive.toFixed(0)}%` : '—'}</strong><small>Baseline: {baseline.sufficient && baseline.positive !== null ? `${baseline.positive.toFixed(0)}%` : '—'} · descriptive only</small></div>
            <div><span>Outcome range</span><strong>{stats.sufficient ? `${signedPercent(stats.worst)} to ${signedPercent(stats.best)}` : '—'}</strong><small>{stats.observed} observed · {stats.count - stats.observed} reconstructed</small></div>
        </div>
        <p className={styles.studyNotice}>{stats.sufficient ? `${evidenceLabel(evidenceFor(stats, calibration))} evidence · summary uses the selected origin filter${cohort ? `; backend cohort status is ${evidenceLabel(cohort.evidence_level)}` : ''}.` : `Insufficient evidence · at least ${calibration.minimum_sample_size} comparable samples are required. Summary estimates are withheld.`} {calibration.limitation}</p>
        <div className={styles.sectionHeading}><h3>Inspect the outcomes</h3><label className={styles.sourceToggle}><input type="checkbox" checked={negativeOnly} onChange={(event) => onNegativeOnlyChange(event.target.checked)} />Negative returns only</label></div>
        <div className={styles.outcomeList}>{cases.length ? cases.map((row) => <details key={`${row.date}-${days}`} className={styles.outcomeRow}><summary><span>{dateLabel(row.date)}<small>Score {row.score} · {row.tier} · {originLabel(row)}</small></span><b className={row.forward_return_pct < 0 ? styles.conflict : styles.support}>{signedPercent(row.forward_return_pct)}</b><span aria-hidden="true">＋</span></summary><p>{calibration.benchmark_name} return over {days} calendar days after this score snapshot. Forward outcomes are descriptive and do not establish a correct investment decision.</p></details>) : <div className={styles.unavailable}>{negativeOnly ? 'No negative-return observations match this horizon and origin filter.' : 'No forward-return observations match this horizon and origin filter.'}</div>}</div>
    </div>;
}

function ZoneComparison({ calibration, observedOnly }: { calibration: Calibration; observedOnly: boolean }) {
    const week = calibration.horizons.find((horizon) => horizon.days === 7);
    const month = calibration.horizons.find((horizon) => horizon.days === 30);
    const labels = week?.cohorts ?? month?.cohorts ?? [];
    return <div data-testid="calibration-zones-view">
        <p className={styles.panelIntro}>Each zone uses the matching horizon observations. The all-zone baseline is calculated from the underlying eligible observations, so timeline-only points are excluded naturally.</p>
        {labels.length === 0 ? <div className={styles.unavailable}><b>No score-zone history</b><p>Zone cohorts are unavailable for this calibration dataset.</p></div> : <table className={styles.zoneTable}><caption>Benchmark forward outcomes by score zone</caption><thead><tr><th scope="col">Score zone</th><th scope="col">7 days</th><th scope="col">30 days</th></tr></thead><tbody>{[...labels, { zone: 'all' as const, label: 'All-zone baseline' }].map((group) => <tr key={group.zone}><th scope="row">{group.label}</th>{horizons.map((days) => { const horizon = calibration.horizons.find((item) => item.days === days); const stats = outcomeStats(rowsFor(horizon, group.zone === 'all' ? undefined : group.zone, observedOnly), calibration.minimum_sample_size); return <td key={days}><b>{stats.sufficient ? signedPercent(stats.median) : '—'} median</b><span>{stats.sufficient && stats.positive !== null ? `${stats.positive.toFixed(0)}% positive` : 'Insufficient sample'}</span><small>{stats.count} samples · {stats.observed} observed</small></td>; })}</tr>)}</tbody></table>}
        <p className={styles.studyNotice}>At least {calibration.minimum_sample_size} samples are required for summary estimates. Overlapping observations are descriptive, not independent trials.</p>
    </div>;
}

function CasesView({ calibration, observedOnly }: { calibration: Calibration; observedOnly: boolean }) {
    const cases = filteredCases(calibration, observedOnly);
    const groups: Array<{ key: keyof typeof cases; title: string; description: string }> = [
        { key: 'mismatches', title: 'Directional mismatches', description: 'A positive tier preceded a decline, or a negative tier preceded a rally.' },
        { key: 'aligned', title: 'Aligned periods', description: 'The subsequent return direction matched the stored score tier.' },
        { key: 'neutral', title: 'Neutral, then a sharp move', description: 'Neutral-tier observations followed by an absolute 30-day move of at least 5%.' },
    ];
    return <section aria-label="Calibration case categories" data-testid="calibration-cases-view"><h3>Mechanically selected cases</h3><p className={styles.panelIntro}>Cases come from the stored 30-day tier and forward-return observations, ranked by absolute move. The selected origin filter is applied before classification and ranking; up to four cases per category are shown.</p>{groups.map((group) => <details className={styles.disclosure} key={group.key} open={group.key === 'mismatches'}><summary>{group.title} · {cases[group.key].length}</summary><p>{group.description}</p>{cases[group.key].length ? <ul className={styles.caseList}>{cases[group.key].map((row) => <li key={`${group.key}-${row.date}`}><span>{dateLabel(row.date)} · score {row.score}<small>{row.tier} · {originLabel(row)}</small></span><b>{signedPercent(row.forward_return_pct)}</b></li>)}</ul> : <p>No qualifying cases match this origin filter.</p>}</details>)}<p className={styles.studyNotice}>{calibration.limitation}</p></section>;
}

function MethodView({ calibration }: { calibration: Calibration }) {
    return <div data-testid="calibration-methodology-view">
        <dl className={styles.keyValues}><div><dt>Scoring model</dt><dd>{calibration.model_version}</dd></div><div><dt>Historical data window</dt><dd>{dateLabel(calibration.data_start_date)} – {dateLabel(calibration.data_through_date)}</dd></div><div><dt>Stored score snapshots</dt><dd>{calibration.snapshot_count} total · {calibration.timeline_only_snapshot_count} timeline-only</dd></div><div><dt>Provenance</dt><dd>{calibration.observed_snapshot_count} observed · {calibration.reconstructed_snapshot_count} reconstructed</dd></div><div><dt>Out-of-sample validation</dt><dd>Not available</dd></div></dl>
        {calibration.reconstruction_note && <p className={styles.panelIntro}>{calibration.reconstruction_note}</p>}
        <ul className={styles.methodList}><li>Scores, tiers, and model metadata are rendered from the connected calibration response.</li><li>Forward benchmark returns are outcome observations after each score date and are excluded from scoring.</li><li>Timeline-only points remain visible in the synchronized timeline and are excluded from horizon observations and all-zone baselines by the backend contract.</li><li>Observed provenance does not establish out-of-sample validation. {calibration.limitation}</li></ul>
    </div>;
}

export function ConnectedHistory({ signal }: { signal: MarketSignal }) {
    const calibration = signal.metadata.historical_validation;
    const [view, setView] = useState<CalibrationView>('Timeline');
    const [days, setDays] = useState<7 | 30>(7);
    const initialZone = getCalibrationZone(signal.composite_score);
    const [zone, setZone] = useState<CalibrationZone>(initialZone ?? 'mixed');
    const [observedOnly, setObservedOnly] = useState(false);
    const [negativeOnly, setNegativeOnly] = useState(false);

    const availableZones = useMemo(() => calibration?.horizons.find((horizon) => horizon.days === days)?.cohorts ?? calibration?.horizons[0]?.cohorts ?? [], [calibration, days]);
    const selectedZone = availableZones.some((item) => item.zone === zone) ? zone : availableZones[0]?.zone ?? 'mixed';
    const selectView = (nextView: CalibrationView) => setView(nextView);

    return <section className={styles.calibration} aria-label="Historical calibration" data-testid="market-calibration">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Comparable readings → subsequent outcomes</span><h2>Historical calibration</h2></div><span className={styles.tag}>{calibration ? 'Connected dataset' : 'Unavailable'}</span></div>
        <p className={styles.panelIntro}>{calibration ? `${calibration.benchmark_name} forward outcomes across the connected ${signal.metadata.market} calibration dataset.` : 'No historical calibration response is available for this market and configuration.'}</p>
        {!calibration ? <div className={styles.unavailable}><b>Historical calibration is unavailable</b><p>The signal response does not include historical validation metadata. No fixture or sampled replacement is shown.</p></div> : <>
            <div className={styles.studyMeta}>{calibration.snapshot_count} stored scores · {calibration.timeline.length} paired timeline points · {calibration.observed_snapshot_count} observed · {calibration.reconstructed_snapshot_count} reconstructed · benchmark through {dateLabel(calibration.data_through_date)} · model {calibration.model_version}</div>
            <div className={styles.calibrationTabs} role="tablist" aria-label="Calibration views">{views.map((name, index) => <button key={name} id={`connected-calibration-tab-${index}`} type="button" role="tab" aria-selected={view === name} tabIndex={view === name ? 0 : -1} aria-controls="connected-calibration-view" onClick={() => selectView(name)} onKeyDown={(event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length; document.getElementById(`connected-calibration-tab-${next}`)?.focus(); }}>{name}</button>)}</div>
            <div id="connected-calibration-view" role="tabpanel" aria-labelledby={`connected-calibration-tab-${views.indexOf(view)}`}>
                {view === 'Timeline' ? <MarketV8Timeline market={signal.metadata.market} mode={signal.mode} partial={false} data={calibration.timeline} benchmarkLabel={calibration.benchmark_name} modelVersion={calibration.model_version} snapshotDate={calibration.data_through_date ?? undefined} /> : <>
                    <label className={styles.sourceToggle}><input type="checkbox" checked={observedOnly} onChange={(event) => setObservedOnly(event.target.checked)} />Observed-origin scores only</label>
                    {view === 'Forward outcomes' && <ForwardOutcomes calibration={calibration} zone={selectedZone} observedOnly={observedOnly} days={days} onDaysChange={setDays} onZoneChange={setZone} negativeOnly={negativeOnly} onNegativeOnlyChange={setNegativeOnly} />}
                    {view === 'Score zones' && <ZoneComparison calibration={calibration} observedOnly={observedOnly} />}
                    {view === 'Cases' && <CasesView calibration={calibration} observedOnly={observedOnly} />}
                    {view === 'Method' && <MethodView calibration={calibration} />}
                </>}
            </div>
        </>}
    </section>;
}

export default ConnectedHistory;
