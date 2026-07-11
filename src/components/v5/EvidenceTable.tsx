'use client';

import { useState, useMemo } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { formatShortDateV5, ChevronIcon } from './v5-shared';

interface EvidenceTableProps {
    signal: MarketSignal;
}

interface TableRowData {
    key: string;
    displayName: string;
    rawValue: number;
    score: number;
    weight: number;
    contribution: number;
    stance: string;
    lastUpdated: string;
    detail: string;
    modeNote?: string;
}

const tierToStance: Record<string, string> = {
    'strong-buy': 'Strong positive',
    buy: 'Positive',
    neutral: 'Neutral',
    sell: 'Negative',
    'strong-sell': 'Strong negative',
};

export const EvidenceTable = ({ signal }: EvidenceTableProps) => {
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const toggleRow = (key: string) => {
        setExpandedRows((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    // Prepare table data without type assertions
    const tableData: TableRowData[] = useMemo(() => {
        const drivers = signal.metadata.score_drivers;
        if (drivers && drivers.length > 0) {
            return drivers.map((d) => {
                const component = signal.components[d.key];
                return {
                    key: d.key,
                    displayName: d.name,
                    rawValue: d.raw_value,
                    score: d.score,
                    weight: d.weight,
                    contribution: d.contribution,
                    stance: component ? tierToStance[component.signal] || 'Neutral' : 'Neutral',
                    lastUpdated: d.last_updated,
                    detail: d.detail,
                    modeNote: d.mode_note,
                };
            });
        }

        // Fallback components mapping
        return Object.entries(signal.components)
            .filter(([, c]) => c.enabled)
            .map(([key, c]) => {
                const contribution = (c.score - 50) * c.weight;
                const detail = c.metadata?.mode_note || c.metadata?.horizon || c.metadata?.cadence || 'No detail available.';
                return {
                    key,
                    displayName: c.display_name,
                    rawValue: c.value,
                    score: c.score,
                    weight: c.weight,
                    contribution,
                    stance: tierToStance[c.signal] || 'Neutral',
                    lastUpdated: c.last_updated,
                    detail,
                    modeNote: c.metadata?.mode_note,
                };
            });
    }, [signal]);

    // Sort by absolute contribution descending
    const sortedData = useMemo(() => {
        return [...tableData].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    }, [tableData]);

    const formatContribution = (val: number) => {
        const rounded = Math.round(val * 10) / 10;
        if (rounded > 0) return `+${rounded}`;
        if (rounded < 0) return `${rounded}`;
        return '0.0';
    };

    const getScoreColorClass = (score: number) => {
        if (score >= 65) return 'text-[#2f62d5] font-bold'; // Blue
        if (score >= 40) return 'text-[#b86e00] font-bold'; // Amber
        return 'text-[#c73c35] font-bold'; // Red
    };

    const getScoreBgClass = (score: number) => {
        if (score >= 65) return 'bg-[#2f62d5]';
        if (score >= 40) return 'bg-[#b86e00]';
        return 'bg-[#c73c35]';
    };

    return (
        <div className="w-full border border-zinc-200 rounded-lg bg-white overflow-hidden text-[#17201d] select-none shadow-sm">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[1.5fr_1fr_1.2fr_1.4fr_1.2fr_40px] md:gap-x-8 items-center px-4 py-3 bg-zinc-50 text-xs font-semibold tracking-wider text-zinc-500 border-b border-zinc-200 uppercase">
                <span>Indicator</span>
                <span className="text-right">Raw Value</span>
                <span className="text-center">Score</span>
                <span className="text-right">Net Impact</span>
                <span>Stance</span>
                <span />
            </div>

            {/* Ledger Rows */}
            <div className="divide-y divide-zinc-100">
                {sortedData.map((row) => {
                    const isExpanded = !!expandedRows[row.key];
                    return (
                        <div key={row.key} className="transition-colors hover:bg-zinc-50/50">
                            {/* Row Trigger */}
                            <button
                                type="button"
                                onClick={() => toggleRow(row.key)}
                                className="w-full text-left px-4 py-3.5 flex flex-col md:grid md:grid-cols-[1.5fr_1fr_1.2fr_1.4fr_1.2fr_40px] items-stretch md:items-center gap-2 md:gap-x-8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17745a] focus-visible:ring-inset"
                                aria-expanded={isExpanded}
                            >
                                {/* Mobile Header / Name */}
                                <div className="flex items-center justify-between md:block min-w-0">
                                    <span className="text-xs font-semibold text-zinc-900 truncate block">
                                        {row.displayName}
                                    </span>
                                    <span className="md:hidden text-xs font-mono uppercase text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded-[4px]">
                                        {row.stance}
                                    </span>
                                </div>

                                {/* Raw Value */}
                                <div className="flex items-center justify-between md:justify-end text-xs font-mono text-zinc-700">
                                    <span className="md:hidden text-zinc-400 font-sans text-xs uppercase tracking-wider">Raw Value</span>
                                    <span>{row.rawValue.toFixed(row.rawValue % 1 === 0 ? 0 : 2)}</span>
                                </div>

                                {/* Score */}
                                <div className="flex items-center justify-between md:justify-center gap-3">
                                    <span className="md:hidden text-zinc-400 font-sans text-xs uppercase tracking-wider">Score</span>
                                    <div className="flex items-center gap-2">
                                        <div className="hidden sm:block h-1 w-12 bg-zinc-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${getScoreBgClass(row.score)}`}
                                                style={{ width: `${row.score}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-bold font-mono ${getScoreColorClass(row.score)}`}>
                                            {Math.round(row.score)}
                                        </span>
                                    </div>
                                </div>

                                {/* Net Impact */}
                                <div className="flex items-center justify-between md:justify-end text-xs font-mono">
                                    <span className="md:hidden text-zinc-400 font-sans text-xs uppercase tracking-wider">Net Impact</span>
                                    <span className={`font-bold ${row.contribution > 0 ? 'text-[#17745a]' : row.contribution < 0 ? 'text-[#c73c35]' : 'text-zinc-500'}`}>
                                        {formatContribution(row.contribution)} pts
                                    </span>
                                </div>

                                {/* Stance (Desktop only) */}
                                <div className="hidden md:block text-xs text-zinc-600">
                                    {row.stance}
                                </div>

                                {/* Chevron Disclosure */}
                                <div className="flex items-center justify-end md:justify-center">
                                    <div className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 transition-colors">
                                        <ChevronIcon className="h-4 w-4" direction={isExpanded ? 'up' : 'down'} />
                                    </div>
                                </div>
                            </button>

                            {/* Details Drawer */}
                            {isExpanded && (
                                <div className="px-4 pb-4 pt-2 bg-zinc-50/50 border-t border-zinc-100 text-xs text-zinc-600 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 ">
                                    <div>
                                        <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider block mb-0.5">Weight</span>
                                        <span className="text-zinc-800 font-bold font-mono">{Math.round(row.weight * 100)}%</span>
                                    </div>
                                    <div>
                                        <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider block mb-0.5">Last Updated</span>
                                        <span className="text-zinc-800 font-bold font-mono">{formatShortDateV5(row.lastUpdated)}</span>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <span className="text-[11px] text-zinc-400 uppercase font-mono tracking-wider block mb-0.5">Diagnostics</span>
                                        <p className="text-zinc-700 leading-normal text-xs">{row.detail}</p>
                                        {row.modeNote && (
                                            <p className="text-[#b86e00] italic mt-1 text-[11px]">Note: {row.modeNote}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
