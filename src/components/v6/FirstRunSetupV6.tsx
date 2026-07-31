'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResearchRecord } from '@/lib/types/research';
import {
    createFirstRunSetupState,
    firstRunSetupStepIds,
    hasExistingFirstRunOwnerState,
    reconcileFirstRunSetupState,
    setFirstRunMonitoringSkipped,
    setFirstRunSetupStatus,
    updateFirstRunMarkets,
    type FirstRunMarket,
    type FirstRunSetupState,
    type FirstRunSetupStepId,
} from '@/lib/research/first-run';
import {
    clearFirstRunSetupState,
    readFirstRunSetupState,
    writeFirstRunSetupState,
    type FirstRunSetupReadResult,
} from '@/lib/research/first-run-client';
import {
    loadPortfolioHoldingsSnapshot,
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import type { ResearchWorkspaceV6 } from './ResearchWorkspaceTabsV6';

type SetupLoadState =
    | { readonly status: 'loading'; readonly state: null }
    | FirstRunSetupReadResult;

type FirstRunSetupV6Props = {
    readonly records: readonly ResearchRecord[];
    readonly recordsReady: boolean;
    readonly queueReady: boolean;
    readonly queueTaskCount: number;
    readonly theme: ResearchThemeV6;
    readonly forceOpen: boolean;
    readonly onStartAdd: () => void;
    readonly onOpenWorkspace: (workspace: ResearchWorkspaceV6) => void;
    readonly onOpenReview: (symbol: string) => void;
    readonly onCloseRequested: () => void;
};

const stepCopy: Readonly<Record<FirstRunSetupStepId, { readonly title: string; readonly detail: string }>> = {
    markets: {
        title: 'Choose markets to follow',
        detail: 'This setup preference only guides your starting view. It does not activate a provider.',
    },
    watchlist: {
        title: 'Add a watchlist name or holdings snapshot',
        detail: 'Use the existing saved Research or browser-local Portfolio owner.',
    },
    review: {
        title: 'Complete one explicit review',
        detail: 'Your review is saved only after you submit the existing Research editor.',
    },
    schedule: {
        title: 'Schedule the next review',
        detail: 'Set a date in the same decision journal; setup does not invent one.',
    },
    monitoring: {
        title: 'Optionally create one monitoring rule',
        detail: 'Use the existing fixed-rule editor, or skip this optional step.',
    },
};

const sameState = (left: FirstRunSetupState, right: FirstRunSetupState) =>
    left.status === right.status
    && left.monitoringChoice === right.monitoringChoice
    && left.markets.join('|') === right.markets.join('|')
    && left.completedSteps.join('|') === right.completedSteps.join('|');

export const FirstRunSetupV6 = ({
    records,
    recordsReady,
    queueReady,
    queueTaskCount,
    theme,
    forceOpen,
    onStartAdd,
    onOpenWorkspace,
    onOpenReview,
    onCloseRequested,
}: FirstRunSetupV6Props) => {
    const styles = getThemeV6(theme);
    const [loadState, setLoadState] = useState<SetupLoadState>({ status: 'loading', state: null });
    const [portfolioState, setPortfolioState] = useState<PortfolioHoldingsLoadResult | null>(null);
    const [open, setOpen] = useState(forceOpen);
    const [message, setMessage] = useState('');
    const headingRef = useRef<HTMLHeadingElement>(null);

    const ownerState = useMemo(() => ({
        records,
        hasPortfolioSnapshot: portfolioState?.status === 'ready',
    }), [portfolioState?.status, records]);

    const persist = (next: FirstRunSetupState) => {
        setMessage('');
        try {
            setLoadState({ status: 'ready', state: writeFirstRunSetupState(next) });
        } catch (error) {
            setLoadState({ status: 'ready', state: next });
            setMessage(error instanceof Error ? error.message : 'Setup progress could not be saved.');
        }
    };

    useEffect(() => {
        const refreshPortfolio = () => setPortfolioState(loadPortfolioHoldingsSnapshot());
        refreshPortfolio();
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refreshPortfolio);
        window.addEventListener('storage', refreshPortfolio);
        return () => {
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refreshPortfolio);
            window.removeEventListener('storage', refreshPortfolio);
        };
    }, []);

    useEffect(() => {
        if (!recordsReady || !queueReady || portfolioState === null) return;
        const timer = window.setTimeout(() => {
            const loaded = readFirstRunSetupState();
            if (loaded.status !== 'missing') {
                setLoadState(loaded);
                if (loaded.status === 'ready' && loaded.state.status === 'active') setOpen(true);
                return;
            }
            const portfolioMayContainExistingData = portfolioState.status !== 'empty';
            if (!forceOpen
                && (hasExistingFirstRunOwnerState(ownerState, queueTaskCount) || portfolioMayContainExistingData)) {
                setLoadState(loaded);
                return;
            }
            const now = new Date().toISOString();
            const initial = reconcileFirstRunSetupState(
                createFirstRunSetupState(now),
                ownerState,
                now,
            );
            try {
                setLoadState({ status: 'ready', state: writeFirstRunSetupState(initial) });
            } catch {
                setLoadState({ status: 'ready', state: initial });
                setMessage('Browser storage is unavailable. Setup actions still work, but progress cannot be resumed.');
            }
            setOpen(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [forceOpen, ownerState, portfolioState, queueReady, queueTaskCount, recordsReady]);

    const isOpen = open || forceOpen;

    useEffect(() => {
        if (!isOpen) return;
        const timer = window.setTimeout(() => headingRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, [isOpen]);

    useEffect(() => {
        if (loadState.status !== 'ready' || portfolioState === null) return;
        const next = reconcileFirstRunSetupState(loadState.state, ownerState, new Date().toISOString());
        if (sameState(loadState.state, next)) return;
        const timer = window.setTimeout(() => persist(next), 0);
        return () => window.clearTimeout(timer);
    }, [loadState, ownerState, portfolioState]);

    const state = loadState.status === 'ready' ? loadState.state : null;
    const firstRecord = records[0] ?? null;
    const completedCount = state?.completedSteps.length ?? 0;

    const restart = () => {
        const next = createFirstRunSetupState(new Date().toISOString());
        try {
            clearFirstRunSetupState();
        } catch {
            // Persist below retains a safe session-only fallback when storage is unavailable.
        }
        persist(reconcileFirstRunSetupState(next, ownerState, new Date().toISOString()));
        setOpen(true);
        setMessage('Setup restarted. Existing Research, Portfolio, Queue, Calendar, Alerts, and Sources data was not changed.');
    };

    if (loadState.status === 'loading') return null;

    if (loadState.status === 'invalid') {
        return (
            <section data-testid="first-run-setup-recovery" className={'mx-auto mt-4 w-full max-w-[1280px] rounded-lg border p-4 ' + styles.panelUtility}>
                <h2 className={'text-sm font-bold ' + styles.textPrimary}>Setup progress needs recovery</h2>
                <p role="alert" className={'mt-1 text-xs leading-5 ' + styles.risk}>{loadState.message}</p>
                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Restart removes only the malformed setup-progress key. Existing Research and Portfolio data stays unchanged.</p>
                <button type="button" onClick={restart} className={'mt-3 min-h-10 rounded border px-4 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.selectedRow}>Restart setup safely</button>
            </section>
        );
    }

    if (loadState.status === 'unavailable') {
        return (
            <section data-testid="first-run-setup-unavailable" className={'mx-auto mt-4 w-full max-w-[1280px] rounded-lg border p-4 ' + styles.panelUtility}>
                <h2 className={'text-sm font-bold ' + styles.textPrimary}>Setup progress is unavailable</h2>
                <p role="alert" className={'mt-1 text-xs leading-5 ' + styles.risk}>{loadState.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={restart} className={'min-h-10 rounded border px-4 text-xs font-bold ' + styles.selectedRow}>Use setup for this session</button>
                    <Link href="/demo" prefetch={false} className={'inline-flex min-h-10 items-center rounded border px-4 text-xs font-bold ' + styles.row}>Open read-only demo</Link>
                </div>
            </section>
        );
    }

    if (state === null && !forceOpen) return null;

    if (!isOpen || state === null || state.status !== 'active') {
        const statusLabel = state?.status === 'completed'
            ? 'Complete'
            : state?.status === 'skipped' ? 'Skipped' : 'Available';
        return (
            <div className="mx-auto mt-3 flex w-full max-w-[1280px] justify-end px-4 min-[700px]:px-6">
                <button
                    type="button"
                    data-testid="open-first-run-setup"
                    onClick={() => {
                        if (state === null) restart();
                        else {
                            persist(setFirstRunSetupStatus(state, 'active', new Date().toISOString()));
                            setOpen(true);
                        }
                    }}
                    className={'min-h-10 rounded border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.row}
                >
                    Setup &amp; demo · {statusLabel}
                </button>
            </div>
        );
    }

    return (
        <section data-testid="first-run-setup" aria-labelledby="first-run-setup-title" className={'mx-auto mt-4 w-[calc(100%-2rem)] max-w-[1232px] rounded-[10px] border p-4 min-[700px]:p-5 ' + styles.panelAction}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Local, reversible setup</p>
                    <h2 ref={headingRef} tabIndex={-1} id="first-run-setup-title" className={'mt-1 text-xl font-bold outline-none ' + styles.textPrimary}>Reach a first useful review</h2>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>Setup records only bounded progress in this browser. It never activates providers, invents research, replaces existing data, or changes Signal&apos;s default Watchlist workspace.</p>
                </div>
                <span className={'rounded-full border px-3 py-1 text-xs font-bold ' + styles.row}>{completedCount}/5 steps complete</span>
            </div>

            <ol className="mt-5 grid gap-3 min-[900px]:grid-cols-2">
                {firstRunSetupStepIds.map((step, index) => {
                    const complete = state.completedSteps.includes(step)
                        || (step === 'monitoring' && state.monitoringChoice === 'skipped');
                    return (
                        <li key={step} className={'rounded-lg border p-4 ' + (complete ? styles.selectedRow : styles.panelSolid)}>
                            <div className="flex items-start gap-3">
                                <span aria-hidden="true" className={'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ' + (complete ? styles.positive : styles.textMuted)}>{complete ? '✓' : index + 1}</span>
                                <div className="min-w-0">
                                    <h3 className={'text-sm font-bold ' + styles.textPrimary}>{stepCopy[step].title}</h3>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{stepCopy[step].detail}</p>
                                    {step === 'markets' ? (
                                        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Markets to follow">
                                            {(['US', 'MY'] as const).map((market) => {
                                                const selected = state.markets.includes(market);
                                                return (
                                                    <button
                                                        key={market}
                                                        type="button"
                                                        aria-pressed={selected}
                                                        onClick={() => {
                                                            const markets: FirstRunMarket[] = selected
                                                                ? state.markets.filter((item) => item !== market)
                                                                : [...state.markets, market];
                                                            persist(reconcileFirstRunSetupState(
                                                                updateFirstRunMarkets(state, markets, new Date().toISOString()),
                                                                ownerState,
                                                                new Date().toISOString(),
                                                            ));
                                                        }}
                                                        className={'min-h-10 rounded border px-4 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + (selected ? styles.selectedRow : styles.row)}
                                                    >{market === 'US' ? 'US market' : 'Malaysia market'}</button>
                                                );
                                            })}
                                        </div>
                                    ) : step === 'watchlist' ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button type="button" onClick={onStartAdd} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>Add watchlist name</button>
                                            <button type="button" onClick={() => onOpenWorkspace('portfolio')} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>Import holdings</button>
                                        </div>
                                    ) : step === 'review' ? (
                                        <button type="button" disabled={!firstRecord} onClick={() => firstRecord && onOpenReview(firstRecord.symbol)} className={'mt-3 min-h-10 rounded border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.row}>{firstRecord ? `Review ${firstRecord.symbol}` : 'Add a saved name first'}</button>
                                    ) : step === 'schedule' ? (
                                        <button type="button" disabled={!firstRecord} onClick={() => firstRecord && onOpenReview(firstRecord.symbol)} className={'mt-3 min-h-10 rounded border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.row}>{firstRecord ? `Schedule ${firstRecord.symbol}` : 'Add a saved name first'}</button>
                                    ) : (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            <button type="button" disabled={!firstRecord} onClick={() => firstRecord && onOpenReview(firstRecord.symbol)} className={'min-h-10 rounded border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.row}>Open monitoring rules</button>
                                            <button type="button" onClick={() => persist(reconcileFirstRunSetupState(
                                                setFirstRunMonitoringSkipped(state, state.monitoringChoice !== 'skipped', new Date().toISOString()),
                                                ownerState,
                                                new Date().toISOString(),
                                            ))} className={'min-h-10 rounded border px-3 text-xs font-bold ' + styles.row}>{state.monitoringChoice === 'skipped' ? 'Include optional step' : 'Skip optional step'}</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            <div className={'mt-5 flex flex-col gap-3 border-t pt-4 min-[700px]:flex-row min-[700px]:items-center min-[700px]:justify-between ' + styles.divider}>
                <div>
                    <Link href="/demo" prefetch={false} className={'inline-flex min-h-10 items-center rounded border px-4 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 ' + styles.selectedRow}>Explore read-only demo</Link>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Demo data is isolated, session-only, and labelled example data on every screen.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => {
                        persist(setFirstRunSetupStatus(state, 'skipped', new Date().toISOString()));
                        setOpen(false);
                        onCloseRequested();
                    }} className={'min-h-10 rounded border px-4 text-xs font-bold ' + styles.row}>Skip for now</button>
                    <button type="button" onClick={() => {
                        setOpen(false);
                        onCloseRequested();
                    }} className={'min-h-10 rounded border px-4 text-xs font-bold ' + styles.row}>Hide setup</button>
                    <button type="button" onClick={restart} className={'min-h-10 rounded border px-4 text-xs font-bold ' + styles.row}>Restart setup</button>
                </div>
            </div>
            {portfolioState?.status === 'invalid' ? <p role="alert" className={'mt-3 text-xs leading-5 ' + styles.risk}>{portfolioState.message} Use the existing Portfolio recovery path; setup did not clear it.</p> : null}
            {message ? <p role="status" className={'mt-3 text-xs leading-5 ' + styles.textSecondary}>{message}</p> : null}
        </section>
    );
};
