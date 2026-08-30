'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { ResearchMemoryDockV7 } from '@/components/v7/ResearchMemoryDockV7';

const ResearchExpectationRealityV8 = dynamic(
    () => import('@/components/v8/ResearchExpectationRealityV8').then((module) => module.ResearchExpectationRealityV8),
    { ssr: false },
);
const ResearchValuationReasoningV9 = dynamic(
    () => import('@/components/v9/ResearchValuationReasoningV9').then((module) => module.ResearchValuationReasoningV9),
    { ssr: false },
);
const ResearchDecisionCalibrationV10 = dynamic(
    () => import('@/components/v10/ResearchDecisionCalibrationV10').then((module) => module.ResearchDecisionCalibrationV10),
    { ssr: false },
);

type ResearchReviewToolId = 'memory' | 'expectations' | 'valuation' | 'decision-review';
type ResearchReviewLoadState = 'idle' | 'loading' | 'ready' | 'error';

type ResearchReviewToolsV12Props = {
    readonly ticker: string;
    readonly record: ResearchRecord | null;
    readonly recordsState: Exclude<ResearchReviewLoadState, 'idle'>;
    readonly snapshot: ResearchSnapshot | null;
    readonly snapshotState: ResearchReviewLoadState;
    readonly snapshotMessage: string | null;
};

const tools: readonly { readonly id: ResearchReviewToolId; readonly label: string; readonly description: string }[] = [
    { id: 'memory', label: 'Decision memory', description: 'Changes and checkpoints' },
    { id: 'expectations', label: 'Expectation vs Reality', description: 'Event assumptions and outcomes' },
    { id: 'valuation', label: 'Valuation', description: 'Scenario assumptions' },
    { id: 'decision-review', label: 'Decision review', description: 'Process calibration' },
];

export const ResearchReviewToolsV12 = ({
    ticker,
    record,
    recordsState,
    snapshot,
    snapshotState,
    snapshotMessage,
}: ResearchReviewToolsV12Props) => {
    const [activeTool, setActiveTool] = useState<ResearchReviewToolId>('memory');
    const panelId = `research-review-tool-${activeTool}`;

    return (
        <section data-testid="research-review-tools" className="mb-3 rounded-[10px] border border-zinc-700/40 bg-zinc-950/20 p-3" aria-labelledby="research-review-tools-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-500">Selected security · {ticker}</p>
                    <h2 id="research-review-tools-heading" className="mt-1 text-base font-bold">Review tools</h2>
                    <p className="mt-1 text-xs text-zinc-500">Open one decision-context tool at a time.</p>
                </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="Review tools">
                {tools.map((tool) => {
                    const active = activeTool === tool.id;
                    return (
                        <button
                            key={tool.id}
                            type="button"
                            aria-expanded={active}
                            aria-controls={active ? panelId : undefined}
                            data-review-tool-control={tool.id}
                            onClick={() => setActiveTool(tool.id)}
                            className={`min-h-12 rounded-lg border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ${active ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-700/50 hover:border-zinc-500'}`}
                        >
                            <strong className="block text-xs">{tool.label}</strong>
                            <span className="mt-0.5 block text-[11px] text-zinc-500">{tool.description}</span>
                        </button>
                    );
                })}
            </div>

            <div id={panelId} data-testid="research-review-tool-panel" data-active-review-tool={activeTool}>
                {activeTool === 'memory' ? (
                    <ResearchMemoryDockV7
                        key={`memory:${ticker}`}
                        ticker={ticker}
                        record={record}
                        recordsState={recordsState}
                        snapshot={snapshot}
                        snapshotState={snapshotState}
                        snapshotMessage={snapshotMessage}
                    />
                ) : null}
                {activeTool === 'expectations' ? <ResearchExpectationRealityV8 key={`expectations:${ticker}`} ticker={ticker} /> : null}
                {activeTool === 'valuation' ? <ResearchValuationReasoningV9 key={`valuation:${ticker}`} ticker={ticker} snapshot={snapshot} /> : null}
                {activeTool === 'decision-review' ? <ResearchDecisionCalibrationV10 key={`decision-review:${ticker}`} ticker={ticker} record={record} snapshot={snapshot} /> : null}
            </div>
        </section>
    );
};
