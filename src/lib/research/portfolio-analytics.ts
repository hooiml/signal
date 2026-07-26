import type { ResearchMarket, ResearchRecord } from '../types/research';
import type { ResearchChartPoint } from '../types/research-snapshot';
import { calculatePositionPlanRisk, type PositionPlanRisk } from './position-plan';

export type PortfolioHoldingInput = {
    readonly record: ResearchRecord;
    readonly sector: string;
    readonly currency: string;
    readonly currentPrice: number | null;
};

export type PortfolioHolding = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly sector: string;
    readonly currency: string;
    readonly allocationPercent: number;
    readonly risk: PositionPlanRisk | null;
};

export type PortfolioExposure = {
    readonly label: string;
    readonly allocationPercent: number;
};

export type PortfolioSummary = {
    readonly holdings: readonly PortfolioHolding[];
    readonly totalAllocationPercent: number;
    readonly unallocatedPercent: number;
    readonly overallocatedPercent: number;
    readonly definedRiskPercent: number;
    readonly riskCoveredAllocationPercent: number;
    readonly largestHolding: PortfolioHolding | null;
    readonly bySector: readonly PortfolioExposure[];
    readonly byMarket: readonly PortfolioExposure[];
    readonly byCurrency: readonly PortfolioExposure[];
};

export type PortfolioMarketMetric = {
    readonly symbol: string;
    readonly beta: number | null;
    readonly annualizedVolatilityPercent: number | null;
    readonly observations: number;
};

export type PortfolioCorrelationRow = {
    readonly symbol: string;
    readonly correlations: Readonly<Record<string, number | null>>;
};

export type PortfolioMarketAnalytics = {
    readonly metrics: readonly PortfolioMarketMetric[];
    readonly correlations: readonly PortfolioCorrelationRow[];
};

export type PortfolioScenario = {
    readonly label: string;
    readonly portfolioImpactPercent: number | null;
    readonly coveredAllocationPercent: number;
    readonly detail: string;
};

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

const groupExposure = (
    holdings: readonly PortfolioHolding[],
    select: (holding: PortfolioHolding) => string,
): readonly PortfolioExposure[] => {
    const totals = new Map<string, number>();
    for (const holding of holdings) {
        const label = select(holding).trim() || 'Unknown';
        totals.set(label, (totals.get(label) ?? 0) + holding.allocationPercent);
    }
    return [...totals.entries()]
        .map(([label, allocationPercent]) => ({ label, allocationPercent: round(allocationPercent) }))
        .sort((left, right) => right.allocationPercent - left.allocationPercent || left.label.localeCompare(right.label));
};

export const buildPortfolioSummary = (
    inputs: readonly PortfolioHoldingInput[],
): PortfolioSummary => {
    const holdings = inputs.flatMap(({ record, sector, currency, currentPrice }) => {
        const allocationPercent = record.positionPlan.plannedAllocationPercent;
        if (allocationPercent === null || allocationPercent <= 0) return [];
        return [{
            symbol: record.symbol,
            market: record.market,
            sector: sector || 'Unknown',
            currency: currency || (record.market === 'MY' ? 'MYR' : 'USD'),
            allocationPercent,
            risk: calculatePositionPlanRisk(record.positionPlan, currentPrice),
        }];
    }).sort((left, right) => right.allocationPercent - left.allocationPercent || left.symbol.localeCompare(right.symbol));
    const totalAllocationPercent = round(holdings.reduce((sum, holding) => sum + holding.allocationPercent, 0));
    const definedRiskPercent = round(holdings.reduce((sum, holding) => sum + (holding.risk?.portfolioRiskPercent ?? 0), 0));
    const riskCoveredAllocationPercent = round(holdings.reduce(
        (sum, holding) => sum + (holding.risk ? holding.allocationPercent : 0),
        0,
    ));

    return {
        holdings,
        totalAllocationPercent,
        unallocatedPercent: round(Math.max(0, 100 - totalAllocationPercent)),
        overallocatedPercent: round(Math.max(0, totalAllocationPercent - 100)),
        definedRiskPercent,
        riskCoveredAllocationPercent,
        largestHolding: holdings[0] ?? null,
        bySector: groupExposure(holdings, (holding) => holding.sector),
        byMarket: groupExposure(holdings, (holding) => holding.market),
        byCurrency: groupExposure(holdings, (holding) => holding.currency),
    };
};

const returnSeries = (points: readonly ResearchChartPoint[]): ReadonlyMap<string, number> => {
    const returns = new Map<string, number>();
    const sorted = [...points].sort((left, right) => left.time.localeCompare(right.time));
    for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        if (!previous || !current || previous.close <= 0 || current.close < 0) continue;
        returns.set(current.time, (current.close - previous.close) / previous.close);
    }
    return returns;
};

const pairedValues = (
    left: ReadonlyMap<string, number>,
    right: ReadonlyMap<string, number>,
): readonly [number, number][] => [...left.entries()].flatMap(([date, value]) => {
    const other = right.get(date);
    return other === undefined ? [] : [[value, other] as [number, number]];
});

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

const correlationFromPairs = (pairs: readonly [number, number][]): number | null => {
    if (pairs.length < 20) return null;
    const leftMean = mean(pairs.map(([left]) => left));
    const rightMean = mean(pairs.map(([, right]) => right));
    let covariance = 0;
    let leftVariance = 0;
    let rightVariance = 0;
    for (const [left, right] of pairs) {
        const leftDelta = left - leftMean;
        const rightDelta = right - rightMean;
        covariance += leftDelta * rightDelta;
        leftVariance += leftDelta ** 2;
        rightVariance += rightDelta ** 2;
    }
    if (leftVariance === 0 || rightVariance === 0) return null;
    return round(covariance / Math.sqrt(leftVariance * rightVariance), 3);
};

const betaFromPairs = (pairs: readonly [number, number][]): number | null => {
    if (pairs.length < 20) return null;
    const assetMean = mean(pairs.map(([asset]) => asset));
    const benchmarkMean = mean(pairs.map(([, benchmark]) => benchmark));
    let covariance = 0;
    let benchmarkVariance = 0;
    for (const [asset, benchmark] of pairs) {
        covariance += (asset - assetMean) * (benchmark - benchmarkMean);
        benchmarkVariance += (benchmark - benchmarkMean) ** 2;
    }
    if (benchmarkVariance === 0) return null;
    return round(covariance / benchmarkVariance, 3);
};

const annualizedVolatility = (returns: readonly number[]): number | null => {
    if (returns.length < 20) return null;
    const average = mean(returns);
    const variance = returns.reduce((sum, value) => sum + (value - average) ** 2, 0) / (returns.length - 1);
    return round(Math.sqrt(variance) * Math.sqrt(252) * 100);
};

export const buildPortfolioMarketAnalytics = (
    holdings: readonly PortfolioHolding[],
    charts: ReadonlyMap<string, readonly ResearchChartPoint[]>,
    benchmarks: ReadonlyMap<ResearchMarket, readonly ResearchChartPoint[]>,
): PortfolioMarketAnalytics => {
    const returns = new Map(holdings.flatMap((holding) => {
        const chart = charts.get(holding.symbol);
        return chart ? [[holding.symbol, returnSeries(chart)] as const] : [];
    }));
    const metrics = holdings.map((holding) => {
        const series = returns.get(holding.symbol);
        const benchmark = benchmarks.get(holding.market);
        const benchmarkReturns = benchmark ? returnSeries(benchmark) : null;
        const pairs = series && benchmarkReturns ? pairedValues(series, benchmarkReturns) : [];
        return {
            symbol: holding.symbol,
            beta: betaFromPairs(pairs),
            annualizedVolatilityPercent: series ? annualizedVolatility([...series.values()].slice(-60)) : null,
            observations: pairs.length,
        };
    });
    const correlations = holdings.map((holding) => ({
        symbol: holding.symbol,
        correlations: Object.fromEntries(holdings.map((candidate) => {
            if (candidate.symbol === holding.symbol) return [candidate.symbol, 1];
            const left = returns.get(holding.symbol);
            const right = returns.get(candidate.symbol);
            return [candidate.symbol, left && right ? correlationFromPairs(pairedValues(left, right)) : null];
        })),
    }));
    return { metrics, correlations };
};

const weightedScenario = (
    summary: PortfolioSummary,
    shockFor: (holding: PortfolioHolding) => number | null,
): { readonly impact: number | null; readonly coverage: number } => {
    let impact = 0;
    let coverage = 0;
    for (const holding of summary.holdings) {
        const shock = shockFor(holding);
        if (shock === null) continue;
        impact += (holding.allocationPercent * shock) / 100;
        coverage += holding.allocationPercent;
    }
    return {
        impact: coverage === 0 ? null : round(impact),
        coverage: round(coverage),
    };
};

export const buildPortfolioScenarios = (
    summary: PortfolioSummary,
    analytics: PortfolioMarketAnalytics,
    customShockPercent: number,
): readonly PortfolioScenario[] => {
    const metricBySymbol = new Map(analytics.metrics.map((metric) => [metric.symbol, metric]));
    const broad = weightedScenario(summary, (holding) => -20 * (metricBySymbol.get(holding.symbol)?.beta ?? 1));
    const volatility = weightedScenario(summary, (holding) => {
        const annualized = metricBySymbol.get(holding.symbol)?.annualizedVolatilityPercent;
        return annualized === null || annualized === undefined ? null : -(annualized / Math.sqrt(12));
    });
    const custom = weightedScenario(summary, () => customShockPercent);
    const invalidation = weightedScenario(summary, (holding) => holding.risk ? -holding.risk.downsidePercent : null);
    return [
        {
            label: 'Broad market decline',
            portfolioImpactPercent: broad.impact,
            coveredAllocationPercent: broad.coverage,
            detail: 'Applies a -20% benchmark shock, adjusted by calculated beta where available and beta 1 otherwise.',
        },
        {
            label: 'Volatility stress',
            portfolioImpactPercent: volatility.impact,
            coveredAllocationPercent: volatility.coverage,
            detail: 'Applies one month of recent annualized volatility as a downside stress. Requires at least 20 daily returns.',
        },
        {
            label: 'User-defined shock',
            portfolioImpactPercent: custom.impact,
            coveredAllocationPercent: custom.coverage,
            detail: `Applies the same ${customShockPercent.toFixed(1)}% price shock to every planned allocation.`,
        },
        {
            label: 'Saved invalidation levels',
            portfolioImpactPercent: invalidation.impact,
            coveredAllocationPercent: invalidation.coverage,
            detail: 'Uses each valid lower invalidation level and excludes positions without a complete risk plan.',
        },
    ];
};
