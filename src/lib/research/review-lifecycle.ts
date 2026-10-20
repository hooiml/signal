import type { ResearchRecord } from '../types/research';

type ReviewEvidence = Pick<ResearchRecord, 'decisionJournal' | 'reviewHistory'>;

// A save-only bookmark records decision `Not recorded` and no review history. Its stored
// `lastReviewedAt` is only the creation date, so it is never a personal review claim.
export const hasPersonalReview = (record: ReviewEvidence): boolean =>
    record.reviewHistory.length > 0 || record.decisionJournal.decision !== 'Not recorded';

export const personalReviewDate = (record: ReviewEvidence & Pick<ResearchRecord, 'lastReviewedAt'>): string | null =>
    hasPersonalReview(record) ? record.lastReviewedAt : null;

// Age-based review countdowns start from a genuine review. An explicit nextReviewAt schedule
// is independent and still applies to bookmarks.
export const reviewAgeCountdownDays = (record: ReviewEvidence & Pick<ResearchRecord, 'monitoringRules'>): number | null =>
    hasPersonalReview(record) ? record.monitoringRules.reviewAgeDays : null;

export const reviewMonitoringRules = (record: ReviewEvidence & Pick<ResearchRecord, 'monitoringRules'>): ResearchRecord['monitoringRules'] =>
    hasPersonalReview(record) ? record.monitoringRules : { ...record.monitoringRules, reviewAgeDays: null };
