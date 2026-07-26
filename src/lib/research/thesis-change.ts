import type {
    AcceptedResearchEvidence,
    ResearchFindingTarget,
    ResearchRecord,
    ResearchSynthesisMode,
} from '../types/research';
import type { AssistedResearch, ResearchEvidence, ResearchFinding } from '../types/research-assistant';

export type ThesisChangeStatus = 'new' | 'changed' | 'unchanged';
export type ThesisTextRelationship = 'not-reflected' | 'reflected' | 'updated-evidence';

export type ThesisChangeItem = {
    readonly id: string;
    readonly symbol: string;
    readonly companyName: string;
    readonly finding: ResearchFinding;
    readonly sources: readonly ResearchEvidence[];
    readonly mode: ResearchSynthesisMode;
    readonly status: ThesisChangeStatus;
    readonly relationship: ThesisTextRelationship;
    readonly savedText: string;
    readonly priorAcceptedAt: string | null;
};

const comparableTarget = (target: ResearchFindingTarget): target is Exclude<ResearchFindingTarget, 'notes'> =>
    target !== 'notes';

const normalized = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const evidenceIdentity = (item: ResearchEvidence) => `${item.id}|${item.source}|${item.sourceUrl}`;
const evidenceVersion = (item: ResearchEvidence) => `${evidenceIdentity(item)}|${item.value}|${item.reportingPeriod ?? ''}`;

const matchingAcceptedEvidence = (
    record: ResearchRecord,
    finding: ResearchFinding,
    sources: readonly ResearchEvidence[],
): AcceptedResearchEvidence | undefined => {
    const sourceIds = new Set(sources.map(evidenceIdentity));
    return [...record.acceptedEvidence]
        .reverse()
        .find((accepted) => accepted.target === finding.target
            && accepted.sources.some((source) => sourceIds.has(evidenceIdentity(source))));
};

export const buildThesisChangeItems = (
    record: ResearchRecord,
    assisted: AssistedResearch,
): readonly ThesisChangeItem[] => {
    const evidenceById = new Map(assisted.evidence.map((item) => [item.id, item]));
    return assisted.findings.flatMap((finding): ThesisChangeItem[] => {
        const sources = finding.evidenceIds.flatMap((id) => {
            const evidence = evidenceById.get(id);
            return evidence ? [evidence] : [];
        });
        if (sources.length === 0) return [];
        const prior = matchingAcceptedEvidence(record, finding, sources);
        const previousVersions = new Set(prior?.sources.map(evidenceVersion) ?? []);
        const currentVersions = new Set(sources.map(evidenceVersion));
        const sameEvidence = previousVersions.size === currentVersions.size
            && [...currentVersions].every((version) => previousVersions.has(version));
        const status: ThesisChangeStatus = !prior ? 'new' : sameEvidence ? 'unchanged' : 'changed';
        const savedText = comparableTarget(finding.target) ? record[finding.target] : record.notes;
        const reflected = normalized(savedText).includes(normalized(finding.summary));
        const relationship: ThesisTextRelationship = status === 'changed'
            ? 'updated-evidence'
            : reflected ? 'reflected' : 'not-reflected';
        return [{
            id: `${record.symbol}:${finding.target}:${finding.id}:${sources.map(evidenceVersion).join(';')}`,
            symbol: record.symbol,
            companyName: record.companyName,
            finding,
            sources,
            mode: assisted.mode,
            status,
            relationship,
            savedText,
            priorAcceptedAt: prior?.acceptedAt ?? null,
        }];
    });
};

export const stageThesisChangeEvidence = (
    item: ThesisChangeItem,
    acceptedAt = new Date().toISOString(),
): AcceptedResearchEvidence => ({
    id: `${item.symbol}:${item.finding.target}:${item.finding.id}`,
    title: item.finding.title,
    summary: item.finding.summary,
    target: item.finding.target,
    tone: item.finding.tone,
    mode: item.mode,
    acceptedAt,
    sources: item.sources,
});
