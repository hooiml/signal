import {
    appendProductAnalyticsEvent,
    parseProductAnalyticsState,
} from './product-analytics';
import type {
    ProductAnalyticsAttributes,
    ProductAnalyticsEvent,
    ProductAnalyticsEventName,
    ProductAnalyticsSource,
    ProductAnalyticsState,
    ProductAnalyticsWorkspace,
} from './types/product-analytics';

export const PRODUCT_ANALYTICS_STORAGE_KEY = 'signal-product-analytics-v1';
export const PRODUCT_ANALYTICS_CHANGE_EVENT = 'signal:product-analytics-change';
const PRODUCT_ANALYTICS_SESSION_KEY = 'signal-product-analytics-session-v1';
const PRODUCT_ANALYTICS_SOURCE_KEY = 'signal-product-analytics-source-v1';

const emptyState: ProductAnalyticsState = { version: 1, enabled: true, events: [] };

export const readProductAnalyticsState = (): ProductAnalyticsState => {
    if (typeof window === 'undefined') return emptyState;
    try {
        const raw = window.localStorage.getItem(PRODUCT_ANALYTICS_STORAGE_KEY);
        return raw ? parseProductAnalyticsState(JSON.parse(raw)) : emptyState;
    } catch {
        return emptyState;
    }
};

const writeProductAnalyticsState = (state: ProductAnalyticsState): void => {
    window.localStorage.setItem(PRODUCT_ANALYTICS_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(PRODUCT_ANALYTICS_CHANGE_EVENT));
};

const sessionId = (): string => {
    const current = window.sessionStorage.getItem(PRODUCT_ANALYTICS_SESSION_KEY);
    if (current) return current;
    const next = window.crypto.randomUUID();
    window.sessionStorage.setItem(PRODUCT_ANALYTICS_SESSION_KEY, next);
    return next;
};

export const setProductAnalyticsEnabled = (enabled: boolean): ProductAnalyticsState => {
    const current = readProductAnalyticsState();
    const next = { ...current, enabled };
    writeProductAnalyticsState(next);
    return next;
};

export const clearProductAnalyticsHistory = (): ProductAnalyticsState => {
    const current = readProductAnalyticsState();
    const next: ProductAnalyticsState = { version: 1, enabled: current.enabled, events: [] };
    writeProductAnalyticsState(next);
    return next;
};

export const setProductAnalyticsWorkflowSource = (source: ProductAnalyticsSource): void => {
    if (typeof window !== 'undefined') window.sessionStorage.setItem(PRODUCT_ANALYTICS_SOURCE_KEY, source);
};

export const currentProductAnalyticsWorkflowSource = (): ProductAnalyticsSource => {
    if (typeof window === 'undefined') return 'direct';
    const value = window.sessionStorage.getItem(PRODUCT_ANALYTICS_SOURCE_KEY);
    const allowed: readonly ProductAnalyticsSource[] = ['direct', 'market', 'inbox', 'alerts', 'calendar', 'portfolio', 'peers', 'outcomes', 'discovery', 'compare'];
    return allowed.includes(value as ProductAnalyticsSource) ? value as ProductAnalyticsSource : 'direct';
};

export const clearProductAnalyticsWorkflowSource = (): void => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(PRODUCT_ANALYTICS_SOURCE_KEY);
};

export const trackProductAnalyticsEvent = ({
    name,
    surface,
    workspace,
    source = null,
    attributes = {},
}: {
    readonly name: ProductAnalyticsEventName;
    readonly surface: ProductAnalyticsEvent['surface'];
    readonly workspace: ProductAnalyticsWorkspace;
    readonly source?: ProductAnalyticsSource | null;
    readonly attributes?: ProductAnalyticsAttributes;
}): ProductAnalyticsEvent | null => {
    if (typeof window === 'undefined') return null;
    const current = readProductAnalyticsState();
    if (!current.enabled) return null;
    const currentSessionId = sessionId();
    const now = new Date();
    const duplicateWindowMs = name === 'workspace_viewed' ? 5_000 : 500;
    const duplicate = current.events.find((event) =>
        event.sessionId === currentSessionId
        && event.name === name
        && event.workspace === workspace
        && event.source === source
        && JSON.stringify(event.attributes) === JSON.stringify(attributes)
        && now.getTime() - Date.parse(event.occurredAt) <= duplicateWindowMs,
    );
    if (duplicate) return null;
    const event: ProductAnalyticsEvent = {
        id: window.crypto.randomUUID(),
        sessionId: currentSessionId,
        name,
        surface,
        workspace,
        source,
        attributes,
        occurredAt: now.toISOString(),
    };
    writeProductAnalyticsState(appendProductAnalyticsEvent(current, event));
    return event;
};
