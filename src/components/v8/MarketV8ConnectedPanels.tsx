'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { getIndicatorBaseWeights, INDICATOR_REGISTRY } from '@/lib/indicator-registry';
import { simulateMarketScore } from '@/lib/market-sensitivity';
import { formatRawValue, getIndicatorCadence } from '@/components/v2/cockpit-utils';
import type { IndicatorData, MarketSignal } from '@/lib/types/signal-v2';
import styles from './market-v8.module.css';
import { missingInputExplanation } from './MarketV8Coverage';

type Point = { date: string; value: number };
export type ScenarioState = { overrides: Record<string, number>; baseline: MarketSignal | null; selectedKey: string };
export const emptyScenario = (): ScenarioState => ({ overrides: {}, baseline: null, selectedKey: '' });

type ConnectedPanelsProps = {
    readonly signal: MarketSignal;
    readonly tab: string;
    readonly onSelect: (key: string, element: HTMLButtonElement) => void;
    readonly scenario: ScenarioState;
    readonly setScenario: Dispatch<SetStateAction<ScenarioState>>;
};

type ConnectedIndicatorProps = {
    readonly signal: MarketSignal;
    readonly indicatorKey: string;
    readonly onClose: () => void;
    /** Raw observations from the signal history endpoint, when the parent has them. */
    readonly history?: readonly Point[];
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
        : new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
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
    if (indicator.enabled === false) return 'Disabled';
    const staleAfterDays = INDICATOR_REGISTRY[key]?.staleAfterDays;
    const snapshotDate = signal.metadata.score_delta?.snapshot_date ?? new Date().toISOString();
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

function RawHistoryChart({ points }: { points: readonly Point[] }) {
    if (points.length < 2) return <div className={styles.unavailable}><b>Raw history unavailable</b><small>No replacement observations are inferred.</small></div>;
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
    const path = locations.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
    const latest = points.at(-1)!;
    return <div className={styles.chart} aria-label="Archived raw readings">
        <div className={styles.chartTopline}><span>Archived raw readings</span><output>{formatDate(latest.date)} <b>{latest.value.toFixed(2)}</b></output></div>
        <svg className={styles.sparkline} viewBox="0 0 160 44" role="img" aria-label={`Archived raw readings through ${formatDate(latest.date)}`}><path d={path} fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        <div className={styles.chartDates}><span>{formatDate(points[0].date)}</span><span>{formatDate(latest.date)}</span></div>
    </div>;
}

export function ConnectedIndicator({ signal, indicatorKey, onClose, history, sourceEnabled = true }: ConnectedIndicatorProps) {
    const indicator = signal.components[indicatorKey];
    const driver = signal.metadata.score_drivers?.find((item) => item.key === indicatorKey);
    const registry = INDICATOR_REGISTRY[indicatorKey];
    const contribution = driver?.contribution ?? (indicator ? indicator.score * indicator.weight : null);
    const normalized = indicator?.score ?? driver?.score;
    const configuredWeight = modelWeights(signal)[indicatorKey];
    const rawHistory = validHistory(history);
    const sourceUrls = safeHttpUrls(indicator?.metadata?.source_url);
    const sourceBlend = indicator?.metadata?.source_breakdown;
    const status = freshnessStatus(signal, indicator, indicatorKey);

    if (!indicator) {
        return <><div className={styles.railHeading}><span className={styles.eyebrow}>Indicator detail</span><button onClick={onClose} aria-label="Close indicator detail" className={styles.closeButton}>×</button></div><h2>{registry?.displayName ?? indicatorKey}</h2><Unavailable title={(indicatorKey === 'social' || indicatorKey === 'news') && !sourceEnabled ? 'Input switched off' : 'Current value unavailable'} detail={missingInputExplanation(indicatorKey, sourceEnabled)} /><p className={styles.muted}>The current raw value, normalized score and observation date remain unavailable.</p>{rawHistory.length > 0 && <><p className={styles.muted}>Historical readings only · these snapshots do not supply a current value.</p><RawHistoryChart points={rawHistory} /></>}<p className={styles.muted}>Review source coverage for the existing model’s missing-input accounting.</p></>;
    }

    return <>
        <div className={styles.railHeading}><span className={styles.eyebrow}>Indicator detail</span><button onClick={onClose} aria-label="Close indicator detail" className={styles.closeButton}>×</button></div>
        <h2>{indicator?.display_name ?? driver?.name ?? registry?.displayName ?? indicatorKey}</h2>
        <div className={styles.tagLine}><span className={styles.tag}>{status}</span><span className={styles.muted}>{registry?.category ?? 'Unclassified'}</span></div>
        <div className={styles.rawValue}>{rawValue(indicator, driver, signal.metadata.market)} <small>{indicator ? '' : 'raw value'}</small></div>
        <p className={styles.muted}>Observed {formatDate(indicator?.last_updated ?? driver?.last_updated)} · {cadence(indicator, indicatorKey)} · horizon {horizon(indicator)}</p>
        <RawHistoryChart points={rawHistory} />

        <dl className={styles.keyValues}>
            <div><dt>Normalized score</dt><dd>{scoreLabel(normalized)}</dd></div>
            <div><dt>Contribution</dt><dd>{finiteNumber(contribution) ? `${signed(contribution)} points` : 'Unavailable'}</dd></div>
            <div><dt>Active weight</dt><dd>{finiteNumber(indicator?.weight ?? driver?.weight) ? `${((indicator?.weight ?? driver?.weight) * 100).toFixed(1)}%` : 'Unavailable'}</dd></div>
            <div><dt>{configuredWeightLabel(signal)}</dt><dd>{finiteNumber(configuredWeight) ? `${(configuredWeight * 100).toFixed(1)}%` : 'Unavailable'}</dd></div>
            <div><dt>Historical percentile</dt><dd>{finiteNumber(indicator?.percentile) ? `${indicator.percentile.toFixed(1)}th` : 'Unavailable'}</dd></div>
        </dl>

        {sourceBlend && Object.keys(sourceBlend).length > 0 ? <div className={styles.explanation}><b>Source readings</b><p>{Object.entries(sourceBlend).map(([name, value]) => `${name}: ${finiteNumber(value) ? value.toFixed(3) : 'Unavailable'}`).join(' · ')}</p><p className={styles.muted}>These values are source readings from the payload, not mixture percentages.</p></div> : null}
        <h3>Interpretation context</h3><p>{modeText(signal, indicatorKey)}</p>
        {driver?.detail ? <p className={styles.muted}>{driver.detail}</p> : null}
        {indicator?.metadata?.mode_note ? <p className={styles.muted}>{indicator.metadata.mode_note}</p> : null}
        <details className={styles.disclosure}><summary>Normalization rule</summary><p>{normalizationNote(indicatorKey)}</p><p className={styles.muted}>The displayed raw value, normalized score and contribution are read from the payload; this panel does not recompute the service score.</p></details>
        <h3>Source</h3>
        {sourceUrls.length ? <div>{sourceUrls.map((sourceUrl) => <p key={sourceUrl}><a className={styles.textButton} href={sourceUrl} target="_blank" rel="noreferrer">Open source record →</a></p>)}</div> : <p className={styles.muted}>{unavailableText}</p>}
        {!rawHistory.length ? <p className={styles.muted}>No raw observation series is attached to this payload. A score alone is not expanded into history.</p> : null}
    </>;
}

function ChangePanel({ signal, onSelect }: { signal: MarketSignal; onSelect: ConnectedPanelsProps['onSelect'] }) {
    const scoreDelta = signal.metadata.score_delta;
    const changes = signal.metadata.driver_changes ?? [];
    const hasDriverChanges = signal.metadata.driver_changes_available === true && changes.length > 0;
    const articles = signal.metadata.articles ?? [];

    return <>
        <SectionHeading eyebrow="What changed" title="What moved the score?" tag={scoreDelta?.label ?? 'Latest comparison'} />
        {scoreDelta && finiteNumber(scoreDelta.delta) ? <div className={styles.studyMetrics}><div><span>Current score</span><strong>{signal.composite_score.toFixed(0)}</strong><small>Snapshot {formatDate(scoreDelta.snapshot_date)}</small></div><div><span>Previous score</span><strong>{finiteNumber(scoreDelta.previous_score) ? scoreDelta.previous_score.toFixed(0) : 'Unavailable'}</strong><small>{scoreDelta.previous_date ? formatDate(scoreDelta.previous_date) : 'No prior date'}</small></div><div><span>Score delta</span><strong>{signed(scoreDelta.delta, 0)}</strong><small>Reported comparison</small></div></div> : <Unavailable title="Score change unavailable" detail="The current payload does not include a comparable previous score." />}

        <section className={styles.calibration} aria-label="Driver changes">
            <h3>Contributors to the change</h3>
            {hasDriverChanges ? <div className={styles.contextList}>{[...changes].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).map((change) => <button key={change.key} className={styles.contributor} onClick={(event) => onSelect(change.key, event.currentTarget)}><span>{change.name}</span><span className={styles.barTrack}><span className={change.delta < 0 ? styles.negativeBar : styles.positiveBar} style={{ width: `${Math.min(100, Math.abs(change.delta) * 10)}%` }} /></span><b className={change.delta < 0 ? styles.conflict : styles.support}>{signed(change.delta)}</b><span aria-hidden="true">↗</span></button>)}</div> : <div className={styles.unavailable}><b>Driver comparison unavailable.</b><p>{signal.metadata.driver_changes_available === false ? 'The backend did not mark a comparable driver snapshot as available.' : 'No driver delta records are attached to this payload.'}</p></div>}
        </section>

        <ArticleDevelopments articles={articles} />
    </>;
}

function ArticleDevelopments({ articles }: { articles: NonNullable<MarketSignal['metadata']['articles']> }) {
    return <section className={styles.calibration} aria-label="Developments"><SectionHeading eyebrow="Developments" title="Latest source updates" tag={`${articles.length} record${articles.length === 1 ? '' : 's'}`} />{articles.length ? <div className={styles.contextList}>{articles.map((article, index) => {
        const href = safeHttpUrl(article.url);
        const content = <><b>{article.title}</b><small>{article.source}{article.pubDate ? ` · ${formatDate(article.pubDate)}` : ''}{article.sentiment ? ` · ${article.sentiment}` : ''}</small></>;
        return <div key={`${article.title}-${article.pubDate ?? index}`}>{href ? <a className={styles.evidenceButton} href={href} target="_blank" rel="noreferrer">{content}</a> : <div className={styles.evidenceButton}>{content}<span className={styles.muted}>URL unavailable</span></div>}</div>;
    })}</div> : <Unavailable title="Developments unavailable" detail="No article records are attached to this signal payload." />}</section>;
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

function EvidencePanel({ signal, onSelect }: { signal: MarketSignal; onSelect: ConnectedPanelsProps['onSelect'] }) {
    const rows = configuredRows(signal);
    const coverage = signal.metadata.coverage_adjustment;
    const active = Object.values(signal.components).filter((component) => component.enabled);
    const drivers = signal.metadata.score_drivers ?? [];
    const reserve = coverage?.neutral_points;

    return <>
        <SectionHeading eyebrow="Evidence" title="The inputs behind the reading" tag={`${active.length} active`} />
        <p className={styles.panelIntro}>Values, normalized scores and contributions below come from the current signal payload. {configuredWeightLabel(signal)} are shown for the active model; the registry ledger includes configured inputs that are absent from the payload.</p>
        <div className={styles.evidenceList}>{rows.map((row) => {
            const name = row.indicator?.display_name ?? row.driver?.name ?? row.registry?.displayName ?? row.key;
            const isActive = row.indicator?.enabled === true;
            const status = !row.indicator ? 'Reserve' : isActive ? 'Active' : 'Disabled';
            const button = <button className={styles.evidenceButton} onClick={(event) => onSelect(row.key, event.currentTarget)}><span><b>{name}</b><small>{status} · {configuredWeightLabel(signal)} {row.configuredWeight === null ? 'Unavailable' : `${(row.configuredWeight * 100).toFixed(1)}%`} · applied {row.appliedWeight === null ? 'Unavailable' : `${(row.appliedWeight * 100).toFixed(1)}%`} · {cadence(row.indicator, row.key)}</small><small>{isActive ? `Raw ${rawValue(row.indicator, row.driver, signal.metadata.market)} · contribution ${finiteNumber(row.contribution) ? `${signed(row.contribution)} pts` : 'Unavailable'}` : 'No included contribution'}</small></span><span className={isActive ? styles.support : styles.muted}>{isActive ? `${scoreLabel(row.indicator?.score ?? row.driver?.score)}` : status} ↗</span></button>;
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
        <ArticleDevelopments articles={signal.metadata.articles ?? []} />
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

    if (!result.drivers.length) return <Unavailable title="Scenarios unavailable" detail="The current payload has no active score drivers to simulate." />;
    return <>
        <SectionHeading eyebrow="Scenarios" title="What would change the reading?" tag="Hypothetical" />
        {baseline && baseline !== signal && <p role="status">Newer reading available. Your assumptions still use their original reading.</p>}
        <p className={styles.panelIntro}>Adjust an existing normalized input to inspect sensitivity. Raw observations, weights and reserve accounting remain as supplied by the signal. Nothing is persisted.</p>
        <div className={styles.scenarioGrid}><div><label className={styles.field}>Input to explore<select aria-label="Scenario input" value={effectiveKey} onChange={(event) => setScenario(current => ({ ...current, selectedKey: event.target.value }))}>{result.drivers.map((driver) => <option key={driver.key} value={driver.key}>{driver.name}</option>)}</select></label>{selected ? <><label className={styles.sliderLabel} htmlFor="connected-scenario-score">Hypothetical normalized score <b>{overrides[effectiveKey] ?? selected.baseScore.toFixed(2)}</b></label><input id="connected-scenario-score" type="range" min="0" max="100" step="1" value={overrides[effectiveKey] ?? selected.baseScore} onChange={(event) => { setScenario(current => ({ ...current, baseline: current.baseline ?? signal, overrides: { ...current.overrides, [effectiveKey]: Number(event.target.value) } })); }} /><div className={styles.scaleLabels}><span>0</span><span>50 · neutral</span><span>100</span></div></> : null}<button className={styles.secondaryButton} onClick={() => { setScenario(emptyScenario()); }}>Reset to latest reading</button></div><div className={styles.simulated} aria-live="polite"><span>Simulated score</span><strong>{result.simulatedScore}<small>/100</small></strong><b>{signed(result.scoreDelta, 0)} vs baseline {reading.composite_score}</b><p>{result.simulatedTier} · hypothetical only</p></div></div>
        <details className={styles.disclosure}><summary>Active assumptions & accounting</summary>{result.drivers.filter((driver) => driver.baseScore !== driver.simulatedScore).map((driver) => <p key={driver.key}>{driver.name}: {driver.baseScore.toFixed(2)} → {driver.simulatedScore.toFixed(2)} · contribution {signed(driver.contributionDelta)} points.</p>)}<p>Neutral reserve retained: {result.neutralPoints.toFixed(2)} points. This is sensitivity arithmetic only; no raw data, score, or scenario is saved.</p></details>
    </>;
}

export function ConnectedPanels({ signal, tab, onSelect, scenario, setScenario }: ConnectedPanelsProps) {
    const normalizedTab = tab.trim().toLowerCase();
    const panel = useMemo(() => {
        if (normalizedTab === 'what changed') return <ChangePanel signal={signal} onSelect={onSelect} />;
        if (normalizedTab === 'evidence') return <EvidencePanel signal={signal} onSelect={onSelect} />;
        if (normalizedTab === 'context') return <ContextPanel signal={signal} />;
        if (normalizedTab === 'scenarios') return <ScenarioPanel signal={signal} scenario={scenario} setScenario={setScenario} />;
        return <Unavailable title="Panel unavailable" detail={`No connected V8 panel is defined for “${tab}”.`} />;
    }, [normalizedTab, onSelect, signal, tab, scenario, setScenario]);
    return <div data-testid={`market-v8-connected-${normalizedTab.replace(/\s+/g, '-')}`}>{panel}</div>;
}
