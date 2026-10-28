import type { ResearchRecord } from '../types/research';
import { isResearchCalendarDate } from './calendar-input';
import { personalReviewDate, reviewAgeCountdownDays } from './review-lifecycle';

export type DueReviewReason = { kind: 'scheduled' | 'stale'; date: string };

/** Calendar semantics: scheduled reviews include today; age-based staleness starts the next day. */
export function dueReviewReasons(record: ResearchRecord, today: string): DueReviewReason[] {
    if (!isResearchCalendarDate(today)) return [];
    const reasons: DueReviewReason[] = [];
    const scheduled = record.decisionJournal.nextReviewAt;
    if (scheduled && isResearchCalendarDate(scheduled) && scheduled <= today) reasons.push({ kind: 'scheduled', date: scheduled });
    const reviewed = personalReviewDate(record);
    const age = reviewAgeCountdownDays(record);
    if (reviewed && isResearchCalendarDate(reviewed) && age !== null && Number.isInteger(age) && age > 0 && age <= 365) {
        const deadline = new Date(`${reviewed}T00:00:00.000Z`);
        deadline.setUTCDate(deadline.getUTCDate() + age);
        const date = deadline.toISOString().slice(0, 10);
        if (date < today) reasons.push({ kind: 'stale', date });
    }
    return reasons;
}

/** Use one saved review, never fill its missing fields from a different review or today's quote. */
export function savedReviewContext(record: ResearchRecord) {
    const latest = [...record.reviewHistory]
        .filter(review => Number.isFinite(Date.parse(review.reviewedAt)))
        .sort((a, b) => Date.parse(b.reviewedAt) - Date.parse(a.reviewedAt))[0];
    if (latest) return { reviewedAt: latest.reviewedAt, journal: latest.decisionJournal, thesis: latest.whyInterested };
    const reviewedAt = personalReviewDate(record);
    return reviewedAt && isResearchCalendarDate(reviewedAt)
        ? { reviewedAt, journal: record.decisionJournal, thesis: record.whyInterested }
        : null;
}

export function reviewHighDistance(price: number | null | undefined, high: number | null | undefined): string {
    if (price == null || high == null || !Number.isFinite(price) || !Number.isFinite(high) || price <= 0 || high <= 0) return 'Unavailable';
    const distance = (price / high - 1) * 100;
    if (Math.abs(distance) < 0.05) return 'At the high';
    return `${Math.abs(distance).toFixed(1)}% ${distance > 0 ? 'above' : 'below'}`;
}
