'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import {
    buildPortfolioMarketAnalytics,
    buildPortfolioScenarios,
    buildPortfolioSummary,
    type PortfolioMarketAnalytics,
    type PortfolioSummary,
} from '@/lib/research/portfolio-analytics';
import { parseResearchChartResponse } from '@/lib/research/snapshot-input';
import {
    applySavedPortfolioScenario,
    removeSavedPortfolioScenario,
    upsertSavedPortfolioScenario,
    type SavedPortfolioScenario,
    type SavedPortfolioScenarioKind,
} from '@/lib/research/scenario-library';
import {
    loadSavedPortfolioScenarios,
    saveSavedPortfolioScenarios,
} from '@/lib/research/scenario-library-client';
import type { ResearchMarket, ResearchRecord } from '@/lib/types/research';
import type { ResearchChartPoint } from '@/lib/types/research-snapshot';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';
import { trackProductAnalyticsEvent } from '@/lib/product-analytics-client';
import { PortfolioHoldingsImportV6 } from './PortfolioHoldingsImportV6';
import { PortfolioTransactionImportV6 } from './PortfolioTransactionImportV6';
import { PortfolioTransactionReconciliationV6 } from './PortfolioTransactionReconciliationV6';
import { PortfolioCoveredAttributionV6 } from './PortfolioCoveredAttributionV6';
import { PortfolioWhatIfSandboxV6 } from './PortfolioWhatIfSandboxV6';
import { PortfolioFactorExposureV6 } from './PortfolioFactorExposureV6';
import type { ResearchUpdateMode } from '@/lib/types/research';

type HistoryState =
    | { readonly status: 'idle'; readonly key: ''; readonly analytics: PortfolioMarketAnalytics }
    | { readonly status: 'ready' | 'partial'; readonly key: string; readonly analytics: PortfolioMarketAnalytics; readonly warnings: readonly string[] };

const emptyAnalytics: PortfolioMarketAnalytics = { metrics: [], correlations: [] };
const historyLimit = 12;

const ExposureList = ({ title, rows, theme }: {
    readonly title: string;
    readonly rows: PortfolioSummary['bySector'];
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    return (
        <section className={'rounded-lg border p-4 ' + styles.panelSecondary}>
            <h2 className={'text-sm font-bold ' + styles.textPrimary}>{title}</h2>
            {rows.length === 0 ? <p className={'mt-3 text-xs ' + styles.textMuted}>No planned allocation data.</p> : (
                <ul className="mt-3 space-y-3">
                    {rows.map((row) => (
                        <li key={row.label}>
                            <div className="flex items-center justify-between gap-3 text-xs">
                                <span className={'font-semibold ' + styles.textSecondary}>{row.label}</span>
                                <span className={'font-mono font-bold tabular-nums ' + styles.textPrimary}>{row.allocationPercent.toFixed(1)}%</span>
                            </div>
                            <div className={'mt-1 h-1.5 overflow-hidden rounded-full ' + styles.statusSurface}>
                                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, row.allocationPercent)}%` }} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

const loadChart = async (symbol: string, market: ResearchMarket, signal: AbortSignal): Promise<readonly ResearchChartPoint[]> => {
    const response = await fetch(`/api/research/chart/${encodeURIComponent(symbol)}?market=${market}`, { signal });
    const payload: unknown = await response.json();
    if (!response.ok) throw new Error(`${symbol} history unavailable`);
    try {
        return parseResearchChartResponse(payload).points;
    } catch {
        throw new Error(`${symbol} history unavailable`);
    }
};

export const PortfolioRiskCockpitV6 = ({ records, items, theme, saving, saveError, onSave, onOpen }: {
    readonly records: readonly ResearchRecord[];
    readonly items: readonly ResearchWatchlistItem[];
    readonly theme: ResearchThemeV6;
    readonly saving: boolean;
    readonly saveError: string | null;
    readonly onSave: (record: ResearchRecord, mode?: ResearchUpdateMode) => Promise<boolean>;
    readonly onOpen: (symbol: string) => void;
}) => {
    const [customShock, setCustomShock] = useState(-10);
    const [savedScenarios, setSavedScenarios] = useState<readonly SavedPortfolioScenario[]>([]);
    const [scenarioName, setScenarioName] = useState('');
    const [scenarioKind, setScenarioKind] = useState<SavedPortfolioScenarioKind>('market');
    const [scenarioTarget, setScenarioTarget] = useState('');
    const [scenarioShock, setScenarioShock] = useState(-10);
    const [history, setHistory] = useState<HistoryState>({ status: 'idle', key: '', analytics: emptyAnalytics });
    const styles = getThemeV6(theme);
    const itemBySymbol = useMemo(() => new Map(items.map((item) => [item.symbol, item])), [items]);
    const summary = useMemo(() => buildPortfolioSummary(records.map((record) => {
        const item = itemBySymbol.get(record.symbol);
        return {
            record,
            sector: item?.sector ?? 'Unknown',
            currency: record.market === 'MY' ? 'MYR' : 'USD',
            currentPrice: item?.price ?? null,
        };
    })), [itemBySymbol, records]);
    const historyTargets = useMemo(() => summary.holdings.slice(0, historyLimit), [summary.holdings]);
    const historyKey = historyTargets.map((holding) => `${holding.symbol}:${holding.market}`).join('|');
    const historyLoading = historyTargets.length > 0 && history.key !== historyKey;
    const currentAnalytics = history.key === historyKey ? history.analytics : emptyAnalytics;

    useEffect(() => {
        const timer = window.setTimeout(() => setSavedScenarios(loadSavedPortfolioScenarios()), 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (historyTargets.length === 0) return;
        const controller = new AbortController();
        let active = true;
        const load = async () => {
            const markets = [...new Set(historyTargets.map((holding) => holding.market))];
            const assetResults = await Promise.allSettled(historyTargets.map(async (holding) => ({
                symbol: holding.symbol,
                points: await loadChart(holding.symbol, holding.market, controller.signal),
            })));
            const benchmarkResults = await Promise.allSettled(markets.map(async (market) => ({
                market,
                points: await loadChart(market === 'US' ? 'VOO' : 'KLCI', market, controller.signal),
            })));
            if (!active || controller.signal.aborted) return;
            const charts = new Map<string, readonly ResearchChartPoint[]>();
            const benchmarks = new Map<ResearchMarket, readonly ResearchChartPoint[]>();
            const warnings: string[] = [];
            for (const result of assetResults) {
                if (result.status === 'fulfilled') charts.set(result.value.symbol, result.value.points);
                else if (!(result.reason instanceof DOMException && result.reason.name === 'AbortError')) warnings.push(result.reason instanceof Error ? result.reason.message : 'Position history unavailable');
            }
            for (const result of benchmarkResults) {
                if (result.status === 'fulfilled') benchmarks.set(result.value.market, result.value.points);
                else if (!(result.reason instanceof DOMException && result.reason.name === 'AbortError')) warnings.push('A market benchmark history is unavailable');
            }
            if (summary.holdings.length > historyLimit) warnings.push(`History analytics are limited to the ${historyLimit} largest planned allocations.`);
            const analytics = buildPortfolioMarketAnalytics(historyTargets, charts, benchmarks);
            setHistory({ status: warnings.length > 0 ? 'partial' : 'ready', key: historyKey, analytics, warnings: [...new Set(warnings)] });
        };
        void load();
        return () => { active = false; controller.abort(); };
    }, [historyKey, historyTargets, summary.holdings.length]);

    const scenarios = useMemo(
        () => buildPortfolioScenarios(summary, currentAnalytics, customShock),
        [customShock, currentAnalytics, summary],
    );
    const scenarioTargets = useMemo(() => scenarioKind === 'sector'
        ? summary.bySector.map((row) => row.label)
        : scenarioKind === 'currency'
            ? summary.byCurrency.map((row) => row.label)
            : [], [scenarioKind, summary.byCurrency, summary.bySector]);
    const selectedScenarioTarget = scenarioKind === 'market'
        ? ''
        : scenarioTargets.includes(scenarioTarget)
            ? scenarioTarget
            : scenarioTargets[0] ?? '';

    const persistScenarios = (next: readonly SavedPortfolioScenario[]) => {
        setSavedScenarios(next);
        saveSavedPortfolioScenarios(next);
    };

    const saveScenario = () => {
        const name = scenarioName.trim();
        if (!name || (scenarioKind !== 'market' && !selectedScenarioTarget)) return;
        const now = new Date().toISOString();
        const id = `${scenarioKind}:${name.toLowerCase()}`;
        persistScenarios(upsertSavedPortfolioScenario(savedScenarios, {
            id,
            name,
            kind: scenarioKind,
            shockPercent: scenarioShock,
            target: scenarioKind === 'market' ? null : selectedScenarioTarget,
            savedAt: now,
        }));
        setScenarioName('');
        trackProductAnalyticsEvent({ name: 'portfolio_scenario_changed', surface: 'research', workspace: 'portfolio' });
    };

    return (
        <section className="min-w-0 flex-1" aria-labelledby="portfolio-cockpit-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Portfolio guardrails</p>
                    <h1 id="portfolio-cockpit-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Portfolio exposure and risk cockpit</h1>
                    <p className={'mt-1 max-w-3xl text-sm leading-6 ' + styles.textMuted}>Compare a local read-only holdings snapshot with saved position plans before acting on another ticker. Actual holdings and planned allocations remain separate, and this workspace never places orders.</p>
                </div>
                <span className={'text-xs ' + styles.textMuted}>{summary.holdings.length} planned position{summary.holdings.length === 1 ? '' : 's'}</span>
            </div>

            <PortfolioHoldingsImportV6 records={records} items={items} theme={theme} onOpen={onOpen} />
            <PortfolioTransactionImportV6 theme={theme} />
            <PortfolioTransactionReconciliationV6 items={items} theme={theme} />
            <PortfolioCoveredAttributionV6 items={items} theme={theme} />
            <PortfolioFactorExposureV6 records={records} items={items} theme={theme} saving={saving} saveError={saveError} onSave={onSave} />
            <PortfolioWhatIfSandboxV6 records={records} items={items} theme={theme} />

            {summary.holdings.length === 0 ? (
                <div className={'mt-5 rounded-lg border p-8 text-center ' + styles.panel}>
                    <h2 className={'text-base font-bold ' + styles.textPrimary}>No planned allocation yet</h2>
                    <p className={'mx-auto mt-2 max-w-xl text-sm leading-6 ' + styles.textMuted}>Open a ticker, start a review, and save a planned allocation. Add an entry or average cost plus a lower invalidation price to include that position in portfolio-at-risk.</p>
                </div>
            ) : (
                <>
                    <div className="mt-5">
                        <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + styles.textMuted}>Planned allocation · research records</p>
                    </div>
                    <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {[
                            ['Planned allocation', `${summary.totalAllocationPercent.toFixed(1)}%`, summary.overallocatedPercent > 0 ? `${summary.overallocatedPercent.toFixed(1)}% above the portfolio limit` : `${summary.unallocatedPercent.toFixed(1)}% unallocated`],
                            ['Defined portfolio risk', `${summary.definedRiskPercent.toFixed(2)}%`, `${summary.riskCoveredAllocationPercent.toFixed(1)}% allocation has valid invalidation inputs`],
                            ['Largest position', summary.largestHolding ? `${summary.largestHolding.symbol} ${summary.largestHolding.allocationPercent.toFixed(1)}%` : 'Not available', 'Single-name concentration'],
                            ['Largest sector', summary.bySector[0] ? `${summary.bySector[0].label} ${summary.bySector[0].allocationPercent.toFixed(1)}%` : 'Not available', 'Based on current watchlist classification'],
                            ['History analytics', historyLoading ? 'Loading' : `${currentAnalytics.metrics.filter((metric) => metric.beta !== null).length}/${historyTargets.length}`, 'Positions with calculated beta'],
                        ].map(([label, value, note]) => (
                            <div key={label} className={'rounded-lg border p-4 ' + styles.panelUtility}>
                                <dt className={'text-xs font-semibold ' + styles.textMuted}>{label}</dt>
                                <dd className={'mt-2 font-mono text-lg font-bold tabular-nums ' + (label === 'Planned allocation' && summary.overallocatedPercent > 0 ? styles.risk : styles.textPrimary)}>{value}</dd>
                                <p className={'mt-1 text-[11px] leading-4 ' + styles.textMuted}>{note}</p>
                            </div>
                        ))}
                    </dl>
                    {summary.overallocatedPercent > 0 ? <p role="alert" className={'mt-3 rounded-lg border p-3 text-xs ' + styles.risk}>Planned allocations exceed 100%. Reduce one or more plans before relying on the aggregate scenarios.</p> : null}

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <ExposureList title="Sector exposure" rows={summary.bySector} theme={theme} />
                        <ExposureList title="Market exposure" rows={summary.byMarket} theme={theme} />
                        <ExposureList title="Currency exposure" rows={summary.byCurrency} theme={theme} />
                    </div>

                    <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="portfolio-scenarios-title">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 id="portfolio-scenarios-title" className={'text-sm font-bold ' + styles.textPrimary}>Scenario exposure</h2>
                                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Mechanical stresses over planned allocation. They are not forecasts or probability estimates.</p>
                            </div>
                            <label className={'text-xs font-semibold ' + styles.textMuted}>User-defined price shock
                                <span className="mt-1 flex items-center gap-2">
                                    <input
                                        type="range"
                                        min="-50"
                                        max="20"
                                        step="1"
                                        value={customShock}
                                        onChange={(event) => setCustomShock(Number(event.target.value))}
                                        onPointerUp={() => trackProductAnalyticsEvent({ name: 'portfolio_scenario_changed', surface: 'research', workspace: 'portfolio' })}
                                        onBlur={() => trackProductAnalyticsEvent({ name: 'portfolio_scenario_changed', surface: 'research', workspace: 'portfolio' })}
                                        className="w-36"
                                    />
                                    <output className={'w-14 font-mono tabular-nums ' + styles.textPrimary}>{customShock.toFixed(0)}%</output>
                                </span>
                            </label>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {scenarios.map((scenario) => (
                                <article key={scenario.label} className={'rounded-lg border p-4 ' + styles.panelUtility}>
                                    <h3 className={'text-xs font-semibold ' + styles.textSecondary}>{scenario.label}</h3>
                                    <p className={'mt-2 font-mono text-lg font-bold tabular-nums ' + (scenario.portfolioImpactPercent !== null && scenario.portfolioImpactPercent < 0 ? styles.risk : styles.textPrimary)}>{scenario.portfolioImpactPercent === null ? 'Unavailable' : `${scenario.portfolioImpactPercent.toFixed(2)}%`}</p>
                                    <p className={'mt-1 text-[11px] ' + styles.textMuted}>{scenario.coveredAllocationPercent.toFixed(1)}% allocation covered</p>
                                    <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>{scenario.detail}</p>
                                </article>
                            ))}
                        </div>
                        <div className={'mt-4 rounded-lg border p-4 ' + styles.panelUtility}>
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <h3 className={'text-sm font-bold ' + styles.textPrimary}>Saved scenario library</h3>
                                    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Save up to 8 reusable browser-local stresses. Results are allocation-weighted illustrations, not forecasts.</p>
                                </div>
                                <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(10rem,1fr)_8rem_9rem_7rem_auto]">
                                    <label className={'text-xs font-semibold ' + styles.textMuted}>Scenario name
                                        <input
                                            aria-label="Scenario name"
                                            value={scenarioName}
                                            maxLength={60}
                                            onChange={(event) => setScenarioName(event.target.value)}
                                            className={'mt-1 min-h-10 w-full rounded-md border px-3 ' + styles.panelSolid}
                                        />
                                    </label>
                                    <label className={'text-xs font-semibold ' + styles.textMuted}>Scope
                                        <select
                                            aria-label="Scenario scope"
                                            value={scenarioKind}
                                            onChange={(event) => {
                                                setScenarioKind(event.target.value as SavedPortfolioScenarioKind);
                                                setScenarioTarget('');
                                            }}
                                            className={'mt-1 min-h-10 w-full rounded-md border px-2 ' + styles.panelSolid}
                                        >
                                            <option value="market">All positions</option>
                                            <option value="sector">Sector</option>
                                            <option value="currency">Currency</option>
                                        </select>
                                    </label>
                                    <label className={'text-xs font-semibold ' + styles.textMuted}>Target
                                        <select
                                            aria-label="Scenario target"
                                            value={selectedScenarioTarget}
                                            disabled={scenarioKind === 'market'}
                                            onChange={(event) => setScenarioTarget(event.target.value)}
                                            className={'mt-1 min-h-10 w-full rounded-md border px-2 disabled:opacity-50 ' + styles.panelSolid}
                                        >
                                            {scenarioKind === 'market' ? <option value="">All</option> : scenarioTargets.map((target) => <option key={target} value={target}>{target}</option>)}
                                        </select>
                                    </label>
                                    <label className={'text-xs font-semibold ' + styles.textMuted}>Shock %
                                        <input
                                            aria-label="Scenario shock percent"
                                            type="number"
                                            min="-100"
                                            max="100"
                                            value={scenarioShock}
                                            onChange={(event) => setScenarioShock(Math.max(-100, Math.min(100, Number(event.target.value))))}
                                            className={'mt-1 min-h-10 w-full rounded-md border px-3 font-mono ' + styles.panelSolid}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        disabled={!scenarioName.trim() || (scenarioKind !== 'market' && !selectedScenarioTarget)}
                                        onClick={saveScenario}
                                        className={'min-h-10 rounded-md border px-4 text-xs font-bold disabled:opacity-50 ' + styles.panelAction}
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                            {savedScenarios.length === 0 ? <p className={'mt-4 text-xs ' + styles.textMuted}>No saved scenarios yet.</p> : (
                                <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    {savedScenarios.map((scenario) => {
                                        const result = applySavedPortfolioScenario(summary, scenario);
                                        return (
                                            <li key={scenario.id} className={'rounded-lg border p-3 ' + styles.panelSolid}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className={'text-xs font-bold ' + styles.textPrimary}>{scenario.name}</p>
                                                        <p className={'mt-1 text-[11px] ' + styles.textMuted}>{scenario.kind === 'market' ? 'All positions' : `${scenario.kind}: ${scenario.target}`} · {scenario.shockPercent.toFixed(1)}%</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        aria-label={`Remove ${scenario.name}`}
                                                        onClick={() => persistScenarios(removeSavedPortfolioScenario(savedScenarios, scenario.id))}
                                                        className={'min-h-10 px-2 text-xs font-semibold ' + styles.risk}
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                                <p className={'mt-2 font-mono text-lg font-bold ' + (result.portfolioImpactPercent !== null && result.portfolioImpactPercent < 0 ? styles.risk : styles.textPrimary)}>
                                                    {result.portfolioImpactPercent === null ? 'Unavailable' : `${result.portfolioImpactPercent.toFixed(2)}%`}
                                                </p>
                                                <p className={'mt-1 text-[11px] ' + styles.textMuted}>{result.coveredAllocationPercent.toFixed(1)}% allocation covered</p>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </section>

                    <section className={'mt-5 rounded-lg border p-4 ' + styles.panelSecondary} aria-labelledby="portfolio-history-title">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 id="portfolio-history-title" className={'text-sm font-bold ' + styles.textPrimary}>Beta, volatility, and correlation</h2>
                                <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Calculated from overlapping daily closes; at least 20 observations are required.</p>
                            </div>
                            <span className={'text-xs ' + styles.textMuted}>{historyLoading ? 'Loading history…' : history.status === 'partial' ? 'Partial coverage' : history.status === 'ready' ? 'History loaded' : 'Waiting for plans'}</span>
                        </div>
                        {!historyLoading && currentAnalytics.metrics.length > 0 ? (
                            <>
                                <div className="research-scrollbar mt-3 overflow-x-auto">
                                    <table className="w-full min-w-[560px] text-left text-xs">
                                        <thead><tr className={styles.textMuted}><th className="pb-2">Position</th><th className="pb-2 text-right">Allocation</th><th className="pb-2 text-right">Beta</th><th className="pb-2 text-right">Annualized volatility</th><th className="pb-2 text-right">Overlapping days</th></tr></thead>
                                        <tbody>
                                            {currentAnalytics.metrics.map((metric) => {
                                                const holding = summary.holdings.find((candidate) => candidate.symbol === metric.symbol);
                                                return (
                                                    <tr key={metric.symbol} className={'border-t ' + styles.divider}>
                                                        <th className="py-2"><button type="button" onClick={() => onOpen(metric.symbol)} className={'min-h-10 font-mono font-bold ' + styles.textPrimary}>{metric.symbol}</button></th>
                                                        <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{holding?.allocationPercent.toFixed(1)}%</td>
                                                        <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{metric.beta?.toFixed(2) ?? 'Unavailable'}</td>
                                                        <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{metric.annualizedVolatilityPercent === null ? 'Unavailable' : `${metric.annualizedVolatilityPercent.toFixed(1)}%`}</td>
                                                        <td className={'py-2 text-right font-mono ' + styles.textSecondary}>{metric.observations}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {currentAnalytics.correlations.length > 1 ? (
                                    <div className="research-scrollbar mt-4 overflow-x-auto">
                                        <table className="min-w-[520px] text-center text-xs">
                                            <caption className={'mb-2 text-left font-semibold ' + styles.textSecondary}>Return correlation matrix</caption>
                                            <thead><tr><th className="p-2" />{currentAnalytics.correlations.map((row) => <th key={row.symbol} className={'p-2 font-mono ' + styles.textMuted}>{row.symbol}</th>)}</tr></thead>
                                            <tbody>{currentAnalytics.correlations.map((row) => <tr key={row.symbol} className={'border-t ' + styles.divider}><th className={'p-2 text-left font-mono ' + styles.textMuted}>{row.symbol}</th>{currentAnalytics.correlations.map((column) => <td key={column.symbol} className={'p-2 font-mono tabular-nums ' + styles.textSecondary}>{row.correlations[column.symbol]?.toFixed(2) ?? '—'}</td>)}</tr>)}</tbody>
                                        </table>
                                    </div>
                                ) : null}
                            </>
                        ) : historyLoading ? <p className={'mt-4 text-sm ' + styles.textMuted}>Loading position and benchmark histories…</p>
                            : <p className={'mt-4 text-sm ' + styles.textMuted}>Add planned allocations to calculate history-based risk context.</p>}
                        {history.status === 'partial' ? history.warnings.map((warning) => <p key={warning} role="status" className={'mt-2 text-xs ' + styles.risk}>{warning}</p>) : null}
                    </section>
                </>
            )}
        </section>
    );
};
