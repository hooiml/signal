'use client';

import { useState, type FormEvent } from 'react';
import type { ResearchRecord } from '@/lib/types/research';
import { readGuestRecords, removeGuestSecurity, updateGuestNote } from '@/lib/research/guest-workspace';
import styles from './guest-research-note.module.css';

type Props = {
    readonly record: ResearchRecord;
    readonly onSaved: (record: ResearchRecord) => void;
    readonly onRemoved: () => void;
    readonly disabled?: boolean;
};

export function GuestResearchNote({ record, onSaved, onRemoved, disabled = false }: Props) {
    const [draft, setDraft] = useState(record.notes);
    const [expectedNote, setExpectedNote] = useState(record.notes);
    const [error, setError] = useState('');
    const [conflict, setConflict] = useState(false);
    const [savedStatus, setSavedStatus] = useState('');

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (disabled) return;
        try {
            const saved = await updateGuestNote(record.symbol, record.market, draft, expectedNote);
            setDraft(saved.notes);
            setExpectedNote(saved.notes);
            setError('');
            setConflict(false);
            setSavedStatus('Note saved on this device.');
            onSaved(saved);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not save this note. Try again.');
            setConflict(cause instanceof Error && cause.name === 'GuestWorkspaceConflictError');
            setSavedStatus('');
        }
    };

    const reload = () => {
        try {
            const current = readGuestRecords().find((item) => item.symbol === record.symbol && item.market === record.market);
            if (current) {
                setDraft(current.notes);
                setExpectedNote(current.notes);
                setError('');
                setConflict(false);
                setSavedStatus('');
                onSaved(current);
            } else {
                setError('This security is no longer saved on this device.');
                setConflict(false);
            }
        } catch {
            setError('Could not reload the latest note from this browser.');
        }
    };

    const remove = async () => {
        if (disabled) return;
        if (!window.confirm(`Remove ${record.symbol} from this device? Its guest note will be removed too.`)) return;
        try {
            await removeGuestSecurity(record.symbol, record.market);
            setError('');
            onRemoved();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Could not remove this security. Try again.');
        }
    };

    return (
        <section className={styles.panel} aria-labelledby="guest-note-title">
            <div className={styles.heading}>
                <div>
                    <h2 id="guest-note-title">Your note</h2>
                    <p>Your note · saved on this device</p>
                </div>
                <button className={styles.remove} type="button" onClick={remove} disabled={disabled}>Remove security</button>
            </div>
            {disabled && <p className={styles.error} role="status">Saved data unavailable. Your draft is kept here, but saving and removing are paused.</p>}
            <form onSubmit={save}>
                <label className={styles.label} htmlFor="guest-research-note">Personal note for {record.symbol}</label>
                <textarea
                    id="guest-research-note"
                    value={draft}
                    maxLength={5_000}
                    rows={5}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setError('');
                        setConflict(false);
                        setSavedStatus('');
                    }}
                    aria-describedby="guest-note-count"
                />
                <div className={styles.footer}>
                    <span id="guest-note-count">{draft.length}/5000</span>
                    <button className={styles.save} type="submit" disabled={disabled}>Save note</button>
                </div>
            </form>
            {error && <p className={styles.error} role="alert">{error}{conflict && <> <button type="button" onClick={reload}>Reload note</button></>}</p>}
            {savedStatus && <p className={styles.savedStatus} role="status">{savedStatus}</p>}
        </section>
    );
}
