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
    return (
        <aside className="fixed bottom-3 right-3 z-[100] max-w-[min(24rem,calc(100vw-1.5rem))] rounded-lg border border-slate-600 bg-[#071019] p-3 text-xs text-slate-100 shadow-2xl" aria-live="polite">
            {!online ? (
                <div>
                    <p className="font-bold text-amber-300">Offline — live server data is unavailable</p>
                    <p className="mt-1 leading-5 text-slate-300">Only the static offline page is cached. Already-loaded browser-local planning data stays local and is neither synced nor copied into Cache Storage.</p>
                    <p className="mt-1 text-slate-400">{lastOnlineAt ? `Last online ${new Date(lastOnlineAt).toLocaleString()}.` : 'No last-online time is available.'}</p>
                    <button type="button" onClick={() => window.location.reload()} className="mt-2 min-h-9 rounded bg-teal-700 px-3 font-bold text-white">Retry connection</button>
                </div>
            ) : null}
            {waitingWorker ? <button type="button" onClick={applyUpdate} className="mt-2 min-h-9 rounded bg-teal-700 px-3 font-bold text-white">Update available — review and apply</button> : null}
            {installPrompt ? <button type="button" onClick={() => void install()} className="mt-2 min-h-9 rounded border border-slate-500 px-3 font-bold">Install Signal</button> : null}
            {message ? <p className="mt-2 leading-5 text-slate-300">{message}</p> : null}
        </aside>
    );
};
