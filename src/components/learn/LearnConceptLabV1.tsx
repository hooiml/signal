'use client';

import { useMemo, useState } from 'react';
import {
    calculateEpsV01,
    calculatePeV01,
    classifyExpectationV01,
    learnModulesV01,
    type LearnModuleIdV01,
} from '@/lib/learn/v0-1';

const formatNumber = (value: number | null, digits = 2) => value === null
    ? 'Not meaningful'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);

const Field = ({ label, value, onChange, prefix, suffix, step = '0.1' }: {
    readonly label: string;
    readonly value: number;
    readonly onChange: (value: number) => void;
    readonly prefix?: string;
    readonly suffix?: string;
    readonly step?: string;
}) => (
    <label className="grid gap-1.5 text-sm text-[var(--v7-text-secondary)]">
        <span className="font-semibold text-[var(--v7-text)]">{label}</span>
        <span className="flex min-h-11 items-center rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 focus-within:border-[var(--v7-accent)] focus-within:ring-2 focus-within:ring-[var(--v7-accent-quiet)]">
            {prefix ? <span className="mr-1 text-[var(--v7-text-muted)]">{prefix}</span> : null}
            <input
                type="number"
                value={Number.isFinite(value) ? value : ''}
                step={step}
                onChange={(event) => onChange(Number(event.target.value))}
                className="min-w-0 flex-1 bg-transparent font-mono text-sm tabular-nums text-[var(--v7-text)] outline-none"
            />
            {suffix ? <span className="ml-1 text-[var(--v7-text-muted)]">{suffix}</span> : null}
        </span>
    </label>
);

const DefinitionCard = ({ label, children, tone = 'default' }: {
    readonly label: string;
    readonly children: React.ReactNode;
    readonly tone?: 'default' | 'risk' | 'accent';
}) => {
    const toneClass = tone === 'risk'
        ? 'border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)]'
        : tone === 'accent'
            ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]'
            : 'border-[var(--v7-border)] bg-[var(--v7-surface-quiet)]';
    return (
        <article className={`rounded-[11px] border p-4 ${toneClass}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.11em] text-[var(--v7-text-muted)]">{label}</p>
            <div className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">{children}</div>
        </article>
    );
};

const EvidenceLesson = () => (
    <div className="grid gap-3 sm:grid-cols-2">
        <DefinitionCard label="Fact" tone="accent">A directly observed or reported value, with a source and date. Example: a filing reported annual net income of $10B.</DefinitionCard>
        <DefinitionCard label="Interpretation">A conclusion drawn from facts. Example: profitability improved because margin expanded.</DefinitionCard>
        <DefinitionCard label="Expectation">A forecast or assumption about what may happen. It is not a reported fact.</DefinitionCard>
        <DefinitionCard label="Thesis">Your current explanation of why an investment may be attractive or unattractive, including what could make it wrong.</DefinitionCard>
        <DefinitionCard label="Uncertainty" tone="risk">The unresolved information or future event that could materially change the interpretation.</DefinitionCard>
        <DefinitionCard label="Decision quality">A sound process can still produce a poor outcome. A lucky outcome does not retroactively make weak reasoning strong.</DefinitionCard>
    </div>
);

const EpsLesson = () => {
    const [netIncome, setNetIncome] = useState(10_000);
    const [shares, setShares] = useState(2_000);
    const eps = calculateEpsV01(netIncome, shares);
    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div>
                <p className="text-sm leading-6 text-[var(--v7-text-secondary)]">EPS translates company earnings into a per-share figure. The denominator matters: dilution can reduce how much company-level growth reaches each share.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Net income" value={netIncome} onChange={setNetIncome} prefix="$" suffix="m" step="100" />
                    <Field label="Diluted shares" value={shares} onChange={setShares} suffix="m" step="50" />
                </div>
                <div className="mt-4 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4">
                    <p className="text-xs text-[var(--v7-text-muted)]">Net income ÷ diluted shares</p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--v7-text)]">${formatNumber(eps)}</p>
                </div>
            </div>
            <DefinitionCard label="Do not use blindly" tone="risk">EPS can change because of earnings, dilution, buybacks, or one-off accounting items. Before interpreting growth, ask what changed in both the numerator and denominator.</DefinitionCard>
        </div>
    );
};

const PeLesson = () => {
    const [price, setPrice] = useState(150);
    const [eps, setEps] = useState(5);
    const pe = calculatePeV01(price, eps);
    return (
        <div data-testid="pe-lab" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div>
                <p className="text-sm leading-6 text-[var(--v7-text-secondary)]">P/E asks how much the market price represents for each unit of positive earnings. It is a starting point for valuation context, not a verdict.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Share price" value={price} onChange={setPrice} prefix="$" step="1" />
                    <Field label="EPS" value={eps} onChange={setEps} prefix="$" step="0.25" />
                </div>
                <div className="mt-4 rounded-[11px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-4">
                    <p className="text-xs text-[var(--v7-text-muted)]">Price ÷ EPS</p>
                    <p data-testid="pe-result" className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--v7-text)]">{pe === null ? 'Not meaningful' : `${formatNumber(pe)}×`}</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">{pe === null
                        ? 'Signal does not present a normal P/E when earnings are zero or negative.'
                        : `At these inputs, the price is about ${formatNumber(pe)} times annual earnings per share. That does not tell you whether the stock is cheap without growth, quality, history, peers, and expectations.`}</p>
                </div>
            </div>
            <div className="grid content-start gap-3">
                <DefinitionCard label="High P/E ≠ automatically expensive">Investors may pay a higher multiple for growth, durability, capital efficiency, or lower perceived risk. The question is whether those expectations are justified.</DefinitionCard>
                <DefinitionCard label="Low P/E ≠ automatically cheap" tone="risk">A low multiple can reflect declining earnings, cyclicality, debt, or a business the market expects to weaken. Ask why the multiple is low.</DefinitionCard>
            </div>
        </div>
    );
};

const ForwardPeLesson = () => {
    const [price, setPrice] = useState(150);
    const [trailingEps, setTrailingEps] = useState(5);
    const [forwardEps, setForwardEps] = useState(7.5);
    const trailingPe = calculatePeV01(price, trailingEps);
    const forwardPe = calculatePeV01(price, forwardEps);
    return (
        <div>
            <div className="rounded-[11px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-sm leading-6 text-[var(--v7-text-secondary)]">
                <strong className="text-[var(--v7-text)]">Illustrative exercise.</strong> Signal currently has no approved analyst-estimate history provider, so these inputs are intentionally editable examples rather than live consensus facts.
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Field label="Share price" value={price} onChange={setPrice} prefix="$" step="1" />
                <Field label="Trailing EPS" value={trailingEps} onChange={setTrailingEps} prefix="$" step="0.25" />
                <Field label="Expected forward EPS" value={forwardEps} onChange={setForwardEps} prefix="$" step="0.25" />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DefinitionCard label="Trailing P/E"><span className="font-mono text-xl font-bold text-[var(--v7-text)]">{trailingPe === null ? 'N/A' : `${formatNumber(trailingPe)}×`}</span><p className="mt-2">Uses earnings already produced.</p></DefinitionCard>
                <DefinitionCard label="Forward P/E" tone="accent"><span className="font-mono text-xl font-bold text-[var(--v7-text)]">{forwardPe === null ? 'N/A' : `${formatNumber(forwardPe)}×`}</span><p className="mt-2">Uses earnings that are expected, so estimate risk is part of the metric.</p></DefinitionCard>
            </div>
        </div>
    );
};

const GrowthLesson = () => (
    <div className="grid gap-3 sm:grid-cols-2">
        <DefinitionCard label="Growth rate" tone="accent">A +20% EPS growth rate tells you how quickly earnings changed over the measured period. It does not tell you whether the current price already assumes +30%.</DefinitionCard>
        <DefinitionCard label="Direction matters">Acceleration and deceleration can matter as much as the absolute rate. +20% after +35% is a different setup from +20% after +5%.</DefinitionCard>
        <DefinitionCard label="Base effects">A rebound from an unusually weak period can create a very large percentage increase without implying the same long-run growth rate.</DefinitionCard>
        <DefinitionCard label="Valuation connection" tone="risk">Higher growth can support a higher multiple, but only if growth is durable enough and the price paid does not already require an even stronger outcome.</DefinitionCard>
    </div>
);

const ExpectationsLesson = () => {
    const [expected, setExpected] = useState(30);
    const [actual, setActual] = useState(24);
    const result = classifyExpectationV01(actual, expected);
    return (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <div>
                <div className="rounded-[11px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-sm leading-6 text-[var(--v7-text-secondary)]">
                    <strong className="text-[var(--v7-text)]">Illustrative exercise.</strong> The percentages below are not current analyst estimates.
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Field label="Expected EPS growth" value={expected} onChange={setExpected} suffix="%" step="1" />
                    <Field label="Actual EPS growth" value={actual} onChange={setActual} suffix="%" step="1" />
                </div>
                <div className="mt-4 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4">
                    <p className="text-xs text-[var(--v7-text-muted)]">Result relative to expectation</p>
                    <p className="mt-1 text-xl font-bold capitalize text-[var(--v7-text)]">{result} expectations</p>
                    <p className="mt-2 text-sm leading-6 text-[var(--v7-text-secondary)]">The business can report objectively strong growth and still disappoint if investors were positioned for something stronger.</p>
                </div>
            </div>
            <DefinitionCard label="The question to learn" tone="accent">Do not ask only “Was the result good?” Also ask “What did the market appear to expect before the result, and what changed after it?”</DefinitionCard>
        </div>
    );
};

export const LearnConceptLabV1 = ({ moduleId, completed, onComplete }: {
    readonly moduleId: LearnModuleIdV01;
    readonly completed: boolean;
    readonly onComplete: () => void;
}) => {
    const selectedModule = useMemo(() => learnModulesV01.find((candidate) => candidate.id === moduleId) ?? learnModulesV01[0], [moduleId]);
    const lesson = moduleId === 'evidence' ? <EvidenceLesson />
        : moduleId === 'eps' ? <EpsLesson />
            : moduleId === 'pe' ? <PeLesson />
                : moduleId === 'forward-pe' ? <ForwardPeLesson />
                    : moduleId === 'growth' ? <GrowthLesson />
                        : <ExpectationsLesson />;

    return (
        <section aria-labelledby="learn-concept-title" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Module {selectedModule.eyebrow}</p>
                    <h2 id="learn-concept-title" className="mt-1 text-xl font-bold tracking-tight text-[var(--v7-text)]">{selectedModule.title}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--v7-text-secondary)]">{selectedModule.objective}</p>
                </div>
                <button
                    type="button"
                    onClick={onComplete}
                    aria-pressed={completed}
                    className={`min-h-10 shrink-0 rounded-[9px] border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--v7-accent)] ${completed ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] text-[var(--v7-text)]' : 'border-[var(--v7-border)] bg-[var(--v7-surface)] text-[var(--v7-text-secondary)] hover:border-[var(--v7-accent)]'}`}
                >
                    {completed ? 'Understood ✓' : 'Mark understood'}
                </button>
            </div>
            <dl className="grid gap-3 border-b border-[var(--v7-border)] py-5 sm:grid-cols-2 xl:grid-cols-5">
                {[
                    ['What it measures', selectedModule.measures],
                    ['Why investors use it', selectedModule.whyItMatters],
                    ['What changes it', selectedModule.changesWith],
                    ['When it misleads', selectedModule.limitation],
                    ['Connected concept', selectedModule.connectedConcept],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3">
                        <dt className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-text-muted)]">{label}</dt>
                        <dd className="mt-2 text-xs leading-5 text-[var(--v7-text-secondary)]">{value}</dd>
                    </div>
                ))}
            </dl>
            <div className="pt-5">{lesson}</div>
        </section>
    );
};
