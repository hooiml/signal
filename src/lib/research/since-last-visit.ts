import type { ResearchRecord } from '../types/research';
import type { SignalTier } from '../types/signal-v2';

export type ResearchVisitRecordSnapshot = {
    readonly symbol: string;
    readonly market: ResearchRecord['market'];
    readonly revision: number;
    readonly updatedAt: string;
    readonly lastReviewedAt: string;
    readonly nextReviewAt: string | null;
    readonly reviewAgeDays: number | null;
    readonly evidenceFingerprint: readonly string[];
};

export type ResearchVisitSnapshot = {
    readonly version: 1;
    readonly capturedAt: string;
    readonly records: readonly ResearchVisitRecordSnapshot[];
    readonly markets: readonly ResearchVisitMarketSnapshot[];
};

export type ResearchVisitMarketSnapshot = {
    readonly market: ResearchRecord['market'];
    readonly tier: SignalTier;
    readonly score: number;
    readonly snapshotAt: string;
};

export type SinceLastVisitChanges = {
    readonly state: 'baseline' | 'tracked';
    readonly capturedAt: string | null;
    readonly newSymbols: readonly string[];
    readonly revisedSymbols: readonly string[];
    readonly evidenceChangedSymbols: readonly string[];
    readonly overdueReviewSymbols: readonly string[];
};

export type SinceLastVisitBriefingInput = {
    readonly changes: SinceLastVisitChanges;
    readonly previous: ResearchVisitSnapshot | null;
    readonly currentMarkets: readonly ResearchVisitMarketSnapshot[];
    readonly events: readonly {
        readonly symbol: string | null;
        readonly type: 'review' | 'earnings' | 'stale' | 'dividend' | 'cash-flow';
        readonly date: string;
    }[];
    readonly alerts: readonly {
        readonly symbol: string;
        readonly severity: 'risk' | 'opportunity' | 'watch';
    }[];
    readonly policyViolations: readonly {
        readonly symbol: string;
        readonly count: number;
    }[];
    readonly sourceIssues: readonly {
        readonly name: string;
        readonly affectedFeatures: readonly string[];
    }[];
    readonly queueTasks?: readonly {
        readonly id: string;
        readonly symbol: string;
        readonly dueAt: string;
    }[];
    readonly attentionCount: number;
    readonly unreadCount: number;
};

export type SinceLastVisitMarketChange = ResearchVisitMarketSnapshot & {
    readonly priorTier: SignalTier | null;
    readonly priorScore: number | null;
    readonly direction: 'new' | 'improved' | 'weakened' | 'unchanged';
};

export type SinceLastVisitAction = {
    readonly id: string;
    readonly kind: 'source' | 'risk-alert' | 'policy' | 'overdue-review' | 'queue' | 'earnings' | 'evidence' | 'market';
    readonly symbol: string | null;
    readonly label: string;
    readonly detail: string;
    readonly workspace: 'alerts' | 'policy' | 'calendar' | 'changes' | 'health' | 'research' | 'queue';
    readonly priority: number;
};

export type SinceLastVisitBriefing = {
    readonly marketChanges: readonly SinceLastVisitMarketChange[];
    readonly upcomingEvents: SinceLastVisitBriefingInput['events'];
    readonly alerts: SinceLastVisitBriefingInput['alerts'];
    readonly policyViolations: SinceLastVisitBriefingInput['policyViolations'];
    readonly sourceIssues: SinceLastVisitBriefingInput['sourceIssues'];
    readonly attentionCount: number;
    readonly unreadCount: number;
    readonly topActions: readonly SinceLastVisitAction[];
};

const validTimestamp = (value: unknown): value is string =>
    typeof value === 'string' && Number.isFinite(Date.parse(value));

const validDate = (value: unknown): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));

const evidenceFingerprint = (record: ResearchRecord): readonly string[] =>
    record.acceptedEvidence.flatMap((finding) => finding.sources.map((source) =>
        [
            finding.target,
            finding.tone,
            source.id,
            source.value,
            source.reportingPeriod ?? '',
            source.sourceUrl,
        ].join('|'))).sort();

const visitRecordSnapshot = (record: ResearchRecord): ResearchVisitRecordSnapshot => ({
    symbol: record.symbol,
    market: record.market,
    revision: record.revision,
    updatedAt: record.updatedAt,
    lastReviewedAt: record.lastReviewedAt,
    nextReviewAt: record.decisionJournal.nextReviewAt,
    reviewAgeDays: record.monitoringRules.reviewAgeDays,
    evidenceFingerprint: evidenceFingerprint(record),
});

export const buildResearchVisitSnapshot = (
    records: readonly ResearchRecord[],
    capturedAt: string,
    markets: readonly ResearchVisitMarketSnapshot[] = [],
): ResearchVisitSnapshot => ({
    version: 1,
    capturedAt: new Date(capturedAt).toISOString(),
    records: records
        .map(visitRecordSnapshot)
        .sort((left, right) => left.symbol.localeCompare(right.symbol))
        .slice(0, 100),
    markets: [...markets]
        .sort((left, right) => left.market.localeCompare(right.market))
        .slice(0, 2),
});

const parseVisitRecord = (value: unknown): ResearchVisitRecordSnapshot | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = Object.fromEntries(Object.entries(value));
    const symbol = typeof candidate.symbol === 'string' ? candidate.symbol.trim().toUpperCase() : '';
    if (!/^[A-Z0-9.-]{1,15}$/.test(symbol)
        || (candidate.market !== 'US' && candidate.market !== 'MY')
        || typeof candidate.revision !== 'number'
        || !Number.isInteger(candidate.revision)
        || candidate.revision < 0
        || !validTimestamp(candidate.updatedAt)
        || !validTimestamp(candidate.lastReviewedAt)
        || (candidate.nextReviewAt !== null && !validDate(candidate.nextReviewAt))
        || (candidate.reviewAgeDays !== null
            && (typeof candidate.reviewAgeDays !== 'number'
                || !Number.isInteger(candidate.reviewAgeDays)
                || candidate.reviewAgeDays < 1
                || candidate.reviewAgeDays > 365))
        || !Array.isArray(candidate.evidenceFingerprint)
        || !candidate.evidenceFingerprint.every((entry) => typeof entry === 'string' && entry.length <= 1_000)) return null;
    return {
        symbol,
        market: candidate.market,
        revision: candidate.revision,
        updatedAt: new Date(candidate.updatedAt).toISOString(),
        lastReviewedAt: new Date(candidate.lastReviewedAt).toISOString(),
        nextReviewAt: candidate.nextReviewAt,
        reviewAgeDays: candidate.reviewAgeDays,
        evidenceFingerprint: [...candidate.evidenceFingerprint].sort().slice(0, 200),
    };
};

export const parseResearchVisitSnapshot = (value: unknown): ResearchVisitSnapshot | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const candidate = Object.fromEntries(Object.entries(value));
    if (candidate.version !== 1 || !validTimestamp(candidate.capturedAt) || !Array.isArray(candidate.records)) return null;
    const records = candidate.records.map(parseVisitRecord);
    if (records.some((record) => record === null)) return null;
    const parsed = records as ResearchVisitRecordSnapshot[];
    const identities = new Set(parsed.map((record) => `${record.market}:${record.symbol}`));
    if (identities.size !== parsed.length) return null;
    const marketValues = candidate.markets === undefined ? [] : candidate.markets;
    if (!Array.isArray(marketValues)) return null;
    const tiers: readonly SignalTier[] = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
    const markets = marketValues.flatMap((entry): ResearchVisitMarketSnapshot[] => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const market = Object.fromEntries(Object.entries(entry));
        if ((market.market !== 'US' && market.market !== 'MY')
            || typeof market.tier !== 'string'
            || !tiers.includes(market.tier as SignalTier)
            || typeof market.score !== 'number'
            || !Number.isFinite(market.score)
            || market.score < 0
            || market.score > 100
            || !validTimestamp(market.snapshotAt)) return [];
        return [{
            market: market.market,
            tier: market.tier as SignalTier,
            score: market.score,
            snapshotAt: new Date(market.snapshotAt).toISOString(),
        }];
    });
    if (markets.length !== marketValues.length || new Set(markets.map((market) => market.market)).size !== markets.length) return null;
    return {
        version: 1,
        capturedAt: new Date(candidate.capturedAt).toISOString(),
        records: parsed.slice(0, 100),
        markets,
    };
};

const reviewDueAt = (record: ResearchRecord): number | null => {
    if (record.decisionJournal.nextReviewAt) {
        return Date.parse(`${record.decisionJournal.nextReviewAt}T23:59:59.999Z`);
    }
    if (record.monitoringRules.reviewAgeDays === null) return null;
    return Date.parse(record.lastReviewedAt) + record.monitoringRules.reviewAgeDays * 86_400_000;
};

export const buildSinceLastVisitChanges = (
    records: readonly ResearchRecord[],
    previous: ResearchVisitSnapshot | null,
    now: string,
): SinceLastVisitChanges => {
    const nowTime = Date.parse(now);
    const overdueReviewSymbols = records
        .filter((record) => {
            const dueAt = reviewDueAt(record);
            return dueAt !== null && Number.isFinite(nowTime) && dueAt < nowTime;
        })
        .map((record) => record.symbol)
        .sort();
    if (!previous) {
        return {
            state: 'baseline',
            capturedAt: null,
            newSymbols: [],
            revisedSymbols: [],
            evidenceChangedSymbols: [],
            overdueReviewSymbols,
        };
    }
    const prior = new Map(previous.records.map((record) => [`${record.market}:${record.symbol}`, record]));
    const newSymbols: string[] = [];
    const revisedSymbols: string[] = [];
    const evidenceChangedSymbols: string[] = [];
    for (const record of records) {
        const earlier = prior.get(`${record.market}:${record.symbol}`);
        if (!earlier) {
            newSymbols.push(record.symbol);
            continue;
        }
        if (record.revision > earlier.revision || Date.parse(record.updatedAt) > Date.parse(earlier.updatedAt)) {
            revisedSymbols.push(record.symbol);
        }
        if (JSON.stringify(evidenceFingerprint(record)) !== JSON.stringify(earlier.evidenceFingerprint)) {
            evidenceChangedSymbols.push(record.symbol);
        }
    }
    return {
        state: 'tracked',
        capturedAt: previous.capturedAt,
        newSymbols: newSymbols.sort(),
        revisedSymbols: revisedSymbols.sort(),
        evidenceChangedSymbols: evidenceChangedSymbols.sort(),
        overdueReviewSymbols,
    };
};

const tierStrength: Readonly<Record<SignalTier, number>> = {
    'strong-sell': 0,
    sell: 1,
    neutral: 2,
    buy: 3,
    'strong-buy': 4,
};

const action = (
    value: Omit<SinceLastVisitAction, 'priority'>,
    priority: number,
): SinceLastVisitAction => ({ ...value, priority });

export const buildSinceLastVisitBriefing = (
    input: SinceLastVisitBriefingInput,
): SinceLastVisitBriefing => {
    const previousMarkets = new Map((input.previous?.markets ?? []).map((market) => [market.market, market]));
    const marketChanges = input.currentMarkets.map((market): SinceLastVisitMarketChange => {
        const prior = previousMarkets.get(market.market);
        const direction = !prior ? 'new'
            : tierStrength[market.tier] > tierStrength[prior.tier] ? 'improved'
                : tierStrength[market.tier] < tierStrength[prior.tier] ? 'weakened'
                    : 'unchanged';
        return {
            ...market,
            priorTier: prior?.tier ?? null,
            priorScore: prior?.score ?? null,
            direction,
        };
    });
    const actions: SinceLastVisitAction[] = [];
    for (const source of input.sourceIssues.filter((item) => item.affectedFeatures.length > 0)) {
        actions.push(action({
            id: `source:${source.name}`,
            kind: 'source',
            symbol: null,
            label: `${source.name} is degraded`,
            detail: `Affected: ${source.affectedFeatures.join(', ')}.`,
            workspace: 'health',
        }, 110));
    }
    for (const alert of input.alerts.filter((item) => item.severity === 'risk')) {
        actions.push(action({
            id: `risk:${alert.symbol}`,
            kind: 'risk-alert',
            symbol: alert.symbol,
            label: `${alert.symbol} has an active risk condition`,
            detail: 'Review the current alert before another portfolio decision.',
            workspace: 'alerts',
        }, 100));
    }
    for (const violation of input.policyViolations.filter((item) => item.count > 0)) {
        actions.push(action({
            id: `policy:${violation.symbol}`,
            kind: 'policy',
            symbol: violation.symbol,
            label: `${violation.symbol} exceeds ${violation.count} policy limit${violation.count === 1 ? '' : 's'}`,
            detail: 'Review the advisory guardrail evidence without changing the saved decision.',
            workspace: 'policy',
        }, 95));
    }
    for (const symbol of input.changes.overdueReviewSymbols) {
        actions.push(action({
            id: `overdue:${symbol}`,
            kind: 'overdue-review',
            symbol,
            label: `${symbol} review is overdue`,
            detail: 'Revisit the thesis, invalidation conditions, and next decision.',
            workspace: 'calendar',
        }, 90));
    }
    for (const task of input.queueTasks ?? []) {
        actions.push(action({
            id: `queue:${task.id}`,
            kind: 'queue',
            symbol: task.symbol,
            label: `${task.symbol} queued review is due`,
            detail: `Due ${task.dueAt}. Open the owning Queue task before updating research.`,
            workspace: 'queue',
        }, 85));
    }
    for (const event of input.events.filter((item) => item.type === 'earnings' && item.symbol !== null)) {
        actions.push(action({
            id: `earnings:${event.symbol}:${event.date}`,
            kind: 'earnings',
            symbol: event.symbol,
            label: `${event.symbol} earnings on ${event.date}`,
            detail: 'Review accepted evidence and event expectations before the source date.',
            workspace: 'calendar',
        }, 80));
    }
    for (const symbol of input.changes.evidenceChangedSymbols) {
        actions.push(action({
            id: `evidence:${symbol}`,
            kind: 'evidence',
            symbol,
            label: `${symbol} accepted evidence changed`,
            detail: 'Inspect the source values and reporting periods before updating the thesis.',
            workspace: 'changes',
        }, 70));
    }
    for (const market of marketChanges.filter((item) => item.priorTier !== null && item.direction !== 'unchanged')) {
        actions.push(action({
            id: `market:${market.market}`,
            kind: 'market',
            symbol: null,
            label: `${market.market} posture ${market.direction}`,
            detail: `${market.priorTier} ${market.priorScore} → ${market.tier} ${market.score}.`,
            workspace: 'research',
        }, 60));
    }
    for (const source of input.sourceIssues.filter((item) => item.affectedFeatures.length === 0)) {
        actions.push(action({
            id: `source:${source.name}`,
            kind: 'source',
            symbol: null,
            label: `${source.name} is degraded`,
            detail: source.affectedFeatures.length > 0
                ? `Affected: ${source.affectedFeatures.join(', ')}.`
                : 'Review the source-health detail before relying on affected evidence.',
            workspace: 'health',
        }, 50));
    }
    const uniqueActions = [...new Map(
        actions
            .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id))
            .map((item) => [item.id, item]),
    ).values()].slice(0, 3);
    return {
        marketChanges,
        upcomingEvents: input.events,
        alerts: input.alerts,
        policyViolations: input.policyViolations,
        sourceIssues: input.sourceIssues,
        attentionCount: Math.max(0, Math.floor(input.attentionCount)),
        unreadCount: Math.max(0, Math.floor(input.unreadCount)),
        topActions: uniqueActions,
    };
};
