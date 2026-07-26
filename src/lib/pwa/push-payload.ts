import type { ResearchNotificationDigest } from '../research/notification-delivery';
import {
    parseResearchPushPayload,
    type ResearchPushPayload,
} from './push-contract';

export const buildResearchPushPayload = (
    digest: ResearchNotificationDigest,
    digestKey: string,
): ResearchPushPayload => {
    const action = digest.summary.action;
    const upcoming = digest.summary.upcoming;
    const parts = [
        action > 0 ? `${action} action` : '',
        upcoming > 0 ? `${upcoming} upcoming` : '',
    ].filter(Boolean);
    return parseResearchPushPayload({
        type: 'signal.research.push.v1',
        title: digest.summary.total === 1 ? '1 Signal research alert' : `${digest.summary.total} Signal research alerts`,
        body: `${parts.join(' · ') || `${digest.summary.total} item${digest.summary.total === 1 ? '' : 's'}`} ready for review. Open Signal for private details.`,
        tag: `signal-research-${digestKey.slice(0, 24)}`,
        path: '/research?workspace=alerts',
    });
};

export const researchPushPayloadContainsPrivateData = (
    payload: ResearchPushPayload,
    digest: ResearchNotificationDigest,
): boolean => {
    const serialized = JSON.stringify(payload).toLowerCase();
    return digest.items.some((item) => [
        item.symbol,
        item.title,
        item.detail,
    ].some((value) => value.length >= 4 && serialized.includes(value.toLowerCase())));
};
