import type { DiscoveryCategory, DiscoveryRisk } from '../types/research-discovery';

type RankableCandidate = {
    readonly discoveryScore: number;
    readonly category: DiscoveryCategory;
};

type ContenderContext = {
    readonly category: DiscoveryCategory;
    readonly risk: DiscoveryRisk;
};

export const rankDiscoveryTiers = <T extends RankableCandidate>(candidates: readonly T[]) => {
    const eligible = candidates
        .filter((candidate) => candidate.category !== 'fundamentally unsupported')
        .sort((left, right) => right.discoveryScore - left.discoveryScore);
    return {
        leaders: eligible.slice(0, 10),
        contenders: eligible.slice(10, 20),
    };
};

export const describeContender = (candidate: ContenderContext): string => {
    if (candidate.category === 'unconfirmed') return 'SEC quality not confirmed';
    if (candidate.risk === 'moderate') return 'Moderate risk deduction';
    return 'Lower combined score than current leaders';
};
