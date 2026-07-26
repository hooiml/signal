export const researchPushLimits = {
    maxSubscriptionsPerUser: 5,
    maxEndpointLength: 2_048,
    maxBodyBytes: 8_192,
    maxPayloadBytes: 1_024,
    maxTitleLength: 80,
    maxNotificationBodyLength: 180,
    maxTagLength: 64,
    maxPathLength: 256,
    maxExpirationYears: 10,
    maxDeliveryAttempts: 5,
} as const;

export type ResearchPushSubscription = {
    readonly endpoint: string;
    readonly expirationTime: number | null;
    readonly keys: {
        readonly p256dh: string;
        readonly auth: string;
    };
};

export type ResearchPushPayload = {
    readonly type: 'signal.research.push.v1';
    readonly title: string;
    readonly body: string;
    readonly tag: string;
    readonly path: string;
};

export class ResearchPushInputError extends Error {
    readonly status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = 'ResearchPushInputError';
        this.status = status;
    }
}

const record = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : null;

const decodeBase64Url = (value: string): Uint8Array => {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new ResearchPushInputError('Push subscription key is invalid.');
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    try {
        return Uint8Array.from(Buffer.from(normalized, 'base64'));
    } catch {
        throw new ResearchPushInputError('Push subscription key is invalid.');
    }
};

export const isAllowedPushEndpoint = (value: string): boolean => {
    let endpoint: URL;
    try {
        endpoint = new URL(value);
    } catch {
        return false;
    }
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) return false;
    const host = endpoint.hostname.toLowerCase();
    return host === 'fcm.googleapis.com'
        || host === 'updates.push.services.mozilla.com'
        || host === 'updates-autopush.services.mozilla.com'
        || host === 'push.services.mozilla.com'
        || host === 'web.push.apple.com'
        || host.endsWith('.push.apple.com')
        || host === 'notify.windows.com'
        || host.endsWith('.notify.windows.com');
};

export const parseResearchPushSubscription = (value: unknown): ResearchPushSubscription => {
    const input = record(value);
    const keys = record(input?.keys);
    if (!input || typeof input.endpoint !== 'string' || input.endpoint.length < 16
        || input.endpoint.length > researchPushLimits.maxEndpointLength || !isAllowedPushEndpoint(input.endpoint)) {
        throw new ResearchPushInputError('Push subscription endpoint is not allowed.');
    }
    if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
        throw new ResearchPushInputError('Push subscription keys are missing.');
    }
    const p256dh = decodeBase64Url(keys.p256dh);
    const auth = decodeBase64Url(keys.auth);
    if (p256dh.byteLength !== 65 || p256dh[0] !== 4 || auth.byteLength !== 16) {
        throw new ResearchPushInputError('Push subscription keys are invalid.');
    }
    const expirationTime = input.expirationTime === null || input.expirationTime === undefined
        ? null
        : Number(input.expirationTime);
    const now = Date.now();
    const maximum = now + researchPushLimits.maxExpirationYears * 366 * 24 * 60 * 60 * 1_000;
    if (expirationTime !== null && (!Number.isFinite(expirationTime) || expirationTime <= now || expirationTime > maximum)) {
        throw new ResearchPushInputError('Push subscription expiration is invalid.');
    }
    return {
        endpoint: input.endpoint,
        expirationTime,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
    };
};

export const parseResearchPushRemoval = (value: unknown): { readonly endpoint: string } => {
    const input = record(value);
    if (!input || typeof input.endpoint !== 'string' || input.endpoint.length < 16
        || input.endpoint.length > researchPushLimits.maxEndpointLength || !isAllowedPushEndpoint(input.endpoint)) {
        throw new ResearchPushInputError('Push subscription endpoint is not allowed.');
    }
    return { endpoint: input.endpoint };
};

export const isSafePushPath = (value: string): boolean => {
    if (!value.startsWith('/') || value.startsWith('//') || value.length > researchPushLimits.maxPathLength) return false;
    try {
        const parsed = new URL(value, 'https://signal.invalid');
        return parsed.origin === 'https://signal.invalid' && !parsed.username && !parsed.password;
    } catch {
        return false;
    }
};

export const researchPushBackoffMinutes = (attemptCount: number): number => {
    const boundedAttempt = Math.max(1, Math.min(researchPushLimits.maxDeliveryAttempts, Math.trunc(attemptCount)));
    return Math.min(24 * 60, 5 * 2 ** (boundedAttempt - 1));
};

export const parseResearchPushPayload = (value: unknown): ResearchPushPayload => {
    const input = record(value);
    if (!input || input.type !== 'signal.research.push.v1'
        || typeof input.title !== 'string' || input.title.length < 1 || input.title.length > researchPushLimits.maxTitleLength
        || typeof input.body !== 'string' || input.body.length < 1 || input.body.length > researchPushLimits.maxNotificationBodyLength
        || typeof input.tag !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(input.tag)
        || typeof input.path !== 'string' || !isSafePushPath(input.path)) {
        throw new ResearchPushInputError('Push notification payload is invalid.');
    }
    return {
        type: 'signal.research.push.v1',
        title: input.title,
        body: input.body,
        tag: input.tag,
        path: input.path,
    };
};
