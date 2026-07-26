import { createHash, timingSafeEqual } from 'node:crypto';
import { ResearchBackupError, validateEncryptedResearchBackup } from './backup';

export const researchSyncLimits = {
    minBearerLength: 32,
    maxBearerLength: 256,
    maxRevision: 2_147_483_647,
} as const;

export class ResearchSyncError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'ResearchSyncError';
        this.status = status;
    }
}

const digest = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

export const authorizeResearchSyncBearer = (
    authorization: string | null,
    configuredSecret: string | undefined,
): true => {
    if (!configuredSecret || configuredSecret.length < researchSyncLimits.minBearerLength || configuredSecret.length > researchSyncLimits.maxBearerLength) {
        throw new ResearchSyncError('Private sync is not configured on this server.', 503);
    }
    const match = authorization?.match(/^Bearer ([\x21-\x7e]+)$/);
    const candidate = match?.[1] ?? '';
    const allowedLength = candidate.length >= researchSyncLimits.minBearerLength && candidate.length <= researchSyncLimits.maxBearerLength;
    const authorized = timingSafeEqual(digest(candidate), digest(configuredSecret));
    if (!allowedLength || !authorized) throw new ResearchSyncError('Private sync authorization failed.', 401);
    return true;
};

export const parseResearchSyncWriteRequest = (value: unknown): {
    readonly envelope: string;
    readonly expectedRevision: number;
} => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ResearchSyncError('Private sync request must be an object.', 400);
    }
    const body = Object.fromEntries(Object.entries(value));
    if (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 0 || Number(body.expectedRevision) > researchSyncLimits.maxRevision) {
        throw new ResearchSyncError('Private sync expected revision is invalid.', 400);
    }
    if (typeof body.envelope !== 'string') throw new ResearchSyncError('Private sync ciphertext is missing.', 400);
    try {
        return {
            envelope: validateEncryptedResearchBackup(body.envelope),
            expectedRevision: Number(body.expectedRevision),
        };
    } catch (error) {
        if (error instanceof ResearchBackupError) throw new ResearchSyncError(error.message, 400);
        throw error;
    }
};
