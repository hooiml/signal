import type { ResearchRecord } from '../types/research';
import type { ResearchCalendarInput } from '../types/research-calendar';
import { personalReviewDate, reviewAgeCountdownDays } from './review-lifecycle';

// The Calendar workspace and Today briefing use the same authored-review projection.
// An explicit first-review schedule survives even when no personal review exists yet.
export const buildResearchCalendarRequest = (records: readonly ResearchRecord[]): ResearchCalendarInput[] =>
    records.map((record) => ({
        symbol: record.symbol,
        market: record.market,
        nextReviewAt: record.decisionJournal.nextReviewAt,
        lastReviewedAt: personalReviewDate(record),
        reviewAgeDays: reviewAgeCountdownDays(record),
        earningsWithinDays: record.monitoringRules.earningsWithinDays,
    }));
