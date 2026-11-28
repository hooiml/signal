'use client';

import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { watchlistReview, type WatchlistReview } from '@/lib/research/watchlist-review';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchAlert } from '@/lib/types/research-alert';
import { V9Navigation } from './v9-navigation';
import type { V9AlertsScanState } from './useV9AlertsScan';
import styles from './v9-workspace.module.css';

const severityLabel: Record<ResearchAlert['severity'], string> = {
    risk: 'Risk',
    watch: 'Watch',
    opportunity: 'Opportunity',
};

const reviewBadgeLabel = (review: WatchlistReview): string => {
    if (review.status === 'overdue') return 'Overdue';
    if (review.status === 'today') return 'Due today';
    return review.date ? `Due ${review.date}` : 'Due this week';
};

export function V9AttentionPopover({
    records,
    workspace,
    utcDay,
    alertsScan,
}: {
    readonly records: readonly ResearchRecord[] | null;
    readonly workspace: 'checking' | 'guest' | 'owner';
    readonly utcDay: string;
    readonly alertsScan: V9AlertsScanState;
}) {
    const v9Href = useContext(V9Navigation)!;
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const dueReviews = useMemo(() => {
        if (workspace !== 'owner' || !records?.length) return [];
        return records
            .map(record => ({ record, review: watchlistReview(record, utcDay) }))
            .filter(entry => entry.review.dueThisWeek)
            .sort((left, right) => {
                const leftDate = left.review.date ?? '9999-99-99';
                const rightDate = right.review.date ?? '9999-99-99';
                return leftDate.localeCompare(rightDate) || left.record.symbol.localeCompare(right.record.symbol);
            });
    }, [records, utcDay, workspace]);

    const marketBySymbol = useMemo(() => {
        const map = new Map<string, ResearchMarket>();
        for (const record of records ?? []) {
            const sym = record.symbol.trim().toUpperCase();
            if (!map.has(sym)) map.set(sym, record.market);
        }
        return map;
    }, [records]);

    const alertCount = alertsScan.status === 'ready' ? alertsScan.matchedSymbols.size : 0;
    const attentionCount = dueReviews.length + alertCount;

    useEffect(() => {
        if (!open) return;
        const onPointerDown = (event: PointerEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                triggerRef.current?.focus({ preventScroll: true });
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const triggerLabel = attentionCount > 0
        ? `Reviews and alerts (${dueReviews.length} due reviews, ${alertCount} triggered alerts)`
        : 'Reviews and alerts';

    return (
        <div ref={wrapRef} className={styles.attentionWrap}>
            <button
                ref={triggerRef}
                type="button"
                className={styles.attentionTrigger}
                aria-label={triggerLabel}
                aria-haspopup="dialog"
                aria-expanded={open}
                data-open={open}
                data-testid="attention-trigger"
                onClick={() => setOpen(prev => !prev)}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0" />
                </svg>
                {attentionCount > 0 && (
                    <span className={styles.attentionDot} data-testid="attention-dot" aria-hidden="true" />
                )}
            </button>

            {open && (
                <div
                    className={styles.attentionPopover}
                    role="dialog"
                    aria-label="Reviews and alerts"
                    data-testid="attention-popover"
                >
                    <div className={styles.attentionHead}>
                        <div>
                            <strong>Attention &amp; Triggers</strong>
                            <small>Loaded reviews · on-demand alerts</small>
                        </div>
                        <button
                            type="button"
                            className={styles.attentionClose}
                            aria-label="Close reviews and alerts"
                            onClick={() => {
                                setOpen(false);
                                triggerRef.current?.focus({ preventScroll: true });
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    <section className={styles.attentionSection} aria-label="Due reviews">
                        <div className={styles.attentionSubhead}>
                            <span>Due reviews</span>
                            {workspace === 'owner' && (
                                <span className={styles.attentionCount}>{dueReviews.length}</span>
                            )}
                        </div>
                        {workspace === 'checking' ? (
                            <p className={styles.attentionEmpty}>Loading saved research…</p>
                        ) : workspace !== 'owner' ? (
                            <p className={styles.attentionEmpty}>Guest bookmarks have no review schedule.</p>
                        ) : dueReviews.length === 0 ? (
                            <p className={styles.attentionEmpty}>No reviews overdue or due this week.</p>
                        ) : (
                            <ul className={styles.attentionList}>
                                {dueReviews.slice(0, 6).map(({ record, review }) => (
                                    <li key={`${record.market}:${record.symbol}`}>
                                        <Link
                                            className={styles.attentionRowLink}
                                            href={v9Href('research', { ticker: record.symbol, market: record.market, tab: 'review' })}
                                            onClick={() => setOpen(false)}
                                        >
                                            <span className={styles.attentionRowMain}>
                                                <b>{record.symbol}</b>
                                                <small>{record.companyName || record.symbol}</small>
                                            </span>
                                            <span className={styles.attentionBadge} data-tone={review.status === 'overdue' ? 'risk' : 'watch'}>
                                                {reviewBadgeLabel(review)}
                                            </span>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section className={styles.attentionSection} aria-label="On-demand alerts">
                        <div className={styles.attentionSubhead}>
                            <span>On-demand alerts</span>
                            {alertsScan.status === 'ready' && (
                                <span className={styles.attentionCount}>{alertsScan.matchedSymbols.size}</span>
                            )}
                        </div>

                        {!records?.length ? (
                            <p className={styles.attentionEmpty}>Save a security to check price, trend &amp; rule alerts.</p>
                        ) : alertsScan.status === 'idle' ? (
                            <div className={styles.attentionPrompt}>
                                <p className={styles.attentionEmpty}>
                                    Manual check across {alertsScan.monitoredCount} saved {alertsScan.monitoredCount === 1 ? 'stock' : 'stocks'} — no background polling.
                                </p>
                                <button type="button" className={styles.attentionActionBtn} onClick={alertsScan.scan}>
                                    Check alerts now
                                </button>
                            </div>
                        ) : alertsScan.status === 'loading' ? (
                            <p className={styles.attentionEmpty} role="status">
                                Checking {alertsScan.monitoredCount} saved stocks…
                            </p>
                        ) : alertsScan.status === 'error' ? (
                            <div className={styles.attentionPrompt}>
                                <p className={styles.attentionError} role="alert">{alertsScan.error}</p>
                                <button type="button" className={styles.attentionActionBtn} onClick={alertsScan.scan}>
                                    Retry check
                                </button>
                            </div>
                        ) : (
                            <div className={styles.attentionResults}>
                                <div className={styles.attentionMetaRow}>
                                    <span>{alertsScan.data?.monitoredCount ?? 0} checked · {alertsScan.sortedAlerts.length} alert{alertsScan.sortedAlerts.length === 1 ? '' : 's'}</span>
                                    <button type="button" className={styles.textLink} onClick={alertsScan.scan}>
                                        Re-check
                                    </button>
                                </div>
                                {alertsScan.sortedAlerts.length === 0 && alertsScan.matchedTriggers.length === 0 ? (
                                    <p className={styles.attentionEmpty}>No active conditions or matched rules right now.</p>
                                ) : (
                                    <ul className={styles.attentionList}>
                                        {alertsScan.sortedAlerts.slice(0, 6).map(alert => {
                                            const alertMarket = marketBySymbol.get(alert.symbol.trim().toUpperCase()) ?? 'US';
                                            return (
                                                <li key={alert.id}>
                                                    <Link
                                                        className={styles.attentionRowLink}
                                                        href={v9Href('research', {
                                                            ticker: alert.symbol,
                                                            market: alertMarket,
                                                            ...(alert.kind === 'structured-trigger' ? { tab: 'monitoring' } : {}),
                                                        })}
                                                        onClick={() => setOpen(false)}
                                                    >
                                                        <span className={styles.attentionRowMain}>
                                                            <b>{alert.symbol} · {alert.title}</b>
                                                            <small>{alert.detail}</small>
                                                        </span>
                                                        <span className={styles.attentionBadge} data-tone={alert.severity}>
                                                            {severityLabel[alert.severity]}
                                                        </span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                        {alertsScan.sortedAlerts.length === 0 && alertsScan.matchedTriggers.slice(0, 6).map(trigger => {
                                            const triggerMarket = marketBySymbol.get(trigger.symbol.trim().toUpperCase()) ?? 'US';
                                            return (
                                                <li key={`${trigger.symbol}-${trigger.rule.id}`}>
                                                    <Link
                                                        className={styles.attentionRowLink}
                                                        href={v9Href('research', { ticker: trigger.symbol, market: triggerMarket, tab: 'monitoring' })}
                                                        onClick={() => setOpen(false)}
                                                    >
                                                        <span className={styles.attentionRowMain}>
                                                            <b>{trigger.symbol} · {trigger.title}</b>
                                                            <small>{trigger.detail}</small>
                                                        </span>
                                                        <span className={styles.attentionBadge} data-tone="watch">
                                                            Matched
                                                        </span>
                                                    </Link>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        )}
                    </section>

                    <div className={styles.attentionFoot}>
                        <Link
                            className={styles.textLink}
                            href={v9Href('research', { tab: 'watchlist' })}
                            onClick={() => setOpen(false)}
                        >
                            Watchlist →
                        </Link>
                        <Link
                            className={styles.textLink}
                            href={v9Href('discover', { discover: 'alerts' })}
                            onClick={() => setOpen(false)}
                        >
                            Discover · Alerts →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
