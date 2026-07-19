export interface WeightedSentimentSource {
    score: number;
    weight: number;
    available: boolean;
}

/**
 * Combines available sentiment sources while preserving their relative weights.
 * Missing sources do not pull the result toward neutral.
 */
export function combineAvailableSentiment(sources: WeightedSentimentSource[]): number {
    const availableSources = sources.filter(source => source.available && source.weight > 0);
    const availableWeight = availableSources.reduce((total, source) => total + source.weight, 0);

    if (availableWeight === 0) {
        return 0;
    }

    const weightedScore = availableSources.reduce(
        (total, source) => total + (source.score * source.weight),
        0
    );

    return Math.max(-1, Math.min(1, weightedScore / availableWeight));
}
