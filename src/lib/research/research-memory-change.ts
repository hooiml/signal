import type {
    ResearchMemoryDecisionTrigger,
    ResearchMemoryEvidenceItem,
    ResearchMemoryFreshness,
    ResearchMemorySnapshot,
} from './research-memory.ts';

export type ResearchMemoryNumericChange = {
    readonly field: 'price' | 'forwardPe' | 'forwardEps' | 'revenueGrowthPct' | 'earningsGrowthPct';
    readonly previous: number;
    readonly current: number;
    readonly delta: number;
    readonly deltaPct: number | null;
};

export type ResearchMemoryEvidenceChange = {
    readonly kind: 'added' | 'removed' | 'changed';
    readonly evidenceId: string;
    readonly previous?: ResearchMemoryEvidenceItem;
    readonly current?: ResearchMemoryEvidenceItem;
};

export type ResearchMemoryFreshnessChange = {
    readonly evidenceId: string;
    readonly previous: ResearchMemoryFreshness;
    readonly current: ResearchMemoryFreshness;
};

export type ResearchMemoryTriggerEvaluation = {
    readonly trigger: ResearchMemoryDecisionTrigger;
    readonly matched: boolean;
    readonly reason: string;
};

export type ResearchMemorySnapshotDiff = {
    readonly ticker: string;
    readonly previousSnapshotId: string;
    readonly currentSnapshotId: string;
    readonly observedFrom: string;
    readonly observedTo: string;
    readonly numericChanges: readonly ResearchMemoryNumericChange[];
    readonly evidenceChanges: readonly ResearchMemoryEvidenceChange[];
    readonly freshnessChanges: readonly ResearchMemoryFreshnessChange[];
};

const numericFields = ['price', 'forwardPe', 'forwardEps', 'revenueGrowthPct', 'earningsGrowthPct'] as const;

const numericChange = (
    field: ResearchMemoryNumericChange['field'],
    previous: number | undefined,
    current: number | undefined,
): ResearchMemoryNumericChange | null => {
    if (previous === undefined || current === undefined || Object.is(previous, current)) return null;
    const delta = current - previous;
    return {
        field,
        previous,
        current,
        delta,
        deltaPct: previous === 0 ? null : (delta / Math.abs(previous)) * 100,
    };
};

const evidenceChanged = (previous: ResearchMemoryEvidenceItem, current: ResearchMemoryEvidenceItem) =>
    previous.label !== current.label
    || previous.detail !== current.detail
    || previous.direction !== current.direction
    || previous.strength !== current.strength
    || previous.freshness !== current.freshness
    || previous.sourceDate !== current.sourceDate
    || previous.thesisDimension !== current.thesisDimension;

export const diffResearchMemorySnapshots = (
    previous: ResearchMemorySnapshot,
    current: ResearchMemorySnapshot,
): ResearchMemorySnapshotDiff => {
    if (previous.ticker !== current.ticker) throw new Error('Cannot diff research-memory snapshots for different tickers');
    if (Date.parse(current.observedAt) < Date.parse(previous.observedAt)) throw new Error('Current research-memory snapshot predates previous snapshot');

    const previousEvidence = new Map(previous.evidence.map((item) => [item.id, item]));
    const currentEvidence = new Map(current.evidence.map((item) => [item.id, item]));
    const evidenceChanges: ResearchMemoryEvidenceChange[] = [];
    const freshnessChanges: ResearchMemoryFreshnessChange[] = [];

    for (const [id, item] of currentEvidence) {
        const before = previousEvidence.get(id);
        if (!before) evidenceChanges.push({ kind: 'added', evidenceId: id, current: item });
        else if (evidenceChanged(before, item)) evidenceChanges.push({ kind: 'changed', evidenceId: id, previous: before, current: item });
        if (before && before.freshness !== item.freshness) {
            freshnessChanges.push({ evidenceId: id, previous: before.freshness, current: item.freshness });
        }
    }

    for (const [id, item] of previousEvidence) {
        if (!currentEvidence.has(id)) evidenceChanges.push({ kind: 'removed', evidenceId: id, previous: item });
    }

    return {
        ticker: current.ticker,
        previousSnapshotId: previous.id,
        currentSnapshotId: current.id,
        observedFrom: previous.observedAt,
        observedTo: current.observedAt,
        numericChanges: numericFields.flatMap((field) => {
            const change = numericChange(field, previous[field], current[field]);
            return change ? [change] : [];
        }),
        evidenceChanges,
        freshnessChanges,
    };
};

export const evaluateResearchMemoryTrigger = (
    trigger: ResearchMemoryDecisionTrigger,
    previous: ResearchMemorySnapshot | null,
    current: ResearchMemorySnapshot,
): ResearchMemoryTriggerEvaluation => {
    if (trigger.ticker !== current.ticker) return { trigger, matched: false, reason: 'Ticker does not match active snapshot.' };
    const threshold = trigger.threshold;
    if (trigger.type !== 'manual' && (threshold === undefined || !Number.isFinite(threshold))) {
        return { trigger, matched: false, reason: 'Trigger threshold is unavailable.' };
    }

    const compare = (value: number | undefined, predicate: (value: number, threshold: number) => boolean, label: string) => {
        if (value === undefined || threshold === undefined) return { trigger, matched: false, reason: `${label} is unavailable.` };
        const matched = predicate(value, threshold);
        return { trigger, matched, reason: `${label} ${value} ${matched ? 'matches' : 'does not match'} threshold ${threshold}.` };
    };

    switch (trigger.type) {
        case 'price_below': return compare(current.price, (value, target) => value <= target, 'Price');
        case 'price_above': return compare(current.price, (value, target) => value >= target, 'Price');
        case 'forward_pe_below': return compare(current.forwardPe, (value, target) => value <= target, 'Forward P/E');
        case 'forward_pe_above': return compare(current.forwardPe, (value, target) => value >= target, 'Forward P/E');
        case 'forward_eps_change_pct': {
            const before = previous?.forwardEps;
            const after = current.forwardEps;
            if (before === undefined || after === undefined || before === 0 || threshold === undefined) {
                return { trigger, matched: false, reason: 'Forward EPS comparison is unavailable.' };
            }
            const changePct = ((after - before) / Math.abs(before)) * 100;
            const matched = Math.abs(changePct) >= Math.abs(threshold);
            return { trigger, matched, reason: `Forward EPS changed ${changePct.toFixed(2)}%; threshold is ${threshold}%.` };
        }
        case 'manual': return { trigger, matched: false, reason: 'Manual triggers require explicit user confirmation.' };
    }
};

export const summarizeResearchMemoryDiff = (diff: ResearchMemorySnapshotDiff) => {
    const added = diff.evidenceChanges.filter((change) => change.kind === 'added').length;
    const changed = diff.evidenceChanges.filter((change) => change.kind === 'changed').length;
    const removed = diff.evidenceChanges.filter((change) => change.kind === 'removed').length;
    const numeric = diff.numericChanges.length;
    return {
        changed: numeric + added + changed + removed > 0,
        headline: numeric + added + changed + removed === 0
            ? 'No material tracked changes since the previous review.'
            : `${numeric} metric change${numeric === 1 ? '' : 's'} · ${added} evidence added · ${changed} updated · ${removed} removed`,
        counts: { numeric, added, changed, removed, freshness: diff.freshnessChanges.length },
    };
};
