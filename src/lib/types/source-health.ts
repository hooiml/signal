export const sourceHealthStatuses = ['healthy', 'degraded', 'unconfigured', 'unchecked'] as const;
export type SourceHealthStatus = typeof sourceHealthStatuses[number];

export type SourceHealthEntry = {
    readonly id: string;
    readonly name: string;
    readonly category: 'market' | 'research' | 'context' | 'delivery' | 'storage';
    readonly status: SourceHealthStatus;
    readonly checkedAt: string | null;
    readonly lastSuccessfulAt: string | null;
    readonly latencyMs: number | null;
    readonly cadence: string;
    readonly coverage: string;
    readonly affectedFeatures: readonly string[];
    readonly detail: string;
};

export type SourceHealthReport = {
    readonly generatedAt: string;
    readonly entries: readonly SourceHealthEntry[];
};

export type SourceHealthSummary = {
    readonly healthy: number;
    readonly degraded: number;
    readonly unconfigured: number;
    readonly unchecked: number;
};

export const summarizeSourceHealth = (entries: readonly SourceHealthEntry[]): SourceHealthSummary => ({
    healthy: entries.filter((entry) => entry.status === 'healthy').length,
    degraded: entries.filter((entry) => entry.status === 'degraded').length,
    unconfigured: entries.filter((entry) => entry.status === 'unconfigured').length,
    unchecked: entries.filter((entry) => entry.status === 'unchecked').length,
});
