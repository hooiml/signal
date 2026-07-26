'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { parseHistoricalValuationResponse } from '@/lib/research/historical-valuation-input';
import type {
    HistoricalValuationMetric,
    HistoricalValuationObservation,
    HistoricalValuationReport,
} from '@/lib/types/historical-valuation';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type MetricKey = 'priceEarnings' | 'priceSales' | 'freeCashFlowYield';

const metrics: readonly { readonly id: MetricKey; readonly label: string; readonly suffix: string }[] = [
    { id: 'priceEarnings', label: 'P/E', suffix: '×' },
    { id: 'priceSales', label: 'Price / sales', suffix: '×' },
    { id: 'freeCashFlowYield', label: 'FCF yield', suffix: '%' },
];

const dateLabel = (value: string | null) => value === null ? 'Unavailable' : new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00.000Z`));

const compact = (value: number | null, unit: string) => {
    if (value === null) return 'Unavailable';
    return `${unit} ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)}`;
};

const metricValue = (metric: HistoricalValuationMetric, suffix: string) =>
    metric.value === null ? 'Unavailable' : `${metric.value.toFixed(2)}${suffix}`;

const metricTone = (status: string, theme: ReturnType<typeof getThemeV6>) =>
    status === 'available' ? theme.positive : status === 'partial' ? theme.textSecondary : theme.risk;

const ObservationChart = ({
    observations,
    metricKey,
    theme,
}: {
    readonly observations: readonly HistoricalValuationObservation[];
    readonly metricKey: MetricKey;
    readonly theme: ResearchThemeV6;
}) => {
    const metric = metrics.find((candidate) => candidate.id === metricKey) ?? metrics[0];
    const points = [...observations].reverse().flatMap((observation) => {
        const value = observation[metricKey].value;
        return value === null ? [] : [{ observation, value }];
    });
    const maximum = Math.max(...points.map((point) => point.value), 1);
    const minimum = Math.min(...points.map((point) => point.value), 0);
    const span = Math.max(maximum - minimum, 1);
    const path = points.map((point, index) => {
        const x = points.length === 1 ? 50 : 8 + ((index / (points.length - 1)) * 84);
        const y = 86 - (((point.value - minimum) / span) * 72);
        return { ...point, x, y };
    });
    const styles = getThemeV6(theme);
    return (
        <div
            role="img"
            aria-label={`${metric.label} filing observations. ${points.map((point) => `${point.observation.fiscalPeriodEnd}: ${point.value.toFixed(2)}${metric.suffix}`).join('; ') || 'No calculable observations.'}`}
            className={'rounded-lg border p-3 ' + styles.panelUtility}
        >
            <svg viewBox="0 0 100 100" className="h-52 w-full" aria-hidden="true" preserveAspectRatio="none">
                <line x1="8" y1="86" x2="92" y2="86" stroke="currentColor" opacity="0.18" strokeWidth="0.5" />
                {path.length > 1 ? <polyline
                    points={path.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                /> : null}
                {path.map((point) => <circle
                    key={point.observation.id}
                    cx={point.x}
                    cy={point.y}
                    r="2.2"
                    fill={point.observation.isAmendment ? '#f59e0b' : '#10b981'}
                    stroke={theme === 'light' ? '#ffffff' : '#0b1118'}
                    strokeWidth="0.8"
                    vectorEffect="non-scaling-stroke"
                />)}
            </svg>
            <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>
                Discrete filing observations, not a continuous daily valuation series. Amber marks an amendment.
            </p>
        </div>
    );
};

export const HistoricalValuationV6 = ({
    ticker,
    theme,
}: {
    readonly ticker: ResearchWatchlistItem;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [report, setReport] = useState<HistoricalValuationReport | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const [metricKey, setMetricKey] = useState<MetricKey>('priceEarnings');

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading');
            setError(null);
            try {
                const response = await fetch(
                    `/api/research/valuation-history/${encodeURIComponent(ticker.symbol)}?market=${ticker.market}`,
                    { signal: controller.signal },
                );
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && !Array.isArray(payload)
                    && typeof Object.fromEntries(Object.entries(payload)).error === 'string'
                    ? String(Object.fromEntries(Object.entries(payload)).error)
                    : 'Historical valuation is unavailable.');
                setReport(parseHistoricalValuationResponse(payload));
                setState('ready');
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === 'AbortError') return;
                setError(caught instanceof Error ? caught.message : 'Historical valuation is unavailable.');
                setState('error');
            }
        };
        void load();
        return () => controller.abort();
    }, [retryKey, ticker.market, ticker.symbol]);

    const selectedMetric = metrics.find((metric) => metric.id === metricKey) ?? metrics[0];
    const calculableCount = useMemo(() =>
        report?.observations.filter((observation) => observation[metricKey].value !== null).length ?? 0,
    [metricKey, report]);

    return (
        <section data-testid="historical-valuation" className={'mt-4 rounded-lg border p-4 min-[760px]:p-5 ' + styles.panelSecondary} aria-labelledby="historical-valuation-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-3xl">
                    <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Point-in-time evidence</p>
                    <h2 id="historical-valuation-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Historical valuation</h2>
                    <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>
                        Annual filing observations use facts from one SEC accession and a close strictly after its filed date. They are descriptive evidence, not advice, forecasts, or price targets.
                    </p>
                </div>
                {state === 'error' ? <button
                    type="button"
                    onClick={() => setRetryKey((value) => value + 1)}
                    className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}
                >Retry</button> : null}
            </div>

            {state === 'loading' ? (
                <div role="status" className={'mt-4 rounded border p-4 text-sm ' + styles.row + ' ' + styles.textSecondary}>
                    <span className="mr-2 inline-block h-2 w-20 animate-pulse rounded-full bg-emerald-400/60" />
                    Loading filing-aligned valuation observations...
                </div>
            ) : state === 'error' ? (
                <div role="alert" className={'mt-4 rounded border p-4 text-sm ' + styles.row + ' ' + styles.risk}>
                    {error}
                </div>
            ) : report ? (
                <>
                    <div className="mt-4 grid gap-3 min-[760px]:grid-cols-3">
                        {([
                            ['Historical prices', report.capabilities.historicalPrices],
                            ['Period-correct fundamentals', report.capabilities.periodCorrectFundamentals],
                            ['Analyst revisions', report.capabilities.analystEstimateRevisions],
                        ] as const).map(([label, capability]) => (
                            <article key={label} className={'rounded border p-3 ' + styles.row}>
                                <p className={'text-xs font-bold ' + metricTone(capability.status, styles)}>{label} · {capability.status}</p>
                                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{capability.detail}</p>
                            </article>
                        ))}
                    </div>

                    {report.warnings.length > 0 ? <div role="status" className={'mt-4 rounded border p-3 text-xs leading-5 ' + styles.row + ' ' + styles.risk}>
                        {report.warnings.join(' ')}
                    </div> : null}

                    {report.observations.length === 0 ? (
                        <div data-testid="historical-valuation-empty" className={'mt-4 rounded border p-5 text-sm leading-6 ' + styles.row + ' ' + styles.textMuted}>
                            No safe filing-aligned valuation observations are available for {ticker.symbol}. Capability details above explain the market or provider boundary.
                        </div>
                    ) : (
                        <>
                            <div className="mt-5 flex flex-wrap gap-2" aria-label="Historical valuation metric">
                                {metrics.map((metric) => <button
                                    key={metric.id}
                                    type="button"
                                    aria-pressed={metricKey === metric.id}
                                    onClick={() => setMetricKey(metric.id)}
                                    className={'min-h-10 rounded border px-3 text-xs font-semibold ' + (metricKey === metric.id ? styles.selectedRow : styles.row)}
                                >{metric.label}</button>)}
                            </div>
                            <p className={'mt-2 text-xs ' + styles.textMuted}>{calculableCount} of {report.observations.length} {selectedMetric.label} observations calculable.</p>
                            <div className="mt-3">
                                <ObservationChart observations={report.observations} metricKey={metricKey} theme={theme} />
                            </div>

                            <div className="research-scrollbar mt-4 max-w-full overflow-x-auto rounded border">
                                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                                    <caption className="sr-only">Accessible table of discrete historical valuation filing observations</caption>
                                    <thead className={styles.statusSurface}>
                                        <tr>
                                            {['Fiscal period', 'Filed / form', 'Price date / close', 'P/E', 'Price / sales', 'FCF yield', 'Coverage'].map((label) => (
                                                <th key={label} scope="col" className={'border-b px-3 py-2 font-semibold ' + styles.divider + ' ' + styles.textMuted}>{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.observations.map((observation) => (
                                            <tr key={observation.id} className={'border-b last:border-b-0 ' + styles.divider}>
                                                <th scope="row" className={'whitespace-nowrap px-3 py-3 font-semibold ' + styles.textPrimary}>{dateLabel(observation.fiscalPeriodEnd)}</th>
                                                <td className={'whitespace-nowrap px-3 py-3 ' + styles.textSecondary}>
                                                    {dateLabel(observation.filedAt)} · <a href={observation.filingUrl} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">{observation.form}</a>
                                                    {observation.isAmendment ? <span className="ml-1">· {observation.restatementStatus}</span> : null}
                                                </td>
                                                <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{dateLabel(observation.priceDate)} · {observation.price === null ? 'Unavailable' : `USD ${observation.price.toFixed(2)}`}</td>
                                                <td className={'px-3 py-3 font-mono tabular-nums ' + styles.textSecondary} title={observation.priceEarnings.unavailableReason ?? observation.priceEarnings.formula}>{metricValue(observation.priceEarnings, '×')}</td>
                                                <td className={'px-3 py-3 font-mono tabular-nums ' + styles.textSecondary} title={observation.priceSales.unavailableReason ?? observation.priceSales.formula}>{metricValue(observation.priceSales, '×')}</td>
                                                <td className={'px-3 py-3 font-mono tabular-nums ' + styles.textSecondary} title={observation.freeCashFlowYield.unavailableReason ?? observation.freeCashFlowYield.formula}>{metricValue(observation.freeCashFlowYield, '%')}</td>
                                                <td className={'max-w-[260px] px-3 py-3 leading-5 ' + styles.textMuted}>{observation.gaps.length === 0 ? 'Complete for supported metrics' : observation.gaps.join(' ')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 space-y-2">
                                {report.observations.map((observation) => (
                                    <details key={observation.id} className={'rounded border p-3 ' + styles.row}>
                                        <summary className={'min-h-10 cursor-pointer py-2 text-xs font-semibold ' + styles.textPrimary}>
                                            {dateLabel(observation.fiscalPeriodEnd)} · formula inputs and provenance
                                        </summary>
                                        <dl className="grid gap-3 py-2 text-xs min-[760px]:grid-cols-2">
                                            <div><dt className={styles.textMuted}>Price convention</dt><dd className={'mt-1 leading-5 ' + styles.textSecondary}>{observation.priceConvention}</dd></div>
                                            <div><dt className={styles.textMuted}>Shares basis</dt><dd className={'mt-1 leading-5 ' + styles.textSecondary}>{compact(observation.reportedDilutedShares, 'shares')} × {observation.splitAdjustmentFactor ?? 'unavailable'} split factor = {compact(observation.splitAdjustedShares, 'shares')}</dd></div>
                                            <div><dt className={styles.textMuted}>P/E formula</dt><dd className={'mt-1 leading-5 ' + styles.textSecondary}>{observation.priceEarnings.formula}</dd></div>
                                            <div><dt className={styles.textMuted}>Price / sales formula</dt><dd className={'mt-1 leading-5 ' + styles.textSecondary}>{observation.priceSales.formula}</dd></div>
                                            <div><dt className={styles.textMuted}>FCF yield formula</dt><dd className={'mt-1 leading-5 ' + styles.textSecondary}>{observation.freeCashFlowYield.formula}</dd></div>
                                            <div><dt className={styles.textMuted}>Inputs</dt><dd className={'mt-1 leading-5 ' + styles.textSecondary}>{observation.facts.map((fact) => `${fact.label}: ${compact(fact.value, fact.unit)}`).join('; ')}</dd></div>
                                        </dl>
                                    </details>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="mt-4 grid gap-2">
                        {report.sources.map((source) => <a key={source.name} href={source.url} target="_blank" rel="noreferrer" className={'rounded border p-3 text-xs ' + styles.row}>
                            <span className={'font-semibold underline underline-offset-2 ' + styles.textPrimary}>{source.name}</span>
                            <span className={'ml-2 ' + styles.textMuted}>{source.detail}</span>
                        </a>)}
                    </div>
                </>
            ) : null}
        </section>
    );
};
