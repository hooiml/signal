'use client';

import { useState, type FormEvent } from 'react';
import { safeOwnerReturnPath } from '@/lib/owner-access-client';

export default function UnlockPage() {
    const [secret, setSecret] = useState('');
    const [status, setStatus] = useState<'idle' | 'pending' | 'error'>('idle');
    const [message, setMessage] = useState<string | null>(null);

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatus('pending');
        setMessage(null);
        try {
            const response = await fetch('/api/owner/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret }),
            });
            const payload = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
            if (!response.ok || !payload?.success) {
                setStatus('error');
                setMessage(payload?.error ?? 'Signal could not be unlocked.');
                return;
            }
            setSecret('');
            window.location.assign(safeOwnerReturnPath(new URLSearchParams(window.location.search).get('next')));
        } catch {
            setStatus('error');
            setMessage('Signal could not reach the server.');
        }
    };

    return (
        <main className="min-h-screen bg-[#071019] px-5 py-16 text-slate-100">
            <section className="mx-auto max-w-md rounded-xl border border-slate-700 bg-[#0b1722] p-6 shadow-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300">Owner access</p>
                <h1 className="mt-2 text-2xl font-bold">Unlock saved research</h1>
                <p className="mt-4 leading-7 text-slate-300">Saved research, backups and notification settings require the server&apos;s owner access secret. This browser stays unlocked for 30 days; the secret itself is never stored.</p>
                <form className="mt-5 space-y-3" onSubmit={(event) => void submit(event)}>
                    <label className="block text-sm font-bold" htmlFor="owner-secret">Access secret</label>
                    <input
                        id="owner-secret"
                        type="password"
                        autoComplete="current-password"
                        value={secret}
                        onChange={(event) => setSecret(event.target.value)}
                        className="min-h-11 w-full rounded border border-slate-600 bg-[#071019] px-3 text-slate-100"
                        required
                    />
                    {message && <p role="alert" className="text-sm text-rose-300">{message}</p>}
                    <button type="submit" disabled={status === 'pending' || secret.length === 0} className="inline-flex min-h-11 items-center rounded bg-teal-700 px-4 font-bold text-white disabled:opacity-60">
                        {status === 'pending' ? 'Unlocking…' : 'Unlock'}
                    </button>
                </form>
            </section>
        </main>
    );
}
