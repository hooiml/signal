import type { InvestmentPolicyAssessment } from './investment-policy';
import { buildEvidenceCoverage } from './evidence-coverage';
import type { ResearchRecord } from '../types/research';

export const researchReadinessDestinations = [
    'review', 'evidence', 'valuation', 'policy', 'alerts', 'calendar',
] as const;

export type ResearchReadinessDestination = typeof researchReadinessDestinations[number];
export type ResearchReadinessTone = 'ready' | 'attention' | 'unavailable';

export type ResearchReadinessItem = {
    readonly id: 'research' | 'evidence' | 'valuation' | 'policy' | 'triggers' | 'review' | 'position';
    readonly label: string;
    readonly status: string;
    readonly detail: string;
    readonly tone: ResearchReadinessTone;
    readonly destination: ResearchReadinessDestination;
};

export type ResearchReadiness = {
    readonly context: string;
    readonly items: readonly ResearchReadinessItem[];
    readonly nextGap: {
        readonly label: string;
        readonly detail: string;
        readonly destination: ResearchReadinessDestination;
    };
};

const checklistKeys = [
    'understandBusiness',
    'revenueGrowingOrStable',
    'marginsHealthyOrImproving',
    'debtManageable',
    'freeCashFlowPositiveOrImproving',
    'valuationReasonable',
    'catalystOrCompoundingReason',
    'downsideAcceptable',
    'betterThanCashOrIndex',
] as const;

const thesisFields = ['whyInterested', 'bullCase', 'bearCase', 'thesisBreak'] as const;
const positionFields = ['plannedAllocationPercent', 'plannedEntryPrice', 'invalidationPrice'] as const;

const dateState = (date: string | null, today: string): 'missing' | 'overdue' | 'scheduled' => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'missing';
    return date < today ? 'overdue' : 'scheduled';
};

export const buildResearchReadiness = ({ record, sector, policyAssessment, today = new Date().toISOString().slice(0, 10) }: {
    readonly record: ResearchRecord;
    readonly sector: string;
    readonly policyAssessment: InvestmentPolicyAssessment | null;
    readonly today?: string;
}): ResearchReadiness => {
    const thesisComplete = thesisFields.filter((field) => record[field].trim().length > 0).length;
    const checklistComplete = checklistKeys.filter((key) => record.checklist[key]).length;
    const researchComplete = thesisComplete === thesisFields.length && checklistComplete === checklistKeys.length;
    const coverage = buildEvidenceCoverage(record, today);
    const evidenceNeedsAttention = coverage.stale + coverage.conflicting + coverage.assumption + coverage.missing;
    const enabledTriggers = record.monitoringRules.structuredTriggers.rules.filter((rule) => rule.enabled).length;
    const configuredTriggers = record.monitoringRules.structuredTriggers.rules.length;
    const reviewState = dateState(record.decisionJournal.nextReviewAt, today);
    const positionComplete = positionFields.filter((field) => {
        const value = record.positionPlan[field];
        return value !== null && value > 0;
    }).length;

    const items: readonly ResearchReadinessItem[] = [
        {
            id: 'research', label: 'Thesis and checklist',
            status: researchComplete ? 'Complete' : 'Incomplete',
            detail: `${thesisComplete}/${thesisFields.length} thesis fields · ${checklistComplete}/${checklistKeys.length} checks`,
            tone: researchComplete ? 'ready' : 'attention', destination: 'review',
        },
        {
            id: 'evidence', label: 'Evidence coverage',
            status: evidenceNeedsAttention === 0 ? 'Supported' : `${evidenceNeedsAttention} need review`,
            detail: `${coverage.supported} supported · ${coverage.stale} stale · ${coverage.conflicting} conflicting · ${coverage.assumption} assumptions · ${coverage.missing} missing`,
            tone: evidenceNeedsAttention === 0 ? 'ready' : 'attention', destination: 'evidence',
        },
        {
            id: 'valuation', label: 'Saved valuation',
            status: record.valuationState === 'unknown' ? 'Unknown' : record.valuationState,
            detail: `Saved review state · last reviewed ${record.lastReviewedAt}`,
            tone: record.valuationState === 'unknown' ? 'unavailable' : 'ready', destination: 'valuation',
        },
        {
            id: 'policy', label: 'Policy guardrails',
            status: policyAssessment === null ? 'Unavailable' : policyAssessment.compliant ? 'Within policy' : `${policyAssessment.violations.length} violations`,
            detail: policyAssessment === null ? 'Browser-local policy has not been assessed.' : `${policyAssessment.evidenceCoveragePercent}% supported evidence · reviewed ${policyAssessment.reviewAgeDays} days ago`,
            tone: policyAssessment === null ? 'unavailable' : policyAssessment.compliant ? 'ready' : 'attention', destination: 'policy',
        },
        {
            id: 'triggers', label: 'Structured triggers',
            status: enabledTriggers > 0 ? `${enabledTriggers} enabled` : 'None enabled',
            detail: `${configuredTriggers} configured · explicit numeric review prompts only`,
            tone: enabledTriggers > 0 ? 'ready' : 'attention', destination: 'alerts',
        },
        {
            id: 'review', label: 'Next review',
            status: reviewState === 'scheduled' ? record.decisionJournal.nextReviewAt ?? 'Scheduled' : reviewState === 'overdue' ? 'Overdue' : 'Not scheduled',
            detail: `Saved review ${record.lastReviewedAt} · calendar dates use UTC`,
            tone: reviewState === 'scheduled' ? 'ready' : 'attention', destination: 'calendar',
        },
        {
            id: 'position', label: 'Position plan',
            status: positionComplete === positionFields.length ? 'Complete' : `${positionComplete}/${positionFields.length} inputs`,
            detail: 'Allocation, planned entry, and invalidation are required for a complete risk plan.',
            tone: positionComplete === positionFields.length ? 'ready' : 'attention', destination: 'review',
        },
    ];

    const next = items.find((item) => item.id === 'research' && item.tone !== 'ready')
        ?? items.find((item) => item.id === 'evidence' && item.tone !== 'ready')
        ?? items.find((item) => item.id === 'valuation' && item.tone !== 'ready')
        ?? items.find((item) => item.id === 'policy' && item.tone !== 'ready')
        ?? items.find((item) => item.id === 'triggers' && item.tone !== 'ready')
        ?? items.find((item) => item.id === 'review' && item.tone !== 'ready')
        ?? items.find((item) => item.id === 'position' && item.tone !== 'ready');

    return {
        context: `${record.market} · ${sector || 'Unclassified'} · saved research only`,
        items,
        nextGap: next ? {
            label: next.label,
            detail: next.detail,
            destination: next.destination,
        } : {
            label: 'Review current evidence',
            detail: 'No higher-priority saved-state gap is present under the disclosed rule.',
            destination: 'review',
        },
    };
};
