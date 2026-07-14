import type { AssistedResearch, ResearchEvidence, ResearchFinding } from '../types/research-assistant';
import { researchFindingTargets } from '../types/research-assistant';

export class ResearchAssistantInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchAssistantInputError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const isEvidence = (value: unknown): value is ResearchEvidence => isRecord(value)
    && typeof value.id === 'string'
    && typeof value.label === 'string'
    && typeof value.value === 'string'
    && typeof value.source === 'string'
    && typeof value.sourceUrl === 'string'
    && (value.reportingPeriod === null || typeof value.reportingPeriod === 'string');

const isFinding = (value: unknown): value is ResearchFinding => isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.summary === 'string'
    && typeof value.target === 'string'
    && researchFindingTargets.includes(value.target as ResearchFinding['target'])
    && (value.tone === 'positive' || value.tone === 'risk' || value.tone === 'neutral')
    && Array.isArray(value.evidenceIds)
    && value.evidenceIds.every((id) => typeof id === 'string');

const isAssistedResearch = (value: unknown): value is AssistedResearch => isRecord(value)
    && typeof value.symbol === 'string'
    && (value.market === 'US' || value.market === 'MY')
    && typeof value.generatedAt === 'string'
    && (value.mode === 'ai' || value.mode === 'evidence')
    && Array.isArray(value.findings) && value.findings.every(isFinding)
    && Array.isArray(value.evidence) && value.evidence.every(isEvidence)
    && Array.isArray(value.warnings) && value.warnings.every((warning) => typeof warning === 'string');

export const parseResearchAssistantResponse = (payload: unknown): AssistedResearch => {
    if (!isRecord(payload) || payload.success !== true || !isAssistedResearch(payload.data)) {
        throw new ResearchAssistantInputError(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Unable to generate assisted research.');
    }
    const evidenceIds = new Set(payload.data.evidence.map((item) => item.id));
    if (payload.data.findings.some((finding) => finding.evidenceIds.length === 0 || finding.evidenceIds.some((id) => !evidenceIds.has(id)))) {
        throw new ResearchAssistantInputError('Assisted research contains unsupported findings.');
    }
    return payload.data;
};
