import { describeReviewChanges } from '@/lib/research/records';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const formatReviewTime = (value: string) => new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
}).format(new Date(value));

export const ResearchHistoryV6 = ({ record, theme }: {
    readonly record: ResearchRecord;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    if (record.reviewHistory.length === 0) return null;

    return (
        <section className={'rounded-lg border p-4 ' + styles.panel} aria-labelledby="review-history-title">
            <div className="flex items-center justify-between gap-3">
                <h2 id="review-history-title" className={'text-sm font-semibold ' + styles.textSecondary}>Review history</h2>
                <span className={'text-xs ' + styles.textMuted}>{record.reviewHistory.length} saved review{record.reviewHistory.length === 1 ? '' : 's'}</span>
            </div>
            <ol className={'mt-3 divide-y border-y ' + styles.divider}>
                {record.reviewHistory.map((review, index) => {
                    const changes = describeReviewChanges(review, record.reviewHistory[index + 1]);
                    return (
                        <li key={review.id} className="py-3">
                            <details open={index === 0}>
                                <summary className="cursor-pointer list-none">
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className={'text-xs font-bold ' + styles.textPrimary}>{formatReviewTime(review.reviewedAt)}</p>
                                            <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{changes.join(' · ')}</p>
                                        </div>
                                        <span className={'text-xs ' + styles.textMuted}>{review.acceptedEvidence.length} evidence item{review.acceptedEvidence.length === 1 ? '' : 's'}</span>
                                    </div>
                                </summary>
                                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Decision</dt><dd className={'mt-1 text-sm font-bold ' + styles.textPrimary}>{review.decisionJournal.decision} · {review.decisionJournal.confidence} confidence</dd></div>
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Observed context</dt><dd className={'mt-1 text-sm leading-5 ' + styles.textSecondary}>{review.decisionJournal.observedPrice === null ? 'Price not recorded' : `Price ${review.decisionJournal.observedPrice}`}{review.decisionJournal.benchmarkLabel ? ` · ${review.decisionJournal.benchmarkLabel} ${review.decisionJournal.benchmarkReturnPercent?.toFixed(1) ?? 'unavailable'}% over 1Y` : ''}</dd></div>
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Next review</dt><dd className={'mt-1 text-sm leading-5 ' + styles.textSecondary}>{review.decisionJournal.nextReviewAt ?? 'Not scheduled'}</dd></div>
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Prior outcome</dt><dd className={'mt-1 text-sm leading-5 ' + styles.textSecondary}>{review.decisionJournal.priorReviewId ? review.decisionJournal.priorOutcome : 'No prior review'}{review.decisionJournal.outcomeNote ? ` · ${review.decisionJournal.outcomeNote}` : ''}</dd></div>
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Bull case</dt><dd className={'mt-1 whitespace-pre-wrap text-sm leading-5 ' + styles.textSecondary}>{review.bullCase || 'Not recorded'}</dd></div>
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Bear case</dt><dd className={'mt-1 whitespace-pre-wrap text-sm leading-5 ' + styles.textSecondary}>{review.bearCase || 'Not recorded'}</dd></div>
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Buy trigger</dt><dd className={'mt-1 whitespace-pre-wrap text-sm leading-5 ' + styles.textSecondary}>{review.buyTrigger || 'Not recorded'}</dd></div>
                                    <div><dt className={'text-xs font-semibold ' + styles.textMuted}>Thesis invalidation</dt><dd className={'mt-1 whitespace-pre-wrap text-sm leading-5 ' + styles.textSecondary}>{review.thesisBreak || 'Not recorded'}</dd></div>
                                </dl>
                                {review.acceptedEvidence.length > 0 ? (
                                    <div className={'mt-3 border-t pt-3 ' + styles.divider}>
                                        {review.acceptedEvidence.flatMap((item) => item.sources.map((source) => (
                                            <a key={item.id + source.id + source.sourceUrl} href={source.sourceUrl} target="_blank" rel="noreferrer" className={'mr-3 inline-block text-[11px] underline decoration-dotted underline-offset-2 ' + styles.textMuted}>
                                                {item.title}: {source.source}{source.reportingPeriod ? ` · ${source.reportingPeriod}` : ''}
                                            </a>
                                        )))}
                                    </div>
                                ) : null}
                            </details>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
};
