import type { ResearchAlert } from '../types/research-alert';

export const researchNativeNotificationStorageKey = 'signal-research-native-notifications-v1';
export const researchNativeNotificationDigestKey = 'signal-research-native-notification-digest-v1';

export type ResearchNativeNotificationMode = 'all' | 'risk-only';

export type ResearchNativeNotificationSettings = {
    readonly enabled: boolean;
    readonly mode: ResearchNativeNotificationMode;
};

export const defaultResearchNativeNotificationSettings: ResearchNativeNotificationSettings = {
    enabled: false,
    mode: 'risk-only',
};

export const parseResearchNativeNotificationSettings = (value: unknown): ResearchNativeNotificationSettings => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return defaultResearchNativeNotificationSettings;
    const entry = Object.fromEntries(Object.entries(value));
    if (typeof entry.enabled !== 'boolean' || entry.mode !== 'all' && entry.mode !== 'risk-only') {
        return defaultResearchNativeNotificationSettings;
    }
    return { enabled: entry.enabled, mode: entry.mode };
};

const eligibleAlerts = (
    alerts: readonly ResearchAlert[],
    mode: ResearchNativeNotificationMode,
): readonly ResearchAlert[] => mode === 'risk-only'
    ? alerts.filter((alert) => alert.severity === 'risk')
    : alerts;

const compact = (value: string, maximum: number): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1)}…`;
};

export const researchNativeNotificationDigest = (
    alerts: readonly ResearchAlert[],
    mode: ResearchNativeNotificationMode = 'all',
): Promise<string> => {
    const source = [...eligibleAlerts(alerts, mode)]
        .map((alert) => `${alert.symbol}:${alert.severity}:${alert.title}:${alert.detail}`)
        .sort()
        .join('|');
    return globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
        .then((digest) => [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join(''));
};

export const buildResearchNativeNotification = (
    alerts: readonly ResearchAlert[],
    mode: ResearchNativeNotificationMode,
): { readonly title: string; readonly body: string; readonly tag: string; readonly itemCount: number } | null => {
    const eligible = eligibleAlerts(alerts, mode);
    if (eligible.length === 0) return null;
    const visible = eligible.slice(0, 3).map((alert) => `${alert.symbol}: ${compact(alert.title, 80)}`);
    const omitted = eligible.length - visible.length;
    return {
        title: eligible.length === 1 ? '1 Signal research alert' : `${eligible.length} Signal research alerts`,
        body: compact(`${visible.join(' · ')}${omitted > 0 ? ` · +${omitted} more` : ''}`, 300),
        tag: `signal-research-${mode}`,
        itemCount: eligible.length,
    };
};
