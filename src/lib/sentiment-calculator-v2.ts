import { IndicatorData, MarketSignal, SignalTier, ConfidenceMetrics, SignalAction } from './types/signal-v2';

/**
 * V2 Calculator: Proportional Redistribution & Soft-Min Logic
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

    // 2. Define Base Weights (Per Market)
    // Matches existing V1 logic: US=VIX dominated, MY=News dominated
    const BASE_WEIGHTS: Record<string, Record<string, number>> = {
        US: {
            vix: 0.40,
            social: 0.30,
            aaii: 0.20,
            bofa: 0.10
        },
        MY: {
            vix: 0.25,
            social: 0.15,
            news: 0.50,
            aaii: 0.10
        }
    };

    // 2a. Dynamic Regime Adjustment (High Volatility Override)
    // If VIX > 30 (Panic), valid signals are drowned out by noise.
    // We boost VIX weight to 85% to ensure safety.
    const vixIndicator = enabledIndicators.find(i => i.name === 'vix');
    let dynamicWeights = { ... (BASE_WEIGHTS[market] || BASE_WEIGHTS['US']) };

    if (market === 'US' && vixIndicator && vixIndicator.value > 30) {
        dynamicWeights = {
            vix: 0.85,
            social: 0.15,
            aaii: 0.0,
            bofa: 0.0
        };
    }

    const marketWeights = dynamicWeights;

    // 3. Proportional Redistribution
    let totalBaseWeight = 0;
    enabledIndicators.forEach(ind => {
        totalBaseWeight += (marketWeights[ind.name] || 0);
    });

    // Avoid division by zero
    if (totalBaseWeight === 0) totalBaseWeight = 1;

    // Redistribute weights without mutating the original inputs.
    const activeIndicators = enabledIndicators.map(ind => {
        const base = marketWeights[ind.name] || 0;
        return {
            ...ind,
            weight: base / totalBaseWeight
        };
    });

    // 4. Calculate Composite Score
    let compositeScore = 0;
    activeIndicators.forEach(ind => {
        compositeScore += (ind.score * ind.weight);
    });

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

    // 7. Calculate Confidence
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
                action: isContrarian ? 'Extreme Caution / Trim' : 'Strong Downtrend',
                reasoning: isContrarian
                    ? `Market is euphoric (Score: ${score}). High risk of reversal. Consider taking profits.`
                    : `Market is under extreme pressure (Score: ${score}). Downside momentum is powerful.`,
                color: '#DC2626', // Red
                emoji: isContrarian ? '⚠️' : '🚀'
            };
        case 'sell':
            return {
                action: isContrarian ? 'Fade / Take Profit' : 'Defensive',
                reasoning: isContrarian
                    ? `Greed is elevated. Good time to scale out of positions.`
                    : `Market sentiment is weak. Downside momentum exists.`,
                color: '#F87171',
                emoji: isContrarian ? '💰' : '📈'
            };
        case 'neutral': // Neutral (40-64)
            return {
                action: 'Hold / Wait',
                reasoning: 'Market is lacking clear direction. Volatility is average.',
                color: '#9CA3AF', // Gray
                emoji: '⚖️'
            };
        case 'buy':
            return {
                action: isContrarian ? 'Accumulate' : 'Ride Uptrend',
                reasoning: isContrarian
                    ? `Fear is present. Good opportunity to start building positions.`
                    : `Bullish trend is healthy. Stay long but watch for overheating.`,
                color: '#34D399', // Green
                emoji: isContrarian ? '🛒' : '📉'
            };
        case 'strong-buy':
            return {
                action: isContrarian ? 'Strong Buy / Aggressive' : 'Strong Momentum',
                reasoning: isContrarian
                    ? `Extreme panic detected (Score: ${score}). Best time for long-term entries.`
                    : `Market showing exceptional strength (Score: ${score}). Momentum is powerful.`,
                color: '#10B981',
                emoji: isContrarian ? '💎' : '🔪'
            };
    }
}

/**
 * Calculate Confidence Metrics
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
            warning: 'Single source mode: reliability is reduced.'
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

    return {
        agreement_pct: agreementPct,
        level,
        majority_signal: majoritySignal,
        conflicting_indicators: conflicts
    };
}

function getSignalFromTier(tier: SignalTier): SignalAction {
    if (tier === 'strong-buy' || tier === 'buy') return 'BUY';
    if (tier === 'strong-sell' || tier === 'sell') return 'SELL';
    return 'NEUTRAL';
}
