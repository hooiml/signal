import {
    productAnalyticsEventNames,
    productAnalyticsSources,
    productAnalyticsWorkspaces,
    type ProductAnalyticsAttributes,
    type ProductAnalyticsDailySummary,
    type ProductAnalyticsEvent,
    type ProductAnalyticsEventName,
    type ProductAnalyticsPathwaySummary,
    type ProductAnalyticsState,
    type ProductAnalyticsSummary,
    type ProductAnalyticsWorkspace,
    type ProductAnalyticsWorkspaceSummary,
} from './types/product-analytics';

export const PRODUCT_ANALYTICS_RETENTION_DAYS = 180;
export const PRODUCT_ANALYTICS_EVENT_LIMIT = 2_000;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}T/;
const meaningfulNames = new Set<ProductAnalyticsEventName>(productAnalyticsEventNames.filter((name) => name !== 'workspace_viewed'));
const attributeKeys: readonly (keyof ProductAnalyticsAttributes)[] = [
    'market', 'decision', 'format', 'mode', 'change', 'breakdown', 'comparison', 'result',
];
const eventKeys = ['id', 'sessionId', 'workflowId', 'name', 'surface', 'workspace', 'source', 'attributes', 'occurredAt'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
    typeof value === 'string' && values.includes(value as T);
const isIsoDate = (value: unknown): value is string =>
    typeof value === 'string' && isoDatePattern.test(value) && Number.isFinite(Date.parse(value));

const parseAttributes = (value: unknown): ProductAnalyticsAttributes => {
    if (!isRecord(value) || Object.keys(value).some((key) => !attributeKeys.includes(key as keyof ProductAnalyticsAttributes))) {
        throw new Error('Invalid product analytics attributes.');
    }
    const attributes: ProductAnalyticsAttributes = {};
    if (value.market !== undefined) {
        if (value.market !== 'US' && value.market !== 'MY') throw new Error('Invalid analytics market.');
        Object.assign(attributes, { market: value.market });
    }
    if (value.decision !== undefined) {
        const decisions = ['Ready', 'DCA', 'Wait for price', 'Watch', 'Avoid'] as const;
        if (!isOneOf(value.decision, decisions)) throw new Error('Invalid analytics decision.');
        Object.assign(attributes, { decision: value.decision });
    }
    if (value.format !== undefined) {
        if (value.format !== 'markdown' && value.format !== 'print') throw new Error('Invalid analytics format.');
        Object.assign(attributes, { format: value.format });
    }
    if (value.mode !== undefined) {
        if (value.mode !== 'daily' && value.mode !== 'urgent-only') throw new Error('Invalid analytics mode.');
        Object.assign(attributes, { mode: value.mode });
    }
    if (value.change !== undefined) {
        if (value.change !== 'add' && value.change !== 'remove') throw new Error('Invalid analytics change.');
        Object.assign(attributes, { change: value.change });
    }
    if (value.breakdown !== undefined) {
        if (value.breakdown !== 'decision' && value.breakdown !== 'confidence' && value.breakdown !== 'market') throw new Error('Invalid analytics breakdown.');
        Object.assign(attributes, { breakdown: value.breakdown });
    }
    if (value.comparison !== undefined) {
        if (value.comparison !== 'enabled' && value.comparison !== 'disabled') throw new Error('Invalid analytics comparison.');
        Object.assign(attributes, { comparison: value.comparison });
    }
    if (value.result !== undefined) {
        if (value.result !== 'success' && value.result !== 'failure') throw new Error('Invalid analytics result.');
        Object.assign(attributes, { result: value.result });
    }
    return attributes;
};

export const parseProductAnalyticsEvent = (value: unknown): ProductAnalyticsEvent => {
    if (!isRecord(value)
        || Object.keys(value).some((key) => !eventKeys.includes(key as typeof eventKeys[number]))
        || typeof value.id !== 'string' || !uuidPattern.test(value.id)
        || typeof value.sessionId !== 'string' || !uuidPattern.test(value.sessionId)
        || value.workflowId !== undefined && value.workflowId !== null
            && (typeof value.workflowId !== 'string' || !uuidPattern.test(value.workflowId))
        || !isOneOf(value.name, productAnalyticsEventNames)
        || (value.surface !== 'market' && value.surface !== 'research')
        || !isOneOf(value.workspace, productAnalyticsWorkspaces)
        || value.source !== null && !isOneOf(value.source, productAnalyticsSources)
        || !isIsoDate(value.occurredAt)) {
        throw new Error('Invalid product analytics event.');
    }
    return {
        id: value.id,
        sessionId: value.sessionId,
        workflowId: typeof value.workflowId === 'string' ? value.workflowId : null,
        name: value.name,
        surface: value.surface,
        workspace: value.workspace,
        source: value.source,
        attributes: parseAttributes(value.attributes),
        occurredAt: value.occurredAt,
    };
};

export const pruneProductAnalyticsEvents = (
    events: readonly ProductAnalyticsEvent[],
    now: Date,
): readonly ProductAnalyticsEvent[] => {
    const cutoff = now.getTime() - PRODUCT_ANALYTICS_RETENTION_DAYS * 86_400_000;
    const deduplicated = new Map<string, ProductAnalyticsEvent>();
    for (const event of events) {
        const timestamp = Date.parse(event.occurredAt);
        if (timestamp >= cutoff && timestamp <= now.getTime() + 300_000) deduplicated.set(event.id, event);
    }
    return [...deduplicated.values()]
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
        .slice(0, PRODUCT_ANALYTICS_EVENT_LIMIT);
};

export const parseProductAnalyticsState = (value: unknown, now = new Date()): ProductAnalyticsState => {
    if (!isRecord(value) || value.version !== 1 || typeof value.enabled !== 'boolean' || !Array.isArray(value.events)) {
        return { version: 1, enabled: true, events: [] };
    }
    const events = value.events.flatMap((event): readonly ProductAnalyticsEvent[] => {
        try {
            return [parseProductAnalyticsEvent(event)];
        } catch {
            return [];
        }
    });
    return {
        version: 1,
        enabled: value.enabled,
        events: pruneProductAnalyticsEvents(events, now),
    };
};

export const appendProductAnalyticsEvent = (
    state: ProductAnalyticsState,
    event: ProductAnalyticsEvent,
    now = new Date(),
): ProductAnalyticsState => ({
    version: 1,
    enabled: state.enabled,
    events: pruneProductAnalyticsEvents([event, ...state.events], now),
});

const percentage = (numerator: number, denominator: number): number | null =>
    denominator === 0 ? null : Math.min(100, Math.round((numerator / denominator) * 100));

const dateKey = (value: string): string => value.slice(0, 10);

export const buildProductAnalyticsSummary = (
    events: readonly ProductAnalyticsEvent[],
    rangeDays: 7 | 30 | 90,
    now = new Date(),
): ProductAnalyticsSummary => {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const start = today - (rangeDays - 1) * 86_400_000;
    const inRange = events
        .filter((event) => {
            const time = Date.parse(event.occurredAt);
            return time >= start && time < today + 86_400_000;
        })
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    const reviewOpened = inRange.filter((event) => event.name === 'review_opened').length;
    const reviewSavedEvents = inRange.filter((event) => event.name === 'review_saved' && event.attributes.result !== 'failure');
    const reviewSaved = reviewSavedEvents.length;
    const workspaceGroups = new Map<ProductAnalyticsWorkspace, ProductAnalyticsEvent[]>();
    for (const event of inRange.filter((candidate) => candidate.name === 'workspace_viewed')) {
        workspaceGroups.set(event.workspace, [...(workspaceGroups.get(event.workspace) ?? []), event]);
    }
    const workspaces: readonly ProductAnalyticsWorkspaceSummary[] = [...workspaceGroups.entries()]
        .map(([workspace, grouped]) => ({
            workspace,
            views: grouped.length,
            sessions: new Set(grouped.map((event) => event.sessionId)).size,
            lastUsedAt: grouped[0]?.occurredAt ?? '',
        }))
        .sort((left, right) => right.views - left.views || left.workspace.localeCompare(right.workspace));
    const pathways: readonly ProductAnalyticsPathwaySummary[] = productAnalyticsSources.flatMap((source) => {
        const sourceEvents = inRange.filter((event) => event.source === source);
        const openingEvents = sourceEvents.filter((event) => event.name === 'review_opened' || event.name === 'workflow_opened');
        const openedWorkflowIds = new Set(openingEvents.flatMap((event) => event.workflowId ? [event.workflowId] : []));
        const completionEvents = sourceEvents.filter((event) =>
            (event.name === 'review_saved' && event.attributes.result !== 'failure')
            || event.name === 'workflow_completed');
        const matchedCompletions = completionEvents.filter((event) =>
            event.workflowId === null || openedWorkflowIds.has(event.workflowId));
        const opened = openingEvents.length;
        const saved = completionEvents.filter((event) => event.name === 'review_saved').length;
        const completed = matchedCompletions.length;
        return opened === 0 && completed === 0 ? [] : [{
            source,
            opened,
            saved,
            completed,
            completionPercent: percentage(completed, Math.max(opened, completed)),
            activeDays: new Set(sourceEvents.map((event) => dateKey(event.occurredAt))).size,
            lastUsedAt: sourceEvents[0]?.occurredAt ?? '',
        }];
    }).sort((left, right) => right.opened - left.opened || right.completed - left.completed);
    const daily: ProductAnalyticsDailySummary[] = [];
    for (let offset = 0; offset < rangeDays; offset += 1) {
        const date = new Date(start + offset * 86_400_000).toISOString().slice(0, 10);
        const matching = inRange.filter((event) => dateKey(event.occurredAt) === date);
        daily.push({
            date,
            events: matching.length,
            meaningfulActions: matching.filter((event) => meaningfulNames.has(event.name)).length,
        });
    }
    return {
        rangeDays,
        eventCount: inRange.length,
        activeDays: new Set(inRange.map((event) => dateKey(event.occurredAt))).size,
        sessions: new Set(inRange.map((event) => event.sessionId)).size,
        meaningfulActions: inRange.filter((event) => meaningfulNames.has(event.name)).length,
        reviewOpened,
        reviewSaved,
        reviewCompletionPercent: percentage(reviewSaved, Math.max(reviewOpened, reviewSaved)),
        guidedReviewSaved: reviewSavedEvents.filter((event) => event.source !== null && event.source !== 'direct').length,
        packetExports: inRange.filter((event) => event.name === 'packet_exported').length,
        workspaces,
        pathways,
        daily,
        recent: inRange.slice(0, 20),
    };
};
