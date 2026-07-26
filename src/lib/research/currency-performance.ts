import type { ResearchRecord } from '../types/research';

export const performanceBaseCurrencies = ['MYR', 'USD'] as const;
export type PerformanceBaseCurrency = typeof performanceBaseCurrencies[number];

export type CurrencyPerformanceAdjustment = {
    readonly symbol: string;
    readonly dividendsPercent: number;
    readonly feesPercent: number;
};

export type CurrencyPerformanceSettings = {
    readonly version: 1;
    readonly baseCurrency: PerformanceBaseCurrency;
    readonly entryUsdMyr: number;
    readonly currentUsdMyr: number;
    readonly adjustments: readonly CurrencyPerformanceAdjustment[];
};

export const defaultCurrencyPerformanceSettings: CurrencyPerformanceSettings = {
    version: 1,
    baseCurrency: 'MYR',
    entryUsdMyr: 4.4,
    currentUsdMyr: 4.25,
    adjustments: [],
};

export type CurrencyPerformanceResult = {
    readonly symbol: string;
    readonly quoteCurrency: PerformanceBaseCurrency;
    readonly baseCurrency: PerformanceBaseCurrency;
    readonly costBasis: number | null;
    readonly currentPrice: number | null;
    readonly priceReturnPercent: number | null;
    readonly fxReturnPercent: number | null;
    readonly totalReturnPercent: number | null;
    readonly relativeToSavedBenchmarkPercent: number | null;
    readonly benchmarkLabel: string | null;
    readonly dividendsPercent: number;
    readonly feesPercent: number;
    readonly available: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const finiteRange = (value: unknown, minimum: number, maximum: number): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
const round = (value: number): number => Math.round(value * 100) / 100;

export const parseCurrencyPerformanceSettings = (value: unknown): CurrencyPerformanceSettings => {
    if (!isRecord(value) || value.version !== 1
        || (value.baseCurrency !== 'MYR' && value.baseCurrency !== 'USD')
        || !finiteRange(value.entryUsdMyr, 0.1, 20)
        || !finiteRange(value.currentUsdMyr, 0.1, 20)
        || !Array.isArray(value.adjustments)) return defaultCurrencyPerformanceSettings;
    const adjustments: CurrencyPerformanceAdjustment[] = [];
    for (const item of value.adjustments) {
        if (!isRecord(item) || typeof item.symbol !== 'string' || !/^[A-Z0-9.-]{1,20}$/.test(item.symbol)
            || !finiteRange(item.dividendsPercent, 0, 100) || !finiteRange(item.feesPercent, 0, 100)
            || adjustments.some((candidate) => candidate.symbol === item.symbol)) continue;
        adjustments.push({
            symbol: item.symbol,
            dividendsPercent: item.dividendsPercent,
            feesPercent: item.feesPercent,
        });
        if (adjustments.length === 100) break;
    }
    return {
        version: 1,
        baseCurrency: value.baseCurrency,
        entryUsdMyr: value.entryUsdMyr,
        currentUsdMyr: value.currentUsdMyr,
        adjustments,
    };
};

export const calculateCurrencyPerformance = (
    record: ResearchRecord,
    currentPrice: number | null,
    settings: CurrencyPerformanceSettings,
): CurrencyPerformanceResult => {
    const parsed = parseCurrencyPerformanceSettings(settings);
    const quoteCurrency: PerformanceBaseCurrency = record.market === 'MY' ? 'MYR' : 'USD';
    const adjustment = parsed.adjustments.find((item) => item.symbol === record.symbol);
    const dividendsPercent = adjustment?.dividendsPercent ?? 0;
    const feesPercent = adjustment?.feesPercent ?? 0;
    const costBasis = record.positionPlan.averageCost ?? record.positionPlan.plannedEntryPrice;
    const validCost = costBasis !== null && Number.isFinite(costBasis) && costBasis > 0;
    const validPrice = currentPrice !== null && Number.isFinite(currentPrice) && currentPrice > 0;
    if (!validCost || !validPrice) return {
        symbol: record.symbol,
        quoteCurrency,
        baseCurrency: parsed.baseCurrency,
        costBasis: validCost ? costBasis : null,
        currentPrice: validPrice ? currentPrice : null,
        priceReturnPercent: null,
        fxReturnPercent: null,
        totalReturnPercent: null,
        relativeToSavedBenchmarkPercent: null,
        benchmarkLabel: record.decisionJournal.benchmarkLabel,
        dividendsPercent,
        feesPercent,
        available: false,
    };
    const priceFactor = currentPrice / costBasis;
    const fxFactor = quoteCurrency === parsed.baseCurrency
        ? 1
        : parsed.baseCurrency === 'MYR'
            ? parsed.currentUsdMyr / parsed.entryUsdMyr
            : parsed.entryUsdMyr / parsed.currentUsdMyr;
    const priceReturnPercent = round((priceFactor - 1) * 100);
    const fxReturnPercent = round((fxFactor - 1) * 100);
    const totalReturnPercent = round(((priceFactor * fxFactor) - 1) * 100 + dividendsPercent - feesPercent);
    const benchmarkReturn = record.decisionJournal.benchmarkReturnPercent;
    return {
        symbol: record.symbol,
        quoteCurrency,
        baseCurrency: parsed.baseCurrency,
        costBasis,
        currentPrice,
        priceReturnPercent,
        fxReturnPercent,
        totalReturnPercent,
        relativeToSavedBenchmarkPercent: benchmarkReturn === null ? null : round(totalReturnPercent - benchmarkReturn),
        benchmarkLabel: record.decisionJournal.benchmarkLabel,
        dividendsPercent,
        feesPercent,
        available: true,
    };
};
