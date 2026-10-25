export const FIRST_VISIT_KEY = 'signal-v8-first-visit-v1';
export const FIRST_VISIT_EVENT = 'signal:v8-first-visit-change';
const stages = ['market', 'stock', 'save', 'skipped', 'complete'] as const;
export type FirstVisitStage = typeof stages[number];
export type FirstVisitState = { readonly version: 1; readonly stage: FirstVisitStage; readonly revision: number };
export type FirstVisitRead =
    | { status: 'missing' | 'ready'; state: FirstVisitState }
    | { status: 'invalid' | 'unavailable'; state: null; error: string };
const initial: FirstVisitState = { version: 1, stage: 'market', revision: 0 };

export function parseFirstVisit(value: unknown): FirstVisitState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid tour state.');
    const item = value as Record<string, unknown>;
    if (Object.keys(item).length !== 3 || Object.keys(item).some(key => !['version', 'stage', 'revision'].includes(key))
        || item.version !== 1 || !stages.includes(item.stage as FirstVisitStage)
        || !Number.isSafeInteger(item.revision) || (item.revision as number) < 0) throw new Error('Invalid tour state.');
    return { version: 1, stage: item.stage as FirstVisitStage, revision: item.revision as number };
}

export function readFirstVisit(): FirstVisitRead {
    let raw: string | null;
    try { raw = window.localStorage.getItem(FIRST_VISIT_KEY); }
    catch { return { status: 'unavailable', state: null, error: 'Tour progress could not be read because browser storage is unavailable. Browsing still works.' }; }
    if (raw === null) return { status: 'missing', state: initial };
    try { return { status: 'ready', state: parseFirstVisit(JSON.parse(raw)) }; }
    catch { return { status: 'invalid', state: null, error: 'Tour progress could not be read. Saved bytes were kept. Restart the tour in Settings to replace them.' }; }
}

function nextRevision(revision: number): number {
    if (revision >= Number.MAX_SAFE_INTEGER) throw new Error('Tour progress was not saved: its revision limit was reached.');
    return revision + 1;
}

function freshRevision(): number {
    const random = crypto.getRandomValues(new Uint32Array(2));
    return 2 ** 40 + (random[0] & 0xfffff) * 2 ** 32 + random[1];
}

async function withLock<T>(operation: () => T): Promise<T> {
    let locks: LockManager | undefined;
    try { locks = navigator.locks; } catch { /* Fail closed when safe writes are unavailable. */ }
    if (!locks?.request) throw new Error('Tour progress was not saved: this browser cannot safely coordinate tabs. Browsing still works.');
    return locks.request(FIRST_VISIT_KEY, { mode: 'exclusive' }, operation);
}

function write(state: FirstVisitState): FirstVisitState {
    try { window.localStorage.setItem(FIRST_VISIT_KEY, JSON.stringify(parseFirstVisit(state))); }
    catch { throw new Error('Tour progress was not saved. Allow browser storage and try again; browsing still works.'); }
    window.dispatchEvent(new Event(FIRST_VISIT_EVENT));
    return state;
}

/** Compare inside the lock: late observations and Saves cannot revive a dismissed/restarted tour. */
export async function advanceFirstVisit(expected: FirstVisitState, next: FirstVisitStage): Promise<boolean> {
    parseFirstVisit(expected);
    const allowed = (expected.stage === 'market' && next === 'stock')
        || (expected.stage === 'stock' && next === 'save')
        || (expected.stage === 'save' && next === 'complete')
        || (!['skipped', 'complete'].includes(expected.stage) && next === 'skipped');
    if (!allowed) throw new Error('Invalid tour transition.');
    return withLock(() => {
        const current = readFirstVisit();
        if (!current.state) throw new Error(current.error);
        if (current.state.revision !== expected.revision || current.state.stage !== expected.stage) return false;
        write({ version: 1, stage: next, revision: current.status === 'missing' ? freshRevision() : nextRevision(current.state.revision) });
        return true;
    });
}

/** Explicit Settings action only. Never changes the route, workspace, drafts, or provider state. */
export async function restartFirstVisit(): Promise<void> {
    await withLock(() => {
        const current = readFirstVisit();
        if (current.status === 'unavailable') throw new Error(current.error);
        // A fresh high revision prevents old callbacks matching a repaired, formerly corrupt state.
        const revision = current.status === 'ready' ? nextRevision(current.state.revision) : freshRevision();
        write({ version: 1, stage: 'market', revision });
    });
}

export function subscribeFirstVisit(listener: () => void): () => void {
    const changed = (event: StorageEvent) => { if (event.key === FIRST_VISIT_KEY || event.key === null) listener(); };
    window.addEventListener('storage', changed);
    window.addEventListener(FIRST_VISIT_EVENT, listener);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener(FIRST_VISIT_EVENT, listener); };
}
