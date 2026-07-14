import type { AlertTickerInput } from './research-alert';
import type { ResearchMonitoringRules } from './research';

export type ResearchInboxInput = AlertTickerInput & {
    readonly lastReviewedAt: string;
    readonly monitoringRules: ResearchMonitoringRules;
};

export type ResearchInboxKind = 'risk' | 'opportunity' | 'catalyst' | 'stale';
export type ResearchInboxUrgency = 'action' | 'upcoming';

export type ResearchInboxItem = {
    readonly id: string;
    readonly symbol: string;
    readonly kind: ResearchInboxKind;
    readonly urgency: ResearchInboxUrgency;
    readonly title: string;
    readonly detail: string;
    readonly proximity: string;
    readonly source: 'Yahoo Finance' | 'Nasdaq earnings calendar' | 'Research journal';
    readonly eventDate: string | null;
};

export type ResearchInboxResponse = {
    readonly generatedAt: string;
    readonly monitoredCount: number;
    readonly items: readonly ResearchInboxItem[];
    readonly warnings: readonly string[];
};
