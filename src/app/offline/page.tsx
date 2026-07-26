'use client';

import { useEffect, useState } from 'react';

const LAST_ONLINE_KEY = 'signal-pwa-last-online-v1';

export default function OfflinePage() {
    const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setLastOnlineAt(window.localStorage.getItem(LAST_ONLINE_KEY));
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    return (
        <main className="min-h-screen bg-[#071019] px-5 py-16 text-slate-100">
            <section className="mx-auto max-w-2xl rounded-xl border border-slate-700 bg-[#0b1722] p-6 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300">Bounded offline mode</p>
                <h1 className="mt-2 text-2xl font-bold">Signal cannot reach live server data</h1>
                <p className="mt-4 leading-7 text-slate-300">Market conditions, research records, alerts, sync, provider evidence, and all API-backed views require a connection. This fallback contains no cached account or research data and must not be read as a current market view.</p>
                <div className="mt-5 rounded-lg border border-slate-700 p-4">
                    <h2 className="font-bold">What remains local</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Planning data that was already saved in this browser—such as imported holdings, cash-flow plans, and what-if scenarios—remains in browser storage. Signal does not copy it into Cache Storage, send it, or mutate it while offline. Return to an already-open tab to use any state that tab still holds.</p>
                </div>
                <p className="mt-4 text-sm text-slate-400">{lastOnlineAt ? `This browser was last online ${new Date(lastOnlineAt).toLocaleString()}.` : 'No last-online timestamp is available in this browser.'}</p>
                {/* A native link must remain functional when fallback HTML cannot hydrate at the requested URL. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="mt-6 inline-flex min-h-11 items-center rounded bg-teal-700 px-4 font-bold text-white">Retry Signal</a>
            </section>
        </main>
    );
}
