'use client';

import Link from 'next/link';
import { marketTimestampLabel } from '@/lib/market-display';
import type { SignalIntradayEntry } from '@/lib/types/signal-intraday';
import { signed, type Market } from '@/components/v8/market-v8-fixtures';
import type { V9MarketTodayState } from './useV9MarketToday';
import styles from './v9-workspace.module.css';

const captureTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
});
const weight = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 2 });
const raw = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
const reading = (value: number | null, formatter: Intl.NumberFormat) => value === null ? 'unavailable' : formatter.format(value);
const effect = (value: number | null) => value === null ? 'unavailable' : `${signed(value, 2)} pts`;
const marketName = (market: Market) => market === 'US' ? 'United States' : 'Malaysia';
const statusText = {
    baseline: 'First capture', changed: 'Input or score changed', unchanged: 'No change', unavailable: 'Comparison unavailable',
} satisfies Record<SignalIntradayEntry['status'], string>;

function CaptureTime({ value }: { value: string }) {
    return <time dateTime={value}>{captureTime.format(new Date(value))} MYT</time>;
}

function ScoreTransition({ entry }: { entry: SignalIntradayEntry }) {
    const direction = entry.delta === null || entry.delta === 0 ? undefined : entry.delta > 0 ? 'up' : 'down';
    return <span className={styles.todayTransition}>
        <strong>{entry.previousScore === null ? `${entry.score}/100` : `${entry.previousScore} → ${entry.score}/100`}</strong>
        {entry.delta !== null && <span className={styles.todayDelta} data-direction={direction}>{signed(entry.delta, 0)} pts</span>}
    </span>;
}

export function V9MarketTodaySummary({ market, href, state }: { market: Market; href: string; state: V9MarketTodayState }) {
    const latest = state.status === 'ready' ? state.data.entries[0] : null;
    return <div className={styles.pulseToday}>
        <Link href={href} prefetch={false} className={styles.textLink} aria-label={`What changed today? ${marketName(market)}`}>What changed today? →</Link>
        <div className={styles.todayPreview}>
            {latest ? <><CaptureTime value={latest.capturedAt} /><ScoreTransition entry={latest} /><span>{statusText[latest.status]}</span></>
                : state.status === 'loading' ? 'Checking today’s captures…'
                    : state.status === 'error' ? 'Capture history unavailable.' : 'No captures for this UTC day yet.'}
        </div>
    </div>;
}

export function V9MarketTodayPanel({ market, state }: { market: Market; state: V9MarketTodayState }) {
    return <section className={styles.todayPanel} aria-label="Intraday market timeline">
        <div className={styles.sectionHead}>
            <div>
                <h2>What changed today?</h2>
                <p>{marketName(market)} · UTC day {marketTimestampLabel(state.day)} · Capture times in MYT</p>
            </div>
        </div>
        {state.status === 'loading' ? <p role="status">Loading today’s captures…</p>
            : state.status === 'error' ? <div className={styles.todayLoad}>
                <p role="alert">Today’s capture history could not be loaded.</p>
                <button type="button" className={styles.textLink} onClick={state.retry}>Retry today’s captures</button>
            </div>
                : state.data.entries.length === 0 ? <p role="status">No captures for this market and configuration on this UTC day yet.</p>
                    : <>
                        <p>Times show when Signal captured a reading. Individual inputs may have earlier observation dates.</p>
                        <ol className={styles.todayList}>
                            {state.data.entries.map(entry => <li key={entry.id}>
                                <div className={styles.todayCaptureHead}>
                                    <CaptureTime value={entry.capturedAt} />
                                    <ScoreTransition entry={entry} />
                                    <span className={styles.toneBadge}>{statusText[entry.status]}</span>
                                </div>
                                <p>{entry.reason.text}</p>
                                {entry.accounting ? <details className={styles.todayAccounting}>
                                    <summary>Score contributions and input weights</summary>
                                    {entry.accounting.drivers.length > 0 && <dl>
                                        {entry.accounting.drivers.map(driver => <div key={driver.key}>
                                            <dt>{driver.name}</dt>
                                            <dd>
                                                {(driver.beforeValue !== null || driver.afterValue !== null) && <span>Reading {reading(driver.beforeValue, raw)} → {reading(driver.afterValue, raw)}</span>}
                                                <span>Weight {reading(driver.beforeWeight, weight)} → {reading(driver.afterWeight, weight)}</span>
                                                <span>Score effect {effect(driver.scoreEffect)}</span>
                                                <span>Weight effect {effect(driver.weightEffect)}</span>
                                                <span>Net {effect(driver.delta)}</span>
                                            </dd>
                                        </div>)}
                                    </dl>}
                                    <p>Input contributions {signed(entry.accounting.componentDelta, 2)} pts · Neutral fallback {signed(entry.accounting.neutralDelta, 2)} pts · Rounding {signed(entry.accounting.roundingResidual, 2)} pts</p>
                                </details> : entry.status !== 'baseline' && <p>Score contributions and input weights are unavailable for this comparison.</p>}
                            </li>)}
                        </ol>
                        {state.data.hasEarlierCaptures && <div className={styles.todayLoad}>
                            <button type="button" className={styles.textLink} onClick={state.loadOlder} disabled={state.loadingOlder}>
                                {state.loadingOlder ? 'Loading older captures…' : state.olderError ? 'Retry older captures' : 'Load older captures'}
                            </button>
                            {state.olderError && <p role="alert">Older captures could not be loaded.</p>}
                        </div>}
                    </>}
    </section>;
}
