import { INDICATOR_REGISTRY, getIndicatorDisplayName } from './indicator-registry';
import { marketEvidenceCoverage, marketEvidenceDay } from './market-evidence-coverage';
import { marketReadingLabel } from './market-display';
import type { MarketSignal } from './types/signal-v2';

export type BriefReason = { code: string; text: string; key?: string };
export type MarketBrief = {
    status: 'available' | 'limited' | 'unavailable';
    accountingVerified: boolean;
    referenceDate: string | null;
    comparisonDate: string | null;
    conclusion: string;
    reasons: BriefReason[];
    change: { code: string; text: string };
    supportKey: string | null;
    conflictKey: string | null;
    watch: { text: string; key?: string }[];
};

const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;
const direction = (tier: MarketSignal['tier']) => tier.includes('buy') ? 'positive' : tier.includes('sell') ? 'negative' : 'neutral';
const nameOf = (signal: MarketSignal, key: string) => signal.components[key]?.display_name ?? getIndicatorDisplayName(key);
const change = (code: string, text: string) => ({ code, text });

function describeChange(signal: MarketSignal, referenceDate: string | null | undefined): MarketBrief['change'] {
    const delta = signal.metadata.score_delta;
    const account = signal.metadata.change_reconciliation;
    const previousDay = marketEvidenceDay(delta?.previous_date);
    const currentDay = marketEvidenceDay(delta?.snapshot_date);
    const referenceDay = marketEvidenceDay(referenceDate);
    // The service selects previous snapshots by the exact market/mode/social request.
    // No alternate comparison is assembled from chart history or last-visit storage.
    if (!previousDay || !currentDay || !referenceDay || currentDay > referenceDay || previousDay >= currentDay || !account || !account.components.length) {
        return change('unavailable', 'A comparable earlier assessment with complete change accounting is unavailable.');
    }
    if (delta?.delta == null || delta.previous_score == null
        || !close(account.current_score, signal.composite_score) || !close(account.previous_score, delta.previous_score)
        || !close(account.reported_delta, delta.delta) || !close(account.current_score - account.previous_score, delta.delta)
        || !close(account.components.reduce((sum, row) => sum + row.delta, 0), account.component_delta)
        || !close(account.component_delta + account.neutral_fallback.delta + account.rounding_residual, account.reported_delta)) {
        return change('unavailable', 'The score change does not reconcile with this assessment. Review change details.');
    }
    const version = account.model_version;
    const eligibility = account.news_eligibility_version;
    if (version.changed === true || (signal.metadata.market === 'MY' && eligibility?.changed === true)) {
        return change('configuration', 'The model or evidence eligibility policy changed. These scores do not establish a market development.');
    }
    if (version.changed !== false || !version.previous || version.previous !== version.current
        || (signal.metadata.market === 'MY' && (!eligibility || eligibility.changed !== false
            || eligibility.previous == null || eligibility.previous !== eligibility.current))) {
        return change('compatibility-unknown', 'Historical model or evidence-policy compatibility is unknown; a directional change cannot be established.');
    }
    const rows = account.components;
    const availability = rows.some(row => row.status === 'became-available' || row.status === 'became-unavailable');
    const weights = account.weights_changed || rows.some(row => row.previous_weight !== null && row.current_weight !== null && !close(row.previous_weight, row.current_weight));
    const both = rows.filter(row => row.status !== 'became-available' && row.status !== 'became-unavailable');
    const unknown = both.some(row => !row.previous_observed_at || !row.current_observed_at || !row.observation_change || row.observation_change === 'unknown');
    const older = both.some(row => row.observation_change === 'older');
    const sameDateChanged = both.some(row => row.observation_change === 'different');
    const unitsChanged = both.some(row => row.previous_unit !== row.current_unit);
    const newer = both.filter(row => row.observation_change === 'newer');
    const scoredChange = both.some(row => !close(row.previous_score ?? NaN, row.current_score ?? NaN));
    const prefix = `Compared with ${previousDay}: `;
    if (availability || weights) {
        const changes = [availability ? 'evidence coverage changed' : '', weights ? 'weights changed' : '', newer.length ? 'new observations also arrived' : '', unknown ? 'some observation dates are unknown' : '', older ? 'some observations moved to older dates' : '', sameDateChanged ? 'some values changed at the same observation date' : ''].filter(Boolean);
        return change('coverage-or-weights', prefix + changes.join('; ') + '. The score movement is not solely an observation change.');
    }
    if (unknown || older || sameDateChanged || unitsChanged) {
        return change('observation-uncertain', prefix + (unitsChanged ? 'observation units changed; direct comparability is unverified.' : older ? 'some observations moved to older dates.' : sameDateChanged ? 'values changed at the same observation date; the cause is unverified.' : 'some observation dates are unknown.') + (newer.length ? ' New dated observations also arrived; the overall direction remains qualified.' : ' A new-observation explanation cannot be established.'));
    }
    const staleKeys = marketEvidenceCoverage(signal, referenceDate).staleKeys;
    if (newer.some(row => staleKeys.includes(row.key))) {
        return change('observation-uncertain', prefix + 'newly captured observations are still stale; their effect does not establish a current market development.');
    }
    if (!newer.length) {
        const identical = rows.every(row => row.observation_change === 'same' && row.previous_raw_value !== null
            && row.previous_raw_value === row.current_raw_value && row.previous_unit === row.current_unit && row.status === 'unchanged');
        return identical && !scoredChange && close(account.reported_delta, 0)
            ? change('unchanged', prefix + 'no new observations or scored changes were identified.')
            : change('scored-change', prefix + 'scored inputs changed without verified new observations; inspect the change accounting.');
    }
    const otherEffects = both.some(row => row.observation_change !== 'newer' && !close(row.score_effect ?? NaN, 0));
    if (otherEffects || newer.some(row => row.score_effect === null || !Number.isFinite(row.score_effect))) {
        return change('scored-change', prefix + 'new observations and other scored changes occurred together; inspect their separate effects.');
    }
    const effects = newer.map(row => row.score_effect!);
    const net = effects.reduce((sum, effect) => sum + effect, 0);
    const offsetting = effects.some(effect => effect > 0) && effects.some(effect => effect < 0);
    if (Math.abs(net) < 0.000001 && close(account.reported_delta, 0)) {
        return offsetting
            ? change('offsetting', prefix + 'new observations offset one another; the overall score is unchanged.')
            : change('new-unchanged', prefix + 'new observations arrived without changing the score.');
    }
    const positive = (signal.mode === 'contrarian' ? -net : net) > 0;
    return change(positive ? 'strengthened' : 'weakened', prefix + `new observations ${positive ? 'strengthened' : 'weakened'} the reading under ${signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum'} mode.`
        + (offsetting ? ' Individual effects partly offset one another.' : '')
        + (close(account.reported_delta, 0) ? ' The rounded score is unchanged.' : ''));
}

/** Descriptive eligibility policy, not forecast confidence. Never changes the supplied score. */
export function buildMarketBrief(signal: MarketSignal, referenceDate: string | null | undefined): MarketBrief {
    const coverage = marketEvidenceCoverage(signal, referenceDate);
    const entries = Object.entries(signal.components).filter(([, item]) => item.enabled && item.weight > 0);
    const reasons: BriefReason[] = [];
    const add = (code: string, text: string, key?: string) => reasons.push({ code, text, ...(key ? { key } : {}) });
    const source = signal.metadata.coverage_adjustment;
    const points = entries.reduce((sum, [, item]) => sum + item.score * item.weight, 0);
    const finite = Number.isFinite(signal.composite_score) && signal.composite_score >= 0 && signal.composite_score <= 100
        && Object.values(signal.components).filter(item => item.enabled).every(item => Number.isFinite(item.value)
            && Number.isFinite(item.score) && item.score >= 0 && item.score <= 100 && Number.isFinite(item.weight) && item.weight >= 0 && item.weight <= 1);
    const accounting = finite && coverage.configuredWeightsVerified && entries.length === coverage.scoredCount
        && entries.every(([key]) => !!INDICATOR_REGISTRY[key]) && source && close(source.neutral_baseline, 50)
        && close(source.active_points, points) && close(source.neutral_points, source.missing_weight * 50)
        && close(Math.round(points + source.neutral_points), signal.composite_score);
    if (!accounting) add('accounting', 'The score and configured evidence weights could not be reconciled.');
    if (!marketEvidenceDay(referenceDate)) add('reference-date', 'The assessment reference date is unavailable.');
    if (!coverage.freshKeys.length) add('no-fresh-evidence', 'No scored input has a verified, fresh observation.');
    const unavailable = reasons.length > 0;
    for (const key of coverage.unavailableKeys) add('missing', `${nameOf(signal, key)} is missing from the configured evidence.`, key);
    for (const key of coverage.staleKeys) add('stale', `${nameOf(signal, key)} is stale and remains included in the score.`, key);
    for (const key of coverage.unknownDateKeys) add('unknown-date', `${nameOf(signal, key)} has no verified current observation date.`, key);
    const categories = new Set(coverage.freshKeys.map(key => INDICATOR_REGISTRY[key]?.category).filter(Boolean));
    if (categories.size < 2) add('variety', 'Fresh evidence covers fewer than two indicator categories.');
    for (const [key, item] of entries) if (item.weight > 0.5) add('concentration', `${nameOf(signal, key)} accounts for ${(item.weight * 100).toFixed(0)}% of configured weight.`, key);
    const conflicts = signal.confidence.conflicting_indicators;
    if (conflicts.some(conflict => !entries.some(([key, item]) => conflict === key || conflict === item.display_name))) {
        add('unmatched-conflict', 'A reported conflict has no matching included observation.');
    }
    const fresh = unavailable ? [] : entries.filter(([key]) => coverage.freshKeys.includes(key))
        .sort(([a, left], [b, right]) => right.weight - left.weight || (a < b ? -1 : a > b ? 1 : 0));
    const conflictsWith = ([key, item]: typeof entries[number]) => conflicts.includes(key) || conflicts.includes(item.display_name)
        || direction(item.signal) !== direction(signal.tier);
    const supportKey = fresh.find(entry => !conflictsWith(entry))?.[0] ?? null;
    const conflictKey = fresh.find(conflictsWith)?.[0] ?? null;
    const status = unavailable ? 'unavailable' : reasons.length ? 'limited' : 'available';
    const mode = signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum';
    const conclusion = status === 'unavailable' ? `A current assessment is unavailable. ${reasons[0].text}`
        : `The reading is ${marketReadingLabel(signal.tier).toLowerCase()} under ${mode} mode.${status === 'limited' ? ` Evidence is limited: ${reasons[0].text}` : ' The configured evidence meets the assessment checks.'}`;
    const watch: MarketBrief['watch'] = [];
    const gap = reasons.find(reason => ['missing', 'stale', 'unknown-date'].includes(reason.code));
    if (gap) watch.push({ text: gap.code === 'missing' ? `Reassess when ${nameOf(signal, gap.key!)} becomes available.` : `Reassess when ${nameOf(signal, gap.key!)} has a verified fresh observation.`, key: gap.key });
    else if (unavailable) watch.push({ text: 'Review source coverage before drawing a current conclusion.' });
    const key = conflictKey ?? supportKey;
    if (key && key !== gap?.key) watch.push({ text: `Reassess if ${nameOf(signal, key)} changes category under ${mode} mode.`, key });
    const referenceDay = marketEvidenceDay(referenceDate);
    const snapshotDay = marketEvidenceDay(signal.metadata.score_delta?.snapshot_date);
    const previousDay = marketEvidenceDay(signal.metadata.score_delta?.previous_date);
    const comparisonDate = referenceDay && snapshotDay && snapshotDay <= referenceDay && previousDay && previousDay < snapshotDay ? previousDay : null;
    return { status, accountingVerified: !!accounting, referenceDate: referenceDay, comparisonDate, conclusion, reasons, change: unavailable ? change('unavailable', 'A directional change is withheld until the current evidence supports an assessment.') : describeChange(signal, referenceDate), supportKey, conflictKey, watch };
}
