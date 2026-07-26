'use client';

import { useState } from 'react';
import {
    decryptResearchBackup,
    encryptResearchBackup,
    ResearchBackupError,
    type ResearchBackupPayload,
} from '@/lib/research/backup';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type SyncVaultSnapshot = {
    readonly envelope: string | null;
    readonly revision: number;
    readonly updatedAt: string | null;
};

const parseSyncResponse = async (response: Response): Promise<SyncVaultSnapshot> => {
    const payload: unknown = await response.json();
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new ResearchBackupError('Invalid private sync response.');
    const body = Object.fromEntries(Object.entries(payload));
    if (!response.ok) throw new ResearchBackupError(typeof body.error === 'string' ? body.error : 'Private sync request failed.');
    if (typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) throw new ResearchBackupError('Invalid private sync data.');
    const data = Object.fromEntries(Object.entries(body.data));
    if (!Number.isInteger(data.revision) || Number(data.revision) < 0
        || data.envelope !== null && typeof data.envelope !== 'string'
        || data.updatedAt !== null && typeof data.updatedAt !== 'string') {
        throw new ResearchBackupError('Invalid private sync data.');
    }
    return {
        envelope: data.envelope as string | null,
        revision: Number(data.revision),
        updatedAt: data.updatedAt as string | null,
    };
};

export const PrivateResearchSyncV6 = ({ records, recordsLoadState, theme, onPulled }: {
    readonly records: readonly ResearchRecord[];
    readonly recordsLoadState: 'loading' | 'ready' | 'error';
    readonly theme: ResearchThemeV6;
    readonly onPulled: (payload: ResearchBackupPayload) => void;
}) => {
    const styles = getThemeV6(theme);
    const [accessToken, setAccessToken] = useState('');
    const [passphrase, setPassphrase] = useState('');
    const [snapshot, setSnapshot] = useState<SyncVaultSnapshot | null>(null);
    const [replaceRemote, setReplaceRemote] = useState(false);
    const [busy, setBusy] = useState<'check' | 'push' | 'pull' | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const inputClass = 'mt-1 h-11 w-full rounded border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + styles.panelUtility + ' ' + styles.textPrimary;

    const request = async (method: 'GET' | 'PUT', body?: unknown): Promise<SyncVaultSnapshot> => {
        if (accessToken.length < 32) throw new ResearchBackupError('Server access token must contain at least 32 characters.');
        return parseSyncResponse(await fetch('/api/research/sync', {
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            },
            cache: 'no-store',
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }));
    };

    const begin = (operation: typeof busy) => {
        setBusy(operation);
        setError(null);
        setMessage(null);
    };

    const check = async () => {
        begin('check');
        try {
            const remote = await request('GET');
            setSnapshot(remote);
            setReplaceRemote(false);
            setMessage(remote.revision === 0
                ? 'The private sync vault is empty.'
                : `Remote encrypted snapshot ${remote.revision} was saved ${new Date(remote.updatedAt!).toLocaleString()}.`);
        } catch (caught) {
            setSnapshot(null);
            setError(caught instanceof Error ? caught.message : 'Unable to check private sync.');
        } finally {
            setBusy(null);
        }
    };

    const push = async () => {
        if (recordsLoadState !== 'ready') return;
        begin('push');
        try {
            if (!snapshot) throw new ResearchBackupError('Check the remote vault before pushing.');
            if (snapshot.revision > 0 && !replaceRemote) throw new ResearchBackupError('Confirm replacement of the remote encrypted snapshot.');
            const envelope = await encryptResearchBackup(records, passphrase);
            const saved = await request('PUT', { envelope, expectedRevision: snapshot.revision });
            setSnapshot(saved);
            setReplaceRemote(false);
            setPassphrase('');
            setMessage(`Encrypted ${records.length} record${records.length === 1 ? '' : 's'} to remote snapshot ${saved.revision}.`);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to push encrypted research.');
        } finally {
            setBusy(null);
        }
    };

    const pull = async () => {
        begin('pull');
        try {
            if (!snapshot?.envelope) throw new ResearchBackupError('Check a non-empty remote vault before pulling.');
            const payload = await decryptResearchBackup(snapshot.envelope, passphrase);
            onPulled(payload);
            setPassphrase('');
            setMessage('Remote ciphertext was decrypted locally. Review the import preview below.');
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to pull encrypted research.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <section className={'rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="private-sync-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-xs font-bold uppercase tracking-[0.12em] ' + styles.positive}>Opt-in ciphertext sync</p>
                    <h2 id="private-sync-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>Private single-user sync vault</h2>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>The browser encrypts the same bounded backup before upload. The server stores ciphertext only and requires a separate bearer token configured by the server owner.</p>
                </div>
                <span className={'text-xs font-semibold ' + (snapshot?.revision ? styles.positive : styles.textMuted)}>{snapshot ? `Remote revision ${snapshot.revision}` : 'Not checked'}</span>
            </div>
            <p className={'mt-2 text-xs leading-5 ' + styles.risk}>This is personal single-user sync, not a multi-user account system. Tokens and passphrases are kept only in this mounted page and are never placed in local storage.</p>
            <div className="mt-4 grid gap-3 min-[760px]:grid-cols-2">
                <label className={'text-xs font-semibold ' + styles.textSecondary}>Server access token
                    <input type="password" autoComplete="off" value={accessToken} onChange={(event) => {
                        setAccessToken(event.target.value);
                        setSnapshot(null);
                        setReplaceRemote(false);
                    }} className={inputClass} />
                </label>
                <label className={'text-xs font-semibold ' + styles.textSecondary}>Encryption passphrase
                    <input type="password" autoComplete="new-password" value={passphrase} onChange={(event) => setPassphrase(event.target.value)} className={inputClass} />
                </label>
            </div>
            {snapshot && snapshot.revision > 0 ? (
                <label className={'mt-3 flex gap-3 rounded border p-3 text-xs ' + styles.textSecondary}>
                    <input type="checkbox" checked={replaceRemote} onChange={(event) => setReplaceRemote(event.target.checked)} />
                    <span>I checked remote revision {snapshot.revision} and intend to replace that encrypted snapshot when pushing.</span>
                </label>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" disabled={busy !== null} onClick={() => void check()} className={'min-h-10 rounded border px-3 text-xs font-bold disabled:opacity-50 ' + styles.row}>{busy === 'check' ? 'Checking…' : 'Check remote vault'}</button>
                <button type="button" disabled={busy !== null || recordsLoadState !== 'ready' || snapshot === null} onClick={() => void push()} className={'min-h-10 rounded border px-3 text-xs font-bold disabled:opacity-50 ' + styles.row}>{busy === 'push' ? 'Encrypting and pushing…' : 'Push encrypted copy'}</button>
                <button type="button" disabled={busy !== null || !snapshot?.envelope} onClick={() => void pull()} className="min-h-10 rounded bg-emerald-500 px-3 text-xs font-bold text-slate-950 disabled:opacity-50">{busy === 'pull' ? 'Pulling and decrypting…' : 'Pull into import preview'}</button>
            </div>
            {message ? <p role="status" className={'mt-3 text-xs ' + styles.positive}>{message}</p> : null}
            {error ? <p role="alert" className={'mt-3 text-xs ' + styles.risk}>{error}</p> : null}
        </section>
    );
};
