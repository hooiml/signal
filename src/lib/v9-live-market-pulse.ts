import { marketEvidenceDay } from './market-evidence-coverage';
import type { SignalConfig } from './signal-config';
import type { MarketSignal } from './types/signal-v2';

type PulseSnapshot = {
    readonly snapshotDate: string;
    readonly savedAt?: string;
    readonly history?: readonly { readonly date: string }[];
};

export function getLivePulseSnapshot(signal: MarketSignal | null): PulseSnapshot | null {
    const persistence = signal?.metadata.snapshot_persistence;
    const snapshotDate = marketEvidenceDay(signal?.metadata.score_delta?.snapshot_date)
        ?? (persistence?.status === 'persisted' ? marketEvidenceDay(persistence.snapshot_date) : null);
    if (!snapshotDate) return null;

    const savedAt = persistence?.status === 'persisted' && persistence.snapshot_date === snapshotDate
        ? persistence.updated_at : undefined;
    const history = signal?.metadata.score_history;
    return {
        snapshotDate,
        savedAt: typeof savedAt === 'string' && savedAt.includes('T') && marketEvidenceDay(savedAt) ? savedAt : undefined,
        history,
    };
}

/** Replacing an archived reading requires a complete score and history point of its own. */
export function isCompletePulse(signal: MarketSignal | null, config: SignalConfig, previous?: PulseSnapshot | null): boolean {
    if (!signal || signal.metadata.market !== config.market || signal.mode !== config.mode
        || (signal.metadata.source_included ?? config.enableSocial) !== config.enableSocial
        || !Number.isFinite(signal.composite_score)
        || !Object.values(signal.components).some(component => component.enabled && component.weight > 0)) return false;
    if (!previous) return true;

    const snapshot = getLivePulseSnapshot(signal);
    if (!snapshot || snapshot.snapshotDate < previous.snapshotDate) return false;
    if (snapshot.snapshotDate === previous.snapshotDate && previous.savedAt
        && (!snapshot.savedAt || Date.parse(snapshot.savedAt) < Date.parse(previous.savedAt))) return false;

    let current: NonNullable<MarketSignal['metadata']['score_history']>[number] | undefined;
    let hasEarlierPoint = false;
    for (const point of signal.metadata.score_history ?? []) {
        if (point.date > snapshot.snapshotDate) return false;
        if (point.date < snapshot.snapshotDate) hasEarlierPoint = true;
        if (point.date === snapshot.snapshotDate && (!current || point.origin === 'observed')) current = point;
    }
    return current !== undefined && current.origin !== 'reconstructed'
        && current.score === signal.composite_score && current.tier === signal.tier
        && (hasEarlierPoint || !previous.history?.some(point => point.date < previous.snapshotDate));
}
