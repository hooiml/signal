'use client';

import { useState } from 'react';
import { simulateMarketScore } from '@/lib/market-sensitivity';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { HistoricalCalibration, ContextReadings, SourceAccounting } from './MarketV8Restored';
import { IndicatorExplanation, WatchNext, Developments, SummaryLimits } from './MarketV8Explanations';
import { MarketChart } from './MarketV8Chart';
import { dateLabel, signed, stance, zoneLabel, type ExplorerIndicator, type InvestigationTab, type Market, type Mode } from './market-v8-fixtures';
import styles from './market-v8.module.css';

export function IndicatorInspector({ indicator, signal, previous, date, onClose, historical, unavailable }: { indicator: ExplorerIndicator; signal: MarketSignal; previous: MarketSignal; date: string; onClose: () => void; historical: boolean; unavailable: boolean }) {
    const part = signal.components[indicator.key];
    const before = previous.components[indicator.key];
    const delta = part && before ? part.score * part.weight - before.score * before.weight : null;
    const status = unavailable ? 'Unavailable' : stance(indicator, signal);
    return <>
        <div className={styles.railHeading}><span className={styles.eyebrow}>Indicator detail</span><button onClick={onClose} aria-label="Close indicator detail" className={styles.closeButton}>×</button></div>
        <h2>{indicator.name}</h2>
        <div className={styles.tagLine}><span className={styles.tag}>{indicator.context ? 'Context only' : 'Scored input'}</span><span className={status === 'Conflict' ? styles.conflict : styles.support}>{status}</span></div>
        <div className={styles.rawValue}>{unavailable || indicator.value === null ? '—' : indicator.value.toFixed(indicator.key === 'put_call' ? 3 : 2)} <small>{indicator.units}</small></div>
        {!historical && !unavailable && indicator.prior !== null && indicator.value !== null && <p className={styles.muted}>{signed(indicator.value - indicator.prior)} {indicator.units} vs {indicator.cadence === 'Weekly' ? 'prior weekly observation' : '3 Sep'}</p>}
        <p className={styles.muted}>{unavailable ? `No input record · ${dateLabel(date)}` : `Observed ${dateLabel(indicator.date)} 2026 · ${indicator.cadence}`}</p>
        {!unavailable && indicator.history.length > 0 ? <MarketChart key={indicator.key + date} points={indicator.history} raw name={`${indicator.name} raw history`} /> : <div className={styles.unavailable}>History unavailable <small>No replacement observations are inferred.</small></div>}
        {!historical && delta !== null && <div className={styles.explanation}><b>{delta > 0 && status === 'Conflict' ? 'Improved, but still conflicting' : 'How this input changed'}</b><p>Its weighted contribution changed by {signed(delta)} points since 3 September.{status === 'Conflict' ? ' Its normalized reading still disagrees with the current market zone.' : ' This describes the model contribution, not an expected market return.'}</p></div>}
        <IndicatorExplanation indicator={indicator} market={signal.metadata.market} />
        <h3>Why it matters</h3><p>{indicator.meaning}</p>
        <h3>Source & limitations</h3><p>{indicator.source} · representative fixture. {indicator.limitation}</p>
        {part && !unavailable && <details className={styles.disclosure}><summary>Scoring details</summary><dl className={styles.keyValues}><div><dt>Normalized input</dt><dd>{part.score.toFixed(2)} /100</dd></div><div><dt>Configured weight</dt><dd>{(part.weight * 100).toFixed(0)}%</dd></div><div><dt>Weighted contribution</dt><dd>{(part.score * part.weight).toFixed(2)} pts</dd></div><div><dt>Effect vs neutral reference</dt><dd>{signed((part.score - 50) * part.weight)} pts</dd></div></dl><p>Raw values, normalized scores and contribution points use different units. None is a forecast.</p></details>}
    </>;
}

type PanelProps = { partial: boolean; socialEnabled: boolean; tab: InvestigationTab; indicators: ExplorerIndicator[]; signal: MarketSignal; previous: MarketSignal; market: Market; mode: Mode; historical: boolean; available: boolean; date: string; onSelect: (key: string, trigger: HTMLButtonElement) => void };
export function InvestigationPanel(props: PanelProps) {
    const { tab, indicators, signal, previous, historical, available, onSelect, date, market } = props;
    if (tab === 'Scenarios') return historical || !available ? <Unavailable title="Scenarios need a current snapshot" text="Return to current conditions to explore changes to available normalized inputs." /> : <Scenarios signal={signal} />;
    if (tab === 'Context') return <ContextPanel market={market} historical={historical} partial={props.partial} />;
    if (tab === 'History') return <HistoryPanel historical={historical} available={available} date={date} market={market} mode={props.mode} score={signal.composite_score} partial={props.partial} socialEnabled={props.socialEnabled} />;
    if (!available) return <Unavailable title="Underlying evidence is unavailable" text="The saved score can be compared, but no current readings are substituted for this historical snapshot." />;
    if (tab === 'Evidence') return <>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Observation → interpretation</span><h2>The evidence behind the reading</h2></div><span className={styles.tag}>Illustrative sources</span></div>
        <div className={styles.evidenceList}>{indicators.map(i => <button key={i.key} className={styles.evidenceButton} onClick={e => onSelect(i.key, e.currentTarget)}><span><b>{i.name}</b><small>{i.value === null ? 'No observation supplied' : `${i.source} · ${dateLabel(i.date)} · ${i.cadence}`}</small></span><span className={stance(i, signal) === 'Conflict' ? styles.conflict : styles.muted}>{stance(i, signal)} ↗</span></button>)}</div>
        <details className={styles.disclosure}><summary>Coverage, freshness & model accounting</summary><p>{Object.keys(signal.components).length} inputs are active. {Math.round((signal.metadata.coverage_adjustment?.active_weight ?? 0) * 100)}% of configured weight has eligible observations. Missing, stale or disabled weight retains a neutral contribution of {signal.metadata.coverage_adjustment?.neutral_points.toFixed(2)} points; it is not market evidence.</p><p>Daily and weekly sources have different cadences. Freshness is assessed at each snapshot date. These are representative fixtures; no provider was contacted.</p></details>
        <SummaryLimits signal={signal} indicators={indicators} />
        <SourceAccounting signal={signal} indicators={indicators} />
    </>;
    if (historical) return <Unavailable title="Daily change is not supplied for this snapshot" text="Explore its dated evidence or compare the saved score with today in History." />;
    const keys = [...new Set([...Object.keys(signal.components), ...Object.keys(previous.components)])];
    const rows = keys.map(key => {
        const now = signal.components[key]; const before = previous.components[key];
        return { key, change: (now ? now.score * now.weight : 0) - (before ? before.score * before.weight : 0), lost: !now };
    });
    const rawDelta = rows.reduce((sum, row) => sum + row.change, 0);
    const reserveDelta = (signal.metadata.coverage_adjustment?.neutral_points ?? 0) - (previous.metadata.coverage_adjustment?.neutral_points ?? 0);
    const delta = signal.composite_score - previous.composite_score;
    return <>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>What changed · 3 → 4 Sep 2026</span><h2>What moved the score?</h2></div><span className={styles.delta}>{signed(delta, 0)} <small>score points</small></span></div>
        <div className={styles.changeGrid}>
            <div className={styles.contributors}>{[...rows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).map(d => {
                const change = d.change;
                return <button key={d.key} className={styles.contributor} onClick={e => onSelect(d.key, e.currentTarget)}><span>{indicators.find(i => i.key === d.key)?.short}</span><span className={styles.barTrack}><span className={change < 0 ? styles.negativeBar : styles.positiveBar} style={{ width: `${Math.min(100, Math.abs(change) / 2 * 100)}%` }} /></span><b className={change < 0 ? styles.conflict : styles.support}>{signed(change)}</b><span aria-hidden="true">↗</span></button>;
            })}{rows.some(row => row.lost) && <p className={styles.muted}>Missing or stale inputs lose their observed contribution. Neutral reserve replaces their configured weight; this is a coverage change.</p>}<details className={styles.rounding}><summary>How the change reconciles</summary><p>Observed contribution changes: {signed(rawDelta)} points. Neutral reserve change: {signed(reserveDelta)}. Rounding adjustment: {signed(delta - rawDelta - reserveDelta)}. Displayed change: {signed(delta, 0)}.</p></details></div>
            <div className={styles.changeReason}><span className={styles.tag}>Derived interpretation</span><h3>{rows.some(row => row.lost) ? 'Coverage changed the reading.' : market === 'US' ? 'Calmer volatility. A remaining conflict.' : 'News leads. Coverage matters.'}</h3><p>{rows.some(row => row.lost) ? 'Previously available evidence is now missing or stale. Neutral reserve replaces those inputs, so this change does not establish a deterioration in market conditions.' : market === 'US' ? 'Volatility improved between the two snapshots, but its normalized reading remains below the mixed zone. Stronger sentiment does not erase that disagreement.' : 'News tone is slightly firmer. With 65% of the configured weight assigned to news, independent local evidence matters.'}</p><button className={styles.textButton} onClick={e => onSelect(market === 'US' ? 'vix' : 'news', e.currentTarget)}>Investigate the leading input <span>→</span></button></div>
        </div>
        <Developments market={market} partial={props.partial} />
    </>;
}
function Unavailable({ title, text }: { title: string; text: string }) { return <div className={styles.unavailable}><h2>{title}</h2><p>{text}</p></div>; }

function Scenarios({ signal }: { signal: MarketSignal }) {
    const [overrides, setOverrides] = useState<Record<string, number>>({});
    const [key, setKey] = useState(Object.keys(signal.components)[0] ?? '');
    const result = simulateMarketScore(signal, overrides);
    const active = signal.components[key];
    return <>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Hypothetical · fixed weights</span><h2>What would change the reading?</h2></div><button className={styles.secondaryButton} onClick={() => setOverrides({})}>Reset scenario</button></div>
        <WatchNext signal={signal} />
        <p className={styles.panelIntro}>Explore normalized input scores. Raw observations and the volatility regime stay fixed.</p>
        <div className={styles.scenarioGrid}><div><label className={styles.field}>Input to explore<select aria-label="Scenario input" value={key} onChange={e => setKey(e.target.value)}>{Object.values(signal.components).map(d => <option key={d.name} value={d.name}>{d.display_name}</option>)}</select></label>{active && <><label className={styles.sliderLabel} htmlFor="scenario-score">Normalized score <b>{overrides[key] ?? active.score}</b></label><input id="scenario-score" type="range" min="0" max="100" step="1" value={overrides[key] ?? active.score} onChange={e => setOverrides({ ...overrides, [key]: Number(e.target.value) })} /><div className={styles.scaleLabels}><span>0</span><span>50 · neutral</span><span>100</span></div></>}<p className={styles.muted}>{Object.keys(overrides).length ? `${Object.keys(overrides).length} input assumption(s) active together.` : 'No assumptions changed yet.'}</p></div><div className={styles.simulated} aria-live="polite"><span>Simulated score</span><strong>{result.simulatedScore}<small>/100</small></strong><b>{signed(result.scoreDelta, 0)} vs current {signal.composite_score}</b><p>{zoneLabel(result.simulatedScore, signal.mode)} · {signal.mode === 'standard' ? 'Momentum' : 'Contrarian'}</p></div></div>
        <details className={styles.disclosure}><summary>Active assumptions & limitations</summary>{result.drivers.filter(d => d.baseScore !== d.simulatedScore).map(d => <p key={d.key}>{d.name}: {d.baseScore.toFixed(2)} → {d.simulatedScore.toFixed(2)}; contribution {signed(d.contributionDelta)} points.</p>)}<p>The existing simulator retains {result.neutralPoints.toFixed(2)} neutral-reserve points. This is sensitivity arithmetic, not a forecast, new raw-data normalization or a saved market reading.</p></details>
    </>;
}
function ContextPanel({ market, historical, partial }: { market: Market; historical: boolean; partial: boolean }) {
    const [reminder, setReminder] = useState(false);
    if (historical) return <Unavailable title="Context for this date is not supplied" text="Later headlines and current rates are excluded from this historical fixture." />;
    return <>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Beyond the composite</span><h2>Keep the wider picture in view.</h2></div><span className={styles.tag}>Context only</span></div>
        <ContextReadings market={market} partial={partial} />
        <div className={styles.contextActions}><div><h3>Developments & alerts</h3><p>Representative developments are available in What changed. No live alert or notification is supplied. Check evidence freshness before relying on a stale survey.</p><button className={styles.secondaryButton} onClick={() => setReminder(!reminder)}>{reminder ? 'Remove session reminder' : 'Flag source review'}</button><p role="status" className={styles.muted}>{reminder ? 'Source review flagged for this session only. No notification scheduled.' : 'Local exploration only · no background monitoring.'}</p></div><div><h3>Continue in company research</h3><p>Investigate how market conditions relate to a company’s own thesis. No exposure mapping or company recommendation is inferred.</p><a className={styles.textButton} href="/research-v8">Choose a company in Research →</a></div></div>
    </>;
}
function HistoryPanel({ historical, available, date, market, mode, score, partial, socialEnabled }: { historical: boolean; available: boolean; date: string; market: Market; mode: Mode; score: number; partial: boolean; socialEnabled: boolean }) {
    return <>
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Dated evidence · illustrative archive</span><h2>{historical ? `Snapshot of ${dateLabel(date)}` : 'Put the current reading in context.'}</h2></div><span className={styles.tag}>{available ? 'Fixture records available' : 'Score record only'}</span></div>
        <p className={styles.panelIntro}>{available ? 'The available synthetic input records belong to this snapshot. Inspect an indicator above to see its dated evidence.' : 'This example contains a score and date, but no underlying records. Missing readings are not zero and current observations are not substituted.'}</p>
        <HistoricalCalibration market={market} mode={mode} score={score} partial={partial} historical={historical} socialEnabled={socialEnabled} />
        <details className={styles.disclosure}><summary>Historical methodology & uncertainty</summary><p>Production distinguishes observed, backfilled and reconstructed snapshots. The history response can expose underlying records when available; this prototype supplies a complete 28 August example and score-only examples on other dates.</p><p>Outcome statistics require at least five eligible observations. Established directional evidence requires at least 20, including five observed records. Overlapping samples and reconstructed inputs must remain visible. Historical outcomes are not forecasts, transaction-cost-adjusted backtests or out-of-sample proof.</p></details>
    </>;
}
