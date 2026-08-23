'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseResearchSnapshotResponse } from '@/lib/research/snapshot-input';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import {
    calculateScenarioV03,
    investmentThesisGapsV03,
    scenarioProbabilityTotalV03,
    type InvestmentThesisDraftV03,
    type LearningJournalEntryV03,
    type LearningJournalUpdateV03,
    type ScenarioInputV03,
} from '@/lib/learn/v0-3';

const symbols = ['MSFT', 'AAPL', 'NVDA'] as const;
const journalKey = 'signal-learn-v0.3-journal';
const updateKey = 'signal-learn-v0.3-journal-updates';
type EvidenceBucket = 'supports' | 'against' | 'context' | 'unknown';
type EvidenceItem = { readonly id: string; readonly bucket: EvidenceBucket; readonly text: string };

const blankThesis = (): InvestmentThesisDraftV03 => ({ business: '', quality: '', growth: '', valuation: '', expectations: '', risks: '', catalysts: '', contraryEvidence: '', invalidation: '', confidence: 50 });
const money = (value: number | null, currency = 'USD') => value === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(value);
const number = (value: number | null, suffix = '') => value === null ? 'Unavailable' : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
const safeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const EvidenceBoard = ({ items, onAdd, onRemove }: { readonly items: readonly EvidenceItem[]; readonly onAdd: (bucket: EvidenceBucket, text: string) => void; readonly onRemove: (id: string) => void }) => {
    const [drafts, setDrafts] = useState<Record<EvidenceBucket, string>>({ supports: '', against: '', context: '', unknown: '' });
    const columns: readonly [EvidenceBucket, string, string][] = [
        ['supports', 'Supports', 'Evidence that strengthens the current thesis.'],
        ['against', 'Against', 'Evidence that weakens or contradicts it.'],
        ['context', 'Context', 'Relevant evidence that is not inherently directional.'],
        ['unknown', 'Unknown', 'Questions or missing evidence to investigate.'],
    ];
    return <div data-testid="investment-evidence-board" className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">{columns.map(([bucket, label, hint]) => <section key={bucket} className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-xs font-bold text-[var(--v7-text)]">{label}</p><p className="mt-1 text-[11px] leading-5 text-[var(--v7-text-muted)]">{hint}</p><div className="mt-3 grid gap-2">{items.filter((item) => item.bucket === bucket).map((item) => <div key={item.id} className="rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-2 text-xs leading-5 text-[var(--v7-text-secondary)]"><p>{item.text}</p><button type="button" onClick={() => onRemove(item.id)} className="mt-1 min-h-8 text-[11px] font-semibold text-[var(--v7-text-muted)] underline underline-offset-2">Remove</button></div>)}</div><label className="mt-3 grid gap-1 text-[11px] font-semibold text-[var(--v7-text-secondary)]">Add evidence<textarea aria-label={`Add ${label} evidence`} rows={2} maxLength={320} value={drafts[bucket]} onChange={(event) => setDrafts((current) => ({ ...current, [bucket]: event.target.value }))} className="rounded-[8px] border border-[var(--v7-border)] bg-transparent p-2 text-xs" /></label><button type="button" disabled={!drafts[bucket].trim()} onClick={() => { onAdd(bucket, drafts[bucket].trim()); setDrafts((current) => ({ ...current, [bucket]: '' })); }} className="mt-2 min-h-9 rounded-[8px] border border-[var(--v7-border)] px-3 text-xs font-semibold disabled:opacity-50">Add</button></section>)}</div>;
};

const ScenarioBuilder = ({ scenarios, onChange }: { readonly scenarios: readonly ScenarioInputV03[]; readonly onChange: (index: number, next: ScenarioInputV03) => void }) => {
    const total = scenarioProbabilityTotalV03(scenarios);
    return <section data-testid="scenario-builder-v3" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Scenario builder</p><h3 className="mt-1 text-base font-bold text-[var(--v7-text)]">Make the assumptions explicit.</h3><p className="mt-1 text-xs leading-5 text-[var(--v7-text-muted)]">Scenario EPS and P/E are your assumptions, not analyst consensus. Implied values are conditional estimates, not price targets.</p></div><span data-testid="scenario-probability-total" className={`shrink-0 rounded-full border px-3 py-1 font-mono text-xs font-bold ${total === 100 ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] text-[var(--v7-text)]' : 'border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] text-[var(--v7-text)]'}`}>{total}% total</span></div>{total !== 100 ? <p role="status" className="mt-3 rounded-[8px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-xs text-[var(--v7-text-secondary)]">Probabilities must sum to 100%. Signal does not silently normalize them.</p> : null}<div className="mt-4 grid gap-3 lg:grid-cols-3">{scenarios.map((scenario, index) => {
        const result = calculateScenarioV03(scenario);
        const set = (key: keyof ScenarioInputV03, value: string | number) => onChange(index, { ...scenario, [key]: value });
        return <article key={scenario.name} className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-sm font-bold text-[var(--v7-text)]">{scenario.name}</p><div className="mt-3 grid grid-cols-2 gap-2"><label className="grid gap-1 text-[11px] font-semibold">EPS assumption<input aria-label={`${scenario.name} EPS assumption`} type="number" step="0.25" value={scenario.earnings} onChange={(event) => set('earnings', Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-[11px] font-semibold">P/E assumption<input aria-label={`${scenario.name} P/E assumption`} type="number" step="1" value={scenario.multiple} onChange={(event) => set('multiple', Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><label className="grid gap-1 text-[11px] font-semibold">Probability<input aria-label={`${scenario.name} probability`} type="number" min="0" max="100" value={scenario.probability} onChange={(event) => set('probability', Number(event.target.value))} className="min-h-10 rounded border border-[var(--v7-border)] bg-transparent px-2 font-mono" /></label><div className="rounded border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] p-2"><p className="text-[10px] text-[var(--v7-text-muted)]">Implied value</p><p className="mt-1 font-mono text-sm font-bold">{result.impliedValue === null ? 'N/A' : `$${number(result.impliedValue)}`}</p></div></div><label className="mt-2 grid gap-1 text-[11px] font-semibold">What leads here?<textarea aria-label={`${scenario.name} scenario note`} rows={2} maxLength={320} value={scenario.note} onChange={(event) => set('note', event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-xs" /></label></article>;
    })}</div></section>;
};

const ThesisBuilder = ({ thesis, onChange, onSave, canSave, gaps }: { readonly thesis: InvestmentThesisDraftV03; readonly onChange: (next: InvestmentThesisDraftV03) => void; readonly onSave: () => void; readonly canSave: boolean; readonly gaps: readonly string[] }) => {
    const fields: readonly [keyof InvestmentThesisDraftV03, string, string][] = [
        ['business', 'Business', 'What does the business actually do?'], ['quality', 'Quality', 'Why might its economics persist?'], ['growth', 'Growth', 'What growth assumption matters?'], ['valuation', 'Valuation', 'What are you paying and compared with what?'], ['expectations', 'Expectations', 'What appears already expected?'], ['risks', 'Risks', 'What can break the economics?'], ['catalysts', 'Catalysts', 'What could materially change expectations?'], ['contraryEvidence', 'Contrary evidence', 'What evidence argues against your view?'], ['invalidation', 'Invalidation', 'What would make you change your mind?'],
    ];
    return <section data-testid="thesis-builder-v3" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Thesis builder</p><h3 className="mt-1 text-base font-bold text-[var(--v7-text)]">Build a view that can be wrong.</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{fields.map(([key, label, hint]) => <label key={key} className="grid gap-1 text-xs font-semibold text-[var(--v7-text)]">{label}<span className="font-normal text-[11px] text-[var(--v7-text-muted)]">{hint}</span><textarea aria-label={label} rows={3} maxLength={700} value={String(thesis[key])} onChange={(event) => onChange({ ...thesis, [key]: event.target.value })} className="rounded-[8px] border border-[var(--v7-border)] bg-transparent p-2 text-sm font-normal" /></label>)}</div><label className="mt-4 grid gap-1 text-xs font-semibold">Confidence · {thesis.confidence}%<input aria-label="Investment thesis confidence" type="range" min="0" max="100" value={thesis.confidence} onChange={(event) => onChange({ ...thesis, confidence: Number(event.target.value) })} /></label>{gaps.length > 0 ? <p role="status" className="mt-3 rounded-[8px] border border-[var(--v7-caution)] bg-[var(--v7-caution-quiet)] p-3 text-xs text-[var(--v7-text-secondary)]">Required before journal entry: {gaps.join(', ')}.</p> : null}<button type="button" disabled={!canSave} onClick={onSave} className="mt-4 min-h-11 rounded-[9px] border border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)] px-4 text-sm font-bold disabled:opacity-50">Commit practice decision</button></section>;
};

export const InvestmentApplyV3 = () => {
    const [symbol, setSymbol] = useState<(typeof symbols)[number]>('MSFT');
    const [snapshot, setSnapshot] = useState<ResearchSnapshot | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [error, setError] = useState<string | null>(null);
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [thesis, setThesis] = useState<InvestmentThesisDraftV03>(blankThesis);
    const [journal, setJournal] = useState<LearningJournalEntryV03[]>([]);
    const [updates, setUpdates] = useState<LearningJournalUpdateV03[]>([]);
    const [updateDraft, setUpdateDraft] = useState('');
    const [scenarios, setScenarios] = useState<ScenarioInputV03[]>([
        { name: 'Bear', earnings: 10, multiple: 22, probability: 25, note: '' },
        { name: 'Base', earnings: 12, multiple: 30, probability: 50, note: '' },
        { name: 'Bull', earnings: 14, multiple: 36, probability: 25, note: '' },
    ]);

    useEffect(() => {
        const controller = new AbortController();
        const load = async () => {
            setState('loading'); setError(null); setEvidence([]); setThesis(blankThesis());
            try {
                const response = await fetch(`/api/research/symbol/${symbol}?market=US`, { signal: controller.signal });
                const payload: unknown = await response.json();
                if (!response.ok) throw new Error('Current investment evidence is unavailable.');
                const next = parseResearchSnapshotResponse(payload); setSnapshot(next); setState('ready');
                const derivedEps = next.fundamentals.annualNetIncome !== null && next.fundamentals.shares !== null && next.fundamentals.shares > 0 ? next.fundamentals.annualNetIncome / next.fundamentals.shares : 10;
                const baseMultiple = next.valuation.priceEarnings && next.valuation.priceEarnings > 0 ? next.valuation.priceEarnings : 30;
                setScenarios([
                    { name: 'Bear', earnings: Math.max(0.25, derivedEps * 0.8), multiple: Math.max(1, baseMultiple * 0.75), probability: 25, note: '' },
                    { name: 'Base', earnings: Math.max(0.25, derivedEps), multiple: Math.max(1, baseMultiple), probability: 50, note: '' },
                    { name: 'Bull', earnings: Math.max(0.25, derivedEps * 1.2), multiple: Math.max(1, baseMultiple * 1.15), probability: 25, note: '' },
                ]);
            } catch (caught) { if (controller.signal.aborted) return; setError(caught instanceof Error ? caught.message : 'Current investment evidence is unavailable.'); setState('error'); }
        };
        void load(); return () => controller.abort();
    }, [symbol]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            try { const parsed: unknown = JSON.parse(window.localStorage.getItem(journalKey) ?? '[]'); if (Array.isArray(parsed)) setJournal(parsed as LearningJournalEntryV03[]); } catch { setJournal([]); }
            try { const parsed: unknown = JSON.parse(window.localStorage.getItem(updateKey) ?? '[]'); if (Array.isArray(parsed)) setUpdates(parsed as LearningJournalUpdateV03[]); } catch { setUpdates([]); }
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    const currency = snapshot?.quote.currency ?? 'USD';
    const facts = useMemo(() => snapshot ? [
        ['Price', money(snapshot.quote.price, currency)], ['P/E', number(snapshot.valuation.priceEarnings, '×')], ['Revenue growth', number(snapshot.fundamentals.revenueGrowthPercent, '%')], ['Operating margin', number(snapshot.fundamentals.operatingMarginPercent, '%')], ['FCF yield', number(snapshot.valuation.freeCashFlowYieldPercent, '%')], ['Net cash', money(snapshot.valuation.netCash, currency)],
    ] as const : [], [currency, snapshot]);
    const gaps = investmentThesisGapsV03(thesis);
    const probabilityTotal = scenarioProbabilityTotalV03(scenarios);
    const canSave = gaps.length === 0 && probabilityTotal === 100;
    const save = () => {
        if (!canSave) return;
        const entry: LearningJournalEntryV03 = { id: safeId('decision'), symbol, createdAt: new Date().toISOString(), thesis: { ...thesis }, scenarios: scenarios.map(calculateScenarioV03) };
        const next = [...journal, entry]; setJournal(next); window.localStorage.setItem(journalKey, JSON.stringify(next));
    };
    const appendUpdate = (entryId: string) => {
        if (!updateDraft.trim()) return;
        const update: LearningJournalUpdateV03 = { id: safeId('update'), entryId, createdAt: new Date().toISOString(), note: updateDraft.trim() };
        const next = [...updates, update]; setUpdates(next); window.localStorage.setItem(updateKey, JSON.stringify(next)); setUpdateDraft('');
    };

    return <div data-testid="investment-apply-v3" className="grid gap-4"><section className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5"><div className="flex flex-col gap-4 border-b border-[var(--v7-border)] pb-4 md:flex-row md:items-end md:justify-between"><div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--v7-accent)]">Apply Today · v0.3</p><h2 className="mt-1 text-xl font-bold">Build an investment view from evidence.</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--v7-text-secondary)]">Current facts come from the existing Research snapshot. Scenario assumptions and thesis text are yours; Signal keeps those separate from reported facts.</p></div><div className="flex gap-2">{symbols.map((candidate) => <button key={candidate} type="button" aria-pressed={symbol === candidate} onClick={() => setSymbol(candidate)} className={`min-h-10 rounded border px-3 text-xs font-bold ${symbol === candidate ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{candidate}</button>)}</div></div>{state === 'loading' ? <p role="status" className="mt-4 rounded border border-[var(--v7-border)] p-4 text-sm">Loading current evidence…</p> : null}{state === 'error' ? <p role="alert" className="mt-4 rounded border border-[var(--v7-risk)] bg-[var(--v7-risk-quiet)] p-4 text-sm">{error}</p> : null}{state === 'ready' && snapshot ? <><div className="mt-4 flex flex-col gap-2 rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-[var(--v7-text)]">{snapshot.quote.name ?? symbol}</p><p className="mt-1 text-xs text-[var(--v7-text-muted)]">{symbol} · facts fetched {new Date(snapshot.fetchedAt).toLocaleString()} · period {snapshot.fundamentals.reportingPeriod ?? 'unavailable'}</p></div><p className="text-xs text-[var(--v7-text-muted)]">{snapshot.sources.join(' · ') || 'No source labels returned'}</p></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{facts.map(([label, value]) => <div key={label} className="rounded-[9px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-3"><p className="text-[10px] uppercase tracking-[0.08em] text-[var(--v7-text-muted)]">Fact · {label}</p><p className="mt-1 font-mono text-sm font-bold">{value}</p></div>)}</div></> : null}</section>
        <section className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Evidence board</p><h3 className="mt-1 text-base font-bold">Classify the evidence before writing the thesis.</h3></div><div className="mt-4"><EvidenceBoard items={evidence} onAdd={(bucket, text) => setEvidence((current) => [...current, { id: safeId('evidence'), bucket, text }])} onRemove={(id) => setEvidence((current) => current.filter((item) => item.id !== id))} /></div></section>
        <ScenarioBuilder scenarios={scenarios} onChange={(index, next) => setScenarios((current) => current.map((scenario, candidateIndex) => candidateIndex === index ? next : scenario))} />
        <ThesisBuilder thesis={thesis} onChange={setThesis} onSave={save} canSave={canSave} gaps={gaps} />
        <section data-testid="learning-journal-v3" className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-4 sm:p-5"><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--v7-accent)]">Practice journal</p><h3 className="mt-1 text-base font-bold">Original entries are immutable.</h3><p className="mt-1 text-xs leading-5 text-[var(--v7-text-muted)]">This browser-local learning journal does not modify your main Research record.</p>{journal.length === 0 ? <p className="mt-4 rounded border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4 text-sm text-[var(--v7-text-secondary)]">No committed practice decisions yet.</p> : <div className="mt-4 grid gap-3">{journal.slice().reverse().map((entry) => <article key={entry.id} className="rounded-[11px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{entry.symbol} · committed thesis</p><time className="text-xs text-[var(--v7-text-muted)]">{new Date(entry.createdAt).toLocaleString()}</time></div><p className="mt-2 text-xs leading-5 text-[var(--v7-text-secondary)]"><strong>Valuation:</strong> {entry.thesis.valuation}</p><p className="mt-1 text-xs leading-5 text-[var(--v7-text-secondary)]"><strong>Contrary evidence:</strong> {entry.thesis.contraryEvidence}</p><p className="mt-1 text-xs leading-5 text-[var(--v7-text-secondary)]"><strong>Invalidation:</strong> {entry.thesis.invalidation}</p><p className="mt-1 font-mono text-xs">Confidence {entry.thesis.confidence}%</p>{updates.filter((update) => update.entryId === entry.id).map((update) => <p key={update.id} className="mt-2 border-l-2 border-[var(--v7-border-strong)] pl-3 text-xs leading-5 text-[var(--v7-text-secondary)]">Update {new Date(update.createdAt).toLocaleString()}: {update.note}</p>)}<label className="mt-3 grid gap-1 text-[11px] font-semibold">Append reflection<textarea aria-label={`Append reflection for ${entry.symbol}`} rows={2} value={updateDraft} onChange={(event) => setUpdateDraft(event.target.value)} className="rounded border border-[var(--v7-border)] bg-transparent p-2 text-xs" /></label><button type="button" disabled={!updateDraft.trim()} onClick={() => appendUpdate(entry.id)} className="mt-2 min-h-9 rounded border border-[var(--v7-border)] px-3 text-xs font-semibold disabled:opacity-50">Append update</button></article>)}</div>}</section>
    </div>;
};
