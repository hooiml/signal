import type { ResearchRecord } from '../types/research';
import { isResearchCalendarDate } from './calendar-input';

type ReviewEvidence = Pick<ResearchRecord, 'decisionJournal' | 'reviewHistory'>;

// A save-only bookmark records decision `Not recorded` and no review history. Its stored
// `lastReviewedAt` is only the creation date, so it is never a personal review claim.
export const hasPersonalReview = (record: ReviewEvidence): boolean =>
    record.reviewHistory.length > 0 || record.decisionJournal.decision !== 'Not recorded';

export const personalReviewDate = (record: ReviewEvidence & Pick<ResearchRecord, 'lastReviewedAt'>): string | null =>
    hasPersonalReview(record) ? record.lastReviewedAt : null;

// Consumers pass the authored date from personalReviewDate, including nullable projections
// used by alerts and the exposure map. Unknown or invalid dates never become a zero-day review.
export const personalReviewAgeDays = (
    reviewedAt: string | null,
    today = new Date().toISOString().slice(0, 10),
): number | null => {
    if (reviewedAt === null || !isResearchCalendarDate(reviewedAt) || !isResearchCalendarDate(today)) return null;
    const age = (Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${reviewedAt}T00:00:00.000Z`)) / 86_400_000;
    return age < 0 ? null : age;
};

export type ReviewMarker = { readonly time: string; readonly label: string };

// Saved personal reviews become chart markers: each review snapshot, plus the current decision when no
// snapshot shares its day. History keeps full timestamps but `lastReviewedAt` is a YYYY-MM-DD date, so
// compare by day or the latest review appears twice.
export const savedReviewMarkers = (record: ReviewEvidence & Pick<ResearchRecord, 'lastReviewedAt' | 'whyInterested'>): ReviewMarker[] => {
    const label = (decision: string, thesis: string) => decision !== 'Not recorded' ? `Decision: ${decision}` : thesis ? 'Thesis saved' : 'Review saved';
    const markers = record.reviewHistory.map(review => ({ time: review.reviewedAt, label: label(review.decisionJournal.decision, review.whyInterested) }));
    const current = personalReviewDate(record);
    if (current && !markers.some(marker => marker.time.slice(0, 10) === current.slice(0, 10))) markers.push({ time: current, label: label(record.decisionJournal.decision, record.whyInterested) });
    return markers.filter(marker => Number.isFinite(Date.parse(marker.time))).sort((a, b) => a.time.localeCompare(b.time));
};

// Age-based review countdowns start from a genuine review. An explicit nextReviewAt schedule
// is independent and still applies to bookmarks.
export const reviewAgeCountdownDays = (record: ReviewEvidence & Pick<ResearchRecord, 'monitoringRules'>): number | null =>
    hasPersonalReview(record) ? record.monitoringRules.reviewAgeDays : null;

export const reviewMonitoringRules = (record: ReviewEvidence & Pick<ResearchRecord, 'monitoringRules'>): ResearchRecord['monitoringRules'] =>
    hasPersonalReview(record) ? record.monitoringRules : { ...record.monitoringRules, reviewAgeDays: null };
