import { IndicatorData, MarketSignal, SignalTier, ConfidenceMetrics, SignalAction } from './types/signal-v2';
import { getIndicatorBaseWeights, isScoredIndicator } from './indicator-registry';

/**
 * V2 Calculator: Coverage-Aware Weighting & Soft-Min Logic
 */
export function calculateCompositeScoreV2(
    indicators: IndicatorData[],
    config: {
        market: 'US' | 'MY';
        mode: 'standard' | 'contrarian';
    }
): MarketSignal {
    const { market, mode } = config;

    // 1. Filter enabled indicators
    const enabledIndicators = indicators.filter(i => i.enabled);

    // 2. Dynamic Regime Adjustment (High Volatility Override)
    // If VIX > 30 (Panic), valid signals are drowned out by noise.
    // We boost VIX weight to 85% to ensure safety.
    const vixIndicator = enabledIndicators.find(i => i.name === 'vix');
    const marketWeights = getIndicatorBaseWeights(market, {
        highVolatilityOverride: market === 'US' && Boolean(vixIndicator && vixIndicator.value > 30)
    });

    // 3. Preserve configured weights. Missing coverage contributes a neutral
    // baseline instead of amplifying whichever indicators happen to be active.
    const configuredWeight = Object.values(marketWeights)
        .filter(weight => weight > 0)
        .reduce((total, weight) => total + weight, 0) || 1;
    const activeIndicators = enabledIndicators
        .filter(ind => isScoredIndicator(ind.name, marketWeights))
        .map(ind => {
            const base = marketWeights[ind.name] || 0;
            return {
                ...ind,
                weight: base / configuredWeight
            };
        });

    // 4. Calculate Composite Score
    const neutralBaseline = 50;
    const activeWeight = activeIndicators.reduce((total, indicator) => total + indicator.weight, 0);
    const missingWeight = Math.max(0, 1 - activeWeight);
    const activePoints = activeIndicators.reduce((total, indicator) => total + (indicator.score * indicator.weight), 0);
    const neutralPoints = missingWeight * neutralBaseline;
    let compositeScore = activePoints + neutralPoints;

    // Clamp result
    compositeScore = Math.max(0, Math.min(100, Math.round(compositeScore)));

    // 5. Determine Tier
    let tier: SignalTier = 'neutral';

    // Contrarian (Default): High Score = Greed = Sell
    // Standard: High Score = Momentum = Buy
    const isContrarian = mode === 'contrarian';

    if (compositeScore >= 85) tier = isContrarian ? 'strong-sell' : 'strong-buy';
    else if (compositeScore >= 65) tier = isContrarian ? 'sell' : 'buy';
    else if (compositeScore >= 40) tier = 'neutral';
    else if (compositeScore >= 20) tier = isContrarian ? 'buy' : 'sell';
    else tier = isContrarian ? 'strong-buy' : 'strong-sell';

    // 6. Generate Interpretation
    const interpretation = generateInterpretation(tier, mode, compositeScore);

    // 6a. Update individual indicator signals based on mode (for confidence consistency)
    const scoredIndicators = activeIndicators.map(ind => {
        const isContr = mode === 'contrarian';
        let indTier: SignalTier = 'neutral';
        if (ind.score >= 85) indTier = isContr ? 'strong-sell' : 'strong-buy';
        else if (ind.score >= 65) indTier = isContr ? 'sell' : 'buy';
        else if (ind.score >= 40) indTier = 'neutral';
        else if (ind.score >= 20) indTier = isContr ? 'buy' : 'sell';
        else indTier = isContr ? 'strong-buy' : 'strong-sell';
        return {
            ...ind,
            signal: indTier
        };
    });

    // 7. Calculate indicator alignment
    const confidence = calculateConfidence(scoredIndicators, tier);

    return {
        composite_score: compositeScore,
        tier,
        mode,
        interpretation,
        components: scoredIndicators.reduce((acc, curr) => ({ ...acc, [curr.name]: curr }), {}),
        confidence,
        metadata: {
            market,
            data_freshness: scoredIndicators.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.last_updated }), {}),
            weight_distribution: scoredIndicators.reduce((acc, curr) => ({ ...acc, [curr.name]: curr.weight }), {}),
            coverage_adjustment: {
                active_weight: activeWeight,
                missing_weight: missingWeight,
                neutral_baseline: neutralBaseline,
                active_points: activePoints,
                neutral_points: neutralPoints,
            },
            stocks: [] // Will be populated by the API layer
        }
    };
}

/**
 * Generate Actionable Interpretation
 */
function generateInterpretation(tier: SignalTier, mode: 'standard' | 'contrarian', score: number): { action: string, reasoning: string, color: string, emoji: string } {
    const isContrarian = mode === 'contrarian';

    // Map generic tiers to specific actionable advice
    // Standard: Follow trend (Momentum)
    // Contrarian: Fade trend (Mean Reversion) - Existing specific logic

    switch (tier) {
        case 'strong-sell':
            return {
                action: isContrarian ? 'Optimism looks overcrowded' : 'Strongly negative',
                reasoning: isContrarian
                    ? `Market is euphoric (Score: ${score}). High risk of reversal. Consider taking profits.`
                    : `Market is under extreme pressure (Score: ${score}). Downside momentum is powerful.`,
                color: '#DC2626', // Red
                emoji: isContrarian ? '⚠️' : '🚀'
            };
        case 'sell':
            return {
                action: isContrarian ? 'Optimism may be overcrowded' : 'Leaning negative',
                reasoning: isContrarian
                    ? `Greed is elevated. Good time to scale out of positions.`
                    : `Market sentiment is weak. Downside momentum exists.`,
                color: '#F87171',
                emoji: isContrarian ? '💰' : '📈'
            };
        case 'neutral': // Neutral (40-64)
            return {
                action: 'Mixed',
                reasoning: 'Market is lacking clear direction. Volatility is average.',
                color: '#9CA3AF', // Gray
                emoji: '⚖️'
            };
        case 'buy':
            return {
                action: isContrarian ? 'Fear may be overdone' : 'Leaning positive',
                reasoning: isContrarian
                    ? `Fear is present. Good opportunity to start building positions.`
                    : `Bullish trend is healthy. Stay long but watch for overheating.`,
                color: '#34D399', // Green
                emoji: isContrarian ? '🛒' : '📉'
            };
        case 'strong-buy':
            return {
                action: isContrarian ? 'Fear looks overdone' : 'Strongly positive',
                reasoning: isContrarian
                    ? `Extreme panic detected (Score: ${score}). Best time for long-term entries.`
                    : `Market showing exceptional strength (Score: ${score}). Momentum is powerful.`,
                color: '#10B981',
                emoji: isContrarian ? '💎' : '🔪'
            };
    }
}

/**
 * Calculate indicator-alignment metrics.
 */
function calculateConfidence(indicators: IndicatorData[], majorityTier: SignalTier): ConfidenceMetrics {
    const activeCount = indicators.length;

    // Soft-min warning
    if (activeCount < 2) {
        return {
            agreement_pct: 100,
            level: 'low',
            majority_signal: getSignalFromTier(majorityTier),
            conflicting_indicators: [],
            warning: 'Single source mode: reliability is reduced.',
            source_count: activeCount,
            cap_reason: 'Signal alignment capped because fewer than 2 sources are active.'
        };
    }

    // Agreement Logic
    const majoritySignal = getSignalFromTier(majorityTier);
    let agreeing = 0;
    const conflicts: string[] = [];

    indicators.forEach(ind => {
        // Convert indicator signal to generic BUY/NEUTRAL/SELL for comparison
        const indSignal = getSignalFromTier(ind.signal);
        if (indSignal === majoritySignal) {
            agreeing++;
        } else {
            conflicts.push(ind.name);
        }
    });

    const agreementPct = Math.round((agreeing / activeCount) * 100);

    let level: 'high' | 'moderate' | 'low' = 'moderate';
    if (agreementPct >= 80) level = 'high';
    else if (agreementPct < 50) level = 'low';

    const capReason = activeCount < 3
        ? `Signal alignment capped at Moderate because only ${activeCount} active sources are available.`
        : undefined;

    if (capReason && level === 'high') {
        level = 'moderate';
    }

    return {
        agreement_pct: agreementPct,
        level,
        majority_signal: majoritySignal,
        conflicting_indicators: conflicts,
        warning: capReason,
        source_count: activeCount,
        cap_reason: capReason
    };
}

function getSignalFromTier(tier: SignalTier): SignalAction {
    if (tier === 'strong-buy' || tier === 'buy') return 'BUY';
    if (tier === 'strong-sell' || tier === 'sell') return 'SELL';
    return 'NEUTRAL';
}
