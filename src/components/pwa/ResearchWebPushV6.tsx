'use client';

import { useEffect, useState } from 'react';
import { getThemeV6, type ResearchThemeV6 } from '@/components/v6/research-v6';

type PushServerState = {
    readonly publicKey: string;
    readonly subscribedCount: number;
    readonly maximumSubscriptions: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseServerState = async (response: Response): Promise<PushServerState> => {
    const payload: unknown = await response.json();
    if (!isRecord(payload)) throw new Error('Invalid Web Push response.');
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Web Push request failed.');
    if (!isRecord(payload.data) || payload.data.configured !== true
        || typeof payload.data.publicKey !== 'string'
        || typeof payload.data.subscribedCount !== 'number'
        || typeof payload.data.maximumSubscriptions !== 'number') {
        throw new Error('Invalid Web Push response.');
    }
    return {
        publicKey: payload.data.publicKey,
        subscribedCount: payload.data.subscribedCount,
        maximumSubscriptions: payload.data.maximumSubscriptions,
    };
};

const applicationServerKey = (value: string): Uint8Array<ArrayBuffer> => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const bytes = Uint8Array.from(window.atob(normalized), (character) => character.charCodeAt(0));
    if (bytes.byteLength !== 65 || bytes[0] !== 4) throw new Error('Server Web Push key is invalid.');
    return bytes;
};

const readyRegistration = async (): Promise<ServiceWorkerRegistration> => Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('Service worker did not become ready.')), 10_000)),
]);

export const ResearchWebPushV6 = ({ theme }: { readonly theme: ResearchThemeV6 }) => {
    const styles = getThemeV6(theme);
    const field = theme === 'light'
        ? 'border-slate-300 bg-white text-slate-950'
        : 'border-[#334354] bg-[#0b1118] text-[#eef2f7]';
    const supported = typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
    const [accessToken, setAccessToken] = useState('');
    const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
    const [server, setServer] = useState<PushServerState | null>(null);
    const [subscribed, setSubscribed] = useState(false);
    const [busy, setBusy] = useState<'check' | 'subscribe' | 'unsubscribe' | 'test' | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!supported) {
            setPermission('unsupported');
            return;
        }
        setPermission(Notification.permission);
        let active = true;
        void readyRegistration()
            .then((registration) => registration.pushManager.getSubscription())
            .then((subscription) => { if (active) setSubscribed(Boolean(subscription)); })
            .catch(() => { if (active) setError('Web Push service worker is unavailable.'); });
        return () => { active = false; };
    }, [supported]);

    const authorization = (): Record<string, string> => {
        if (accessToken.length < 32 || accessToken.length > 256) {
            throw new Error('Server access token must contain 32 to 256 characters.');
        }
        return { Authorization: `Bearer ${accessToken}` };
    };

    const begin = (operation: typeof busy) => {
        setBusy(operation);
        setMessage(null);
        setError(null);
    };

    const check = async () => {
        begin('check');
        try {
            const state = await parseServerState(await fetch('/api/research/push/subscriptions', {
                headers: authorization(),
                cache: 'no-store',
            }));
            setServer(state);
            setMessage(`Secure Web Push is configured. ${state.subscribedCount}/${state.maximumSubscriptions} device slots are active.`);
        } catch (caught) {
            setServer(null);
            setError(caught instanceof Error ? caught.message : 'Secure Web Push setup could not be checked.');
        } finally {
            setBusy(null);
        }
    };

    const subscribe = async () => {
        begin('subscribe');
        let created: PushSubscription | null = null;
        try {
            if (!supported || !server) throw new Error('Check secure Web Push setup first.');
            const nextPermission = await Notification.requestPermission();
            setPermission(nextPermission);
            if (nextPermission !== 'granted') {
                throw new Error(nextPermission === 'denied'
                    ? 'Notification permission is blocked. Change this site permission in the browser.'
                    : 'Notification permission was not granted.');
            }
            const registration = await readyRegistration();
            created = await registration.pushManager.getSubscription()
                ?? await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey(server.publicKey),
                });
            const response = await fetch('/api/research/push/subscriptions', {
                method: 'POST',
                headers: { ...authorization(), 'Content-Type': 'application/json' },
                body: JSON.stringify(created.toJSON()),
                cache: 'no-store',
            });
            const payload: unknown = await response.json();
            if (!response.ok || !isRecord(payload) || payload.success !== true) {
                throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Subscription registration failed.');
            }
            setSubscribed(true);
            setMessage('Background Web Push is enabled for this browser.');
        } catch (caught) {
            if (created && !subscribed) await created.unsubscribe().catch(() => false);
            setError(caught instanceof Error ? caught.message : 'Web Push could not be enabled.');
        } finally {
            setBusy(null);
        }
    };

    const unsubscribe = async () => {
        begin('unsubscribe');
        try {
            const registration = await readyRegistration();
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                const response = await fetch('/api/research/push/subscriptions', {
                    method: 'DELETE',
                    headers: { ...authorization(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint: subscription.endpoint }),
                    cache: 'no-store',
                });
                const payload: unknown = await response.json();
                if (!response.ok || !isRecord(payload) || payload.success !== true) {
                    throw new Error(isRecord(payload) && typeof payload.error === 'string' ? payload.error : 'Subscription removal failed.');
                }
                await subscription.unsubscribe();
            }
            setSubscribed(false);
            setMessage('Background Web Push is disabled for this browser and its server record was removed.');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Web Push could not be disabled.');
        } finally {
            setBusy(null);
        }
    };

    const testLocally = async () => {
        begin('test');
        try {
            if (permission !== 'granted') throw new Error('Enable notification permission before running the local test.');
            const registration = await readyRegistration();
            if (!registration.active) throw new Error('The active service worker is unavailable.');
            registration.active.postMessage({ type: 'SIGNAL_TEST_NOTIFICATION' });
            setMessage('Local notification test requested. It did not contact an external push service.');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Local notification test failed.');
        } finally {
            setBusy(null);
        }
    };

    const state = !supported ? 'Unsupported'
        : permission === 'denied' ? 'Blocked'
            : subscribed ? 'Subscribed'
                : server ? 'Ready to opt in'
                    : 'Not checked';

    return (
        <section className={'mt-4 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="web-push-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 id="web-push-title" className={'text-sm font-bold ' + styles.textPrimary}>Background Web Push</h3>
                    <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>Opt in from a direct click. The server receives an encrypted browser subscription under the same private single-user bearer boundary. Push text contains alert counts only; private research stays inside Signal.</p>
                </div>
                <span className={'text-xs font-semibold ' + (subscribed ? styles.positive : permission === 'denied' ? styles.risk : styles.textMuted)}>{state}</span>
            </div>
            <div className="mt-3 grid gap-3 min-[700px]:grid-cols-[minmax(0,1fr)_auto] min-[700px]:items-end">
                <label className={'text-xs font-semibold ' + styles.textMuted}>Private server access token
                    <input type="password" value={accessToken} autoComplete="off" minLength={32} maxLength={256}
                        onChange={(event) => setAccessToken(event.target.value)}
                        className={'mt-1 min-h-10 w-full rounded border px-3 ' + field} />
                </label>
                <button type="button" onClick={() => void check()} disabled={!supported || busy !== null}
                    className={'min-h-10 rounded border px-3 text-xs font-bold disabled:opacity-50 ' + styles.row}>
                    {busy === 'check' ? 'Checking…' : 'Check secure setup'}
                </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                {subscribed
                    ? <button type="button" onClick={() => void unsubscribe()} disabled={busy !== null} className={'min-h-10 rounded border px-3 text-xs font-bold disabled:opacity-50 ' + styles.row}>{busy === 'unsubscribe' ? 'Removing…' : 'Disable and remove this device'}</button>
                    : <button type="button" onClick={() => void subscribe()} disabled={!server || permission === 'denied' || busy !== null} className="min-h-10 rounded bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50">{busy === 'subscribe' ? 'Enabling…' : 'Enable background push'}</button>}
                <button type="button" onClick={() => void testLocally()} disabled={permission !== 'granted' || busy !== null} className={'min-h-10 rounded border px-3 text-xs font-bold disabled:opacity-50 ' + styles.row}>{busy === 'test' ? 'Testing…' : 'Run local-only notification test'}</button>
            </div>
            <p className={'mt-2 text-[11px] leading-5 ' + styles.textMuted}>The token stays in mounted-page memory, is sent only in the Authorization header, and is never saved to browser storage or analytics. Uninstalling or clearing site data may require re-registering this device.</p>
            {message ? <p role="status" className={'mt-2 text-xs ' + styles.positive}>{message}</p> : null}
            {error ? <p role="alert" className={'mt-2 text-xs ' + styles.risk}>{error}</p> : null}
        </section>
    );
};
