'use client';

import { useState } from 'react';
import {
    buildResearchSyncPreview,
    decryptResearchBackup,
    encryptResearchBackup,
    ResearchBackupError,
    researchBackupLimits,
    type ResearchBackupPayload,
    type ResearchRestoreConflictPolicy,
} from '@/lib/research/backup';
import { parseResearchRecord } from '@/lib/research/input';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { PrivateResearchSyncV6 } from './PrivateResearchSyncV6';

type RestoreResult = {
    readonly records: readonly ResearchRecord[];
    readonly added: number;
    readonly replaced: number;
    readonly skipped: number;
};

const readRestoreResponse = async (response: Response): Promise<RestoreResult> => {
    const value: unknown = await response.json();
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ResearchBackupError('Invalid restore response.');
    const body = Object.fromEntries(Object.entries(value));
    if (!response.ok) throw new ResearchBackupError(typeof body.error === 'string' ? body.error : 'Restore request failed.');
    if (typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) throw new ResearchBackupError('Restore result is invalid.');
    const data = Object.fromEntries(Object.entries(body.data));
    if (!Array.isArray(data.records) || !Number.isInteger(data.added) || !Number.isInteger(data.replaced) || !Number.isInteger(data.skipped)) {
        throw new ResearchBackupError('Restore result is invalid.');
    }
    return {
        records: data.records.map(parseResearchRecord),
        added: data.added as number,
        replaced: data.replaced as number,
        skipped: data.skipped as number,
    };
};

export const EncryptedResearchBackupV6 = ({ records, recordsLoadState, theme, onRestored }: {
    readonly records: readonly ResearchRecord[];
    readonly recordsLoadState: 'loading' | 'ready' | 'error';
    readonly theme: ResearchThemeV6;
    readonly onRestored: (records: readonly ResearchRecord[]) => void;
}) => {
    const styles = getThemeV6(theme);
    const [exportPassphrase, setExportPassphrase] = useState('');
    const [exportConfirmation, setExportConfirmation] = useState('');
    const [importPassphrase, setImportPassphrase] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [transferPackage, setTransferPackage] = useState('');
    const [pastedPackage, setPastedPackage] = useState('');
    const [preview, setPreview] = useState<ResearchBackupPayload | null>(null);
    const [conflictPolicy, setConflictPolicy] = useState<ResearchRestoreConflictPolicy>('add-only');
    const [replaceConfirmed, setReplaceConfirmed] = useState(false);
    const [busy, setBusy] = useState<'export' | 'preview' | 'restore' | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const begin = (operation: typeof busy) => {
        setBusy(operation);
        setError(null);
        setMessage(null);
    };

    const exportBackup = async () => {
        if (recordsLoadState !== 'ready') return;
        begin('export');
        try {
            if (exportPassphrase !== exportConfirmation) throw new ResearchBackupError('Passphrase confirmation does not match.');
            const encrypted = await encryptResearchBackup(records, exportPassphrase);
            const url = URL.createObjectURL(new Blob([encrypted], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url;
            link.download = `signal-research-${new Date().toISOString().slice(0, 10)}.signal-backup`;
            link.click();
            URL.revokeObjectURL(url);
            setExportPassphrase('');
            setExportConfirmation('');
            setMessage(`Encrypted ${records.length} research record${records.length === 1 ? '' : 's'} for download.`);
            trackProductAnalyticsEvent({ name: 'backup_exported', surface: 'research', workspace: 'backup', attributes: { result: 'success' } });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to create encrypted backup.');
            trackProductAnalyticsEvent({ name: 'backup_exported', surface: 'research', workspace: 'backup', attributes: { result: 'failure' } });
        } finally {
            setBusy(null);
        }
    };

    const createTransferPackage = async () => {
        if (recordsLoadState !== 'ready') return;
        begin('export');
        setTransferPackage('');
        try {
            if (exportPassphrase !== exportConfirmation) throw new ResearchBackupError('Passphrase confirmation does not match.');
            const encrypted = await encryptResearchBackup(records, exportPassphrase);
            setTransferPackage(encrypted);
            setExportPassphrase('');
            setExportConfirmation('');
            setMessage(`Created an encrypted transfer package for ${records.length} research record${records.length === 1 ? '' : 's'}.`);
            trackProductAnalyticsEvent({ name: 'backup_exported', surface: 'research', workspace: 'backup', attributes: { result: 'success' } });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to create encrypted transfer package.');
            trackProductAnalyticsEvent({ name: 'backup_exported', surface: 'research', workspace: 'backup', attributes: { result: 'failure' } });
        } finally {
            setBusy(null);
        }
    };

    const previewBackup = async () => {
        if (recordsLoadState !== 'ready') return;
        begin('preview');
        try {
            if (!selectedFile && !pastedPackage.trim()) throw new ResearchBackupError('Choose a backup file or paste an encrypted transfer package first.');
            const encrypted = pastedPackage.trim() || await selectedFile!.text();
            if (new TextEncoder().encode(encrypted).byteLength > researchBackupLimits.maxFileBytes) throw new ResearchBackupError('Backup is larger than 2 MB.');
            const decrypted = await decryptResearchBackup(encrypted, importPassphrase);
            setPreview(decrypted);
            setReplaceConfirmed(false);
            setMessage('Backup decrypted locally. Review the preview before importing.');
        } catch (caught) {
            setPreview(null);
            setError(caught instanceof Error ? caught.message : 'Unable to preview encrypted backup.');
        } finally {
            setBusy(null);
        }
    };

    const restoreBackup = async () => {
        if (!preview || recordsLoadState !== 'ready') return;
        begin('restore');
        try {
            if (conflictPolicy === 'replace-existing' && !replaceConfirmed) {
                throw new ResearchBackupError('Confirm replacement of matching saved records.');
            }
            const result = await readRestoreResponse(await fetch('/api/research/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: preview.records, conflictPolicy }),
            }));
            onRestored(result.records);
            setMessage(`Import complete: ${result.added} added, ${result.replaced} replaced, ${result.skipped} skipped.`);
            setPreview(null);
            setSelectedFile(null);
            setPastedPackage('');
            setImportPassphrase('');
            setReplaceConfirmed(false);
            trackProductAnalyticsEvent({ name: 'backup_imported', surface: 'research', workspace: 'backup', attributes: { result: 'success' } });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Unable to restore encrypted backup.');
            trackProductAnalyticsEvent({ name: 'backup_imported', surface: 'research', workspace: 'backup', attributes: { result: 'failure' } });
        } finally {
            setBusy(null);
        }
    };

    const previewPulledSync = (payload: ResearchBackupPayload) => {
        setPreview(payload);
        setSelectedFile(null);
        setPastedPackage('');
        setImportPassphrase('');
        setConflictPolicy('add-only');
        setReplaceConfirmed(false);
        setError(null);
        setMessage('Remote ciphertext was decrypted locally. Review revisions and conflict policy before importing.');
    };

    const inputClass = 'mt-1 h-11 w-full rounded border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ' + styles.panelUtility + ' ' + styles.textPrimary;
    return (
        <div className="w-full min-w-0 space-y-4">
            <header>
                <p className={'text-xs font-bold uppercase tracking-[0.18em] ' + styles.positive}>Local encryption</p>
                <h1 className={'mt-1 text-xl font-black ' + styles.textPrimary}>Encrypted research backup</h1>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Encryption and decryption happen in this browser with AES-GCM. Signal never uploads your passphrase or plaintext backup; only validated records are sent when you explicitly import.</p>
            </header>

            {error ? <div role="alert" className={'rounded border px-4 py-3 text-sm ' + (theme === 'light' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-rose-400/30 bg-rose-500/10 text-rose-200')}>{error}</div> : null}
            {message ? <div role="status" className={'rounded border px-4 py-3 text-sm ' + (theme === 'light' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200')}>{message}</div> : null}

            <PrivateResearchSyncV6 records={records} recordsLoadState={recordsLoadState} theme={theme} onPulled={previewPulledSync} />

            <div className="grid gap-4 lg:grid-cols-2">
                <section className={'rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="backup-export-title">
                    <h2 id="backup-export-title" className={'text-base font-bold ' + styles.textPrimary}>Create backup</h2>
                    <p className={'mt-1 text-sm ' + styles.textMuted}>
                        {recordsLoadState === 'loading'
                            ? 'Loading persisted research before export…'
                            : recordsLoadState === 'error'
                                ? 'Saved research could not be loaded. Export is disabled to prevent an incomplete backup.'
                                : `${records.length} persisted research record${records.length === 1 ? '' : 's'} will be included. Browser-only queues, layouts, and usage analytics are excluded.`}
                    </p>
                    <label className={'mt-4 block text-xs font-semibold ' + styles.textSecondary}>Passphrase
                        <input type="password" autoComplete="new-password" value={exportPassphrase} onChange={(event) => setExportPassphrase(event.target.value)} className={inputClass} />
                    </label>
                    <label className={'mt-3 block text-xs font-semibold ' + styles.textSecondary}>Confirm passphrase
                        <input type="password" autoComplete="new-password" value={exportConfirmation} onChange={(event) => setExportConfirmation(event.target.value)} className={inputClass} />
                    </label>
                    <p className={'mt-2 text-xs ' + styles.textMuted}>Use at least {researchBackupLimits.minPassphraseLength} characters. There is no passphrase recovery.</p>
                    <button type="button" disabled={busy !== null || recordsLoadState !== 'ready'} onClick={exportBackup} className="mt-4 min-h-11 rounded bg-emerald-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">
                        {busy === 'export' ? 'Encrypting…' : 'Download encrypted backup'}
                    </button>
                    <button type="button" disabled={busy !== null || recordsLoadState !== 'ready'} onClick={createTransferPackage} className={'ml-2 mt-4 min-h-11 rounded border px-4 text-sm font-bold disabled:opacity-50 ' + styles.textSecondary}>
                        Create device transfer package
                    </button>
                    {transferPackage ? (
                        <div className="mt-4">
                            <label className={'block text-xs font-semibold ' + styles.textSecondary}>Encrypted transfer package
                                <textarea aria-label="Encrypted transfer package" readOnly value={transferPackage} rows={4} className={inputClass + ' h-auto font-mono text-[11px]'} />
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                                <button type="button" onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(transferPackage);
                                        setMessage('Encrypted transfer package copied. Paste it into Signal on the other device.');
                                    } catch {
                                        setError('Clipboard access was unavailable. Select and copy the encrypted package manually.');
                                    }
                                }} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>Copy encrypted package</button>
                                <button type="button" onClick={() => {
                                    setTransferPackage('');
                                    setMessage('Encrypted transfer package cleared from this page.');
                                }} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>Clear package</button>
                            </div>
                        </div>
                    ) : null}
                </section>

                <section className={'rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="backup-import-title">
                    <h2 id="backup-import-title" className={'text-base font-bold ' + styles.textPrimary}>Preview and import</h2>
                    <p className={'mt-1 text-sm ' + styles.textMuted}>
                        {recordsLoadState === 'ready'
                            ? 'Files are decrypted locally and validated before any saved research changes.'
                            : 'Loading persisted research before preview or import. Import stays disabled to prevent stale conflict decisions.'}
                    </p>
                    <label className={'mt-4 block text-xs font-semibold ' + styles.textSecondary}>Encrypted backup file
                        <input type="file" accept=".signal-backup,application/json" onChange={(event) => {
                            setSelectedFile(event.target.files?.[0] ?? null);
                            setPastedPackage('');
                            setPreview(null);
                            setReplaceConfirmed(false);
                        }} className={'mt-1 block w-full text-sm ' + styles.textSecondary} />
                    </label>
                    <p className={'mt-3 text-center text-xs font-semibold uppercase tracking-[0.12em] ' + styles.textMuted}>or</p>
                    <label className={'mt-3 block text-xs font-semibold ' + styles.textSecondary}>Paste encrypted transfer package
                        <textarea aria-label="Paste encrypted transfer package" value={pastedPackage} rows={4} onChange={(event) => {
                            setPastedPackage(event.target.value);
                            setSelectedFile(null);
                            setPreview(null);
                            setReplaceConfirmed(false);
                        }} className={inputClass + ' h-auto font-mono text-[11px]'} />
                    </label>
                    <label className={'mt-3 block text-xs font-semibold ' + styles.textSecondary}>Passphrase
                        <input type="password" autoComplete="current-password" value={importPassphrase} onChange={(event) => setImportPassphrase(event.target.value)} className={inputClass} />
                    </label>
                    <button type="button" disabled={busy !== null || recordsLoadState !== 'ready'} onClick={previewBackup} className={'mt-4 min-h-11 rounded border px-4 text-sm font-bold disabled:opacity-50 ' + styles.textSecondary}>
                        {busy === 'preview' ? 'Decrypting…' : 'Decrypt and preview'}
                    </button>
                </section>
            </div>

            {preview ? (
                <section className={'rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="backup-preview-title">
                    <h2 id="backup-preview-title" className={'text-base font-bold ' + styles.textPrimary}>Import preview</h2>
                    <p className={'mt-1 text-sm ' + styles.textMuted}>Exported {new Date(preview.exportedAt).toLocaleString()} · {preview.records.length} record{preview.records.length === 1 ? '' : 's'}</p>
                    <div className="mt-3 flex flex-wrap gap-2" aria-label="Backup symbols">
                        {preview.records.map((record) => <span key={record.symbol} className={'rounded border px-2 py-1 text-xs font-mono ' + styles.panelUtility + ' ' + styles.textSecondary}>{record.symbol}</span>)}
                        {preview.records.length === 0 ? <span className={'text-sm ' + styles.textMuted}>No records in this backup.</span> : null}
                    </div>
                    {(() => {
                        const sync = buildResearchSyncPreview(records, preview.records);
                        return (
                            <dl className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                {[
                                    ['New on this device', sync.newRecords],
                                    ['Incoming newer', sync.incomingNewer],
                                    ['Local newer', sync.localNewer],
                                    ['Same revision', sync.sameRevision],
                                ].map(([label, value]) => (
                                    <div key={label} className={'rounded border p-3 ' + styles.panelUtility}>
                                        <dt className={'text-xs ' + styles.textMuted}>{label}</dt>
                                        <dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{value}</dd>
                                    </div>
                                ))}
                            </dl>
                        );
                    })()}
                    <fieldset className="mt-4 space-y-2">
                        <legend className={'text-sm font-bold ' + styles.textPrimary}>When a symbol already exists</legend>
                        <label className={'flex gap-3 text-sm ' + styles.textSecondary}>
                            <input type="radio" name="backup-conflict" checked={conflictPolicy === 'add-only'} onChange={() => { setConflictPolicy('add-only'); setReplaceConfirmed(false); }} />
                            <span><strong>Add only</strong> — keep every existing record unchanged and import new symbols.</span>
                        </label>
                        <label className={'flex gap-3 text-sm ' + styles.textSecondary}>
                            <input type="radio" name="backup-conflict" checked={conflictPolicy === 'replace-existing'} onChange={() => setConflictPolicy('replace-existing')} />
                            <span><strong>Replace matching</strong> — restore backed-up content and review history for matching symbols. Other records are not deleted.</span>
                        </label>
                    </fieldset>
                    {conflictPolicy === 'replace-existing' ? (
                        <label className={'mt-4 flex gap-3 rounded border p-3 text-sm ' + (theme === 'light' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-amber-400/35 bg-amber-500/10 text-amber-100')}>
                            <input type="checkbox" checked={replaceConfirmed} onChange={(event) => setReplaceConfirmed(event.target.checked)} />
                            <span>I understand matching saved records will be replaced and their revision will advance.</span>
                        </label>
                    ) : null}
                    <button type="button" disabled={busy !== null || recordsLoadState !== 'ready' || preview.records.length === 0 || (conflictPolicy === 'replace-existing' && !replaceConfirmed)} onClick={restoreBackup} className="mt-4 min-h-11 rounded bg-emerald-500 px-4 text-sm font-bold text-slate-950 disabled:opacity-50">
                        {busy === 'restore' ? 'Importing…' : `Import ${preview.records.length} record${preview.records.length === 1 ? '' : 's'}`}
                    </button>
                </section>
            ) : null}
        </div>
    );
};
