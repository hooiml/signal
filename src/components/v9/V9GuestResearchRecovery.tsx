'use client';

import { useState } from 'react';
import type { GuestDraftBackup } from '@/lib/research/guest-workspace';
import type { ResearchMarket } from '@/lib/types/research';
import type { V9GuestDrafts } from './useV9GuestDrafts';
import styles from './v9-workspace.module.css';

export function V9GuestResearchRecovery({ drafts, onOpen }: {
    drafts: V9GuestDrafts;
    onOpen: (symbol: string, market: ResearchMarket) => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function changeBackup(item: GuestDraftBackup, discard: boolean) {
        if (discard && !window.confirm(`Discard this recoverable ${item.symbol} draft? Your saved note will stay as it is.`)) return;
        setBusy(true);
        setError('');
        try {
            if (discard) await drafts.discardRecovery(item);
            else if (await drafts.restore(item)) onOpen(item.symbol, item.market);
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not recover this draft.'); }
        finally { setBusy(false); }
    }

    if (!drafts.recovery.length && !drafts.error && !error) return null;
    return <section className={styles.card} aria-label="Recover unsaved guest notes">
        <div className={styles.sectionHead}><div>
            <h2>Recover unsaved notes</h2>
            {drafts.recovery.length > 0 && <p>Restore a draft to edit it. Use Save to update your research.</p>}
        </div></div>
        {(drafts.error || error) && <p role="alert">{drafts.error || error}{' '}
            <button type="button" className={styles.ghostBtn} onClick={() => { setError(''); drafts.retryRecovery(); }}>Retry draft recovery</button>
        </p>}
        {drafts.recovery.length > 0 && <ul>
            {drafts.recovery.map(item => <li key={item.id}>
                <strong>{item.symbol} · {item.market}</strong>{' '}
                <small>Backed up {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.updatedAt))}</small>
                <details><summary>Preview draft</summary><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{item.text || '(Empty note)'}</p></details>
                <button type="button" className={styles.ghostBtn} disabled={busy || !!drafts.drafts[`${item.market}:${item.symbol}`]} onClick={() => void changeBackup(item, false)}>Restore {item.symbol} draft</button>{' '}
                <button type="button" className={styles.ghostBtn} disabled={busy} onClick={() => void changeBackup(item, true)}>Discard {item.symbol} draft</button>
            </li>)}
        </ul>}
    </section>;
}
