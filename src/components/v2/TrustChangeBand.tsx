'use client';

import React from 'react';
import { MarketSignal } from '@/lib/types/signal-v2';
import { CockpitTheme, formatDateLabel, formatDelta, getActiveSourceSummary, getAgreementLabel, getBroadMarketValidation, getEvidenceConcentrationDetails, getPrimaryCaveat, getQualityTone, getReadLimitations, getSourceFreshnessSummary, getThemeClasses, getTopDrivers } from './cockpit-utils';

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
    const alignmentMeaning = quality?.confidence_explanation || 'Signal alignment measures indicator agreement, not forecast accuracy.';
    const limitations = getReadLimitations(signal);
    const isScoreUnchanged = scoreDelta?.delta === 0;
    const freshnessSummary = getSourceFreshnessSummary(signal);
    const broadMarket = getBroadMarketValidation(signal);
    const concentration = getEvidenceConcentrationDetails(signal);
    const activeSourceSummary = getActiveSourceSummary(signal);
    const scoreMoveTitle = !scoreDelta || scoreDelta.previous_score === null || scoreDelta.delta === null
        ? 'No previous snapshot'
        : `${scoreDelta.previous_score} -> ${signal.composite_score} (${formatDelta(scoreDelta.delta)})`;

    return (
        <section className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className={`rounded-3xl border p-5 ${themeClasses.panel}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Trust check</div>
                            <h2 className={`mt-2 text-2xl font-semibold ${themeClasses.textPrimary}`}>Can I trust this read?</h2>
                        </div>
                        {quality && (
                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getQualityTone(quality.source_coverage, theme)}`}>
                                {quality.source_coverage}
                            </span>
                        )}
                    </div>

                    <div className="mt-4 space-y-3">
                        <FactRow themeClasses={themeClasses} label="Signal alignment" value={`${signal.confidence.level}, ${signal.confidence.agreement_pct}% agreement`} detail={`${getAgreementLabel(signal)} active indicators align. ${alignmentMeaning}`} />
                        <FactRow themeClasses={themeClasses} label="Coverage" value={activeSourceSummary} detail={signal.confidence.cap_reason || `${activeSourceSummary} currently contribute to the score.`} />
                        <FactRow themeClasses={themeClasses} label="Freshness" value={quality?.freshness || 'Unknown'} detail={freshnessSummary.staleSource !== 'None' ? `Stale source: ${freshnessSummary.staleSource}. Fresh source: ${freshnessSummary.freshSource}.` : 'Freshness is assessed per active input.'} />
                        <FactRow themeClasses={themeClasses} label="Main limitation" value={primaryCaveat ? 'Active' : 'None'} detail={primaryCaveat || 'No active caveat is currently suppressing the read.'} />
                        <FactRow themeClasses={themeClasses} label="Evidence concentration" value={concentration.level} detail={concentration.summary} />
                        <FactRow themeClasses={themeClasses} label="Broad-market confirmation" value={broadMarket.summary} detail={broadMarket.warning || 'Breadth is context for interpretation, not a separate score component.'} />
                    </div>

                    <div className={`mt-5 rounded-2xl border px-4 py-3 ${themeClasses.panelMuted}`}>
                        <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Why this may be wrong</div>
                        <ul className={`mt-3 space-y-2 text-sm leading-6 ${themeClasses.textSecondary}`}>
                            {limitations.map((limitation) => (
                                <li key={limitation}>- {limitation}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                <div className={`rounded-3xl border p-5 ${themeClasses.panel}`}>
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.24em] ${themeClasses.textSubtle}`}>Score context</div>
                    <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                        <div>
                            <h2 className={`text-2xl font-semibold ${themeClasses.textPrimary}`}>
                                {isScoreUnchanged ? 'What held since the previous snapshot' : `Why the score moved ${formatDelta(scoreDelta?.delta)}`}
                            </h2>
                            <p className={`mt-1 text-sm leading-6 ${themeClasses.textMuted}`}>
                                {!scoreDelta || scoreDelta.previous_score === null
                                    ? 'No previous snapshot available yet. The cockpit will show movement after the next recorded signal.'
                                    : isScoreUnchanged
                                        ? `Score remains ${signal.composite_score} since ${formatDateLabel(scoreDelta.previous_date)}; unchanged does not prove the read is fresher or safer.`
                                        : `Score moved from ${scoreDelta.previous_score} to ${signal.composite_score} (${formatDelta(scoreDelta.delta)}) since ${formatDateLabel(scoreDelta.previous_date)}.`}
                            </p>
                        </div>
                        <div className={`rounded-2xl border px-4 py-3 text-right ${themeClasses.panelMuted}`}>
                            <div className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${themeClasses.textSubtle}`}>Score moved</div>
                            <div className={`mt-2 text-sm ${themeClasses.textSecondary}`}>{scoreMoveTitle}</div>
                        </div>
                    </div>

                    <div className="mt-5 space-y-3">
                        {positive && (
                            <ChangeRow themeClasses={themeClasses} label="Supporting pressure" title={positive.name} detail={`${positive.detail} Contribution ${positive.contribution >= 0 ? '+' : ''}${positive.contribution}.`} />
                        )}
                        {negative && (
                            <ChangeRow themeClasses={themeClasses} label="Challenging pressure" title={negative.name} detail={`${negative.detail} Contribution ${negative.contribution >= 0 ? '+' : ''}${negative.contribution}.`} />
                        )}
                        {sourceToggle && (
                            <ChangeRow
                                themeClasses={themeClasses}
                                label="Source effect"
                                title={sourceToggle.source_label}
                                detail={sourceToggle.with_source_score !== null && sourceToggle.without_source_score !== null
                                    ? `${sourceToggle.with_source_score} with source vs ${sourceToggle.without_source_score} without. ${sourceToggle.summary}`
                                    : sourceToggle.summary}
                            />
                        )}
                    </div>
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
