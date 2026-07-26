import { sql } from './db';
import { getRedditOAuthConfiguration } from './reddit';
import { getConfiguredSecHeaders } from './research/sec-edgar';
import { isStockTwitsEnabled } from './stocktwits';
import type { SourceHealthEntry, SourceHealthReport } from './types/source-health';

type ProbeDefinition = {
    readonly id: string;
    readonly name: string;
    readonly category: SourceHealthEntry['category'];
    readonly cadence: string;
    readonly coverage: string;
    readonly affectedFeatures: readonly string[];
    readonly probe: () => Promise<void>;
};

const SOURCE_HEALTH_CACHE_MS = 60_000;
let cachedReport: { readonly expiresAt: number; readonly report: SourceHealthReport } | null = null;
let pendingReport: Promise<SourceHealthReport> | null = null;

const fetchOk = async (url: string, headers: Record<string, string> = {}): Promise<void> => {
    const response = await fetch(url, {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.body?.cancel();
};

const probes: readonly ProbeDefinition[] = [
    {
        id: 'database',
        name: 'Neon Postgres',
        category: 'storage',
        cadence: 'On every persisted read or write',
        coverage: 'Research records, signal snapshots, notification state',
        affectedFeatures: ['Watchlist', 'Review history', 'Outcomes', 'Alerts'],
        probe: async () => { await sql`SELECT 1 AS healthy`; },
    },
    {
        id: 'yahoo',
        name: 'Yahoo Finance',
        category: 'research',
        cadence: 'Live and cached by feature',
        coverage: 'US and Malaysia quotes, charts, technicals, benchmarks; US filing-observation price dates',
        affectedFeatures: ['Market conditions', 'Research detail', 'Historical valuation', 'Portfolio', 'Peers'],
        probe: () => fetchOk('https://query1.finance.yahoo.com/v8/finance/chart/VOO?interval=1d&range=5d', {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 Signal source health',
        }),
    },
    {
        id: 'sec',
        name: 'SEC EDGAR',
        category: 'research',
        cadence: 'Normalized fundamentals and filing observations cached for six hours',
        coverage: 'US company fundamentals, filing availability, and evidence provenance',
        affectedFeatures: ['Research fundamentals', 'Valuation', 'Historical valuation', 'Discovery', 'Peers'],
        probe: () => fetchOk('https://data.sec.gov/submissions/CIK0000789019.json', { ...getConfiguredSecHeaders() }),
    },
    {
        id: 'nasdaq-earnings',
        name: 'Nasdaq earnings calendar',
        category: 'context',
        cadence: 'Cached for six hours',
        coverage: 'Upcoming US earnings dates',
        affectedFeatures: ['Calendar', 'Inbox', 'Discovery'],
        probe: () => fetchOk(`https://api.nasdaq.com/api/calendar/earnings?date=${new Date().toISOString().slice(0, 10)}`, {
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.nasdaq.com',
            Referer: 'https://www.nasdaq.com/',
            'User-Agent': 'Mozilla/5.0 Signal source health',
        }),
    },
    {
        id: 'nasdaq-ownership',
        name: 'Nasdaq institutional holdings',
        category: 'context',
        cadence: 'Cached for six hours',
        coverage: 'US institutional ownership disclosures',
        affectedFeatures: ['Trend Discovery'],
        probe: () => fetchOk('https://api.nasdaq.com/api/company/MSFT/institutional-holdings?limit=1&type=INCREASED&sortColumn=sharesChange&sortOrder=DESC', {
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.nasdaq.com',
            Referer: 'https://www.nasdaq.com/',
            'User-Agent': 'Mozilla/5.0 Signal source health',
        }),
    },
];

const probeEntry = async (definition: ProbeDefinition, generatedAt: string): Promise<SourceHealthEntry> => {
    const start = performance.now();
    try {
        await definition.probe();
        return {
            id: definition.id,
            name: definition.name,
            category: definition.category,
            cadence: definition.cadence,
            coverage: definition.coverage,
            affectedFeatures: definition.affectedFeatures,
            status: 'healthy',
            checkedAt: generatedAt,
            lastSuccessfulAt: generatedAt,
            latencyMs: Math.round(performance.now() - start),
            detail: 'Live bounded probe succeeded.',
        };
    } catch (error) {
        return {
            id: definition.id,
            name: definition.name,
            category: definition.category,
            cadence: definition.cadence,
            coverage: definition.coverage,
            affectedFeatures: definition.affectedFeatures,
            status: 'degraded',
            checkedAt: generatedAt,
            lastSuccessfulAt: null,
            latencyMs: Math.round(performance.now() - start),
            detail: error instanceof Error ? `Live probe failed: ${error.message}` : 'Live probe failed.',
        };
    }
};

const configuredEntry = (
    input: Omit<SourceHealthEntry, 'status' | 'checkedAt' | 'lastSuccessfulAt' | 'latencyMs'>,
    configured: boolean,
): SourceHealthEntry => ({
    ...input,
    status: configured ? 'unchecked' : 'unconfigured',
    checkedAt: null,
    lastSuccessfulAt: null,
    latencyMs: null,
});

export const getSourceHealthReport = async (): Promise<SourceHealthReport> => {
    if (cachedReport && cachedReport.expiresAt > Date.now()) return cachedReport.report;
    if (pendingReport) return pendingReport;

    pendingReport = buildSourceHealthReport();
    try {
        const report = await pendingReport;
        cachedReport = { expiresAt: Date.now() + SOURCE_HEALTH_CACHE_MS, report };
        return report;
    } finally {
        pendingReport = null;
    }
};

const buildSourceHealthReport = async (): Promise<SourceHealthReport> => {
    const generatedAt = new Date().toISOString();
    const probed = await Promise.all(probes.map((probe) => probeEntry(probe, generatedAt)));
    const entries: SourceHealthEntry[] = [
        ...probed,
        configuredEntry({
            id: 'notification-webhook',
            name: 'Research notification webhook',
            category: 'delivery',
            cadence: 'Daily Vercel Cron',
            coverage: 'Signed research attention digest',
            affectedFeatures: ['Persistent Alerts'],
            detail: process.env.RESEARCH_NOTIFICATION_WEBHOOK_URL && process.env.RESEARCH_NOTIFICATION_WEBHOOK_SECRET
                ? 'Configured; not actively probed to avoid sending a notification.'
                : 'Webhook URL and signing secret are not both configured.',
        }, Boolean(process.env.RESEARCH_NOTIFICATION_WEBHOOK_URL && process.env.RESEARCH_NOTIFICATION_WEBHOOK_SECRET)),
        configuredEntry({
            id: 'research-ai',
            name: 'Kimi research assistance',
            category: 'research',
            cadence: 'On assisted-review request',
            coverage: 'Evidence-constrained research draft synthesis',
            affectedFeatures: ['Assisted Review'],
            detail: process.env.KIMI_API_KEY ? 'Configured; not probed to avoid billable model usage.' : 'KIMI_API_KEY is not configured; evidence-only fallback remains available.',
        }, Boolean(process.env.KIMI_API_KEY)),
        configuredEntry({
            id: 'reddit',
            name: 'Reddit sentiment',
            category: 'market',
            cadence: 'On US market refresh',
            coverage: 'US retail discussion context',
            affectedFeatures: ['US social sentiment'],
            detail: getRedditOAuthConfiguration()
                ? 'Application-only OAuth is configured; checked during normal Market refresh.'
                : 'REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT are required. Other sentiment sources remain available.',
        }, Boolean(getRedditOAuthConfiguration())),
        configuredEntry({
            id: 'stocktwits',
            name: 'StockTwits sentiment',
            category: 'market',
            cadence: 'On US market refresh',
            coverage: 'US symbol sentiment fallback',
            affectedFeatures: ['US social sentiment'],
            detail: isStockTwitsEnabled()
                ? 'Explicitly enabled; checked during normal Market refresh with a cooldown after access challenges.'
                : 'Disabled by default while public API access is under provider review.',
        }, isStockTwitsEnabled()),
        {
            id: 'rss',
            name: 'Market news RSS',
            category: 'market',
            status: 'unchecked',
            checkedAt: null,
            lastSuccessfulAt: null,
            latencyMs: null,
            cadence: 'On market refresh',
            coverage: 'US and Malaysia news context',
            affectedFeatures: ['Market background', 'Malaysia sentiment'],
            detail: 'Feed-level warnings are exposed in Market results; this dashboard does not refetch every feed.',
        },
    ];
    return { generatedAt, entries };
};
