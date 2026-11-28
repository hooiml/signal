import 'server-only';
import { parseMarketReportDate } from './market-observation-date';
import { isSignalConfig, type SignalConfig } from './signal-config';
import type { SignalTier } from './types/signal-v2';

export type SavedMarketPulsePoint = {
    readonly date: string;
    readonly score: number;
    readonly tier: SignalTier;
    readonly origin: 'observed' | 'reconstructed';
    readonly coverageNote: string | null;
};

export type SavedMarketPulse = {
    readonly config: Readonly<SignalConfig>;
    readonly snapshotDate: string;
    readonly savedAt: string;
    readonly score: number;
    readonly tier: SignalTier;
    readonly history: readonly SavedMarketPulsePoint[];
};

const tiers: ReadonlySet<unknown> = new Set<SignalTier>(['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell']);

function savedPoint(row: Record<string, unknown>): SavedMarketPulsePoint | null {
    const date = parseMarketReportDate(row.snapshot_date);
    const { composite_score: score, tier, origin } = row;
    if (!date || typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100
        || !tiers.has(tier) || (origin !== 'observed' && origin !== 'reconstructed')
        || (origin === 'observed' && row.has_evidence !== true)) return null;
    return { date, score, tier: tier as SignalTier, origin, coverageNote: typeof row.coverage_note === 'string' ? row.coverage_note : null };
}

/** Include all eight toolbar configurations so client-side changes can use the same archive read. */
export async function readSavedMarketPulses(): Promise<SavedMarketPulse[] | null> {
    if (!process.env.DATABASE_URL) return null;
    try {
        const { sql } = await import('./db');
        const rows = await sql.query(`
            WITH profiles AS (
                SELECT market_type, mode, enable_social
                FROM (VALUES ('US'), ('MY')) AS markets(market_type)
                CROSS JOIN (VALUES ('standard'), ('contrarian')) AS modes(mode)
                CROSS JOIN (VALUES (TRUE), (FALSE)) AS sources(enable_social)
            ), archive AS NOT MATERIALIZED (
                SELECT market_type, mode, enable_social, snapshot_date, composite_score, tier, origin, coverage_note, updated_at,
                    EXISTS (
                        SELECT 1
                        FROM jsonb_each(CASE WHEN jsonb_typeof(components) = 'object' THEN components ELSE '{}'::jsonb END)
                            AS component(indicator, reading)
                        WHERE CASE WHEN jsonb_typeof(reading->'weight') = 'number'
                            AND jsonb_typeof(reading->'score') = 'number'
                            AND jsonb_typeof(reading->'raw_value') = 'number'
                            THEN (reading->>'weight')::numeric > 0 AND (reading->>'weight')::numeric <= 1
                                AND (reading->>'score')::numeric BETWEEN 0 AND 100
                            ELSE FALSE END
                    ) AS has_evidence
                FROM signal_snapshots
            )
            SELECT s.market_type, s.mode, s.enable_social, s.snapshot_date::text AS snapshot_date,
                s.composite_score, s.tier, s.origin, s.coverage_note, s.has_evidence,
                CASE WHEN s.snapshot_date = latest.snapshot_date THEN s.updated_at END AS updated_at
            FROM profiles AS p
            CROSS JOIN LATERAL (
                SELECT snapshot_date
                FROM archive
                WHERE market_type = p.market_type AND mode = p.mode AND enable_social = p.enable_social
                    AND origin = 'observed' AND has_evidence
                    AND snapshot_date <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
                    AND updated_at BETWEEN (snapshot_date::timestamp AT TIME ZONE 'UTC') AND CURRENT_TIMESTAMP
                ORDER BY snapshot_date DESC
                LIMIT 1
            ) AS latest
            CROSS JOIN LATERAL (
                SELECT *
                FROM archive
                WHERE market_type = p.market_type AND mode = p.mode AND enable_social = p.enable_social
                    AND snapshot_date <= latest.snapshot_date
                    AND (origin = 'reconstructed' OR (origin = 'observed' AND has_evidence))
                ORDER BY snapshot_date DESC
                LIMIT 90
            ) AS s
            ORDER BY s.market_type, s.mode, s.enable_social, s.snapshot_date DESC
        `, [], { fetchOptions: { signal: AbortSignal.timeout(2_000) } });

        const profiles = new Map<string, SavedMarketPulse & { history: SavedMarketPulsePoint[] }>();
        for (const row of rows) {
            const config = { market: row.market_type, mode: row.mode, enableSocial: row.enable_social };
            if (!isSignalConfig(config)) continue;
            const point = savedPoint(row);
            if (!point) continue;

            const key = `${config.market}:${config.mode}:${config.enableSocial}`;
            const profile = profiles.get(key);
            if (profile) {
                if (point.date < profile.snapshotDate) profile.history.push(point);
                continue;
            }

            const updatedAt = row.updated_at;
            if (point.origin !== 'observed' || !(updatedAt instanceof Date) || !Number.isFinite(updatedAt.getTime())) continue;
            const savedAt = updatedAt.toISOString();
            if (savedAt.slice(0, 10) < point.date) continue;
            profiles.set(key, { config, snapshotDate: point.date, savedAt, score: point.score, tier: point.tier, history: [point] });
        }
        return Array.from(profiles.values(), profile => ({ ...profile, history: profile.history.reverse() }));
    } catch {
        console.warn('[Market Pulse] Could not read saved market snapshots.');
        return null;
    }
}
