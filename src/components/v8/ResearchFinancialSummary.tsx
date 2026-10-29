import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import {
    annualAmountComparison,
    annualHistorySeries,
    annualMarginComparison,
    annualMarginSeries,
    annualShareSeries,
    balanceSheetCushion,
    compactFinancialAmount,
    compactShareCount,
    financialPercentage,
    type AnnualAmount,
    type AnnualMarginField,
} from '@/lib/research/financial-display';
import { researchMetricPeriodLabel } from '@/lib/research/metric-provenance';
import { date, money, number } from './research-v8-connected-data';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

export function ResearchFinancialSummary({ fundamentals }: { fundamentals: ResearchSnapshot['fundamentals'] | undefined }) {
    const period = fundamentals?.history.find(row => row.reportingPeriod === fundamentals.reportingPeriod);
    const rows: readonly [string, AnnualAmount][] = [['Annual revenue', 'annualRevenue'], ['Annual net income', 'annualNetIncome'], ['Free cash flow', 'freeCashFlow']];
    // The availability note already names an entirely missing annual summary.
    // Keep a supplied growth figure even when the underlying amount is absent.
    if (!rows.some(([, key]) => fundamentals?.[key] != null && Number.isFinite(fundamentals[key]))
        && !(fundamentals?.revenueGrowthPercent != null && Number.isFinite(fundamentals.revenueGrowthPercent))) return null;
    return <dl className={`${styles.valuationInputs} ${connected.financialSummary}`}>
        {rows.map(([label, key]) => {
            const value = fundamentals?.[key];
            const comparison = fundamentals ? annualAmountComparison(fundamentals, key) : null;
            const series = annualHistorySeries(fundamentals, key);
            const change = comparison?.percentage !== null && comparison?.percentage !== undefined
                ? `${comparison.percentage > 0 ? 'up ' : comparison.percentage < 0 ? 'down ' : ''}${financialPercentage(Math.abs(comparison.percentage))}`
                : comparison ? `${comparison.delta > 0 ? 'up ' : comparison.delta < 0 ? 'down ' : ''}${compactFinancialAmount(Math.abs(comparison.delta), period?.currency)}` : null;
            return <div key={key}><dt>{label}</dt><dd>{compactFinancialAmount(value, period?.currency)}</dd>
                <dd className={connected.financialDetail}><p>{key === 'annualRevenue' ? 'Sales before expenses.' : key === 'annualNetIncome' ? 'Accounting profit after expenses and tax.' : 'Cash remaining after capital spending. It can differ from accounting profit.'}</p>{comparison
                    ? <p className={connected.financialChange}>{value !== null && value !== undefined && value < 0 ? 'Negative' : value === 0 ? 'Zero' : 'Positive'} · {change} vs {date(comparison.previous.reportingPeriod)}</p>
                    : <p className={connected.financialChange}>Annual change unavailable</p>}
                {series && <div
                    className={connected.financialTrend}
                    data-testid={`financial-trend-${key}`}
                    role="img"
                    aria-label={`${label} comparable annual history (${series.currency}, ${series.source}): ${series.points.map(point => `${point.reportingPeriod.slice(0, 4)} ${compactFinancialAmount(point.value, series.currency)}`).join(', ')}`}
                >
                    <div className={connected.financialTrendBars} aria-hidden="true">
                        {series.points.map(point => <span key={point.reportingPeriod} className={connected.financialTrendCol} title={`${date(point.reportingPeriod)}: ${compactFinancialAmount(point.value, series.currency)}`}>
                            <span className={connected.financialTrendTrack}>
                                <i className={connected.financialTrendBar} data-sign={point.sign} style={{ height: `${point.heightPercent}%` }} />
                            </span>
                            <small>{point.reportingPeriod.slice(0, 4)}</small>
                        </span>)}
                    </div>
                    <small className={connected.financialTrendMeta}>{series.points.length} comparable annual periods ({series.startPeriod.slice(0, 4)}–{series.endPeriod.slice(0, 4)} · {series.currency})</small>
                </div>}
                {((value !== null && value !== undefined && Number.isFinite(value)) || (key === 'annualRevenue' && fundamentals?.revenueGrowthPercent != null && Number.isFinite(fundamentals.revenueGrowthPercent))) && <details><summary>Exact amount and comparison</summary>
                    <p>{money(value, period?.currency)} · annual period ended {date(fundamentals?.reportingPeriod)} · {fundamentals?.source || 'Source unavailable'}.</p>
                    {key === 'annualRevenue' && <p>Provider-reported revenue growth: {financialPercentage(fundamentals?.revenueGrowthPercent)}. The displayed change above uses the identified comparable annual endpoints when available.</p>}
                    {comparison ? <><p>Prior: {money(comparison.previous[key], comparison.previous.currency)} · annual period ended {date(comparison.previous.reportingPeriod)}. Amount change: {money(comparison.delta, period?.currency)}.</p><p>{comparison.percentage === null ? 'Percentage change is withheld because the prior amount is zero or negative.' : 'Percentage change = (current − prior) ÷ prior × 100. Both annual endpoints use the same currency and source.'} This describes reported amounts, not the cause of the change.</p></> : <p>A comparable prior annual amount with the same currency and source is not available. No year-over-year change is inferred.</p>}
                </details>}</dd>
            </div>;
        })}
    </dl>;
}

const marginRows: readonly {
    readonly key: AnnualMarginField;
    readonly label: string;
    readonly description: string;
}[] = [
    {
        key: 'grossMarginPercent',
        label: 'Gross margin',
        description: 'Share of revenue left after direct cost of goods or services.',
    },
    {
        key: 'operatingMarginPercent',
        label: 'Operating margin',
        description: 'Share of revenue left after operating expenses, before interest and tax.',
    },
];

const signedPercentagePoints = (delta: number): string => {
    const magnitude = Math.abs(delta).toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (delta > 0) return `up ${magnitude} pp`;
    if (delta < 0) return `down ${magnitude} pp`;
    return 'unchanged (0 pp)';
};

export function ResearchQualityAndCushion({ fundamentals }: { fundamentals: ResearchSnapshot['fundamentals'] | undefined }) {
    const hasMarginData = fundamentals && (
        (fundamentals.grossMarginPercent !== null && Number.isFinite(fundamentals.grossMarginPercent))
        || (fundamentals.operatingMarginPercent !== null && Number.isFinite(fundamentals.operatingMarginPercent))
    );
    const cushion = balanceSheetCushion(fundamentals);
    const shareSeries = annualShareSeries(fundamentals);
    const hasBalanceOrShares = Boolean(
        cushion
        || shareSeries
        || (fundamentals?.shares !== null && fundamentals?.shares !== undefined && Number.isFinite(fundamentals.shares))
        || (fundamentals?.shareChangePercent !== null && fundamentals?.shareChangePercent !== undefined && Number.isFinite(fundamentals.shareChangePercent)),
    );

    if (!hasMarginData && !hasBalanceOrShares) return null;

    const shareLabel = fundamentals?.source === 'Yahoo Finance' ? 'Annual diluted average shares' : 'Shares outstanding';
    const latestShareChange = fundamentals?.shareChangePercent;
    const sharePostureLabel = shareSeries
        ? shareSeries.posture === 'buyback'
            ? `Net share reduction (${financialPercentage(shareSeries.cumulativeChangePercent)} from ${shareSeries.startPeriod.slice(0, 4)} to ${shareSeries.endPeriod.slice(0, 4)})`
            : shareSeries.posture === 'dilution'
                ? `Net share expansion (+${financialPercentage(shareSeries.cumulativeChangePercent)} from ${shareSeries.startPeriod.slice(0, 4)} to ${shareSeries.endPeriod.slice(0, 4)})`
                : `Share count unchanged (${shareSeries.startPeriod.slice(0, 4)}–${shareSeries.endPeriod.slice(0, 4)})`
        : latestShareChange !== null && latestShareChange !== undefined && Number.isFinite(latestShareChange)
            ? `${latestShareChange < 0 ? 'Net share reduction' : latestShareChange > 0 ? 'Net share expansion' : 'Unchanged'} (${latestShareChange > 0 ? '+' : ''}${financialPercentage(latestShareChange)} YoY)`
            : 'Annual share change unavailable';

    return (
        <section className={connected.qualitySection} aria-label="Profitability margins, balance-sheet cushion and share count">
            <div className={connected.qualityGrid}>
                {hasMarginData && (
                    <div className={connected.qualityCard} data-testid="financial-margin-context">
                        <span className={base.eyebrow}>Unit profitability</span>
                        <h3>Annual margin trajectory</h3>
                        <p>Compares how much of each revenue unit remained after direct and operating costs across comparable annual filings.</p>
                        <div className={connected.marginList}>
                            {marginRows.map(({ key, label, description }) => {
                                const value = fundamentals?.[key];
                                const comparison = annualMarginComparison(fundamentals, key);
                                const series = annualMarginSeries(fundamentals, key);
                                return (
                                    <div key={key} className={connected.marginItem}>
                                        <div className={connected.marginHeader}>
                                            <strong>{label}</strong>
                                            <span className={connected.marginValue}>{financialPercentage(value)}</span>
                                        </div>
                                        <p className={connected.marginDesc}>{description}</p>
                                        <p className={connected.financialChange}>
                                            {comparison
                                                ? `${signedPercentagePoints(comparison.deltaPercentagePoints)} vs ${date(comparison.previous.reportingPeriod)} (${financialPercentage(comparison.previous[key])})`
                                                : 'Prior comparable annual margin unavailable'}
                                        </p>
                                        {series && (
                                            <div
                                                className={connected.financialTrend}
                                                data-testid={`financial-trend-${key}`}
                                                role="img"
                                                aria-label={`${label} comparable annual history (${series.source}): ${series.points.map(point => `${point.reportingPeriod.slice(0, 4)} ${financialPercentage(point.value)}`).join(', ')}`}
                                            >
                                                <div className={connected.financialTrendBars} aria-hidden="true">
                                                    {series.points.map(point => (
                                                        <span key={point.reportingPeriod} className={connected.financialTrendCol} title={`${date(point.reportingPeriod)}: ${financialPercentage(point.value)}`}>
                                                            <span className={connected.financialTrendTrack}>
                                                                <i className={connected.financialTrendBar} data-sign={point.sign} style={{ height: `${point.heightPercent}%` }} />
                                                            </span>
                                                            <small>{point.reportingPeriod.slice(0, 4)}</small>
                                                        </span>
                                                    ))}
                                                </div>
                                                <small className={connected.financialTrendMeta}>{series.points.length} comparable annual periods ({series.startPeriod.slice(0, 4)}–{series.endPeriod.slice(0, 4)})</small>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
                {hasBalanceOrShares && (
                    <div className={connected.qualityCard} data-testid="financial-cushion-dilution">
                        <span className={base.eyebrow}>Balance sheet & ownership</span>
                        <h3>Cash cushion and share count</h3>
                        <p>Reported cash relative to debt and annual changes in share count. Balance and share dates can differ from the annual income statement period.</p>
                        {cushion && (
                            <div
                                className={connected.cushionBlock}
                                data-testid="balance-sheet-cushion"
                                role="img"
                                aria-label={`Balance sheet comparison in ${cushion.currency}: Cash ${compactFinancialAmount(cushion.cash, cushion.currency)} vs Debt ${compactFinancialAmount(cushion.debt, cushion.currency)}`}
                            >
                                <div className={connected.cushionHeader}>
                                    <strong>{cushion.posture === 'net-cash' ? 'Net cash position' : cushion.posture === 'net-debt' ? 'Net debt position' : 'Cash equals debt'}</strong>
                                    <span className={connected.cushionNet} data-posture={cushion.posture}>
                                        {cushion.posture === 'net-debt'
                                            ? compactFinancialAmount(Math.abs(cushion.netCash), cushion.currency)
                                            : compactFinancialAmount(cushion.netCash, cushion.currency)}
                                    </span>
                                </div>
                                <div className={connected.cushionBars} aria-hidden="true">
                                    <div className={connected.cushionRow}>
                                        <span>Cash</span>
                                        <span className={connected.cushionTrack}>
                                            <i className={connected.cushionFill} data-kind="cash" style={{ width: `${cushion.cashWidthPercent}%` }} />
                                        </span>
                                        <b>{compactFinancialAmount(cushion.cash, cushion.currency)}</b>
                                    </div>
                                    <div className={connected.cushionRow}>
                                        <span>Debt</span>
                                        <span className={connected.cushionTrack}>
                                            <i className={connected.cushionFill} data-kind="debt" style={{ width: `${cushion.debtWidthPercent}%` }} />
                                        </span>
                                        <b>{compactFinancialAmount(cushion.debt, cushion.currency)}</b>
                                    </div>
                                </div>
                                <small className={connected.financialTrendMeta}>
                                    Cash: {researchMetricPeriodLabel(fundamentals, 'cash')} · Debt: {researchMetricPeriodLabel(fundamentals, 'debt')}
                                </small>
                            </div>
                        )}
                        {(shareSeries || (fundamentals?.shares !== null && fundamentals?.shares !== undefined && Number.isFinite(fundamentals.shares))) && (
                            <div className={connected.shareDilutionBlock} data-testid="share-dilution-context">
                                <div className={connected.marginHeader}>
                                    <strong>{shareLabel}</strong>
                                    <span className={connected.marginValue}>{compactShareCount(fundamentals?.shares)}</span>
                                </div>
                                <p className={connected.financialChange}>
                                    {sharePostureLabel} · {researchMetricPeriodLabel(fundamentals, 'shares')}
                                </p>
                                {shareSeries && (
                                    <div
                                        className={connected.financialTrend}
                                        data-testid="financial-trend-shares"
                                        role="img"
                                        aria-label={`${shareSeries.shareBasisLabel} history (${shareSeries.source}): ${shareSeries.points.map(point => `${point.reportingPeriod.slice(0, 4)} ${number(point.shares)}`).join(', ')}`}
                                    >
                                        <div className={connected.financialTrendBars} aria-hidden="true">
                                            {shareSeries.points.map(point => (
                                                <span
                                                    key={point.reportingPeriod}
                                                    className={connected.financialTrendCol}
                                                    title={`${date(point.reportingPeriod)}: ${number(point.shares)} shares${point.shareChangePercent !== null ? ` (${point.shareChangePercent > 0 ? '+' : ''}${financialPercentage(point.shareChangePercent)} YoY)` : ''}`}
                                                >
                                                    <span className={connected.financialTrendTrack}>
                                                        <i
                                                            className={connected.financialTrendBar}
                                                            data-sign={point.shareChangePercent !== null && point.shareChangePercent > 0 ? 'negative' : 'positive'}
                                                            style={{ height: `${point.heightPercent}%` }}
                                                        />
                                                    </span>
                                                    <small>{point.reportingPeriod.slice(0, 4)}</small>
                                                </span>
                                            ))}
                                        </div>
                                        <small className={connected.financialTrendMeta}>
                                            {shareSeries.points.length} comparable annual periods ({shareSeries.startPeriod.slice(0, 4)}–{shareSeries.endPeriod.slice(0, 4)} · {shareSeries.source})
                                        </small>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
