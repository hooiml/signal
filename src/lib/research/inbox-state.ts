import type { ResearchInboxItem } from '../types/research-inbox';

export const RESEARCH_INBOX_STATE_KEY = 'signal-research-inbox-v1';

export type InboxSnapshot = Readonly<Record<string, { readonly signature: string; readonly proximity: string }>>;
export type ResearchInboxLocalState = {
    readonly seen: Readonly<Record<string, string>>;
    readonly snoozed: Readonly<Record<string, string>>;
    readonly snapshot: InboxSnapshot;
    readonly checkedAt: string | null;
};

export const emptyInboxState = (): ResearchInboxLocalState => ({ seen: {}, snoozed: {}, snapshot: {}, checkedAt: null });
export const inboxItemSignature = (item: ResearchInboxItem): string => `${item.title}|${item.detail}|${item.proximity}|${item.eventDate ?? ''}`;
export const snapshotInboxItems = (items: readonly ResearchInboxItem[]): InboxSnapshot => Object.fromEntries(items.map((item) => [item.id, {
    signature: inboxItemSignature(item), proximity: item.proximity,
}]));

export const inboxItemChange = (item: ResearchInboxItem, previous: InboxSnapshot, hasPriorCheck: boolean): string | null => {
    if (!hasPriorCheck) return null;
    const prior = previous[item.id];
    if (!prior) return 'New since last check';
    if (prior.signature === inboxItemSignature(item)) return null;
    return prior.proximity === item.proximity ? 'Condition updated since last check' : `${prior.proximity} → ${item.proximity}`;
};

const stringRecord = (value: unknown): Record<string, string> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
};

export const parseInboxState = (value: unknown): ResearchInboxLocalState => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return emptyInboxState();
    const record = Object.fromEntries(Object.entries(value));
    const snapshot = typeof record.snapshot === 'object' && record.snapshot !== null && !Array.isArray(record.snapshot)
        ? Object.fromEntries(Object.entries(record.snapshot).flatMap(([id, entry]) => {
            if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return [];
            const item = Object.fromEntries(Object.entries(entry));
            return typeof item.signature === 'string' && typeof item.proximity === 'string' ? [[id, { signature: item.signature, proximity: item.proximity }]] : [];
        }))
        : {};
    return {
        seen: stringRecord(record.seen),
        snoozed: stringRecord(record.snoozed),
        snapshot,
        checkedAt: typeof record.checkedAt === 'string' ? record.checkedAt : null,
    };
};
