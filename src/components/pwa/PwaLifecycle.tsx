'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

type InstallPromptEvent = Event & {
    readonly prompt: () => Promise<void>;
    readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
};

const LAST_ONLINE_KEY = 'signal-pwa-last-online-v1';
const INSTALL_DEFERRED_KEY = 'signal-pwa-install-deferred-v1';
const INSTALL_DEFER_DAYS = 30;

/** "Not now" is remembered so the optional install offer does not reappear on every page load. */
const installDeferred = () => {
    try {
        const deferredAt = Date.parse(window.localStorage.getItem(INSTALL_DEFERRED_KEY) ?? '');
        return Number.isFinite(deferredAt) && Date.now() - deferredAt < INSTALL_DEFER_DAYS * 86_400_000;
    } catch {
        return false;
    }
};
const rememberInstallDeferred = () => {
    try { window.localStorage.setItem(INSTALL_DEFERRED_KEY, new Date().toISOString()); } catch { /* Storage may be unavailable; the offer simply returns later. */ }
};

export const PwaLifecycle = () => {
    const pathname = usePathname();
    const [online, setOnline] = useState(true);
    const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const reloadForUpdate = useRef(false);

    useEffect(() => {
        const markOnline = () => {
            const current = new Date().toISOString();
            try { window.localStorage.setItem(LAST_ONLINE_KEY, current); } catch { /* The live online state does not depend on optional timestamp storage. */ }
            setLastOnlineAt(current);
            setOnline(true);
        };
        const markOffline = () => setOnline(false);
        const initialize = window.setTimeout(() => {
            setOnline(navigator.onLine);
            try { setLastOnlineAt(window.localStorage.getItem(LAST_ONLINE_KEY)); } catch { /* A previous online timestamp may be unavailable. */ }
            if (navigator.onLine) markOnline();
        }, 0);
        window.addEventListener('online', markOnline);
        window.addEventListener('offline', markOffline);

        const beforeInstall = (event: Event) => {
            event.preventDefault();
            if (installDeferred()) return;
            setInstallPrompt(event as InstallPromptEvent);
        };
        window.addEventListener('beforeinstallprompt', beforeInstall);

        let registration: ServiceWorkerRegistration | null = null;
        let installing: ServiceWorker | null = null;
        const installed = () => {
            if (installing?.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(registration?.waiting ?? installing);
            }
        };
        const updateFound = () => {
            installing?.removeEventListener('statechange', installed);
            installing = registration?.installing ?? null;
            installing?.addEventListener('statechange', installed);
        };
        const controllerChanged = () => {
            if (reloadForUpdate.current) window.location.reload();
        };
        navigator.serviceWorker?.addEventListener('controllerchange', controllerChanged);
        if ('serviceWorker' in navigator) {
            void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                .then((value) => {
                    registration = value;
                    setWaitingWorker(value.waiting);
                    value.addEventListener('updatefound', updateFound);
                })
                .catch(() => { /* Optional offline registration failure must not cover active research controls. */ });
        }
        return () => {
            window.clearTimeout(initialize);
            window.removeEventListener('online', markOnline);
            window.removeEventListener('offline', markOffline);
            window.removeEventListener('beforeinstallprompt', beforeInstall);
            navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
            registration?.removeEventListener('updatefound', updateFound);
            installing?.removeEventListener('statechange', installed);
        };
    }, []);

    const install = async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        setInstallPrompt(null);
        if (choice.outcome === 'dismissed') rememberInstallDeferred();
        setMessage(choice.outcome === 'accepted' ? 'Signal installation started.' : 'Installation was dismissed.');
    };

    const deferInstall = () => {
        rememberInstallDeferred();
        setInstallPrompt(null);
        setMessage(null);
    };

    const applyUpdate = () => {
        if (!waitingWorker) return;
        const proceed = window.confirm('Applying the Signal update reloads this page. Save any unsaved research or planning changes first. Apply now?');
        if (!proceed) {
            setMessage('Update kept waiting. Apply it after saving your work.');
            return;
        }
        reloadForUpdate.current = true;
        waitingWorker.postMessage({ type: 'SIGNAL_APPLY_UPDATE' });
    };

    if (online && !waitingWorker && !installPrompt && !message) return null;
    const hasPriorityNotice = !online || waitingWorker !== null;
    const compactOptional = !hasPriorityNotice && (pathname === '/main-v8' || pathname === '/research-v8');
    // V8 pages are light and expose their tokens on <html>; the optional prompt follows them there.
    const tone = compactOptional
        ? { title: 'text-[var(--ink)]', body: 'text-[var(--muted)]', primary: 'border-transparent bg-[var(--brand)] text-[var(--on-brand)] hover:bg-[var(--brand-hover)]', quiet: 'text-[var(--muted)] decoration-[var(--line-strong)]' }
        : { title: 'text-slate-100', body: 'text-slate-300', primary: 'border-slate-500', quiet: 'text-slate-300 decoration-slate-500' };
    return (
        <aside
            data-testid="pwa-lifecycle"
            data-priority={hasPriorityNotice ? 'essential' : 'optional'}
            className={(compactOptional ? 'fixed bottom-4 right-4 z-[100] w-[calc(100vw-2rem)] max-w-[380px] rounded-xl border px-4 py-3 shadow-xl text-xs ' : 'relative z-[100] w-full border-b px-3 py-3 text-xs text-slate-100 ') + (hasPriorityNotice
                ? 'border-amber-400/50 bg-[#101820] shadow-md'
                : compactOptional ? 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_12px_32px_-12px_color-mix(in_srgb,var(--shadow)_35%,transparent)]' : 'border-slate-700 bg-[#071019] text-slate-100')}
            aria-live="polite"
        >
            <div className="mx-auto max-w-[1280px] space-y-3">
            {!online ? (
                <div role="status">
                    <p className="font-bold text-amber-300">Offline — live server data is unavailable</p>
                    <p className="mt-1 leading-5 text-slate-300">Only the static offline page is cached. Already-loaded browser-local planning data stays local and is neither synced nor copied into Cache Storage.</p>
                    <p className="mt-1 text-slate-400">{lastOnlineAt ? `Last online ${new Date(lastOnlineAt).toLocaleString()}.` : 'No last-online time is available.'}</p>
                    <button type="button" onClick={() => window.location.reload()} className="mt-2 min-h-10 rounded bg-teal-700 px-3 font-bold text-white">Retry connection</button>
                </div>
            ) : null}
            {waitingWorker ? (
                <div role="status">
                    <p className="font-bold text-teal-200">A Signal update is ready</p>
                    <p className="mt-1 leading-5 text-slate-300">Save any open research or planning changes before applying it.</p>
                    <button type="button" onClick={applyUpdate} className="mt-2 min-h-10 rounded bg-teal-700 px-3 font-bold text-white">Review and apply update</button>
                </div>
            ) : null}
            {installPrompt ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className={'font-bold ' + tone.title}>Install Signal</p>
                        <p className={'mt-1 leading-5 ' + tone.body}>Optional: add Signal to this device for quicker access.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void install()} className={'min-h-10 rounded border px-3 font-bold ' + tone.primary}>Install Signal</button>
                        <button type="button" onClick={deferInstall} className={'min-h-10 rounded px-3 font-bold underline underline-offset-4 ' + tone.quiet}>Not now</button>
                    </div>
                </div>
            ) : null}
            {message ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={'leading-5 ' + tone.body}>{message}</p>
                    <button type="button" onClick={() => setMessage(null)} className={'min-h-10 rounded px-3 font-bold underline underline-offset-4 ' + tone.quiet}>Dismiss notice</button>
                </div>
            ) : null}
            </div>
        </aside>
    );
};
