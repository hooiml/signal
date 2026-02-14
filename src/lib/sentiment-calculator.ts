/**
 * Market Sentiment Score Calculator
 * Combines VIX volatility index with social sentiment data
 * Output: 0-100 score (0=extreme fear, 100=extreme greed)
 */

export interface SentimentConfig {
    /** VIX weight during normal conditions (0-1). Default: 0.65 */
    vixBaseWeight?: number;
    /** Social sentiment weight during normal conditions (0-1). Default: 0.35 */
    socialBaseWeight?: number;
    /** VIX level that triggers crisis mode. Default: 30 */
    crisisThreshold?: number;
    /** Optional 52-week VIX range for regime-aware normalization */
    vix52wRange?: { min: number; max: number };
    /** Enable velocity adjustment based on VIX % change. Default: true */
    enableVelocity?: boolean;
    /** VIX change % threshold for velocity impact. Default: 15 */
    velocityThreshold?: number;
}

export interface SentimentInputs {
    /** Current VIX level (typically 10-80) */
    vix: number;
    /** Social sentiment (-1.0 to +1.0) */
    social: number;
    /** Optional VIX percent change from previous day */
    vixChangePct?: number;
}

export interface SentimentOutput {
    /** Final 0-100 sentiment score */
    score: number;
    /** Descriptive aura level */
    auraLevel: AuraLevel;
    /** Individual component scores for debugging */
    components: {
        vixScore: number;
        socialScore: number;
        vixWeight: number;
        socialWeight: number;
    };
}

export type AuraLevel =
    | 'EXTREME_GREED'
    | 'GREED'
    | 'NEUTRAL'
    | 'ANXIETY'
    | 'FEAR'
    | 'EXTREME_FEAR';

/**
 * VIX Thresholds based on historical percentiles (1990-2023)
 */
export const VIX_THRESHOLDS = {
    EXTREME_GREED: { max: 13, description: 'Exceptional complacency, contrarian sell signal' },
    GREED: { min: 13, max: 17, description: 'Low volatility, confident investors' },
    NEUTRAL: { min: 17, max: 23, description: 'Historical median zone' },
    ANXIETY: { min: 23, max: 30, description: 'Elevated volatility, watch closely' },
    FEAR: { min: 30, max: 40, description: 'Clear panic, risk-off sentiment' },
    EXTREME_FEAR: { min: 40, description: 'Crisis levels, contrarian buy signal' },
} as const;

/**
 * Score interpretation buckets
 */
export const SCORE_BUCKETS = {
    EXTREME_GREED: { min: 85, max: 100, description: 'Euphoria, extreme risk' },
    GREED: { min: 65, max: 84, description: 'Bullish, risk-on favored' },
    NEUTRAL: { min: 40, max: 64, description: 'Mixed signals, hold' },
    FEAR: { min: 20, max: 39, description: 'Bearish, risk-off favored' },
    EXTREME_FEAR: { min: 0, max: 19, description: 'Panic, extreme opportunity' },
} as const;

/**
 * Calculates aura level based on VIX value
 */
export function getAuraLevel(vix: number): AuraLevel {
    if (vix < VIX_THRESHOLDS.EXTREME_GREED.max) return 'EXTREME_GREED';
    if (vix < VIX_THRESHOLDS.GREED.max) return 'GREED';
    if (vix < VIX_THRESHOLDS.NEUTRAL.max) return 'NEUTRAL';
    if (vix < VIX_THRESHOLDS.ANXIETY.max) return 'ANXIETY';
    if (vix < VIX_THRESHOLDS.FEAR.max) return 'FEAR';
    return 'EXTREME_FEAR';
}

/**
 * Calculates score bucket based on final score
 */
export function getScoreBucket(score: number): keyof typeof SCORE_BUCKETS {
    if (score >= SCORE_BUCKETS.EXTREME_GREED.min) return 'EXTREME_GREED';
    if (score >= SCORE_BUCKETS.GREED.min) return 'GREED';
    if (score >= SCORE_BUCKETS.NEUTRAL.min) return 'NEUTRAL';
    if (score >= SCORE_BUCKETS.FEAR.min) return 'FEAR';
    return 'EXTREME_FEAR';
}

/**
 * Get human-readable description for score bucket
 */
export function getScoreDescription(score: number): string {
    const bucket = getScoreBucket(score);
    return SCORE_BUCKETS[bucket].description;
}

/**
 * NORMALIZES VIX to 0-100 score (inverted: low VIX = high greed)
 * Uses either absolute scale or 52-week percentile if provided
 */
function normalizeVixScore(vix: number, config: SentimentConfig): number {
    let vixScore: number;

    if (config.vix52wRange && config.vix52wRange.min !== config.vix52wRange.max) {
        // REGIME-AWARE: Use 52-week percentile (MUCH BETTER)
        const { min, max } = config.vix52wRange;
        const percentile = (vix - min) / (max - min);
        vixScore = 100 - (percentile * 100);
    } else {
        // ABSOLUTE SCALE: Logistic function for smooth mapping
        // - Centered at VIX=24 (per user mandates)
        // - Steepness=6 controls transition smoothness
        vixScore = 100 / (1 + Math.exp((vix - 24) / 6));
    }

    // Clamp and round
    return Math.max(0, Math.min(100, Math.round(vixScore * 100) / 100));
}

/**
 * NORMALIZES Social Sentiment (-1 to +1) to 0-100 score
 */
function normalizeSocialScore(social: number): number {
    // Clamp to valid range first (defensive)
    const clampedSocial = Math.max(-1, Math.min(1, social));

    // Convert -1 to +1 → 0 to 100
    const socialScore = (clampedSocial + 1) * 50;

    return Math.max(0, Math.min(100, Math.round(socialScore * 100) / 100));
}

/**
 * SIMPLE & ROBUST: Linear normalization with adaptive weights
 * Best for production MVP
 */
export function calculateSentimentScoreSimple(
    inputs: SentimentInputs,
    config: SentimentConfig = {}
): SentimentOutput {
    const {
        vixBaseWeight = 0.65,
        enableVelocity = true,
        velocityThreshold = 15,
    } = config;

    // Validate inputs (defensive - clamp instead of throw for production stability)
    const safeVix = Math.max(5, Math.min(100, inputs.vix));
    const safeSocial = Math.max(-1, Math.min(1, inputs.social));

    // 1. Normalize both components to 0-100
    const vixScore = normalizeVixScore(safeVix, config);
    const socialScore = normalizeSocialScore(safeSocial);

    // 2. 5-TIER REGIME-AWARE WEIGHTING (Quant Audit Recommended)
    // Dynamic weights adjust based on VIX levels to prevent social noise in panics
    let regimeBaseVixWeight = vixBaseWeight;
    const regimeMaxVixWeight = 0.95;

    if (safeVix < 15) {
        // GRIND REGIME: VIX < 15. Social sentiment is highly predictive/noisy.
        regimeBaseVixWeight = Math.min(vixBaseWeight, 0.40);
    } else if (safeVix < 25) {
        // NORMAL REGIME: VIX 15-25. Use the provided base weights.
        regimeBaseVixWeight = vixBaseWeight;
    } else if (safeVix < 35) {
        // STRESS REGIME: VIX 25-35. Shift toward VIX anchor.
        regimeBaseVixWeight = Math.max(vixBaseWeight, 0.75);
    } else if (safeVix < 50) {
        // PANIC REGIME: VIX 35-50. Social is noise. VIX is everything.
        regimeBaseVixWeight = Math.max(vixBaseWeight, 0.90);
    } else {
        // BLACK SWAN: VIX > 50. Pure volatility regime.
        regimeBaseVixWeight = 0.95;
    }

    // Apply a smooth gradient within the regime to prevent sudden jumps
    // (Existing transition logic preserved and integrated)
    const volatilityPenalty = Math.max(0, (50 - vixScore) / 50);
    const vixWeight = Math.max(regimeBaseVixWeight, Math.min(regimeMaxVixWeight, regimeBaseVixWeight + (0.15 * volatilityPenalty)));
    const socialWeight = 1 - vixWeight;

    // 3. Velocity adjustment (optional)
    let velocityAdjustment = 0;
    if (enableVelocity && inputs.vixChangePct !== undefined) {
        const vixChange = Math.abs(inputs.vixChangePct);
        if (vixChange > velocityThreshold) {
            // Large VIX moves indicate fear spikes or relief
            const velocityDirection = inputs.vixChangePct > 0 ? -1 : 1; // VIX up = bearish
            velocityAdjustment = velocityDirection * Math.min(10, (vixChange - velocityThreshold) * 0.5);
        }
    }

    // 4. Calculate weighted score
    let score = (vixScore * vixWeight) + (socialScore * socialWeight);
    score += velocityAdjustment;

    // 5. Clamp to valid range (CRITICAL - prevents negative scores)
    score = Math.max(0, Math.min(100, Math.round(score)));

    // 6. Derive auraLevel from the FINAL SCORE (not VIX alone) for consistency
    const scoreBucket = getScoreBucket(score);
    // Map score bucket to AuraLevel (they share the same names except ANXIETY)
    const auraLevel: AuraLevel = scoreBucket === 'EXTREME_GREED' ? 'EXTREME_GREED' :
        scoreBucket === 'GREED' ? 'GREED' :
            scoreBucket === 'NEUTRAL' ? 'NEUTRAL' :
                scoreBucket === 'FEAR' ? 'FEAR' : 'EXTREME_FEAR';

    return {
        score,
        auraLevel,
        components: {
            vixScore,
            socialScore,
            vixWeight: Math.round(vixWeight * 100) / 100,
            socialWeight: Math.round(socialWeight * 100) / 100,
        },
    };
}

/**
 * ADVANCED: Logistic function with percentile-based extremeness
 * Best for research/hedge funds
 */
export function calculateSentimentScoreAdvanced(
    inputs: SentimentInputs,
    config: SentimentConfig = {}
): SentimentOutput {
    const {
        vixBaseWeight = 0.6,
        crisisThreshold = 30,
        enableVelocity = true,
    } = config;

    // Defensive clamping
    const safeVix = Math.max(5, Math.min(100, inputs.vix));
    const safeSocial = Math.max(-1, Math.min(1, inputs.social));

    // 1. Advanced VIX score using logistic (smoother than linear)
    const vixScore = 100 / (1 + Math.exp((safeVix - 25) / 5));

    // 2. Social score with optional momentum boost
    const socialScore = normalizeSocialScore(safeSocial);

    // 3. Percentile-based extremeness (requires 52w range)
    let extremeness = 0;
    if (config.vix52wRange) {
        const { min, max } = config.vix52wRange;
        if (max !== min) {
            const percentile = (safeVix - min) / (max - min);
            extremeness = Math.abs(percentile - 0.5) * 2; // 0=normal, 1=extreme
        }
    }

    // 4. Dynamic weights: More VIX weight in extreme conditions
    const isCrisis = safeVix >= crisisThreshold;
    const vixWeight = isCrisis ? 0.85 : Math.min(0.85, vixBaseWeight + (extremeness * 0.2));
    const socialWeight = 1 - vixWeight;

    // 5. Velocity adjustment (same as simple)
    let velocityAdjustment = 0;
    if (enableVelocity && inputs.vixChangePct !== undefined) {
        const velocityDirection = inputs.vixChangePct > 0 ? -1 : 1;
        velocityAdjustment = velocityDirection * Math.min(8, Math.abs(inputs.vixChangePct) * 0.3);
    }

    // 6. Final score with clamping
    let score = (vixScore * vixWeight) + (socialScore * socialWeight);
    score += velocityAdjustment;
    score = Math.max(0, Math.min(100, Math.round(score)));

    // 7. Derive auraLevel from the FINAL SCORE for consistency
    const scoreBucket = getScoreBucket(score);
    const auraLevel: AuraLevel = scoreBucket === 'EXTREME_GREED' ? 'EXTREME_GREED' :
        scoreBucket === 'GREED' ? 'GREED' :
            scoreBucket === 'NEUTRAL' ? 'NEUTRAL' :
                scoreBucket === 'FEAR' ? 'FEAR' : 'EXTREME_FEAR';

    return {
        score,
        auraLevel,
        components: {
            vixScore: Math.round(vixScore * 100) / 100,
            socialScore,
            vixWeight: Math.round(vixWeight * 100) / 100,
            socialWeight: Math.round(socialWeight * 100) / 100,
        },
    };
}

/**
 * Factory function to get the recommended implementation
 */
export function getSentimentCalculator(useAdvanced: boolean = false) {
    return useAdvanced ? calculateSentimentScoreAdvanced : calculateSentimentScoreSimple;
}

/**
 * Default calculator for most use cases
 */
export const calculateSentimentScore = calculateSentimentScoreSimple;
