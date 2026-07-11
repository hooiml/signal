import { sql } from '@/lib/db';
import type { DiscoveryHistorySnapshot, StoredDiscoveryCandidate } from './discovery-history';
import type { QualityDiscoveryResult } from '../types/research-discovery';

const ensureTable = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS discovery_snapshots (
            snapshot_hour TIMESTAMPTZ PRIMARY KEY,
            generated_at TIMESTAMPTZ NOT NULL,
            candidates JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_discovery_snapshots_generated ON discovery_snapshots(generated_at DESC)`;
};

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const parseCandidate = (value: unknown): StoredDiscoveryCandidate | null => {
    const row = objectValue(value);
    return row && typeof row.symbol === 'string' && typeof row.rank === 'number'
        && typeof row.discoveryScore === 'number' && typeof row.price === 'number'
        ? { symbol: row.symbol, rank: row.rank, discoveryScore: row.discoveryScore, price: row.price }
        : null;
};

export const listDiscoverySnapshots = async (): Promise<readonly DiscoveryHistorySnapshot[]> => {
    await ensureTable();
    const rows = await sql`SELECT generated_at, candidates FROM discovery_snapshots WHERE generated_at >= NOW() - INTERVAL '35 days' ORDER BY generated_at DESC`;
    return rows.flatMap((value): DiscoveryHistorySnapshot[] => {
        const row = objectValue(value);
        const generated = row?.generated_at;
        const generatedAt = generated instanceof Date ? generated.toISOString() : typeof generated === 'string' ? new Date(generated).toISOString() : null;
        if (!generatedAt || !Array.isArray(row?.candidates)) return [];
        return [{ generatedAt, candidates: row.candidates.flatMap((candidate) => {
            const parsed = parseCandidate(candidate);
            return parsed ? [parsed] : [];
        }) }];
    });
};

export const saveDiscoverySnapshot = async (generatedAt: string, candidates: readonly QualityDiscoveryResult[]) => {
    const snapshotHour = new Date(generatedAt);
    snapshotHour.setUTCMinutes(0, 0, 0);
    const stored = candidates.map((candidate, index): StoredDiscoveryCandidate => ({
        symbol: candidate.symbol,
        rank: index + 1,
        discoveryScore: candidate.discoveryScore,
        price: candidate.price,
    }));
    await ensureTable();
    await sql`
        INSERT INTO discovery_snapshots (snapshot_hour, generated_at, candidates)
        VALUES (${snapshotHour.toISOString()}, ${generatedAt}, ${JSON.stringify(stored)})
        ON CONFLICT (snapshot_hour) DO UPDATE SET generated_at = EXCLUDED.generated_at, candidates = EXCLUDED.candidates
    `;
    await sql`DELETE FROM discovery_snapshots WHERE generated_at < NOW() - INTERVAL '90 days'`;
};
