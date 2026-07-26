export const productAnalyticsEventNames = [
    'workspace_viewed',
    'market_handoff_opened',
    'review_opened',
    'review_saved',
    'packet_exported',
    'notification_preferences_saved',
    'portfolio_scenario_changed',
    'peer_set_changed',
    'outcome_breakdown_changed',
    'source_health_refreshed',
    'replay_compared',
    'market_sensitivity_changed',
    'backup_exported',
    'backup_imported',
] as const;

export const productAnalyticsWorkspaces = [
    'market_conditions',
    'research',
    'discovery',
    'picker',
    'compare',
    'calendar',
    'alerts',
    'changes',
    'filings',
    'evidence',
    'policy',
    'queue',
    'portfolio',
    'currency',
    'relationships',
    'peers',
    'outcomes',
    'replay',
    'health',
    'packets',
    'backup',
    'usage',
] as const;

export const productAnalyticsSources = [
    'direct',
    'market',
    'inbox',
    'filings',
    'evidence',
    'policy',
    'alerts',
    'calendar',
    'portfolio',
    'currency',
    'relationships',
    'peers',
    'outcomes',
    'discovery',
    'picker',
    'compare',
    'queue',
] as const;

export type ProductAnalyticsEventName = typeof productAnalyticsEventNames[number];
export type ProductAnalyticsWorkspace = typeof productAnalyticsWorkspaces[number];
export type ProductAnalyticsSource = typeof productAnalyticsSources[number];

export type ProductAnalyticsAttributes = {
    readonly market?: 'US' | 'MY';
    readonly decision?: 'Ready' | 'DCA' | 'Wait for price' | 'Watch' | 'Avoid';
    readonly format?: 'markdown' | 'print';
    readonly mode?: 'daily' | 'urgent-only';
    readonly change?: 'add' | 'remove';
    readonly breakdown?: 'decision' | 'confidence' | 'market';
    readonly comparison?: 'enabled' | 'disabled';
    readonly result?: 'success' | 'failure';
};

export type ProductAnalyticsEvent = {
    readonly id: string;
    readonly sessionId: string;
    readonly name: ProductAnalyticsEventName;
    readonly surface: 'market' | 'research';
    readonly workspace: ProductAnalyticsWorkspace;
    readonly source: ProductAnalyticsSource | null;
    readonly attributes: ProductAnalyticsAttributes;
    readonly occurredAt: string;
};

export type ProductAnalyticsState = {
    readonly version: 1;
    readonly enabled: boolean;
    readonly events: readonly ProductAnalyticsEvent[];
};

export type ProductAnalyticsWorkspaceSummary = {
    readonly workspace: ProductAnalyticsWorkspace;
    readonly views: number;
    readonly sessions: number;
    readonly lastUsedAt: string;
};

export type ProductAnalyticsPathwaySummary = {
    readonly source: ProductAnalyticsSource;
    readonly opened: number;
    readonly saved: number;
    readonly completionPercent: number | null;
};

export type ProductAnalyticsDailySummary = {
    readonly date: string;
    readonly events: number;
    readonly meaningfulActions: number;
};

export type ProductAnalyticsSummary = {
    readonly rangeDays: 7 | 30 | 90;
    readonly eventCount: number;
    readonly activeDays: number;
    readonly sessions: number;
    readonly meaningfulActions: number;
    readonly reviewOpened: number;
    readonly reviewSaved: number;
    readonly reviewCompletionPercent: number | null;
    readonly guidedReviewSaved: number;
    readonly packetExports: number;
    readonly workspaces: readonly ProductAnalyticsWorkspaceSummary[];
    readonly pathways: readonly ProductAnalyticsPathwaySummary[];
    readonly daily: readonly ProductAnalyticsDailySummary[];
    readonly recent: readonly ProductAnalyticsEvent[];
};
