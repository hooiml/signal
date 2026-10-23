import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { annualAmountComparison, annualHistorySeries, compactFinancialAmount, financialPercentage, type AnnualAmount } from '@/lib/research/financial-display';
import { date, money } from './research-v8-connected-data';
import styles from './research-v8.module.css';
import connected from './research-v8-connected.module.css';

export function ResearchFinancialSummary({ fundamentals }: { fundamentals: ResearchSnapshot['fundamentals'] | undefined }) {
    const period = fundamentals?.history.find(row => row.reportingPeriod === fundamentals.reportingPeriod);
    const rows: readonly [string, AnnualAmount][] = [['Annual revenue', 'annualRevenue'], ['Annual net income', 'annualNetIncome'], ['Free cash flow', 'freeCashFlow']];
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
