import type {
    AlertTickerInput,
    ResearchAlert,
    ResearchAlertEvaluation,
    ResearchAlertsResponse,
} from '../types/research-alert';
import { evaluateResearchAlerts } from './alerts';
import { fetchUpcomingCatalysts } from './catalysts';
import { getResearchSnapshot } from './snapshot';
import {
    evaluateResearchStructuredTriggers,
    type ResearchStructuredTriggerProviderStatus,
} from './structured-triggers';

type ResearchAlertEvaluationBatch = {
    readonly evaluations: readonly ResearchAlertEvaluation[];
    readonly warnings: readonly string[];
};

const hasEnabledEarningsRule = (input: AlertTickerInput) =>
    input.monitoringRules.earningsWithinDays !== null
    || input.monitoringRules.structuredTriggers.rules.some((rule) =>
        rule.enabled && rule.metric === 'earnings-within-days');

const structuredAlerts = (
    symbol: string,
    evaluations: ResearchAlertEvaluation['structuredTriggers'],
): readonly ResearchAlert[] => evaluations.flatMap((evaluation) => evaluation.status === 'matched' ? [{
    id: `${symbol}-structured-${evaluation.rule.id}`,
    symbol,
    kind: 'structured-trigger' as const,
    severity: evaluation.severity,
    title: evaluation.title,
    detail: evaluation.detail,
    structuredTrigger: evaluation,
}] : []);

const evaluateTicker = async (
    input: AlertTickerInput,
    catalyst: Parameters<typeof evaluateResearchStructuredTriggers>[0]['catalyst'],
    earningsStatus: ResearchStructuredTriggerProviderStatus,
    now: Date,
): Promise<ResearchAlertEvaluation> => {
    try {
        const snapshot = await getResearchSnapshot(input.symbol, input.market);
        const state = snapshot.quote.price === null ? null : {
            price: snapshot.quote.price,
            dailyChangePercent: snapshot.quote.dailyChangePercent,
            ma50: snapshot.technicals.ma50,
            ma200: snapshot.technicals.ma200,
            rsi14: snapshot.technicals.rsi14,
        };
        const structuredTriggers = evaluateResearchStructuredTriggers({
            record: input,
            snapshot,
            snapshotStatus: snapshot.warnings.length > 0 ? 'degraded' : 'available',
            catalyst,
            earningsStatus,
            now,
        });
        return {
            input,
            state,
            alerts: [
                ...(state ? evaluateResearchAlerts(input.symbol, input.targetBuyZone, state) : []),
                ...structuredAlerts(input.symbol, structuredTriggers),
            ],
            structuredTriggers,
            catalyst,
            failed: state === null,
        };
    } catch (error) {
        if (!(error instanceof Error)) throw error;
        const structuredTriggers = evaluateResearchStructuredTriggers({
            record: input,
            snapshot: null,
            snapshotStatus: 'unavailable',
            catalyst,
            earningsStatus,
            now,
        });
        return {
            input,
            state: null,
            alerts: structuredAlerts(input.symbol, structuredTriggers),
            structuredTriggers,
            catalyst,
            failed: true,
        };
    }
};

export const evaluateResearchAlertBatch = async (
    inputs: readonly AlertTickerInput[],
): Promise<ResearchAlertEvaluationBatch> => {
    const now = new Date();
    const earningsInputs = inputs.filter((input) => input.market === 'US' && hasEnabledEarningsRule(input));
    const catalystResult = await Promise.allSettled([
        earningsInputs.length > 0
            ? fetchUpcomingCatalysts(earningsInputs.map((input) => input.symbol), 90, now)
            : Promise.resolve(new Map()),
    ]);
    const catalysts = catalystResult[0].status === 'fulfilled'
        ? catalystResult[0].value
        : new Map();
    const usEarningsStatus: ResearchStructuredTriggerProviderStatus = catalystResult[0].status === 'fulfilled'
        ? 'available'
        : 'unavailable';
    const results: ResearchAlertEvaluation[] = [];
    for (let index = 0; index < inputs.length; index += 6) {
        results.push(...await Promise.all(inputs.slice(index, index + 6).map((input) =>
            evaluateTicker(
                input,
                catalysts.get(input.symbol) ?? null,
                input.market === 'US' ? usEarningsStatus : 'unavailable',
                now,
            ))));
    }
    const failedCount = results.filter((result) => result.failed).length;
    const unavailableTriggerCount = results.flatMap((result) => result.structuredTriggers)
        .filter((evaluation) => evaluation.status === 'unavailable').length;
    return {
        evaluations: results,
        warnings: [
            ...(failedCount > 0 ? [`${failedCount} tickers have unavailable current price or technical coverage.`] : []),
            ...(catalystResult[0].status === 'rejected' ? ['Upcoming earnings coverage is temporarily unavailable.'] : []),
            ...(unavailableTriggerCount > 0 ? [`${unavailableTriggerCount} structured triggers are unavailable because required evidence is missing, stale, or provider-degraded.`] : []),
        ],
    };
};

export const evaluateResearchTickers = async (
    inputs: readonly AlertTickerInput[],
): Promise<readonly ResearchAlertEvaluation[]> => (await evaluateResearchAlertBatch(inputs)).evaluations;

export const getResearchAlerts = async (inputs: readonly AlertTickerInput[]): Promise<ResearchAlertsResponse> => {
    const { evaluations, warnings } = await evaluateResearchAlertBatch(inputs);
    const failedCount = evaluations.filter((result) => result.failed).length;
    const priority = { risk: 0, opportunity: 1, watch: 2 } as const;
    return {
        generatedAt: new Date().toISOString(),
        monitoredCount: inputs.length - failedCount,
        alerts: evaluations.flatMap((result) => result.alerts)
            .sort((left, right) => priority[left.severity] - priority[right.severity] || left.id.localeCompare(right.id)),
        triggerCoverage: evaluations.flatMap((result) => result.structuredTriggers),
        warnings,
    };
};
