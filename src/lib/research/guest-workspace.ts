import type { ResearchMarket, ResearchRecord } from '../types/research';
import { createResearchRecord } from './records';
import { parseResearchRecord } from './input';

const storageKey = 'signal.guest-research.v1';
export const GUEST_WORKSPACE_CLEARED_EVENT = 'signal:guest-workspace-cleared';
const maxRecords = 100;
const maxNoteLength = 5_000;
const maxPayloadBytes = 1_048_576;
const missingLockMessage = 'This browser cannot safely save guest research because cross-tab locks are unavailable. Use a supported browser to change saved data.';

type GuestRecord = Pick<ResearchRecord, 'symbol' | 'market' | 'companyName' | 'notes'>;
type GuestWorkspace = { readonly version: 1; readonly guestId: string; readonly records: readonly GuestRecord[] };
export type GuestDraftBackup = { readonly id: string; readonly symbol: string; readonly market: ResearchMarket; readonly text: string; readonly expectedNote: string; readonly updatedAt: string };
const draftPrefix = `${storageKey}.draft.`;
const validId = (value: string): boolean => /^[0-9a-f-]{36}$/i.test(value);

const draftKeys = (): string[] => {
    const store = storage();
    return Array.from({ length: store.length }, (_, index) => store.key(index)).filter((key): key is string => !!key && key.startsWith(draftPrefix));
};

const removeDrafts = (guestId?: string, symbol?: string, market?: ResearchMarket, savedText?: string): void => {
    for (const key of draftKeys()) {
        if (guestId && !key.startsWith(`${draftPrefix}${guestId}.`)) continue;
        if (symbol) {
            let value;
            try { value = JSON.parse(storage().getItem(key) ?? 'null'); } catch { continue; }
            if (value?.symbol !== symbol.toUpperCase() || value?.market !== market || (savedText !== undefined && value.text !== savedText)) continue;
        }
        storage().removeItem(key);
    }
};

export class GuestWorkspaceConflictError extends Error {
    readonly currentRecord: ResearchRecord;

    constructor(currentRecord: ResearchRecord) {
        super('This device has a newer note. Reload the note before saving your changes.');
        this.name = 'GuestWorkspaceConflictError';
        this.currentRecord = currentRecord;
    }
}

const storage = (): Storage => {
    if (typeof window === 'undefined') throw new Error('Guest research storage is available only in a browser.');
    try {
        return window.localStorage;
    } catch {
        throw new Error('This browser blocks local storage. Enable storage for this site and try again.');
    }
};

const withGuestWriteLock = async <T>(operation: () => T): Promise<T> => {
    let lockManager: LockManager | undefined;
    try {
        lockManager = typeof navigator === 'undefined' ? undefined : navigator.locks;
    } catch {
        lockManager = undefined;
    }
    if (!lockManager || typeof lockManager.request !== 'function') throw new Error(missingLockMessage);
    return lockManager.request(storageKey, { mode: 'exclusive' }, operation);
};

const recordKey = (symbol: string, market: ResearchMarket): string => `${market}:${symbol.toUpperCase()}`;

const toRecord = (value: unknown): ResearchRecord => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('A saved guest security is not an object.');
    const item = value as Record<string, unknown>;
    const allowed = new Set(['symbol', 'market', 'companyName', 'notes']);
    if (Object.keys(item).some((key) => !allowed.has(key))) throw new Error('A saved guest security contains unsupported data.');
    if (typeof item.notes !== 'string' || item.notes.length > maxNoteLength) throw new Error('A saved guest note is invalid or exceeds 5,000 characters.');
    return parseResearchRecord({
        ...createResearchRecord({
            symbol: item.symbol as string,
            market: item.market as ResearchMarket,
            companyName: item.companyName as string,
            saveOnly: true,
        }),
        notes: item.notes,
    });
};

const toGuestRecord = (record: ResearchRecord): GuestRecord => ({
    symbol: record.symbol,
    market: record.market,
    companyName: record.companyName,
    notes: record.notes,
});

const readWorkspace = (): { readonly guestId: string | null; readonly records: ResearchRecord[] } => {
    let raw: string | null;
    try {
        raw = storage().getItem(storageKey);
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('This browser blocks')) throw error;
        throw new Error('Could not read guest research from this browser. Check its storage settings and try again.');
    }
    if (raw === null) return { guestId: null, records: [] };
    try {
        if (new TextEncoder().encode(raw).byteLength > maxPayloadBytes) throw new Error('Workspace exceeds the 1 MB storage limit.');
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('Workspace must be an object.');
        const workspace = parsed as Record<string, unknown>;
        if (workspace.version !== 1 || typeof workspace.guestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(workspace.guestId)) {
            throw new Error('Workspace version or guest identity is invalid.');
        }
        if (!Array.isArray(workspace.records) || workspace.records.length > maxRecords) throw new Error('Workspace must contain at most 100 securities.');
        const records = workspace.records.map(toRecord);
        const keys = new Set<string>();
        for (const record of records) {
            const key = recordKey(record.symbol, record.market);
            if (keys.has(key)) throw new Error('Workspace contains a duplicate security.');
            keys.add(key);
        }
        return { guestId: workspace.guestId, records };
    } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown data error';
        throw new Error(`Saved guest research is invalid (${detail}). The original browser data was left untouched.`);
    }
};

const persist = (guestId: string | null, records: readonly ResearchRecord[]): void => {
    const id = guestId ?? (() => {
        try {
            if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') throw new Error();
            return crypto.randomUUID();
        } catch {
            throw new Error('This browser cannot create a guest workspace ID. Update the browser and try again.');
        }
    })();
    const raw = JSON.stringify({ version: 1, guestId: id, records: records.map(toGuestRecord) } satisfies GuestWorkspace);
    if (new TextEncoder().encode(raw).byteLength > maxPayloadBytes) throw new Error('Guest research exceeds the 1 MB browser-storage limit. Remove a security or shorten a note, then try again.');
    try {
        storage().setItem(storageKey, raw);
    } catch {
        throw new Error('Could not save guest research. Browser storage may be blocked or full; free space and try again.');
    }
};

export const readGuestRecords = (): ResearchRecord[] => readWorkspace().records;
export const readGuestWorkspace = readWorkspace;

// Backups are separate from saved records. Each editor owns a unique backup ID,
// so two tabs can preserve different drafts without overwriting one another.
export const readGuestDraftRecovery = (): { drafts: GuestDraftBackup[]; unreadableCount: number } => {
    const current = readWorkspace();
    if (!current.guestId) return { drafts: [], unreadableCount: 0 };
    const result: GuestDraftBackup[] = [];
    let unreadableCount = 0;
    for (const key of draftKeys().filter(key => key.startsWith(`${draftPrefix}${current.guestId}.`))) {
        try {
            const raw = storage().getItem(key);
            if (raw === null) continue; // Another tab may have consumed this version.
            if (raw.length > 30_000) throw new Error();
            const item = JSON.parse(raw);
            if (item.version !== 1 || item.guestId !== current.guestId || typeof item.id !== 'string' || !validId(item.id)
                || key !== `${draftPrefix}${current.guestId}.${item.id}` || typeof item.text !== 'string' || item.text.length > maxNoteLength
                || typeof item.expectedNote !== 'string' || item.expectedNote.length > maxNoteLength
                || typeof item.updatedAt !== 'string' || !Number.isFinite(Date.parse(item.updatedAt))) throw new Error();
            const record = current.records.find(record => record.symbol === item.symbol && record.market === item.market);
            if (record && item.text !== item.expectedNote && item.text !== record.notes) {
                result.push({ id: item.id, symbol: record.symbol, market: record.market, text: item.text, expectedNote: item.expectedNote, updatedAt: item.updatedAt });
            }
        } catch {
            unreadableCount += 1;
        }
    }
    return { drafts: result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), unreadableCount };
};
export const readGuestDraftBackups = (): GuestDraftBackup[] => readGuestDraftRecovery().drafts;

const persistDraft = (current: ReturnType<typeof readWorkspace>, guestId: string, backup: GuestDraftBackup, replacingId?: string): void => {
        if (current.guestId !== guestId || !current.records.some(item => item.symbol === backup.symbol && item.market === backup.market)) throw new Error('The guest workspace changed. This draft was not backed up.');
        if (!validId(backup.id) || typeof backup.text !== 'string' || backup.text.length > maxNoteLength || typeof backup.expectedNote !== 'string' || backup.expectedNote.length > maxNoteLength || !Number.isFinite(Date.parse(backup.updatedAt))) throw new Error('This draft is invalid or exceeds 5,000 characters.');
        const key = `${draftPrefix}${guestId}.${backup.id}`;
        const raw = JSON.stringify({ ...backup, version: 1, guestId });
        const otherKeys = draftKeys().filter(value => value !== key && value !== `${draftPrefix}${guestId}.${replacingId}`);
        const bytes = otherKeys.reduce((sum, value) => sum + new TextEncoder().encode(storage().getItem(value) ?? '').byteLength, 0);
        if (otherKeys.length >= 200 || bytes + new TextEncoder().encode(raw).byteLength > maxPayloadBytes) throw new Error('Draft backup storage is full. Save your note or discard older recoverable drafts.');
        try { storage().setItem(key, raw); }
        catch { throw new Error('Draft recovery is unavailable because browser storage is blocked or full. Keep this page open and save or copy your note.'); }
};
export const writeGuestDraftBackup = (guestId: string, backup: GuestDraftBackup): Promise<void> =>
    withGuestWorkspaceLock(current => persistDraft(current, guestId, backup));

const sameBackup = (latest: GuestDraftBackup, expected: GuestDraftBackup): boolean =>
    latest.id === expected.id && latest.symbol === expected.symbol && latest.market === expected.market
    && latest.text === expected.text && latest.expectedNote === expected.expectedNote && latest.updatedAt === expected.updatedAt;

export const restoreGuestDraftBackup = (guestId: string, expected: GuestDraftBackup, newId: string): Promise<GuestDraftBackup> =>
    withGuestWorkspaceLock(current => {
        if (current.guestId !== guestId || !validId(expected.id) || !validId(newId) || newId === expected.id) throw new Error('The guest workspace changed. Reload draft recovery.');
        const key = `${draftPrefix}${guestId}.${expected.id}`;
        const raw = storage().getItem(key);
        if (!raw || !sameBackup(JSON.parse(raw), expected)) throw new Error('This draft backup changed or was discarded in another tab. Reload draft recovery before restoring it.');
        const restored = { ...expected, id: newId, updatedAt: new Date().toISOString() };
        persistDraft(current, guestId, restored, expected.id);
        storage().removeItem(key);
        return restored;
    });

export const discardGuestDraftBackup = (guestId: string, id: string, expected?: GuestDraftBackup): Promise<void> =>
    withGuestWorkspaceLock(current => {
        if (current.guestId !== guestId || !validId(id)) throw new Error('The guest workspace changed. Reload before discarding a draft.');
        const key = `${draftPrefix}${guestId}.${id}`;
        const raw = storage().getItem(key);
        if (expected && raw) {
            const latest = JSON.parse(raw);
            if (!sameBackup(latest, expected)) throw new Error('Another tab updated this draft backup. Reload draft recovery before discarding its newer version.');
        }
        storage().removeItem(key);
    });

const withGuestWorkspaceLock = async <T>(operation: (current: ReturnType<typeof readWorkspace>) => T, allowCreation = false): Promise<T> => {
    const expectedIdentity = readWorkspace().guestId;
    return withGuestWriteLock(() => {
        const current = readWorkspace();
        // Concurrent first bookmarks may join the same newly created workspace.
        // Existing-workspace operations must never cross a clear/replacement boundary.
        if (current.guestId !== expectedIdentity && !(allowCreation && expectedIdentity === null)) {
            throw new Error('This guest workspace changed while the action was waiting. Reload device storage before trying again.');
        }
        return operation(current);
    });
};

export const saveGuestSecurity = (symbol: string, market: ResearchMarket, companyName: string): Promise<ResearchRecord> =>
    withGuestWorkspaceLock(current => {
        const identity = parseResearchRecord({
            ...createResearchRecord({ symbol, market, companyName, saveOnly: true }),
        });
        const existing = current.records.find((record) => recordKey(record.symbol, record.market) === recordKey(identity.symbol, identity.market));
        const saved = existing
            ? parseResearchRecord({ ...existing, companyName: identity.companyName })
            : identity;
        if (!existing && current.records.length >= maxRecords) throw new Error('This guest workspace holds up to 100 securities. Remove one before adding another.');
        persist(current.guestId, existing
            ? current.records.map((record) => recordKey(record.symbol, record.market) === recordKey(identity.symbol, identity.market) ? saved : record)
            : [...current.records, saved]);
        return saved;
    }, true);

export const updateGuestNote = (symbol: string, market: ResearchMarket, note: string, expectedNote: string): Promise<ResearchRecord> =>
    withGuestWorkspaceLock(current => {
        if (typeof note !== 'string' || note.length > maxNoteLength) throw new Error('Your note must be 5,000 characters or fewer.');
        const index = current.records.findIndex((record) => recordKey(record.symbol, record.market) === recordKey(symbol, market));
        if (index < 0) throw new Error('This security is no longer saved on this device.');
        const existing = current.records[index];
        if (existing.notes !== expectedNote) throw new GuestWorkspaceConflictError(existing);
        const updated = parseResearchRecord({ ...existing, notes: note });
        const records = [...current.records];
        records[index] = updated;
        persist(current.guestId, records);
        // Consume equivalent backups only after the explicit saved-note write succeeds.
        // Different drafts in other tabs retain their own baselines and versions.
        removeDrafts(current.guestId ?? undefined, symbol, market, updated.notes);
        return updated;
    });

export const removeGuestSecurity = (symbol: string, market: ResearchMarket): Promise<void> =>
    withGuestWorkspaceLock(current => {
        const key = recordKey(symbol, market);
        const records = current.records.filter((record) => recordKey(record.symbol, record.market) !== key);
        if (records.length === current.records.length) return;
        persist(current.guestId, records);
        removeDrafts(current.guestId ?? undefined, symbol, market);
    });

export const exportGuestWorkspace = (): string => {
    const current = readWorkspace();
    return JSON.stringify({ version: 1, guestId: current.guestId, records: current.records.map(toGuestRecord) }, null, 2);
};

export const clearGuestWorkspace = (): Promise<void> => withGuestWriteLock(() => {
    const removed: [string, string][] = [];
    try {
        const store = storage();
        // Capture every byte before removing anything. Remove the identity last;
        // pending writes still validate it inside this same exclusive lock.
        const entries = [...draftKeys(), storageKey].map(key => [key, store.getItem(key)] as const);
        for (const [key, value] of entries) {
            if (value === null) continue;
            store.removeItem(key);
            removed.push([key, value]);
        }
    } catch {
        let restored = true;
        for (const [key, value] of removed) {
            try { storage().setItem(key, value); } catch { restored = false; }
        }
        if (!restored) throw new Error('Guest clear failed and browser storage prevented full recovery. Keep open notes available and copy or export remaining data before retrying.');
        throw new Error('Could not clear guest research from this browser. Check its storage settings and try again.');
    }
    window.dispatchEvent(new Event(GUEST_WORKSPACE_CLEARED_EVENT));
});
