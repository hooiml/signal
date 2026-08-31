'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    appendJournalUpdateV03,
    calculateScenarioV03,
    calculateWeightedScenarioValueV03,
    isThesisCommitmentV03,
    parseDecisionJournalEntryV03,
    scenarioProbabilityTotalV03,
    type DecisionJournalEntryV03,
    type EvidenceItemV03,
    type EvidenceKindV03,
    type ScenarioV03,
    type ThesisCommitmentV03,
} from '@/lib/learn/v0-3';

export type InvestmentResearchViewV3 = 'research' | 'scenarios' | 'journal';
type Props = { readonly view: InvestmentResearchViewV3; readonly onComplete: (id: string) => void };

const sections = ['Overview', 'Business', 'Financials', 'Valuation', 'Expectations', 'Macro', 'Narrative / Events', 'Evidence Board', 'Scenarios', 'Thesis', 'Journal'] as const;
type Section = (typeof sections)[number];

const emptyThesis: ThesisCommitmentV03 = { business: '', quality: '', growth: '', valuation: '', expectations: '', risks: '', catalysts: '', contraryEvidence: '', invalidation: '', confidence: 50, horizon: '3-5 years' };
const starterScenarios: readonly ScenarioV03[] = [
    { id: 'bear', name: 'Bear', revenueGrowth: 4, margin: 16, earningsPower: 3.8, multipleLow: 14, multipleHigh: 17, probability: 25, trigger: 'Growth and estimates weaken', risk: 'Margin reset', provenance: 'Learner assumption - stress case' },
    { id: 'base', name: 'Base', revenueGrowth: 10, margin: 20, earningsPower: 5.2, multipleLow: 20, multipleHigh: 24, probability: 50, trigger: 'Execution stays near plan', risk: 'Expectations remain demanding', provenance: 'Learner assumption - central case' },
    { id: 'bull', name: 'Bull', revenueGrowth: 17, margin: 24, earningsPower: 6.6, multipleLow: 26, multipleHigh: 31, probability: 25, trigger: 'Growth reaccelerates', risk: 'Multiple fails to hold', provenance: 'Learner assumption - upside case' },
];
const fieldClass = 'min-h-10 w-full rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] px-3 text-sm text-[var(--v7-text)]';
const labelClass = 'grid gap-1.5 text-xs font-semibold text-[var(--v7-text-secondary)]';
const journalKey = 'signal-learn-v0.3-decision-journal';

const EvidenceBoard = ({ evidence, setEvidence }: { evidence: readonly EvidenceItemV03[]; setEvidence: React.Dispatch<React.SetStateAction<readonly EvidenceItemV03[]>> }) => {
    const [kind, setKind] = useState<EvidenceKindV03>('supports');
    const [text, setText] = useState('');
    const [source, setSource] = useState('');
    const add = () => {
        if (text.trim().length < 8 || source.trim().length < 3) return;
        setEvidence((current) => [...current, { id: `evidence-${Date.now()}`, kind, text: text.trim(), source: source.trim() }].slice(-20));
        setText(''); setSource('');
    };
    return <div data-testid="evidence-board"><p className="text-xs leading-5 text-[var(--v7-text-muted)]">Evidence remains separate from interpretation and can be referenced by a committed thesis without rewriting it later.</p><div className="mt-4 grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_auto]"><label className={labelClass}>Relationship<select aria-label="Evidence relationship" className={fieldClass} value={kind} onChange={(event) => setKind(event.target.value as EvidenceKindV03)}><option value="supports">Supports</option><option value="against">Against</option><option value="context">Context</option><option value="unknown">Unknown</option></select></label><label className={labelClass}>Observation<input aria-label="Evidence observation" className={fieldClass} value={text} onChange={(event) => setText(event.target.value)} /></label><label className={labelClass}>Source / date<input aria-label="Evidence source" className={fieldClass} value={source} onChange={(event) => setSource(event.target.value)} /></label><button type="button" onClick={add} className="min-h-10 self-end rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white">Add</button></div>
        <div className="mt-4 grid gap-2">{evidence.length === 0 ? <p className="rounded-[6px] border border-dashed border-[var(--v7-border)] p-4 text-sm text-[var(--v7-text-muted)]">No linked evidence yet.</p> : evidence.map((item) => <article key={item.id} className="grid gap-2 rounded-[6px] border border-[var(--v7-border)] p-3 sm:grid-cols-[90px_minmax(0,1fr)_auto]"><span className="text-[10px] font-bold uppercase text-[var(--v7-accent)]">{item.kind}</span><div><p className="text-sm text-[var(--v7-text)]">{item.text}</p><p className="mt-1 text-xs text-[var(--v7-text-muted)]">{item.source}</p></div><button type="button" aria-label={`Remove evidence ${item.text}`} onClick={() => setEvidence((current) => current.filter((candidate) => candidate.id !== item.id))} className="min-h-10 px-2 text-xs font-semibold text-[var(--v7-text-secondary)]">Remove</button></article>)}</div>
    </div>;
};

const ThesisBuilder = ({ thesis, setThesis, evidence, onCommit }: { thesis: ThesisCommitmentV03; setThesis: React.Dispatch<React.SetStateAction<ThesisCommitmentV03>>; evidence: readonly EvidenceItemV03[]; onCommit: () => void }) => {
    const textFields: readonly [keyof ThesisCommitmentV03, string][] = [['business', 'Business'], ['quality', 'Quality'], ['growth', 'Growth'], ['valuation', 'Valuation'], ['expectations', 'Expectations'], ['risks', 'Risks'], ['catalysts', 'Catalysts'], ['contraryEvidence', 'Contrary evidence'], ['invalidation', 'Invalidation']];
    return <div data-testid="thesis-builder"><div className="grid gap-4 md:grid-cols-2">{textFields.map(([key, label]) => <label key={key} className={labelClass}>{label}<textarea aria-label={`Thesis ${label}`} className="min-h-24 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm" value={String(thesis[key])} onChange={(event) => setThesis((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className={labelClass}>Expected horizon<input aria-label="Thesis horizon" className={fieldClass} value={thesis.horizon} onChange={(event) => setThesis((current) => ({ ...current, horizon: event.target.value }))} /></label><label className={labelClass}>Confidence: {thesis.confidence}%<input aria-label="Thesis confidence" type="range" min="0" max="100" value={thesis.confidence} onChange={(event) => setThesis((current) => ({ ...current, confidence: Number(event.target.value) }))} /></label></div><p className="mt-4 text-xs text-[var(--v7-text-muted)]">Linked evidence: {evidence.length}. Committing freezes this version and its current evidence references.</p><button type="button" disabled={!isThesisCommitmentV03(thesis)} onClick={onCommit} className="mt-3 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white disabled:opacity-40">Commit thesis to journal</button></div>;
};

const ScenarioBuilder = ({ scenarios, setScenarios, onComplete }: { scenarios: readonly ScenarioV03[]; setScenarios: React.Dispatch<React.SetStateAction<readonly ScenarioV03[]>>; onComplete: () => void }) => {
    const [weightedEnabled, setWeightedEnabled] = useState(false);
    const total = scenarioProbabilityTotalV03(scenarios);
    const weighted = weightedEnabled ? calculateWeightedScenarioValueV03(scenarios) : null;
    const update = (id: ScenarioV03['id'], key: keyof ScenarioV03, value: string) => setScenarios((current) => current.map((scenario) => scenario.id === id ? { ...scenario, [key]: ['name', 'trigger', 'risk', 'provenance'].includes(key) ? value : Number(value) } : scenario));
    return <section data-testid="scenario-builder"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Scenario Builder</p><h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Ranges make assumptions inspectable.</h2></div><label className="flex min-h-10 items-center gap-2 text-xs font-semibold"><input aria-label="Enable weighted expected value" type="checkbox" checked={weightedEnabled} onChange={(event) => setWeightedEnabled(event.target.checked)} />Show weighted value</label></div>
        <div className="mt-5 grid gap-4 xl:grid-cols-3">{scenarios.map((scenario) => { const output = calculateScenarioV03(scenario); return <article key={scenario.id} className="rounded-[8px] border border-[var(--v7-border)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-[var(--v7-text)]">{scenario.name}</h3><span className="font-mono text-sm font-bold">{output ? `$${output.impliedLow.toFixed(0)}-$${output.impliedHigh.toFixed(0)}` : 'Invalid'}</span></div><p className="mt-1 text-[10px] uppercase text-[var(--v7-text-muted)]">Assumption-dependent estimate</p><div className="mt-4 grid grid-cols-2 gap-3">{([['revenueGrowth', 'Revenue growth %'], ['margin', 'Margin %'], ['earningsPower', 'EPS / FCF'], ['multipleLow', 'Multiple low'], ['multipleHigh', 'Multiple high'], ['probability', 'Probability %']] as const).map(([key, label]) => <label key={key} className={labelClass}>{label}<input aria-label={`${scenario.name} ${label}`} type="number" className={fieldClass} value={scenario[key]} onChange={(event) => update(scenario.id, key, event.target.value)} /></label>)}</div><label className={`${labelClass} mt-3`}>Key trigger<input aria-label={`${scenario.name} trigger`} className={fieldClass} value={scenario.trigger} onChange={(event) => update(scenario.id, 'trigger', event.target.value)} /></label><label className={`${labelClass} mt-3`}>Key risk<input aria-label={`${scenario.name} risk`} className={fieldClass} value={scenario.risk} onChange={(event) => update(scenario.id, 'risk', event.target.value)} /></label><p className="mt-3 text-[10px] text-[var(--v7-text-muted)]">{scenario.provenance}</p></article>; })}</div>
        <div className={`mt-4 rounded-[8px] border p-4 ${total === 100 ? 'border-[var(--v7-border)]' : 'border-amber-500/60 bg-amber-500/10'}`}><p className="text-sm font-bold text-[var(--v7-text)]">Probability total: <span data-testid="scenario-probability-total">{total}%</span></p>{total !== 100 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Probabilities are not normalized automatically. Correct the assumptions to total 100%.</p>}{weightedEnabled && <p data-testid="scenario-weighted-value" className="mt-2 text-sm">Weighted midpoint: <strong>{weighted === null ? 'Unavailable until probabilities total 100%' : `$${weighted.toFixed(2)}`}</strong></p>}</div>
        <button type="button" disabled={total !== 100 || scenarios.some((scenario) => calculateScenarioV03(scenario) === null)} onClick={onComplete} className="mt-4 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white disabled:opacity-40">Save scenario set</button>
    </section>;
};

const Journal = ({ entry, setEntry, updateText, setUpdateText, onComplete }: { entry: DecisionJournalEntryV03 | null; setEntry: React.Dispatch<React.SetStateAction<DecisionJournalEntryV03 | null>>; updateText: string; setUpdateText: (value: string) => void; onComplete: () => void }) => {
    const [reason, setReason] = useState(''); const [confidence, setConfidence] = useState(50);
    if (!entry) return <section data-testid="journal-empty" className="rounded-[8px] border border-dashed border-[var(--v7-border)] p-6"><h2 className="text-xl font-bold text-[var(--v7-text)]">No committed thesis yet.</h2><p className="mt-2 text-sm text-[var(--v7-text-secondary)]">Complete the Thesis section and commit it. Drafts are editable; originals are immutable after commitment.</p></section>;
    const append = () => { if (reason.trim().length < 8 || updateText.trim().length < 8) return; setEntry((current) => current ? appendJournalUpdateV03(current, { id: `update-${Date.now()}`, createdAt: new Date().toISOString(), reason: reason.trim(), currentThesis: updateText.trim(), confidence, newEvidenceRefs: [] }) : current); setReason(''); setUpdateText(''); onComplete(); };
    return <section data-testid="decision-journal"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Decision Journal</p><h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Original commitment</h2><div data-testid="journal-original" className="mt-4 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-surface-quiet)] p-4"><p className="text-xs text-[var(--v7-text-muted)]">Committed {new Date(entry.createdAt).toLocaleString()} · Confidence {entry.original.confidence}% · {entry.original.horizon}</p><p className="mt-3 text-sm leading-6"><strong>Business:</strong> {entry.original.business}</p><p className="mt-2 text-sm leading-6"><strong>Valuation:</strong> {entry.original.valuation}</p><p className="mt-2 text-sm leading-6"><strong>Contrary evidence:</strong> {entry.original.contraryEvidence}</p><p className="mt-2 text-sm leading-6"><strong>Invalidation:</strong> {entry.original.invalidation}</p></div>
        <h3 className="mt-5 text-base font-bold text-[var(--v7-text)]">Append update</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={labelClass}>Reason for change<input aria-label="Journal update reason" className={fieldClass} value={reason} onChange={(event) => setReason(event.target.value)} /></label><label className={labelClass}>Current confidence: {confidence}%<input aria-label="Journal update confidence" type="range" min="0" max="100" value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} /></label></div><label className={`${labelClass} mt-3`}>Current thesis<textarea aria-label="Journal current thesis" className="min-h-24 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm" value={updateText} onChange={(event) => setUpdateText(event.target.value)} /></label><button type="button" onClick={append} className="mt-3 min-h-10 rounded-[6px] bg-[var(--v7-accent)] px-4 text-sm font-bold text-white">Append update</button>
        <div className="mt-5 grid gap-3">{entry.updates.map((update, index) => <article key={update.id} className="border-l-2 border-[var(--v7-accent)] pl-4"><p className="text-[10px] uppercase text-[var(--v7-text-muted)]">Update {index + 1} · confidence {update.confidence}%</p><p className="mt-1 text-sm font-semibold">{update.reason}</p><p className="mt-1 text-sm text-[var(--v7-text-secondary)]">{update.currentThesis}</p></article>)}</div>
    </section>;
};

export const LearnInvestmentResearchV3 = ({ view, onComplete }: Props) => {
    const [section, setSection] = useState<Section>('Overview');
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [evidence, setEvidence] = useState<readonly EvidenceItemV03[]>([]);
    const [thesis, setThesis] = useState<ThesisCommitmentV03>(emptyThesis);
    const [scenarios, setScenarios] = useState<readonly ScenarioV03[]>(starterScenarios);
    const [journal, setJournal] = useState<DecisionJournalEntryV03 | null>(null);
    const [journalReady, setJournalReady] = useState(false);
    const [updateText, setUpdateText] = useState('');
    useEffect(() => { const timer = window.setTimeout(() => { try { const raw = window.localStorage.getItem(journalKey); setJournal(parseDecisionJournalEntryV03(raw ? JSON.parse(raw) : null)); } catch { setJournal(null); } setJournalReady(true); }, 0); return () => window.clearTimeout(timer); }, []);
    useEffect(() => { if (!journalReady) return; if (journal) window.localStorage.setItem(journalKey, JSON.stringify(journal)); else window.localStorage.removeItem(journalKey); }, [journal, journalReady]);
    const commit = () => { if (!isThesisCommitmentV03(thesis)) return; setJournal({ id: `journal-${Date.now()}`, createdAt: new Date().toISOString(), original: { ...thesis }, evidenceRefs: evidence.map((item) => item.id), scenarioRefs: scenarios.map((item) => item.id), updates: [] }); onComplete('thesis'); setSection('Journal'); };
    const challenge = useMemo(() => {
        if (!thesis.contraryEvidence.trim()) return 'Challenge: contrary evidence is missing. Which existing observation could weaken the view?';
        if (!thesis.invalidation.trim()) return 'Challenge: no invalidation condition is defined.';
        if (thesis.confidence > 80 && evidence.filter((item) => item.kind === 'against').length === 0) return 'Challenge: high confidence has no linked Against evidence. What would falsify the view?';
        return 'Challenge: separate each observed fact from the conclusion it is being used to support.';
    }, [evidence, thesis]);

    if (view === 'scenarios') return <ScenarioBuilder scenarios={scenarios} setScenarios={setScenarios} onComplete={() => onComplete('scenarios')} />;
    if (view === 'journal') return <Journal entry={journal} setEntry={setJournal} updateText={updateText} setUpdateText={setUpdateText} onComplete={() => onComplete('journal')} />;

    const renderSection = () => {
        if (section === 'Evidence Board') return <EvidenceBoard evidence={evidence} setEvidence={setEvidence} />;
        if (section === 'Scenarios') return <ScenarioBuilder scenarios={scenarios} setScenarios={setScenarios} onComplete={() => onComplete('scenarios')} />;
        if (section === 'Thesis') return <><ThesisBuilder thesis={thesis} setThesis={setThesis} evidence={evidence} onCommit={commit} /><div data-testid="reasoning-challenge" className="mt-4 rounded-[8px] border border-[var(--v7-border)] bg-[var(--v7-accent-quiet)] p-4 text-xs leading-5"><strong>Reasoning challenger</strong><p className="mt-1">{challenge}</p><p className="mt-2 text-[var(--v7-text-muted)]">This deterministic prompt uses only your entries. It does not recommend, forecast, or mutate the thesis.</p></div></>;
        if (section === 'Journal') return <Journal entry={journal} setEntry={setJournal} updateText={updateText} setUpdateText={setUpdateText} onComplete={() => onComplete('journal')} />;
        if (section === 'Overview') return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Business', 'Economic engine and durability'], ['Valuation', 'Price, denominator, and expectations'], ['Macro', 'Facts, changes, interpretation, uncertainty'], ['Decision', 'Scenarios, invalidation, and updates']].map(([title, text]) => <div key={title} className="rounded-[6px] border border-[var(--v7-border)] p-4"><p className="font-bold text-[var(--v7-text)]">{title}</p><p className="mt-2 text-xs leading-5 text-[var(--v7-text-muted)]">{text}</p></div>)}</div>;
        return <label className={labelClass}>{section} evidence and interpretation<textarea aria-label={`${section} workspace notes`} className="min-h-48 rounded-[6px] border border-[var(--v7-border)] bg-[var(--v7-surface)] p-3 text-sm" placeholder={`Record ${section.toLowerCase()} facts, sources, assumptions, and uncertainties.`} value={notes[section] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [section]: event.target.value }))} /></label>;
    };
    return <section data-testid="research-workspace"><p className="text-[11px] font-bold uppercase text-[var(--v7-accent)]">Unified Research Workspace</p><h2 className="mt-2 text-xl font-bold text-[var(--v7-text)]">Keep evidence connected without turning it into a rating.</h2><nav aria-label="Investment research sections" className="research-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">{sections.map((item) => <button key={item} type="button" aria-pressed={section === item} onClick={() => setSection(item)} className={`min-h-10 shrink-0 rounded-[6px] border px-3 text-xs font-semibold ${section === item ? 'border-[var(--v7-accent)] bg-[var(--v7-accent-quiet)]' : 'border-[var(--v7-border)]'}`}>{item}</button>)}</nav><div className="mt-5 border-y border-[var(--v7-border)] py-5">{renderSection()}</div></section>;
};
