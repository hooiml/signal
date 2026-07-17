import { createHash, createHmac } from 'node:crypto';
import type { ResearchInboxItem, ResearchInboxResponse } from '../types/research-inbox';

export type ResearchNotificationDigest = {
    readonly type: 'signal.research.digest.v1';
    readonly generatedAt: string;
    readonly dashboardUrl: string;
    readonly summary: {
        readonly total: number;
        readonly totalAvailable: number;
        readonly omitted: number;
        readonly action: number;
        readonly upcoming: number;
        readonly tickerCount: number;
    };
    readonly items: readonly ResearchInboxItem[];
    readonly warnings: readonly string[];
};

export const validateNotificationEndpoint = (value: string): URL => {
    let endpoint: URL;
    try {
        endpoint = new URL(value);
    } catch {
        throw new Error('RESEARCH_NOTIFICATION_WEBHOOK_URL must be a valid HTTPS URL.');
    }
    if (endpoint.protocol !== 'https:') throw new Error('RESEARCH_NOTIFICATION_WEBHOOK_URL must use HTTPS.');
    if (endpoint.username || endpoint.password) throw new Error('RESEARCH_NOTIFICATION_WEBHOOK_URL must not contain credentials.');
    return endpoint;
};

export const buildResearchNotificationDigest = (
    inbox: ResearchInboxResponse,
    dashboardUrl: string,
): ResearchNotificationDigest => {
    const urgencyPriority = { action: 0, upcoming: 1 } as const;
    const kindPriority = { risk: 0, opportunity: 1, stale: 2, catalyst: 3 } as const;
    const prioritized = [...inbox.items].sort((left, right) =>
        urgencyPriority[left.urgency] - urgencyPriority[right.urgency]
        || kindPriority[left.kind] - kindPriority[right.kind]
        || left.symbol.localeCompare(right.symbol));
    const items = prioritized.slice(0, 20);
    return {
        type: 'signal.research.digest.v1',
        generatedAt: inbox.generatedAt,
        dashboardUrl,
        summary: {
            total: items.length,
            totalAvailable: inbox.items.length,
            omitted: Math.max(0, inbox.items.length - items.length),
            action: items.filter((item) => item.urgency === 'action').length,
            upcoming: items.filter((item) => item.urgency === 'upcoming').length,
            tickerCount: new Set(items.map((item) => item.symbol)).size,
        },
        items,
        warnings: inbox.warnings,
    };
};

export const researchNotificationDigestKey = (digest: ResearchNotificationDigest): string => {
    const conditions = digest.items
        .map((item) => [item.id, item.kind, item.urgency, item.proximity, item.detail, item.eventDate].join('|'))
        .sort();
    return createHash('sha256').update(JSON.stringify([digest.generatedAt.slice(0, 10), conditions])).digest('hex');
};

export const signResearchNotification = (body: string, secret: string): string =>
    'sha256=' + createHmac('sha256', secret).update(body).digest('hex');

export const deliverResearchNotification = async (input: {
    readonly endpoint: string;
    readonly secret: string;
    readonly digest: ResearchNotificationDigest;
    readonly digestKey?: string;
    readonly fetcher?: typeof fetch;
}): Promise<void> => {
    const endpoint = validateNotificationEndpoint(input.endpoint);
    if (input.secret.length < 16) throw new Error('RESEARCH_NOTIFICATION_WEBHOOK_SECRET must contain at least 16 characters.');
    const body = JSON.stringify(input.digest);
    const digestKey = input.digestKey ?? researchNotificationDigestKey(input.digest);
    const response = await (input.fetcher ?? fetch)(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Signal-Research-Notifier/1.0',
            'X-Signal-Event': input.digest.type,
            'X-Signal-Delivery-ID': digestKey,
            'Idempotency-Key': digestKey,
            'X-Signal-Signature': signResearchNotification(body, input.secret),
        },
        body,
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
    });
    if (!response.ok) throw new Error(`Research notification endpoint returned HTTP ${response.status}.`);
};

export const executeResearchNotificationDelivery = async (input: {
    readonly digest: ResearchNotificationDigest;
    readonly digestKey: string;
    readonly reserve: (digestKey: string, itemCount: number) => Promise<boolean>;
    readonly deliver: () => Promise<void>;
    readonly markDelivered: (digestKey: string) => Promise<void>;
    readonly release: (digestKey: string) => Promise<void>;
}): Promise<'delivered' | 'duplicate'> => {
    if (!await input.reserve(input.digestKey, input.digest.items.length)) return 'duplicate';
    try {
        await input.deliver();
        await input.markDelivered(input.digestKey);
        return 'delivered';
    } catch (error) {
        await input.release(input.digestKey);
        throw error;
    }
};
