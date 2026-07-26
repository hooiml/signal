'use client';

import { useState } from 'react';
import { buildResearchDecisionPacket, type ResearchDecisionPacket } from '@/lib/research/decision-packet';
import { parseMarketReplayIndex, parseMarketReplaySnapshot, type MarketReplaySnapshot } from '@/lib/types/market-replay';
import type { ResearchRecord } from '@/lib/types/research';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const fetchLatestMarketContext = async (market: ResearchRecord['market']): Promise<MarketReplaySnapshot | null> => {
    const query = `market=${market}&mode=standard&enableSocial=true`;
    const indexResponse = await fetch(`/api/signals/replay?${query}`);
    const indexPayload: unknown = await indexResponse.json();
    if (!indexResponse.ok) throw new Error(isRecord(indexPayload) && typeof indexPayload.error === 'string' ? indexPayload.error : 'Market snapshot index unavailable.');
    const index = parseMarketReplayIndex(indexPayload);
    const latest = index.summaries.find((summary) => summary.hasFullEvidence);
    if (!latest) return null;
    const detailResponse = await fetch(`/api/signals/replay?${query}&date=${latest.date}`);
    const detailPayload: unknown = await detailResponse.json();
    if (!detailResponse.ok) throw new Error(isRecord(detailPayload) && typeof detailPayload.error === 'string' ? detailPayload.error : 'Market snapshot unavailable.');
    return parseMarketReplaySnapshot(detailPayload);
};

const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const printHtml = (packet: ResearchDecisionPacket): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(packet.title)}</title>
<style>
body{font:14px/1.55 system-ui,sans-serif;color:#172033;max-width:900px;margin:32px auto;padding:0 24px}
button{padding:10px 14px;border:1px solid #172033;border-radius:6px;background:#fff;font-weight:700}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.55 ui-monospace,monospace}
@media print{button{display:none}body{margin:0;max-width:none;padding:0}}
</style></head><body><button type="button" onclick="window.print()">Print / Save as PDF</button><pre>${escapeHtml(packet.markdown)}</pre></body></html>`;

export const ResearchDecisionPacketV6 = ({ records, recordsLoadState, theme }: {
    readonly records: readonly ResearchRecord[];
    readonly recordsLoadState: 'loading' | 'ready' | 'error';
    readonly theme: ResearchThemeV6;
}) => {
    const [selectedKey, setSelectedKey] = useState('');
    const [packet, setPacket] = useState<ResearchDecisionPacket | null>(null);
    const [generating, setGenerating] = useState(false);
    const [contextWarning, setContextWarning] = useState<string | null>(null);
    const styles = getThemeV6(theme);
    const selectedRecord = records.find((record) => `${record.market}:${record.symbol}` === selectedKey) ?? records[0] ?? null;
    const stale = Boolean(packet && selectedRecord && packet.recordRevision !== selectedRecord.revision);

    const generate = async () => {
        if (!selectedRecord || recordsLoadState !== 'ready') return;
        setGenerating(true);
        setContextWarning(null);
        let marketContext: MarketReplaySnapshot | null = null;
        try {
            marketContext = await fetchLatestMarketContext(selectedRecord.market);
            if (!marketContext) setContextWarning('No full observed market snapshot was available; the packet records that limitation.');
        } catch (error) {
            setContextWarning(`${error instanceof Error ? error.message : 'Market context unavailable.'} The packet was generated without market context.`);
        }
        setPacket(buildResearchDecisionPacket({
            record: selectedRecord,
            generatedAt: new Date().toISOString(),
            marketContext,
        }));
        setGenerating(false);
    };

    const download = () => {
        if (!packet) return;
        const url = URL.createObjectURL(new Blob([packet.markdown], { type: 'text/markdown;charset=utf-8' }));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = packet.filename;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        trackProductAnalyticsEvent({
            name: 'packet_exported',
            surface: 'research',
            workspace: 'packets',
            attributes: { format: 'markdown' },
        });
    };

    const openPrintView = () => {
        if (!packet) return;
        const url = URL.createObjectURL(new Blob([printHtml(packet)], { type: 'text/html;charset=utf-8' }));
        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        trackProductAnalyticsEvent({
            name: 'packet_exported',
            surface: 'research',
            workspace: 'packets',
            attributes: { format: 'print' },
        });
    };

    if (recordsLoadState !== 'ready') {
        return (
            <section className="min-w-0 flex-1" aria-labelledby="decision-packet-title">
                <h1 id="decision-packet-title" className={'text-xl font-bold ' + styles.textPrimary}>Exportable decision packets</h1>
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>
                        {recordsLoadState === 'loading' ? 'Loading saved research…' : 'Saved research unavailable'}
                    </h2>
                    <p className={'mt-2 text-sm ' + styles.textMuted}>
                        {recordsLoadState === 'loading'
                            ? 'Packet creation will be available after persisted records finish loading.'
                            : 'Reload saved research before creating a packet so it cannot freeze incomplete client data.'}
                    </p>
                </div>
            </section>
        );
    }

    if (records.length === 0) {
        return (
            <section className="min-w-0 flex-1" aria-labelledby="decision-packet-title">
                <h1 id="decision-packet-title" className={'text-xl font-bold ' + styles.textPrimary}>Exportable decision packets</h1>
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>No saved research to export</h2>
                    <p className={'mt-2 text-sm ' + styles.textMuted}>Add a ticker and save a research review before creating a point-in-time packet.</p>
                </div>
            </section>
        );
    }

    return (
        <section className="min-w-0 flex-1" aria-labelledby="decision-packet-title">
            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Portable decision record</p>
            <h1 id="decision-packet-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Exportable decision packets</h1>
            <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Freeze saved ticker research with a timestamp and the latest persisted market context. Download Markdown directly or open a print-ready view for your browser&apos;s Save as PDF flow.</p>

            <div className={'mt-5 flex flex-wrap items-end gap-3 rounded-lg border p-4 ' + styles.panelSecondary}>
                <label className={'min-w-[220px] flex-1 text-xs font-semibold ' + styles.textMuted}>Saved research
                    <select value={selectedRecord ? `${selectedRecord.market}:${selectedRecord.symbol}` : ''} disabled={generating} onChange={(event) => {
                        setSelectedKey(event.target.value);
                        setPacket(null);
                        setContextWarning(null);
                    }} className={'mt-1 min-h-10 w-full rounded border bg-transparent px-3 disabled:opacity-45 ' + styles.textPrimary}>
                        {records.map((record) => <option key={`${record.market}:${record.symbol}`} value={`${record.market}:${record.symbol}`}>{record.symbol} - {record.companyName}</option>)}
                    </select>
                </label>
                <button type="button" disabled={generating || recordsLoadState !== 'ready'} onClick={() => void generate()} className={'min-h-10 rounded border px-4 text-xs font-bold disabled:opacity-45 ' + styles.selectedRow + ' ' + styles.textPrimary}>
                    {generating ? 'Freezing packet...' : 'Create point-in-time packet'}
                </button>
            </div>

            {contextWarning ? <p role="status" className={'mt-3 text-xs leading-5 ' + styles.textMuted}>{contextWarning}</p> : null}
            {stale ? <p role="alert" className={'mt-3 text-xs leading-5 ' + styles.risk}>The selected saved research changed after this packet was frozen. Create a new packet to include the latest revision.</p> : null}

            {packet ? (
                <>
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className={'text-sm font-bold ' + styles.textPrimary}>{packet.title}</h2>
                            <p className={'mt-1 text-xs ' + styles.textMuted}>Frozen {packet.generatedAt} · research revision {packet.recordRevision} · market snapshot {packet.marketSnapshotDate ?? 'unavailable'}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={download} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.selectedRow + ' ' + styles.textPrimary}>Download Markdown</button>
                            <button type="button" onClick={openPrintView} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>Open print / PDF view</button>
                        </div>
                    </div>
                    <pre data-testid="decision-packet-preview" className={'research-scrollbar mt-3 max-h-[680px] overflow-auto whitespace-pre-wrap break-words rounded-lg border p-4 text-xs leading-5 ' + styles.panelUtility + ' ' + styles.textSecondary}>{packet.markdown}</pre>
                </>
            ) : (
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>Create a frozen packet when the decision is ready to share</h2>
                    <p className={'mx-auto mt-2 max-w-xl text-sm leading-6 ' + styles.textMuted}>The generated file preserves the saved revision, evidence links, limitations, decision confidence, review date, and point-in-time market context.</p>
                </div>
            )}
        </section>
    );
};
