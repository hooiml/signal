'use client';

import { useEffect, useMemo, useState } from 'react';
import { financialPercentage, positionPlanPriceContext } from '@/lib/research/financial-display';
import { parseHistoricalValuationResponse } from '@/lib/research/historical-valuation-input';
import type {
    HistoricalValuationMetric,
    HistoricalValuationObservation,
    HistoricalValuationReport,
} from '@/lib/types/historical-valuation';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { date, number, price } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

type MetricKey = 'priceEarnings' | 'priceSales' | 'freeCashFlowYield';

const historicalMetrics: readonly {
    readonly id: MetricKey;
    readonly label: string;
    readonly suffix: string;
    readonly snapshotKey: 'priceEarnings' | 'priceSales' | 'freeCashFlowYieldPercent';
}[] = [
    { id: 'priceEarnings', label: 'P/E', suffix: '×', snapshotKey: 'priceEarnings' },
    { id: 'priceSales', label: 'Price / sales', suffix: '×', snapshotKey: 'priceSales' },
    { id: 'freeCashFlowYield', label: 'FCF yield', suffix: '%', snapshotKey: 'freeCashFlowYieldPercent' },
];

const signedPercent = (value: number | null): string =>
    value === null ? 'Unavailable' : `${value > 0 ? '+' : ''}${financialPercentage(value)}`;

const metricDisplay = (metric: HistoricalValuationMetric, suffix: string): string =>
    metric.value === null ? 'Unavailable' : `${number(metric.value, suffix)}`;

export function PositionPlanComparison({
    record,
    snapshot,
}: {
    readonly record: ResearchRecord;
    readonly snapshot: ResearchSnapshot | null;
}) {
    const context = useMemo(
        () => positionPlanPriceContext(record.positionPlan, snapshot?.quote, snapshot?.technicals),
        [record.positionPlan, snapshot?.quote, snapshot?.technicals],
    );
    if (!context) return null;
    return (
        <div className={connected.planComparison} data-testid="position-plan-comparison">
            <div className={connected.planComparisonHeader}>
                <span className={base.eyebrow}>Same-currency comparison · {context.currency}</span>
                <strong>Returned price vs your saved plan levels</strong>
                <p>Percentage distance is measured from the latest returned price ({price(context.currentPrice, context.currency)}). These are your saved thresholds, not fair-value targets.</p>
            </div>
            <div
                className={connected.planRuler}
                role="img"
                aria-label={`Price comparison ruler in ${context.currency}: ${context.markers.map(marker => `${marker.label} ${price(marker.price, context.currency)}`).join('; ')}`}
            >
                <div className={connected.planRulerTrack} aria-hidden="true">
                    {context.markers.map(marker => (
                        <span
                            key={marker.id}
                            className={connected.planRulerPin}
                            data-pin={marker.id}
                            style={{ left: `${marker.offsetPercent}%` }}
                            title={`${marker.label}: ${price(marker.price, context.currency)}`}
                        />
                    ))}
                </div>
                <div className={connected.planRulerScale} aria-hidden="true">
                    <span>{price(context.scaleLow, context.currency)}</span>
                    <span>{price(context.scaleHigh, context.currency)}</span>
                </div>
            </div>
            <ul className={connected.planMarkerLegend}>
                {context.markers.map(marker => (
                    <li key={marker.id} data-pin={marker.id}>
                        <span><i aria-hidden="true" />{marker.label}</span>
                        <b>{price(marker.price, context.currency)}</b>
                        <small>{marker.deltaFromCurrentPercent === null
                            ? (marker.id === 'current' ? 'Reference price' : '52-week bound')
                            : `${signedPercent(marker.deltaFromCurrentPercent)} vs current`}</small>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function HistoricalValuationV8({
    symbol,
    market,
    snapshot,
}: {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly snapshot: ResearchSnapshot | null;
}) {
    const [open, setOpen] = useState(false);
    const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const [report, setReport] = useState<HistoricalValuationReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [metricKey, setMetricKey] = useState<MetricKey>('priceEarnings');

    useEffect(() => {
        setReport(null);
        setError(null);
        setState('idle');
    }, [symbol, market]);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        const load = async () => {
            setState('loading');
            setError(null);
            try {
                const response = await fetch(
                    `/api/research/valuation-history/${encodeURIComponent(symbol)}?market=${market}`,
                    { signal: controller.signal },
                );
                const payload: unknown = await response.json();
                if (!response.ok) {
                    const msg = typeof payload === 'object' && payload !== null && !Array.isArray(payload) && 'error' in payload && typeof payload.error === 'string'
                        ? payload.error
                        : 'Historical valuation is unavailable.';
                    throw new Error(msg);
                }
                const parsed = parseHistoricalValuationResponse(payload);
                if (parsed.symbol !== symbol || parsed.market !== market) {
                    throw new Error('Returned historical valuation did not match the selected security.');
                }
                setReport(parsed);
                setState('ready');
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === 'AbortError') return;
                setError(caught instanceof Error ? caught.message : 'Historical valuation is unavailable.');
                setState('error');
            }
        };
        void load();
        return () => controller.abort();
    }, [open, retryKey, symbol, market]);

    const selectedMetric = historicalMetrics.find(item => item.id === metricKey) ?? historicalMetrics[0];
    const chronological = useMemo(() => {
        if (!report) return [];
        return [...report.observations].reverse().flatMap((obs: HistoricalValuationObservation) => {
            const val = obs[metricKey].value;
            return val === null || !Number.isFinite(val) ? [] : [{ observation: obs, value: val }];
        });
    }, [metricKey, report]);

    const stats = useMemo(() => {
        if (chronological.length === 0) return null;
        const sorted = [...chronological.map(item => item.value)].sort((a, b) => a - b);
        const low = sorted[0];
        const high = sorted[sorted.length - 1];
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        const maxMag = Math.max(...sorted.map(val => Math.abs(val)), 1);
        return { low, median, high, maxMag };
    }, [chronological]);

    const currentMultiple = snapshot?.valuation[selectedMetric.snapshotKey] ?? null;

    return (
        <details
            className={connected.evidence}
            data-testid="v8-historical-valuation"
            onToggle={event => setOpen(event.currentTarget.open)}
        >
            <summary>Compare with filing-aligned historical valuation {market === 'MY' ? '(US SEC 10-K boundary)' : '(SEC 10-K)'}</summary>
            <div className={connected.historicalValuation}>
                <p>Annual filing observations pair facts from one SEC 10-K accession with the first daily close strictly after its filed date. They are discrete historical observations, not continuous daily multiples or fair-value targets.</p>
                {state === 'loading' && <p role="status">Loading filing-aligned historical valuation observations…</p>}
                {state === 'error' && (
                    <div className={connected.warning} role="alert">
                        <p>{error}</p>
                        <button type="button" className={base.secondaryButton} onClick={() => setRetryKey(value => value + 1)}>Retry historical valuation</button>
                    </div>
                )}
                {state === 'ready' && report && (
                    <>
                        <div className={connected.capabilityGrid}>
                            {([
                                ['Historical prices', report.capabilities.historicalPrices],
                                ['Period-correct fundamentals', report.capabilities.periodCorrectFundamentals],
                                ['Analyst revisions', report.capabilities.analystEstimateRevisions],
                            ] as const).map(([label, capability]) => (
                                <div key={label} className={connected.capabilityCard}>
                                    <div className={connected.capabilityTop}>
                                        <strong>{label}</strong>
                                        <span className={connected.assessmentBadge} data-state={capability.status}>{capability.status}</span>
                                    </div>
                                    <p>{capability.detail}</p>
                                </div>
                            ))}
                        </div>
                        {report.warnings.length > 0 && (
                            <div className={connected.warning} role="status">
                                <p>{report.warnings.join(' ')}</p>
                            </div>
                        )}
                        {report.observations.length === 0 ? (
                            <p className={styles.gapNote} data-testid="v8-historical-valuation-empty">
                                No safe filing-aligned valuation observations are available for {symbol}. Capability details above explain the market or provider boundary.
                            </p>
                        ) : (
                            <>
                                <div className={connected.historicalControls}>
                                    <fieldset className={base.segment}>
                                        <legend className={base.visuallyHidden}>Historical valuation metric</legend>
                                        {historicalMetrics.map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                aria-pressed={metricKey === item.id}
                                                onClick={() => setMetricKey(item.id)}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </fieldset>
                                    <small>{chronological.length} of {report.observations.length} {selectedMetric.label} filing observations calculable</small>
                                </div>
                                {stats && (
                                    <div className={connected.historicalSummaryStrip}>
                                        <div><span>Current snapshot {selectedMetric.label}</span><strong>{number(currentMultiple, selectedMetric.suffix)}</strong></div>
                                        <div><span>Filing low</span><strong>{number(stats.low, selectedMetric.suffix)}</strong></div>
                                        <div><span>Filing median</span><strong>{number(stats.median, selectedMetric.suffix)}</strong></div>
                                        <div><span>Filing high</span><strong>{number(stats.high, selectedMetric.suffix)}</strong></div>
                                    </div>
                                )}
                                {chronological.length > 0 && stats && (
                                    <div
                                        className={connected.historicalBars}
                                        role="img"
                                        aria-label={`${selectedMetric.label} filing observations for ${symbol}: ${chronological.map(item => `${item.observation.fiscalPeriodEnd} ${number(item.value, selectedMetric.suffix)}`).join(', ')}`}
                                    >
                                        {chronological.map(({ observation, value }) => {
                                            const height = Math.max(14, Math.round(Math.abs(value) / stats.maxMag * 100));
                                            return (
                                                <div key={observation.id} className={connected.historicalBarCol}>
                                                    <span className={connected.historicalBarValue}>{number(value, selectedMetric.suffix)}</span>
                                                    <span className={connected.historicalBarTrack}>
                                                        <i
                                                            className={connected.historicalBarFill}
                                                            data-amended={observation.isAmendment ? 'true' : 'false'}
                                                            data-negative={value < 0 ? 'true' : 'false'}
                                                            style={{ height: `${height}%` }}
                                                        />
                                                    </span>
                                                    <small>{observation.fiscalPeriodEnd.slice(0, 4)}{observation.isAmendment ? '*' : ''}</small>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className={connected.tableScroll} tabIndex={0} role="region" aria-label="Historical filing valuation observations">
                                    <table>
                                        <caption>Discrete post-filing observations · * indicates a 10-K/A amendment</caption>
                                        <thead>
                                            <tr>
                                                <th scope="col">Fiscal period</th>
                                                <th scope="col">Filed / form</th>
                                                <th scope="col">Post-filing close</th>
                                                <th scope="col">P/E</th>
                                                <th scope="col">Price / sales</th>
                                                <th scope="col">FCF yield</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {report.observations.map(obs => (
                                                <tr key={obs.id}>
                                                    <th scope="row">{date(obs.fiscalPeriodEnd)}</th>
                                                    <td>
                                                        {date(obs.filedAt)} · <a className={base.textButton} href={obs.filingUrl} target="_blank" rel="noopener noreferrer">{obs.form} ↗</a>
                                                    </td>
                                                    <td>{obs.priceDate ? `${date(obs.priceDate)} · ${price(obs.price, obs.priceCurrency)}` : 'Unavailable'}</td>
                                                    <td title={obs.priceEarnings.unavailableReason ?? obs.priceEarnings.formula}>{metricDisplay(obs.priceEarnings, '×')}</td>
                                                    <td title={obs.priceSales.unavailableReason ?? obs.priceSales.formula}>{metricDisplay(obs.priceSales, '×')}</td>
                                                    <td title={obs.freeCashFlowYield.unavailableReason ?? obs.freeCashFlowYield.formula}>{metricDisplay(obs.freeCashFlowYield, '%')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </details>
    );
}
