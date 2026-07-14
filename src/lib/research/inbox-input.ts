import type { ResearchInboxItem, ResearchInboxResponse } from '../types/research-inbox';

const kinds = ['risk', 'opportunity', 'catalyst', 'stale'] as const;
const urgencies = ['action', 'upcoming'] as const;
const sources = ['Yahoo Finance', 'Nasdaq earnings calendar', 'Research journal'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isInboxItem = (value: unknown): value is ResearchInboxItem => {
    if (!isRecord(value)) return false;
    return typeof value.id === 'string' && typeof value.symbol === 'string'
        && kinds.some((kind) => kind === value.kind)
        && urgencies.some((urgency) => urgency === value.urgency)
        && typeof value.title === 'string' && typeof value.detail === 'string' && typeof value.proximity === 'string'
        && sources.some((source) => source === value.source)
        && (value.eventDate === null || typeof value.eventDate === 'string');
};

export const parseResearchInboxResponse = (payload: unknown): ResearchInboxResponse => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) throw new Error('Invalid research inbox response.');
    const data = payload.data;
    if (typeof data.generatedAt !== 'string' || typeof data.monitoredCount !== 'number'
        || !Array.isArray(data.items) || !data.items.every(isInboxItem)
        || !Array.isArray(data.warnings) || !data.warnings.every((warning) => typeof warning === 'string')) {
        throw new Error('Invalid research inbox data.');
    }
    return { generatedAt: data.generatedAt, monitoredCount: data.monitoredCount, items: data.items, warnings: data.warnings };
};
