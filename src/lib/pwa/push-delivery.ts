import webPush from 'web-push';
import type { ResearchNotificationDigest } from '@/lib/research/notification-delivery';
import {
    claimResearchPushSubscriptions,
    deferResearchPushSubscription,
    disableResearchPushSubscription,
    markResearchPushAmbiguous,
    markResearchPushDelivered,
} from './push-store';
import {
    decryptResearchPushSubscription,
    readResearchPushConfiguration,
    type ResearchPushConfiguration,
} from './push-security';
import {
    researchPushLimits,
    type ResearchPushPayload,
    type ResearchPushSubscription,
} from './push-contract';
import { buildResearchPushPayload, researchPushPayloadContainsPrivateData } from './push-payload';
import {
    executeResearchPushPolicy,
    type ResearchPushDeliveryResult,
} from './push-delivery-policy';

export { buildResearchPushPayload, researchPushPayloadContainsPrivateData };
export type { ResearchPushDeliveryResult };

export const sendResearchPushNotification = async (input: {
    readonly subscription: ResearchPushSubscription;
    readonly payload: ResearchPushPayload;
    readonly digestKey: string;
    readonly configuration: ResearchPushConfiguration;
}): Promise<void> => {
    const body = JSON.stringify(input.payload);
    if (Buffer.byteLength(body, 'utf8') > researchPushLimits.maxPayloadBytes) {
        throw new Error('Web Push payload exceeded the configured bound.');
    }
    await webPush.sendNotification(input.subscription, body, {
        vapidDetails: {
            subject: input.configuration.subject,
            publicKey: input.configuration.publicKey,
            privateKey: input.configuration.privateKey,
        },
        TTL: 300,
        urgency: 'normal',
        topic: input.digestKey.slice(0, 32),
        timeout: 10_000,
        contentEncoding: 'aes128gcm',
    });
};

export const executeResearchPushDelivery = async (input: {
    readonly digest: ResearchNotificationDigest;
    readonly digestKey: string;
    readonly configuration?: ResearchPushConfiguration;
    readonly claim?: typeof claimResearchPushSubscriptions;
    readonly send?: typeof sendResearchPushNotification;
    readonly markDelivered?: typeof markResearchPushDelivered;
    readonly markAmbiguous?: typeof markResearchPushAmbiguous;
    readonly defer?: typeof deferResearchPushSubscription;
    readonly disable?: typeof disableResearchPushSubscription;
}): Promise<ResearchPushDeliveryResult> => {
    const configuration = input.configuration ?? readResearchPushConfiguration();
    const payload = buildResearchPushPayload(input.digest, input.digestKey);
    if (researchPushPayloadContainsPrivateData(payload, input.digest)) {
        throw new Error('Web Push payload privacy validation failed.');
    }
    const claimed = await (input.claim ?? claimResearchPushSubscriptions)(input.digestKey);
    return executeResearchPushPolicy({
        claimed,
        payload,
        digestKey: input.digestKey,
        decrypt: (stored) => decryptResearchPushSubscription(
            stored.ciphertext,
            stored.endpointHash,
            configuration,
        ),
        send: (subscription, pushPayload) => (input.send ?? sendResearchPushNotification)({
            subscription,
            payload: pushPayload,
            digestKey: input.digestKey,
            configuration,
        }),
        markDelivered: input.markDelivered ?? markResearchPushDelivered,
        markAmbiguous: input.markAmbiguous ?? markResearchPushAmbiguous,
        defer: input.defer ?? deferResearchPushSubscription,
        disable: input.disable ?? disableResearchPushSubscription,
    });
};
