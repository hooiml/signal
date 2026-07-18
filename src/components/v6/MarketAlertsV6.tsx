'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MarketSignal } from '@/lib/types/signal-v2';
import {
    conditionNeedsThreshold,
    evaluateMarketAlert,
    getDefaultMarketAlertThreshold,
    getMarketAlertRulesForBriefing,
    parseMarketAlertRules,
    type MarketAlertCondition,
    type MarketAlertRule,
} from '@/lib/market-alerts';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const STORAGE_KEY = 'signal-market-alerts-v6';

const CONDITIONS: readonly { readonly value: MarketAlertCondition; readonly label: string }[] = [
    { value: 'score-above', label: 'Score rises to' },
    { value: 'score-below', label: 'Score falls to' },
    { value: 'agreement-below', label: 'Agreement falls below' },
    { value: 'tier-change', label: 'Market tier changes' },
    { value: 'freshness-risk', label: 'Data freshness weakens' },
    { value: 'daily-move', label: 'Daily score move reaches' },
];

export const MarketAlertsV6 = ({ signal, enableSocial, theme }: { readonly signal: MarketSignal; readonly enableSocial: boolean; readonly theme: ResearchThemeV6 }) => {
    const [rules, setRules] = useState<readonly MarketAlertRule[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [condition, setCondition] = useState<MarketAlertCondition>('score-above');
    const [threshold, setThreshold] = useState(() => getDefaultMarketAlertThreshold('score-above', signal));
    const [message, setMessage] = useState<string | null>(null);
    const [storageError, setStorageError] = useState<string | null>(null);
    const styles = getThemeV6(theme);
    const field = theme === 'light'
        ? 'border-slate-300 bg-white text-slate-950'
        : 'border-[#334354] bg-[#0b1118] text-[#eef2f7]';
    const marketRules = useMemo(() => getMarketAlertRulesForBriefing(rules, signal, enableSocial), [enableSocial, rules, signal]);
    const triggeredCount = marketRules.filter((rule) => evaluateMarketAlert(rule, signal).triggered).length;
    const needsThreshold = conditionNeedsThreshold(condition);
    const minimumThreshold = condition === 'daily-move' ? 0.5 : 0;
    const thresholdValid = !needsThreshold || (Number.isFinite(threshold) && threshold >= minimumThreshold && threshold <= 100);

    useEffect(() => {
        const timeoutId = window.setTimeout(() => {
            try {
                const stored = window.localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    try {
                        setRules(parseMarketAlertRules(JSON.parse(stored)));
                    } catch {
                        window.localStorage.removeItem(STORAGE_KEY);
                        setRules([]);
                        setMessage('Unreadable saved alerts were reset.');
                    }
                }
            } catch {
                setRules([]);
                setStorageError('Browser storage is unavailable. Market alerts cannot be saved on this device.');
            } finally {
                setLoaded(true);
            }
        }, 0);

        return () => window.clearTimeout(timeoutId);
    }, []);

    const changeCondition = (next: MarketAlertCondition) => {
        setCondition(next);
        setThreshold(getDefaultMarketAlertThreshold(next, signal));
        setMessage(null);
    };

    const addRule = () => {
        if (!loaded || storageError) return;
        if (!thresholdValid) {
            setMessage(`Enter a threshold from ${minimumThreshold} to 100.`);
            return;
        }
        const nextThreshold = needsThreshold ? threshold : null;
        const nextRule: MarketAlertRule = {
            id: window.crypto.randomUUID(),
            market: signal.metadata.market,
            mode: signal.mode,
            enableSocial,
            condition,
            threshold: nextThreshold,
            baselineTier: condition === 'tier-change' ? signal.tier : null,
            createdAt: new Date().toISOString(),
        };
        const nextRules = [...rules, nextRule];
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRules));
            setRules(nextRules);
            setStorageError(null);
            setMessage(`Alert added for ${signal.metadata.market}, ${formatMode(signal.mode)}, social ${enableSocial ? 'on' : 'off'}.`);
        } catch {
            setStorageError('Browser storage is unavailable. This alert was not saved.');
        }
    };

    const removeRule = (id: string) => {
        const nextRules = rules.filter((rule) => rule.id !== id);
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRules));
            setRules(nextRules);
            setStorageError(null);
            setMessage('Alert removed.');
        } catch {
            setStorageError('Browser storage is unavailable. The alert was not removed.');
        }
    };

    const thresholdSuffix = condition === 'agreement-below' ? '%' : condition === 'daily-move' ? 'points' : 'score';
    const alertForm = (
        <div className={'mt-4 grid gap-3 border-y py-4 min-[700px]:grid-cols-[minmax(220px,1fr)_minmax(150px,0.55fr)_auto] ' + styles.divider}>
            <label className="min-w-0">
                <span className={'block text-xs font-semibold ' + styles.textMuted}>Condition</span>
                <select value={condition} onChange={(event) => changeCondition(event.target.value as MarketAlertCondition)} className={'mt-1 min-h-10 w-full rounded-md border px-3 text-sm outline-none focus:border-emerald-500 ' + field}>
                    {CONDITIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            </label>
            {needsThreshold ? (
                <label>
                    <span className={'block text-xs font-semibold ' + styles.textMuted}>Threshold ({thresholdSuffix})</span>
                    <input type="number" min={minimumThreshold} max="100" step={condition === 'daily-move' ? 0.5 : 1} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} aria-invalid={!thresholdValid} className={'mt-1 min-h-10 w-full rounded-md border px-3 text-sm tabular-nums outline-none focus:border-emerald-500 ' + field} />
                </label>
            ) : <div className="hidden min-[700px]:block" />}
            <button type="button" onClick={addRule} disabled={!loaded || !thresholdValid || storageError !== null} className="min-h-10 self-end rounded-md bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45">Add alert</button>
        </div>
    );

    return (
        <section className={'rounded-lg border p-5 backdrop-blur-sm sm:p-6 ' + styles.panelSecondary} aria-labelledby="market-alerts-title" data-surface-tier="secondary">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.textMuted}>Keep watching</p>
                    <h2 id="market-alerts-title" className={'mt-1 text-lg font-bold ' + styles.textPrimary}>Alert me when...</h2>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Saved in this browser and checked whenever market conditions refresh.</p>
                </div>
                {marketRules.length > 0 ? (
                    <p className={'text-xs font-semibold ' + (triggeredCount > 0 ? styles.risk : styles.positive)}>
                        {triggeredCount > 0 ? `${triggeredCount} triggered` : `${marketRules.length} monitoring`}
                    </p>
                ) : null}
            </div>

            {!loaded ? <p className={'mt-4 py-4 text-sm ' + styles.textMuted}>Loading saved alerts...</p> : marketRules.length === 0 ? (
                <details className={'group mt-4 rounded-md border ' + styles.divider}>
                    <summary className={'flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 ' + styles.textPrimary}>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold">Set an alert</span>
                            <span className={'mt-1 block text-xs font-normal ' + styles.textMuted}>Choose a condition to monitor this market view.</span>
                        </span>
                        <span aria-hidden="true" className={'text-xl leading-none transition-transform group-open:rotate-45 ' + styles.textMuted}>+</span>
                    </summary>
                    {alertForm}
                </details>
            ) : alertForm}

            <div aria-live="polite">{message ? <p className={'mt-3 text-xs ' + styles.textSecondary}>{message}</p> : null}</div>
            {storageError ? <p role="status" className={'mt-3 text-xs ' + styles.risk}>{storageError}</p> : null}

            {loaded && marketRules.length > 0 ? (
                <ol className="divide-y">
                    {marketRules.map((rule) => {
                        const evaluation = evaluateMarketAlert(rule, signal);
                        return (
                            <li key={rule.id} className={'flex flex-wrap items-start justify-between gap-3 py-4 ' + styles.divider}>
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={'text-xs font-bold uppercase tracking-[0.08em] ' + (evaluation.triggered ? styles.risk : styles.positive)}>{evaluation.triggered ? 'Triggered now' : 'Monitoring'}</span>
                                        <span className={'text-xs ' + styles.textMuted}>{rule.market} · {formatMode(rule.mode)} · Social {rule.enableSocial ? 'on' : 'off'}</span>
                                    </div>
                                    <p className={'mt-1 text-sm font-semibold ' + styles.textPrimary}>{evaluation.label}</p>
                                    <p className={'mt-1 text-xs ' + styles.textMuted}>{evaluation.detail}</p>
                                </div>
                                <button type="button" onClick={() => removeRule(rule.id)} className={'min-h-10 px-2 text-xs font-semibold transition-colors hover:text-rose-500 ' + styles.textMuted}>Remove</button>
                            </li>
                        );
                    })}
                </ol>
            ) : null}
        </section>
    );
};

const formatMode = (mode: MarketSignal['mode']) => mode === 'contrarian' ? 'Contrarian' : 'Standard';
