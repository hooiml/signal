import { getUsV220Weights, US_V220_BASE_WEIGHTS } from './market-score-v220';

export { getVixStressFactor, US_VIX_MAX_WEIGHT, US_VIX_STRESS_FULL, US_VIX_STRESS_START } from './market-score-v220';

type Market = 'US' | 'MY';

type IndicatorCategory = 'volatility' | 'sentiment' | 'survey' | 'institutional' | 'positioning' | 'trend';
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
        baseWeights: { US: US_V220_BASE_WEIGHTS.vix, MY: 0.30 },
    },
    social: {
        key: 'social',
        displayName: 'Social Sentiment',
        category: 'sentiment',
        frequency: 'daily',
        staleAfterDays: 1,
        baseWeights: { US: US_V220_BASE_WEIGHTS.social },
    },
    put_call: {
        key: 'put_call',
        displayName: 'Put/call ratio',
        category: 'positioning',
        frequency: 'daily',
        staleAfterDays: 2,
        baseWeights: { US: US_V220_BASE_WEIGHTS.put_call },
    },
    klci_trend: {
        key: 'klci_trend',
        displayName: 'KLCI 52w Trend',
        category: 'trend',
        frequency: 'daily',
        staleAfterDays: 2,
        baseWeights: { MY: 0.35 },
    },
    my_breadth: {
        key: 'my_breadth',
        displayName: 'Bursa Stock Breadth',
        category: 'positioning',
        frequency: 'daily',
        staleAfterDays: 2,
        baseWeights: { MY: 0.20 },
    },
    news: {
        key: 'news',
        displayName: 'News Sentiment',
        category: 'sentiment',
        frequency: 'daily',
        staleAfterDays: 1,
        baseWeights: { MY: 0.15 },
    },
    aaii: {
        key: 'aaii',
        displayName: 'AAII Sentiment',
        category: 'survey',
        frequency: 'weekly',
        staleAfterDays: 14,
        baseWeights: { US: US_V220_BASE_WEIGHTS.aaii },
    },
    naaim: {
        key: 'naaim',
        displayName: 'Manager exposure (NAAIM)',
        category: 'positioning',
        frequency: 'weekly',
        staleAfterDays: 14,
        baseWeights: {},
    },
    bofa: {
        key: 'bofa',
        displayName: 'BofA SSI',
        category: 'institutional',
        frequency: 'manual',
        staleAfterDays: 45,
        baseWeights: {},
    },
};

export function getIndicatorDisplayName(key: string) {
    return INDICATOR_REGISTRY[key]?.displayName ?? key.toUpperCase();
}

export function getIndicatorBaseWeights(
    market: Market,
    options: { highVolatilityOverride?: boolean; vixValue?: number; enableSocial?: boolean } = {},
) {
    const weights: Record<string, number> = Object.fromEntries(
        Object.values(INDICATOR_REGISTRY)
            .map(definition => [definition.key, definition.baseWeights[market] ?? 0])
    );

    if (market === 'US') {
        const effectiveVix = typeof options.vixValue === 'number' && Number.isFinite(options.vixValue)
            ? options.vixValue
            : options.highVolatilityOverride ? 35 : null;
        return { ...weights, ...getUsV220Weights(effectiveVix, options.enableSocial !== false) };
    }

    // Explicit user opt-out removes news from the configured denominator and
    // redistributes its weight proportionally rather than treating it as missing evidence.
    if (options.enableSocial === false) {
        weights.news = 0;
        const remainingTotal = Object.values(weights).reduce((sum, w) => sum + w, 0);
        if (remainingTotal > 0) {
            for (const key of Object.keys(weights)) {
                weights[key] = weights[key] / remainingTotal;
            }
        }
    }

    return weights;
}

export function isScoredIndicator(key: string, weights: Record<string, number>) {
    return (weights[key] ?? 0) > 0;
}
