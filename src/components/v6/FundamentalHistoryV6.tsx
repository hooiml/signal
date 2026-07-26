import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchFundamentalPeriod } from '@/lib/types/research-snapshot';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const percent = (value: number | null) => value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

const compact = (value: number | null, currency: string) => {
    if (value === null) return '—';
    try {
        return new Intl.NumberFormat('en-US', {
            notation: 'compact',
            style: 'currency',
            currency,
            currencyDisplay: 'code',
            maximumFractionDigits: 1,
        }).format(value);
    } catch {
        return `${currency} ${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
    }
};

const shares = (value: number | null) => value === null
    ? '—'
    : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const periodLabel = (value: string) => new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
}).format(new Date(`${value}T00:00:00.000Z`));

export const FundamentalHistoryV6 = ({
    ticker,
    history,
    theme,
}: {
    readonly ticker: ResearchWatchlistItem;
    readonly history: readonly ResearchFundamentalPeriod[];
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const source = history[0]?.source ?? null;
    const sourceUrl = source === 'SEC EDGAR'
        ? `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(ticker.symbol)}`
        : `https://finance.yahoo.com/quote/${encodeURIComponent(ticker.providerSymbol)}/financials/`;
    return (
        <section className={'mt-4 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="fundamental-history-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Period evidence</p>
                    <h2 id="fundamental-history-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Annual fundamental history</h2>
                    <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                        {history.length > 0
                            ? `${history.length} annual period${history.length === 1 ? '' : 's'} · ${source}. Missing values remain unavailable.`
                            : 'No comparable annual history is available from the connected free source.'}
                    </p>
                </div>
                {source ? <a href={sourceUrl} target="_blank" rel="noreferrer" className={'min-h-10 rounded border px-3 py-2 text-xs font-semibold underline underline-offset-2 ' + styles.row}>Open {source}</a> : null}
            </div>
            {history.length > 0 ? (
                <>
                    <div className="research-scrollbar mt-4 max-w-full overflow-x-auto rounded border">
                        <table className="min-w-[980px] w-full border-collapse text-left text-xs">
                            <thead className={styles.statusSurface}>
                                <tr>
                                    {['Period', 'Revenue', 'Revenue YoY', 'Gross margin', 'Op margin', 'Net income', 'Free cash flow', 'Debt', 'Cash', 'Shares / YoY'].map((label) => (
                                        <th key={label} scope="col" className={'whitespace-nowrap border-b px-3 py-2 font-semibold ' + styles.divider + ' ' + styles.textMuted}>{label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((period) => (
                                    <tr key={period.reportingPeriod} className={'border-b last:border-b-0 ' + styles.divider}>
                                        <th scope="row" className={'whitespace-nowrap px-3 py-3 font-semibold ' + styles.textPrimary}>{periodLabel(period.reportingPeriod)}</th>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{compact(period.annualRevenue, period.currency)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + (period.revenueGrowthPercent !== null && period.revenueGrowthPercent < 0 ? styles.risk : styles.textSecondary)}>{percent(period.revenueGrowthPercent)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{percent(period.grossMarginPercent)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{percent(period.operatingMarginPercent)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{compact(period.annualNetIncome, period.currency)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{compact(period.freeCashFlow, period.currency)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{compact(period.debt, period.currency)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{compact(period.cash, period.currency)}</td>
                                        <td className={'whitespace-nowrap px-3 py-3 font-mono tabular-nums ' + styles.textSecondary}>{period.shareChangePercent === null ? shares(period.shares) : percent(period.shareChangePercent)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p className={'mt-3 text-xs leading-5 ' + styles.textMuted}>
                        {ticker.market === 'MY'
                            ? 'Malaysia history is normalized from Yahoo Finance, not a Bursa filing feed. Confirm decision-critical values against the issuer’s Bursa announcements.'
                            : 'US history is normalized from SEC Company Facts. Fiscal calendars and concept changes can affect period comparability.'}
                    </p>
                </>
            ) : null}
        </section>
    );
};
