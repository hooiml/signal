import type { ResearchMarket } from '../types/research';

export type ResearchRelationshipNodeInput = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly sector: string;
    readonly providers: readonly string[];
};

export type ResearchRelationshipEdge = {
    readonly id: string;
    readonly left: string;
    readonly right: string;
    readonly sharedSector: string | null;
    readonly sharedProviders: readonly string[];
    readonly strength: number;
};

export type ResearchRelationshipGraph = {
    readonly nodes: readonly ResearchRelationshipNodeInput[];
    readonly edges: readonly ResearchRelationshipEdge[];
};

const normalizeProvider = (value: string) => value.trim().replace(/\s+/g, ' ');

export const buildResearchRelationshipGraph = (
    inputs: readonly ResearchRelationshipNodeInput[],
): ResearchRelationshipGraph => {
    const nodes = inputs
        .map((input) => ({
            ...input,
            symbol: input.symbol.trim().toUpperCase(),
            sector: input.sector.trim() || 'Unknown',
            providers: [...new Set(input.providers.map(normalizeProvider).filter(Boolean))].sort(),
        }))
        .filter((node, index, all) => node.symbol && all.findIndex((candidate) => candidate.symbol === node.symbol) === index)
        .sort((left, right) => left.symbol.localeCompare(right.symbol));
    const edges: ResearchRelationshipEdge[] = [];
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
            const left = nodes[leftIndex]!;
            const right = nodes[rightIndex]!;
            const sharedSector = left.sector !== 'Unknown' && left.sector === right.sector ? left.sector : null;
            const sharedProviders = left.providers.filter((provider) => right.providers.includes(provider));
            if (!sharedSector && sharedProviders.length === 0) continue;
            edges.push({
                id: `${left.symbol}:${right.symbol}`,
                left: left.symbol,
                right: right.symbol,
                sharedSector,
                sharedProviders,
                strength: (sharedSector ? 1 : 0) + sharedProviders.length,
            });
        }
    }
    return {
        nodes,
        edges: edges.sort((left, right) => right.strength - left.strength || left.id.localeCompare(right.id)),
    };
};

export const relationshipsForSymbol = (
    graph: ResearchRelationshipGraph,
    symbol: string,
): readonly ResearchRelationshipEdge[] =>
    graph.edges.filter((edge) => edge.left === symbol || edge.right === symbol);
