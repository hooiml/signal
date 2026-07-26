'use client';

import { useMemo, useState } from 'react';
import { buildResearchOutcomeAnalytics, type ResearchOutcomeGroup } from '@/lib/research/outcome-analytics';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';
import { PaperDecisionTrackerV6 } from './PaperDecisionTrackerV6';

const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
}).format(new Date(value));

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const OutcomeTable = ({ title, rows, theme }: {
    readonly title: string;
    readonly rows: readonly ResearchOutcomeGroup[];
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    return (
        <section className={'min-w-0 rounded-lg border p-4 ' + styles.panelSecondary} aria-label={`${title} outcome breakdown`}>
            <h2 className={'text-sm font-bold ' + styles.textPrimary}>{title}</h2>
            {rows.length === 0 ? <p className={'mt-3 text-xs ' + styles.textMuted}>No assessed decisions yet.</p> : (
                <div className="research-scrollbar mt-3 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-left text-xs">
                        <thead>
                            <tr className={styles.textMuted}>
                                <th className="pb-2 font-semibold">Group</th>
                                <th className="pb-2 text-right font-semibold">Assessed</th>
                                <th className="pb-2 text-right font-semibold">Correct</th>
                                <th className="pb-2 text-right font-semibold">Mixed</th>
                                <th className="pb-2 text-right font-semibold">Incorrect</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.label} className={'border-t ' + styles.divider}>
                                    <th className={'py-2 font-semibold ' + styles.textSecondary}>{titleCase(row.label)}</th>
                                    <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{row.assessed}</td>
                                    <td className={'py-2 text-right font-mono ' + styles.positive}>{row.correct}</td>
                                    <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{row.mixed}</td>
                                    <td className={'py-2 text-right font-mono ' + styles.risk}>{row.incorrect}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export const ResearchOutcomeAnalyticsV6 = ({ records, theme, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly theme: ResearchThemeV6;
    readonly onOpen: (symbol: string) => void;
}) => {
    const [breakdown, setBreakdown] = useState<'decision' | 'confidence' | 'market'>('decision');
    const analytics = useMemo(() => buildResearchOutcomeAnalytics(records), [records]);
    const styles = getThemeV6(theme);
    const rows = breakdown === 'decision' ? analytics.byDecision
        : breakdown === 'confidence' ? analytics.byConfidence : analytics.byMarket;
    const resolutionRate = analytics.linkedDecisions === 0
        ? null
        : Math.round((analytics.assessedDecisions / analytics.linkedDecisions) * 100);

    return (
        <section className="min-w-0 flex-1" aria-labelledby="research-outcomes-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Decision learning</p>
                    <h1 id="research-outcomes-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Decision outcome analytics</h1>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Review how prior decisions were assessed, how complete the process was, and whether scheduled follow-ups happened on time. Outcomes are user judgments, not proof of predictive accuracy.</p>
                </div>
                <span className={'text-xs ' + styles.textMuted}>{analytics.historicalDecisions} saved decision{analytics.historicalDecisions === 1 ? '' : 's'}</span>
            </div>

            <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {[
                    ['Assessed', String(analytics.assessedDecisions), `${analytics.unresolvedDecisions} unresolved linked review${analytics.unresolvedDecisions === 1 ? '' : 's'}`],
                    ['Resolution coverage', resolutionRate === null ? 'Not available' : `${resolutionRate}%`, 'Of decisions linked to a later review'],
                    ['Correct / mixed / incorrect', `${analytics.correct} / ${analytics.mixed} / ${analytics.incorrect}`, 'Kept separate to avoid a false hit rate'],
                    ['Checklist completeness', analytics.averageChecklistCompletionPercent === null ? 'Not available' : `${analytics.averageChecklistCompletionPercent}%`, 'Average at the assessed decision'],
                    ['Scheduled on time', analytics.scheduledAssessments === 0 ? 'Not available' : `${analytics.onTimeAssessments}/${analytics.scheduledAssessments}`, 'Assessments with a recorded due date'],
                ].map(([label, value, note]) => (
                    <div key={label} className={'rounded-lg border p-4 ' + styles.panelUtility}>
                        <dt className={'text-xs font-semibold ' + styles.textMuted}>{label}</dt>
                        <dd className={'mt-2 font-mono text-lg font-bold tabular-nums ' + styles.textPrimary}>{value}</dd>
                        <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>{note}</p>
                    </div>
                ))}
            </dl>

            {analytics.linkedDecisions === 0 ? (
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>No decisions are ready for outcome analysis</h2>
                    <p className={'mx-auto mt-2 max-w-xl text-sm leading-6 ' + styles.textMuted}>Save a decision, then use a later review to assess that prior decision as correct, mixed, or incorrect. Signal keeps the latest decision pending until another review links back to it.</p>
                </div>
            ) : (
                <>
                    <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Outcome breakdown">
                        {(['decision', 'confidence', 'market'] as const).map((option) => (
                            <button key={option} type="button" aria-pressed={breakdown === option} onClick={() => {
                                setBreakdown(option);
                                trackProductAnalyticsEvent({
                                    name: 'outcome_breakdown_changed',
                                    surface: 'research',
                                    workspace: 'outcomes',
                                    attributes: { breakdown: option },
                                });
                            }} className={'min-h-10 rounded border px-3 text-xs font-semibold ' + (breakdown === option ? styles.selectedRow : styles.row)}>
                                By {option}
                            </button>
                        ))}
                    </div>
                    <div className="mt-3">
                        <OutcomeTable title={titleCase(breakdown)} rows={rows} theme={theme} />
                    </div>
                </>
            )}

            <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="recent-outcomes-title">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="recent-outcomes-title" className={'text-sm font-bold ' + styles.textPrimary}>Recent assessments</h2>
                    <span className={'text-xs ' + styles.textMuted}>Latest 10 resolved outcomes</span>
                </div>
                {analytics.assessments.length === 0 ? <p className={'mt-3 text-xs ' + styles.textMuted}>Resolved assessments will appear here.</p> : (
                    <ul className={'mt-2 divide-y ' + styles.divider}>
                        {analytics.assessments.slice(0, 10).map((assessment) => (
                            <li key={assessment.assessmentReviewId} className="grid gap-2 py-3 min-[700px]:grid-cols-[90px_minmax(0,1fr)_auto] min-[700px]:items-center">
                                <button type="button" onClick={() => onOpen(assessment.symbol)} className={'min-h-10 text-left font-mono text-sm font-bold ' + styles.textPrimary}>{assessment.symbol}</button>
                                <div>
                                    <p className={'text-sm font-semibold ' + styles.textSecondary}>{assessment.decision} · {titleCase(assessment.confidence)} confidence · <span className={assessment.outcome === 'correct' ? styles.positive : assessment.outcome === 'incorrect' ? styles.risk : styles.textSecondary}>{titleCase(assessment.outcome)}</span></p>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Reviewed {formatDate(assessment.reviewedAt)} · assessed after {assessment.daysToAssessment} days · checklist {assessment.checklistCompletionPercent}%{assessment.assessedOnTime === null ? '' : assessment.assessedOnTime ? ' · on time' : ' · after scheduled date'}</p>
                                </div>
                                <div className={'font-mono text-xs font-semibold tabular-nums ' + styles.textSecondary}>
                                    {assessment.priceChangePercent === null ? 'Price change unavailable' : `${assessment.priceChangePercent >= 0 ? '+' : ''}${assessment.priceChangePercent.toFixed(2)}%`}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <PaperDecisionTrackerV6 records={records} theme={theme} onOpen={onOpen} />

            <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>Price change uses the two user-observed prices saved with the linked reviews. It excludes dividends, fees, cash flows, and benchmark-relative performance, so it is context—not a backtest or recommendation.</p>
        </section>
    );
};
