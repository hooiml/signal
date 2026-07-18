'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ResearchMarket, ResearchSynthesisMode } from '@/lib/types/research';
import type { AssistedResearch, ResearchEvidence, ResearchFinding, ResearchFindingTarget } from '@/lib/types/research-assistant';
import { parseResearchAssistantResponse } from '@/lib/research/assistant-input';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const targetLabels: Record<ResearchFindingTarget, string> = {
    whyInterested: 'Why interested',
    bullCase: 'Bull case',
    bearCase: 'Bear case',
    thesisBreak: 'Thesis invalidation',
    buyTrigger: 'Buy trigger',
    sellTrigger: 'Sell trigger',
    notes: 'Review notes',
};

export const ResearchAssistantV6 = ({ symbol, market, theme, onApply }: {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly theme: ResearchThemeV6;
    readonly onApply: (acceptance: {
        readonly finding: ResearchFinding;
        readonly sources: readonly ResearchEvidence[];
        readonly mode: ResearchSynthesisMode;
    }) => void;
}) => {
    const [research, setResearch] = useState<AssistedResearch | null>(null);
    const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const styles = getThemeV6(theme);
    const evidenceById = useMemo(() => new Map(research?.evidence.map((item) => [item.id, item]) ?? []), [research]);
    const visibleFindings = research?.findings.filter((finding) => !handled.has(finding.id)) ?? [];

    const generate = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/research/assist/${encodeURIComponent(symbol)}?market=${market}`, { method: 'POST', signal });
            const payload: unknown = await response.json();
            if (!response.ok) throw new Error(typeof payload === 'object' && payload !== null && !Array.isArray(payload)
                && typeof Object.fromEntries(Object.entries(payload)).error === 'string'
                ? String(Object.fromEntries(Object.entries(payload)).error) : 'Unable to generate assisted research.');
            setResearch(parseResearchAssistantResponse(payload));
            setHandled(new Set());
        } catch (caught) {
            if (caught instanceof DOMException && caught.name === 'AbortError') return;
            setError(caught instanceof Error ? caught.message : 'Unable to generate assisted research.');
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [market, symbol]);

    useEffect(() => {
        const controller = new AbortController();
        void generate(controller.signal);
        return () => controller.abort();
    }, [generate]);

    const handle = (id: string) => setHandled((current) => new Set([...current, id]));

    return (
        <section className={'border-b pb-4 ' + styles.divider} aria-labelledby="assisted-research-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 id="assisted-research-title" className={'text-sm font-semibold ' + styles.textSecondary}>Assisted review</h3>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Current Yahoo and SEC evidence is prepared as a review draft. Accept useful findings, then add or edit your own analysis below.</p>
                </div>
                <button type="button" disabled={loading} onClick={() => void generate()} className={'min-h-10 rounded-md border px-3 text-xs font-bold disabled:opacity-50 ' + styles.row}>
                    {loading ? 'Preparing review...' : 'Refresh assisted review'}
                </button>
            </div>

            {error ? <p role="alert" className={'mt-3 text-xs ' + styles.risk}>{error}</p> : null}
            {research ? (
                <div className="mt-3">
                    <div className={'flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] ' + styles.textMuted}>
                        <span>{research.mode === 'ai' ? 'AI-assisted synthesis' : 'Evidence-based synthesis'}</span>
                        <span>{new Date(research.generatedAt).toLocaleString()}</span>
                        <span>{research.evidence.length} sourced facts</span>
                    </div>
                    {visibleFindings.length > 0 ? (
                        <ul className={'mt-3 divide-y border-y ' + styles.divider}>
                            {visibleFindings.map((finding) => {
                                const tone = finding.tone === 'positive' ? styles.positive : finding.tone === 'risk' ? styles.risk : styles.textSecondary;
                                return (
                                    <li key={finding.id} className="py-3">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className={'text-xs font-bold ' + tone}>{finding.title}</p>
                                                <p className={'mt-1 text-sm leading-5 ' + styles.textPrimary}>{finding.summary}</p>
                                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                                                    {finding.evidenceIds.map((id) => {
                                                        const evidence = evidenceById.get(id);
                                                        return evidence ? (
                                                            <a key={id} href={evidence.sourceUrl} target="_blank" rel="noreferrer" className={'text-[11px] underline decoration-dotted underline-offset-2 ' + styles.textMuted}>
                                                                {evidence.label}: {evidence.value} · {evidence.source}{evidence.reportingPeriod ? ` · ${evidence.reportingPeriod}` : ''}
                                                            </a>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 gap-2">
                                                <button type="button" onClick={() => {
                                                    onApply({
                                                        finding,
                                                        sources: finding.evidenceIds.flatMap((id) => {
                                                            const source = evidenceById.get(id);
                                                            return source ? [source] : [];
                                                        }),
                                                        mode: research.mode,
                                                    });
                                                    handle(finding.id);
                                                }} className="min-h-10 rounded-md bg-emerald-500 px-3 text-xs font-bold text-slate-950">Add to {targetLabels[finding.target]}</button>
                                                <button type="button" onClick={() => handle(finding.id)} className={'min-h-10 px-2 text-xs font-semibold ' + styles.textMuted}>Dismiss</button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : <p className={'mt-3 text-xs ' + styles.textMuted}>{research.findings.length === 0 ? 'The connected sources did not provide enough evidence for a journal draft.' : 'All findings have been reviewed.'}</p>}
                    {research.warnings.map((warning) => <p key={warning} className={'mt-2 text-[11px] ' + styles.textMuted}>{warning}</p>)}
                    <p className={'mt-3 text-[11px] leading-4 ' + styles.textMuted}>AI interpretation is a draft, not a verified fact or recommendation. Open the linked source before accepting consequential claims.</p>
                </div>
            ) : null}
        </section>
    );
};
