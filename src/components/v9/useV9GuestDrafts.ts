'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    discardGuestDraftBackup, ensureGuestDraftIdentity, GUEST_WORKSPACE_CLEARED_EVENT, GUEST_WORKSPACE_CLEAR_STORAGE_KEY, GuestWorkspaceConflictError,
    isGuestResearchStorageEvent, readGuestDraftIdentity, readGuestDraftRecovery, readGuestWorkspace, removeSavedGuestDraftBackups,
    restoreGuestDraftBackup, saveGuestDraftNote, writeGuestDraftBackup, type GuestDraftBackup,
} from '@/lib/research/guest-workspace';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';

const recordKey = (symbol: string, market: ResearchMarket) => `${market}:${symbol}`;
const message = (cause: unknown) => cause instanceof Error ? cause.message : 'Draft recovery is unavailable. Keep this page open and save or copy your note.';
const draftId = () => {
    try { return crypto.randomUUID(); }
    catch { return ''; } // The edit can still be held in memory if this browser cannot create a backup ID.
};
const empty = {
    identity: null as string | null,
    records: null as readonly ResearchRecord[] | null,
    active: {} as Record<string, GuestDraftBackup>,
    backedUp: {} as Record<string, GuestDraftBackup>,
    recovery: [] as GuestDraftBackup[],
    saving: {} as Record<string, boolean>,
    recoveryError: '',
    backupError: '',
    cleanupFailed: false,
};

/** Keep live drafts above the ticker and workspace routes, including drafts with unavailable storage. */
export function useV9GuestDrafts(guest: boolean, refreshTick = 0) {
    const [state, setState] = useState(empty);
    const current = useRef(state);
    const generation = useRef(0);
    const publish = useCallback((next: typeof empty) => {
        current.current = next;
        setState(next);
    }, []);

    const refresh = useCallback(() => {
        try {
            const identity = readGuestDraftIdentity();
            const recovery = readGuestDraftRecovery({ includeUnsaved: true });
            const { guestId, records } = readGuestWorkspace();
            const replaced = current.current.identity !== null
                ? current.current.identity !== identity
                : guestId !== null && Object.keys(current.current.active).length > 0;
            if (replaced) generation.current += 1;
            const latest = replaced ? empty : current.current;
            const activeIds = new Set(Object.values(latest.active).map(item => item.id));
            const persisted = new Map(recovery.drafts.map(draft => [draft.id, draft]));
            const backedUp = Object.fromEntries(Object.entries(latest.active).filter(([, draft]) => {
                const existing = persisted.get(draft.id);
                return existing?.updatedAt === draft.updatedAt && existing.text === draft.text
                    && existing.expectedNote === draft.expectedNote && existing.expectedUnsaved === draft.expectedUnsaved
                    || records.some(record => record.symbol === draft.symbol && record.market === draft.market && record.notes === draft.text.trim());
            }));
            publish({
                ...latest, identity, records, backedUp,
                recovery: recovery.drafts.filter(item => !activeIds.has(item.id)),
                recoveryError: recovery.unreadableCount > 0 ? `${recovery.unreadableCount} draft backup(s) could not be read and were left unchanged.` : '',
            });
        } catch (cause) {
            publish({ ...current.current, recoveryError: message(cause) });
        }
    }, [publish]);

    useEffect(() => {
        if (!guest) return;
        const onClear = () => {
            generation.current += 1;
            publish(empty);
            refresh();
        };
        const onStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === GUEST_WORKSPACE_CLEAR_STORAGE_KEY) onClear();
            else if (isGuestResearchStorageEvent(event.key)) refresh();
        };
        const timer = window.setTimeout(refresh, 0);
        window.addEventListener('storage', onStorage);
        window.addEventListener(GUEST_WORKSPACE_CLEARED_EVENT, onClear);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(GUEST_WORKSPACE_CLEARED_EVENT, onClear);
            generation.current += 1;
            current.current = empty;
        };
    }, [guest, publish, refresh]);

    useEffect(() => {
        if (!guest || refreshTick === 0) return;
        const timer = window.setTimeout(refresh, 0);
        return () => window.clearTimeout(timer);
    }, [guest, refreshTick, refresh]);

    async function requireIdentity(atGeneration: number) {
        const identity = current.current.identity ?? await ensureGuestDraftIdentity();
        if (generation.current !== atGeneration) throw new Error('The guest workspace changed while the action was waiting.');
        if (current.current.identity !== identity) publish({ ...current.current, identity });
        return identity;
    }

    async function backup(key: string, draft: GuestDraftBackup) {
        const atGeneration = generation.current;
        try {
            const identity = await requireIdentity(atGeneration);
            if (current.current.active[key] !== draft) return;
            await writeGuestDraftBackup(identity, draft, true);
            if (generation.current === atGeneration && current.current.active[key] === draft) {
                publish({ ...current.current, backupError: '', backedUp: { ...current.current.backedUp, [key]: draft } });
                refresh();
            }
        } catch (cause) {
            if (generation.current === atGeneration && current.current.active[key] === draft) publish({ ...current.current, backupError: message(cause) });
        }
    }

    function removeActive(key: string) {
        const active = { ...current.current.active };
        const backedUp = { ...current.current.backedUp };
        delete active[key];
        delete backedUp[key];
        const backupError = Object.keys(active).length > 0 ? current.current.backupError : '';
        publish({ ...current.current, active, backedUp, backupError });
    }

    async function discardActive(symbol: string, market: ResearchMarket) {
        const key = recordKey(symbol, market);
        const draft = current.current.active[key];
        if (!draft) return;
        const atGeneration = generation.current;
        const identity = current.current.identity;
        if (identity) await discardGuestDraftBackup(identity, draft.id, undefined, true);
        if (generation.current === atGeneration && current.current.active[key] === draft) {
            removeActive(key);
            refresh();
        }
    }

    function edit(symbol: string, market: ResearchMarket, text: string, savedNote: string | null) {
        if (!guest) return;
        const key = recordKey(symbol, market);
        const previous = current.current.active[key];
        const expectedNote = previous?.expectedNote ?? savedNote ?? '';
        const expectedUnsaved = previous ? previous.expectedUnsaved : savedNote === null ? true : undefined;
        const draft = {
            id: previous?.id || draftId(), symbol, market, text, expectedNote, expectedUnsaved,
            updatedAt: new Date().toISOString(),
        };
        publish({ ...current.current, active: { ...current.current.active, [key]: draft } });
        if (draft.text === draft.expectedNote && !current.current.saving[key]) {
            void discardActive(symbol, market).catch(cause => {
                if (current.current.active[key] === draft) publish({ ...current.current, backupError: message(cause) });
            });
        } else if (draft.text !== draft.expectedNote) void backup(key, draft);
    }

    async function keepDraft(symbol: string, market: ResearchMarket, reviewedNote: string) {
        const key = recordKey(symbol, market);
        const draft = current.current.active[key];
        if (!draft || current.current.saving[key]) return;
        const record = readGuestWorkspace().records.find(item => recordKey(item.symbol, item.market) === key);
        if (!record) throw new Error('This security is no longer saved on this device.');
        if (record.notes !== reviewedNote) throw new GuestWorkspaceConflictError(record);
        if (draft.text.trim() === reviewedNote) {
            await discardActive(symbol, market);
            return;
        }
        const rebased = { ...draft, expectedNote: reviewedNote, expectedUnsaved: undefined, updatedAt: new Date().toISOString() };
        publish({ ...current.current, active: { ...current.current.active, [key]: rebased } });
        void backup(key, rebased);
    }

    async function save(symbol: string, market: ResearchMarket, companyName: string, savedNote: string | null) {
        if (!guest) return null;
        const key = recordKey(symbol, market);
        if (current.current.saving[key]) return null;
        const submitted = current.current.active[key];
        const expectedNote = submitted ? submitted.expectedUnsaved ? null : submitted.expectedNote : savedNote;
        const atGeneration = generation.current;
        publish({ ...current.current, saving: { ...current.current.saving, [key]: true } });
        try {
            const identity = await requireIdentity(atGeneration);
            const { record: saved, cleanupFailed } = await saveGuestDraftNote(identity, symbol, market, companyName, submitted?.text ?? expectedNote ?? '', expectedNote);
            if (generation.current !== atGeneration) return null;
            if (cleanupFailed) publish({ ...current.current, cleanupFailed: true });
            const newer = current.current.active[key];
            if (newer && newer !== submitted && newer.text !== saved.notes) {
                const rebased = { ...newer, expectedNote: saved.notes, expectedUnsaved: undefined, updatedAt: new Date().toISOString() };
                publish({ ...current.current, active: { ...current.current.active, [key]: rebased } });
                void backup(key, rebased);
            } else removeActive(key);
            refresh();
            return saved;
        } catch (cause) {
            if (generation.current === atGeneration && cause instanceof GuestWorkspaceConflictError) refresh();
            throw cause;
        } finally {
            if (generation.current === atGeneration) {
                const saving = { ...current.current.saving };
                delete saving[key];
                publish({ ...current.current, saving });
            }
        }
    }

    async function restore(draft: GuestDraftBackup) {
        const key = recordKey(draft.symbol, draft.market);
        if (current.current.active[key]) throw new Error('Save or discard the open draft for this security before restoring another version.');
        const atGeneration = generation.current;
        const identity = await requireIdentity(atGeneration);
        const restored = await restoreGuestDraftBackup(identity, draft, crypto.randomUUID(), true);
        if (generation.current !== atGeneration) return false;
        if (current.current.active[key]) {
            refresh();
            throw new Error('The open note changed during recovery. Both draft versions are available.');
        }
        publish({
            ...current.current,
            active: { ...current.current.active, [key]: restored },
            backedUp: { ...current.current.backedUp, [key]: restored },
        });
        refresh();
        return true;
    }

    async function discardRecovery(draft: GuestDraftBackup) {
        const atGeneration = generation.current;
        const identity = await requireIdentity(atGeneration);
        await discardGuestDraftBackup(identity, draft.id, draft, true);
        if (generation.current === atGeneration) refresh();
    }

    function retryRecovery() {
        refresh();
        const atGeneration = generation.current;
        const identity = current.current.identity;
        if (identity && current.current.cleanupFailed) {
            void removeSavedGuestDraftBackups(identity).then(() => {
                if (generation.current !== atGeneration) return;
                publish({ ...current.current, cleanupFailed: false });
                refresh();
            }).catch(cause => {
                if (generation.current === atGeneration) publish({ ...current.current, backupError: message(cause) });
            });
        }
        for (const [key, draft] of Object.entries(current.current.active)) {
            if (draft.text !== draft.expectedNote) void backup(key, draft);
        }
    }

    const display = guest ? state : empty;
    const hasUnbackedEdits = Object.entries(display.active).some(([key, draft]) => draft.text !== draft.expectedNote && display.backedUp[key] !== draft);
    useEffect(() => {
        if (!hasUnbackedEdits) return;
        const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [hasUnbackedEdits]);
    return {
        records: display.records,
        drafts: display.active,
        recovery: display.recovery,
        error: display.backupError || display.recoveryError || (display.cleanupFailed ? 'Your note was saved. Browser storage prevented removing its draft backup.' : ''),
        hasUnsaved: Object.values(display.active).some(draft => draft.text !== draft.expectedNote),
        saving: display.saving,
        edit, save, keepDraft, discardActive, retryRecovery, restore, discardRecovery,
    };
}

export type V9GuestDrafts = ReturnType<typeof useV9GuestDrafts>;
