import { sql } from '@/lib/db';
import { researchPushBackoffMinutes, researchPushLimits } from './push-contract';

export type StoredResearchPushSubscription = {
    readonly endpointHash: string;
    readonly ciphertext: string;
    readonly attemptCount: number;
};

const ensureResearchPushTables = async (): Promise<void> => {
    await sql`
        CREATE TABLE IF NOT EXISTS research_push_subscriptions (
            user_id TEXT NOT NULL DEFAULT 'default',
            endpoint_hash CHAR(64) NOT NULL,
            encrypted_subscription TEXT,
            expiration_at TIMESTAMPTZ,
            disabled_at TIMESTAMPTZ,
            disabled_reason TEXT,
            last_digest_key CHAR(64),
            delivered_digest_key CHAR(64),
            last_delivery_outcome TEXT CHECK (last_delivery_outcome IN ('delivered', 'ambiguous')),
            attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5),
            next_attempt_at TIMESTAMPTZ,
            claimed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (user_id, endpoint_hash)
        )
    `;
    await sql`
        CREATE INDEX IF NOT EXISTS research_push_subscriptions_active_idx
        ON research_push_subscriptions (user_id, updated_at DESC)
        WHERE disabled_at IS NULL
    `;
    await sql`ALTER TABLE research_push_subscriptions ADD COLUMN IF NOT EXISTS last_delivery_outcome TEXT`;
};

const validHash = (value: string): void => {
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid Web Push subscription identifier.');
};

const expireResearchPushSubscriptions = async (): Promise<void> => {
    await sql`
        UPDATE research_push_subscriptions
        SET encrypted_subscription = NULL, disabled_at = NOW(), disabled_reason = 'expired',
            next_attempt_at = NULL, claimed_at = NULL, updated_at = NOW()
        WHERE disabled_at IS NULL AND expiration_at IS NOT NULL AND expiration_at <= NOW()
    `;
};

export const countActiveResearchPushSubscriptions = async (): Promise<number> => {
    await ensureResearchPushTables();
    await expireResearchPushSubscriptions();
    const rows = await sql`
        SELECT COUNT(*)::INTEGER AS count
        FROM research_push_subscriptions
        WHERE user_id = 'default' AND disabled_at IS NULL
            AND (expiration_at IS NULL OR expiration_at > NOW())
    `;
    return Number(rows[0]?.count ?? 0);
};

export const upsertResearchPushSubscription = async (input: {
    readonly endpointHash: string;
    readonly ciphertext: string;
    readonly expirationTime: string | null;
}): Promise<boolean> => {
    validHash(input.endpointHash);
    if (input.ciphertext.length < 32 || input.ciphertext.length > 8_192) throw new Error('Invalid encrypted Web Push subscription.');
    await ensureResearchPushTables();
    await expireResearchPushSubscriptions();
    const rows = await sql`
        WITH subscription_lock AS MATERIALIZED (
            SELECT pg_advisory_xact_lock(hashtext('signal-research-push-default'))
        )
        INSERT INTO research_push_subscriptions (
            user_id, endpoint_hash, encrypted_subscription, expiration_at
        )
        SELECT 'default', ${input.endpointHash}, ${input.ciphertext}, ${input.expirationTime}
        FROM subscription_lock
        WHERE EXISTS (
            SELECT 1 FROM research_push_subscriptions
            WHERE user_id = 'default' AND endpoint_hash = ${input.endpointHash}
        ) OR (
            SELECT COUNT(*) FROM research_push_subscriptions
            WHERE user_id = 'default' AND disabled_at IS NULL
                AND (expiration_at IS NULL OR expiration_at > NOW())
        ) < ${researchPushLimits.maxSubscriptionsPerUser}
        ON CONFLICT (user_id, endpoint_hash) DO UPDATE SET
            encrypted_subscription = EXCLUDED.encrypted_subscription,
            expiration_at = EXCLUDED.expiration_at,
            disabled_at = NULL,
            disabled_reason = NULL,
            attempt_count = 0,
            next_attempt_at = NULL,
            claimed_at = NULL,
            updated_at = NOW()
        RETURNING endpoint_hash
    `;
    return rows.length === 1;
};

export const removeResearchPushSubscription = async (endpointHash: string): Promise<void> => {
    validHash(endpointHash);
    await ensureResearchPushTables();
    await expireResearchPushSubscriptions();
    await sql`
        DELETE FROM research_push_subscriptions
        WHERE user_id = 'default' AND endpoint_hash = ${endpointHash}
    `;
};

export const claimResearchPushSubscriptions = async (
    digestKey: string,
    limit = researchPushLimits.maxSubscriptionsPerUser,
): Promise<readonly StoredResearchPushSubscription[]> => {
    validHash(digestKey);
    if (!Number.isInteger(limit) || limit < 1 || limit > researchPushLimits.maxSubscriptionsPerUser) {
        throw new Error('Invalid Web Push claim limit.');
    }
    await ensureResearchPushTables();
    await expireResearchPushSubscriptions();
    const candidates = await sql`
        SELECT endpoint_hash
        FROM research_push_subscriptions
        WHERE user_id = 'default' AND disabled_at IS NULL
            AND encrypted_subscription IS NOT NULL
            AND (expiration_at IS NULL OR expiration_at > NOW())
            AND delivered_digest_key IS DISTINCT FROM ${digestKey}
            AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '15 minutes')
            AND (
                last_digest_key IS DISTINCT FROM ${digestKey}
                OR next_attempt_at IS NULL
                OR next_attempt_at <= NOW()
            )
        ORDER BY updated_at ASC
        LIMIT ${limit}
    `;
    const claimed: StoredResearchPushSubscription[] = [];
    for (const candidate of candidates) {
        if (typeof candidate.endpoint_hash !== 'string') continue;
        const rows = await sql`
            UPDATE research_push_subscriptions
            SET
                last_digest_key = ${digestKey},
                attempt_count = CASE
                    WHEN last_digest_key = ${digestKey} THEN LEAST(attempt_count + 1, ${researchPushLimits.maxDeliveryAttempts})
                    ELSE 1
                END,
                next_attempt_at = NULL,
                last_delivery_outcome = NULL,
                claimed_at = NOW(),
                updated_at = NOW()
            WHERE user_id = 'default' AND endpoint_hash = ${candidate.endpoint_hash}
                AND disabled_at IS NULL
                AND encrypted_subscription IS NOT NULL
                AND (expiration_at IS NULL OR expiration_at > NOW())
                AND delivered_digest_key IS DISTINCT FROM ${digestKey}
                AND (claimed_at IS NULL OR claimed_at < NOW() - INTERVAL '15 minutes')
                AND (
                    last_digest_key IS DISTINCT FROM ${digestKey}
                    OR next_attempt_at IS NULL
                    OR next_attempt_at <= NOW()
                )
            RETURNING endpoint_hash, encrypted_subscription, attempt_count
        `;
        const row = rows[0];
        if (typeof row?.endpoint_hash === 'string' && typeof row.encrypted_subscription === 'string'
            && typeof row.attempt_count === 'number') {
            claimed.push({
                endpointHash: row.endpoint_hash,
                ciphertext: row.encrypted_subscription,
                attemptCount: row.attempt_count,
            });
        }
    }
    return claimed;
};

export const markResearchPushDelivered = async (endpointHash: string, digestKey: string): Promise<void> => {
    validHash(endpointHash);
    validHash(digestKey);
    const rows = await sql`
        UPDATE research_push_subscriptions
        SET delivered_digest_key = ${digestKey}, attempt_count = 0,
            last_delivery_outcome = 'delivered',
            next_attempt_at = NULL, claimed_at = NULL, updated_at = NOW()
        WHERE user_id = 'default' AND endpoint_hash = ${endpointHash}
            AND last_digest_key = ${digestKey}
        RETURNING endpoint_hash
    `;
    if (rows.length !== 1) throw new Error('Web Push delivery acknowledgement was not recorded.');
};

export const markResearchPushAmbiguous = async (endpointHash: string, digestKey: string): Promise<void> => {
    validHash(endpointHash);
    validHash(digestKey);
    const rows = await sql`
        UPDATE research_push_subscriptions
        SET delivered_digest_key = ${digestKey}, attempt_count = 0,
            last_delivery_outcome = 'ambiguous',
            next_attempt_at = NULL, claimed_at = NULL, updated_at = NOW()
        WHERE user_id = 'default' AND endpoint_hash = ${endpointHash}
            AND last_digest_key = ${digestKey}
        RETURNING endpoint_hash
    `;
    if (rows.length !== 1) throw new Error('Ambiguous Web Push delivery was not recorded.');
};

export const deferResearchPushSubscription = async (
    endpointHash: string,
    digestKey: string,
    attemptCount: number,
): Promise<void> => {
    validHash(endpointHash);
    validHash(digestKey);
    const backoffMinutes = researchPushBackoffMinutes(attemptCount);
    const nextAttempt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
    await sql`
        UPDATE research_push_subscriptions
        SET next_attempt_at = ${nextAttempt}, claimed_at = NULL, updated_at = NOW()
        WHERE user_id = 'default' AND endpoint_hash = ${endpointHash}
            AND last_digest_key = ${digestKey}
    `;
};

export const disableResearchPushSubscription = async (
    endpointHash: string,
    reason: 'gone' | 'expired' | 'invalid',
): Promise<void> => {
    validHash(endpointHash);
    await sql`
        UPDATE research_push_subscriptions
        SET encrypted_subscription = NULL, disabled_at = NOW(), disabled_reason = ${reason},
            next_attempt_at = NULL, claimed_at = NULL, updated_at = NOW()
        WHERE user_id = 'default' AND endpoint_hash = ${endpointHash}
    `;
};
