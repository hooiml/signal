'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    buildResearchDocumentCitationDiff,
    researchDocumentContentDigest,
} from '@/lib/research/document-evidence';
import { enqueueResearchWorkflowTaskClient } from '@/lib/research/workflow-queue-client';
import {
    researchDocumentSourceKinds,
    type ResearchDocumentCitation,
    type ResearchDocumentSourceKind,
    type ResearchRecord,
    type ResearchUpdateMode,
} from '@/lib/types/research';
import type { SecDiscoveryFiling } from '@/lib/research/sec-filings';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type CitationDraft = Omit<ResearchDocumentCitation, 'contentDigest'>;
type DiscoveryState =
    | { readonly status: 'idle' | 'loading' }
    | { readonly status: 'ready'; readonly filings: readonly SecDiscoveryFiling[] }
    | { readonly status: 'degraded'; readonly message: string };

const emptyDraft = (record: ResearchRecord): CitationDraft => ({
    id: crypto.randomUUID(),
    market: record.market,
    symbol: record.symbol,
    sourceKind: record.market === 'US' ? 'other-primary' : 'exchange-announcement',
    publicationDate: new Date().toISOString().slice(0, 10),
    reportingPeriod: null,
    title: '',
    sourceUrl: '',
    providerLabel: record.market === 'US' ? 'Issuer' : 'Bursa Malaysia / issuer',
    location: '',
    excerpt: '',
    capturedAt: new Date().toISOString(),
    captureMethod: 'manual-unverified',
});

const parseDiscovery = (value: unknown): readonly SecDiscoveryFiling[] => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid SEC discovery response.');
    const body = Object.fromEntries(Object.entries(value));
    if (!Array.isArray(body.filings)) throw new Error('Invalid SEC discovery response.');
    return body.filings as readonly SecDiscoveryFiling[];
};

export const PrimaryDocumentEvidenceV6 = ({ record, theme, saving, saveError, onSave }: {
    readonly record: ResearchRecord;
    readonly theme: ResearchThemeV6;
    readonly saving: boolean;
    readonly saveError: string | null;
    readonly onSave: (record: ResearchRecord, mode?: ResearchUpdateMode) => Promise<boolean>;
}) => {
    const styles = getThemeV6(theme);
    const [citations, setCitations] = useState<readonly ResearchDocumentCitation[]>(record.documentEvidence.citations);
    const [draft, setDraft] = useState<CitationDraft>(() => emptyDraft(record));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [discovery, setDiscovery] = useState<DiscoveryState>({ status: 'idle' });
    const [status, setStatus] = useState<string | null>(null);
    const field = 'mt-1 min-h-10 w-full rounded border px-3 py-2 text-sm ' + styles.panelSolid + ' ' + styles.textPrimary;
    const dirty = JSON.stringify(citations) !== JSON.stringify(record.documentEvidence.citations);
    const citationDiff = useMemo(
        () => buildResearchDocumentCitationDiff(citations, record.reviewHistory),
        [citations, record.reviewHistory],
    );

    useEffect(() => {
        setCitations(record.documentEvidence.citations);
    }, [record.documentEvidence.citations]);

    const discover = async () => {
        setDiscovery({ status: 'loading' });
        try {
            const response = await fetch(`/api/research/filings/${encodeURIComponent(record.symbol)}`);
            const payload: unknown = await response.json();
            if (!response.ok) {
                const message = typeof payload === 'object' && payload !== null && !Array.isArray(payload)
                    && typeof Object.fromEntries(Object.entries(payload)).error === 'string'
                    ? String(Object.fromEntries(Object.entries(payload)).error)
                    : 'Official SEC discovery is temporarily unavailable.';
                setDiscovery({ status: 'degraded', message });
                return;
            }
            const body = Object.fromEntries(Object.entries(payload as object));
            setDiscovery({ status: 'ready', filings: parseDiscovery(body.data) });
        } catch {
            setDiscovery({ status: 'degraded', message: 'Official SEC discovery is temporarily unavailable. Manual capture remains available.' });
        }
    };

    const captureFiling = (filing: SecDiscoveryFiling) => {
        setDraft({
            id: `${filing.accessionNumber}:${crypto.randomUUID()}`,
            market: 'US',
            symbol: record.symbol,
            sourceKind: filing.sourceKind,
            publicationDate: filing.filingDate,
            reportingPeriod: filing.reportingPeriod,
            title: filing.title,
            sourceUrl: filing.sourceUrl,
            providerLabel: filing.providerLabel,
            location: '',
            excerpt: '',
            capturedAt: new Date().toISOString(),
            captureMethod: 'sec-official',
        });
        setEditingId(null);
        setStatus('SEC metadata staged. Select a bounded exact excerpt and location, then add it to the unsaved citation draft.');
    };

    const stageCitation = () => {
        try {
            const candidate: ResearchDocumentCitation = {
                ...draft,
                contentDigest: researchDocumentContentDigest(draft),
            };
            const next = [...citations.filter((citation) => citation.id !== candidate.id), candidate];
            if (next.length > 25) throw new Error('A research record can retain at most 25 document citations.');
            setCitations(next);
            setEditingId(null);
            setDraft(emptyDraft(record));
            setStatus('Citation staged. Save citations to persist it; thesis, checklist, and decision remain unchanged.');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Unable to stage citation.');
        }
    };

    const save = async () => {
        const saved = await onSave({
            ...record,
            documentEvidence: { version: 1, migrationState: 'current', citations },
        }, 'evidence');
        setStatus(saved
            ? 'Document citations saved with optimistic revision protection. No review or thesis field was changed.'
            : 'Document citations were not saved. Reload after resolving the conflict, then try again.');
    };

    return <section data-testid="primary-document-evidence" className={'rounded border p-3 sm:p-4 ' + styles.panelUtility} aria-labelledby="primary-document-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Primary-document evidence</p>
                <h2 id="primary-document-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Exact excerpts with durable citations</h2>
                <p className={'mt-2 text-xs leading-5 ' + styles.textSecondary}>Signal stores only the excerpt you select, never the full filing. Excerpts render as text and are compared by stable citation ID and content fingerprint; a changed excerpt means captured evidence changed, not that management intent changed.</p>
            </div>
            <span className={'rounded border px-2 py-1 text-xs ' + styles.row}>{citations.length}/25 saved or staged</span>
        </div>

        {record.documentEvidence.migrationState !== 'current' ? <p role="status" className={'mt-3 rounded border p-3 text-xs ' + (record.documentEvidence.migrationState === 'invalid-recovered' ? styles.risk : styles.textMuted)}>
            {record.documentEvidence.migrationState === 'invalid-recovered'
                ? 'Malformed persisted document citations were recovered as an empty list. Add valid citations and save to repair this record.'
                : 'This older record was migrated to an empty version-1 document citation list.'}
        </p> : null}

        {record.market === 'US' ? <div className={'mt-4 rounded border p-3 ' + styles.panelSolid}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className={'text-sm font-bold ' + styles.textPrimary}>Recent official SEC filings</h3><p className={'mt-1 text-xs ' + styles.textMuted}>Metadata only from fixed sec.gov origins. Signal does not proxy or download filing documents.</p></div>
                <button type="button" disabled={discovery.status === 'loading'} onClick={() => void discover()} className={'min-h-10 rounded border px-3 text-xs font-semibold disabled:opacity-50 ' + styles.row}>{discovery.status === 'loading' ? 'Loading…' : 'Load SEC filings'}</button>
            </div>
            {discovery.status === 'degraded' ? <p role="alert" className={'mt-3 text-xs leading-5 ' + styles.risk}>{discovery.message}</p> : null}
            {discovery.status === 'ready' && discovery.filings.length === 0 ? <p role="status" className={'mt-3 text-xs ' + styles.textMuted}>No supported recent 10-K, 10-Q, 8-K, 20-F, or 6-K filing was returned.</p> : null}
            {discovery.status === 'ready' && discovery.filings.length > 0 ? <ul className={'mt-3 divide-y ' + styles.divider}>{discovery.filings.map((filing) => <li key={filing.accessionNumber} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className={'text-xs font-bold ' + styles.textPrimary}>{filing.form} · {filing.filingDate}</p><a href={filing.sourceUrl} target="_blank" rel="noreferrer" className={'mt-1 block break-all text-xs underline ' + styles.textSecondary}>{filing.title}</a></div>
                <button type="button" onClick={() => captureFiling(filing)} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">Capture</button>
            </li>)}</ul> : null}
        </div> : <div className={'mt-4 rounded border p-3 ' + styles.panelSolid}>
            <h3 className={'text-sm font-bold ' + styles.textPrimary}>Malaysia primary-source capture</h3>
            <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Historical Bursa coverage is not automated here. Open the HTTPS Bursa announcement or issuer investor-relations source yourself, verify the issuer and publication date, then capture a bounded excerpt below. Signal labels this manual/unverified retrieval and never fetches the supplied URL.</p>
        </div>}

        <fieldset className={'mt-4 grid gap-3 rounded border p-3 sm:grid-cols-2 ' + styles.panelSolid}>
            <legend className={'px-1 text-sm font-bold ' + styles.textPrimary}>{editingId ? 'Edit staged citation' : 'Capture citation'}</legend>
            <label className={'text-xs font-semibold ' + styles.textMuted}>Source kind
                <select value={draft.sourceKind} onChange={(event) => setDraft((current) => ({ ...current, sourceKind: event.target.value as ResearchDocumentSourceKind }))} className={field}>{researchDocumentSourceKinds.map((kind) => <option key={kind}>{kind}</option>)}</select>
            </label>
            <label className={'text-xs font-semibold ' + styles.textMuted}>Publication date<input type="date" value={draft.publicationDate} onChange={(event) => setDraft((current) => ({ ...current, publicationDate: event.target.value }))} className={field} /></label>
            <label className={'text-xs font-semibold sm:col-span-2 ' + styles.textMuted}>Title<input maxLength={200} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className={field} /></label>
            <label className={'text-xs font-semibold sm:col-span-2 ' + styles.textMuted}>Canonical HTTPS source URL<input type="url" maxLength={1000} value={draft.sourceUrl} onChange={(event) => setDraft((current) => ({ ...current, sourceUrl: event.target.value }))} className={field} /></label>
            <label className={'text-xs font-semibold ' + styles.textMuted}>Provider / issuer label<input maxLength={80} value={draft.providerLabel} onChange={(event) => setDraft((current) => ({ ...current, providerLabel: event.target.value }))} className={field} /></label>
            <label className={'text-xs font-semibold ' + styles.textMuted}>Reporting period (optional)<input maxLength={40} value={draft.reportingPeriod ?? ''} onChange={(event) => setDraft((current) => ({ ...current, reportingPeriod: event.target.value || null }))} className={field} /></label>
            <label className={'text-xs font-semibold sm:col-span-2 ' + styles.textMuted}>Section, page, or location<input maxLength={120} value={draft.location} onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))} className={field} /></label>
            <label className={'text-xs font-semibold sm:col-span-2 ' + styles.textMuted}>Exact verbatim excerpt
                <textarea rows={5} maxLength={2000} value={draft.excerpt} onChange={(event) => setDraft((current) => ({ ...current, excerpt: event.target.value }))} className={field} />
                <span className="mt-1 block text-right text-[11px]">{draft.excerpt.length}/2000</span>
            </label>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                {editingId ? <button type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft(record)); }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Cancel edit</button> : null}
                <button type="button" onClick={stageCitation} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950">{editingId ? 'Update staged citation' : 'Add to draft'}</button>
            </div>
        </fieldset>

        {citations.length > 0 ? <ul className={'mt-4 divide-y border-y ' + styles.divider}>{citations.map((citation) => <li key={citation.id} className="py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className={'text-sm font-bold ' + styles.textPrimary}>{citation.title}</p>
                    <p className={'mt-1 text-xs ' + styles.textMuted}>{citation.sourceKind} · {citation.publicationDate}{citation.reportingPeriod ? ` · ${citation.reportingPeriod}` : ''} · {citation.location} · {citation.captureMethod === 'sec-official' ? 'Official SEC metadata' : 'Manual / retrieval unverified'}</p>
                    <blockquote className={'mt-2 whitespace-pre-wrap break-words border-l-2 pl-3 text-sm leading-6 ' + styles.textSecondary}>{citation.excerpt}</blockquote>
                    <a href={citation.sourceUrl} target="_blank" rel="noreferrer" className={'mt-2 inline-flex min-h-10 items-center break-all text-xs underline ' + styles.textSecondary}>{citation.providerLabel} source</a>
                    <p className={'text-[11px] ' + styles.textMuted}>Content fingerprint: {citation.contentDigest}</p>
                </div>
                <div className="flex gap-2">
                    <button type="button" onClick={() => { setEditingId(citation.id); setDraft({ ...citation }); }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Edit</button>
                    <button type="button" onClick={() => {
                        if (!window.confirm(`Remove the captured excerpt “${citation.title}” from the unsaved draft?`)) return;
                        setCitations((current) => current.filter((item) => item.id !== citation.id));
                        setStatus('Citation removal staged. Save citations to persist it.');
                    }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.risk}>Remove</button>
                </div>
            </div>
        </li>)}</ul> : <p className={'mt-4 rounded border p-6 text-center text-sm ' + styles.textMuted}>No primary-document excerpts captured for this ticker.</p>}

        <div className={'mt-4 rounded border p-3 ' + styles.panelSolid}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h3 className={'text-sm font-bold ' + styles.textPrimary}>Compared with previous immutable review</h3><p className={'mt-1 text-xs ' + styles.textMuted}>Baseline: {citationDiff.baselineAt?.slice(0, 10) ?? 'No prior citation snapshot'}</p></div>
                <span className={'text-xs ' + styles.textMuted}>{citationDiff.items.filter((item) => item.kind !== 'unchanged').length} changes</span>
            </div>
            {citationDiff.items.length > 0 ? <ul className={'mt-2 divide-y ' + styles.divider}>{citationDiff.items.map((item) => {
                const citation = item.after ?? item.before;
                return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><p className={'text-xs font-bold ' + (item.kind === 'changed' || item.kind === 'removed' ? styles.risk : item.kind === 'added' ? styles.positive : styles.textPrimary)}>{item.kind.toUpperCase()} · {citation?.title}</p><p className={'mt-1 text-[11px] ' + styles.textMuted}>{item.kind === 'changed' ? 'Captured evidence changed; no intent is inferred.' : citation?.location}</p></div>
                    {(item.kind === 'added' || item.kind === 'changed') && citation ? <button type="button" onClick={() => {
                        const result = enqueueResearchWorkflowTaskClient({
                            symbol: record.symbol,
                            templateId: 'post-event',
                            source: 'document-diff',
                            dedupeKey: `document:${record.symbol}:${citation.id}:${citation.contentDigest}`,
                            dueAt: new Date().toISOString().slice(0, 10),
                        });
                        setStatus(result.created ? 'Document evidence review added to Queue.' : 'That document evidence review is already queued.');
                    }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + styles.row}>Queue task</button> : null}
                </li>;
            })}</ul> : <p className={'mt-3 text-xs ' + styles.textMuted}>No current or historical document citations to compare.</p>}
        </div>

        {(status || saveError) ? <p role={saveError ? 'alert' : 'status'} aria-live="polite" className={'mt-3 text-xs ' + (saveError ? styles.risk : styles.textSecondary)}>{saveError ?? status}</p> : null}
        <div className="mt-4 flex justify-end">
            <button type="button" disabled={!dirty || saving} onClick={() => void save()} className="min-h-11 rounded bg-emerald-500 px-4 text-xs font-bold text-slate-950 disabled:opacity-50">{saving ? 'Saving…' : 'Save citations'}</button>
        </div>
    </section>;
};
