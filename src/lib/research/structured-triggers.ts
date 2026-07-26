import type { DiscoveryCatalyst } from '../types/research-discovery';
import type {
    AcceptedResearchEvidence,
    ResearchRecord,
    ResearchStructuredTriggerMetric,
    ResearchStructuredTriggerOperator,
    ResearchStructuredTriggerPurpose,
    ResearchStructuredTriggerRule,
    ResearchStructuredTriggerSet,
} from '../types/research';
import type { ResearchSnapshot } from '../types/research-snapshot';

export const researchStructuredTriggerLimit = 10;

export type ResearchStructuredTriggerDefinition = {
    readonly metric: ResearchStructuredTriggerMetric;
    readonly label: string;
    readonly unit: 'price' | 'rsi' | 'percent' | 'days' | 'ratio';
    readonly operators: readonly ResearchStructuredTriggerOperator[];
    readonly minimum: number;
    readonly maximum: number;
    readonly integer: boolean;
};

export const researchStructuredTriggerDefinitions: readonly ResearchStructuredTriggerDefinition[] = [
    { metric: 'price', label: 'Price', unit: 'price', operators: ['above', 'below'], minimum: 0.0001, maximum: 1_000_000_000, integer: false },
    { metric: 'rsi14', label: 'RSI (14)', unit: 'rsi', operators: ['above', 'below'], minimum: 0, maximum: 100, integer: false },
    { metric: 'price-vs-ma50-percent', label: 'Price vs MA50', unit: 'percent', operators: ['above', 'below'], minimum: -100, maximum: 1_000, integer: false },
    { metric: 'price-vs-ma200-percent', label: 'Price vs MA200', unit: 'percent', operators: ['above', 'below'], minimum: -100, maximum: 1_000, integer: false },
    { metric: 'earnings-within-days', label: 'Earnings date', unit: 'days', operators: ['within'], minimum: 0, maximum: 90, integer: true },
    { metric: 'research-age-days', label: 'Research age', unit: 'days', operators: ['above'], minimum: 1, maximum: 3_650, integer: true },
    { metric: 'evidence-age-days', label: 'Latest evidence age', unit: 'days', operators: ['above'], minimum: 1, maximum: 3_650, integer: true },
    { metric: 'price-earnings', label: 'Price / earnings', unit: 'ratio', operators: ['above', 'below'], minimum: 0, maximum: 1_000, integer: false },
    { metric: 'free-cash-flow-yield-percent', label: 'Free-cash-flow yield', unit: 'percent', operators: ['above', 'below'], minimum: -100, maximum: 1_000, integer: false },
    { metric: 'revenue-growth-percent', label: 'Annual revenue growth', unit: 'percent', operators: ['above', 'below'], minimum: -100, maximum: 1_000, integer: false },
];

export class ResearchStructuredTriggerError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchStructuredTriggerError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const definitionFor = (metric: ResearchStructuredTriggerMetric): ResearchStructuredTriggerDefinition =>
    researchStructuredTriggerDefinitions.find((definition) => definition.metric === metric)
    ?? researchStructuredTriggerDefinitions[0];

const purposeValue = (value: unknown, label: string): ResearchStructuredTriggerPurpose => {
    if (value === 'thesis-invalidation' || value === 'opportunity-review' || value === 'scheduled-evidence-review') return value;
    throw new ResearchStructuredTriggerError(`${label}.purpose is invalid.`);
};

const metricValue = (value: unknown, label: string): ResearchStructuredTriggerMetric => {
    const definition = researchStructuredTriggerDefinitions.find((candidate) => candidate.metric === value);
    if (definition) return definition.metric;
    throw new ResearchStructuredTriggerError(`${label}.metric is invalid.`);
};

const operatorValue = (
    value: unknown,
    definition: ResearchStructuredTriggerDefinition,
    label: string,
): ResearchStructuredTriggerOperator => {
    if ((value === 'above' || value === 'below' || value === 'within') && definition.operators.includes(value)) return value;
    throw new ResearchStructuredTriggerError(`${label}.operator is not supported for ${definition.label}.`);
};

const parseRule = (value: unknown, index: number): ResearchStructuredTriggerRule => {
    const label = `structuredTriggers.rules[${index}]`;
    if (!isRecord(value)) throw new ResearchStructuredTriggerError(`${label} must be an object.`);
    if (typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.id)) {
        throw new ResearchStructuredTriggerError(`${label}.id must contain 1-80 letters, numbers, underscores, or hyphens.`);
    }
    if (typeof value.enabled !== 'boolean') throw new ResearchStructuredTriggerError(`${label}.enabled must be boolean.`);
    const metric = metricValue(value.metric, label);
    const definition = definitionFor(metric);
    const threshold = value.threshold;
    if (typeof threshold !== 'number' || !Number.isFinite(threshold)
        || threshold < definition.minimum || threshold > definition.maximum
        || definition.integer && !Number.isInteger(threshold)) {
        const numberKind = definition.integer ? 'whole number' : 'finite number';
        throw new ResearchStructuredTriggerError(`${label}.threshold must be a ${numberKind} from ${definition.minimum}-${definition.maximum}.`);
    }
    return {
        id: value.id,
        enabled: value.enabled,
        purpose: purposeValue(value.purpose, label),
        metric,
        operator: operatorValue(value.operator, definition, label),
        threshold,
    };
};

export const parseResearchStructuredTriggerSet = (value: unknown): ResearchStructuredTriggerSet => {
    if (!isRecord(value)) throw new ResearchStructuredTriggerError('structuredTriggers must be an object.');
    if (value.version !== 1) throw new ResearchStructuredTriggerError('structuredTriggers.version must be 1.');
    if (!Array.isArray(value.rules)) throw new ResearchStructuredTriggerError('structuredTriggers.rules must be an array.');
    if (value.rules.length > researchStructuredTriggerLimit) {
        throw new ResearchStructuredTriggerError(`structuredTriggers.rules must contain at most ${researchStructuredTriggerLimit} rules.`);
    }
    const rules = value.rules.map(parseRule);
    if (new Set(rules.map((rule) => rule.id)).size !== rules.length) {
        throw new ResearchStructuredTriggerError('structuredTriggers.rules contains duplicate rule ids.');
    }
    const semanticKeys = rules.map((rule) => `${rule.metric}|${rule.operator}|${rule.threshold}`);
    if (new Set(semanticKeys).size !== semanticKeys.length) {
        throw new ResearchStructuredTriggerError('structuredTriggers.rules contains duplicate metric, operator, and threshold conditions.');
    }
    const migrationState = value.migrationState === 'migrated-empty' || value.migrationState === 'invalid-recovered'
        ? value.migrationState
        : 'current';
    return { version: 1, migrationState, rules };
};

export const migrateResearchStructuredTriggerSet = (
    value: unknown,
): ResearchStructuredTriggerSet => {
    if (value === undefined) return { version: 1, migrationState: 'migrated-empty', rules: [] };
    try {
        return parseResearchStructuredTriggerSet(value);
    } catch {
        return { version: 1, migrationState: 'invalid-recovered', rules: [] };
    }
};

export type ResearchStructuredTriggerProviderStatus = 'available' | 'degraded' | 'unavailable';
export type ResearchStructuredTriggerEvaluationStatus = 'matched' | 'not-matched' | 'unavailable' | 'disabled';

export type ResearchStructuredTriggerObserved = {
    readonly value: number | null;
    readonly label: string;
    readonly observedAt: string | null;
    readonly source: string;
    readonly freshness: string;
};

export type ResearchStructuredTriggerEvaluation = {
    readonly symbol: string;
    readonly rule: ResearchStructuredTriggerRule;
    readonly status: ResearchStructuredTriggerEvaluationStatus;
    readonly severity: 'risk' | 'opportunity' | 'watch';
    readonly title: string;
    readonly detail: string;
    readonly observed: ResearchStructuredTriggerObserved | null;
};

export type ResearchStructuredTriggerContext = {
    readonly record: Pick<ResearchRecord, 'symbol' | 'lastReviewedAt' | 'acceptedEvidence' | 'monitoringRules'>;
    readonly snapshot: ResearchSnapshot | null;
    readonly snapshotStatus: ResearchStructuredTriggerProviderStatus;
    readonly catalyst: DiscoveryCatalyst | null;
    readonly earningsStatus: ResearchStructuredTriggerProviderStatus;
    readonly now: Date;
};

const DAY_MS = 86_400_000;
const snapshotFreshnessDays = 4;
const annualFundamentalFreshnessDays = 550;

const utcDay = (value: string): number | null => {
    const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value);
    return Number.isFinite(timestamp) ? Math.floor(timestamp / DAY_MS) : null;
};

const ageDays = (value: string, now: Date): number | null => {
    const basis = utcDay(value);
    return basis === null ? null : Math.max(0, Math.floor(now.getTime() / DAY_MS) - basis);
};

const evidenceBasisDate = (evidence: AcceptedResearchEvidence): string => {
    const periods = evidence.sources
        .map((source) => source.reportingPeriod)
        .filter((value): value is string => value !== null && utcDay(value) !== null)
        .sort();
    return periods.at(-1) ?? evidence.acceptedAt;
};

const latestEvidenceDate = (evidence: readonly AcceptedResearchEvidence[]): string | null =>
    evidence.map(evidenceBasisDate).sort().at(-1) ?? null;

const percentageFromAverage = (price: number | null, average: number | null): number | null =>
    price === null || average === null || average === 0
        ? null
        : Number((((price / average) - 1) * 100).toFixed(2));

const purposePresentation = (purpose: ResearchStructuredTriggerPurpose) => {
    if (purpose === 'thesis-invalidation') return { severity: 'risk' as const, title: 'Thesis invalidation review' };
    if (purpose === 'opportunity-review') return { severity: 'opportunity' as const, title: 'Opportunity review' };
    return { severity: 'watch' as const, title: 'Scheduled evidence review' };
};

const formatNumber = (value: number) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

const operatorLabel = (operator: ResearchStructuredTriggerOperator) =>
    operator === 'above' ? 'above' : operator === 'below' ? 'below' : 'within';

const thresholdLabel = (
    definition: ResearchStructuredTriggerDefinition,
    threshold: number,
    currency: string | null,
) => {
    const value = formatNumber(threshold);
    if (definition.unit === 'price') return `${value} ${currency ?? 'price units'}`;
    if (definition.unit === 'percent') return `${value}%`;
    if (definition.unit === 'days') return `${value} days`;
    if (definition.unit === 'rsi') return `${value} RSI points`;
    return `${value}x`;
};

const unavailable = (
    symbol: string,
    rule: ResearchStructuredTriggerRule,
    reason: string,
): ResearchStructuredTriggerEvaluation => {
    const presentation = purposePresentation(rule.purpose);
    const definition = definitionFor(rule.metric);
    return {
        symbol,
        rule,
        status: 'unavailable',
        ...presentation,
        observed: null,
        detail: `${definition.label} ${operatorLabel(rule.operator)} ${thresholdLabel(definition, rule.threshold, null)} could not be evaluated: ${reason}`,
    };
};

const observedMetric = (
    rule: ResearchStructuredTriggerRule,
    context: ResearchStructuredTriggerContext,
): ResearchStructuredTriggerObserved | null => {
    const { snapshot, now } = context;
    const snapshotAge = snapshot ? ageDays(snapshot.fetchedAt, now) : null;
    const snapshotAvailable = snapshot !== null && context.snapshotStatus !== 'unavailable'
        && snapshotAge !== null && snapshotAge <= snapshotFreshnessDays;
    const snapshotDate = snapshot?.fetchedAt ?? null;
    const snapshotFreshness = snapshotAge === null ? 'freshness unavailable' : `${snapshotAge} days old`;
    if (rule.metric === 'research-age-days') {
        const value = ageDays(context.record.lastReviewedAt, now);
        return value === null ? null : {
            value,
            label: `${value} days`,
            observedAt: context.record.lastReviewedAt,
            source: 'Research journal',
            freshness: `reviewed ${context.record.lastReviewedAt}`,
        };
    }
    if (rule.metric === 'evidence-age-days') {
        const basis = latestEvidenceDate(context.record.acceptedEvidence);
        const value = basis ? ageDays(basis, now) : null;
        return basis === null || value === null ? null : {
            value,
            label: `${value} days`,
            observedAt: basis,
            source: 'Accepted evidence',
            freshness: `latest dated evidence ${basis.slice(0, 10)}`,
        };
    }
    if (rule.metric === 'earnings-within-days') {
        if (context.earningsStatus === 'unavailable') return null;
        if (!context.catalyst) return {
            value: null,
            label: 'No earnings date found in the 90-day coverage window',
            observedAt: now.toISOString(),
            source: 'Nasdaq earnings calendar',
            freshness: context.earningsStatus === 'degraded' ? 'provider coverage degraded' : 'current 90-day scan',
        };
        const value = Math.max(0, Math.ceil((Date.parse(`${context.catalyst.date}T00:00:00.000Z`) - now.getTime()) / DAY_MS));
        return {
            value,
            label: `${value} days`,
            observedAt: context.catalyst.date,
            source: context.catalyst.source,
            freshness: `scheduled ${context.catalyst.date}`,
        };
    }
    if (!snapshotAvailable || !snapshot) return null;
    if (rule.metric === 'price') {
        const value = snapshot.quote.price;
        return value === null ? null : { value, label: `${formatNumber(value)} ${snapshot.quote.currency ?? 'price units'}`, observedAt: snapshotDate, source: 'Yahoo Finance', freshness: snapshotFreshness };
    }
    if (rule.metric === 'rsi14') {
        const value = snapshot.technicals.rsi14;
        return value === null ? null : { value, label: `${formatNumber(value)} RSI points`, observedAt: snapshotDate, source: 'Yahoo Finance', freshness: snapshotFreshness };
    }
    if (rule.metric === 'price-vs-ma50-percent' || rule.metric === 'price-vs-ma200-percent') {
        const average = rule.metric === 'price-vs-ma50-percent' ? snapshot.technicals.ma50 : snapshot.technicals.ma200;
        const value = percentageFromAverage(snapshot.quote.price, average);
        return value === null ? null : { value, label: `${formatNumber(value)}%`, observedAt: snapshotDate, source: 'Yahoo Finance', freshness: snapshotFreshness };
    }
    const reportingPeriod = rule.metric === 'revenue-growth-percent'
        ? snapshot.fundamentals.reportingPeriod
        : snapshot.valuation.reportingPeriod;
    const reportingAge = reportingPeriod ? ageDays(reportingPeriod, now) : null;
    if (!reportingPeriod || reportingAge === null || reportingAge > annualFundamentalFreshnessDays) return null;
    if (rule.metric === 'revenue-growth-percent') {
        const value = snapshot.fundamentals.revenueGrowthPercent;
        const source = snapshot.fundamentals.source;
        return value === null || source === null ? null : {
            value,
            label: `${formatNumber(value)}%`,
            observedAt: reportingPeriod,
            source,
            freshness: `annual period ${reportingPeriod}`,
        };
    }
    const value = rule.metric === 'price-earnings'
        ? snapshot.valuation.priceEarnings
        : snapshot.valuation.freeCashFlowYieldPercent;
    return value === null || snapshot.valuation.source === null ? null : {
        value,
        label: rule.metric === 'price-earnings' ? `${formatNumber(value)}x` : `${formatNumber(value)}%`,
        observedAt: reportingPeriod,
        source: snapshot.valuation.source,
        freshness: `current price with annual period ${reportingPeriod}`,
    };
};

const matches = (operator: ResearchStructuredTriggerOperator, observed: number, threshold: number) =>
    operator === 'above' ? observed > threshold : operator === 'below' ? observed < threshold : observed <= threshold;

const missingReason = (rule: ResearchStructuredTriggerRule, context: ResearchStructuredTriggerContext) => {
    if (rule.metric === 'earnings-within-days') return context.earningsStatus === 'unavailable'
        ? 'the earnings provider is unavailable'
        : 'no trustworthy earnings observation is available';
    if (rule.metric === 'evidence-age-days') return 'no dated accepted evidence is available';
    if (rule.metric === 'research-age-days') return 'the saved review date is invalid';
    if (!context.snapshot) return 'the current research snapshot is unavailable';
    const snapshotAge = ageDays(context.snapshot.fetchedAt, context.now);
    if (snapshotAge === null || snapshotAge > snapshotFreshnessDays) return 'the current research snapshot is stale';
    if (rule.metric === 'price-earnings' || rule.metric === 'free-cash-flow-yield-percent' || rule.metric === 'revenue-growth-percent') {
        return context.snapshotStatus === 'degraded'
            ? 'the required period-correct provider input is degraded or missing'
            : 'the required period-correct value or provenance is unavailable';
    }
    return 'the required current metric is unavailable';
};

export const evaluateResearchStructuredTriggers = (
    context: ResearchStructuredTriggerContext,
): readonly ResearchStructuredTriggerEvaluation[] => context.record.monitoringRules.structuredTriggers.rules.map((rule) => {
    const presentation = purposePresentation(rule.purpose);
    const definition = definitionFor(rule.metric);
    if (!rule.enabled) return {
        symbol: context.record.symbol,
        rule,
        status: 'disabled' as const,
        ...presentation,
        observed: null,
        detail: `${definition.label} ${operatorLabel(rule.operator)} ${thresholdLabel(definition, rule.threshold, context.snapshot?.quote.currency ?? null)} is disabled.`,
    };
    const observed = observedMetric(rule, context);
    if (!observed) return unavailable(context.record.symbol, rule, missingReason(rule, context));
    const didMatch = observed.value !== null && matches(rule.operator, observed.value, rule.threshold);
    const threshold = thresholdLabel(definition, rule.threshold, context.snapshot?.quote.currency ?? null);
    return {
        symbol: context.record.symbol,
        rule,
        status: didMatch ? 'matched' : 'not-matched',
        ...presentation,
        observed,
        detail: `${definition.label} ${operatorLabel(rule.operator)} ${threshold}; observed ${observed.label} on ${observed.observedAt?.slice(0, 10) ?? 'date unavailable'} from ${observed.source} (${observed.freshness}).`,
    };
});

export const structuredTriggerDefinition = definitionFor;
