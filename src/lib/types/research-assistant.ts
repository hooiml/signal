import type {
    ResearchEvidence,
    ResearchFindingTarget,
    ResearchFindingTone,
    ResearchMarket,
    ResearchSynthesisMode,
} from './research';

export { researchFindingTargets } from './research';
export type { ResearchEvidence, ResearchFindingTarget, ResearchFindingTone } from './research';

export type ResearchFinding = {
    readonly id: string;
    readonly title: string;
    readonly summary: string;
    readonly target: ResearchFindingTarget;
    readonly tone: ResearchFindingTone;
    readonly evidenceIds: readonly string[];
};

export type AssistedResearch = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly generatedAt: string;
    readonly mode: ResearchSynthesisMode;
    readonly findings: readonly ResearchFinding[];
    readonly evidence: readonly ResearchEvidence[];
    readonly warnings: readonly string[];
};
