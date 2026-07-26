import type { MarketSignal } from '../types/signal-v2';

export type MarketExposureLevel = 'higher' | 'moderate' | 'lower' | 'unmapped';

export type MarketExposureWatchlistItem = {
    readonly symbol: string;
    readonly market: 'US' | 'MY';
    readonly sector: string;
    readonly industry: string;
    readonly positionState: 'owned' | 'not-owned';
    readonly lastReviewedAt: string;
};

export type MarketExposureConnection = {
    readonly driverKey: string;
    readonly driverName: string;
    readonly driverImpact: 'positive' | 'negative' | 'neutral';
    readonly level: MarketExposureLevel;
    readonly rule: string;
};

export type MarketWatchlistExposure = {
    readonly symbol: string;
    readonly sector: string;
    readonly industry: string;
    readonly owned: boolean;
    readonly reviewAgeDays: number | null;
    readonly highestLevel: MarketExposureLevel;
    readonly connections: readonly MarketExposureConnection[];
};

const cyclicalSectors = new Set([
    'Communication Services',
    'Consumer Discretionary',
    'Energy',
    'Financials',
    'Industrials',
    'Materials',
    'Real Estate',
    'Technology',
]);
const defensiveSectors = new Set(['Consumer Staples', 'Healthcare', 'Utilities']);
const levelRank: Readonly<Record<MarketExposureLevel, number>> = {
    higher: 3,
    moderate: 2,
    lower: 1,
    unmapped: 0,
};

const driverFamily = (key: string, name: string): 'volatility' | 'positioning' | 'sentiment' | 'broad' => {
    const normalized = `${key} ${name}`.toLowerCase();
    if (/vix|volatil/.test(normalized)) return 'volatility';
    if (/put.?call|naaim|aaii|position|fund manager/.test(normalized)) return 'positioning';
    if (/social|news|sentiment/.test(normalized)) return 'sentiment';
    return 'broad';
};

const exposureRule = (
    family: ReturnType<typeof driverFamily>,
    sector: string,
): Pick<MarketExposureConnection, 'level' | 'rule'> => {
    if (!sector || sector === 'Unknown' || sector === 'Other') {
        return { level: 'unmapped', rule: 'Sector classification is unavailable, so no sensitivity rule is applied.' };
    }
    if (sector === 'ETF') {
        return family === 'positioning'
            ? { level: 'higher', rule: 'Broad-market funds have a direct connection to market-wide positioning.' }
            : { level: 'moderate', rule: 'A diversified fund has broad exposure but no single-sector sensitivity is inferred.' };
    }
    if (family === 'volatility') {
        if (cyclicalSectors.has(sector)) return { level: 'higher', rule: 'Cyclical and growth sectors receive the higher volatility-attention rule.' };
        if (defensiveSectors.has(sector)) return { level: 'lower', rule: 'Defensive sectors receive the lower volatility-attention rule.' };
        return { level: 'moderate', rule: 'The sector has a broad volatility connection without a stronger category rule.' };
    }
    if (family === 'positioning') {
        return cyclicalSectors.has(sector)
            ? { level: 'higher', rule: 'Cyclical and growth sectors receive the higher market-positioning attention rule.' }
            : { level: 'moderate', rule: 'Market positioning is treated as a broad connection for this sector.' };
    }
    if (family === 'sentiment') {
        return cyclicalSectors.has(sector)
            ? { level: 'higher', rule: 'Cyclical and growth sectors receive the higher sentiment-attention rule.' }
            : defensiveSectors.has(sector)
                ? { level: 'lower', rule: 'Defensive sectors receive the lower sentiment-attention rule.' }
                : { level: 'moderate', rule: 'Sentiment is treated as a broad connection for this sector.' };
    }
    return { level: 'moderate', rule: 'No narrower sector rule exists; the driver is shown as broad market context.' };
};

const ageInDays = (value: string, now: Date) => {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return null;
    return Math.max(0, Math.floor((now.getTime() - time) / 86_400_000));
};

export const buildMarketWatchlistExposure = (
    signal: MarketSignal,
    watchlist: readonly MarketExposureWatchlistItem[],
    now = new Date(),
): readonly MarketWatchlistExposure[] => {
    const drivers = (signal.metadata.score_drivers ?? [])
        .filter((driver) => signal.components[driver.key]?.enabled === true);

    return watchlist
        .filter((item) => item.market === signal.metadata.market)
        .map((item) => {
            const connections = drivers.map((driver): MarketExposureConnection => ({
                driverKey: driver.key,
                driverName: driver.name,
                driverImpact: driver.impact,
                ...exposureRule(driverFamily(driver.key, driver.name), item.sector),
            }));
            const highestLevel = connections.reduce<MarketExposureLevel>(
                (highest, connection) => levelRank[connection.level] > levelRank[highest] ? connection.level : highest,
                'unmapped',
            );
            return {
                symbol: item.symbol,
                sector: item.sector || 'Unknown',
                industry: item.industry || 'Unknown',
                owned: item.positionState === 'owned',
                reviewAgeDays: ageInDays(item.lastReviewedAt, now),
                highestLevel,
                connections,
            };
        })
        .sort((left, right) =>
            Number(right.owned) - Number(left.owned)
            || levelRank[right.highestLevel] - levelRank[left.highestLevel]
            || (right.reviewAgeDays ?? -1) - (left.reviewAgeDays ?? -1)
            || left.symbol.localeCompare(right.symbol));
};
