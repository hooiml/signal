import { sql } from '@/lib/db';

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
