export const researchExpectationEventTypes = ['earnings', 'guidance', 'macro', 'product', 'other'] as const;
export const researchExpectationStatuses = ['pre-event', 'reported', 'reviewed'] as const;
export const researchExpectationImportance = ['primary', 'secondary'] as const;

export type ResearchExpectationEventType = typeof researchExpectationEventTypes[number];
export type ResearchExpectationStatus = typeof researchExpectationStatuses[number];
export type ResearchExpectationImportance = typeof researchExpectationImportance[number];

export type ResearchExpectationMetric = {
    readonly id: string;
    readonly label: string;
    readonly unit: string;
    readonly expected: number | null;
    readonly actual: number | null;
    readonly importance: ResearchExpectationImportance;
    readonly higherIsBetter: boolean;
};

export type ResearchExpectationEvent = {
    readonly id: string;
    readonly ticker: string;
    readonly eventType: ResearchExpectationEventType;
    readonly title: string;
    readonly eventDate: string;
    readonly status: ResearchExpectationStatus;
    readonly metrics: readonly ResearchExpectationMetric[];
    readonly expectedNarrative: string;
    readonly actualNarrative: string;
    readonly reactionPercent: number | null;
    readonly reactionWindow: string;
    readonly interpretation: string;
    readonly capturedAt: string;
    readonly updatedAt: string;
};

export type ResearchExpectationMetricOutcome = ResearchExpectationMetric & {
    readonly outcome: 'beat' | 'miss' | 'in-line' | 'pending';
    readonly variancePercent: number | null;
};

export type ResearchExpectationComparison = {
    readonly event: ResearchExpectationEvent;
    readonly metrics: readonly ResearchExpectationMetricOutcome[];
    readonly completedCount: number;
    readonly beatCount: number;
    readonly missCount: number;
    readonly inlineCount: number;
    readonly primaryOutcome: 'beat' | 'miss' | 'mixed' | 'in-line' | 'pending';
    readonly reactionDivergence: 'positive-results-negative-reaction' | 'negative-results-positive-reaction' | 'aligned' | 'unknown';
};

const tickerPattern = /^[A-Z0-9.-]{1,20}$/;
const idPattern = /^[a-zA-Z0-9._:-]{1,100}$/;

const requiredText = (value: unknown, label: string, max = 200) => {
    if (typeof value !== 'string') throw new Error(`${label} is required.`);
    const normalized = value.trim();
    if (!normalized) throw new Error(`${label} is required.`);
    if (normalized.length > max) throw new Error(`${label} is too long.`);
    return normalized;
};

const optionalText = (value: unknown, max: number) => {
    if (value === undefined || value === null) return '';
    if (typeof value !== 'string') throw new Error('Invalid text value.');
    const normalized = value.trim();
    if (normalized.length > max) throw new Error('Text value is too long.');
    return normalized;
};

const nullableNumber = (value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('Metric values must be finite numbers.');
    return number;
};

const isoTimestamp = (value: unknown, label: string) => {
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(`Invalid ${label}.`);
    return new Date(value).toISOString();
};

const isoDate = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
        throw new Error('Invalid event date.');
    }
    return value;
};

export const parseResearchExpectationEvent = (input: unknown): ResearchExpectationEvent => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Invalid expectation event.');
    const raw = input as Record<string, unknown>;
    const ticker = requiredText(raw.ticker, 'Ticker', 20).toUpperCase();
    if (!tickerPattern.test(ticker)) throw new Error('Invalid ticker.');
    const id = requiredText(raw.id, 'Event id', 100);
    if (!idPattern.test(id)) throw new Error('Invalid event id.');
    if (!researchExpectationEventTypes.includes(raw.eventType as ResearchExpectationEventType)) throw new Error('Invalid event type.');
    if (!researchExpectationStatuses.includes(raw.status as ResearchExpectationStatus)) throw new Error('Invalid event status.');
    if (!Array.isArray(raw.metrics) || raw.metrics.length < 1 || raw.metrics.length > 8) throw new Error('Add between 1 and 8 expectation metrics.');
    const metrics = raw.metrics.map((item, index): ResearchExpectationMetric => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) throw new Error(`Invalid metric ${index + 1}.`);
        const metric = item as Record<string, unknown>;
        const metricId = requiredText(metric.id, `Metric ${index + 1} id`, 100);
        if (!idPattern.test(metricId)) throw new Error(`Invalid metric ${index + 1} id.`);
        if (!researchExpectationImportance.includes(metric.importance as ResearchExpectationImportance)) throw new Error(`Invalid metric ${index + 1} importance.`);
        return {
            id: metricId,
            label: requiredText(metric.label, `Metric ${index + 1} label`, 80),
            unit: optionalText(metric.unit, 20),
            expected: nullableNumber(metric.expected),
            actual: nullableNumber(metric.actual),
            importance: metric.importance as ResearchExpectationImportance,
            higherIsBetter: metric.higherIsBetter !== false,
        };
    });
    if (new Set(metrics.map((metric) => metric.id)).size !== metrics.length) throw new Error('Metric ids must be unique.');
    const reactionPercent = nullableNumber(raw.reactionPercent);
    if (reactionPercent !== null && Math.abs(reactionPercent) > 1000) throw new Error('Reaction percent is outside the supported range.');
    return {
        id,
        ticker,
        eventType: raw.eventType as ResearchExpectationEventType,
        title: requiredText(raw.title, 'Event title', 160),
        eventDate: isoDate(raw.eventDate),
        status: raw.status as ResearchExpectationStatus,
        metrics,
        expectedNarrative: optionalText(raw.expectedNarrative, 2000),
        actualNarrative: optionalText(raw.actualNarrative, 2000),
        reactionPercent,
        reactionWindow: optionalText(raw.reactionWindow, 80),
        interpretation: optionalText(raw.interpretation, 2000),
        capturedAt: isoTimestamp(raw.capturedAt, 'capturedAt'),
        updatedAt: isoTimestamp(raw.updatedAt, 'updatedAt'),
    };
};

const compareMetric = (metric: ResearchExpectationMetric): ResearchExpectationMetricOutcome => {
    if (metric.expected === null || metric.actual === null) return { ...metric, outcome: 'pending', variancePercent: null };
    const denominator = Math.abs(metric.expected);
    const variancePercent = denominator > 1e-9 ? ((metric.actual - metric.expected) / denominator) * 100 : null;
    const rawDifference = metric.actual - metric.expected;
    const tolerance = Math.max(0.000001, denominator * 0.005);
    if (Math.abs(rawDifference) <= tolerance) return { ...metric, outcome: 'in-line', variancePercent };
    const favorable = metric.higherIsBetter ? rawDifference > 0 : rawDifference < 0;
    return { ...metric, outcome: favorable ? 'beat' : 'miss', variancePercent };
};

export const compareResearchExpectationEvent = (input: ResearchExpectationEvent): ResearchExpectationComparison => {
    const event = parseResearchExpectationEvent(input);
    const metrics = event.metrics.map(compareMetric);
    const completed = metrics.filter((metric) => metric.outcome !== 'pending');
    const primary = completed.filter((metric) => metric.importance === 'primary');
    const scored = primary.length > 0 ? primary : completed;
    const beatCount = completed.filter((metric) => metric.outcome === 'beat').length;
    const missCount = completed.filter((metric) => metric.outcome === 'miss').length;
    const inlineCount = completed.filter((metric) => metric.outcome === 'in-line').length;
    const scoredBeats = scored.filter((metric) => metric.outcome === 'beat').length;
    const scoredMisses = scored.filter((metric) => metric.outcome === 'miss').length;
    const primaryOutcome = scored.length === 0 ? 'pending'
        : scoredBeats > 0 && scoredMisses > 0 ? 'mixed'
            : scoredBeats > 0 ? 'beat'
                : scoredMisses > 0 ? 'miss'
                    : 'in-line';
    const positiveResults = primaryOutcome === 'beat';
    const negativeResults = primaryOutcome === 'miss';
    const reactionDivergence = event.reactionPercent === null || primaryOutcome === 'pending' || primaryOutcome === 'mixed' || primaryOutcome === 'in-line'
        ? 'unknown'
        : positiveResults && event.reactionPercent < -0.25
            ? 'positive-results-negative-reaction'
            : negativeResults && event.reactionPercent > 0.25
                ? 'negative-results-positive-reaction'
                : 'aligned';
    return {
        event,
        metrics,
        completedCount: completed.length,
        beatCount,
        missCount,
        inlineCount,
        primaryOutcome,
        reactionDivergence,
    };
};

export const createResearchExpectationDraft = (ticker: string, now = new Date()): ResearchExpectationEvent => {
    const normalized = ticker.trim().toUpperCase();
    if (!tickerPattern.test(normalized)) throw new Error('Invalid ticker.');
    const timestamp = now.toISOString();
    const eventDate = timestamp.slice(0, 10);
    return {
        id: `${normalized.toLowerCase()}-${eventDate}-earnings`,
        ticker: normalized,
        eventType: 'earnings',
        title: 'Next earnings review',
        eventDate,
        status: 'pre-event',
        metrics: [
            { id: 'revenue', label: 'Revenue', unit: '', expected: null, actual: null, importance: 'primary', higherIsBetter: true },
            { id: 'eps', label: 'EPS', unit: '', expected: null, actual: null, importance: 'primary', higherIsBetter: true },
        ],
        expectedNarrative: '',
        actualNarrative: '',
        reactionPercent: null,
        reactionWindow: 'next trading session',
        interpretation: '',
        capturedAt: timestamp,
        updatedAt: timestamp,
    };
};
