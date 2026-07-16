type Market = 'US' | 'MY';

type IndicatorCategory = 'volatility' | 'sentiment' | 'survey' | 'institutional' | 'positioning';
type IndicatorFrequency = 'live' | 'daily' | 'weekly' | 'manual';

interface IndicatorDefinition {
    key: string;
    displayName: string;
    category: IndicatorCategory;
    frequency: IndicatorFrequency;
    staleAfterDays: number;
    baseWeights: Partial<Record<Market, number>>;
}

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
    vix: {
        key: 'vix',
        displayName: 'VIX Index',
        category: 'volatility',
        frequency: 'live',
        staleAfterDays: 1,
        baseWeights: { US: 0.35, MY: 0.25 },
    },
    social: {
        key: 'social',
        displayName: 'Social Sentiment',
        category: 'sentiment',
        frequency: 'daily',
        staleAfterDays: 1,
        baseWeights: { US: 0.20 },
    },
    put_call: {
        key: 'put_call',
        displayName: 'Put/call ratio',
        category: 'positioning',
        frequency: 'daily',
        staleAfterDays: 2,
        baseWeights: { US: 0.10 },
    },
    news: {
        key: 'news',
        displayName: 'News Sentiment',
        category: 'sentiment',
        frequency: 'daily',
        staleAfterDays: 1,
        baseWeights: { MY: 0.65 },
    },
    aaii: {
        key: 'aaii',
        displayName: 'AAII Sentiment',
        category: 'survey',
        frequency: 'weekly',
        staleAfterDays: 14,
        baseWeights: { US: 0.20, MY: 0.10 },
    },
    naaim: {
        key: 'naaim',
        displayName: 'Manager exposure (NAAIM)',
        category: 'positioning',
        frequency: 'weekly',
        staleAfterDays: 14,
        baseWeights: { US: 0.10 },
    },
    bofa: {
        key: 'bofa',
        displayName: 'BofA SSI',
        category: 'institutional',
        frequency: 'manual',
        staleAfterDays: 45,
        baseWeights: { US: 0.05 },
    },
};

const HIGH_VOLATILITY_US_WEIGHTS: Record<string, number> = {
    vix: 0.85,
    social: 0.15,
};

export function getIndicatorDisplayName(key: string) {
    return INDICATOR_REGISTRY[key]?.displayName ?? key.toUpperCase();
}

export function getIndicatorBaseWeights(market: Market, options: { highVolatilityOverride?: boolean } = {}) {
    if (market === 'US' && options.highVolatilityOverride) {
        return HIGH_VOLATILITY_US_WEIGHTS;
    }

    return Object.fromEntries(
        Object.values(INDICATOR_REGISTRY)
            .map(definition => [definition.key, definition.baseWeights[market] ?? 0])
    ) as Record<string, number>;
}

export function isScoredIndicator(key: string, weights: Record<string, number>) {
    return (weights[key] ?? 0) > 0;
}
