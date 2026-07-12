import type { DiscoveryRisk, EarlyTrendStage, ValuationGuardrail } from '../types/research-discovery';

export type DiscoveryFilters = {
    readonly sector: string;
    readonly risk: DiscoveryRisk | 'all';
    readonly stage: EarlyTrendStage | 'all';
    readonly valuation: ValuationGuardrail | 'all';
};

type FilterableDiscoveryCandidate = {
    readonly sector: string;
    readonly risk: DiscoveryRisk;
    readonly earlyTrendStage: EarlyTrendStage;
    readonly valuation: { readonly guardrail: ValuationGuardrail };
};

export const defaultDiscoveryFilters: DiscoveryFilters = {
    sector: 'all',
    risk: 'all',
    stage: 'all',
    valuation: 'all',
};

export const filterDiscoveryCandidates = <T extends FilterableDiscoveryCandidate>(
    candidates: readonly T[],
    filters: DiscoveryFilters,
): readonly T[] => candidates.filter((candidate) =>
    (filters.sector === 'all' || candidate.sector === filters.sector)
    && (filters.risk === 'all' || candidate.risk === filters.risk)
    && (filters.stage === 'all' || candidate.earlyTrendStage === filters.stage)
    && (filters.valuation === 'all' || candidate.valuation.guardrail === filters.valuation));

export const hasDiscoveryFilters = (filters: DiscoveryFilters): boolean =>
    filters.sector !== 'all' || filters.risk !== 'all' || filters.stage !== 'all' || filters.valuation !== 'all';
