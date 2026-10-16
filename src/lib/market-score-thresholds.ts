/** Model score tier thresholds. Not equivalent to market regime (which also uses breadth and VIX). */
export const MARKET_SCORE_TIER_THRESHOLDS = {
    strongNegative: 20,
    neutralLower: 40,
    neutralUpper: 65,
    strongPositive: 85,
} as const;
