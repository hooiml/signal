import { sql } from '@/lib/db';

export type ResearchSyncVaultSnapshot = {
    readonly envelope: string | null;
    readonly revision: number;
    readonly updatedAt: string | null;
};

const ensureResearchSyncVault = async (): Promise<void> => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_sync_vault (
            user_id TEXT PRIMARY KEY,
            envelope TEXT NOT NULL,
            revision INTEGER NOT NULL CHECK (revision > 0),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;
};

const snapshot = (value: unknown): ResearchSyncVaultSnapshot | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const row = Object.fromEntries(Object.entries(value));
    const revision = Number(row.revision);
    const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at;
    if (typeof row.envelope !== 'string' || !Number.isInteger(revision) || revision < 1 || typeof updatedAt !== 'string') return null;
    return { envelope: row.envelope, revision, updatedAt };
};

export const getResearchSyncVault = async (): Promise<ResearchSyncVaultSnapshot> => {
    await ensureResearchSyncVault();
    const rows = await sql`
        SELECT envelope, revision, updated_at
        FROM research_sync_vault
        WHERE user_id = 'default'
        LIMIT 1
    `;
    return snapshot(rows[0]) ?? { envelope: null, revision: 0, updatedAt: null };
};

export const writeResearchSyncVault = async (
    envelope: string,
    expectedRevision: number,
): Promise<ResearchSyncVaultSnapshot | null> => {
    await ensureResearchSyncVault();
    const rows = await sql`
        INSERT INTO research_sync_vault (user_id, envelope, revision)
        SELECT 'default', ${envelope}, 1
        WHERE ${expectedRevision} = 0
        ON CONFLICT (user_id) DO UPDATE SET
            envelope = EXCLUDED.envelope,
            revision = research_sync_vault.revision + 1,
            updated_at = NOW()
        WHERE research_sync_vault.revision = ${expectedRevision}
        RETURNING envelope, revision, updated_at
    `;
    return snapshot(rows[0]);
};
