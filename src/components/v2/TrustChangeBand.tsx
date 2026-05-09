'use client';

import React from 'react';
import { MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, formatDateLabel, formatDelta, getPrimaryCaveat, getQualityTone, getThemeClasses, getTopDrivers } from './cockpit-utils';

interface TrustChangeBandProps {
    signal: MarketSignal;
    theme: CockpitTheme;
}

export const TrustChangeBand = ({ signal, theme }: TrustChangeBandProps) => {
    const themeClasses = getThemeClasses(theme);
    const quality = signal.metadata.signal_quality;
    const scoreDelta = signal.metadata.score_delta;
    const sourceToggle = signal.metadata.counterfactuals?.source_toggle;
    const primaryCaveat = getPrimaryCaveat(signal);
    const { positive, negative } = getTopDrivers(signal);
    const confidenceMeaning = quality?.confidence_explanation || 'Confidence measures indicator agreement, not forecast accuracy.';

    return (
        <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className={`rounded-3xl border p-5 ${themeClasses.panel}`}>
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Trust band</div>
                        <h2 className={`mt-2 text-2xl font-semibold ${themeClasses.textPrimary}`}>Can I trust this read?</h2>
                    </div>
                    {quality && (
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getQualityTone(quality.source_coverage, theme)}`}>
                            {quality.source_coverage}
                        </span>
                    )}
                </div>

                <div className="mt-4 space-y-3">
                    <FactRow themeClasses={themeClasses} label="Confidence" value={signal.confidence.level} detail={confidenceMeaning} />
                    <FactRow themeClasses={themeClasses} label="Freshness" value={quality?.freshness || 'Unknown'} detail={quality?.warnings.find((warning) => warning.toLowerCase().includes('stale')) || 'Freshness is assessed per active input.'} />
                    <FactRow themeClasses={themeClasses} label="Coverage" value={quality?.source_coverage || 'Unknown'} detail={signal.confidence.cap_reason || `${Object.values(signal.components).filter((component) => component.enabled).length} active indicators currently contribute to the score.`} />
                    <FactRow themeClasses={themeClasses} label="Primary caveat" value={primaryCaveat ? 'Active' : 'None'} detail={primaryCaveat || 'No active caveat is currently suppressing the read.'} />
                </div>
            </div>

            <div className={`rounded-3xl border p-5 ${themeClasses.panel}`}>
                <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>What changed</div>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h2 className={`text-2xl font-semibold ${themeClasses.textPrimary}`}>Movement since the previous snapshot</h2>
                        <p className={`mt-1 text-sm leading-6 ${themeClasses.textMuted}`}>
                            {!scoreDelta || scoreDelta.previous_score === null
                                ? 'No previous snapshot available yet. The cockpit will show movement after the next recorded signal.'
                                : `Score moved from ${scoreDelta.previous_score} to ${signal.composite_score} (${formatDelta(scoreDelta.delta)}) since ${formatDateLabel(scoreDelta.previous_date)}.`}
                        </p>
                    </div>
                    <div className={`rounded-2xl border px-4 py-3 text-right ${themeClasses.panelMuted}`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Snapshot pair</div>
                        <div className={`mt-2 text-sm ${themeClasses.textSecondary}`}>{formatDateLabel(scoreDelta?.previous_date)} {'->'} {formatDateLabel(scoreDelta?.snapshot_date)}</div>
                    </div>
                </div>

                <div className="mt-5 space-y-3">
                    <ChangeRow themeClasses={themeClasses} label="Positive pressure" title={positive?.name || 'No current positive driver'} detail={positive ? `${positive.detail} Contribution ${positive.contribution >= 0 ? '+' : ''}${positive.contribution}.` : 'Current top positive driver will appear here when available.'} />
                    <ChangeRow themeClasses={themeClasses} label="Negative pressure" title={negative?.name || 'No current negative driver'} detail={negative ? `${negative.detail} Contribution ${negative.contribution >= 0 ? '+' : ''}${negative.contribution}.` : 'No reliable negative driver shift is available from the current snapshot.'} />
                    <ChangeRow
                        themeClasses={themeClasses}
                        label="Source impact"
                        title={sourceToggle ? sourceToggle.source_label : 'No source comparison'}
                        detail={sourceToggle
                            ? (sourceToggle.with_source_score !== null && sourceToggle.without_source_score !== null
                                ? `${sourceToggle.with_source_score} with source vs ${sourceToggle.without_source_score} without. ${sourceToggle.summary}`
                                : sourceToggle.summary)
                            : 'Source-toggle comparison is unavailable for this snapshot.'}
                    />
                </div>
            </div>
        </section>
    );
};

const FactRow = ({ label, value, detail, themeClasses }: { label: string; value: string; detail: string; themeClasses: ReturnType<typeof getThemeClasses> }) => (
    <div className={`grid gap-2 rounded-2xl border px-4 py-3 sm:grid-cols-[0.24fr_0.76fr] sm:items-start ${themeClasses.panelMuted}`}>
        <div>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>{label}</div>
            <div className={`mt-1 text-base font-semibold capitalize ${themeClasses.textSecondary}`}>{value}</div>
        </div>
        <div className={`text-sm leading-6 ${themeClasses.textMuted}`}>{detail}</div>
    </div>
);

const ChangeRow = ({ label, title, detail, themeClasses }: { label: string; title: string; detail: string; themeClasses: ReturnType<typeof getThemeClasses> }) => (
    <div className={`grid gap-2 rounded-2xl border px-4 py-3 sm:grid-cols-[0.24fr_0.76fr] sm:items-start ${themeClasses.panelMuted}`}>
        <div>
            <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>{label}</div>
            <div className={`mt-1 text-base font-semibold ${themeClasses.textSecondary}`}>{title}</div>
        </div>
        <div className={`text-sm leading-6 ${themeClasses.textMuted}`}>{detail}</div>
    </div>
);
