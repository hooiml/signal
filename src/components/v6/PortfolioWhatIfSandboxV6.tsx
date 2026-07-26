'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    PORTFOLIO_HOLDINGS_CHANGE_EVENT,
    PORTFOLIO_HOLDINGS_STORAGE_KEY,
    loadPortfolioHoldingsSnapshot,
    type PortfolioHoldingsLoadResult,
} from '@/lib/portfolio/holdings-client';
import {
    buildPortfolioSimulationExport,
    portfolioSimulationLimits,
    simulatePortfolioScenario,
    type PortfolioSimulationLegInput,
    type PortfolioSimulationResult,
} from '@/lib/portfolio/simulation';
import {
    INVESTMENT_POLICY_CHANGE_EVENT,
    readInvestmentPolicy,
} from '@/lib/research/investment-policy-client';
import { defaultInvestmentPolicy, type InvestmentPolicy } from '@/lib/research/investment-policy';
import type { ResearchRecord } from '@/lib/types/research';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type RestoreState =
    | { readonly status: 'loading'; readonly snapshot: null }
    | PortfolioHoldingsLoadResult;

const blankLeg = (id: number): PortfolioSimulationLegInput => ({
    id: `leg-${id}`,
    accountLabel: '',
    symbol: '',
    market: '',
    currency: '',
    side: '',
    quantity: '',
    assumedPrice: '',
});

const formatMoney = (value: number, currency: string) =>
    new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);

const formatDelta = (value: number, currency: string) =>
    `${value > 0 ? '+' : ''}${formatMoney(value, currency)}`;

const downloadText = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
};

const bucketKey = (accountLabel: string, currency: string) => `${accountLabel}\u0000${currency}`;

export const PortfolioWhatIfSandboxV6 = ({ records, items, theme }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
}) => {
    const [restore, setRestore] = useState<RestoreState>({ status: 'loading', snapshot: null });
    const [policy, setPolicy] = useState<InvestmentPolicy>(defaultInvestmentPolicy);
    const [legs, setLegs] = useState<readonly PortfolioSimulationLegInput[]>([]);
    const [nextId, setNextId] = useState(1);
    const [scenarioName, setScenarioName] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const styles = getThemeV6(theme);

    useEffect(() => {
        const refresh = () => {
            setRestore(loadPortfolioHoldingsSnapshot());
            setPolicy(readInvestmentPolicy());
        };
        const refreshFromStorage = (event: StorageEvent) => {
            if (event.key === PORTFOLIO_HOLDINGS_STORAGE_KEY) refresh();
        };
        const timer = window.setTimeout(refresh, 0);
        window.addEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refresh);
        window.addEventListener(INVESTMENT_POLICY_CHANGE_EVENT, refresh);
        window.addEventListener('storage', refreshFromStorage);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener(PORTFOLIO_HOLDINGS_CHANGE_EVENT, refresh);
            window.removeEventListener(INVESTMENT_POLICY_CHANGE_EVENT, refresh);
            window.removeEventListener('storage', refreshFromStorage);
        };
    }, []);

    const snapshot = restore.status === 'ready' ? restore.snapshot : null;
    const accounts = useMemo(() => snapshot
        ? [...new Set([
            ...snapshot.holdings.map((holding) => holding.accountLabel),
            ...snapshot.cashBalances.map((cash) => cash.accountLabel),
        ])].sort()
        : [], [snapshot]);
    const researchInputs = useMemo(() => {
        const itemByIdentity = new Map(items.map((item) => [`${item.market}:${item.symbol}`, item]));
        return records.map((record) => {
            const item = itemByIdentity.get(`${record.market}:${record.symbol}`);
            return {
                record,
                sector: item?.sector ?? '',
                currentPrice: typeof item?.price === 'number' ? item.price : null,
            };
        });
    }, [items, records]);
    const result = useMemo(
        () => snapshot ? simulatePortfolioScenario(snapshot, legs, researchInputs, policy) : null,
        [legs, policy, researchInputs, snapshot],
    );
    const beforeByBucket = useMemo(() => new Map(
        (result?.before.buckets ?? []).map((bucket) => [bucketKey(bucket.accountLabel, bucket.currency), bucket]),
    ), [result]);

    const updateLeg = (id: string, patch: Partial<PortfolioSimulationLegInput>) => {
        setResetMessage('');
        setLegs((current) => current.map((leg) => leg.id === id ? { ...leg, ...patch } : leg));
    };

    const addLeg = () => {
        if (legs.length >= portfolioSimulationLimits.maxLegs) return;
        setLegs((current) => [...current, blankLeg(nextId)]);
        setNextId((current) => current + 1);
        setResetMessage('');
    };

    const reset = () => {
        setLegs([]);
        setScenarioName('');
        setResetMessage('Scenario reset. The accepted holdings snapshot and research records were not changed.');
    };

    const exportScenario = (format: 'csv' | 'markdown') => {
        if (!result || result.status !== 'ready') return;
        const extension = format === 'csv' ? 'csv' : 'md';
        downloadText(
            `signal-portfolio-what-if.${extension}`,
            buildPortfolioSimulationExport(result, format, scenarioName),
            format === 'csv' ? 'text/csv;charset=utf-8' : 'text/markdown;charset=utf-8',
        );
    };

    return (
        <section
            className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary}
            aria-labelledby="portfolio-what-if-title"
            data-testid="portfolio-what-if"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Pre-trade illustration · session only</p>
                    <h2 id="portfolio-what-if-title" className={'mt-1 text-base font-bold ' + styles.textPrimary}>What-if and rebalancing sandbox</h2>
                    <p className={'mt-1 max-w-3xl text-xs leading-5 ' + styles.textMuted}>
                        Enter a bounded basket of hypothetical buys or sells and compare the accepted snapshot with the simulated result. This is not a recommendation, optimizer, forecast, order ticket, or brokerage connection. No orders are sent.
                    </p>
                </div>
                <span className={'rounded-md border px-3 py-2 text-xs ' + styles.panelUtility}>{legs.length}/{portfolioSimulationLimits.maxLegs} legs · drafts never auto-resume</span>
            </div>

            {restore.status === 'loading' ? (
                <p className={'mt-4 text-sm ' + styles.textMuted} role="status">Loading the accepted local holdings snapshot…</p>
            ) : restore.status === 'unavailable' || restore.status === 'invalid' ? (
                <div className={'mt-4 rounded-md border p-3 text-sm ' + styles.risk} role="alert">
                    <p>{restore.message}</p>
                    <p className="mt-1 text-xs">The sandbox stays unavailable rather than guessing a portfolio.</p>
                </div>
            ) : snapshot === null ? (
                <div className={'mt-4 rounded-md border p-4 ' + styles.panelUtility}>
                    <p className={'text-sm font-semibold ' + styles.textPrimary}>Import holdings before simulating</p>
                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>The sandbox requires an accepted version-1 holdings snapshot so every account and sell quantity has an exact scope.</p>
                </div>
            ) : (
                <>
                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                        <label className={'w-full max-w-sm text-xs font-semibold ' + styles.textMuted}>Scenario label (optional, export only)
                            <input
                                value={scenarioName}
                                maxLength={80}
                                onChange={(event) => setScenarioName(event.target.value)}
                                className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}
                            />
                        </label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={addLeg}
                                disabled={legs.length >= portfolioSimulationLimits.maxLegs}
                                className={'min-h-10 rounded-md border px-3 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.panelAction}
                            >
                                Add leg
                            </button>
                            <button
                                type="button"
                                onClick={reset}
                                disabled={legs.length === 0 && !scenarioName}
                                className={'min-h-10 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.panelSolid}
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {legs.length === 0 ? (
                        <div className={'mt-4 rounded-md border p-5 text-center ' + styles.panelUtility} data-testid="portfolio-what-if-empty">
                            <p className={'text-sm font-semibold ' + styles.textPrimary}>No hypothetical legs</p>
                            <p className={'mt-1 text-xs ' + styles.textMuted}>Add a leg to begin. The imported snapshot remains read-only.</p>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3" aria-label="Hypothetical portfolio legs">
                            {legs.map((leg, index) => {
                                const effect = result?.legs.find((candidate) => candidate.id === leg.id);
                                return (
                                    <fieldset key={leg.id} className={'rounded-md border p-3 ' + styles.panelUtility}>
                                        <legend className={'px-1 text-xs font-bold ' + styles.textPrimary}>Leg {index + 1}</legend>
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_0.7fr_0.8fr_0.9fr_auto]">
                                            <label className={'text-[11px] font-semibold ' + styles.textMuted}>Account
                                                <select
                                                    aria-label={`Leg ${index + 1} account`}
                                                    value={leg.accountLabel}
                                                    onChange={(event) => updateLeg(leg.id, { accountLabel: event.target.value })}
                                                    className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}
                                                >
                                                    <option value="">Select account</option>
                                                    {accounts.map((account) => <option key={account} value={account}>{account}</option>)}
                                                </select>
                                            </label>
                                            <label className={'text-[11px] font-semibold ' + styles.textMuted}>Symbol
                                                <input
                                                    aria-label={`Leg ${index + 1} symbol`}
                                                    value={leg.symbol}
                                                    maxLength={20}
                                                    onChange={(event) => updateLeg(leg.id, { symbol: event.target.value })}
                                                    className={'mt-1 min-h-10 w-full rounded-md border px-2 font-mono uppercase ' + styles.panelSolid}
                                                />
                                            </label>
                                            <label className={'text-[11px] font-semibold ' + styles.textMuted}>Market
                                                <select
                                                    aria-label={`Leg ${index + 1} market`}
                                                    value={leg.market}
                                                    onChange={(event) => updateLeg(leg.id, { market: event.target.value })}
                                                    className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}
                                                >
                                                    <option value="">Select</option><option value="US">US</option><option value="MY">MY</option>
                                                </select>
                                            </label>
                                            <label className={'text-[11px] font-semibold ' + styles.textMuted}>Currency
                                                <select
                                                    aria-label={`Leg ${index + 1} currency`}
                                                    value={leg.currency}
                                                    onChange={(event) => updateLeg(leg.id, { currency: event.target.value })}
                                                    className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}
                                                >
                                                    <option value="">Select</option><option value="USD">USD</option><option value="MYR">MYR</option>
                                                </select>
                                            </label>
                                            <label className={'text-[11px] font-semibold ' + styles.textMuted}>Side
                                                <select
                                                    aria-label={`Leg ${index + 1} side`}
                                                    value={leg.side}
                                                    onChange={(event) => updateLeg(leg.id, { side: event.target.value })}
                                                    className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}
                                                >
                                                    <option value="">Select</option><option value="buy">Buy</option><option value="sell">Sell</option>
                                                </select>
                                            </label>
                                            <label className={'text-[11px] font-semibold ' + styles.textMuted}>Quantity
                                                <input
                                                    aria-label={`Leg ${index + 1} quantity`}
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={leg.quantity}
                                                    onChange={(event) => updateLeg(leg.id, { quantity: event.target.value })}
                                                    className={'mt-1 min-h-10 w-full rounded-md border px-2 font-mono ' + styles.panelSolid}
                                                />
                                            </label>
                                            <label className={'text-[11px] font-semibold ' + styles.textMuted}>Assumed price
                                                <input
                                                    aria-label={`Leg ${index + 1} assumed price`}
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    value={leg.assumedPrice}
                                                    onChange={(event) => updateLeg(leg.id, { assumedPrice: event.target.value })}
                                                    className={'mt-1 min-h-10 w-full rounded-md border px-2 font-mono ' + styles.panelSolid}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                aria-label={`Remove leg ${index + 1}`}
                                                onClick={() => setLegs((current) => current.filter((candidate) => candidate.id !== leg.id))}
                                                className={'min-h-10 self-end rounded-md border px-3 text-xs font-semibold ' + styles.panelSolid}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                        {effect && effect.errors.length > 0 ? (
                                            <ul className={'mt-2 list-disc space-y-1 pl-5 text-xs ' + styles.risk} role="alert">
                                                {effect.errors.map((error) => <li key={error}>{error}</li>)}
                                            </ul>
                                        ) : effect ? (
                                            <p className={'mt-2 text-xs ' + (effect.researchMatched ? styles.textSecondary : styles.risk)}>
                                                {effect.side === 'buy' ? 'Buy' : 'Sell'} effect: quantity {effect.quantityBefore ?? 0} → {effect.quantityAfter ?? 'unavailable'};
                                                {' '}cash {effect.cashEffect === null || !effect.currency ? 'unavailable' : formatDelta(effect.cashEffect, effect.currency)};
                                                {' '}research {effect.researchMatched ? 'exact match' : 'unmatched — sector, policy evidence, and downside excluded'}.
                                            </p>
                                        ) : null}
                                    </fieldset>
                                );
                            })}
                        </div>
                    )}

                    {result?.warnings.length ? (
                        <div className={'mt-4 rounded-md border p-3 text-xs ' + styles.risk} role="alert" data-testid="portfolio-what-if-warnings">
                            <p className="font-bold">Scenario warnings</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5">
                                {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                            </ul>
                        </div>
                    ) : null}

                    {result?.status === 'ready' ? (
                        <SimulationSummary result={result} beforeByBucket={beforeByBucket} theme={theme} />
                    ) : null}

                    <div className={'mt-4 rounded-md border p-3 ' + styles.panelUtility}>
                        <h3 className={'text-xs font-bold ' + styles.textPrimary}>Assumptions and coverage</h3>
                        <ul className={'mt-2 list-disc space-y-1 pl-5 text-xs leading-5 ' + styles.textMuted}>
                            {(result?.assumptions ?? [
                                'No hypothetical values are applied until every leg is valid.',
                                'No orders are sent and no scenario content leaves this browser session.',
                            ]).map((assumption) => <li key={assumption}>{assumption}</li>)}
                        </ul>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={result?.status !== 'ready'}
                                onClick={() => exportScenario('csv')}
                                className={'min-h-10 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.panelSolid}
                            >
                                Export CSV
                            </button>
                            <button
                                type="button"
                                disabled={result?.status !== 'ready'}
                                onClick={() => exportScenario('markdown')}
                                className={'min-h-10 rounded-md border px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ' + styles.panelSolid}
                            >
                                Export Markdown
                            </button>
                        </div>
                    </div>
                    {resetMessage ? <p className={'mt-3 text-sm ' + styles.positive} role="status">{resetMessage}</p> : null}
                </>
            )}
        </section>
    );
};

const SimulationSummary = ({ result, beforeByBucket, theme }: {
    readonly result: PortfolioSimulationResult;
    readonly beforeByBucket: ReadonlyMap<string, PortfolioSimulationResult['before']['buckets'][number]>;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    return (
        <section className="mt-4" aria-labelledby="portfolio-what-if-summary" data-testid="portfolio-what-if-summary">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h3 id="portfolio-what-if-summary" className={'text-sm font-bold ' + styles.textPrimary}>Before / simulated after</h3>
                    <p className={'mt-1 text-xs ' + styles.textMuted}>Values remain separated by exact account and currency. No FX conversion is performed.</p>
                </div>
                <span className={'text-xs font-semibold ' + styles.positive}>Valid illustration · no orders sent</span>
            </div>
            <div className="research-scrollbar mt-3 overflow-x-auto rounded-md border">
                <table className="w-full min-w-[1080px] text-left text-xs [&_td]:px-3 [&_th]:px-3">
                    <caption className="sr-only">Portfolio simulation before and after deltas</caption>
                    <thead className={styles.panelSolid}>
                        <tr className={styles.textMuted}>
                            <th className="py-2">Account / currency</th>
                            <th className="py-2 text-right">Cash</th>
                            <th className="py-2 text-right">Known invested</th>
                            <th className="py-2">Largest position</th>
                            <th className="py-2">Largest sector</th>
                            <th className="py-2">Coverage</th>
                            <th className="py-2 text-right">Defined downside</th>
                            <th className="py-2">Policy</th>
                        </tr>
                    </thead>
                    <tbody>
                        {result.after.buckets.map((after) => {
                            const before = beforeByBucket.get(bucketKey(after.accountLabel, after.currency));
                            return (
                                <tr key={bucketKey(after.accountLabel, after.currency)} className={'border-t align-top ' + styles.divider}>
                                    <th className="py-3"><span className="font-semibold">{after.accountLabel}</span><br /><span className={styles.textMuted}>{after.currency}</span></th>
                                    <td className={'py-3 text-right font-mono ' + (after.cashBalance < 0 ? styles.risk : '')}>
                                        {formatMoney(after.cashBalance, after.currency)}
                                        <br /><span className={styles.textMuted}>{formatDelta(after.cashBalance - (before?.cashBalance ?? 0), after.currency)}</span>
                                    </td>
                                    <td className="py-3 text-right font-mono">
                                        {formatMoney(after.knownInvestedValue, after.currency)}
                                        <br /><span className={styles.textMuted}>{formatDelta(after.knownInvestedValue - (before?.knownInvestedValue ?? 0), after.currency)}</span>
                                    </td>
                                    <td className="py-3">
                                        {after.largestPosition ? `${after.largestPosition.symbol} ${after.largestPosition.weightPercent.toFixed(2)}%` : 'Unavailable'}
                                        <br /><span className={styles.textMuted}>Before {before?.largestPosition ? `${before.largestPosition.symbol} ${before.largestPosition.weightPercent.toFixed(2)}%` : 'unavailable'}</span>
                                    </td>
                                    <td className="py-3">
                                        {after.sectors[0] ? `${after.sectors[0].label} ${after.sectors[0].weightPercent.toFixed(2)}%` : 'Unavailable'}
                                        <br /><span className={styles.textMuted}>Exact research sector only</span>
                                    </td>
                                    <td className="py-3">
                                        {after.matchedPositions}/{after.importedPositions} matched
                                        <br /><span className={styles.textMuted}>{after.unmatchedPositions} unmatched · {after.missingMarketValues} missing value</span>
                                    </td>
                                    <td className="py-3 text-right font-mono">
                                        {formatMoney(after.definedDownsideValue, after.currency)}
                                        <br /><span className={styles.textMuted}>{after.portfolioAtRiskPercent === null ? 'Portfolio-at-risk unavailable' : `${after.portfolioAtRiskPercent.toFixed(2)}% portfolio at risk`}</span>
                                        <br /><span className={styles.textMuted}>{after.riskCoveredPositions} covered · {after.riskExcludedPositions} excluded</span>
                                    </td>
                                    <td className="py-3">
                                        {after.policyBreaches.length === 0 ? 'No evaluated breaches' : `${after.policyBreaches.length} breach${after.policyBreaches.length === 1 ? '' : 'es'}`}
                                        {after.policyBreaches.length > 0 ? (
                                            <ul className={'mt-1 list-disc pl-4 ' + styles.risk}>
                                                {after.policyBreaches.slice(0, 3).map((breach) => <li key={`${breach.symbol}:${breach.kind}`}>{breach.symbol}: {breach.kind}</li>)}
                                            </ul>
                                        ) : null}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
};
