import { sql } from './db';
import { buildSignalIntradayPage } from './signal-intraday';
import type { SignalConfig } from './signal-config';

export async function listSignalIntradayCaptures(config: SignalConfig, day: string, limit: number, before: string | null) {
    const rows = await sql`
        SELECT id::text AS id, market_type, mode, enable_social, recorded_at, composite_score, tier, components, metadata_snapshot
        FROM signal_intraday_observations
        WHERE market_type = ${config.market} AND mode = ${config.mode} AND enable_social = ${config.enableSocial}
            AND snapshot_date = ${day}::date
            AND (${before}::bigint IS NULL OR id < ${before}::bigint)
        ORDER BY id DESC
        LIMIT ${limit + 1}
    `;
    return buildSignalIntradayPage(rows, config, day, limit, before);
}
