'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSignalConfig } from '@/hooks/use-signal-config';
import { IndicatorData, MarketSignal, SignalTier } from '@/lib/types/signal-v2';
import {
    AppHeaderV4,
    computeReliability,
    formatShortDate,
    formatSigned,
    getFreshnessLevel,
    getScoreBgClass,
    getScoreToneClass,
    ReliabilityLevel,
} from './v4-shared';

const FIVE_MINUTES = 5 * 60 * 1000;

const tierToStance: Record<SignalTier, string> = {
    'strong-buy': 'Strongly positive',
    buy: 'Leaning positive',
    neutral: 'Mixed',
    sell: 'Leaning negative',
    'strong-sell': 'Strongly negative',
};

export const SignalDashboardV4 = () => {
    const { config, isLoaded } = useSignalConfig();
    const [signalData, setSignalData] = useState<MarketSignal | null>(null);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSourceKey, setOpenSourceKey] = useState<string | null>(null);
    const [showAllNews, setShowAllNews] = useState(false);
    const lastFetchAt = useRef<number>(0);

    const fetchSignal = useCallback(async ({ background = false } = {}) => {
        if (background) {
            setIsRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const res = await fetch(`/api/signals/v2?market=${config.market}&mode=${config.mode}&enableSocial=${config.enableSocial}`);
            const json = await res.json();

            if (json.success) {
                setSignalData(json.data);
                lastFetchAt.current = Date.now();
            } else {
                setError(json.error || 'Could not load signal data.');
            }
        } catch {
            setError('Could not load signal data.');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [config.enableSocial, config.market, config.mode]);

    useEffect(() => {
        if (isLoaded) {
            fetchSignal();
        }
    }, [fetchSignal, isLoaded]);

    useEffect(() => {
        if (!isLoaded) return;

        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchSignal({ background: true });
            }
        }, FIVE_MINUTES);

        const handleFocus = () => {
            if (Date.now() - lastFetchAt.current > FIVE_MINUTES) {
                fetchSignal({ background: true });
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchSignal, isLoaded]);

    const snapshotDate = signalData?.metadata.score_delta?.snapshot_date ?? null;

    return (
        <main className="min-h-screen bg-[#0F1117] text-[#E8EAF0] selection:bg-[#2563EB] selection:text-white">
            <AppHeaderV4 snapshotDate={snapshotDate} onRefresh={() => fetchSignal({ background: true })} isRefreshing={isRefreshing} />

            <div className="mx-auto w-full max-w-[1280px] px-4 pb-10 md:px-6">
                {loading && !signalData ? (
                    <SignalSkeleton />
                ) : signalData ? (
                    <SignalContent
                        signal={signalData}
                        mode={config.mode}
                        openSourceKey={openSourceKey}
                        setOpenSourceKey={setOpenSourceKey}
                        showAllNews={showAllNews}
                        setShowAllNews={setShowAllNews}
                        error={error}
                    />
                ) : (
                    <SignalUnavailable message={error || 'Signal unavailable.'} />
                )}
            </div>
        </main>
    );
};

const SignalContent = ({
    signal,
    mode,
    openSourceKey,
    setOpenSourceKey,
    showAllNews,
    setShowAllNews,
    error,
}: {
    signal: MarketSignal;
    mode: string;
    openSourceKey: string | null;
    setOpenSourceKey: (key: string | null) => void;
    showAllNews: boolean;
    setShowAllNews: (show: boolean) => void;
    error: string | null;
}) => {
    const sources = useMemo(
        () => Object.entries(signal.components).filter(([, source]) => source.enabled),
        [signal.components],
    );
    const sourceFreshness = sources.map(([, source]) => getFreshnessLevel(source.last_updated));
    const activeSourceCount = sources.length;
    const agreementPct = signal.confidence.agreement_pct;
    const reliability = computeReliability({ activeSourceCount, agreementPct, sourceFreshness });
    const hasStaleSource = sourceFreshness.includes('stale');
    const shouldDegradeVerdict = reliability === 'Weak' || hasStaleSource;
    const alignedCount = Math.round((agreementPct / 100) * activeSourceCount);
    const scoreDelta = signal.metadata.score_delta?.delta;
    const visibleArticles = showAllNews ? signal.metadata.articles ?? [] : (signal.metadata.articles ?? []).slice(0, 3);
    const oldestSource = getOldestSourceDate(sources.map(([, source]) => source.last_updated));

    return (
        <div className="pt-6">
            <VerdictBlock
                signal={signal}
                mode={mode}
                reliability={reliability}
                activeSourceCount={activeSourceCount}
                alignedCount={alignedCount}
                shouldDegradeVerdict={shouldDegradeVerdict}
                scoreDelta={scoreDelta}
                oldestSource={oldestSource}
                error={error}
            />

            <section className="mt-6" aria-labelledby="source-breakdown-heading">
                <h2 id="source-breakdown-heading" className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                    Source breakdown
                </h2>
                <div className="divide-y divide-[#1E2130] border-y border-[#1E2130]">
                    {sources.map(([key, source]) => (
                        <SourceRow
                            key={key}
                            sourceKey={key}
                            source={source}
                            isOpen={openSourceKey === key}
                            onToggle={() => setOpenSourceKey(openSourceKey === key ? null : key)}
                        />
                    ))}
                </div>
            </section>

            <section className="mt-6" aria-labelledby="news-heading">
                <div className="mb-2 flex items-center justify-between gap-4">
                    <h2 id="news-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                        Context only - not scored
                    </h2>
                    {(signal.metadata.articles?.length ?? 0) > 3 ? (
                        <button
                            type="button"
                            onClick={() => setShowAllNews(!showAllNews)}
                            className="text-xs font-semibold text-[#E8EAF0] underline-offset-4 hover:underline"
                        >
                            {showAllNews ? 'Show less' : 'Show more'}
                        </button>
                    ) : null}
                </div>
                <div className="divide-y divide-[#1E2130] border-y border-[#1E2130]">
                    {visibleArticles.length > 0 ? visibleArticles.map((article) => (
                        <a
                            key={`${article.source}-${article.title}`}
                            href={article.url}
                            target={article.url ? '_blank' : undefined}
                            rel={article.url ? 'noreferrer' : undefined}
                            className="grid min-h-11 gap-2 py-3 text-sm transition hover:bg-white/[0.025] md:grid-cols-[minmax(0,1fr)_auto]"
                        >
                            <span className="min-w-0 font-medium text-[#E8EAF0]">{article.title}</span>
                            <span className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                                <ImpactBadge impact={article.sentiment ?? 'neutral'} />
                                {article.source}
                            </span>
                        </a>
                    )) : (
                        <div className="py-6 text-center text-sm text-[#9CA3AF]">No recent context items.</div>
                    )}
                </div>
            </section>
        </div>
    );
};

const VerdictBlock = ({
    signal,
    mode,
    reliability,
    activeSourceCount,
    alignedCount,
    shouldDegradeVerdict,
    scoreDelta,
    oldestSource,
    error,
}: {
    signal: MarketSignal;
    mode: string;
    reliability: ReliabilityLevel;
    activeSourceCount: number;
    alignedCount: number;
    shouldDegradeVerdict: boolean;
    scoreDelta: number | null | undefined;
    oldestSource: string | null;
    error: string | null;
}) => {
    const score = Math.round(signal.composite_score);
    const stance = shouldDegradeVerdict ? 'Signal unavailable' : tierToStance[signal.tier];

    return (
        <section className="border-b border-[#1E2130] py-5 md:py-6">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_128px] md:items-center">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9CA3AF]">
                        Market read - {formatShortDate(signal.metadata.score_delta?.snapshot_date)}
                    </div>
                    <h1 className={`mt-4 text-[28px] font-bold leading-tight text-[#E8EAF0] ${shouldDegradeVerdict ? 'opacity-50' : ''}`}>
                        {stance}
                    </h1>
                    <p className="mt-1 text-[13px] font-medium text-[#9CA3AF]">
                        {mode === 'contrarian' ? 'Contrarian' : 'Momentum'} mode - {activeSourceCount} active sources
                    </p>
                </div>
                <div className="flex md:justify-end">
                    <div className={`grid h-24 w-24 place-items-center rounded-full bg-[#EAF7DF] font-mono text-3xl font-bold ${shouldDegradeVerdict ? 'text-[#6B7280]' : getScoreToneClass(score)}`}>
                        {shouldDegradeVerdict ? '-' : score}
                    </div>
                </div>
            </div>

            <ScoreZoneBar score={score} degraded={shouldDegradeVerdict} />

            <div className="mt-4 grid gap-3 md:grid-cols-3">
                <CompactMetric label="Score moved" value={formatSigned(scoreDelta)} detail={`since ${formatShortDate(signal.metadata.score_delta?.previous_date)}`} tone={scoreDelta && scoreDelta < 0 ? 'negative' : scoreDelta && scoreDelta > 0 ? 'positive' : 'neutral'} />
                <CompactMetric label="Reliability" value={reliability} detail={reliability === 'Weak' ? 'treat with caution' : reliability === 'Moderate' ? 'stale data caveat' : 'sources current'} tone={reliability === 'Weak' ? 'negative' : reliability === 'Moderate' ? 'caution' : 'positive'} />
                <CompactMetric label="Agreement" value={`${Math.round(signal.confidence.agreement_pct)}%`} detail={`${alignedCount} of ${activeSourceCount} aligned`} tone="neutral" />
            </div>

            {(shouldDegradeVerdict || error) ? (
                <div className="mt-4 flex min-h-8 items-center rounded border border-[#3B2A12] bg-[#2D1A00] px-3 text-[13px] text-[#F59E0B]">
                    {error || `Data may be stale - treat this read with caution. Oldest source: ${formatShortDate(oldestSource)}.`}
                </div>
            ) : null}
        </section>
    );
};

const ScoreZoneBar = ({ score, degraded }: { score: number; degraded: boolean }) => {
    const marker = Math.max(0, Math.min(100, score));

    return (
        <div className="mt-5">
            <div className="relative grid h-1.5 grid-cols-[45fr_20fr_35fr] gap-1">
                <span className="rounded bg-[#EF4444]" />
                <span className="rounded bg-[#F59E0B]" />
                <span className="rounded bg-[#22C55E]" />
                <span
                    className={`absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-sm bg-[#E8EAF0] ${degraded ? 'opacity-40' : ''}`}
                    style={{ left: `calc(${marker}% - 2px)` }}
                />
            </div>
            <div className="mt-2 grid grid-cols-3 text-xs text-[#9CA3AF]">
                <span>Negative &lt;45</span>
                <span className="text-center">Mixed 45-64</span>
                <span className="text-right">Positive 65-100</span>
            </div>
        </div>
    );
};

const CompactMetric = ({
    label,
    value,
    detail,
    tone,
}: {
    label: string;
    value: string;
    detail: string;
    tone: 'positive' | 'caution' | 'negative' | 'neutral';
}) => {
    const toneClass = {
        positive: 'text-[#22C55E]',
        caution: 'text-[#F59E0B]',
        negative: 'text-[#EF4444]',
        neutral: 'text-[#E8EAF0]',
    }[tone];

    return (
        <div className="rounded-md border border-[#1E2130] bg-white/[0.035] p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">{label}</div>
            <div className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</div>
            <div className="mt-1 text-[13px] text-[#9CA3AF]">{detail}</div>
        </div>
    );
};

const SourceRow = ({
    sourceKey,
    source,
    isOpen,
    onToggle,
}: {
    sourceKey: string;
    source: IndicatorData;
    isOpen: boolean;
    onToggle: () => void;
}) => {
    const score = Math.round(source.score);
    const freshness = getFreshnessLevel(source.last_updated);
    const driverDetail = source.metadata?.mode_note || source.metadata?.horizon || source.metadata?.cadence || 'No analyst detail supplied.';

    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                className="grid min-h-11 w-full grid-cols-[24px_minmax(110px,1fr)_minmax(130px,0.8fr)_76px_46px_12px_12px] items-center gap-3 py-2 text-left transition hover:bg-white/[0.025] max-md:grid-cols-[24px_minmax(0,1fr)_42px_18px]"
                aria-expanded={isOpen}
            >
                <SourceIcon sourceKey={sourceKey} />
                <span className="min-w-0 text-sm font-medium text-[#E8EAF0]">{source.display_name}</span>
                <span className="text-[13px] text-[#9CA3AF] max-md:hidden">{tierToStance[source.signal]}</span>
                <span className="flex items-center gap-2 max-md:hidden">
                    <span className="h-1 w-16 rounded bg-white/[0.06]">
                        <span className={`block h-1 rounded ${getScoreBgClass(score)}`} style={{ width: `${Math.max(4, Math.min(100, score))}%` }} />
                    </span>
                </span>
                <span className={`font-mono text-sm font-bold ${getScoreToneClass(score)}`}>{score}</span>
                <span className={`h-1.5 w-1.5 rounded-full ${freshness === 'fresh' ? 'bg-[#22C55E]' : freshness === 'recent' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`} />
                <svg className={`h-3 w-3 text-[#9CA3AF] transition max-md:hidden ${isOpen ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M4.5 2.5 8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {isOpen ? (
                <div className="grid gap-2 pb-4 pl-9 text-[13px] text-[#9CA3AF] md:grid-cols-4">
                    <Detail label="Weight" value={`${Math.round(source.weight * 100)}%`} />
                    <Detail label="Contribution" value={`${formatSigned(source.score * source.weight, ' pts')} to composite`} />
                    <Detail label="Reason" value={driverDetail} span />
                    <Detail label="Last updated" value={formatShortDate(source.last_updated)} />
                </div>
            ) : null}
        </div>
    );
};

const Detail = ({ label, value, span = false }: { label: string; value: string; span?: boolean }) => (
    <div className={span ? 'md:col-span-2' : ''}>
        <div className="text-[11px] uppercase tracking-[0.12em] text-[#6B7280]">{label}</div>
        <div className="mt-1 text-[#E8EAF0]">{value}</div>
    </div>
);

const SourceIcon = ({ sourceKey }: { sourceKey: string }) => {
    const common = 'h-4 w-4 text-[#9CA3AF]';
    if (sourceKey.includes('vix')) {
        return <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 10h3l2-5 2 7 2-4h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    }
    if (sourceKey.includes('social')) {
        return <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.5 11.5v-1a3.5 3.5 0 0 1 7 0v1M8 7a2.25 2.25 0 1 0 0-4.5A2.25 2.25 0 0 0 8 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>;
    }
    if (sourceKey.includes('put') || sourceKey.includes('call')) {
        return <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 6h10M3 10h10M6 3 3 6l3 3M10 7l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    }
    return <svg className={common} viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 11.5 6 8l2 2 5-6M3 13h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
};

const ImpactBadge = ({ impact }: { impact: 'bullish' | 'bearish' | 'neutral' }) => {
    const className = impact === 'bullish'
        ? 'bg-[#052E16] text-[#22C55E]'
        : impact === 'bearish'
            ? 'bg-[#2D0000] text-[#EF4444]'
            : 'bg-[#1F2937] text-[#9CA3AF]';
    const label = impact === 'bullish' ? 'Relevant' : impact === 'bearish' ? 'Risk' : 'Neutral';
    return <span className={`rounded px-2 py-0.5 font-semibold ${className}`}>{label}</span>;
};

const SignalSkeleton = () => (
    <div className="space-y-6 pt-6">
        <div className="border-b border-[#1E2130] py-5">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_128px]">
                <div className="space-y-3">
                    <div className="h-3 w-48 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-8 w-64 animate-pulse rounded bg-white/[0.06]" />
                    <div className="h-4 w-56 animate-pulse rounded bg-white/[0.06]" />
                </div>
                <div className="h-24 w-24 animate-pulse rounded-full bg-white/[0.06]" />
            </div>
        </div>
        <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-11 animate-pulse rounded bg-white/[0.06]" />
            ))}
        </div>
    </div>
);

const SignalUnavailable = ({ message }: { message: string }) => (
    <section className="mt-6 border-y border-[#1E2130] py-8">
        <h1 className="text-[28px] font-bold text-[#E8EAF0]">Signal unavailable</h1>
        <p className="mt-2 text-sm text-[#9CA3AF]">{message}</p>
    </section>
);

const getOldestSourceDate = (timestamps: Array<string | null | undefined>) => {
    const parsed = timestamps
        .map((timestamp) => timestamp ? new Date(timestamp).getTime() : Number.NaN)
        .filter((value) => !Number.isNaN(value));
    if (parsed.length === 0) return null;
    return new Date(Math.min(...parsed)).toISOString();
};
