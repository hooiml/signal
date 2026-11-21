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

export const US_VIX_STRESS_START = 25;
export const US_VIX_STRESS_FULL = 40;
export const US_VIX_MAX_WEIGHT = 0.60;

export const INDICATOR_REGISTRY: Record<string, IndicatorDefinition> = {
    vix: {
        key: 'vix',
        displayName: 'VIX Index',
        category: 'volatility',
        frequency: 'live',
        staleAfterDays: 1,
        baseWeights: { US: 0.40, MY: 0.30 },
    },
    social: {
        key: 'social',
        displayName: 'Social Sentiment',
        category: 'sentiment',
        frequency: 'daily',
        staleAfterDays: 1,
        baseWeights: { US: 0.15 },
    },
    put_call: {
        key: 'put_call',
        displayName: 'Put/call ratio',
        category: 'positioning',
        frequency: 'daily',
        staleAfterDays: 2,
        baseWeights: { US: 0.20 },
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
        baseWeights: { US: 0.25 },
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

export function getVixStressFactor(vixValue: number | null | undefined): number {
    if (typeof vixValue !== 'number' || !Number.isFinite(vixValue) || vixValue <= US_VIX_STRESS_START) {
        return 0;
    }
    return Math.min(1, (vixValue - US_VIX_STRESS_START) / (US_VIX_STRESS_FULL - US_VIX_STRESS_START));
}

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

    // Explicit user opt-out removes social/news from the configured denominator and
    // redistributes its weight proportionally rather than treating it as missing evidence.
    if (options.enableSocial === false) {
        const sourceKey = market === 'MY' ? 'news' : 'social';
        weights[sourceKey] = 0;
        const remainingTotal = Object.values(weights).reduce((sum, w) => sum + w, 0);
        if (remainingTotal > 0) {
            for (const key of Object.keys(weights)) {
                weights[key] = weights[key] / remainingTotal;
            }
        }
    }

    if (market === 'US') {
        const effectiveVix = typeof options.vixValue === 'number' && Number.isFinite(options.vixValue)
            ? options.vixValue
            : options.highVolatilityOverride ? 35 : null;
        const stress = getVixStressFactor(effectiveVix);
        if (stress > 0) {
            const baseVix = weights.vix ?? 0.40;
            const targetVix = baseVix + (US_VIX_MAX_WEIGHT - baseVix) * stress;
            const nonVixTarget = Math.max(0, 1 - targetVix);
            // Taper slow weekly surveys gently during volatility stress while preserving daily put/call.
            const weeklyScale = 1 - 0.35 * stress;
            const adjustedNonVix: Record<string, number> = {};
            let nonVixSum = 0;
            for (const [key, w] of Object.entries(weights)) {
                if (key === 'vix' || w <= 0) continue;
                const factor = INDICATOR_REGISTRY[key]?.frequency === 'weekly' ? weeklyScale : 1;
                adjustedNonVix[key] = w * factor;
                nonVixSum += adjustedNonVix[key];
            }
            weights.vix = targetVix;
            if (nonVixSum > 0) {
                for (const [key, w] of Object.entries(adjustedNonVix)) {
                    weights[key] = (w / nonVixSum) * nonVixTarget;
                }
            }
        }
    }

    return weights;
}

export function isScoredIndicator(key: string, weights: Record<string, number>) {
    return (weights[key] ?? 0) > 0;
}
