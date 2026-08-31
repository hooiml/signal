'use client';

import { useMemo, useState } from 'react';
import {
    businessLabCompaniesV02,
    calculateDerivedMetricsV02,
    calculateIncomeWaterfallV02,
    type DerivedMetricIdV02,
    type FinancialMetricIdV02,
    type FinancialStatementSnapshotV02,
} from '@/lib/learn/v0-2';

type LabView = 'income' | 'balance' | 'cash' | 'drivers' | 'trend' | 'compare';

const metricDetails: Readonly<Record<FinancialMetricIdV02, { readonly label: string; readonly meaning: string; readonly movers: string; readonly related: string }>> = {
    revenue: { label: 'Revenue', meaning: 'Value recognized from customers during the period.', movers: 'Volume, price, mix, acquisitions, currency, and timing.', related: 'Growth, gross profit, working capital' },
    costOfRevenue: { label: 'Cost of revenue', meaning: 'Direct cost required to deliver recognized revenue.', movers: 'Input costs, labor, mix, utilization, and supplier terms.', related: 'Gross profit, gross margin' },
    grossProfit: { label: 'Gross profit', meaning: 'Revenue remaining after direct delivery costs.', movers: 'Revenue mix, price, cost inflation, and efficiency.', related: 'Gross margin, operating income' },
    operatingExpenses: { label: 'Operating expenses', meaning: 'Selling, research, administrative, and other operating costs.', movers: 'Hiring, marketing, R&D, restructuring, and operating scale.', related: 'Operating income, operating leverage' },
    operatingIncome: { label: 'Operating income', meaning: 'Profit from operations before interest and taxes.', movers: 'Revenue, gross margin, and operating expenses.', related: 'Operating margin, interest coverage, ROIC' },
    interestExpense: { label: 'Interest expense', meaning: 'Financing cost recognized for debt and related obligations.', movers: 'Debt amount, refinancing rates, maturity mix, and hedging.', related: 'Net income, interest coverage, debt risk' },
    taxes: { label: 'Taxes', meaning: 'Income-tax expense recognized for the period.', movers: 'Pre-tax income, jurisdiction mix, rates, and one-off items.', related: 'Net income, estimated NOPAT' },
    netIncome: { label: 'Net income', meaning: 'Accounting profit after operating, financing, and tax effects.', movers: 'Every upstream income-statement driver and non-operating item.', related: 'EPS, net margin, cash conversion' },
    operatingCashFlow: { label: 'Operating cash flow', meaning: 'Cash generated or consumed by operating activity.', movers: 'Earnings, working capital, non-cash items, and timing.', related: 'Free cash flow, cash conversion' },
    capex: { label: 'Capital expenditure', meaning: 'Cash invested in property, equipment, and long-lived operating assets.', movers: 'Capacity, maintenance, expansion, and business capital intensity.', related: 'Free cash flow, invested capital' },
    freeCashFlow: { label: 'Free cash flow', meaning: 'Operating cash flow remaining after capital expenditure.', movers: 'Cash conversion and reinvestment needs.', related: 'FCF margin, FCF yield, debt capacity' },
    cash: { label: 'Cash', meaning: 'Cash and cash equivalents available at the reporting date.', movers: 'Free cash flow, financing, acquisitions, dividends, and buybacks.', related: 'Net debt, liquidity' },
    receivables: { label: 'Receivables', meaning: 'Customer amounts recognized but not yet collected.', movers: 'Sales, collection timing, credit terms, and customer quality.', related: 'Working capital, operating cash flow' },
    inventory: { label: 'Inventory', meaning: 'Goods held for production or sale.', movers: 'Demand, supply planning, input prices, and obsolescence.', related: 'Working capital, cash conversion' },
    totalAssets: { label: 'Total assets', meaning: 'Recorded resources controlled by the business.', movers: 'Investment, acquisitions, depreciation, and working capital.', related: 'ROA, invested capital' },
    debt: { label: 'Debt', meaning: 'Interest-bearing borrowings at the reporting date.', movers: 'Borrowing, repayment, acquisitions, and cash deficits.', related: 'Net debt, interest coverage, refinancing risk' },
    currentLiabilities: { label: 'Current liabilities', meaning: 'Obligations expected to be settled within the operating cycle or one year.', movers: 'Supplier terms, accrued costs, short-term debt, and operations.', related: 'Liquidity, working capital' },
    longTermLiabilities: { label: 'Long-term liabilities', meaning: 'Obligations generally due beyond one year.', movers: 'Long-term debt, leases, pensions, and deferred obligations.', related: 'Financial flexibility, refinancing risk' },
    equity: { label: 'Equity', meaning: 'Residual accounting interest after liabilities.', movers: 'Earnings, dividends, issuance, buybacks, and accumulated adjustments.', related: 'ROE, debt/equity' },
    sharesDiluted: { label: 'Diluted shares', meaning: 'Weighted-average shares including dilutive instruments.', movers: 'Issuance, stock compensation, options, and buybacks.', related: 'EPS, per-share growth' },
    investedCapital: { label: 'Invested capital', meaning: 'Operating capital funded by debt and equity for this exercise.', movers: 'Reinvestment, acquisitions, divestitures, and working capital.', related: 'ROIC, capital intensity' },
};

const statementRows: Readonly<Record<'income' | 'balance' | 'cash', readonly FinancialMetricIdV02[]>> = {
    income: ['revenue', 'costOfRevenue', 'grossProfit', 'operatingExpenses', 'operatingIncome', 'interestExpense', 'taxes', 'netIncome', 'sharesDiluted'],
    balance: ['cash', 'receivables', 'inventory', 'totalAssets', 'debt', 'currentLiabilities', 'longTermLiabilities', 'equity', 'investedCapital'],
    cash: ['netIncome', 'operatingCashFlow', 'capex', 'freeCashFlow'],
};

const derivedLabels: Readonly<Record<DerivedMetricIdV02, string>> = {
    grossMargin: 'Gross margin', operatingMargin: 'Operating margin', netMargin: 'Net margin', fcfMargin: 'FCF margin', cashConversion: 'Cash conversion',
    netDebt: 'Net debt', interestCoverage: 'Interest coverage', roic: 'Estimated ROIC', eps: 'EPS', pe: 'P/E', fcfYield: 'FCF yield',
};

const metricValue = (id: FinancialMetricIdV02, value: number | null) => value === null
    ? 'Unavailable'
    : id === 'sharesDiluted' ? `${value.toLocaleString()}m shares` : `$${value.toLocaleString()}m`;
const ratioValue = (id: DerivedMetricIdV02, value: number | null) => value === null
    ? 'Unavailable'
    : ['grossMargin', 'operatingMargin', 'netMargin', 'fcfMargin', 'cashConversion', 'roic', 'fcfYield'].includes(id) ? `${value.toFixed(2)}%`
        : id === 'netDebt' ? `$${value.toLocaleString()}m` : id === 'eps' ? `$${value.toFixed(2)}` : `${value.toFixed(2)}x`;
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

const StatementTable = ({ snapshot, rows, selected, onSelect }: {
    readonly snapshot: FinancialStatementSnapshotV02;
    readonly rows: readonly FinancialMetricIdV02[];
    readonly selected: FinancialMetricIdV02;
    readonly onSelect: (id: FinancialMetricIdV02) => void;
}) => (
    <div className="research-scrollbar overflow-x-auto rounded-[8px] border border-[var(--v7-border)]">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead className="bg-[var(--v7-surface-quiet)]"><tr><th className="p-3 text-xs text-[var(--v7-text-muted)]">Line item</th><th className="p-3 text-xs text-[var(--v7-text-muted)]">FY {snapshot.fiscalPeriod.slice(0, 4)}</th><th className="p-3 text-xs text-[var(--v7-text-muted)]">Classification</th></tr></thead>
            <tbody>{rows.map((id) => <tr key={id} className="border-t border-[var(--v7-border)]"><th className="p-2"><button type="button" aria-pressed={selected === id} onClick={() => onSelect(id)} className={`min-h-10 w-full rounded-[8px] px-2 text-left font-semibold ${selected === id ? 'bg-[var(--v7-accent-quiet)] text-[var(--v7-text)]' : 'text-[var(--v7-text-secondary)]'}`}>{metricDetails[id].label}</button></th><td className="p-3 font-mono tabular-nums text-[var(--v7-text)]">{metricValue(id, snapshot.values[id])}</td><td className="p-3 text-xs text-[var(--v7-text-muted)]">Reported exercise input</td></tr>)}</tbody>
        </table>
    </div>
);

const MetricExplanation = ({ id }: { readonly id: FinancialMetricIdV02 }) => {
    const item = metricDetails[id];
    return <aside className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Selected line item</p><h3 className="mt-1 font-bold text-[var(--v7-text)]">{item.label}</h3><p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">{item.meaning}</p><dl className="mt-3 grid gap-3 text-xs leading-5"><div><dt className="font-bold text-[var(--v7-text)]">What moves it</dt><dd className="text-[var(--v7-text-secondary)]">{item.movers}</dd></div><div><dt className="font-bold text-[var(--v7-text)]">Related metrics</dt><dd className="text-[var(--v7-text-secondary)]">{item.related}</dd></div></dl></aside>;
};

export const LearnFinancialsLabV2 = () => {
    const [view, setView] = useState<LabView>('income');
    const [companyId, setCompanyId] = useState(businessLabCompaniesV02[0].id);
    const [selectedMetric, setSelectedMetric] = useState<FinancialMetricIdV02>('revenue');
    const [trendMetric, setTrendMetric] = useState<FinancialMetricIdV02>('revenue');
    const company = businessLabCompaniesV02.find((candidate) => candidate.id === companyId) ?? businessLabCompaniesV02[0];
    const latest = company.snapshots[0];
    const derivedMetrics = useMemo(() => calculateDerivedMetricsV02(latest, company.sharePrice), [company.sharePrice, latest]);
    const [grossMargin, setGrossMargin] = useState(70);
    const [operatingExpenses, setOperatingExpenses] = useState(3500);
    const [interestExpense, setInterestExpense] = useState(100);
    const [shares, setShares] = useState(1000);

    const selectCompany = (nextCompanyId: string) => {
        const nextCompany = businessLabCompaniesV02.find((candidate) => candidate.id === nextCompanyId) ?? businessLabCompaniesV02[0];
        const nextSnapshot = nextCompany.snapshots[0];
        setCompanyId(nextCompany.id);
        setGrossMargin(calculateDerivedMetricsV02(nextSnapshot, nextCompany.sharePrice).grossMargin.value ?? 50);
        setOperatingExpenses(nextSnapshot.values.operatingExpenses ?? 0);
        setInterestExpense(nextSnapshot.values.interestExpense ?? 0);
        setShares(nextSnapshot.values.sharesDiluted ?? 1);
    };

    const waterfall = calculateIncomeWaterfallV02({ revenue: latest.values.revenue ?? 0, grossMarginPercent: grossMargin, operatingExpenses, interestExpense, taxRatePercent: 21, dilutedShares: shares });
    const maxTrend = Math.max(...company.snapshots.map((item) => Math.abs(item.values[trendMetric] ?? 0)), 1);
    const comparisonRows: readonly DerivedMetricIdV02[] = ['operatingMargin', 'fcfMargin', 'netDebt', 'interestCoverage', 'roic', 'pe', 'fcfYield'];

    const statementView = view === 'income' || view === 'balance' || view === 'cash';
    return (
        <section data-testid="financials-lab" aria-labelledby="financials-lab-title" className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Financials Lab</p><h2 id="financials-lab-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">Trace the business behind the valuation</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">Reported exercise inputs remain labeled. Every calculated ratio exposes its formula, inputs, period, and methodology.</p></div>
                <div className="flex flex-wrap gap-2" aria-label="Financials Lab company"><span className="inline-flex min-h-10 items-center rounded-[8px] border border-[var(--v7-border)] px-3 text-xs text-[var(--v7-text-muted)]">Annual</span>{businessLabCompaniesV02.map((item) => <button key={item.id} type="button" aria-pressed={company.id === item.id} onClick={() => selectCompany(item.id)} className={`min-h-10 rounded-[8px] border px-3 text-sm font-semibold ${company.id === item.id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{item.name}</button>)}</div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[var(--v7-text-muted)]">{company.description} Values use USD millions. Source: {latest.sourceLabel}. Known as of {date(latest.knownAsOf)}.</p>

            <nav aria-label="Financials Lab views" className="research-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">{([
                ['income', 'Income Statement'], ['balance', 'Balance Sheet'], ['cash', 'Cash Flow'], ['drivers', 'Driver Tree'], ['trend', 'Historical Trend'], ['compare', 'Compare'],
            ] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)} className={`min-h-10 shrink-0 rounded-[8px] border px-3 text-sm font-semibold ${view === id ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{label}</button>)}</nav>

            {statementView ? <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><StatementTable snapshot={latest} rows={statementRows[view]} selected={selectedMetric} onSelect={setSelectedMetric} /><MetricExplanation id={selectedMetric} /></div> : null}

            {view === 'income' ? <section className="mt-5 border-t border-[var(--v7-border)] pt-5" aria-labelledby="income-manipulator-title"><h3 id="income-manipulator-title" className="font-bold text-[var(--v7-text)]">Income-statement waterfall</h3><p className="mt-1 text-xs text-[var(--v7-text-muted)]">Change the drivers and inspect the downstream effect. Revenue and the 21% exercise tax rate remain fixed.</p><div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]"><div className="grid gap-3">{[
                ['Gross margin', grossMargin, setGrossMargin, 20, 85, '%'],
                ['Operating expenses', operatingExpenses, setOperatingExpenses, 500, 6000, 'm'],
                ['Interest expense', interestExpense, setInterestExpense, 0, 1000, 'm'],
                ['Diluted shares', shares, setShares, 300, 1800, 'm'],
            ].map(([label, value, setter, min, max, suffix]) => <label key={String(label)} className="grid gap-1 text-xs font-semibold text-[var(--v7-text-secondary)]"><span className="flex justify-between gap-2"><span>{String(label)}</span><span className="font-mono">{Number(value).toFixed(0)}{String(suffix)}</span></span><input type="range" aria-label={String(label)} min={Number(min)} max={Number(max)} step="1" value={Number(value)} onChange={(event) => (setter as (next: number) => void)(Number(event.target.value))} className="min-h-10 accent-[var(--v7-accent)]" /></label>)}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
                ['Revenue', waterfall.revenue], ['Gross profit', waterfall.grossProfit], ['Operating income', waterfall.operatingIncome], ['Net income', waterfall.netIncome],
            ].map(([label, value]) => <article key={String(label)} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-[10px] font-bold uppercase text-[var(--v7-text-muted)]">{String(label)}</p><p className="mt-1 font-mono text-lg font-bold text-[var(--v7-text)]">${Number(value).toFixed(0)}m</p></article>)}<article className="col-span-2 rounded-[8px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-3 sm:col-span-4"><p className="text-[10px] font-bold uppercase text-[var(--v7-accent)]">Derived EPS</p><p data-testid="v2-waterfall-eps" className="mt-1 font-mono text-2xl font-bold text-[var(--v7-text)]">{waterfall.eps === null ? 'Unavailable' : `$${waterfall.eps.toFixed(2)}`}</p><p className="mt-1 text-xs text-[var(--v7-text-secondary)]">Net income / diluted shares. A share-count change affects per-share economics without changing company-level profit.</p></article></div></div></section> : null}

            {view === 'drivers' ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(Object.keys(derivedMetrics) as DerivedMetricIdV02[]).map((id) => { const item = derivedMetrics[id]; return <details key={id} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><summary className="cursor-pointer list-none"><span className="text-[11px] font-bold uppercase text-[var(--v7-text-muted)]">{derivedLabels[id]}</span><span className="mt-1 block font-mono text-xl font-bold text-[var(--v7-text)]">{ratioValue(id, item.value)}</span><span className="mt-1 block text-[11px] font-semibold text-[var(--v7-accent)]">{item.status}</span></summary><div className="mt-3 border-t border-[var(--v7-border)] pt-3 text-xs leading-5 text-[var(--v7-text-secondary)]"><p><strong className="text-[var(--v7-text)]">Formula:</strong> {item.formula}</p><ul className="mt-2">{item.inputs.map((input) => <li key={input.label}>{input.label}: {input.value === null ? 'Unavailable' : input.value.toLocaleString()}</li>)}</ul><p className="mt-2 text-[var(--v7-text-muted)]">Method: {item.methodologyVersion}</p></div></details>; })}</div> : null}

            {view === 'trend' ? <section className="mt-4"><label className="grid max-w-xs gap-1 text-sm font-semibold text-[var(--v7-text)]">Trend metric<select value={trendMetric} onChange={(event) => setTrendMetric(event.target.value as FinancialMetricIdV02)} className="min-h-10 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-normal">{(['revenue', 'operatingIncome', 'netIncome', 'operatingCashFlow', 'freeCashFlow', 'debt', 'sharesDiluted'] as const).map((id) => <option key={id} value={id}>{metricDetails[id].label}</option>)}</select></label><div className="mt-4 grid gap-3">{[...company.snapshots].reverse().map((item) => { const value = item.values[trendMetric]; return <div key={item.id} className="grid grid-cols-[72px_minmax(0,1fr)_110px] items-center gap-3"><span className="font-mono text-xs text-[var(--v7-text-muted)]">FY {item.fiscalPeriod.slice(0, 4)}</span><div className="h-4 overflow-hidden rounded bg-[var(--v7-border)]"><div className="h-full bg-[var(--v7-accent)]" style={{ width: `${Math.max(0, Math.abs(value ?? 0) / maxTrend * 100)}%` }} /></div><span className="text-right font-mono text-xs text-[var(--v7-text)]">{metricValue(trendMetric, value)}</span></div>; })}</div></section> : null}

            {view === 'compare' ? <section className="mt-4"><div className="research-scrollbar overflow-x-auto rounded-[8px] border border-[var(--v7-border)]"><table className="w-full min-w-[640px] border-collapse text-left text-sm"><thead className="bg-[var(--v7-surface-quiet)]"><tr><th className="p-3 text-xs text-[var(--v7-text-muted)]">Derived evidence</th>{businessLabCompaniesV02.map((item) => <th key={item.id} className="p-3 text-[var(--v7-text)]">{item.name}</th>)}</tr></thead><tbody>{comparisonRows.map((id) => <tr key={id} className="border-t border-[var(--v7-border)]"><th className="p-3 text-xs text-[var(--v7-text-secondary)]">{derivedLabels[id]}</th>{businessLabCompaniesV02.map((item) => <td key={item.id} className="p-3 font-mono text-[var(--v7-text)]">{ratioValue(id, calculateDerivedMetricsV02(item.snapshots[0], item.sharePrice)[id].value)}</td>)}</tr>)}</tbody></table></div><p className="mt-3 rounded-[8px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-xs leading-5 text-[var(--v7-text-secondary)]">Structurally weak comparison warning: both exercises use the same currency and annual period, but business models, cyclicality, capital intensity, and accounting economics differ. No automatic winner or investment score is produced.</p></section> : null}

            <details className="mt-5 border-t border-[var(--v7-border)] pt-3"><summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--v7-text)]">Source and methodology inspection</summary><dl className="mt-2 grid gap-2 text-xs leading-5 text-[var(--v7-text-secondary)] sm:grid-cols-2"><div><dt className="font-bold text-[var(--v7-text)]">Source</dt><dd>{latest.sourceLabel} ({latest.sourceId})</dd></div><div><dt className="font-bold text-[var(--v7-text)]">Known as of</dt><dd>{date(latest.knownAsOf)}</dd></div><div><dt className="font-bold text-[var(--v7-text)]">Methodology</dt><dd>{latest.methodologyVersion}</dd></div><div><dt className="font-bold text-[var(--v7-text)]">Missing data</dt><dd>Displayed as Unavailable; never inferred.</dd></div></dl></details>
        </section>
    );
};
