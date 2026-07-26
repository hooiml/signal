import { sql } from '@/lib/db';
import {
    defaultResearchNotificationSettings,
    parseResearchNotificationSettings,
    type ResearchNotificationDeliveryHistory,
    type ResearchNotificationDeliveryStatus,
    type ResearchNotificationSettings,
} from '../types/research-notification-settings';

const ensureNotificationTable = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_notification_deliveries (
            digest_key CHAR(64) PRIMARY KEY,
            item_count INTEGER NOT NULL CHECK (item_count > 0),
            reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            delivered_at TIMESTAMPTZ
        )
    `;
    await sql`ALTER TABLE research_notification_deliveries ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ`;
};

const ensureNotificationCenterTables = async () => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_notification_preferences (
            user_id TEXT PRIMARY KEY,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            mode TEXT NOT NULL DEFAULT 'daily' CHECK (mode IN ('daily', 'urgent-only')),
            quiet_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            quiet_hours_start_utc INTEGER NOT NULL DEFAULT 22 CHECK (quiet_hours_start_utc BETWEEN 0 AND 23),
            quiet_hours_end_utc INTEGER NOT NULL DEFAULT 7 CHECK (quiet_hours_end_utc BETWEEN 0 AND 23),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;
    await sql`
        CREATE TABLE IF NOT EXISTS research_notification_history (
            id BIGSERIAL PRIMARY KEY,
            user_id TEXT NOT NULL DEFAULT 'default',
            digest_key CHAR(64) NOT NULL,
            item_count INTEGER NOT NULL CHECK (item_count >= 0),
            status TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'duplicate')),
            detail TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS research_notification_history_user_created_idx ON research_notification_history (user_id, created_at DESC)`;
};

const rowObject = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {};

export const getResearchNotificationSettings = async (): Promise<ResearchNotificationSettings> => {
    await ensureNotificationCenterTables();
    const rows = await sql`SELECT * FROM research_notification_preferences WHERE user_id = 'default' LIMIT 1`;
    if (!rows[0]) return defaultResearchNotificationSettings;
    const row = rowObject(rows[0]);
    return parseResearchNotificationSettings({
        enabled: row.enabled,
        mode: row.mode,
        quietHoursEnabled: row.quiet_hours_enabled,
        quietHoursStartUtc: row.quiet_hours_start_utc,
        quietHoursEndUtc: row.quiet_hours_end_utc,
    });
};

export const saveResearchNotificationSettings = async (
    value: unknown,
): Promise<ResearchNotificationSettings> => {
    const settings = parseResearchNotificationSettings(value);
    await ensureNotificationCenterTables();
    const rows = await sql`
        INSERT INTO research_notification_preferences (
            user_id, enabled, mode, quiet_hours_enabled, quiet_hours_start_utc, quiet_hours_end_utc
        ) VALUES (
            'default', ${settings.enabled}, ${settings.mode}, ${settings.quietHoursEnabled},
            ${settings.quietHoursStartUtc}, ${settings.quietHoursEndUtc}
        )
        ON CONFLICT (user_id) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            mode = EXCLUDED.mode,
            quiet_hours_enabled = EXCLUDED.quiet_hours_enabled,
            quiet_hours_start_utc = EXCLUDED.quiet_hours_start_utc,
            quiet_hours_end_utc = EXCLUDED.quiet_hours_end_utc,
            updated_at = NOW()
        RETURNING *
    `;
    const row = rowObject(rows[0]);
    return parseResearchNotificationSettings({
        enabled: row.enabled,
        mode: row.mode,
        quietHoursEnabled: row.quiet_hours_enabled,
        quietHoursStartUtc: row.quiet_hours_start_utc,
        quietHoursEndUtc: row.quiet_hours_end_utc,
    });
};

export const recordResearchNotificationDelivery = async (
    digestKey: string,
    itemCount: number,
    status: ResearchNotificationDeliveryStatus,
    detail: string | null = null,
): Promise<void> => {
    if (!/^[a-f0-9]{64}$/.test(digestKey)) throw new Error('Invalid research notification digest key.');
    if (!Number.isInteger(itemCount) || itemCount < 0 || itemCount > 20) throw new Error('Invalid research notification item count.');
    await ensureNotificationCenterTables();
    await sql`
        INSERT INTO research_notification_history (user_id, digest_key, item_count, status, detail)
        VALUES ('default', ${digestKey}, ${itemCount}, ${status}, ${detail?.slice(0, 500) ?? null})
    `;
    await sql`
        DELETE FROM research_notification_history
        WHERE user_id = 'default' AND id NOT IN (
            SELECT id FROM research_notification_history
            WHERE user_id = 'default'
            ORDER BY created_at DESC
            LIMIT 100
        )
    `;
};

export const listResearchNotificationHistory = async (
    limit = 20,
): Promise<readonly ResearchNotificationDeliveryHistory[]> => {
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid notification history limit.');
    await ensureNotificationCenterTables();
    const rows = await sql`
        SELECT digest_key, item_count, status, detail, created_at
        FROM research_notification_history
        WHERE user_id = 'default'
        ORDER BY created_at DESC
        LIMIT ${limit}
    `;
    return rows.flatMap((value) => {
        const row = rowObject(value);
        if (typeof row.digest_key !== 'string' || typeof row.item_count !== 'number'
            || (row.status !== 'delivered' && row.status !== 'failed' && row.status !== 'duplicate')
            || typeof row.created_at !== 'string' && !(row.created_at instanceof Date)) return [];
        return [{
            digestKey: row.digest_key,
            itemCount: row.item_count,
            status: row.status,
            detail: typeof row.detail === 'string' ? row.detail : null,
            createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        }];
    });
};

export const reserveResearchNotificationDigest = async (digestKey: string, itemCount: number): Promise<boolean> => {
    if (!/^[a-f0-9]{64}$/.test(digestKey)) throw new Error('Invalid research notification digest key.');
    if (!Number.isInteger(itemCount) || itemCount < 1 || itemCount > 20) throw new Error('Invalid research notification item count.');
    await ensureNotificationTable();
    await sql`DELETE FROM research_notification_deliveries WHERE reserved_at < NOW() - INTERVAL '90 days'`;
    const rows = await sql`
        INSERT INTO research_notification_deliveries (digest_key, item_count)
        VALUES (${digestKey}, ${itemCount})
        ON CONFLICT (digest_key) DO UPDATE SET
            item_count = EXCLUDED.item_count,
            reserved_at = NOW()
        WHERE research_notification_deliveries.delivered_at IS NULL
            AND research_notification_deliveries.reserved_at < NOW() - INTERVAL '15 minutes'
        RETURNING digest_key
    `;
    return rows.length === 1;
};

export const markResearchNotificationDigestDelivered = async (digestKey: string): Promise<void> => {
    if (!/^[a-f0-9]{64}$/.test(digestKey)) throw new Error('Invalid research notification digest key.');
    await sql`UPDATE research_notification_deliveries SET delivered_at = NOW() WHERE digest_key = ${digestKey}`;
};

export const releaseResearchNotificationDigest = async (digestKey: string): Promise<void> => {
    if (!/^[a-f0-9]{64}$/.test(digestKey)) return;
    await sql`DELETE FROM research_notification_deliveries WHERE digest_key = ${digestKey}`;
};
