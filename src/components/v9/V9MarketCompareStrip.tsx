'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import { marketReadingLabel } from '@/lib/market-display';
import { marketEvidenceCoverage, marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { MARKET_SCORE_TIER_THRESHOLDS } from '@/lib/market-score-thresholds';
import { inputImpact } from '@/components/v8/market-last-visit';
import { fullDate, parseConnectedSignal } from '@/components/v8/MarketV8ConnectedData';
import { readData, readPolicies } from '@/components/v8/read-data';
import type { Market, Mode } from '@/components/v8/market-v8-fixtures';
import type { SignalSlot } from './V9HomeView';
import { V9SegmentedPill } from './V9Primitives';
import styles from './v9-workspace.module.css';

export type CompareTab = 'markets' | 'modes';

type Tone = 'up' | 'neutral' | 'down';

const toneForTier = (tier: MarketSignal['tier']): Tone =>
    tier === 'buy' || tier === 'strong-buy' ? 'up' : tier === 'sell' || tier === 'strong-sell' ? 'down' : 'neutral';

const signedPts = (value: number): string => {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded > 0 ? '+' : rounded < 0 ? '−' : '±'}${Math.abs(rounded).toFixed(1)} pts`;
};

function CompareMarketColumn({
    title,
    market,
    active,
    slot,
    onSwitch,
}: {
    readonly title: string;
    readonly market: Market;
    readonly active: boolean;
    readonly slot: SignalSlot;
    readonly onSwitch: () => void;
}) {
    const signal = slot.signal;
    const referenceDate = signal ? (signal.metadata.snapshot_persistence?.snapshot_date ?? slot.receivedAt) : undefined;
    const coverage = signal ? marketEvidenceCoverage(signal, referenceDate) : null;
    const snapshotDay = signal ? marketEvidenceDay(signal.metadata.snapshot_persistence?.snapshot_date ?? slot.receivedAt) : null;
    const tone: Tone = signal ? toneForTier(signal.tier) : 'neutral';
    const { neutralLower, neutralUpper } = MARKET_SCORE_TIER_THRESHOLDS;

    const leadingDriver = useMemo(() => {
        if (!signal) return null;
        const activeEntries = Object.entries(signal.components)
            .filter(([, item]) => item && item.enabled !== false && item.weight > 0)
            .map(([key, item]) => ({
                key,
                name: item.display_name || getIndicatorDisplayName(key),
                impact: inputImpact(item.score, item.weight),
            }))
            .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
        return activeEntries[0] ?? null;
    }, [signal]);

    return (
        <article className={styles.compareCol} data-active={active}>
            <div className={styles.compareColHead}>
                <div>
                    <h3>{title}</h3>
                    <span>{snapshotDay ? `Snapshot ${fullDate(snapshotDay)}` : slot.loading ? 'Loading…' : 'Date unavailable'}</span>
                </div>
                {active ? (
                    <span className={styles.compareActiveTag}>Active view</span>
                ) : (
                    <button type="button" className={styles.textLink} onClick={onSwitch}>
                        Switch to {market === 'MY' ? 'Malaysia' : 'US'} →
                    </button>
                )}
            </div>

            {slot.loading && !signal ? (
                <p className={styles.compareNote} role="status">Loading {title} reading…</p>
            ) : slot.error || !signal ? (
                <p className={styles.compareNote} role="status">{slot.error || `${title} reading is unavailable.`}</p>
            ) : (
                <>
                    <div className={styles.compareScoreRow}>
                        <strong className={styles.compareScore} data-tone={tone}>
                            {signal.composite_score.toFixed(0)}<small>/100</small>
                        </strong>
                        <span className={styles.toneBadge} data-tone={tone}>{marketReadingLabel(signal.tier)}</span>
                    </div>

                    <div className={styles.v9ZoneTrack} aria-hidden="true">
                        <span className={styles.v9ZoneSegNeg} style={{ width: `${neutralLower}%` }} />
                        <span className={styles.v9ZoneSegNeu} style={{ width: `${neutralUpper - neutralLower}%` }} />
                        <span className={styles.v9ZoneSegPos} style={{ width: `${100 - neutralUpper}%` }} />
                        <span className={styles.v9ZoneMarker} style={{ left: `${Math.min(100, Math.max(0, signal.composite_score))}%` }} />
                    </div>

                    <dl className={styles.compareMetaList}>
                        <div>
                            <dt>Coverage</dt>
                            <dd>
                                {coverage && coverage.observedPct !== null
                                    ? `${coverage.scoredCount}/${coverage.configuredCount} inputs · ${coverage.observedPct.toFixed(0)}% wt`
                                    : 'Unverified'}
                            </dd>
                        </div>
                        <div>
                            <dt>Top driver</dt>
                            <dd>
                                {leadingDriver
                                    ? `${leadingDriver.name} (${signedPts(leadingDriver.impact)})`
                                    : 'No active inputs'}
                            </dd>
                        </div>
                    </dl>
                </>
            )}
        </article>
    );
}

export function V9MarketCompareStrip({
    market,
    mode,
    social,
    usSlot,
    mySlot,
    onSelectMarket,
    onSelectMode,
    onClose,
}: {
    readonly market: Market;
    readonly mode: Mode;
    readonly social: boolean;
    readonly usSlot: SignalSlot;
    readonly mySlot: SignalSlot;
    readonly onSelectMarket: (next: Market) => void;
    readonly onSelectMode: (next: Mode) => void;
    readonly onClose: () => void;
}) {
    const [tab, setTab] = useState<CompareTab>('markets');
    const otherMode: Mode = mode === 'standard' ? 'contrarian' : 'standard';
    const otherKey = `${market}:${otherMode}:${social}`;
    const [otherState, setOtherState] = useState<{
        readonly key: string;
        readonly signal: MarketSignal | null;
        readonly loading: boolean;
        readonly error: string;
    } | null>(null);

    const activeSlot = market === 'MY' ? mySlot : usSlot;
    const otherLoaded = otherState?.key === otherKey ? otherState : null;
    const fetchedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (tab !== 'modes' || fetchedKeyRef.current === otherKey) return;
        fetchedKeyRef.current = otherKey;
        const controller = new AbortController();
        const url = `/api/signals/v2?market=${market}&mode=${otherMode}&enableSocial=${social}`;
        const timer = window.setTimeout(() => {
            setOtherState({ key: otherKey, signal: null, loading: true, error: '' });
            readData(url, controller.signal, readPolicies.score)
                .then(payload => parseConnectedSignal(payload, market, otherMode))
                .then(signal => {
                    if (!controller.signal.aborted) {
                        setOtherState({ key: otherKey, signal, loading: false, error: '' });
                    }
                })
                .catch(cause => {
                    if (!controller.signal.aborted) {
                        fetchedKeyRef.current = null;
                        setOtherState({
                            key: otherKey,
                            signal: null,
                            loading: false,
                            error: cause instanceof Error ? cause.message : 'Comparison reading could not be loaded.',
                        });
                    }
                });
        }, 0);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
            if (fetchedKeyRef.current === otherKey) fetchedKeyRef.current = null;
        };
    }, [market, otherKey, otherMode, social, tab]);

    const momentumSignal = mode === 'standard' ? activeSlot.signal : (otherLoaded?.signal ?? null);
    const contrarianSignal = mode === 'contrarian' ? activeSlot.signal : (otherLoaded?.signal ?? null);

    const modeRows = useMemo(() => {
        if (!momentumSignal || !contrarianSignal) return [];
        const keys = Array.from(new Set([
            ...Object.keys(momentumSignal.components),
            ...Object.keys(contrarianSignal.components),
        ]));
        return keys
            .filter(key => {
                const m = momentumSignal.components[key];
                const c = contrarianSignal.components[key];
                return (m && m.enabled !== false && m.weight > 0) || (c && c.enabled !== false && c.weight > 0);
            })
            .map(key => {
                const m = momentumSignal.components[key];
                const c = contrarianSignal.components[key];
                return {
                    key,
                    name: m?.display_name || c?.display_name || getIndicatorDisplayName(key),
                    weightPct: Math.round(((m?.weight ?? c?.weight ?? 0) * 100)),
                    scorePull: m && m.enabled !== false && m.weight > 0
                        ? inputImpact(m.score, m.weight)
                        : c && c.enabled !== false && c.weight > 0
                            ? inputImpact(c.score, c.weight)
                            : null,
                    momentumRead: m && m.enabled !== false && m.weight > 0 ? marketReadingLabel(m.signal) : '—',
                    momentumTone: m && m.enabled !== false && m.weight > 0 ? toneForTier(m.signal) : 'neutral' as Tone,
                    contrarianRead: c && c.enabled !== false && c.weight > 0 ? marketReadingLabel(c.signal) : '—',
                    contrarianTone: c && c.enabled !== false && c.weight > 0 ? toneForTier(c.signal) : 'neutral' as Tone,
                };
            })
            .sort((a, b) => Math.abs(b.scorePull ?? 0) - Math.abs(a.scorePull ?? 0));
    }, [contrarianSignal, momentumSignal]);

    return (
        <section className={`${styles.card} ${styles.compareStrip}`} aria-label="Market comparison" data-testid="v9-market-compare">
            <div className={styles.compareHead}>
                <div className={styles.compareHeadLeft}>
                    <h2>Compare readings</h2>
                    <V9SegmentedPill
                        ariaLabel="Comparison view"
                        value={tab}
                        onChange={setTab}
                        options={[
                            { value: 'markets', label: 'US vs. Malaysia' },
                            { value: 'modes', label: 'Momentum vs. Contrarian' },
                        ]}
                    />
                </div>
                <button type="button" className={styles.ghostBtn} onClick={onClose}>
                    Close compare
                </button>
            </div>

            {tab === 'markets' ? (
                <>
                    <div className={styles.compareGrid}>
                        <CompareMarketColumn
                            title="US Market"
                            market="US"
                            active={market === 'US'}
                            slot={usSlot}
                            onSwitch={() => onSelectMarket('US')}
                        />
                        <CompareMarketColumn
                            title="Malaysia · Bursa"
                            market="MY"
                            active={market === 'MY'}
                            slot={mySlot}
                            onSwitch={() => onSelectMarket('MY')}
                        />
                    </div>
                    <p className={styles.compareFoot}>
                        Both markets use {mode === 'contrarian' ? 'Contrarian' : 'Momentum'} mode with independent inputs and dates. Scores are not combined across markets.
                    </p>
                </>
            ) : (
                <>
                    <div className={styles.compareGrid}>
                        {([
                            ['standard', 'Momentum', momentumSignal, mode === 'standard' ? activeSlot.loading : (otherLoaded?.loading ?? true), mode === 'standard' ? activeSlot.error : (otherLoaded?.error ?? '')],
                            ['contrarian', 'Contrarian', contrarianSignal, mode === 'contrarian' ? activeSlot.loading : (otherLoaded?.loading ?? true), mode === 'contrarian' ? activeSlot.error : (otherLoaded?.error ?? '')],
                        ] as const).map(([lens, label, sig, isLoading, err]) => {
                            const tone: Tone = sig ? toneForTier(sig.tier) : 'neutral';
                            return (
                                <article key={lens} className={styles.compareCol} data-active={mode === lens}>
                                    <div className={styles.compareColHead}>
                                        <div>
                                            <h3>{label} lens</h3>
                                            <span>{lens === 'standard' ? 'Higher score = trend confirmation' : 'Higher score = crowding risk'}</span>
                                        </div>
                                        {mode === lens ? (
                                            <span className={styles.compareActiveTag}>Active lens</span>
                                        ) : (
                                            <button type="button" className={styles.textLink} onClick={() => onSelectMode(lens)}>
                                                Use {label} →
                                            </button>
                                        )}
                                    </div>
                                    {isLoading && !sig ? (
                                        <p className={styles.compareNote} role="status">Loading {label} reading…</p>
                                    ) : err || !sig ? (
                                        <p className={styles.compareNote} role="status">{err || `${label} reading unavailable.`}</p>
                                    ) : (
                                        <div className={styles.compareScoreRow}>
                                            <strong className={styles.compareScore} data-tone={tone}>
                                                {sig.composite_score.toFixed(0)}<small>/100</small>
                                            </strong>
                                            <span className={styles.toneBadge} data-tone={tone}>{marketReadingLabel(sig.tier)}</span>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>

                    {modeRows.length > 0 && (
                        <div className={styles.compareTableWrap}>
                            <table className={styles.compareTable}>
                                <thead>
                                    <tr>
                                        <th scope="col">Input</th>
                                        <th scope="col">Wt</th>
                                        <th scope="col">Pull</th>
                                        <th scope="col">Momentum</th>
                                        <th scope="col">Contrarian</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {modeRows.map(row => (
                                        <tr key={row.key}>
                                            <th scope="row">{row.name}</th>
                                            <td>{row.weightPct}%</td>
                                            <td>{row.scorePull !== null ? signedPts(row.scorePull) : '—'}</td>
                                            <td data-direction={row.momentumTone === 'up' ? 'up' : row.momentumTone === 'down' ? 'down' : 'flat'}>
                                                {row.momentumRead}
                                            </td>
                                            <td data-direction={row.contrarianTone === 'up' ? 'up' : row.contrarianTone === 'down' ? 'down' : 'flat'}>
                                                {row.contrarianRead}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <p className={styles.compareFoot}>
                        Same {market === 'MY' ? 'Malaysia' : 'US'} tape interpreted under both lenses. Comparing modes does not change your active preference.
                    </p>
                </>
            )}
        </section>
    );
}
