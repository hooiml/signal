import { researchPushLimits, type ResearchPushPayload, type ResearchPushSubscription } from './push-contract';

export type ClaimedResearchPushSubscription = {
    readonly endpointHash: string;
    readonly ciphertext: string;
    readonly attemptCount: number;
};

export type ResearchPushDeliveryResult = {
    readonly delivered: number;
    readonly deferred: number;
    readonly disabled: number;
    readonly ambiguous: number;
};

type PushServiceError = Error & { readonly statusCode?: number };

const statusCode = (error: unknown): number | null => {
    const value = error as PushServiceError;
    return Number.isInteger(value?.statusCode) ? Number(value.statusCode) : null;
};

export const executeResearchPushPolicy = async (input: {
    readonly claimed: readonly ClaimedResearchPushSubscription[];
    readonly payload: ResearchPushPayload;
    readonly digestKey: string;
    readonly decrypt: (claimed: ClaimedResearchPushSubscription) => ResearchPushSubscription;
    readonly send: (subscription: ResearchPushSubscription, payload: ResearchPushPayload) => Promise<void>;
    readonly markDelivered: (endpointHash: string, digestKey: string) => Promise<void>;
    readonly markAmbiguous: (endpointHash: string, digestKey: string) => Promise<void>;
    readonly defer: (endpointHash: string, digestKey: string, attemptCount: number) => Promise<void>;
    readonly disable: (endpointHash: string, reason: 'gone' | 'invalid') => Promise<void>;
}): Promise<ResearchPushDeliveryResult> => {
    const result = { delivered: 0, deferred: 0, disabled: 0, ambiguous: 0 };
    for (const stored of input.claimed) {
        let subscription: ResearchPushSubscription;
        try {
            subscription = input.decrypt(stored);
        } catch {
            await input.disable(stored.endpointHash, 'invalid');
            result.disabled += 1;
            continue;
        }
        try {
            await input.send(subscription, input.payload);
        } catch (error) {
            const code = statusCode(error);
            if (code === 404 || code === 410) {
                await input.disable(stored.endpointHash, 'gone');
                result.disabled += 1;
            } else if (stored.attemptCount >= researchPushLimits.maxDeliveryAttempts) {
                await input.disable(stored.endpointHash, 'invalid');
                result.disabled += 1;
            } else {
                await input.defer(stored.endpointHash, input.digestKey, stored.attemptCount);
                result.deferred += 1;
            }
            continue;
        }
        try {
            await input.markDelivered(stored.endpointHash, input.digestKey);
            result.delivered += 1;
        } catch {
            await input.markAmbiguous(stored.endpointHash, input.digestKey);
            result.ambiguous += 1;
        }
    }
    return result;
};
