'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { DEFAULT_SIGNAL_CONFIG, readSignalConfig, writeSignalConfig, type SignalConfig } from '@/lib/signal-config';
import { clearGuestWorkspace, exportGuestWorkspace, readGuestDraftRecovery } from '@/lib/research/guest-workspace';
import { ownerUnlockHref } from '@/lib/owner-access-client';
import { V8ThemeControl } from './V8ThemeControl';
import styles from './v8-settings.module.css';

/** Shared modal stays beside the page, so opening it never unmounts an editor. */
export function V8Settings({ hasUnsavedGuestNotes = false, onDefaultsSaved }: { hasUnsavedGuestNotes?: boolean; onDefaultsSaved?: () => void }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const title = useId();
    const [open, setOpen] = useState(false);
    const [config, setConfig] = useState<SignalConfig>(DEFAULT_SIGNAL_CONFIG);
    const [preferenceError, setPreferenceError] = useState('');
    const [saved, setSaved] = useState('');
    const [guestError, setGuestError] = useState('');
    const [guestStatus, setGuestStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const [unlockHref, setUnlockHref] = useState(ownerUnlockHref('/research-v8'));

    useEffect(() => {
        if (!open) return;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = overflow; };
    }, [open]);

    function show() {
        const defaults = readSignalConfig();
        setConfig(defaults.config); setPreferenceError(defaults.error); setSaved('');
        setGuestError(''); setGuestStatus('');
        setUnlockHref(ownerUnlockHref(window.location.pathname + window.location.search + window.location.hash));
        dialog.current?.showModal();
        setOpen(true);
    }
    function saveDefaults() {
        try {
            writeSignalConfig(config); setPreferenceError('');
            onDefaultsSaved?.();
            setSaved('Defaults saved. They apply the next time you open or reload Market.');
        } catch (cause) { setPreferenceError(cause instanceof Error ? cause.message : 'Could not save defaults.'); setSaved(''); }
    }
    async function guestAction(action: 'export' | 'clear') {
        if (busy) return;
        setGuestError(''); setGuestStatus('');
        try {
            if (action === 'clear') {
                if (!window.confirm('Remove all guest securities, saved notes and draft backups from this browser? Export includes saved notes only; save any drafts you want to keep first. Your owner workspace, holdings, Learn progress and settings will not change.')) return;
                setBusy(true);
                await clearGuestWorkspace();
                setGuestStatus('Guest research and draft backups cleared from this browser.');
            } else {
                let hasBackups = true;
                try { const recovery = readGuestDraftRecovery(); hasBackups = recovery.drafts.length > 0 || recovery.unreadableCount > 0; }
                catch { /* Warn conservatively if recovery cannot be read. Saved-only export validates independently. */ }
                if ((hasUnsavedGuestNotes || hasBackups) && !window.confirm('Unsaved drafts are not included in this export. Cancel to restore and save them first, or continue to export saved notes only.')) return;
                const url = URL.createObjectURL(new Blob([exportGuestWorkspace()], { type: 'application/json' }));
                const link = document.createElement('a'); link.href = url; link.download = 'signal-guest-research.json'; link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                setGuestStatus('Saved guest research exported. Unsaved drafts are excluded.');
            }
        } catch (cause) { setGuestError(cause instanceof Error ? cause.message : 'Device storage is unavailable.'); }
        finally { setBusy(false); }
    }

    return <>
        <button ref={trigger} type="button" className={styles.trigger} aria-haspopup="dialog" aria-expanded={open} onClick={show}>Settings</button>
        <dialog ref={dialog} className={styles.dialog} aria-labelledby={title}
            onKeyDown={event => {
                if (event.key !== 'Tab') return;
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], select:not(:disabled), input:not([type="radio"]):not(:disabled), input[type="radio"]:checked:not(:disabled)'));
                const first = controls[0];
                const last = controls.at(-1);
                if (event.shiftKey && document.activeElement === first && last) {
                    event.preventDefault(); last.focus();
                } else if (!event.shiftKey && document.activeElement === last && first) {
                    event.preventDefault(); first.focus();
                }
            }}
            onCancel={event => { if (busy) event.preventDefault(); }}
            onClose={() => { setOpen(false); trigger.current?.focus({ preventScroll: true }); }}>
            <div className={styles.heading}><h2 id={title}>Settings</h2><button type="button" aria-label="Close settings" disabled={busy} onClick={() => dialog.current?.close()}>Close</button></div>
            <section className={styles.section} aria-label="Appearance">
                <h3>Appearance</h3><p>Theme applies immediately. Auto follows your device.</p>
                <V8ThemeControl />
            </section>
            <section className={styles.section} aria-label="Market defaults">
                <h3>Market defaults</h3><p>Used when you open or reload Market. A market in the link takes priority. Page controls change only the current view.</p>
                <div className={styles.fields}>
                    <div><label htmlFor={`${title}-market`}>Default market</label><select id={`${title}-market`} value={config.market} onChange={event => { setConfig({ ...config, market: event.target.value === 'MY' ? 'MY' : 'US' }); setSaved(''); }}><option value="US">United States</option><option value="MY">Malaysia</option></select></div>
                    <div><label htmlFor={`${title}-mode`}>Default mode</label><select id={`${title}-mode`} value={config.mode} onChange={event => { setConfig({ ...config, mode: event.target.value === 'contrarian' ? 'contrarian' : 'standard' }); setSaved(''); }}><option value="standard">Momentum</option><option value="contrarian">Contrarian</option></select></div>
                </div>
                <label className={styles.check}><input type="checkbox" checked={config.enableSocial} onChange={event => { setConfig({ ...config, enableSocial: event.target.checked }); setSaved(''); }} />Include social in score</label>
                <p>Defaults are saved in this browser. Closing without saving discards these default changes.</p>
                {preferenceError && <p role="alert">{preferenceError}</p>}
                <div><button className={styles.primary} type="button" onClick={saveDefaults}>Save defaults</button></div>
                {saved && <p role="status">{saved}</p>}
            </section>
            <section className={styles.section} aria-label="Guest data">
                <h3>Guest data on this device</h3><p>Guest research is saved only in this browser on this website. People sharing this browser profile can read it.</p>
                <p>Export includes saved notes only. Save open or recovered drafts in Research first to include them. Export a copy before clearing.</p>
                <div className={styles.actions}><button type="button" disabled={busy} onClick={() => void guestAction('export')}>Export guest research</button><button type="button" className={styles.danger} disabled={busy} onClick={() => void guestAction('clear')}>{busy ? 'Clearing…' : 'Clear guest research'}</button></div>
                <p>Clear removes guest securities, notes and draft backups. Owner research, holdings, Learn progress and settings stay unchanged.</p>
                {guestError && <p role="alert">{guestError}</p>}{guestStatus && <p role="status">{guestStatus}</p>}
            </section>
            <section className={styles.section} aria-label="Owner workspace"><h3>Owner workspace</h3><p>Open private research through the existing unlock page. Guest data is never imported or merged.</p><a href={unlockHref} target="_blank" rel="noopener noreferrer">Open owner workspace (new tab) ↗</a></section>
        </dialog>
    </>;
}
