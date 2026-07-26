import type { ResearchMarket } from '../types/research';

export const paperDecisionLimit = 100;

export type PaperDecisionAction = 'act' | 'pass';

export type PaperDecision = {
    readonly id: string;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly action: PaperDecisionAction;
    readonly decisionPrice: number;
    readonly note: string;
    readonly recordedAt: string;
    readonly outcomePrice: number | null;
    readonly resolvedAt: string | null;
};

const finitePositive = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value > 0;

const parsePaperDecision = (value: unknown): PaperDecision | null => {
    if (!value || typeof value !== 'object') return null;
    const candidate = value as Partial<PaperDecision>;
    const symbol = typeof candidate.symbol === 'string' ? candidate.symbol.trim().toUpperCase().slice(0, 12) : '';
    if (
        typeof candidate.id !== 'string'
        || !symbol
        || (candidate.market !== 'US' && candidate.market !== 'MY')
        || (candidate.action !== 'act' && candidate.action !== 'pass')
        || !finitePositive(candidate.decisionPrice)
        || typeof candidate.recordedAt !== 'string'
    ) return null;
    const outcomePrice = candidate.outcomePrice === null || candidate.outcomePrice === undefined
        ? null
        : finitePositive(candidate.outcomePrice) ? candidate.outcomePrice : null;
    return {
        id: candidate.id.slice(0, 100),
        symbol,
        market: candidate.market,
        action: candidate.action,
        decisionPrice: candidate.decisionPrice,
        note: typeof candidate.note === 'string' ? candidate.note.trim().slice(0, 240) : '',
        recordedAt: candidate.recordedAt,
        outcomePrice,
        resolvedAt: outcomePrice && typeof candidate.resolvedAt === 'string' ? candidate.resolvedAt : null,
    };
};

export const parsePaperDecisions = (value: unknown): readonly PaperDecision[] => {
    if (!Array.isArray(value)) return [];
    const byId = new Map<string, PaperDecision>();
    for (const entry of value) {
        const parsed = parsePaperDecision(entry);
        if (parsed) byId.set(parsed.id, parsed);
    }
    return [...byId.values()]
        .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt))
        .slice(0, paperDecisionLimit);
};

export const addPaperDecision = (
    decisions: readonly PaperDecision[],
    decision: PaperDecision,
): readonly PaperDecision[] => parsePaperDecisions([decision, ...decisions]);

export const resolvePaperDecision = (
    decisions: readonly PaperDecision[],
    id: string,
    outcomePrice: number,
    resolvedAt: string,
): readonly PaperDecision[] => parsePaperDecisions(decisions.map((decision) =>
    decision.id === id ? { ...decision, outcomePrice, resolvedAt } : decision));

export const removePaperDecision = (
    decisions: readonly PaperDecision[],
    id: string,
): readonly PaperDecision[] => decisions.filter((decision) => decision.id !== id);

export const paperDecisionMarketMovePercent = (decision: PaperDecision): number | null =>
    decision.outcomePrice === null
        ? null
        : Number((((decision.outcomePrice - decision.decisionPrice) / decision.decisionPrice) * 100).toFixed(2));
