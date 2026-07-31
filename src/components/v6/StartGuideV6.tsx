'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import type { DiscoveryResponse, QualityDiscoveryResult } from '@/lib/types/research-discovery';
import { AppNavV6 } from './AppNavV6';
import { getDecisionPostureV6 } from './market-v6';
import { getThemeV6 } from './research-v6';
import { parseDiscoveryResponseV6 } from './research-discovery-response-v6';
import { useThemeV6 } from './ThemeProviderV6';

type LoadState<T> =
    | { readonly status: 'loading'; readonly data: null; readonly error: null }
    | { readonly status: 'ready'; readonly data: T; readonly error: null }
    | { readonly status: 'error'; readonly data: null; readonly error: string };

type SignalArticle = NonNullable<MarketSignal['metadata']['articles']>[number];

const loadingState = <T,>(): LoadState<T> => ({ status: 'loading', data: null, error: null });

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const parseSignalResponse = (payload: unknown): MarketSignal => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
        throw new Error('Invalid market conditions response.');
    }
    const signal = payload.data;
    if (typeof signal.composite_score !== 'number'
        || !isRecord(signal.interpretation)
        || typeof signal.interpretation.reasoning !== 'string'
        || !isRecord(signal.confidence)
        || typeof signal.confidence.agreement_pct !== 'number'
        || !isRecord(signal.metadata)
        || signal.metadata.market !== 'US') {
        throw new Error('Invalid US market conditions data.');
    }
    return signal as unknown as MarketSignal;
};

const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const articlesPublishedToday = (
    articles: readonly SignalArticle[],
    today: Date,
): readonly SignalArticle[] => articles.filter((article) => {
    if (!article.pubDate) return false;
    const published = new Date(article.pubDate);
    return !Number.isNaN(published.getTime()) && dateKey(published) === dateKey(today);
}).slice(0, 3);

const titleCase = (value: string) => value
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDateTime = (value: string | null | undefined) => {
    if (!value) return 'Unavailable';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unavailable';
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(parsed);
};

const candidateSummary = (candidate: QualityDiscoveryResult) =>
    candidate.qualityReasons[0] ?? candidate.reasons[0] ?? 'Open Discovery to inspect the current evidence.';

export const StartGuideV6 = () => {
    const { theme, toggleTheme } = useThemeV6();
    const styles = getThemeV6(theme);
    const [signalState, setSignalState] = useState<LoadState<MarketSignal>>(loadingState);
    const [discoveryState, setDiscoveryState] = useState<LoadState<DiscoveryResponse>>(loadingState);
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [today, setToday] = useState<Date | null>(null);
    const activeRequest = useRef<AbortController | null>(null);

    const load = useCallback(async () => {
        activeRequest.current?.abort();
        const controller = new AbortController();
        activeRequest.current = controller;
        setToday(new Date());
        setSignalState(loadingState());
        setDiscoveryState(loadingState());

        const signalRequest = fetch('/api/signals/v2?market=US&mode=standard&enableSocial=true', {
            cache: 'no-store',
            signal: controller.signal,
        }).then(async (response) => {
            const payload: unknown = await response.json();
            if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
            return parseSignalResponse(payload);
        });
        const discoveryRequest = fetch('/api/research/discovery', {
            cache: 'no-store',
            signal: controller.signal,
        }).then(async (response) => {
            const payload: unknown = await response.json();
            if (!response.ok && isRecord(payload) && typeof payload.error === 'string') throw new Error(payload.error);
            return parseDiscoveryResponseV6(payload);
        });

        const signalUpdate = signalRequest.then(
            (data) => setSignalState({ status: 'ready', data, error: null }),
            (error: unknown) => {
                if (!controller.signal.aborted) setSignalState({
                    status: 'error',
                    data: null,
                    error: error instanceof Error ? error.message : 'Market conditions are unavailable.',
                });
            },
        );
        const discoveryUpdate = discoveryRequest.then(
            (data) => {
                setDiscoveryState({ status: 'ready', data, error: null });
                setSelectedSymbol((current) => current && data.candidates.some((candidate) => candidate.symbol === current)
                    ? current
                    : data.candidates[0]?.symbol ?? null);
            },
            (error: unknown) => {
                if (!controller.signal.aborted) setDiscoveryState({
                    status: 'error',
                    data: null,
                    error: error instanceof Error ? error.message : 'Current candidates are unavailable.',
                });
            },
        );
        await Promise.allSettled([signalUpdate, discoveryUpdate]);
        if (activeRequest.current === controller) activeRequest.current = null;
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => void load(), 0);
        return () => {
            window.clearTimeout(timeoutId);
            activeRequest.current?.abort();
            activeRequest.current = null;
        };
    }, [load]);

    const candidates = discoveryState.data?.candidates.slice(0, 3) ?? [];
    const selectedCandidate = candidates.find((candidate) => candidate.symbol === selectedSymbol) ?? candidates[0] ?? null;
    const currentArticles = useMemo(
        () => today && signalState.data
            ? articlesPublishedToday(signalState.data.metadata.articles ?? [], today)
            : [],
        [signalState.data, today],
    );
    const posture = signalState.data ? getDecisionPostureV6(signalState.data) : null;
    const panel = 'rounded-lg border backdrop-blur-md ';
    const atmosphere = theme === 'light'
        ? 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.11),_transparent_30%),radial-gradient(circle_at_85%_15%,_rgba(14,165,233,0.08),_transparent_22%)]'
        : 'bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_26%),radial-gradient(circle_at_85%_15%,_rgba(52,211,153,0.08),_transparent_20%)]';

    return (
        <main className={'relative min-h-[100dvh] overflow-x-hidden ' + styles.page}>
            <div className={'pointer-events-none absolute inset-0 ' + atmosphere} />
            <div className="relative z-10">
                <AppNavV6 active="start" theme={theme} onThemeToggle={toggleTheme} />
                <div className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 min-[700px]:px-5">
                    <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div>
                            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Guided daily start</p>
                            <h1 className={'mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl ' + styles.textPrimary}>Go from today&apos;s market score to one research action.</h1>
                            <p className={'mt-3 max-w-3xl text-base leading-7 ' + styles.textSecondary}>Follow the current US evidence in order: understand the market, choose one scan candidate, read only headlines dated today, then continue into the full research workflow.</p>
                        </div>
                        <button type="button" onClick={() => void load()} disabled={signalState.status === 'loading' || discoveryState.status === 'loading'} className={'min-h-10 rounded-md border px-4 text-sm font-bold disabled:opacity-50 ' + styles.row}>
                            {signalState.status === 'loading' || discoveryState.status === 'loading' ? 'Loading current data…' : 'Refresh today'}
                        </button>
                    </header>

                    <ol className="mt-6 grid gap-2 sm:grid-cols-4" aria-label="Getting started steps">
                        {['Read market', 'Choose candidate', 'Read today’s news', 'Continue research'].map((label, index) => (
                            <li key={label} className={'rounded-md border px-3 py-3 text-xs font-semibold ' + (index === 0 ? styles.selectedRow : styles.panelUtility)}>
                                <span className={'mr-2 font-mono ' + styles.textMuted}>{String(index + 1).padStart(2, '0')}</span>{label}
                            </li>
                        ))}
                    </ol>

                    <div className="mt-5 space-y-5">
                        <section className={panel + 'p-5 sm:p-6 ' + styles.panelPrimary} aria-labelledby="start-market-title" data-testid="start-market-step">
                            <StepHeading number="01" eyebrow="Read the environment" title="Start with today’s US market posture" id="start-market-title" theme={theme} />
                            {signalState.status === 'loading' ? <LoadingBlock label="Loading current US market conditions" theme={theme} /> : null}
                            {signalState.status === 'error' ? <ErrorBlock message={signalState.error} theme={theme} /> : null}
                            {signalState.data ? (
                                <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
                                    <div className={'rounded-lg border p-5 text-center ' + styles.panelAction}>
                                        <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.textMuted}>Composite score</p>
                                        <p className={'mt-2 font-mono text-5xl font-bold tabular-nums ' + styles.textPrimary}>{Math.round(signalState.data.composite_score)}</p>
                                        <p className={'mt-1 text-sm font-semibold ' + styles.positive}>{titleCase(signalState.data.tier)}</p>
                                    </div>
                                    <div>
                                        <h3 className={'text-xl font-bold ' + styles.textPrimary}>{posture?.headline}</h3>
                                        <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>{posture?.summary}</p>
                                        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                                            <Fact label="Agreement" value={`${Math.round(signalState.data.confidence.agreement_pct)}%`} theme={theme} />
                                            <Fact label="Freshness" value={titleCase(signalState.data.metadata.signal_quality?.freshness ?? 'unavailable')} theme={theme} />
                                            <Fact label="Score as of" value={formatDateTime(signalState.data.metadata.score_delta?.snapshot_date)} theme={theme} />
                                        </dl>
                                        <Link href="/" className={'mt-4 inline-flex min-h-10 items-center text-sm font-bold ' + styles.positive}>Inspect the full market evidence →</Link>
                                    </div>
                                </div>
                            ) : null}
                        </section>

                        <section className={panel + 'p-5 sm:p-6 ' + styles.panelPrimary} aria-labelledby="start-candidate-title" data-testid="start-candidate-step">
                            <StepHeading number="02" eyebrow="Narrow the scan" title="Choose one current candidate to investigate" id="start-candidate-title" theme={theme} />
                            <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>These are the leading names from the current bounded Discovery scan—not buy recommendations. Apple or Nvidia appears here only when today&apos;s ranking supports it.</p>
                            {discoveryState.status === 'loading' ? <LoadingBlock label="Scanning current candidates" theme={theme} /> : null}
                            {discoveryState.status === 'error' ? <ErrorBlock message={discoveryState.error} theme={theme} /> : null}
                            {discoveryState.data ? (
                                <>
                                    <p className={'mt-3 text-xs ' + styles.textMuted}>{discoveryState.data.scannedCount} stocks scanned · generated {formatDateTime(discoveryState.data.generatedAt)}</p>
                                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                        {candidates.map((candidate, index) => {
                                            const selected = selectedCandidate?.symbol === candidate.symbol;
                                            return (
                                                <button key={candidate.symbol} type="button" aria-pressed={selected} onClick={() => setSelectedSymbol(candidate.symbol)} className={'min-h-44 rounded-lg border p-4 text-left transition-colors ' + (selected ? styles.selectedRow : styles.row)}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div><span className={'font-mono text-xs ' + styles.textMuted}>#{index + 1}</span><h3 className={'mt-1 font-mono text-xl font-bold ' + styles.textPrimary}>{candidate.symbol}</h3><p className={'text-xs ' + styles.textMuted}>{candidate.name}</p></div>
                                                        <div className="text-right"><span className={'font-mono text-xl font-bold ' + styles.positive}>{candidate.discoveryScore}</span><span className={'block text-[10px] uppercase ' + styles.textMuted}>Discovery</span></div>
                                                    </div>
                                                    <p className={'mt-4 text-xs font-semibold capitalize ' + styles.textSecondary}>{candidate.risk} risk · {candidate.valuation.guardrail} valuation</p>
                                                    <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>{candidateSummary(candidate)}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {candidates.length === 0 ? <p className={'mt-5 text-sm ' + styles.textMuted}>No candidate cleared the current Discovery rules. Nothing is substituted.</p> : null}
                                </>
                            ) : null}
                        </section>

                        <section className={panel + 'p-5 sm:p-6 ' + styles.panelSolid} aria-labelledby="start-news-title" data-testid="start-news-step">
                            <StepHeading number="03" eyebrow="Current context only" title="Read headlines published today" id="start-news-title" theme={theme} />
                            <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>This is market context, not company-specific evidence, and it does not change the Discovery ranking. Undated and older headlines are deliberately excluded.</p>
                            {signalState.status === 'loading' ? <LoadingBlock label="Checking today’s market headlines" theme={theme} /> : null}
                            {signalState.data && currentArticles.length > 0 ? (
                                <ul className="mt-4 grid gap-3 lg:grid-cols-3">
                                    {currentArticles.map((article) => (
                                        <li key={`${article.source}:${article.title}`} className={'rounded-lg border p-4 ' + styles.panelSecondary}>
                                            <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>{article.source} · {formatDateTime(article.pubDate)}</p>
                                            <h3 className={'mt-2 text-sm font-bold leading-6 ' + styles.textPrimary}>{article.title}</h3>
                                            {article.url ? <a href={article.url} target="_blank" rel="noreferrer" className={'mt-3 inline-flex min-h-10 items-center text-xs font-bold ' + styles.positive}>Open source ↗</a> : null}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                            {signalState.data && currentArticles.length === 0 ? (
                                <div className={'mt-4 rounded-lg border p-4 ' + styles.panelUtility}>
                                    <p className={'text-sm font-bold ' + styles.textPrimary}>No feed item is dated today.</p>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Older headlines are intentionally not shown. Continue with the dated score and current Discovery evidence.</p>
                                </div>
                            ) : null}
                        </section>

                        <section className={panel + 'p-5 sm:p-6 ' + styles.panelAction} aria-labelledby="start-next-title" data-testid="start-next-step">
                            <StepHeading number="04" eyebrow="Take one traceable action" title={selectedCandidate ? `Continue with ${selectedCandidate.symbol}` : 'Continue into Research'} id="start-next-title" theme={theme} />
                            <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>{selectedCandidate ? `Open Discovery, find ${selectedCandidate.symbol}, inspect its evidence and limitations, then add it to Research only if you want to maintain a thesis.` : 'Open Discovery to inspect current candidates and add one to Research only after reviewing its evidence.'}</p>
                            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                                <Link href="/research?workspace=discovery" className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-600 px-5 text-sm font-bold text-white hover:bg-emerald-500">{selectedCandidate ? `Open Discovery for ${selectedCandidate.symbol}` : 'Open Discovery'}</Link>
                                <Link href="/research?workspace=portfolio" className={'inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm font-bold ' + styles.row}>Already own it? Open Portfolio</Link>
                            </div>
                            <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>Signal supports research decisions; it does not place orders or provide personalized financial advice.</p>
                        </section>
                    </div>
                </div>
            </div>
        </main>
    );
};

const StepHeading = ({ number, eyebrow, title, id, theme }: { number: string; eyebrow: string; title: string; id: string; theme: 'light' | 'dark' }) => {
    const styles = getThemeV6(theme);
    return <div className="flex items-start gap-3"><span className={'font-mono text-xs font-bold ' + styles.positive}>{number}</span><div><p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.textMuted}>{eyebrow}</p><h2 id={id} className={'mt-1 text-xl font-bold ' + styles.textPrimary}>{title}</h2></div></div>;
};

const Fact = ({ label, value, theme }: { label: string; value: string; theme: 'light' | 'dark' }) => {
    const styles = getThemeV6(theme);
    return <div className={'rounded-md border p-3 ' + styles.panelUtility}><dt className={'text-[10px] font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>{label}</dt><dd className={'mt-1 text-xs font-bold ' + styles.textPrimary}>{value}</dd></div>;
};

const LoadingBlock = ({ label, theme }: { label: string; theme: 'light' | 'dark' }) => {
    const styles = getThemeV6(theme);
    return <div role="status" className={'mt-5 rounded-lg border p-5 ' + styles.panelUtility}><div className="h-3 w-40 animate-pulse rounded bg-emerald-400/25" /><span className="sr-only">{label}</span></div>;
};

const ErrorBlock = ({ message, theme }: { message: string; theme: 'light' | 'dark' }) => {
    const styles = getThemeV6(theme);
    return <div role="alert" className={'mt-5 rounded-lg border p-4 ' + styles.panelUtility}><p className={'text-sm font-bold ' + styles.risk}>Current data unavailable</p><p className={'mt-1 text-xs ' + styles.textMuted}>{message}</p></div>;
};
