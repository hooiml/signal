'use client';

import { useEffect, useRef } from 'react';
import { formatDiscoveryRankDelta } from '@/lib/research/discover-v9';
import type { DiscoveryContender, QualityDiscoveryResult } from '@/lib/types/research-discovery';
import styles from './v9-workspace.module.css';

const signedPercent = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;
const timingText = (timing: 'pre-market' | 'after-hours' | 'time-not-supplied') =>
    timing === 'pre-market' ? 'before open' : timing === 'after-hours' ? 'after close' : 'time not supplied';

export function V9DiscoverQuickPeekDrawer({
    row,
    isSaved,
    saving,
    saveError,
    canSave,
    onClose,
    onOpenResearch,
    onSaveToWatchlist,
}: {
    readonly row: QualityDiscoveryResult | DiscoveryContender | null;
    readonly isSaved: boolean;
    readonly saving: boolean;
    readonly saveError: string;
    readonly canSave: boolean;
    readonly onClose: () => void;
    readonly onOpenResearch: (symbol: string) => void;
    readonly onSaveToWatchlist?: (symbol: string, name: string) => void;
}) {
    const closeBtnRef = useRef<HTMLButtonElement>(null);
    const openerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!row) return;
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusTimer = window.setTimeout(() => closeBtnRef.current?.focus({ preventScroll: true }), 0);
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.clearTimeout(focusTimer);
            window.removeEventListener('keydown', onKeyDown);
            const opener = openerRef.current;
            if (opener && opener.isConnected) opener.focus({ preventScroll: true });
        };
    }, [row, onClose]);

    if (!row) return null;

    const delta = formatDiscoveryRankDelta(row);
    const valuationMetrics = [
        { label: 'Guardrail', value: row.valuation.guardrail },
        { label: 'P/E Ratio', value: row.valuation.priceEarnings === null ? 'Unavailable' : `${row.valuation.priceEarnings.toFixed(1)}×` },
        { label: 'P/S Ratio', value: row.valuation.priceSales === null ? 'Unavailable' : `${row.valuation.priceSales.toFixed(1)}×` },
        { label: 'FCF Yield', value: row.valuation.freeCashFlowYieldPercent === null ? 'Unavailable' : `${row.valuation.freeCashFlowYieldPercent.toFixed(1)}%` },
    ];

    return (
        <div
            className={styles.quickPeekBackdrop}
            onClick={onClose}
        >
            <aside
                className={styles.quickPeekDrawer}
                role="dialog"
                aria-modal="true"
                aria-labelledby="quick-peek-title"
                data-testid="discover-quick-peek-drawer"
                onClick={event => event.stopPropagation()}
            >
                <div className={styles.quickPeekBody}>
                    <div className={styles.quickPeekHead}>
                        <div className={styles.quickPeekIdentity}>
                            <div className={styles.quickPeekTitleRow}>
                                <h2 id="quick-peek-title" className={styles.quickPeekTitle}>{row.symbol}</h2>
                                {isSaved && <span className={styles.quickPeekSavedPill} data-testid="quick-peek-saved-badge">Saved</span>}
                                {delta && (
                                    <span className={styles.quickPeekDeltaPill} data-tone={delta.tone} title={delta.title}>
                                        {delta.label}
                                    </span>
                                )}
                            </div>
                            <p className={styles.quickPeekSub}>{row.name}</p>
                            <p className={styles.quickPeekMeta}>{row.sector} · {row.category}</p>
                        </div>
                        <button
                            ref={closeBtnRef}
                            type="button"
                            className={styles.quickPeekClose}
                            aria-label="Close quick peek"
                            onClick={onClose}
                        >
                            ✕
                        </button>
                    </div>

                    <div className={styles.quickPeekPriceCard}>
                        <div>
                            <small>Last price</small>
                            <div className={styles.quickPeekPrice}>${row.price.toFixed(2)}</div>
                        </div>
                        <div className={styles.quickPeekTrendStats}>
                            <div>
                                <small>3M trend</small>
                                <strong data-direction={row.momentum3MonthPercent < 0 ? 'down' : 'up'}>{signedPercent(row.momentum3MonthPercent)}</strong>
                            </div>
                            <div>
                                <small>6M trend</small>
                                <strong data-direction={row.momentum6MonthPercent < 0 ? 'down' : 'up'}>{signedPercent(row.momentum6MonthPercent)}</strong>
                            </div>
                            <div>
                                <small>vs 50D avg</small>
                                <strong>{signedPercent(row.distanceFromMa50Percent)}</strong>
                            </div>
                        </div>
                    </div>

                    <section className={styles.quickPeekSection} aria-label="Score and quality breakdown">
                        <h3>Score &amp; Quality Breakdown</h3>
                        <div className={styles.quickPeekStatGrid}>
                            <div>
                                <small>Discovery score</small>
                                <strong>{row.discoveryScore}</strong>
                            </div>
                            <div>
                                <small>Trend score</small>
                                <strong>{row.trendScore}</strong>
                            </div>
                            <div>
                                <small>Quality score</small>
                                <strong>{row.qualityScore ?? 'Unavailable'}</strong>
                            </div>
                            <div>
                                <small>Risk profile</small>
                                <strong style={{ textTransform: 'capitalize' }}>{row.risk} ({row.riskScore})</strong>
                            </div>
                        </div>
                        {row.qualityReasons.length > 0 && (
                            <ul className={styles.quickPeekReasons}>
                                {row.qualityReasons.slice(0, 4).map(reason => <li key={reason}>{reason}</li>)}
                            </ul>
                        )}
                        {row.reasons.length > 0 && (
                            <ul className={styles.quickPeekReasons}>
                                {row.reasons.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}
                            </ul>
                        )}
                        {row.flags.length > 0 && (
                            <p className={styles.quickPeekFlags}>Flags: {row.flags.join(' · ')}</p>
                        )}
                    </section>

                    <section className={styles.quickPeekSection} aria-label="Valuation context">
                        <h3>Valuation Guardrail</h3>
                        <div className={styles.quickPeekStatGrid}>
                            {valuationMetrics.map(item => (
                                <div key={item.label}>
                                    <small>{item.label}</small>
                                    <strong style={{ textTransform: 'capitalize' }}>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className={styles.quickPeekSection} aria-label="Catalyst date">
                        <h3>Upcoming Catalyst</h3>
                        {row.catalyst ? (
                            <p className={styles.quickPeekCatalyst}>
                                <strong>Earnings · {row.catalyst.date}</strong> · {timingText(row.catalyst.timing)}
                                <span>Unconfirmed · {row.catalyst.source}</span>
                            </p>
                        ) : (
                            <p className={styles.quickPeekMeta}>No upcoming earnings date supplied.</p>
                        )}
                    </section>

                    {'contenderReason' in row && (
                        <p className={styles.quickPeekMeta}>Contender note: {row.contenderReason}</p>
                    )}
                </div>

                <div className={styles.quickPeekFooter}>
                    {saveError && <p className={styles.quickPeekError} role="alert">{saveError}</p>}
                    <div className={styles.quickPeekActions}>
                        {canSave && onSaveToWatchlist && (
                            <button
                                type="button"
                                className={styles.quickPeekSecondary}
                                disabled={isSaved || saving}
                                onClick={() => onSaveToWatchlist(row.symbol, row.name)}
                            >
                                {isSaved ? 'Saved in watchlist' : saving ? 'Saving…' : 'Save to watchlist'}
                            </button>
                        )}
                        <button
                            type="button"
                            className={styles.quickPeekPrimary}
                            onClick={() => {
                                onClose();
                                onOpenResearch(row.symbol);
                            }}
                        >
                            Open full research →
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
}
