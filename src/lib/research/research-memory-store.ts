import { sql } from '@/lib/db';
import {
    appendResearchMemorySnapshot,
    createResearchMemoryState,
    normalizeResearchMemoryTicker,
    type ResearchMemorySnapshot,
} from './research-memory';

const MAX_SNAPSHOTS_PER_TICKER = 24;

const ensureResearchMemoryTable = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_memory_snapshots (
            user_id VARCHAR(255) NOT NULL DEFAULT 'default',
            ticker VARCHAR(20) NOT NULL,
            snapshot_id VARCHAR(180) NOT NULL,
            observed_at TIMESTAMPTZ NOT NULL,
            payload JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, ticker, snapshot_id)
        )
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS research_memory_snapshots_ticker_observed_idx
        ON research_memory_snapshots (user_id, ticker, observed_at DESC)
    `;
};

const parseSnapshot = (value: unknown): ResearchMemorySnapshot => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('Invalid research-memory snapshot.');
    }
    const raw = value as Record<string, unknown>;
    if (typeof raw.id !== 'string' || typeof raw.ticker !== 'string' || typeof raw.observedAt !== 'string' || !Array.isArray(raw.evidence)) {
        throw new Error('Invalid research-memory snapshot.');
    }
    const state = appendResearchMemorySnapshot(createResearchMemoryState(raw.ticker), raw as ResearchMemorySnapshot);
    const snapshot = state.snapshots[0];
    if (!snapshot) throw new Error('Invalid research-memory snapshot.');
    return snapshot;
};

const readPayload = (row: unknown): ResearchMemorySnapshot => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) throw new Error('Invalid research-memory row.');
    return parseSnapshot((row as Record<string, unknown>).payload);
};

export const listStoredResearchMemorySnapshots = async (tickerInput: string): Promise<ResearchMemorySnapshot[]> => {
    await ensureResearchMemoryTable();
    const ticker = normalizeResearchMemoryTicker(tickerInput);
    const rows = await sql`
        SELECT payload
        FROM research_memory_snapshots
        WHERE user_id = 'default' AND ticker = ${ticker}
        ORDER BY observed_at ASC
        LIMIT ${MAX_SNAPSHOTS_PER_TICKER}
    `;
    return rows.map(readPayload);
};

export const saveStoredResearchMemorySnapshot = async (input: unknown): Promise<ResearchMemorySnapshot> => {
    await ensureResearchMemoryTable();
    const snapshot = parseSnapshot(input);
    await sql`
        INSERT INTO research_memory_snapshots (user_id, ticker, snapshot_id, observed_at, payload)
        VALUES ('default', ${snapshot.ticker}, ${snapshot.id}, ${snapshot.observedAt}, ${JSON.stringify(snapshot)})
        ON CONFLICT (user_id, ticker, snapshot_id) DO UPDATE SET
            observed_at = EXCLUDED.observed_at,
            payload = EXCLUDED.payload
    `;
    await sql`
        DELETE FROM research_memory_snapshots
        WHERE user_id = 'default' AND ticker = ${snapshot.ticker}
          AND snapshot_id IN (
              SELECT snapshot_id
              FROM research_memory_snapshots
              WHERE user_id = 'default' AND ticker = ${snapshot.ticker}
              ORDER BY observed_at DESC
              OFFSET ${MAX_SNAPSHOTS_PER_TICKER}
          )
    `;
    return snapshot;
};
