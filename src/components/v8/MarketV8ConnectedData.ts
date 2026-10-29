import type { MarketSignal } from '@/lib/types/signal-v2';
import { hasRetrievalTimestamp, marketEvidenceDay } from '@/lib/market-evidence-coverage';
import { INDICATOR_REGISTRY } from '@/lib/indicator-registry';
import type { MarketReplaySnapshot, MarketReplaySummary } from '@/lib/types/market-replay';
import type { Point } from './market-v8-fixtures';

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const tiers = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'] as const;
const actions = ['BUY', 'NEUTRAL', 'SELL'] as const;
const origins = ['observed', 'reconstructed'] as const;
const isTier = (v: unknown): boolean => typeof v === 'string' && tiers.includes(v as typeof tiers[number]);
const isAction = (v: unknown): boolean => typeof v === 'string' && actions.includes(v as typeof actions[number]);
const isOrigin = (v: unknown): boolean => typeof v === 'string' && origins.includes(v as typeof origins[number]);
const date = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v));
const optionalString = (record: Record<string, unknown>, key: string) => record[key] === undefined || typeof record[key] === 'string';
const nullableString = (v: unknown): boolean => v === null || typeof v === 'string';
const optionalNullableString = (record: Record<string, unknown>, key: string) => record[key] === undefined || nullableString(record[key]);
const percentage = (v: unknown): boolean => finite(v) && v >= 0 && v <= 100;
const unitWeight = (v: unknown): boolean => finite(v) && v >= 0 && v <= 1;
const count = (v: unknown): boolean => Number.isInteger(v) && (v as number) >= 0;
const stringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((item) => typeof item === 'string');
const nullablePercentage = (v: unknown): boolean => v === null || percentage(v);

function httpUrls(value: unknown): string[] {
    if (typeof value !== 'string') return [];
    return (value.match(/https?:\/\/[^\s]+/gi) ?? [])
        .map((candidate) => candidate.replace(/[),.;]+$/, ''))
        .filter((candidate) => {
            try {
                const url = new URL(candidate);
                return url.protocol === 'http:' || url.protocol === 'https:';
            } catch {
                return false;
            }
        });
}

const httpUrl = (v: unknown): boolean => httpUrls(v).length > 0;

function validSourceBreakdown(value: unknown): boolean {
    return object(value) && Object.values(value).every((item) => finite(item));
}

function validIndicator(value: unknown): boolean {
    if (!object(value)
        || typeof value.name !== 'string'
        || typeof value.display_name !== 'string'
        || !finite(value.value)
        || !percentage(value.score)
        || !unitWeight(value.weight)
        || !isTier(value.signal)
        || typeof value.enabled !== 'boolean'
        || !date(value.last_updated)) return false;
    if (value.percentile !== undefined && !percentage(value.percentile)) return false;
    if (value.metadata === undefined) return true;
    if (!object(value.metadata)
        || (value.metadata.confidence !== undefined && (!finite(value.metadata.confidence) || value.metadata.confidence < 0 || value.metadata.confidence > 1))
        || (value.metadata.source_breakdown !== undefined && !validSourceBreakdown(value.metadata.source_breakdown))
        || (value.metadata.source_url !== undefined && !httpUrl(value.metadata.source_url))
        || (value.metadata.timestamp_basis !== undefined && value.metadata.timestamp_basis !== 'retrieved' && value.metadata.timestamp_basis !== 'observed')
        || !optionalString(value.metadata, 'unit')
        || (value.metadata.retrieved_at !== undefined && !date(value.metadata.retrieved_at))
        || !optionalString(value.metadata, 'cadence')
        || !optionalString(value.metadata, 'horizon')
        || !optionalString(value.metadata, 'mode_note')) return false;
    return true;
}

function validScoreHistory(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => object(item)
        && date(item.date)
        && percentage(item.score)
        && isTier(item.tier)
        && (item.origin === undefined || isOrigin(item.origin))
        && optionalNullableString(item, 'coverage_note'));
}

const nullableFinite = (value: unknown) => value === null || finite(value);
const nullableDate = (value: unknown) => value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)));
const componentChangeStatuses = ['changed', 'unchanged', 'became-available', 'became-unavailable'];

function validChangeReconciliation(value: unknown): boolean {
    if (!object(value) || !finite(value.previous_score) || !finite(value.current_score) || !finite(value.reported_delta)
        || !finite(value.component_delta) || !finite(value.rounding_residual) || typeof value.weights_changed !== 'boolean'
        || !object(value.neutral_fallback) || !object(value.model_version) || !Array.isArray(value.components)) return false;
    const neutral = value.neutral_fallback;
    const model = value.model_version;
    if (!['previous_missing_weight', 'current_missing_weight', 'previous_points', 'current_points', 'delta'].every((key) => finite(neutral[key]))) return false;
    if (typeof model.current !== 'string' || (model.previous !== null && typeof model.previous !== 'string')
        || (model.changed !== null && typeof model.changed !== 'boolean')) return false;
    if (value.news_eligibility_version !== undefined) {
        const eligibility = value.news_eligibility_version;
        if (!object(eligibility)
            || !(eligibility.previous === null || (typeof eligibility.previous === 'number' && count(eligibility.previous) && eligibility.previous >= 1))
            || !(eligibility.current === null || (typeof eligibility.current === 'number' && count(eligibility.current) && eligibility.current >= 1))
            || (eligibility.changed !== null && typeof eligibility.changed !== 'boolean')) return false;
        const expectedChanged = eligibility.previous === null || eligibility.current === null
            ? null : eligibility.previous !== eligibility.current;
        if (eligibility.changed !== expectedChanged) return false;
    }
    return value.components.every((row) => object(row)
        && typeof row.key === 'string' && typeof row.name === 'string'
        && componentChangeStatuses.includes(String(row.status))
        && ['previous_score', 'current_score', 'previous_weight', 'current_weight', 'previous_raw_value', 'current_raw_value', 'score_effect', 'weight_effect'].every((key) => nullableFinite(row[key]))
        && nullableDate(row.previous_observed_at) && nullableDate(row.current_observed_at)
        && ['previous_last_updated', 'current_last_updated', 'previous_retrieved_at', 'current_retrieved_at'].every((key) => row[key] === undefined || nullableDate(row[key]))
        && ['previous_timestamp_basis', 'current_timestamp_basis'].every((key) => row[key] === undefined || row[key] === null || row[key] === 'observed' || row[key] === 'retrieved')
        && optionalNullableString(row, 'previous_unit') && optionalNullableString(row, 'current_unit')
        && (row.observation_change === undefined || ['newer', 'older', 'same', 'different', 'unknown'].includes(String(row.observation_change)))
        && (row.new_observation === null || typeof row.new_observation === 'boolean')
        && finite(row.delta));
}

function validDriverChanges(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => object(item)
        && typeof item.key === 'string'
        && typeof item.name === 'string'
        && finite(item.current_contribution)
        && finite(item.previous_contribution)
        && finite(item.delta));
}

function validScoreDrivers(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => object(item)
        && typeof item.key === 'string'
        && typeof item.name === 'string'
        && ['positive', 'negative', 'neutral'].includes(String(item.impact))
        && finite(item.contribution)
        && percentage(item.score)
        && unitWeight(item.weight)
        && finite(item.raw_value)
        && date(item.last_updated)
        && typeof item.detail === 'string'
        && optionalString(item, 'mode_note'));
}

function validArticles(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => object(item)
        && typeof item.title === 'string'
        && typeof item.source === 'string'
        && (item.url === undefined || httpUrl(item.url))
        && (item.pubDate === undefined || date(item.pubDate))
        && (item.sentiment === undefined || ['bullish', 'bearish', 'neutral'].includes(String(item.sentiment))));
}

function validSourceAvailability(value: unknown): boolean {
    if (!object(value)) return false;
    const validSource = (source: unknown, statuses: readonly string[], hasCount: boolean) => object(source)
        && statuses.includes(String(source.status))
        && (!hasCount || count(source.count));
    return (value.reddit === undefined || validSource(value.reddit, ['available', 'no-results', 'unconfigured'], true))
        && (value.stocktwits === undefined || validSource(value.stocktwits, ['available', 'no-results', 'disabled'], true))
        && (value.news === undefined || (validSource(value.news, ['available', 'no-results', 'no-fresh-evidence'], true)
            && object(value.news)
            && (value.news.eligible_count === undefined || (count(value.news.eligible_count) && Number(value.news.eligible_count) <= Number(value.news.count)))
            && (value.news.reddit_count === undefined || count(value.news.reddit_count))
            && (value.news.eligible_reddit_count === undefined || (count(value.news.eligible_reddit_count) && count(value.news.reddit_count) && Number(value.news.eligible_reddit_count) <= Number(value.news.reddit_count)))
            && (value.news.eligibility_version === undefined || value.news.eligibility_version === 1)))
        && (value.naaim === undefined || validSource(value.naaim, ['available', 'no-current-reading'], false))
        && (value.bofa === undefined || validSource(value.bofa, ['available', 'manual-reading-unavailable'], false));
}

function validNewsEvidence(value: unknown): boolean {
    if (!object(value)) return false;
    const { count: total, dated_count: dated, unknown_date_count: unknownDates, within_24h_count: recent } = value;
    if (!count(total) || !count(dated) || !count(unknownDates) || !count(recent)) return false;
    const totalCount = total as number;
    const datedCount = dated as number;
    const unknownDateCount = unknownDates as number;
    const recentCount = recent as number;
    return datedCount <= totalCount
        && unknownDateCount === totalCount - datedCount
        && recentCount <= datedCount
        && (value.eligible_count === undefined || (count(value.eligible_count) && Number(value.eligible_count) <= recentCount))
        && (value.future_date_count === undefined || (count(value.future_date_count) && Number(value.future_date_count) + recentCount <= datedCount))
        && (value.evaluated_at === undefined || date(value.evaluated_at))
        && (value.newest_published_at === null || date(value.newest_published_at))
        && (value.oldest_published_at === null || date(value.oldest_published_at))
        && (datedCount > 0 ? typeof value.newest_published_at === 'string' && typeof value.oldest_published_at === 'string'
            : value.newest_published_at === null && value.oldest_published_at === null);
}

function validIndexTrend(value: unknown): boolean {
    return Array.isArray(value) && value.every((item) => object(item)
        && typeof item.symbol === 'string'
        && finite(item.price)
        && finite(item.changePercent)
        && ['positive', 'negative', 'flat'].includes(String(item.trend)));
}

function validCoverage(value: unknown): boolean {
    return object(value)
        && unitWeight(value.active_weight)
        && unitWeight(value.missing_weight)
        && percentage(value.neutral_baseline)
        && finite(value.active_points) && value.active_points >= 0 && value.active_points <= 100
        && finite(value.neutral_points) && value.neutral_points >= 0 && value.neutral_points <= 100;
}

function validInterpretationContext(value: unknown): boolean {
    return object(value)
        && typeof value.regime === 'string'
        && stringArray(value.agreeing_signals)
        && stringArray(value.conflicting_signals)
        && optionalString(value, 'disagreement_note')
        && typeof value.limitation === 'string'
        && typeof value.mode_note === 'string'
        && optionalString(value, 'aaii_note')
        && typeof value.article_feed_role === 'string'
        && optionalString(value, 'breadth_note');
}

function validValuationBackdrop(value: unknown): boolean {
    return object(value)
        && typeof value.name === 'string'
        && finite(value.ratio_pct) && value.ratio_pct >= 0
        && finite(value.market_value_billions) && value.market_value_billions >= 0
        && finite(value.gdp_billions) && value.gdp_billions >= 0
        && date(value.report_date)
        && typeof value.label === 'string'
        && typeof value.detail === 'string'
        && httpUrl(value.source_url);
}

function validMarketContext(value: unknown, market: string): boolean {
    if (!object(value) || value.market !== market) return false;
    if (market === 'US') {
        const yieldCurve = value.yield_curve;
        const financialConditions = value.financial_conditions;
        const breadth = value.breadth;
        const validYieldCurve = yieldCurve === null || (object(yieldCurve)
            && finite(yieldCurve.spread_pct)
            && ['normal', 'inverted'].includes(String(yieldCurve.state))
            && date(yieldCurve.report_date)
            && httpUrl(yieldCurve.source_url));
        const validFinancialConditions = financialConditions === null || (object(financialConditions)
            && finite(financialConditions.value)
            && ['tighter', 'looser', 'near-average'].includes(String(financialConditions.stance))
            && date(financialConditions.report_date)
            && httpUrl(financialConditions.source_url));
        const validBreadth = breadth === null || (object(breadth)
            && finite(breadth.equal_weight_return_pct)
            && finite(breadth.cap_weight_return_pct)
            && finite(breadth.relative_return_pct)
            && typeof breadth.period_label === 'string'
            && date(breadth.report_date)
            && Array.isArray(breadth.source_urls)
            && breadth.source_urls.every((url) => httpUrl(url)));
        return validYieldCurve && validFinancialConditions && validBreadth;
    }
    const rates = value.malaysia_rates;
    return rates === null || (object(rates)
        && finite(rates.mgs_3y_pct)
        && finite(rates.mgs_10y_pct)
        && finite(rates.curve_spread_pct)
        && finite(rates.opr_pct)
        && finite(rates.myor_pct)
        && (rates.short_term_bill_3m_pct === null || finite(rates.short_term_bill_3m_pct))
        && nullableString(rates.short_term_bill_name)
        && date(rates.report_date)
        && date(rates.opr_report_date)
        && httpUrl(rates.source_url));
}

function validScoreDelta(value: unknown): boolean {
    return object(value)
        && (value.previous_score === null || percentage(value.previous_score))
        && (value.delta === null || (finite(value.delta) && value.delta >= -100 && value.delta <= 100))
        && (value.previous_date === null || date(value.previous_date))
        && date(value.snapshot_date)
        && typeof value.label === 'string';
}

function validTrendContext(value: unknown): boolean {
    return object(value)
        && typeof value.score_trend === 'string'
        && typeof value.last_signal_change === 'string'
        && typeof value.note === 'string';
}

function validCalibrationStat(value: unknown): boolean {
    return value === null || finite(value);
}

function validCalibration(value: unknown): boolean {
    if (!object(value)
        || typeof value.benchmark_symbol !== 'string'
        || typeof value.benchmark_name !== 'string'
        || (value.mode !== 'standard' && value.mode !== 'contrarian')
        || !date(value.generated_at)
        || (value.data_start_date !== null && !date(value.data_start_date))
        || (value.data_through_date !== null && !date(value.data_through_date))
        || !count(value.snapshot_count)
        || !count(value.timeline_only_snapshot_count)
        || !count(value.observed_snapshot_count)
        || !count(value.reconstructed_snapshot_count)
        || !count(value.minimum_sample_size)
        || !count(value.directional_sample_size)
        || !nullableString(value.reconstruction_note)
        || !Array.isArray(value.horizons)
        || !Array.isArray(value.timeline)
        || typeof value.limitation !== 'string') return false;
    const horizons = value.horizons;
    for (const horizon of horizons) {
        if (!object(horizon)
            || (horizon.days !== 7 && horizon.days !== 30)
            || !Array.isArray(horizon.observations)
            || !Array.isArray(horizon.cohorts)
            || !object(horizon.baseline)) return false;
        const observations = horizon.observations;
        const cohorts = horizon.cohorts;
        const baseline = horizon.baseline;
        if (observations.some((item) => !object(item)
            || !date(item.date)
            || !percentage(item.score)
            || !isTier(item.tier)
            || !finite(item.forward_return_pct)
            || !isOrigin(item.origin))) return false;
        if (!count(baseline.sample_count)
            || !count(baseline.observed_count)
            || !count(baseline.reconstructed_count)
            || !validCalibrationStat(baseline.median_forward_return_pct)
            || !nullablePercentage(baseline.positive_return_rate_pct)) return false;
        if (cohorts.some((cohort) => !object(cohort)
            || !['negative', 'mixed', 'positive', 'strong-positive'].includes(String(cohort.zone))
            || typeof cohort.label !== 'string'
            || !count(cohort.sample_count)
            || !count(cohort.observed_count)
            || !count(cohort.reconstructed_count)
            || !validCalibrationStat(cohort.average_forward_return_pct)
            || !validCalibrationStat(cohort.median_forward_return_pct)
            || !nullablePercentage(cohort.positive_return_rate_pct)
            || !validCalibrationStat(cohort.worst_forward_return_pct)
            || !validCalibrationStat(cohort.best_forward_return_pct)
            || !nullablePercentage(cohort.alignment_rate_pct)
            || !['insufficient', 'preliminary', 'established'].includes(String(cohort.evidence_level)))) return false;
    }
    return value.timeline.every((item) => object(item)
        && date(item.date)
        && percentage(item.score)
        && isTier(item.tier)
        && isOrigin(item.origin)
        && finite(item.benchmark_rebased)
        && item.benchmark_rebased > 0
        && nullableString(item.model_version)
        && nullableString(item.coverage_note));
}

function validConfidence(value: unknown): boolean {
    return object(value)
        && percentage(value.agreement_pct)
        && ['high', 'moderate', 'low'].includes(String(value.level))
        && isAction(value.majority_signal)
        && stringArray(value.conflicting_indicators)
        && optionalString(value, 'warning')
        && (value.source_count === undefined || count(value.source_count))
        && optionalString(value, 'cap_reason');
}

function validSignalQuality(value: unknown): boolean {
    return object(value)
        && ['fresh', 'mixed', 'stale'].includes(String(value.freshness))
        && ['strong', 'moderate', 'limited'].includes(String(value.source_coverage))
        && ['low', 'moderate', 'elevated'].includes(String(value.noise_level))
        && typeof value.market_regime === 'string'
        && stringArray(value.warnings)
        && optionalString(value, 'confidence_explanation');
}

function validMetadata(value: Record<string, unknown>, market: string): boolean {
    if (value.market !== market
        || !['US', 'MY'].includes(String(value.market))
        || !object(value.data_freshness)
        || !Object.values(value.data_freshness).every((item) => date(item))) return false;
    if (value.weight_distribution !== undefined
        && (!object(value.weight_distribution) || !Object.values(value.weight_distribution).every((item) => unitWeight(item)))) return false;
    if (value.coverage_adjustment !== undefined && !validCoverage(value.coverage_adjustment)) return false;
    if (value.signal_quality !== undefined && !validSignalQuality(value.signal_quality)) return false;
    if (value.articles !== undefined && !validArticles(value.articles)) return false;
    if (value.source_availability !== undefined && !validSourceAvailability(value.source_availability)) return false;
    if (value.news_evidence !== undefined && !validNewsEvidence(value.news_evidence)) return false;
    if (value.my_news_eligibility_version !== undefined && value.my_news_eligibility_version !== 1) return false;
    if (value.index_trend !== undefined && !validIndexTrend(value.index_trend)) return false;
    if (value.interpretation_context !== undefined && !validInterpretationContext(value.interpretation_context)) return false;
    if (value.valuation_backdrop !== undefined && value.valuation_backdrop !== null && !validValuationBackdrop(value.valuation_backdrop)) return false;
    if (value.market_context !== undefined && value.market_context !== null && !validMarketContext(value.market_context, market)) return false;
    if (value.score_delta !== undefined && value.score_delta !== null && !validScoreDelta(value.score_delta)) return false;
    if (value.score_history !== undefined && !validScoreHistory(value.score_history)) return false;
    if (value.driver_changes !== undefined && !validDriverChanges(value.driver_changes)) return false;
    if (value.driver_changes_available !== undefined && typeof value.driver_changes_available !== 'boolean') return false;
    if (value.change_reconciliation !== undefined && value.change_reconciliation !== null && !validChangeReconciliation(value.change_reconciliation)) return false;
    if (value.change_reconciliation_note !== undefined && value.change_reconciliation_note !== null && typeof value.change_reconciliation_note !== 'string') return false;
    if (value.trend_context !== undefined && !validTrendContext(value.trend_context)) return false;
    if (value.score_drivers !== undefined && !validScoreDrivers(value.score_drivers)) return false;
    if (value.historical_validation !== undefined && value.historical_validation !== null && !validCalibration(value.historical_validation)) return false;
    return true;
}

export function parseConnectedSignal(payload: unknown, market: string, mode: string): MarketSignal {
    if (!object(payload) || payload.success !== true || !object(payload.data)) throw new Error('The signal service did not return a usable response.');
    const s = payload.data;
    if (!finite(s.composite_score) || !percentage(s.composite_score) || !isTier(s.tier) || (s.mode !== 'standard' && s.mode !== 'contrarian') || s.mode !== mode
        || !object(s.metadata) || !validMetadata(s.metadata, market) || !object(s.components)
        || !Object.values(s.components).every(validIndicator)
        || !validConfidence(s.confidence)
        || !object(s.interpretation)
        || typeof s.interpretation.action !== 'string'
        || typeof s.interpretation.reasoning !== 'string'
        || typeof s.interpretation.color !== 'string'
        || typeof s.interpretation.emoji !== 'string') throw new Error('The signal response has invalid or mismatched score data.');
    return s as unknown as MarketSignal;
}

export function marketSourceToggleStatus(market: string, enabled: boolean, signal: MarketSignal | null, loading = false, error = '') {
    const name = market === 'MY' ? 'News' : 'Social';
    if (!enabled) return 'Excluded from score · source data can still be read for its comparison.';
    if (error) return signal
        ? 'Enabled · latest score request failed; the previous reading remains shown.'
        : 'Enabled · latest score request failed; source availability is unknown.';
    if (loading) return signal
        ? 'Enabled · checking source availability; the displayed evidence status is from the previous reading.'
        : `Enabled · checking whether usable ${name.toLowerCase()} evidence is available.`;
    if (!signal) return `Enabled · no completed score response; ${name.toLowerCase()} availability is not established.`;
    const key = market === 'MY' ? 'news' : 'social';
    return signal.components[key]
        ? `Enabled · usable ${name.toLowerCase()} evidence is included in this score.`
        : `Enabled · no usable ${name.toLowerCase()} evidence is available; its configured weight uses the neutral reserve.`;
}

export const fullDate = (value: string | null | undefined) => value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Date unavailable';

// Only calendar dates in service labels are reformatted; timestamps keep their time/zone.
export const formatMarketDates = (text: string) => text.replace(/\b\d{4}-\d{2}-\d{2}\b(?!T)/g, value => fullDate(value));

export const indicatorReadingLabel = (tier: MarketSignal['tier']) => ({
    'strong-buy': 'strongly positive', buy: 'positive', neutral: 'neutral',
    sell: 'negative', 'strong-sell': 'strongly negative',
})[tier];

const utcCalendarDay = (value: string): number | null => {
    const day = marketEvidenceDay(value);
    if (!day) return null;
    const timestamp = Date.parse(`${day}T00:00:00Z`);
    return Number.isFinite(timestamp) ? timestamp : null;
};

export function indicatorStatus(signal: MarketSignal, key: string, date: string) {
    const indicator = signal.components[key];
    if (!indicator) return 'Not supplied';
    if (hasRetrievalTimestamp(indicator)) return 'Observation date unavailable';
    if (indicator.metadata?.timestamp_basis !== 'observed') return 'Freshness unknown';
    const snapshotDay = utcCalendarDay(date);
    const updatedDay = utcCalendarDay(indicator.last_updated);
    if (snapshotDay === null || updatedDay === null) return 'Freshness unknown';
    const age = (snapshotDay - updatedDay) / 86400000;
    if (age < 0) return 'Freshness unknown';
    if (age > (INDICATOR_REGISTRY[key]?.staleAfterDays ?? 1)) return 'Stale · included by service';
    return 'Included';
}

export function overviewHistory(signal: MarketSignal): Point[] {
    // Observed records take precedence over reconstructed duplicates. Never generate dates or scores.
    const records = new Map<string, NonNullable<MarketSignal['metadata']['score_history']>[number]>();
    for (const point of signal.metadata.score_history ?? []) {
        if (!records.has(point.date) || point.origin === 'observed') records.set(point.date, point);
    }
    return [...records.values()].sort((a,b) => a.date.localeCompare(b.date)).map(row => ({ date: row.date, value: row.score, origin: row.origin }));
}

export function archivedSeries(key: string, summaries: readonly MarketReplaySummary[], snapshots: Readonly<Record<string, MarketReplaySnapshot>>, currentDisplayName?: string, expectedUnit?: string): Point[][] {
    // Break the line at unavailable snapshots/components. Dates are snapshot dates, not publication dates.
    const groups: Point[][] = [];
    let group: Point[] = [];
    for (const summary of [...summaries].sort((a,b) => a.date.localeCompare(b.date))) {
        const item = snapshots[summary.date]?.components.find(component => component.key === key);
        if (!item || item.rawValue === null || (expectedUnit !== undefined && item.unit !== expectedUnit)
            || (key === 'vix' && currentDisplayName !== undefined && item.displayName !== currentDisplayName)) { if (group.length) groups.push(group); group = []; }
        else group.push({ date: summary.date, value: item.rawValue });
    }
    if (group.length) groups.push(group);
    return groups;
}
