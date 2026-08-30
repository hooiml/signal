import type { AlertTickerInput } from './research-alert';

export type ResearchInboxInput = AlertTickerInput & {
    readonly lastReviewedAt: string;
};

export type ResearchInboxKind = 'risk' | 'opportunity' | 'catalyst' | 'stale' | 'expectation' | 'valuation' | 'decision';
export type ResearchInboxUrgency = 'action' | 'upcoming';

export type ResearchInboxItem = {
    readonly id: string;
    readonly symbol: string;
    readonly kind: ResearchInboxKind;
    readonly urgency: ResearchInboxUrgency;
    readonly title: string;
    readonly detail: string;
    readonly proximity: string;
    readonly source: 'Yahoo Finance' | 'Nasdaq earnings calendar' | 'Research journal' | 'Structured trigger' | 'Expectation journal' | 'Valuation plan' | 'Decision review';
    readonly eventDate: string | null;
    readonly structuredTriggerRuleId: string | null;
};

export type ResearchInboxResponse = {
    readonly generatedAt: string;
    readonly monitoredCount: number;
    readonly items: readonly ResearchInboxItem[];
    readonly warnings: readonly string[];
};
