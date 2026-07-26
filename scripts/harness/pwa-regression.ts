import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    isAllowedPushEndpoint,
    isSafePushPath,
    parseResearchPushPayload,
    parseResearchPushSubscription,
    researchPushBackoffMinutes,
    ResearchPushInputError,
    type ResearchPushSubscription,
} from '../../src/lib/pwa/push-contract';
import {
    decryptResearchPushSubscription,
    encryptResearchPushSubscription,
    readResearchPushConfiguration,
    requireSameOriginMutation,
    researchPushEndpointHash,
    ResearchPushConfigurationError,
} from '../../src/lib/pwa/push-security';
import { buildResearchPushPayload, researchPushPayloadContainsPrivateData } from '../../src/lib/pwa/push-payload';
import { executeResearchPushPolicy } from '../../src/lib/pwa/push-delivery-policy';
import type { ResearchNotificationDigest } from '../../src/lib/research/notification-delivery';

const main = async (): Promise<void> => {
const base64url = (bytes: readonly number[]): string => Buffer.from(bytes).toString('base64url');
const vapid = createECDH('prime256v1');
vapid.setPrivateKey(Buffer.from(Array.from({ length: 32 }, (_, index) => index + 71)));
const p256dh = vapid.getPublicKey().toString('base64url');
const auth = base64url(Array.from({ length: 16 }, (_, index) => index + 11));
const encryptionKey = base64url(Array.from({ length: 32 }, (_, index) => index + 31));
const privateKey = vapid.getPrivateKey().toString('base64url');
const bearer = 'test-only-bearer-value-32-characters-minimum';
const configuration = readResearchPushConfiguration({
    DATABASE_URL: 'postgresql://test.invalid/signal',
    RESEARCH_SYNC_BEARER_SECRET: bearer,
    WEB_PUSH_VAPID_PUBLIC_KEY: p256dh,
    WEB_PUSH_VAPID_PRIVATE_KEY: privateKey,
    WEB_PUSH_VAPID_SUBJECT: 'mailto:operator@example.com',
    WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY: encryptionKey,
});
const subscription: ResearchPushSubscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-capability',
    expirationTime: null,
    keys: { p256dh, auth },
};

assert.deepEqual(parseResearchPushSubscription(subscription), subscription);
for (const endpoint of [
    'https://fcm.googleapis.com/fcm/send/x',
    'https://updates.push.services.mozilla.com/wpush/v2/x',
    'https://web.push.apple.com/QP/x',
    'https://wns2-db5p.notify.windows.com/w/?token=x',
]) assert.equal(isAllowedPushEndpoint(endpoint), true, endpoint);
for (const endpoint of [
    'http://fcm.googleapis.com/fcm/send/x',
    'https://example.com/push/x',
    'https://user:secret@fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com/fcm/send/x#secret',
]) assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
assert.throws(() => parseResearchPushSubscription({ ...subscription, endpoint: 'https://example.com/push' }), ResearchPushInputError);
assert.throws(() => parseResearchPushSubscription({ ...subscription, keys: { ...subscription.keys, auth: 'short' } }), ResearchPushInputError);
assert.equal(isSafePushPath('/research?workspace=alerts'), true);
assert.equal(isSafePushPath('//attacker.example/path'), false);
assert.equal(isSafePushPath('https://attacker.example/path'), false);
assert.deepEqual([1, 2, 3, 4, 5].map(researchPushBackoffMinutes), [5, 10, 20, 40, 80]);

const encrypted = encryptResearchPushSubscription(subscription, configuration);
assert.equal(encrypted.endpointHash, researchPushEndpointHash(subscription.endpoint));
assert.equal(encrypted.ciphertext.includes(subscription.endpoint), false);
assert.deepEqual(decryptResearchPushSubscription(encrypted.ciphertext, encrypted.endpointHash, configuration), subscription);
assert.throws(
    () => decryptResearchPushSubscription(encrypted.ciphertext, '0'.repeat(64), configuration),
    ResearchPushConfigurationError,
);
assert.throws(() => readResearchPushConfiguration({}), ResearchPushConfigurationError);
assert.throws(() => readResearchPushConfiguration({
    DATABASE_URL: 'postgresql://test.invalid/signal',
    RESEARCH_SYNC_BEARER_SECRET: bearer,
    WEB_PUSH_VAPID_PUBLIC_KEY: p256dh,
    WEB_PUSH_VAPID_PRIVATE_KEY: privateKey,
    WEB_PUSH_VAPID_SUBJECT: 'https://user:password@example.com',
    WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY: encryptionKey,
}), ResearchPushConfigurationError);

requireSameOriginMutation(new Request('https://signal.example/api/research/push/subscriptions', {
    method: 'POST',
    headers: { Origin: 'https://signal.example', 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'same-origin' },
}));
assert.throws(() => requireSameOriginMutation(new Request('https://signal.example/api/research/push/subscriptions', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json', 'Sec-Fetch-Site': 'cross-site' },
})), ResearchPushInputError);

const digest: ResearchNotificationDigest = {
    type: 'signal.research.digest.v1',
    generatedAt: '2026-07-26T00:00:00.000Z',
    dashboardUrl: 'https://signal.example/research?workspace=alerts',
    summary: { total: 2, totalAvailable: 2, omitted: 0, action: 1, upcoming: 1, tickerCount: 2 },
    items: [
        {
            id: 'private-1',
            symbol: 'PRIVATESYMBOL',
            kind: 'risk',
            urgency: 'action',
            title: 'Private thesis title',
            detail: 'Private holdings and evidence detail',
            proximity: 'Now',
            source: 'Research journal',
            eventDate: null,
            structuredTriggerRuleId: null,
        },
    ],
    warnings: ['private provider warning'],
};
const digestKey = 'a'.repeat(64);
const payload = buildResearchPushPayload(digest, digestKey);
assert.deepEqual(payload, parseResearchPushPayload(payload));
assert.equal(payload.path, '/research?workspace=alerts');
assert.equal(researchPushPayloadContainsPrivateData(payload, digest), false);
const payloadText = JSON.stringify(payload);
for (const forbidden of ['PRIVATESYMBOL', 'Private thesis title', 'Private holdings', 'private provider warning', 'dashboardUrl']) {
    assert.equal(payloadText.includes(forbidden), false, forbidden);
}

const policyCalls: string[] = [];
const claimed = [
    { endpointHash: '1'.repeat(64), ciphertext: 'one', attemptCount: 1 },
    { endpointHash: '2'.repeat(64), ciphertext: 'two', attemptCount: 2 },
    { endpointHash: '3'.repeat(64), ciphertext: 'three', attemptCount: 5 },
    { endpointHash: '4'.repeat(64), ciphertext: 'four', attemptCount: 2 },
];
const result = await executeResearchPushPolicy({
    claimed,
    payload,
    digestKey,
    decrypt: () => subscription,
    send: async () => {
        const current = policyCalls.filter((entry) => entry.startsWith('send')).length;
        policyCalls.push(`send:${current}`);
        if (current === 1) throw Object.assign(new Error('gone without endpoint disclosure'), { statusCode: 410 });
        if (current >= 2) throw new Error('retryable without endpoint disclosure');
    },
    markDelivered: async (hash) => { policyCalls.push(`delivered:${hash}`); },
    markAmbiguous: async (hash) => { policyCalls.push(`ambiguous:${hash}`); },
    defer: async (hash) => { policyCalls.push(`deferred:${hash}`); },
    disable: async (hash, reason) => { policyCalls.push(`disabled:${hash}:${reason}`); },
});
assert.deepEqual(result, { delivered: 1, deferred: 1, disabled: 2, ambiguous: 0 });
assert.equal(policyCalls.some((entry) => entry === `disabled:${'2'.repeat(64)}:gone`), true);
assert.equal(policyCalls.some((entry) => entry === `disabled:${'3'.repeat(64)}:invalid`), true);
assert.equal(policyCalls.some((entry) => entry === `deferred:${'4'.repeat(64)}`), true);

const corruptedCalls: string[] = [];
assert.deepEqual(await executeResearchPushPolicy({
    claimed: [{ endpointHash: '5'.repeat(64), ciphertext: 'corrupted', attemptCount: 1 }],
    payload,
    digestKey,
    decrypt: () => { throw new Error('ciphertext rejected'); },
    send: async () => { corruptedCalls.push('send'); },
    markDelivered: async () => { corruptedCalls.push('delivered'); },
    markAmbiguous: async () => { corruptedCalls.push('ambiguous'); },
    defer: async () => { corruptedCalls.push('deferred'); },
    disable: async (_hash, reason) => { corruptedCalls.push(`disabled:${reason}`); },
}), { delivered: 0, deferred: 0, disabled: 1, ambiguous: 0 });
assert.deepEqual(corruptedCalls, ['disabled:invalid']);

const ambiguousCalls: string[] = [];
assert.deepEqual(await executeResearchPushPolicy({
    claimed: [{ endpointHash: '6'.repeat(64), ciphertext: 'valid', attemptCount: 1 }],
    payload,
    digestKey,
    decrypt: () => subscription,
    send: async () => { ambiguousCalls.push('sent'); },
    markDelivered: async () => { throw new Error('database acknowledgement unavailable'); },
    markAmbiguous: async (_hash, key) => { ambiguousCalls.push(`ambiguous:${key}`); },
    defer: async () => { ambiguousCalls.push('deferred'); },
    disable: async () => { ambiguousCalls.push('disabled'); },
}), { delivered: 0, deferred: 0, disabled: 0, ambiguous: 1 });
assert.deepEqual(ambiguousCalls, ['sent', `ambiguous:${digestKey}`]);

const repo = process.cwd();
const serviceWorker = readFileSync(join(repo, 'public/sw.js'), 'utf8');
const manifest = readFileSync(join(repo, 'src/app/manifest.ts'), 'utf8');
const lifecycle = readFileSync(join(repo, 'src/components/pwa/PwaLifecycle.tsx'), 'utf8');
const offlinePage = readFileSync(join(repo, 'src/app/offline/page.tsx'), 'utf8');
const pushUi = readFileSync(join(repo, 'src/components/pwa/ResearchWebPushV6.tsx'), 'utf8');
const route = readFileSync(join(repo, 'src/app/api/research/push/subscriptions/route.ts'), 'utf8');
const combined = `${serviceWorker}\n${manifest}\n${lifecycle}\n${pushUi}\n${route}`;

assert.match(serviceWorker, /const CACHE_NAME = 'signal-offline-v1'/);
assert.match(serviceWorker, /names[\s\S]+startsWith\(CACHE_PREFIX\)[\s\S]+caches\.delete/);
assert.match(serviceWorker, /request\.mode === 'navigate'[\s\S]+caches\.match\(OFFLINE_URL\)/);
assert.match(serviceWorker, /SENSITIVE_PATH_PREFIXES[\s\S]+'\/api\/'[\s\S]+'\/admin'[\s\S]+'\/research'/);
assert.doesNotMatch(serviceWorker.match(/const PRECACHE_URLS[\s\S]*?\]\);/)?.[0] ?? '', /\/api\/|\/research|\/admin|_next/);
assert.match(serviceWorker, /signal\.research\.push\.v1/);
assert.match(serviceWorker, /new URL\(path, self\.location\.origin\)/);
assert.match(serviceWorker, /clients\.matchAll[\s\S]+existing\.navigate[\s\S]+existing\.focus/);
assert.match(serviceWorker, /SIGNAL_APPLY_UPDATE/);
assert.match(lifecycle, /window\.confirm\([\s\S]+unsaved research/);
assert.match(offlinePage, /<a href="\/"[\s\S]+Retry Signal<\/a>/);
assert.equal((pushUi.match(/Notification\.requestPermission\(\)/g) ?? []).length, 1);
assert.match(pushUi, /const subscribe = async \(\)/);
assert.match(pushUi, /SIGNAL_TEST_NOTIFICATION/);
assert.match(route, /authorizeResearchPushRequest\(request\)/);
assert.match(route, /requireSameOriginMutation\(request\)/);
assert.doesNotMatch(pushUi, /localStorage.*accessToken|trackProductAnalyticsEvent/);
for (const forbidden of ['notes', 'accepted_evidence', 'holdings', 'cash', 'passphrase']) {
    assert.doesNotMatch(serviceWorker, new RegExp(forbidden, 'i'));
}
assert.doesNotMatch(combined, /console\.(log|warn|error)/);

console.log('PWA and Web Push regression checks passed.');
};

void main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
