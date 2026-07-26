import { createCipheriv, createDecipheriv, createECDH, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { authorizeResearchSyncBearer } from '../research/sync-vault';
import {
    parseResearchPushSubscription,
    ResearchPushInputError,
    type ResearchPushSubscription,
} from './push-contract';

export type ResearchPushConfiguration = {
    readonly publicKey: string;
    readonly privateKey: string;
    readonly subject: string;
    readonly encryptionKey: Buffer;
};

export class ResearchPushConfigurationError extends Error {
    constructor(message = 'Web Push is not configured on this server.') {
        super(message);
        this.name = 'ResearchPushConfigurationError';
    }
}

const decodeBase64Url = (value: string): Buffer => {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new ResearchPushConfigurationError();
    return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='), 'base64');
};

export const readResearchPushConfiguration = (
    environment: Readonly<Record<string, string | undefined>> = process.env,
): ResearchPushConfiguration => {
    const publicKey = environment.WEB_PUSH_VAPID_PUBLIC_KEY ?? '';
    const privateKey = environment.WEB_PUSH_VAPID_PRIVATE_KEY ?? '';
    const subject = environment.WEB_PUSH_VAPID_SUBJECT ?? '';
    const encryptionKey = environment.WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY ?? '';
    const bearerSecret = environment.RESEARCH_SYNC_BEARER_SECRET ?? '';
    const databaseUrl = environment.DATABASE_URL ?? '';
    const parsedSubject = (() => {
        try {
            return new URL(subject);
        } catch {
            return null;
        }
    })();
    const publicBytes = decodeBase64Url(publicKey);
    const privateBytes = decodeBase64Url(privateKey);
    const encryptedBytes = decodeBase64Url(encryptionKey);
    const validVapidPair = (() => {
        try {
            const ecdh = createECDH('prime256v1');
            ecdh.setPrivateKey(privateBytes);
            return timingSafeEqual(ecdh.getPublicKey(), publicBytes);
        } catch {
            return false;
        }
    })();
    const validSubject = parsedSubject
        && (parsedSubject.protocol === 'https:' && Boolean(parsedSubject.hostname)
            || parsedSubject.protocol === 'mailto:' && parsedSubject.pathname.includes('@'));
    if (publicBytes.byteLength !== 65 || publicBytes[0] !== 4 || privateBytes.byteLength !== 32
        || encryptedBytes.byteLength !== 32 || !validVapidPair || !validSubject
        || parsedSubject.username || parsedSubject.password
        || !/^[\x21-\x7e]{32,256}$/.test(bearerSecret) || databaseUrl.length < 1) {
        throw new ResearchPushConfigurationError();
    }
    return { publicKey, privateKey, subject, encryptionKey: encryptedBytes };
};

export const researchPushConfigured = (environment: Readonly<Record<string, string | undefined>> = process.env): boolean => {
    try {
        readResearchPushConfiguration(environment);
        return true;
    } catch {
        return false;
    }
};

export const authorizeResearchPushRequest = (request: Request): void => {
    authorizeResearchSyncBearer(request.headers.get('authorization'), process.env.RESEARCH_SYNC_BEARER_SECRET);
};

export const requireSameOriginMutation = (request: Request): void => {
    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');
    if (!origin || origin !== new URL(request.url).origin || fetchSite === 'cross-site') {
        throw new ResearchPushInputError('Cross-origin push subscription changes are not allowed.', 403);
    }
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'application/json') {
        throw new ResearchPushInputError('Push subscription changes require JSON.', 415);
    }
};

export const researchPushEndpointHash = (endpoint: string): string =>
    createHash('sha256').update(endpoint, 'utf8').digest('hex');

const encode = (value: Buffer): string => value.toString('base64url');

export const encryptResearchPushSubscription = (
    subscriptionValue: unknown,
    configuration: ResearchPushConfiguration,
    owner = 'default',
): { readonly endpointHash: string; readonly ciphertext: string; readonly expirationTime: string | null } => {
    const subscription = parseResearchPushSubscription(subscriptionValue);
    const endpointHash = researchPushEndpointHash(subscription.endpoint);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', configuration.encryptionKey, iv);
    cipher.setAAD(Buffer.from(`${owner}:${endpointHash}`, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(subscription), 'utf8'), cipher.final()]);
    return {
        endpointHash,
        ciphertext: ['v1', encode(iv), encode(cipher.getAuthTag()), encode(encrypted)].join('.'),
        expirationTime: subscription.expirationTime === null ? null : new Date(subscription.expirationTime).toISOString(),
    };
};

export const decryptResearchPushSubscription = (
    ciphertext: string,
    endpointHash: string,
    configuration: ResearchPushConfiguration,
    owner = 'default',
): ResearchPushSubscription => {
    const parts = ciphertext.split('.');
    if (parts.length !== 4 || parts[0] !== 'v1') throw new ResearchPushConfigurationError('Stored Web Push subscription is invalid.');
    try {
        const decipher = createDecipheriv('aes-256-gcm', configuration.encryptionKey, Buffer.from(parts[1], 'base64url'));
        decipher.setAAD(Buffer.from(`${owner}:${endpointHash}`, 'utf8'));
        decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(parts[3], 'base64url')),
            decipher.final(),
        ]).toString('utf8');
        const subscription = parseResearchPushSubscription(JSON.parse(plaintext));
        if (researchPushEndpointHash(subscription.endpoint) !== endpointHash) {
            throw new ResearchPushConfigurationError('Stored Web Push subscription is invalid.');
        }
        return subscription;
    } catch (error) {
        if (error instanceof ResearchPushConfigurationError) throw error;
        throw new ResearchPushConfigurationError('Stored Web Push subscription is invalid.');
    }
};
