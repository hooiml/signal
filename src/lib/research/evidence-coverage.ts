import type {
    AcceptedResearchEvidence,
    ResearchFindingTarget,
    ResearchRecord,
} from '../types/research';

export const evidenceCoverageStatuses = [
    'supported',
    'stale',
    'conflicting',
    'assumption',
    'missing',
] as const;

export type EvidenceCoverageStatus = typeof evidenceCoverageStatuses[number];

export type EvidenceCoverageRule = {
    readonly target: ResearchFindingTarget;
    readonly label: string;
    readonly freshnessDays: number;
};

export type EvidenceCoverageItem = EvidenceCoverageRule & {
    readonly status: EvidenceCoverageStatus;
    readonly textPresent: boolean;
    readonly evidence: readonly AcceptedResearchEvidence[];
    readonly latestEvidenceAt: string | null;
    readonly ageDays: number | null;
};

export type EvidenceCoverageSummary = {
    readonly items: readonly EvidenceCoverageItem[];
    readonly supported: number;
    readonly stale: number;
    readonly conflicting: number;
    readonly assumption: number;
    readonly missing: number;
    readonly coveragePercent: number;
};

export const evidenceCoverageRules: readonly EvidenceCoverageRule[] = [
    { target: 'whyInterested', label: 'Why interested', freshnessDays: 365 },
    { target: 'bullCase', label: 'Bull case', freshnessDays: 365 },
    { target: 'bearCase', label: 'Bear case', freshnessDays: 365 },
    { target: 'buyTrigger', label: 'Buy trigger', freshnessDays: 90 },
    { target: 'sellTrigger', label: 'Sell trigger', freshnessDays: 90 },
    { target: 'thesisBreak', label: 'Thesis invalidation', freshnessDays: 365 },
    { target: 'notes', label: 'Review notes', freshnessDays: 90 },
];

const utcDay = (value: string): number | null => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
    const timestamp = Date.parse(date);
    return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : null;
};

const evidenceBasisDate = (evidence: AcceptedResearchEvidence): string => {
    const reportingDates = evidence.sources
        .map((source) => source.reportingPeriod)
        .filter((value): value is string => value !== null && utcDay(value) !== null)
        .sort();
    return reportingDates.at(-1) ?? evidence.acceptedAt;
};

const latestEvidenceDate = (evidence: readonly AcceptedResearchEvidence[]): string | null =>
    evidence.map(evidenceBasisDate).sort().at(-1) ?? null;

const evidenceHasConflict = (evidence: readonly AcceptedResearchEvidence[]): boolean => {
    const tones = new Set(evidence.map((item) => item.tone));
    return tones.has('positive') && tones.has('risk');
};

const statusFor = (
    textPresent: boolean,
    evidence: readonly AcceptedResearchEvidence[],
    latestEvidenceAt: string | null,
    freshnessDays: number,
    today: string,
): { readonly status: EvidenceCoverageStatus; readonly ageDays: number | null } => {
    if (!textPresent) return { status: 'missing', ageDays: null };
    if (evidence.length === 0 || latestEvidenceAt === null) return { status: 'assumption', ageDays: null };
    const todayDay = utcDay(today);
    const evidenceDay = utcDay(latestEvidenceAt);
    const ageDays = todayDay === null || evidenceDay === null ? null : Math.max(0, todayDay - evidenceDay);
    if (evidenceHasConflict(evidence)) return { status: 'conflicting', ageDays };
    if (ageDays === null || ageDays > freshnessDays) return { status: 'stale', ageDays };
    return { status: 'supported', ageDays };
};

export const buildEvidenceCoverage = (
    record: ResearchRecord,
    today = new Date().toISOString().slice(0, 10),
): EvidenceCoverageSummary => {
    const items = evidenceCoverageRules.map((rule): EvidenceCoverageItem => {
        const evidence = record.acceptedEvidence.filter((item) => item.target === rule.target);
        const latestEvidenceAt = latestEvidenceDate(evidence);
        const textPresent = record[rule.target].trim().length > 0;
        const { status, ageDays } = statusFor(
            textPresent,
            evidence,
            latestEvidenceAt,
            rule.freshnessDays,
            today,
        );
        return { ...rule, status, textPresent, evidence, latestEvidenceAt, ageDays };
    });
    const count = (status: EvidenceCoverageStatus) => items.filter((item) => item.status === status).length;
    const supported = count('supported');
    return {
        items,
        supported,
        stale: count('stale'),
        conflicting: count('conflicting'),
        assumption: count('assumption'),
        missing: count('missing'),
        coveragePercent: Math.round((supported / items.length) * 100),
    };
};
