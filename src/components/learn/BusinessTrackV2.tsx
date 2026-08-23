'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    businessModulesV02,
    calculateBusinessDriversV02,
    type BusinessModuleIdV02,
} from '@/lib/learn/v0-2';

const progressKey = 'signal-learn-v0.2-progress';

const Field = ({ label, value, onChange, suffix, step = '1' }: {
    readonly label: string;
    readonly value: number;
    readonly onChange: (value: number) => void;
    readonly suffix?: string;
    readonly step?: string;
}) => (
    <label className="grid gap-1.5 text-xs font-semibold text-[var(--v7-text-secondary)]">
        {label}
        <span className="flex min-h-10 items-center rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 focus-within:border-[var(--v7-accent)]">
            <input type="number" value={value} step={step} onChange={(event) => onChange(Number(event.target.value))} className="min-w-0 flex-1 bg-transparent font-mono text-sm text-[var(--v7-text)] outline-none" />
            {suffix ? <span className="ml-1 text-[var(--v7-text-muted)]">{suffix}</span> : null}
        </span>
    </label>
);

const Card = ({ title, children, tone = 'default' }: { readonly title: string; readonly children: React.ReactNode; readonly tone?: 'default' | 'accent' | 'risk' }) => (
    <article className={`rounded-[11px] border p-4 ${tone === 'accent' ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : tone === 'risk' ? 'border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)]' : 'border-[var(--v7-border)] bg-[var(--v7-surface-quiet)]'}`}>
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">{title}</p>
        <div className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">{children}</div>
    </article>
);

const format = (value: number | null, suffix = '') => value === null || !Number.isFinite(value) ? 'N/A' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;

const FinancialDriverLab = ({ focus }: { readonly focus: BusinessModuleIdV02 }) => {
    const [revenue, setRevenue] = useState(1000);
    const [grossMargin, setGrossMargin] = useState(60);
    const [opex, setOpex] = useState(350);
    const [interest, setInterest] = useState(20);
    const [tax, setTax] = useState(20);
    const [shares, setShares] = useState(100);
    const [ocf, setOcf] = useState(260);
    const [capex, setCapex] = useState(80);
    const [debt, setDebt] = useState(300);
    const [cash, setCash] = useState(180);
    const [investedCapital, setInvestedCapital] = useState(900);
    const result = calculateBusinessDriversV02({ revenue, grossMarginPercent: grossMargin, operatingExpenses: opex, interestExpense: interest, taxRatePercent: tax, dilutedShares: shares, operatingCashFlow: ocf, capex, debt, cash, investedCapital });
    const highlight = focus === 'cash-flow' ? 'Free cash flow' : focus === 'debt' ? 'Net debt' : focus === 'roic' ? 'ROIC' : focus === 'dilution' ? 'EPS' : 'Operating income';
    const highlightValue = focus === 'cash-flow' ? `$${format(result.freeCashFlow)}m` : focus === 'debt' ? `$${format(result.netDebt)}m` : focus === 'roic' ? format(result.roicPercent, '%') : focus === 'dilution' ? `$${format(result.eps)}` : `$${format(result.operatingIncome)}m`;

    return (
        <div data-testid="business-driver-lab" className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Revenue" value={revenue} onChange={setRevenue} suffix="$m" step="25" />
                    <Field label="Gross margin" value={grossMargin} onChange={setGrossMargin} suffix="%" />
                    <Field label="Operating expenses" value={opex} onChange={setOpex} suffix="$m" step="10" />
                    <Field label="Interest expense" value={interest} onChange={setInterest} suffix="$m" />
                    <Field label="Tax rate" value={tax} onChange={setTax} suffix="%" />
                    <Field label="Diluted shares" value={shares} onChange={setShares} suffix="m" />
                    <Field label="Operating cash flow" value={ocf} onChange={setOcf} suffix="$m" step="10" />
                    <Field label="CapEx" value={capex} onChange={setCapex} suffix="$m" step="10" />
                    <Field label="Debt" value={debt} onChange={setDebt} suffix="$m" step="10" />
                    <Field label="Cash" value={cash} onChange={setCash} suffix="$m" step="10" />
                    <Field label="Invested capital" value={investedCapital} onChange={setInvestedCapital} suffix="$m" step="25" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        ['Gross profit', `$${format(result.grossProfit)}m`],
                        ['Operating income', `$${format(result.operatingIncome)}m`],
                        ['Net income', `$${format(result.netIncome)}m`],
                        ['EPS', `$${format(result.eps)}`],
                        ['FCF', `$${format(result.freeCashFlow)}m`],
                        ['Net debt', `$${format(result.netDebt)}m`],
                        ['Interest coverage', result.interestCoverage === null ? 'No interest' : format(result.interestCoverage, '×')],
                        ['Simplified ROIC', format(result.roicPercent, '%')],
                    ].map(([label, value]) => <div key={label} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-[11px] text-[var(--v7-text-muted)]">{label}</p><p className="mt-1 font-mono text-sm font-bold text-[var(--v7-text)]">{value}</p></div>)}
                </div>
            </div>
            <Card title={`Watch this driver · ${highlight}`} tone="accent">
                <span data-testid="business-driver-highlight" className="font-mono text-2xl font-bold text-[var(--v7-text)]">{highlightValue}</span>
                <p className="mt-3">Change the inputs and follow how one business decision flows through earnings, cash generation, leverage, or per-share economics.</p>
                <p className="mt-3 text-xs text-[var(--v7-text-muted)]">The ROIC calculation is intentionally simplified for learning: after-tax operating income ÷ invested capital.</p>
            </Card>
        </div>
    );
};

const Lesson = ({ id }: { readonly id: BusinessModuleIdV02 }) => {
    if (id === 'revenue') return <div className="grid gap-3 sm:grid-cols-2"><Card title="Rate ≠ quality" tone="accent">Two companies can both grow revenue 20%, while one grows organically and another grows mostly through acquisitions. The headline rate alone cannot tell you the quality or cost of that growth.</Card><Card title="Ask where it came from">Inspect product, segment, geography, pricing, volume, and acquisitions. Then ask whether the growth is accelerating or decelerating.</Card></div>;
    if (id === 'balance-sheet') return <div className="grid gap-3 sm:grid-cols-2"><Card title="Financial flexibility" tone="accent">Cash and liquid assets can give a company room to invest or survive weak periods. Debt creates obligations that must be judged against cash generation and maturity timing.</Card><Card title="Do not ratio-shop" tone="risk">The same debt ratio can mean very different risk for a stable subscription business and a cyclical commodity producer.</Card></div>;
    if (id === 'connections') return <div className="grid gap-3"><Card title="Driver tree" tone="accent"><span className="font-mono text-xs leading-7">Revenue → Gross profit → Operating income → Net income → EPS → P/E<br />Revenue → Operating cash flow → CapEx → FCF → FCF yield<br />Debt + Cash + Interest burden → Financial resilience</span></Card><Card title="Analysis habit">When a valuation multiple changes, walk backward through the tree. Ask which underlying business driver changed, which expectation changed, and which facts are still missing.</Card></div>;
    return <FinancialDriverLab focus={id} />;
};

export const BusinessTrackV2 = () => {
    const [moduleId, setModuleId] = useState<BusinessModuleIdV02>('revenue');
    const [completed, setCompleted] = useState<BusinessModuleIdV02[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try {
                const parsed: unknown = JSON.parse(window.localStorage.getItem(progressKey) ?? '[]');
                if (Array.isArray(parsed)) setCompleted(parsed.filter((value): value is BusinessModuleIdV02 => typeof value === 'string' && businessModulesV02.some((item) => item.id === value)));
            } catch { setCompleted([]); }
            setReady(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => { if (ready) window.localStorage.setItem(progressKey, JSON.stringify(completed)); }, [completed, ready]);
    const selectedModule = useMemo(() => businessModulesV02.find((item) => item.id === moduleId) ?? businessModulesV02[0], [moduleId]);
    const toggleComplete = () => setCompleted((current) => current.includes(moduleId) ? current.filter((id) => id !== moduleId) : [...current, moduleId]);

    return (
        <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="min-w-0 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3 lg:self-start">
                <div className="flex items-center justify-between gap-2 px-2 pb-2"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">v0.2 path</p><span className="font-mono text-[11px] text-[var(--v7-text-muted)]">{completed.length}/{businessModulesV02.length}</span></div>
                <div className="research-scrollbar flex gap-2 overflow-x-auto lg:grid lg:overflow-visible" aria-label="Business foundation modules">
                    {businessModulesV02.map((item) => {
                        const selected = item.id === moduleId;
                        const done = completed.includes(item.id);
                        return <button key={item.id} type="button" aria-pressed={selected} onClick={() => setModuleId(item.id)} className={`min-h-11 min-w-[200px] rounded-[9px] border px-3 py-2 text-left lg:min-w-0 ${selected ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-transparent hover:border-[var(--v7-border)] hover:bg-[var(--v7-surface)]'}`}><span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-[var(--v7-text)]">{item.eyebrow} · {item.title}</span><span aria-label={done ? 'Completed' : 'Not completed'} className={`h-2.5 w-2.5 shrink-0 rounded-full ${done ? 'bg-[var(--v7-accent)]' : 'border border-[var(--v7-border-strong)]'}`} /></span></button>;
                    })}
                </div>
            </aside>
            <section aria-labelledby="business-module-title" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
                <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                    <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Module {selectedModule.eyebrow}</p><h2 id="business-module-title" className="mt-1 text-xl font-bold text-[var(--v7-text)]">{selectedModule.title}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--v7-text-secondary)]">{selectedModule.objective}</p></div>
                    <button type="button" aria-pressed={completed.includes(moduleId)} onClick={toggleComplete} className={`min-h-10 rounded-[9px] border px-4 text-sm font-semibold ${completed.includes(moduleId) ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] text-[var(--v7-text)]' : 'border-[var(--v7-border)] text-[var(--v7-text-secondary)]'}`}>{completed.includes(moduleId) ? 'Understood ✓' : 'Mark understood'}</button>
                </div>
                <div className="pt-5"><Lesson id={moduleId} /></div>
            </section>
        </div>
    );
};
