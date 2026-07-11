import type { IndicatorData, MarketSignal } from '@/lib/types/signal-v2';
import {
    getFreshnessLabel,
    getIndicatorStaleAfterDays,
    getReadHeadline,
    getSupportState,
    type SupportState,
} from '@/components/v2/cockpit-utils';

export type DriverV6 = NonNullable<MarketSignal['metadata']['score_drivers']>[number] & {
    conflict: boolean;
    freshness: string;
    support: SupportState;
    directionalInfluence: number;
};

export type ScenarioV6 = {
    title: string;
    detail: string;
    tone: 'positive' | 'warning' | 'negative';
};

export const formatSignedV6 = (value: number | null | undefined, digits = 0) => {
    if (value === null || value === undefined) return '--';
    const rounded = value.toFixed(digits);
    return (value > 0 ? '+' : '') + rounded;
};

export const formatCompactDateV6 = (value: string | null | undefined) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date);
};

export const getRankedDriversV6 = (signal: MarketSignal): DriverV6[] => {
    const conflicts = new Set(signal.confidence.conflicting_indicators.map((name) => name.toLowerCase()));
    return [...(signal.metadata.score_drivers ?? [])]
        .map((driver) => {
            const component = signal.components[driver.key];
            const support = component ? getSupportState(component, signal.tier) : 'neutral';
            const conflict = conflicts.has(driver.key.toLowerCase())
                || conflicts.has(driver.name.toLowerCase())
                || support === 'challenges';
            return {
                ...driver,
                conflict,
                support,
                directionalInfluence: (driver.score - 50) * driver.weight,
                freshness: getFreshnessLabel(
                    driver.last_updated,
                    component ? getIndicatorStaleAfterDays(component) : 14,
                ),
            };
        })
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
};

export const getDecisionPostureV6 = (signal: MarketSignal) => {
    const drivers = getRankedDriversV6(signal);
    const lead = [...drivers].sort((a, b) => Math.abs(b.directionalInfluence) - Math.abs(a.directionalInfluence))[0];
    const conflicts = drivers.filter((driver) => driver.conflict).map((driver) => driver.name);
    const quality = signal.metadata.signal_quality;
    const cautionParts: string[] = [];

    if (conflicts.length > 0) cautionParts.push(conflicts.join(' and ') + ' do not confirm the majority read');
    if (quality?.freshness === 'mixed') cautionParts.push('source freshness is mixed');
    if (quality?.freshness === 'stale') cautionParts.push('important sources are stale');
    if (quality?.source_coverage === 'limited') cautionParts.push('source coverage is limited');

    const caution = cautionParts.length > 0 ? cautionParts.join('; ') + '.' : 'No material data-quality warning is active.';

    return {
        headline: getReadHeadline(signal.tier, signal.mode),
        summary: (lead && Math.abs(lead.directionalInfluence) > 0.01 ? lead.name + ' has the strongest directional influence. ' : '')
            + caution.charAt(0).toUpperCase() + caution.slice(1),
    };
};

const findComponent = (signal: MarketSignal, name: IndicatorData['name']) =>
    Object.values(signal.components).find((component) => component.name === name && component.enabled);

export const getScenariosV6 = (signal: MarketSignal): ScenarioV6[] => {
    const scenarios: ScenarioV6[] = [];
    const vix = findComponent(signal, 'vix');
    const aaii = findComponent(signal, 'aaii');
    const quality = signal.metadata.signal_quality;
    const breadth = signal.metadata.index_trend ?? [];

    if (vix) {
        const threshold = vix.value < 25 ? 25 : 30;
        const volatilityName = signal.metadata.market === 'MY' ? vix.display_name + ' proxy' : vix.display_name;
        scenarios.push({
            title: volatilityName + ' ' + (vix.value < threshold ? 'rises above ' : 'holds above ') + threshold,
            detail: signal.metadata.market === 'MY'
                ? 'Higher currency volatility would weaken local risk confirmation; this proxy does not trigger the US volatility override.'
                : signal.mode === 'standard'
                    ? 'Higher volatility would weaken momentum confirmation and can change the weighting regime.'
                    : 'Higher volatility would increase fear and potential contrarian opportunity context.',
            tone: 'negative',
        });
    }

    if (aaii) {
        scenarios.push({
            title: 'Fresh AAII data moves toward neutral',
            detail: 'The current ' + aaii.value.toFixed(1) + '% bullish reading would carry less influence if the weekly update normalizes.',
            tone: 'warning',
        });
    }

    if (quality?.freshness !== 'fresh') {
        scenarios.push({
            title: 'Source freshness improves',
            detail: 'New weekly positioning data would reduce uncertainty without changing the scoring rules.',
            tone: 'positive',
        });
    } else if (breadth.length > 0) {
        const aligned = breadth.filter((item) => item.trend === 'positive').length;
        scenarios.push({
            title: 'Broad-market confirmation weakens',
            detail: aligned + ' of ' + breadth.length + ' tracked indexes are positive now; fewer aligned indexes would reduce contextual support.',
            tone: 'warning',
        });
    }

    return scenarios.slice(0, 3);
};

export const getArticleDriverV6 = (title: string, signal: MarketSignal) => {
    const normalized = title.toLowerCase();
    if (/volatil|swing|fear|risk/.test(normalized) && signal.components.vix?.enabled) {
        return { label: signal.components.vix.display_name, detail: 'Relevant to volatility and the tactical fear gauge.' };
    }
    if (/sentiment|consumer|retail|investor|optimis|pessimis/.test(normalized)) {
        return { label: signal.metadata.market === 'MY' ? 'News' : 'Sentiment', detail: 'Relevant to the contextual sentiment input.' };
    }
    if (/option|hedg|put|call/.test(normalized) && signal.components.put_call?.enabled) {
        return { label: 'Put/Call', detail: 'Relevant to daily options positioning.' };
    }
    if (/manager|fund|position|exposure/.test(normalized) && signal.components.naaim?.enabled) {
        return { label: 'NAAIM', detail: 'Relevant to active-manager positioning context.' };
    }
    return { label: 'Context', detail: 'Non-scored market context; no direct contribution is assigned.' };
};
