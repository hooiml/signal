import { getIndicatorBaseWeights, INDICATOR_REGISTRY } from './indicator-registry';
import { MARKET_SCORE_MODEL_VERSION } from './market-calibration';
import { parseMarketReportDate } from './market-observation-date';
import { parseStoredComponentReadings, reconcileScoreChange, type ComponentChangeRow } from './signal-change';
import type { SignalConfig } from './signal-config';
import type { SignalIntradayEntry, SignalIntradayResponse } from './types/signal-intraday';
import type { SignalTier } from './types/signal-v2';

export const signalIntradayPageSize = 60;
const maxDbId = '9223372036854775807';
const tiers: readonly SignalTier[] = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
const close = (a: number, b: number) => Math.abs(a - b) < 0.00001;

export const isSignalIntradayId = (value: unknown): value is string => typeof value === 'string'
    && /^[1-9]\d{0,18}$/.test(value) && (value.length < maxDbId.length || value <= maxDbId);

const smallerId = (a: string, b: string) => a.length === b.length ? a < b : a.length < b.length;

const objectValue = (value: unknown): Record<string, unknown> | null => {
    if (typeof value === 'string') {
        try { value = JSON.parse(value); }
        catch { return null; }
    }
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;
};

function captureTime(value: unknown) {
    const time = value instanceof Date ? value.getTime() : typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value)
        && parseMarketReportDate(value.slice(0, 10))
        ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function verifiedReadings(value: unknown, score: number) {
    const readings = parseStoredComponentReadings(objectValue(value));
    if (!readings?.length || readings.some(reading => !Object.hasOwn(INDICATOR_REGISTRY, reading.key) || !reading.name.trim()
        || reading.name.length > 120 || reading.score < 0 || reading.score > 100 || reading.weight <= 0 || reading.weight > 1
        || reading.raw_value === null)) return null;
    const activeWeight = readings.reduce((sum, reading) => sum + reading.weight, 0);
    if (activeWeight > 1 && !close(activeWeight, 1)) return null;
    const points = readings.reduce((sum, reading) => sum + reading.score * reading.weight, 0);
    const raw = points + Math.max(0, 1 - activeWeight) * 50;
    const expected = Math.min(100, Math.max(0, Math.round(raw)));
    // The archived object can have a different key order than the scorer. Allow machine noise at .5.
    return expected === score || (Math.abs(expected - score) === 1 && Math.abs(raw - (score + expected) / 2) < 1e-10) ? readings : null;
}

function parseCapture(value: unknown, config: SignalConfig, day: string) {
    const row = objectValue(value);
    const capturedAt = captureTime(row?.recorded_at);
    if (!row || !isSignalIntradayId(row.id) || !capturedAt || capturedAt.slice(0, 10) !== day
        || row.market_type !== config.market || row.mode !== config.mode || row.enable_social !== config.enableSocial
        || typeof row.composite_score !== 'number' || !Number.isInteger(row.composite_score) || row.composite_score < 0 || row.composite_score > 100
        || typeof row.tier !== 'string' || !tiers.includes(row.tier as SignalTier)) {
        throw new Error('Invalid intraday capture.');
    }
    const metadata = objectValue(row.metadata_snapshot);
    const version = metadata?.scoring_model_version;
    const newsVersion = metadata?.my_news_eligibility_version;
    return {
        id: row.id,
        capturedAt,
        score: row.composite_score,
        tier: row.tier as SignalTier,
        readings: verifiedReadings(row.components, row.composite_score),
        version: typeof version === 'string' && version.trim() ? version : null,
        newsVersion: typeof newsVersion === 'number' && Number.isSafeInteger(newsVersion) && newsVersion > 0 ? newsVersion : null,
    };
}

type Capture = ReturnType<typeof parseCapture>;
type Reason = SignalIntradayEntry['reason'];
type EntryChange = Pick<SignalIntradayEntry, 'status' | 'previousScore' | 'delta' | 'reason' | 'accounting'>;

function verifiedObservation(at: string | null, capture: Capture) {
    return at !== null && parseMarketReportDate(at.slice(0, 10)) !== null && Date.parse(at) <= Date.parse(capture.capturedAt);
}

function vixCrossing(row: ComponentChangeRow | undefined, current: Capture, previous: Capture, config: SignalConfig): Reason | null {
    if (!row || config.market !== 'US' || current.version !== MARKET_SCORE_MODEL_VERSION
        || row.previous_unit !== 'VIX points' || row.current_unit !== 'VIX points'
        || row.previous_raw_value === null || row.current_raw_value === null
        || row.previous_raw_value <= 0 || row.current_raw_value <= 0
        || row.previous_weight === null || row.current_weight === null) return null;
    const wasHigh = row.previous_raw_value > 30;
    const isHigh = row.current_raw_value > 30;
    if (wasHigh === isHigh) return null;
    const expectedWeight = (highVolatilityOverride: boolean) => {
        const weights = getIndicatorBaseWeights('US', { highVolatilityOverride });
        return weights.vix / Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    };
    if (!close(row.previous_weight, expectedWeight(wasHigh)) || !close(row.current_weight, expectedWeight(isHigh))) return null;
    const values = `${row.previous_raw_value} to ${row.current_raw_value}`;
    if (row.observation_change !== 'newer' || !verifiedObservation(row.previous_observed_at, previous)
        || !verifiedObservation(row.current_observed_at, current)) {
        const weights = `${Math.round(row.previous_weight * 100)}% to ${Math.round(row.current_weight * 100)}%`;
        return { code: 'coverage-or-weights', text: `The saved VIX input changed from ${values} and its applied weight changed from ${weights}. The source times cannot establish a market crossing.` };
    }
    return isHigh
        ? { code: 'vix-threshold-entered', text: `The recorded VIX rose from ${values}, above 30. The model applied its higher VIX weight.` }
        : { code: 'vix-threshold-exited', text: `The recorded VIX fell from ${values}, back to 30 or below. The model returned to its usual VIX weight.` };
}

function compareCaptures(current: Capture, previous: Capture | undefined, config: SignalConfig): EntryChange {
    if (!previous) return {
        status: 'baseline', previousScore: null, delta: null, accounting: null,
        reason: { code: 'baseline', text: 'First recorded assessment for this configuration today.' },
    };
    const previousScore = previous.score;
    const delta = current.score - previous.score;
    const unavailable = (code: Reason['code'], text: string): EntryChange => ({
        status: 'unavailable', previousScore, delta, accounting: null, reason: { code, text },
    });
    if (!current.version || !previous.version || (config.market === 'MY' && (!current.newsVersion || !previous.newsVersion))) {
        return unavailable('configuration-unknown', 'The archived model or evidence-policy version is unavailable. A comparable explanation cannot be established.');
    }
    if (current.version !== previous.version || (config.market === 'MY' && current.newsVersion !== previous.newsVersion)) {
        return unavailable('configuration-changed', 'The scoring model or evidence policy changed between captures. The score difference cannot be attributed to market inputs alone.');
    }
    if (!current.readings || !previous.readings || previous.capturedAt > current.capturedAt) {
        return unavailable('evidence-unavailable', 'The archived evidence does not support a complete score comparison.');
    }
    const account = reconcileScoreChange({
        current: current.readings,
        previous: previous.readings,
        currentScore: current.score,
        previousScore,
        currentModelVersion: current.version,
        previousModelVersion: previous.version,
    });
    if (!close(account.component_delta + account.neutral_fallback.delta + account.rounding_residual, delta)) {
        return unavailable('evidence-unavailable', 'The archived components do not reconcile with the score difference.');
    }
    const changedRows = account.components.filter(row => row.status !== 'unchanged');
    const accounting: NonNullable<SignalIntradayEntry['accounting']> = {
        componentDelta: account.component_delta,
        neutralDelta: account.neutral_fallback.delta,
        roundingResidual: account.rounding_residual,
        drivers: changedRows.map(row => ({
            key: row.key,
            name: row.name,
            delta: row.delta,
            beforeValue: row.previous_raw_value,
            afterValue: row.current_raw_value,
            beforeWeight: row.previous_weight,
            afterWeight: row.current_weight,
            scoreEffect: row.score_effect,
            weightEffect: row.weight_effect,
        })),
    };
    if (changedRows.length === 0) {
        if (current.tier !== previous.tier || delta !== 0) return unavailable('evidence-unavailable', 'The archived inputs do not explain the changed assessment.');
        return { status: 'unchanged', previousScore, delta, accounting, reason: { code: 'unchanged', text: 'No changed scoring input was identified.' } };
    }
    const vix = vixCrossing(changedRows.find(row => row.key === 'vix'), current, previous, config);
    const coverageOrWeights = account.weights_changed || changedRows.some(row => row.status === 'became-available' || row.status === 'became-unavailable');
    const unknown = changedRows.some(row => row.observation_change !== 'newer'
        || row.previous_unit !== row.current_unit || !verifiedObservation(row.previous_observed_at, previous)
        || !verifiedObservation(row.current_observed_at, current));
    const reason: Reason = vix ?? (coverageOrWeights
        ? { code: 'coverage-or-weights', text: 'The set of scored indicators or their applied weights changed. The accounting includes the neutral reserve.' }
        : unknown
            ? { code: 'observation-uncertain', text: 'Archived scoring inputs changed, but their observation times or units do not establish a new market reading.' }
            : { code: 'inputs-changed', text: delta === 0 ? 'Recorded inputs changed without moving the rounded score.' : 'Inputs with later source observations changed the recorded assessment.' });
    return { status: 'changed', previousScore, delta, reason, accounting };
}

export function buildSignalIntradayPage(rows: readonly unknown[], config: SignalConfig, day: string, limit: number, before: string | null): SignalIntradayResponse {
    const captures = rows.map(row => parseCapture(row, config, day));
    let bound = before;
    for (const capture of captures) {
        if (bound !== null && !smallerId(capture.id, bound)) throw new Error('Invalid intraday capture order.');
        bound = capture.id;
    }
    const entries = captures.slice(0, limit).map((capture, index): SignalIntradayEntry => ({
        id: capture.id,
        capturedAt: capture.capturedAt,
        score: capture.score,
        tier: capture.tier,
        ...compareCaptures(capture, captures[index + 1], config),
    }));
    return { ...config, day, entries, hasEarlierCaptures: captures.length > limit };
}
