import type {
    ResearchAction,
    ResearchDecisionConfidence,
    ResearchDecisionOutcome,
    ResearchMarket,
    ResearchRecord,
    ResearchReviewSnapshot,
} from '../types/research';

const checklistSize = 9;
const dayMs = 24 * 60 * 60 * 1000;

export type ResearchOutcomeAssessment = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly assessedReviewId: string;
    readonly assessmentReviewId: string;
    readonly decision: ResearchAction;
    readonly confidence: ResearchDecisionConfidence;
    readonly outcome: Exclude<ResearchDecisionOutcome, 'unresolved'>;
    readonly reviewedAt: string;
    readonly assessedAt: string;
    readonly daysToAssessment: number;
    readonly priceChangePercent: number | null;
    readonly checklistCompletionPercent: number;
    readonly scheduledReviewAt: string | null;
    readonly assessedOnTime: boolean | null;
};

export type ResearchOutcomeGroup = {
    readonly label: string;
    readonly assessed: number;
    readonly correct: number;
    readonly mixed: number;
    readonly incorrect: number;
};

export type ResearchOutcomeAnalytics = {
    readonly historicalDecisions: number;
    readonly linkedDecisions: number;
    readonly assessedDecisions: number;
    readonly unresolvedDecisions: number;
    readonly correct: number;
    readonly mixed: number;
    readonly incorrect: number;
    readonly scheduledAssessments: number;
    readonly onTimeAssessments: number;
    readonly averageChecklistCompletionPercent: number | null;
    readonly assessments: readonly ResearchOutcomeAssessment[];
    readonly byDecision: readonly ResearchOutcomeGroup[];
    readonly byConfidence: readonly ResearchOutcomeGroup[];
    readonly byMarket: readonly ResearchOutcomeGroup[];
};

const parseTime = (value: string): number | null => {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
};

const daysBetween = (from: string, to: string): number => {
    const start = parseTime(from);
    const end = parseTime(to);
    if (start === null || end === null || end < start) return 0;
    return Math.max(0, Math.round((end - start) / dayMs));
};

const checklistCompletion = (review: ResearchReviewSnapshot): number =>
    Math.round((Object.values(review.checklist).filter(Boolean).length / checklistSize) * 100);

const priceChange = (from: number | null, to: number | null): number | null => {
    if (from === null || to === null || from <= 0 || to < 0) return null;
    return Number((((to - from) / from) * 100).toFixed(2));
};

const groupAssessments = (
    assessments: readonly ResearchOutcomeAssessment[],
    labels: readonly string[],
    select: (assessment: ResearchOutcomeAssessment) => string,
): readonly ResearchOutcomeGroup[] => labels.map((label) => {
    const group = assessments.filter((assessment) => select(assessment) === label);
    return {
        label,
        assessed: group.length,
        correct: group.filter((assessment) => assessment.outcome === 'correct').length,
        mixed: group.filter((assessment) => assessment.outcome === 'mixed').length,
        incorrect: group.filter((assessment) => assessment.outcome === 'incorrect').length,
    };
}).filter((group) => group.assessed > 0);

export const buildResearchOutcomeAnalytics = (
    records: readonly ResearchRecord[],
): ResearchOutcomeAnalytics => {
    const assessments: ResearchOutcomeAssessment[] = [];
    let linkedDecisions = 0;
    let unresolvedDecisions = 0;

    for (const record of records) {
        const reviews = new Map(record.reviewHistory.map((review) => [review.id, review]));
        for (const assessmentReview of record.reviewHistory) {
            const assessedReviewId = assessmentReview.decisionJournal.priorReviewId;
            if (!assessedReviewId) continue;
            const assessedReview = reviews.get(assessedReviewId);
            if (!assessedReview) continue;
            linkedDecisions += 1;
            const outcome = assessmentReview.decisionJournal.priorOutcome;
            if (outcome === 'unresolved') {
                unresolvedDecisions += 1;
                continue;
            }
            const scheduledReviewAt = assessedReview.decisionJournal.nextReviewAt;
            const scheduledTime = scheduledReviewAt ? parseTime(scheduledReviewAt + 'T23:59:59.999Z') : null;
            const assessedTime = parseTime(assessmentReview.reviewedAt);
            assessments.push({
                symbol: record.symbol,
                market: record.market,
                assessedReviewId,
                assessmentReviewId: assessmentReview.id,
                decision: assessedReview.decisionJournal.decision,
                confidence: assessedReview.decisionJournal.confidence,
                outcome,
                reviewedAt: assessedReview.reviewedAt,
                assessedAt: assessmentReview.reviewedAt,
                daysToAssessment: daysBetween(assessedReview.reviewedAt, assessmentReview.reviewedAt),
                priceChangePercent: priceChange(
                    assessedReview.decisionJournal.observedPrice,
                    assessmentReview.decisionJournal.observedPrice,
                ),
                checklistCompletionPercent: checklistCompletion(assessedReview),
                scheduledReviewAt,
                assessedOnTime: scheduledTime === null || assessedTime === null ? null : assessedTime <= scheduledTime,
            });
        }
    }

    assessments.sort((left, right) => right.assessedAt.localeCompare(left.assessedAt));
    const correct = assessments.filter((assessment) => assessment.outcome === 'correct').length;
    const mixed = assessments.filter((assessment) => assessment.outcome === 'mixed').length;
    const incorrect = assessments.filter((assessment) => assessment.outcome === 'incorrect').length;
    const scheduled = assessments.filter((assessment) => assessment.assessedOnTime !== null);
    const checklistTotal = assessments.reduce((sum, assessment) => sum + assessment.checklistCompletionPercent, 0);

    return {
        historicalDecisions: records.reduce((sum, record) => sum + record.reviewHistory.length, 0),
        linkedDecisions,
        assessedDecisions: assessments.length,
        unresolvedDecisions,
        correct,
        mixed,
        incorrect,
        scheduledAssessments: scheduled.length,
        onTimeAssessments: scheduled.filter((assessment) => assessment.assessedOnTime).length,
        averageChecklistCompletionPercent: assessments.length === 0
            ? null
            : Math.round(checklistTotal / assessments.length),
        assessments,
        byDecision: groupAssessments(
            assessments,
            ['Ready', 'DCA', 'Wait for price', 'Watch', 'Avoid'],
            (assessment) => assessment.decision,
        ),
        byConfidence: groupAssessments(
            assessments,
            ['high', 'medium', 'low'],
            (assessment) => assessment.confidence,
        ),
        byMarket: groupAssessments(
            assessments,
            ['US', 'MY'],
            (assessment) => assessment.market,
        ),
    };
};
