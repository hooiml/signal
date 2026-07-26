/* Signal's service worker intentionally caches only the static offline shell below. */
const CACHE_PREFIX = 'signal-offline-';
const CACHE_NAME = 'signal-offline-v1';
const OFFLINE_URL = '/offline';
const PRECACHE_URLS = Object.freeze([
    OFFLINE_URL,
    '/manifest.webmanifest',
    '/icons/signal-192.svg',
    '/icons/signal-512.svg',
]);
const PRECACHE_PATHS = new Set(PRECACHE_URLS);
const SENSITIVE_PATH_PREFIXES = Object.freeze([
    '/api/',
    '/admin',
    '/research',
    '/backup',
]);

const isSafeStaticRequest = (request) => {
    if (request.method !== 'GET') return false;
    const url = new URL(request.url);
    return url.origin === self.location.origin && PRECACHE_PATHS.has(url.pathname);
};

const isSensitiveRequest = (request) => {
    const url = new URL(request.url);
    return url.origin !== self.location.origin
        || SENSITIVE_PATH_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix));
};

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (request.mode === 'navigate' && url.origin === self.location.origin) {
        event.respondWith(fetch(request).catch(async () => {
            const fallback = await caches.match(OFFLINE_URL);
            return fallback || Response.error();
        }));
        return;
    }
    if (isSensitiveRequest(request)) return;
    if (isSafeStaticRequest(request)) {
        event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    }
});

const boundedText = (value, maximum) =>
    typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : null;

const safePath = (value) => {
    const path = boundedText(value, 256);
    if (!path || !path.startsWith('/') || path.startsWith('//')) return null;
    try {
        const url = new URL(path, self.location.origin);
        return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
    } catch {
        return null;
    }
};

const parsePushPayload = (event) => {
    try {
        const input = event.data?.json();
        if (!input || input.type !== 'signal.research.push.v1') return null;
        const title = boundedText(input.title, 80);
        const body = boundedText(input.body, 180);
        const tag = boundedText(input.tag, 64);
        const path = safePath(input.path);
        if (!title || !body || !tag || !/^[A-Za-z0-9_-]+$/.test(tag) || !path) return null;
        return { title, body, tag, path };
    } catch {
        return null;
    }
};

self.addEventListener('push', (event) => {
    const payload = parsePushPayload(event);
    if (!payload) return;
    event.waitUntil(self.registration.showNotification(payload.title, {
        body: payload.body,
        tag: payload.tag,
        renotify: false,
        icon: '/icons/signal-192.svg',
        badge: '/icons/signal-192.svg',
        data: { path: payload.path },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const path = safePath(event.notification.data?.path) || '/research?workspace=alerts';
    const target = new URL(path, self.location.origin).href;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) {
            if ('navigate' in existing) await existing.navigate(target);
            return existing.focus();
        }
        return self.clients.openWindow(target);
    })());
});

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SIGNAL_APPLY_UPDATE') self.skipWaiting();
    if (event.data?.type === 'SIGNAL_TEST_NOTIFICATION') {
        event.waitUntil(self.registration.showNotification('Signal notification test', {
            body: 'Local delivery plumbing is ready. No external push service was contacted.',
            tag: 'signal-local-push-test',
            icon: '/icons/signal-192.svg',
            data: { path: '/research?workspace=alerts' },
        }));
    }
});
