import type { DiscoveryCatalyst } from '../types/research-discovery';
import type { AlertMarketState, ResearchAlertEvaluation } from '../types/research-alert';
import type { ResearchInboxInput, ResearchInboxItem, ResearchInboxResponse } from '../types/research-inbox';
import { evaluateResearchAlertBatch } from './alert-service';
import { parseBuyZone } from './alerts';

const DAY_MS = 24 * 60 * 60 * 1000;

const daysBetween = (earlier: string, later: Date): number =>
    Math.floor((later.getTime() - new Date(`${earlier}T00:00:00Z`).getTime()) / DAY_MS);

const daysUntil = (date: string, now: Date): number =>
    Math.max(0, Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - now.getTime()) / DAY_MS));

const item = (input: ResearchInboxInput, values: Pick<ResearchInboxItem, 'id' | 'kind' | 'title' | 'detail' | 'proximity'>): ResearchInboxItem => ({
    ...values,
    symbol: input.symbol,
    urgency: 'action',
    source: 'Yahoo Finance',
    eventDate: null,
    structuredTriggerRuleId: null,
});

const marketItems = (input: ResearchInboxInput, state: AlertMarketState | null): readonly ResearchInboxItem[] => {
    if (!state) return [];
    const items: ResearchInboxItem[] = [];
    const zone = parseBuyZone(input.targetBuyZone);
    if (state.dailyChangePercent !== null && Math.abs(state.dailyChangePercent) >= 8) items.push(item(input, {
        id: `${input.symbol}-risk-Large daily move`, kind: 'risk', title: 'Large daily move',
        detail: `Daily move is ${state.dailyChangePercent > 0 ? '+' : ''}${state.dailyChangePercent.toFixed(1)}%. Review the catalyst before acting.`,
        proximity: `${state.dailyChangePercent > 0 ? '+' : ''}${state.dailyChangePercent.toFixed(1)}% today`,
    }));
    if (input.monitoringRules.buyZone && zone && state.price >= zone[0] && state.price <= zone[1]) items.push(item(input, {
        id: `${input.symbol}-opportunity-Inside buy zone`, kind: 'opportunity', title: 'Inside buy zone',
        detail: `Price ${state.price.toFixed(2)} is inside ${zone[0].toFixed(2)}-${zone[1].toFixed(2)}.`, proximity: 'Inside saved buy zone',
    }));
    if (input.monitoringRules.belowMa200 && state.ma200 !== null && state.price < state.ma200) items.push(item(input, {
        id: `${input.symbol}-risk-Below 200-day average`, kind: 'risk', title: 'Below 200-day average',
        detail: `Price ${state.price.toFixed(2)} is below the long-term average ${state.ma200.toFixed(2)}.`,
        proximity: `${(((state.ma200 - state.price) / state.ma200) * 100).toFixed(1)}% below MA200`,
    }));
    const lowerRsi = input.monitoringRules.rsiBelow;
    if (lowerRsi !== null && state.rsi14 !== null && state.rsi14 <= lowerRsi) items.push(item(input, {
        id: `${input.symbol}-opportunity-RSI below ${lowerRsi}`, kind: 'opportunity', title: `RSI below ${lowerRsi}`,
        detail: `RSI is ${state.rsi14.toFixed(1)}. Confirm fundamentals and the cause of weakness.`,
        proximity: `RSI ${state.rsi14.toFixed(1)} · ${(lowerRsi - state.rsi14).toFixed(1)} points below ${lowerRsi}`,
    }));
    const upperRsi = input.monitoringRules.rsiAbove;
    if (upperRsi !== null && state.rsi14 !== null && state.rsi14 >= upperRsi) items.push(item(input, {
        id: `${input.symbol}-risk-RSI above ${upperRsi}`, kind: 'risk', title: `RSI above ${upperRsi}`,
        detail: `RSI is ${state.rsi14.toFixed(1)}. Review whether momentum has outrun the thesis.`,
        proximity: `RSI ${state.rsi14.toFixed(1)} · ${(state.rsi14 - upperRsi).toFixed(1)} points above ${upperRsi}`,
    }));
    return items.sort((left, right) => (left.kind === 'risk' ? 0 : 1) - (right.kind === 'risk' ? 0 : 1));
};

const catalystItem = (input: ResearchInboxInput, catalyst: DiscoveryCatalyst, now: Date): ResearchInboxItem => ({
    id: `${input.symbol}-earnings-${catalyst.date}`, symbol: input.symbol, kind: 'catalyst', urgency: 'upcoming', title: 'Earnings approaching',
    detail: `Scheduled ${catalyst.timing === 'time-not-supplied' ? 'time not supplied' : catalyst.timing}${catalyst.fiscalQuarterEnding ? ` · quarter ending ${catalyst.fiscalQuarterEnding}` : ''}.`,
    proximity: `${daysUntil(catalyst.date, now)} days away`, source: catalyst.source, eventDate: catalyst.date, structuredTriggerRuleId: null,
});

const staleItem = (input: ResearchInboxInput, ageDays: number): ResearchInboxItem => ({
    id: `${input.symbol}-stale-${input.lastReviewedAt}`, symbol: input.symbol, kind: 'stale', urgency: 'action', title: 'Research review is stale',
    detail: `Last reviewed ${ageDays} days ago. Recheck the thesis, valuation, and invalidation conditions.`, proximity: `${ageDays} days since review`,
    source: 'Research journal', eventDate: null, structuredTriggerRuleId: null,
});

const structuredTriggerItems = (
    input: ResearchInboxInput,
    evaluation: ResearchAlertEvaluation,
): readonly ResearchInboxItem[] => evaluation.structuredTriggers.flatMap((trigger) => {
    if (trigger.status !== 'matched') return [];
    const kind = trigger.rule.purpose === 'thesis-invalidation'
        ? 'risk' as const
        : trigger.rule.purpose === 'opportunity-review'
            ? 'opportunity' as const
            : 'stale' as const;
    return [{
        id: `${input.symbol}-structured-${trigger.rule.id}`,
        symbol: input.symbol,
        kind,
        urgency: trigger.rule.purpose === 'scheduled-evidence-review' ? 'upcoming' as const : 'action' as const,
        title: trigger.title,
        detail: trigger.detail,
        proximity: trigger.observed?.label ?? 'Matched',
        source: 'Structured trigger' as const,
        eventDate: trigger.rule.metric === 'earnings-within-days' ? trigger.observed?.observedAt?.slice(0, 10) ?? null : null,
        structuredTriggerRuleId: trigger.rule.id,
    }];
});

export const buildResearchInboxItems = (
    context: {
        readonly inputs: readonly ResearchInboxInput[];
        readonly evaluations: readonly ResearchAlertEvaluation[];
        readonly catalysts: ReadonlyMap<string, DiscoveryCatalyst>;
        readonly now: Date;
    },
): readonly ResearchInboxItem[] => {
    const { inputs, evaluations, catalysts, now } = context;
    const inputBySymbol = new Map(inputs.map((input) => [input.symbol, input]));
    const alertItems = evaluations.flatMap((evaluation) => {
        const input = inputBySymbol.get(evaluation.input.symbol);
        return input ? [...marketItems(input, evaluation.state), ...structuredTriggerItems(input, evaluation)] : [];
    });
    const staleItems = inputs.flatMap((input) => {
        const ageDays = daysBetween(input.lastReviewedAt, now);
        return input.monitoringRules.reviewAgeDays !== null && ageDays > input.monitoringRules.reviewAgeDays ? [staleItem(input, ageDays)] : [];
    });
    const catalystItems = [...catalysts.entries()].flatMap(([symbol, catalyst]) => {
        const input = inputBySymbol.get(symbol);
        if (!input || input.monitoringRules.earningsWithinDays === null || daysUntil(catalyst.date, now) > input.monitoringRules.earningsWithinDays) return [];
        return [catalystItem(input, catalyst, now)];
    }).sort((left, right) => (left.eventDate ?? '').localeCompare(right.eventDate ?? ''));
    return [...alertItems, ...staleItems, ...catalystItems];
};

export const getResearchInbox = async (inputs: readonly ResearchInboxInput[]): Promise<ResearchInboxResponse> => {
    const evaluationsResult = await Promise.allSettled([evaluateResearchAlertBatch(inputs)]);
    const evaluations = evaluationsResult[0].status === 'fulfilled' ? evaluationsResult[0].value.evaluations : [];
    const failedCount = evaluations.filter((result) => result.failed).length;
    const catalysts = new Map(evaluations.flatMap((evaluation) => evaluation.catalyst
        ? [[evaluation.input.symbol, evaluation.catalyst] as const]
        : []));
    const warnings = [
        ...(evaluationsResult[0].status === 'rejected' ? ['Price, technical, and structured-trigger conditions are temporarily unavailable.'] : []),
        ...(failedCount > 0 ? [`${failedCount} tickers were unavailable and excluded.`] : []),
        ...(evaluationsResult[0].status === 'fulfilled' ? evaluationsResult[0].value.warnings : []),
    ];
    const generatedAt = new Date();
    return {
        generatedAt: generatedAt.toISOString(),
        monitoredCount: evaluationsResult[0].status === 'fulfilled' ? inputs.length - failedCount : 0,
        items: buildResearchInboxItems({ inputs, evaluations, catalysts, now: generatedAt }),
        warnings,
    };
};
