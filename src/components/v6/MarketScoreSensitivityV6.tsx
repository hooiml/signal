'use client';

import { useMemo, useState } from 'react';
import { simulateMarketScore } from '@/lib/market-sensitivity';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { formatSignedV6 } from './market-v6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const tierLabel = (tier: MarketSignal['tier']) => tier.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

export const MarketScoreSensitivityV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const [overrides, setOverrides] = useState<Readonly<Record<string, number>>>({});
    const result = useMemo(() => simulateMarketScore(signal, overrides), [overrides, signal]);
    const changed = result.drivers.some((driver) => driver.simulatedScore !== driver.baseScore);
    const trackChange = () => trackProductAnalyticsEvent({
        name: 'market_sensitivity_changed',
        surface: 'market',
        workspace: 'market_conditions',
    });
    const applyShift = (shift: number) => {
        setOverrides(Object.fromEntries(result.drivers.map((driver) => [driver.key, Math.max(0, Math.min(100, driver.baseScore + shift))])));
        trackChange();
    };

    return <section data-testid="market-score-sensitivity" aria-labelledby="market-score-sensitivity-title" data-surface-tier="analysis" className={'rounded-lg border p-5 sm:p-6 ' + styles.panel}>
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Fixed-weight what-if</p>
                <h2 id="market-score-sensitivity-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Score sensitivity simulator</h2>
                <p className={'mt-2 text-sm leading-6 ' + styles.textSecondary}>
                    Change normalized indicator scores while holding configured weights, coverage reserve, and mode fixed. This is arithmetic sensitivity, not a provider refresh or forecast.
                </p>
            </div>
            <div className={'min-w-48 rounded border p-3 text-right ' + styles.panelUtility}>
                <p className={'text-xs ' + styles.textMuted}>Simulated composite</p>
                <p className={'mt-1 text-2xl font-bold ' + styles.textPrimary}>{result.simulatedScore} <span className={'text-sm ' + (result.scoreDelta > 0 ? styles.positive : result.scoreDelta < 0 ? styles.risk : styles.textMuted)}>({formatSignedV6(result.scoreDelta)})</span></p>
                <p className={'mt-1 text-xs ' + styles.textSecondary}>{tierLabel(result.simulatedTier)}{result.simulatedTier !== result.baseTier ? ` · from ${tierLabel(result.baseTier)}` : ' · tier unchanged'}</p>
            </div>
        </div>

        <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => applyShift(-15)} className={'min-h-10 shrink-0 rounded border px-3 text-xs font-bold ' + styles.row}>All drivers −15</button>
            <button type="button" onClick={() => applyShift(15)} className={'min-h-10 shrink-0 rounded border px-3 text-xs font-bold ' + styles.row}>All drivers +15</button>
            <button type="button" disabled={!changed} onClick={() => {
                setOverrides({});
                trackChange();
            }} className={'min-h-10 shrink-0 rounded border px-3 text-xs font-bold disabled:opacity-40 ' + styles.row}>Reset current inputs</button>
        </div>

        {result.drivers.length > 0 ? <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {result.drivers.map((driver) => (
                <label key={driver.key} className={'min-w-0 rounded border p-4 ' + styles.row}>
                    <span className="flex flex-wrap items-start justify-between gap-3">
                        <span>
                            <span className={'block text-sm font-bold ' + styles.textPrimary}>{driver.name}</span>
                            <span className={'mt-1 block text-xs ' + styles.textMuted}>{Math.round(driver.weight * 100)}% fixed weight · current {driver.baseScore.toFixed(0)}</span>
                        </span>
                        <span className={'font-mono text-sm font-bold ' + styles.textPrimary}>{driver.simulatedScore.toFixed(0)} <span className={'text-xs ' + (driver.contributionDelta > 0 ? styles.positive : driver.contributionDelta < 0 ? styles.risk : styles.textMuted)}>{formatSignedV6(driver.contributionDelta, 1)} pts</span></span>
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={driver.simulatedScore}
                        aria-label={`${driver.name} simulated normalized score`}
                        onChange={(event) => setOverrides((current) => ({ ...current, [driver.key]: Number(event.target.value) }))}
                        onPointerUp={trackChange}
                        onBlur={trackChange}
                        className="mt-4 w-full accent-emerald-500"
                    />
                    <span className={'mt-1 flex justify-between text-[10px] ' + styles.textMuted}><span>0</span><span>Neutral 50</span><span>100</span></span>
                </label>
            ))}
        </div> : <p className={'mt-5 rounded border p-6 text-center text-sm ' + styles.panelUtility + ' ' + styles.textMuted}>Active scored drivers are unavailable for simulation.</p>}

        <div className={'mt-4 grid gap-2 border-t pt-4 text-xs sm:grid-cols-3 ' + styles.divider}>
            <p className={styles.textMuted}>Neutral missing-source reserve: <strong className={styles.textSecondary}>{result.neutralPoints.toFixed(1)} points</strong></p>
            <p className={styles.textMuted}>Mode held fixed: <strong className={styles.textSecondary}>{signal.mode === 'standard' ? 'Momentum' : 'Contrarian'}</strong></p>
            <p className={styles.textMuted}>Weights held fixed: <strong className={styles.textSecondary}>{result.weightRegime === 'high-volatility-override' ? 'Current high-volatility override' : 'Current base weights'}</strong></p>
        </div>
        <p className={'mt-3 text-xs leading-5 ' + styles.textMuted}>Simulated alignment conflicts: <strong className={styles.textSecondary}>{result.conflicts.length > 0 ? result.conflicts.join(', ') : 'None'}</strong></p>
        <p className={'mt-3 text-xs leading-5 ' + styles.textMuted}>Changing a normalized VIX score does not change its raw value or trigger the engine&apos;s high-volatility weighting rule. Use the live Market controls for a real recalculation.</p>
    </section>;
};
