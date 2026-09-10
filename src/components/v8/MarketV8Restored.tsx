'use client';

import { useState } from 'react';
import { MarketV8Timeline } from './MarketV8Timeline';
import { tierForMarketScore } from '@/lib/market-sensitivity';
import { getCalibrationZone, MARKET_SCORE_MODEL_VERSION } from '@/lib/market-calibration';
import { getIndicatorBaseWeights, INDICATOR_REGISTRY } from '@/lib/indicator-registry';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { calibrationRows, calibrationZones, contextReadings, outcomeStats, rowsInZone, type CalibrationZone, type Outcome } from './market-v8-restored-fixtures';
import { dateLabel, signed, stance, type ExplorerIndicator, type Market, type Mode } from './market-v8-fixtures';
import styles from './market-v8.module.css';

export function HistoricalCalibration({ market, mode, score, partial, historical, socialEnabled }: { market: Market; mode: Mode; score: number; partial: boolean; historical: boolean; socialEnabled: boolean }) {
    const views = ['Timeline', 'Forward outcomes', 'Score zones', 'Cases', 'Method'] as const;
    const [view, setView] = useState<typeof views[number]>('Timeline');
    const [days, setDays] = useState<7 | 30>(7);
    const [zone, setZone] = useState<CalibrationZone>(getCalibrationZone(score) ?? 'mixed');
    const [observedOnly, setObservedOnly] = useState(false);
    const [negativeOnly, setNegativeOnly] = useState(false);
    const rows = calibrationRows(market, partial).filter(row => !observedOnly || row.origin === 'observed');
    const cohort = rowsInZone(rows, zone);
    const stats = outcomeStats(cohort, days);
    const baseline = outcomeStats(rows, days);
    const cases = cohort.filter(row => !negativeOnly || (days === 7 ? row.seven : row.thirty) < 0);
    const dates = rows.map(row => row.date).sort();
    const outcomesThrough = new Date(Date.parse(dates.at(-1)!) + days * 86400000).toISOString().slice(0,10);
    const unavailable = historical || (market === 'US' && !socialEnabled);
    const benchmark = market === 'US' ? 'VOO' : 'FBM KLCI';
    return <section className={styles.calibration} aria-label="Historical calibration">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Comparable readings → subsequent outcomes</span><h2>Historical calibration</h2></div><span className={styles.tag}>Synthetic study</span></div>
        <p className={styles.panelIntro}>Explore the score alongside prices, then inspect subsequent outcomes. All records are invented examples and provide no evidence of Signal’s performance.</p>
        {unavailable ? <div className={styles.unavailable}><b>{historical ? 'Calibration at this historical cutoff is unavailable' : 'Social-off calibration is unavailable'}</b><p>{historical ? 'Current-study outcomes are withheld while viewing a past snapshot. Return to current to explore the synthetic study.' : 'This study belongs to the Social-on configuration. Its outcomes are not reused for another model configuration.'}</p></div> : <>
            <div className={styles.calibrationTabs} role="tablist" aria-label="Calibration views">{views.map((name,index) => <button key={name} id={`calibration-tab-${index}`} role="tab" aria-selected={view === name} tabIndex={view === name ? 0 : -1} aria-controls="calibration-view" onClick={() => setView(name)} onKeyDown={e => {
                if (!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)) return;
                e.preventDefault();
                const next = e.key === 'Home' ? 0 : e.key === 'End' ? views.length-1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length;
                document.getElementById(`calibration-tab-${next}`)?.focus();
            }}>{name}</button>)}</div>
            <div id="calibration-view" role="tabpanel" aria-labelledby={`calibration-tab-${views.indexOf(view)}`}>
                {view === 'Timeline' ? <MarketV8Timeline market={market} mode={mode} partial={partial} /> : <>
                    <label className={styles.sourceToggle}><input type="checkbox" checked={observedOnly} onChange={e => setObservedOnly(e.target.checked)} />Observed-origin examples only</label>
                    {view === 'Forward outcomes' && <>
                        <div className={styles.restoreControls}><fieldset className={styles.segment}><legend className={styles.visuallyHidden}>Outcome horizon</legend>{([7,30] as const).map(n => <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n}-day outcomes</button>)}</fieldset><label className={styles.field}>Score zone<select aria-label="Score zone" value={zone} onChange={e => setZone(e.target.value as CalibrationZone)}>{calibrationZones.map(z => <option key={z.id} value={z.id}>{z.label}</option>)}</select></label></div>
                        <p className={styles.studyMeta}>{benchmark} benchmark returns · observations {dateLabel(dates[0])}–{dateLabel(dates.at(-1)!)} 2026 · outcomes through {dateLabel(outcomesThrough)} · {stats.count} comparable / {baseline.count} total samples</p>
                        <div className={styles.studyMetrics} aria-live="polite"><div><span>Median subsequent return</span><strong>{stats.sufficient ? returnLabel(stats.median) : '—'}</strong><small>All-zone baseline: {baseline.sufficient ? returnLabel(baseline.median) : '—'}</small></div><div><span>Positive-return frequency</span><strong>{stats.sufficient ? `${stats.positive!.toFixed(0)}%` : '—'}</strong><small>Baseline: {baseline.sufficient ? `${baseline.positive!.toFixed(0)}%` : '—'} · not forecast accuracy</small></div><div><span>Outcome range</span><strong>{stats.sufficient ? `${returnLabel(stats.worst)} to ${returnLabel(stats.best)}` : '—'}</strong><small>{stats.observed} observed-origin / {stats.count-stats.observed} reconstructed-origin examples</small></div></div>
                        <p className={styles.studyNotice}>{stats.sufficient ? 'Preliminary sample size · descriptive only.' : 'Insufficient evidence · at least 5 comparable samples are required. Summary estimates are withheld.'} Provenance labels describe synthetic record types, not real captured data.</p>
                        <div className={styles.sectionHeading}><h3>Inspect the outcomes</h3><label className={styles.sourceToggle}><input type="checkbox" checked={negativeOnly} onChange={e => setNegativeOnly(e.target.checked)} />Negative returns only</label></div>
                        <div className={styles.outcomeList}>{cases.length ? cases.map(row => <details key={row.date} className={styles.outcomeRow}><summary><span>{dateLabel(row.date)} 2026<small>Score {row.score} · {row.origin} example</small></span><b className={(days === 7 ? row.seven : row.thirty) < 0 ? styles.conflict : styles.support}>{returnLabel(days === 7 ? row.seven : row.thirty)}</b><span aria-hidden="true">＋</span></summary><p>Synthetic {benchmark} return over {days} calendar days after this example reading. The {row.origin} label describes fixture provenance only. Price direction alone does not establish a correct investment decision.</p></details>) : <div className={styles.unavailable}>No negative-return examples match this selection.</div>}</div>
                    </>}
                    {view === 'Score zones' && <ZoneComparison rows={rows} />}
                    {view === 'Cases' && <CalibrationCases rows={rows} mode={mode} />}
                    {view === 'Method' && <StudyMethod rows={rows} market={market} mode={mode} />}
                </>}
            </div>
        </>}
    </section>;
}

const returnLabel = (value: number | null) => value === null ? '—' : `${signed(value)}%`;
function ZoneComparison({ rows }: { rows: Outcome[] }) {
    return <section aria-label="Score-zone comparison"><h3>Every zone, both horizons</h3><p className={styles.panelIntro}>Compare each zone with the all-zone baseline under the same origin filter. These are descriptive samples, not independent trials.</p><table className={styles.zoneTable}><caption>7-day and 30-day benchmark outcomes</caption><thead><tr><th scope="col">Score zone</th><th scope="col">7 days</th><th scope="col">30 days</th></tr></thead><tbody>{[...calibrationZones.map(z => ({ label:z.label, records:rowsInZone(rows,z.id) })), { label:'All-zone baseline',records:rows }].map(group => <tr key={group.label}><th scope="row">{group.label}</th>{([7,30] as const).map(days => { const s=outcomeStats(group.records,days);return <td key={days}><b>{s.sufficient ? returnLabel(s.median) : '—'} median</b><span>{s.sufficient ? `${s.positive!.toFixed(0)}% positive` : 'Insufficient sample'}</span><small>{s.count} samples · {s.observed} observed-origin</small></td>;})}</tr>)}</tbody></table><p className={styles.studyNotice}>At least 5 comparable samples are needed for summary estimates. Positive-return frequency is not a model hit rate. Every individual zone in this fixture is preliminary or insufficient.</p></section>;
}
function CalibrationCases({ rows, mode }: { rows: Outcome[]; mode: Mode }) {
    const classified = rows.map(row => {
        const tier=tierForMarketScore(row.score,mode);
        const direction=tier.includes('buy') ? 1 : tier.includes('sell') ? -1 : 0;
        return { ...row, kind:direction === 0 ? Math.abs(row.thirty)>=5 ? 'neutral' : 'other' : row.thirty===0 ? 'other' : row.thirty*direction>0 ? 'aligned' : 'mismatch' };
    }).sort((a,b)=>Math.abs(b.thirty)-Math.abs(a.thirty)||a.date.localeCompare(b.date));
    return <section aria-label="Calibration case categories"><h3>Where the interpretation held—and missed</h3><p className={styles.panelIntro}>All score zones · 30-day outcomes · {mode === 'standard' ? 'Momentum' : 'Contrarian'} interpretation. Cases are ranked by absolute move using the same origin filter.</p>{[
        ['mismatch','Directional mismatches','A positive interpretation preceded a decline, or a negative interpretation preceded a rally.'],
        ['aligned','Aligned periods','The direction of the later return matched the selected mode’s interpretation.'],
        ['neutral','Neutral, then a sharp move','A neutral reading preceded an absolute 30-day benchmark move of at least 5%.'],
    ].map(([kind,title,description]) => <details className={styles.disclosure} key={kind} open={kind==='mismatch'}><summary>{title} · {classified.filter(row=>row.kind===kind).length}</summary><p>{description}</p>{classified.filter(row=>row.kind===kind).length ? <ul className={styles.caseList}>{classified.filter(row=>row.kind===kind).map(row=><li key={row.date}><span>{dateLabel(row.date)} 2026 · score {row.score}<small>{row.origin} example</small></span><b>{returnLabel(row.thirty)}</b></li>)}</ul> : <p>No qualifying examples under this filter. No replacement cases are inferred.</p>}</details>)}<p className={styles.studyNotice}>An aligned direction is not proof of a profitable decision. Observations overlap, transaction costs are excluded, and no strategy accuracy is inferred.</p></section>;
}
function StudyMethod({ rows, market, mode }: { rows: Outcome[]; market: Market; mode: Mode }) {
    const dates=rows.map(row=>row.date).sort();
    return <section aria-label="Calibration study identity"><h3>Study identity & safeguards</h3><dl className={styles.keyValues}><div><dt>Scoring-rule reference</dt><dd>{MARKET_SCORE_MODEL_VERSION}</dd></div><div><dt>Fixture study</dt><dd>V8-demo-1 · synthetic</dd></div><div><dt>Configuration</dt><dd>{market} · {mode === 'standard' ? 'Momentum' : 'Contrarian'}{market === 'US' ? ' · Social on' : ''}</dd></div><div><dt>Observation window</dt><dd>{dateLabel(dates[0])}–{dateLabel(dates.at(-1)!)} 2026</dd></div><div><dt>Provenance</dt><dd>{rows.filter(row=>row.origin==='observed').length} observed-origin / {rows.filter(row=>row.origin==='reconstructed').length} reconstructed-origin examples</dd></div><div><dt>Out-of-sample validation</dt><dd>Not available</dd></div></dl><p className={styles.panelIntro}>The study uses assigned fixture scores and returns. It is not generated from provider prices, the overview chart or the separate timeline demonstration.</p><ul className={styles.methodList}><li>Both cohort and baseline use the same market, horizon and origin filter; baseline includes all score zones.</li><li>Seven and thirty are calendar-day outcome windows, not recommended holding periods. Outcome data is never a scoring input.</li><li>Five samples permit summaries. Established evidence requires twenty comparable observations including five observed records; no fixture zone meets this threshold.</li><li>Observed provenance does not establish out-of-sample validation. Overlapping windows are not independent.</li><li>Mode changes interpretation and case classification, not the underlying historical return. No predictive accuracy, causal effect or transaction-cost-adjusted backtest is shown.</li></ul></section>;
}

export function MarketConfirmation({ market, partial, onOpen }: { market: Market; partial: boolean; onOpen: () => void }) {
    return <section className={styles.confirmation} aria-label="Market confirmation"><div><span className={styles.eyebrow}>Market confirmation · context only</span><h3>{partial ? 'Confirmation is incomplete.' : market === 'US' ? 'Indices rise. Participation is narrower.' : 'KLCI is firmer. Breadth is unverified.'}</h3><p>{partial ? 'Some context observations are missing or older. Open the dated evidence before drawing a broader conclusion.' : market === 'US' ? 'Synthetic snapshot: S&P 500 +0.8%; equal weight trails cap weight by 1.2 pp over one month.' : 'Synthetic snapshot: FBM KLCI +0.3%. This index move alone does not establish broad participation.'}</p></div><button className={styles.textButton} onClick={onOpen}>Explore market context →</button></section>;
}

export function ContextReadings({ market, partial }: { market: Market; partial: boolean }) {
    return <><p className={styles.panelIntro}>Representative observations · 4 Sep 2026 snapshot. Context provides a separate cross-check and never changes the composite score.</p><div className={styles.contextList}>{contextReadings(market, partial).map((item,index) => {
        const missing = partial && index === 0;
        const stale = partial && index === 1;
        return <details key={item.name}><summary><span><b>{item.name}</b><small>{missing ? 'Observation unavailable' : item.reading}</small></span><span className={styles.muted}>{missing ? 'Missing' : stale ? 'Older example' : 'View evidence'} ＋</span></summary><p><b>{missing ? 'No replacement reading is inferred.' : item.reasoning}</b></p>{!missing && <p>Observation date: {dateLabel(item.date)} 2026 · {item.cadence}. {stale ? 'Retained for context only; current confirmation is unavailable.' : ''}</p>}{!missing && item.facts && <ul className={styles.contextFacts}>{item.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>}<p>{item.source} · representative fixture. {item.limitation}</p><p>No provider document is attached to this synthetic reading. Source verification remains unavailable.</p></details>;
    })}</div></>;
}

export function SourceAccounting({ signal, indicators }: { signal: MarketSignal; indicators: ExplorerIndicator[] }) {
    const weights = getIndicatorBaseWeights(signal.metadata.market);
    const strongest = Object.entries(weights).filter(([,weight]) => weight > 0).sort((a,b) => b[1]-a[1])[0];
    return <section className={styles.calibration} aria-label="Source accounting"><h3>Every configured input, including the gaps</h3><p className={styles.studyNotice}>{INDICATOR_REGISTRY[strongest[0]].displayName} carries {(strongest[1]*100).toFixed(0)}% of configured weight. Several indicators agreeing does not mean that their sources are independent. Provider health has not been checked.</p><div className={styles.contextList}>{Object.entries(weights).filter(([,weight]) => weight > 0).map(([key,weight]) => {
        const input = indicators.find(i => i.key === key);
        const part = signal.components[key];
        const registry = INDICATOR_REGISTRY[key];
        return <details key={key}><summary><span><b>{registry.displayName}</b><small>{Math.round(weight*100)}% configured · {part ? `${(part.score*part.weight).toFixed(2)} observed contribution pts` : `${(weight*50).toFixed(2)} neutral-reserve pts`}</small></span><span className={styles.muted}>{input ? stance(input,signal) : 'Manual input unset'} ＋</span></summary><p>{input?.value !== null && input ? `Fixture observation: ${dateLabel(input.date)} 2026. ` : 'No observation supplied. '}{registry.frequency} cadence · eligible freshness window {registry.staleAfterDays} day{registry.staleAfterDays === 1 ? '' : 's'}.</p><p>{input?.limitation ?? 'BofA SSI is a manual institutional-sentiment input. No dated value or source report is attached; the reserve does not imply neutral institutional sentiment.'}</p><p>Source status: unchecked. No live connection or source document was verified. {part ? 'Included in this fixture’s score.' : 'Excluded from observed evidence; configured weight retains neutral reserve.'}</p></details>;
    })}</div></section>;
}
