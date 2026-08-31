'use client';

import { useMemo, useState } from 'react';
import {
    calculateMultipleBridgeV03,
    calculatePortfolioExposuresV03,
    calculateValuationMetricsV03,
    macroEvidenceV03,
    valuationMetricsV03,
    type PortfolioHoldingV03,
    type ValuationMetricIdV03,
} from '@/lib/learn/v0-3';

export type InvestmentLabV3 = 'valuation' | 'macro' | 'portfolio';
type Props = { readonly lab: InvestmentLabV3; readonly onComplete: (id: string) => void };

const numberInput = 'min-h-10 w-full rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 font-mono text-sm text-[var(--v7-text)]';
const fieldLabel = 'grid gap-1.5 text-xs font-semibold text-[var(--v7-text-secondary)]';

const ValuationLab = ({ onComplete }: Pick<Props, 'onComplete'>) => {
    const [businessType, setBusinessType] = useState('software');
    const [selectedMetric, setSelectedMetric] = useState<ValuationMetricIdV03>('ev-sales');
    const [reason, setReason] = useState('');
    const [inputs, setInputs] = useState({ marketCap: 120, enterpriseValue: 125, revenue: 20, ebitda: 5, freeCashFlow: 4, bookValue: 12 });
    const [bridge, setBridge] = useState({ startingEps: 5, endingEps: 7, startingMultiple: 30, endingMultiple: 20, dividends: 0 });
    const metrics = calculateValuationMetricsV03(inputs);
    const metric = valuationMetricsV03.find((item) => item.id === selectedMetric)!;
    const result = calculateMultipleBridgeV03(bridge);
    const weak = metric.structurallyWeakFor.includes(businessType);
    const setNumber = (key: keyof typeof inputs, value: string) => setInputs((current) => ({ ...current, [key]: Number(value) }));
    const setBridgeNumber = (key: keyof typeof bridge, value: string) => setBridge((current) => ({ ...current, [key]: Number(value) }));
    return <div data-testid="valuation-lens" className="grid gap-6 xl:grid-cols-2">
        <section>
            <p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Valuation Lens</p>
            <h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Choose evidence that fits the business.</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className={fieldLabel}>Business type<select aria-label="Business type" className={numberInput} value={businessType} onChange={(event) => setBusinessType(event.target.value)}><option value="software">Asset-light software</option><option value="bank">Bank</option><option value="industrial">Industrial</option><option value="early-growth">Early growth</option></select></label>
                <label className={fieldLabel}>Preferred metric<select aria-label="Preferred valuation metric" className={numberInput} value={selectedMetric} onChange={(event) => setSelectedMetric(event.target.value as ValuationMetricIdV03)}>{valuationMetricsV03.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            </div>
            <div className={`mt-4 rounded-[8px] border p-4 ${weak ? 'border-amber-500/60 bg-amber-500/10' : 'border-[var(--v7-border)] bg-[var(--v7-surface-quiet)]'}`}>
                <div className="flex items-start justify-between gap-4"><div><p className="font-bold text-[var(--v7-text)]">{metric.label}</p><p className="mt-1 text-xs text-[var(--v7-text-muted)]">{metric.denominator}</p></div><span className="font-mono text-lg font-bold text-[var(--v7-text)]">{metrics[selectedMetric]?.toFixed(1) ?? 'N/A'}{selectedMetric === 'fcf-yield' ? '%' : 'x'}</span></div>
                <p className="mt-3 text-xs leading-5 text-[var(--v7-text-secondary)]"><strong>Useful when:</strong> {metric.usefulFor}</p><p className="mt-2 text-xs leading-5 text-[var(--v7-text-secondary)]"><strong>Limitation:</strong> {metric.limitation}</p>
                {weak && <p className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">Structural challenge: this is usually a weak starting metric for the selected business type.</p>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{(Object.keys(inputs) as (keyof typeof inputs)[]).map((key) => <label key={key} className={fieldLabel}>{key.replace(/([A-Z])/g, ' $1')} ($bn)<input aria-label={`${key} input`} type="number" className={numberInput} value={inputs[key]} onChange={(event) => setNumber(key, event.target.value)} /></label>)}</div>
            <label className={`${fieldLabel} mt-4`}>Why this evidence?<textarea aria-label="Valuation evidence reasoning" className="min-h-24 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        </section>
        <section className="border-t border-[var(--v7-border)] pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Multiple bridge</p><h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Strong earnings can meet a lower price.</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">{(Object.keys(bridge) as (keyof typeof bridge)[]).map((key) => <label key={key} className={fieldLabel}>{key.replace(/([A-Z])/g, ' $1')}<input aria-label={`${key} input`} type="number" className={numberInput} value={bridge[key]} onChange={(event) => setBridgeNumber(key, event.target.value)} /></label>)}</div>
            {result ? <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-border)]"><Metric label="Starting price" value={`$${result.startingPrice.toFixed(2)}`} /><Metric label="Ending price" value={`$${result.endingPrice.toFixed(2)}`} /><Metric label="Earnings contribution" value={`${result.earningsContributionPercent.toFixed(1)}%`} /><Metric label="Multiple contribution" value={`${result.multipleContributionPercent.toFixed(1)}%`} /><Metric label="Dividend contribution" value={`${result.dividendContributionPercent.toFixed(1)}%`} /><Metric label="Total return" value={`${result.totalReturnPercent.toFixed(1)}%`} testId="multiple-total-return" /></div> : <p className="mt-4 text-sm text-red-600">Use positive EPS and multiple values.</p>}
            <p className="mt-4 text-xs leading-5 text-[var(--v7-text-muted)]">The bridge is an arithmetic explanation, not a forecast. Historical range, peer context, growth, margins, and balance sheet still need separate evidence.</p>
            <button type="button" disabled={reason.trim().length < 12} onClick={() => onComplete('valuation')} className="mt-4 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white disabled:opacity-40">Save valuation reasoning</button>
        </section>
    </div>;
};

const Metric = ({ label, value, testId }: { label: string; value: string; testId?: string }) => <div className="bg-[var(--v7-surface-quiet)] p-3"><p className="text-[10px] uppercase text-[var(--v7-text-muted)]">{label}</p><p data-testid={testId} className="mt-1 font-mono text-base font-bold text-[var(--v7-text)]">{value}</p></div>;

const MacroLab = ({ onComplete }: Pick<Props, 'onComplete'>) => {
    const [reason, setReason] = useState('');
    return <section data-testid="macro-context"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Macro Context</p><h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Facts first, interpretations second.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">This fixed educational snapshot separates what was observed from what it might mean. It does not collapse macro evidence into a bullish or bearish label.</p>
        <div className="mt-5 grid gap-px overflow-hidden rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-border)] lg:grid-cols-2">{macroEvidenceV03.map((item) => <article key={item.metric} className="bg-[var(--v7-surface-quiet)] p-4"><div className="flex justify-between gap-4"><h3 className="font-bold text-[var(--v7-text)]">{item.metric}</h3><span className="font-mono text-sm font-bold">{item.value}</span></div><dl className="mt-3 grid gap-2 text-xs leading-5"><div><dt className="font-bold text-[var(--v7-text-secondary)]">Change</dt><dd>{item.change}</dd></div><div><dt className="font-bold text-[var(--v7-text-secondary)]">Possible interpretation</dt><dd>{item.interpretation}</dd></div><div><dt className="font-bold text-[var(--v7-text-secondary)]">Uncertainty</dt><dd>{item.uncertainty}</dd></div></dl><p className="mt-3 text-[10px] uppercase text-[var(--v7-text-muted)]">{item.knownAsOf}</p></article>)}</div>
        <label className={`${fieldLabel} mt-5 max-w-3xl`}>Second-order exercise: a strong jobs report raises expected rates. Explain both effects.<textarea aria-label="Macro second-order reasoning" className="min-h-28 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <button type="button" disabled={reason.trim().length < 20} onClick={() => onComplete('macro')} className="mt-3 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white disabled:opacity-40">Save macro reasoning</button>
    </section>;
};

const portfolio: readonly PortfolioHoldingV03[] = [
    { ticker: 'APP-A', weight: 18, sector: 'Software', factor: 'Long-duration growth' }, { ticker: 'APP-B', weight: 17, sector: 'Software', factor: 'Long-duration growth' }, { ticker: 'CHIP-A', weight: 16, sector: 'Semiconductors', factor: 'Long-duration growth' }, { ticker: 'CHIP-B', weight: 14, sector: 'Semiconductors', factor: 'Long-duration growth' }, { ticker: 'BANK-A', weight: 15, sector: 'Financials', factor: 'Credit cycle' }, { ticker: 'HEALTH-A', weight: 10, sector: 'Healthcare', factor: 'Defensive demand' }, { ticker: 'CASH', weight: 10, sector: 'Cash', factor: 'Cash' },
];

const PortfolioLab = ({ onComplete }: Pick<Props, 'onComplete'>) => {
    const factors = useMemo(() => calculatePortfolioExposuresV03(portfolio, 'factor'), []);
    const sectors = useMemo(() => calculatePortfolioExposuresV03(portfolio, 'sector'), []);
    const [risk, setRisk] = useState('');
    return <section data-testid="portfolio-lab"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Portfolio construction</p><h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Seven lines, one dominant factor.</h2><p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">Ticker count is not diversification. Inspect both sector labels and shared economic sensitivity.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-bold text-[var(--v7-text)]">Factor exposure</h3>{factors.map((item) => <Exposure key={item.key} label={item.key} weight={item.weight} holdingCount={item.holdingCount} />)}</div><div><h3 className="text-sm font-bold text-[var(--v7-text)]">Sector exposure</h3>{sectors.map((item) => <Exposure key={item.key} label={item.key} weight={item.weight} holdingCount={item.holdingCount} />)}</div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{['Permanent capital loss', 'Liquidity risk', 'Correlation risk', 'Leverage risk'].map((item) => <div key={item} className="rounded-[6px] border border-[var(--v7-border)] p-3 text-xs font-semibold">{item}</div>)}</div>
        <label className={`${fieldLabel} mt-5 max-w-3xl`}>Which common factor creates the largest hidden concentration?<textarea aria-label="Portfolio concentration reasoning" className="min-h-24 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm" value={risk} onChange={(event) => setRisk(event.target.value)} /></label>
        <p className="mt-3 max-w-3xl text-xs leading-5 text-[var(--v7-text-muted)]">Bias challenge: name the exact sentence or assumption that could show confirmation bias. A later loss alone is not evidence of bias.</p>
        <button type="button" disabled={risk.trim().length < 12} onClick={() => onComplete('portfolio')} className="mt-3 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white disabled:opacity-40">Save risk reasoning</button>
    </section>;
};

const Exposure = ({ label, weight, holdingCount }: { label: string; weight: number; holdingCount: number }) => <div className="mt-3"><div className="flex items-center justify-between gap-3 text-xs"><span>{label}</span><span className="font-mono">{weight}% · {holdingCount} lines</span></div><div className="mt-1 h-2 overflow-hidden rounded bg-[var(--v7-border)]"><div className="h-full bg-[var(--v7-accent)]" style={{ width: `${Math.min(weight, 100)}%` }} /></div></div>;

export const LearnInvestmentLabsV3 = ({ lab, onComplete }: Props) => <div className="border-y border-[var(--v7-border)] py-5">{lab === 'valuation' ? <ValuationLab onComplete={onComplete} /> : lab === 'macro' ? <MacroLab onComplete={onComplete} /> : <PortfolioLab onComplete={onComplete} />}</div>;
