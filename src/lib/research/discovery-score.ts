import type { DiscoveryCandidate, DiscoveryResult } from '../types/research-discovery';

const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), maximum);

export const scoreDiscoveryCandidate = (candidate: DiscoveryCandidate): DiscoveryResult => {
    const flags: string[] = [];
    if (candidate.averageDollarVolume < 20_000_000) flags.push('Low dollar liquidity');
    if (candidate.maxDailyMovePercent > 18) flags.push('Extreme one-day move');
    if (candidate.volumeSpikeRatio > 4) flags.push('Abnormal volume spike');
    if (candidate.distanceFromMa50Percent > 25) flags.push('Far above 50-day average');
    if (candidate.annualizedVolatilityPercent > 70) flags.push('Very high volatility');

    const riskScore = clamp(
        (candidate.averageDollarVolume < 20_000_000 ? 30 : 0)
        + (candidate.maxDailyMovePercent > 18 ? 25 : 0)
        + (candidate.volumeSpikeRatio > 4 ? 20 : 0)
        + (candidate.distanceFromMa50Percent > 25 ? 15 : 0)
        + (candidate.annualizedVolatilityPercent > 70 ? 20 : 0),
        0, 100,
    );
    const momentumScore = clamp(candidate.momentum3MonthPercent * 0.8, 0, 30)
        + clamp(candidate.momentum6MonthPercent * 0.5, 0, 30);
    const trendScore = Math.round(clamp(
        momentumScore + (candidate.aboveMa50 ? 12 : 0) + (candidate.aboveMa200 ? 18 : 0)
        + (candidate.volumeSpikeRatio >= 1 && candidate.volumeSpikeRatio <= 2.5 ? 10 : 4) - riskScore * 0.35,
        0, 100,
    ));
    const reasons = [
        candidate.momentum3MonthPercent > 10 ? `3-month momentum +${candidate.momentum3MonthPercent.toFixed(1)}%` : null,
        candidate.momentum6MonthPercent > 20 ? `6-month momentum +${candidate.momentum6MonthPercent.toFixed(1)}%` : null,
        candidate.aboveMa50 && candidate.aboveMa200 ? 'Above 50- and 200-day averages' : null,
        candidate.averageDollarVolume >= 20_000_000 ? 'Liquid trading profile' : null,
    ].filter((reason): reason is string => reason !== null);
    return {
        ...candidate,
        trendScore,
        riskScore,
        risk: riskScore >= 40 ? 'high' : riskScore >= 15 ? 'moderate' : 'low',
        reasons,
        flags,
    };
};
