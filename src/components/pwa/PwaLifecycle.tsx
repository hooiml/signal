'use client';

import { useEffect, useRef, useState } from 'react';

type InstallPromptEvent = Event & {
    readonly prompt: () => Promise<void>;
    readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
};

const LAST_ONLINE_KEY = 'signal-pwa-last-online-v1';

export const PwaLifecycle = () => {
    const [online, setOnline] = useState(true);
    const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);
    const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
    const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const reloadForUpdate = useRef(false);

    useEffect(() => {
        const markOnline = () => {
            const current = new Date().toISOString();
            window.localStorage.setItem(LAST_ONLINE_KEY, current);
            setLastOnlineAt(current);
            setOnline(true);
        };
        const markOffline = () => setOnline(false);
        const initialize = window.setTimeout(() => {
            setOnline(navigator.onLine);
            setLastOnlineAt(window.localStorage.getItem(LAST_ONLINE_KEY));
            if (navigator.onLine) markOnline();
        }, 0);
        window.addEventListener('online', markOnline);
        window.addEventListener('offline', markOffline);

        const beforeInstall = (event: Event) => {
            event.preventDefault();
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
                .catch(() => setMessage('Offline support could not be registered in this browser.'));
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
        setMessage(choice.outcome === 'accepted' ? 'Signal installation started.' : 'Installation was dismissed.');
    };

    const deferInstall = () => {
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
    return (
        <aside
            data-testid="pwa-lifecycle"
            data-priority={hasPriorityNotice ? 'essential' : 'optional'}
            className={'relative z-[100] w-full border-b px-3 py-3 text-xs text-slate-100 ' + (hasPriorityNotice
                ? 'border-amber-400/50 bg-[#101820] shadow-md'
                : 'border-slate-700 bg-[#071019]')}
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
                        <p className="font-bold text-slate-100">Install Signal</p>
                        <p className="mt-1 leading-5 text-slate-400">Optional: add Signal to this device for quicker access.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => void install()} className="min-h-10 rounded border border-slate-500 px-3 font-bold">Install Signal</button>
                        <button type="button" onClick={deferInstall} className="min-h-10 rounded px-3 font-bold text-slate-300 underline decoration-slate-500 underline-offset-4">Not now</button>
                    </div>
                </div>
            ) : null}
            {message ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="leading-5 text-slate-300">{message}</p>
                    <button type="button" onClick={() => setMessage(null)} className="min-h-10 rounded px-3 font-bold text-slate-300 underline decoration-slate-500 underline-offset-4">Dismiss notice</button>
                </div>
            ) : null}
            </div>
        </aside>
    );
};
