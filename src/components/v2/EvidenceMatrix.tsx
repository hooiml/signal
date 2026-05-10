'use client';

import React from 'react';
import { IndicatorData, MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, formatDateLabel, formatRawValue, getActionUiLabel, getFreshnessLabel, getFreshnessTone, getReadStateLabel, getSupportLabel, getSupportState, getSupportTone, getThemeClasses, getTierUiLabel } from './cockpit-utils';

interface EvidenceMatrixProps {
    signal: MarketSignal;
    market: 'US' | 'MY';
    theme: CockpitTheme;
}

interface EvidenceRow extends IndicatorData {
    contribution: number | null;
    detail: string | null;
    modeNote: string | null;
    supportState: ReturnType<typeof getSupportState>;
    freshness: string;
}

export const EvidenceMatrix = ({ signal, market, theme }: EvidenceMatrixProps) => {
    const themeClasses = getThemeClasses(theme);
    const disagreementNote = signal.metadata.interpretation_context?.disagreement_note;
    const rows = buildRows(signal);
    const challengingCount = rows.filter((row) => row.supportState === 'challenges').length;

    return (
        <section className={`rounded-3xl border p-5 ${themeClasses.panelStrong}`}>
            <div className={`flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between ${themeClasses.divider}`}>
                <div>
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Evidence matrix</div>
                    <h2 className={`mt-2 text-2xl font-semibold ${themeClasses.textPrimary}`}>Evidence supporting or challenging the current read</h2>
                    <p className={`mt-1 max-w-3xl text-sm leading-6 ${themeClasses.textMuted}`}>
                        Rows are sorted by current contribution. Agreement shows the raw active-indicator percentage, while alignment level is capped by coverage and freshness.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <SummaryChip themeClasses={themeClasses} label="Read state" value={getReadStateLabel(signal.tier, signal.mode)} />
                    <SummaryChip themeClasses={themeClasses} label="Majority read" value={getActionUiLabel(signal.confidence.majority_signal)} />
                    <SummaryChip themeClasses={themeClasses} label="Agreement" value={`${signal.confidence.agreement_pct}%`} />
                    <SummaryChip themeClasses={themeClasses} label="Challenging" value={`${challengingCount}`} />
                </div>
            </div>

            {disagreementNote && (
                <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${theme === 'light' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-amber-500/25 bg-amber-500/10 text-amber-100'}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${theme === 'light' ? 'text-amber-700' : 'text-amber-200'}`}>Conflict state</div>
                    <p className="mt-1">{disagreementNote}</p>
                </div>
            )}

            <div className={`mt-5 hidden overflow-hidden rounded-3xl border lg:block ${themeClasses.divider}`}>
                <table className={`min-w-full divide-y text-left text-sm ${themeClasses.divider} ${themeClasses.textSecondary}`}>
                    <thead className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.panelMuted} ${themeClasses.textSubtle}`}>
                        <tr>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Raw value</th>
                            <th className="px-4 py-3">Score</th>
                            <th className="px-4 py-3">Read</th>
                            <th className="px-4 py-3">Weight</th>
                            <th className="px-4 py-3">Contribution</th>
                            <th className="px-4 py-3">Freshness</th>
                            <th className="px-4 py-3">Role</th>
                        </tr>
                    </thead>
                    <tbody className={`divide-y ${themeClasses.divider}`}>
                        {rows.map((row) => (
                            <tr
                                key={row.name}
                                className={`align-top ${row.supportState === 'challenges'
                                    ? themeClasses.tableRowChallenge
                                    : row.supportState === 'supports'
                                        ? themeClasses.tableRowSupport
                                        : ''}`}
                            >
                                <td className="px-4 py-4">
                                    <div className={`font-semibold ${themeClasses.textPrimary}`}>{row.display_name}</div>
                                    <div className={`mt-1 text-xs ${themeClasses.textMuted}`}>Updated {formatDateLabel(row.last_updated, true)}</div>
                                </td>
                                <td className={`px-4 py-4 ${themeClasses.textSecondary}`}>{formatRawValue(row, market)}</td>
                                <td className={`px-4 py-4 font-mono text-lg ${themeClasses.textPrimary}`}>{Math.round(row.score)}</td>
                                <td className="px-4 py-4">
                                    <span className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${themeClasses.panelMuted} ${themeClasses.textSecondary}`}>
                                        {getTierUiLabel(row.signal)}
                                    </span>
                                </td>
                                <td className={`px-4 py-4 font-mono ${themeClasses.textSecondary}`}>
                                    <div>{(row.weight * 100).toFixed(0)}%</div>
                                    <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${themeClasses.railBackground}`}>
                                        <div
                                            className={`h-full rounded-full ${row.supportState === 'challenges'
                                                ? 'bg-rose-500'
                                                : row.supportState === 'supports'
                                                    ? 'bg-emerald-500'
                                                    : 'bg-slate-500'
                                                }`}
                                            style={{ width: `${Math.max(8, Math.min(100, row.weight * 100))}%` }}
                                        />
                                    </div>
                                </td>
                                <td className={`px-4 py-4 font-mono ${themeClasses.textSecondary}`}>{row.contribution === null ? '--' : `${row.contribution >= 0 ? '+' : ''}${row.contribution}`}</td>
                                <td className="px-4 py-4">
                                    <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${getFreshnessTone(row.freshness, theme)}`}>
                                        {row.freshness}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <div className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getSupportTone(row.supportState, theme)}`}>
                                        {getSupportLabel(row.supportState)}
                                    </div>
                                    {(row.modeNote || row.detail || row.freshness === 'Stale') && (
                                        <div className={`mt-2 max-w-xs text-xs leading-5 ${themeClasses.textMuted}`}>
                                            {row.modeNote || row.detail || 'This indicator is stale and should be treated cautiously.'}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-5 space-y-3 lg:hidden">
                {rows.map((row) => (
                    <article key={row.name} className={`rounded-2xl border p-4 ${row.supportState === 'challenges'
                        ? 'border-rose-500/25 bg-rose-500/[0.05]'
                        : row.supportState === 'supports'
                            ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                            : themeClasses.panelMuted
                        }`}>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className={`text-base font-semibold ${themeClasses.textPrimary}`}>{row.display_name}</div>
                                <div className={`mt-1 text-sm ${themeClasses.textMuted}`}>{getTierUiLabel(row.signal)} · {getSupportLabel(row.supportState)}</div>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getSupportTone(row.supportState, theme)}`}>
                                {Math.round(row.score)}
                            </span>
                        </div>
                        <div className={`mt-3 grid grid-cols-2 gap-3 text-sm ${themeClasses.textSecondary}`}>
                            <RowMeta themeClasses={themeClasses} label="Weight" value={`${(row.weight * 100).toFixed(0)}%`} />
                            <RowMeta themeClasses={themeClasses} label="Freshness" value={row.freshness} />
                            <RowMeta themeClasses={themeClasses} label="Raw" value={formatRawValue(row, market)} />
                            <RowMeta themeClasses={themeClasses} label="Updated" value={formatDateLabel(row.last_updated)} />
                        </div>
                        {(row.modeNote || row.detail || row.freshness === 'Stale') && (
                            <p className={`mt-3 text-sm leading-6 ${themeClasses.textMuted}`}>
                                {row.modeNote || row.detail || 'This indicator is stale and should be treated cautiously.'}
                            </p>
                        )}
                    </article>
                ))}
            </div>
        </section>
    );
};

function buildRows(signal: MarketSignal): EvidenceRow[] {
    const drivers = signal.metadata.score_drivers ?? [];

    const rows = Object.values(signal.components).map((indicator) => {
        const driver = drivers.find((entry) => entry.key === indicator.name || entry.name === indicator.display_name);
        const freshness = getFreshnessLabel(indicator.last_updated);

        return {
            ...indicator,
            contribution: driver?.contribution ?? null,
            detail: driver?.detail ?? null,
            modeNote: driver?.mode_note ?? null,
            supportState: getSupportState(indicator, signal.tier),
            freshness,
        } satisfies EvidenceRow;
    });

    return rows.sort((left, right) => {
        if (left.enabled !== right.enabled) return left.enabled ? -1 : 1;

        const leftContribution = Math.abs(left.contribution ?? left.score * left.weight);
        const rightContribution = Math.abs(right.contribution ?? right.score * right.weight);
        if (leftContribution !== rightContribution) return rightContribution - leftContribution;

        const leftChallenge = left.supportState === 'challenges' ? 1 : 0;
        const rightChallenge = right.supportState === 'challenges' ? 1 : 0;
        if (leftChallenge !== rightChallenge) return rightChallenge - leftChallenge;

        return left.display_name.localeCompare(right.display_name);
    });
}

const SummaryChip = ({ label, value, themeClasses }: { label: string; value: string; themeClasses: ReturnType<typeof getThemeClasses> }) => (
    <div className={`rounded-xl border px-3 py-2 ${themeClasses.statChip}`}>
        <div className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${themeClasses.textSubtle}`}>{label}</div>
        <div className={`mt-1 text-sm font-semibold uppercase tracking-[0.1em] ${themeClasses.textSecondary}`}>{value}</div>
    </div>
);

const RowMeta = ({ label, value, themeClasses }: { label: string; value: string; themeClasses: ReturnType<typeof getThemeClasses> }) => (
    <div>
        <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${themeClasses.textSubtle}`}>{label}</div>
        <div className={`mt-1 text-sm leading-6 ${themeClasses.textSecondary}`}>{value}</div>
    </div>
);
