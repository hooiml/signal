import { MarketSignal, SignalAction, SignalTier, IndicatorData } from '@/lib/types/signal-v2';

export type SupportState = 'supports' | 'challenges' | 'neutral' | 'disabled';
export type CockpitTheme = 'dark' | 'light';

export function getThemeClasses(theme: CockpitTheme) {
    if (theme === 'light') {
        return {
            pageText: 'text-slate-950',
            panelStrong: 'border-slate-500 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.14)]',
            panel: 'border-slate-400 bg-white/96 shadow-[0_18px_50px_rgba(15,23,42,0.07)]',
            panelSoft: 'border-slate-400 bg-slate-50/96',
            panelMuted: 'border-slate-300 bg-slate-100/96',
            heroBackground: 'bg-[radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_34%),linear-gradient(160deg,_rgba(255,255,255,1),_rgba(248,250,252,0.98))]',
            textPrimary: 'text-slate-950',
            textSecondary: 'text-slate-800',
            textMuted: 'text-slate-700',
            textSubtle: 'text-slate-600',
            textInverted: 'text-white',
            divider: 'border-slate-300',
            tableRowSupport: 'bg-emerald-500/[0.06]',
            tableRowChallenge: 'bg-rose-500/[0.06]',
            commandStrip: 'border-slate-400/90 bg-white/94 shadow-[0_14px_40px_rgba(15,23,42,0.1)]',
            commandGroup: 'border-slate-400 bg-white/92',
            controlMuted: 'text-slate-600',
            railBackground: 'bg-slate-200',
            statChip: 'border-slate-400 bg-slate-50 text-slate-800',
        };
    }

    return {
        pageText: 'text-slate-100',
        panelStrong: 'border-slate-800 bg-slate-900/80 shadow-[0_20px_60px_rgba(2,6,23,0.25)]',
        panel: 'border-slate-800/70 bg-slate-950/40',
        panelSoft: 'border-slate-800/70 bg-slate-950/30',
        panelMuted: 'border-slate-800/80 bg-slate-900/55',
        heroBackground: 'bg-[radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_34%),linear-gradient(160deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.94))]',
        textPrimary: 'text-white',
        textSecondary: 'text-slate-200',
        textMuted: 'text-slate-400',
        textSubtle: 'text-slate-500',
        textInverted: 'text-white',
        divider: 'border-slate-800',
        tableRowSupport: 'bg-emerald-500/[0.025]',
        tableRowChallenge: 'bg-rose-500/[0.04]',
        commandStrip: 'border-slate-800/80 bg-slate-950/65 shadow-[0_14px_40px_rgba(2,6,23,0.28)]',
        commandGroup: 'border-slate-800/80 bg-slate-900/55',
        controlMuted: 'text-slate-500',
        railBackground: 'bg-slate-800',
        statChip: 'border-slate-800 bg-slate-950/70 text-slate-200',
    };
}

export function getSignalAction(tier: SignalTier): SignalAction {
    if (tier === 'strong-buy' || tier === 'buy') return 'BUY';
    if (tier === 'strong-sell' || tier === 'sell') return 'SELL';
    return 'NEUTRAL';
}

export function getActionUiLabel(action: SignalAction) {
    if (action === 'BUY') return 'Positive';
    if (action === 'SELL') return 'Negative';
    return 'Mixed / Neutral';
}

export function getTierLabel(tier: SignalTier) {
    return tier.replace('-', ' ');
}

export function getTierUiLabel(tier: SignalTier) {
    switch (tier) {
        case 'strong-buy':
            return 'Strongly positive';
        case 'buy':
            return 'Leaning positive';
        case 'neutral':
            return 'Mixed';
        case 'sell':
            return 'Leaning negative';
        case 'strong-sell':
            return 'Strongly negative';
    }
}

export function getReadStateLabel(tier: SignalTier, mode: 'standard' | 'contrarian') {
    if (mode === 'standard') {
        return getTierUiLabel(tier);
    }

    switch (tier) {
        case 'strong-buy':
            return 'Fear looks overdone';
        case 'buy':
            return 'Fear may be overdone';
        case 'neutral':
            return 'Balanced';
        case 'sell':
            return 'Optimism may be crowded';
        case 'strong-sell':
            return 'Optimism looks overcrowded';
    }
}

export function getModeLabel(mode: 'standard' | 'contrarian') {
    return mode === 'standard' ? 'Momentum read' : 'Contrarian read';
}

export function getSupportState(indicator: IndicatorData, compositeTier: SignalTier): SupportState {
    if (!indicator.enabled) return 'disabled';

    const indicatorAction = getSignalAction(indicator.signal);
    const compositeAction = getSignalAction(compositeTier);

    if (indicatorAction === 'NEUTRAL' || compositeAction === 'NEUTRAL') {
        return 'neutral';
    }

    return indicatorAction === compositeAction ? 'supports' : 'challenges';
}

export function getSupportLabel(state: SupportState) {
    switch (state) {
        case 'supports':
            return 'Supports read';
        case 'challenges':
            return 'Challenges read';
        case 'disabled':
            return 'Disabled';
        default:
            return 'Neutral / mixed';
    }
}

export function getSupportTone(state: SupportState, theme: CockpitTheme = 'dark') {
    if (theme === 'light') {
        switch (state) {
            case 'supports':
                return 'border-emerald-300 bg-emerald-50 text-emerald-700';
            case 'challenges':
                return 'border-rose-300 bg-rose-50 text-rose-700';
            case 'disabled':
                return 'border-slate-300 bg-slate-100 text-slate-500';
            default:
                return 'border-slate-300 bg-slate-100 text-slate-600';
        }
    }

    switch (state) {
        case 'supports':
            return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200';
        case 'challenges':
            return 'border-rose-400/40 bg-rose-500/10 text-rose-200';
        case 'disabled':
            return 'border-slate-700 bg-slate-800/70 text-slate-400';
        default:
            return 'border-slate-700 bg-slate-800/70 text-slate-300';
    }
}

export function getTierTone(tier: SignalTier, theme: CockpitTheme = 'dark') {
    if (theme === 'light') {
        switch (tier) {
            case 'strong-buy':
                return {
                    text: 'text-emerald-600',
                    chip: 'border-emerald-300 bg-emerald-50 text-emerald-700',
                    rail: 'from-emerald-400 via-emerald-500 to-emerald-600',
                };
            case 'buy':
                return {
                    text: 'text-emerald-500',
                    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700',
                    rail: 'from-emerald-300 via-emerald-400 to-emerald-500',
                };
            case 'neutral':
                return {
                    text: 'text-sky-600',
                    chip: 'border-sky-200 bg-sky-50 text-sky-700',
                    rail: 'from-sky-300 via-sky-400 to-sky-500',
                };
            case 'sell':
                return {
                    text: 'text-rose-500',
                    chip: 'border-rose-200 bg-rose-50 text-rose-700',
                    rail: 'from-rose-300 via-rose-400 to-rose-500',
                };
            default:
                return {
                    text: 'text-rose-600',
                    chip: 'border-rose-300 bg-rose-50 text-rose-700',
                    rail: 'from-rose-400 via-rose-500 to-rose-600',
                };
        }
    }

    switch (tier) {
        case 'strong-buy':
            return {
                text: 'text-emerald-300',
                chip: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
                rail: 'from-emerald-300 via-emerald-400 to-emerald-500',
            };
        case 'buy':
            return {
                text: 'text-emerald-200',
                chip: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
                rail: 'from-emerald-200 via-emerald-300 to-emerald-400',
            };
        case 'neutral':
            return {
                text: 'text-sky-200',
                chip: 'border-sky-400/30 bg-sky-500/10 text-sky-100',
                rail: 'from-sky-200 via-sky-300 to-sky-400',
            };
        case 'sell':
            return {
                text: 'text-rose-200',
                chip: 'border-rose-400/30 bg-rose-500/10 text-rose-100',
                rail: 'from-rose-200 via-rose-300 to-rose-400',
            };
        default:
            return {
                text: 'text-rose-300',
                chip: 'border-rose-400/40 bg-rose-500/10 text-rose-200',
                rail: 'from-rose-300 via-rose-400 to-rose-500',
            };
    }
}

export function getConfidenceTone(level: MarketSignal['confidence']['level'], theme: CockpitTheme = 'dark') {
    if (theme === 'light') {
        if (level === 'high') return 'text-emerald-700 border-emerald-300 bg-emerald-50';
        if (level === 'moderate') return 'text-amber-700 border-amber-300 bg-amber-50';
        return 'text-rose-700 border-rose-300 bg-rose-50';
    }
    if (level === 'high') return 'text-emerald-200 border-emerald-400/40 bg-emerald-500/10';
    if (level === 'moderate') return 'text-amber-200 border-amber-400/40 bg-amber-500/10';
    return 'text-rose-200 border-rose-400/40 bg-rose-500/10';
}

export function getQualityTone(value: string, theme: CockpitTheme = 'dark') {
    if (theme === 'light') {
        if (['fresh', 'strong', 'low', 'positive'].includes(value)) {
            return 'text-emerald-700 border-emerald-300 bg-emerald-50';
        }
        if (['mixed', 'moderate', 'flat'].includes(value)) {
            return 'text-amber-700 border-amber-300 bg-amber-50';
        }
        return 'text-rose-700 border-rose-300 bg-rose-50';
    }
    if (['fresh', 'strong', 'low', 'positive'].includes(value)) {
        return 'text-emerald-200 border-emerald-400/40 bg-emerald-500/10';
    }
    if (['mixed', 'moderate', 'flat'].includes(value)) {
        return 'text-amber-200 border-amber-400/40 bg-amber-500/10';
    }
    return 'text-rose-200 border-rose-400/40 bg-rose-500/10';
}

export function formatNumber(value: number | null | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '--';
    return Math.round(value).toString();
}

export function formatDelta(delta: number | null | undefined) {
    if (delta === null || delta === undefined || Number.isNaN(delta)) return 'No prior delta';
    if (delta === 0) return 'No change';
    return `${delta > 0 ? '+' : ''}${delta}`;
}

export function formatDateLabel(value: string | null | undefined, withTime = false) {
    if (!value) return 'Unavailable';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, withTime ? {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    } : {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function formatRawValue(indicator: IndicatorData, market: 'US' | 'MY') {
    if (indicator.name === 'social' || indicator.name === 'news') {
        return `${clampSentiment(indicator.value).toFixed(2)} sentiment`;
    }

    if (indicator.name === 'put_call') {
        return `${indicator.value.toFixed(2)} put/call`;
    }

    if (indicator.name === 'aaii') {
        return `${indicator.value.toFixed(1)}% bullish`;
    }

    if (indicator.name === 'naaim') {
        return `${indicator.value.toFixed(1)}% exposure`;
    }

    if (indicator.name === 'vix' && market === 'MY') {
        return `${indicator.value.toFixed(2)} volatility proxy`;
    }

    return indicator.value.toFixed(2);
}

export function getIndicatorCadence(indicator: IndicatorData) {
    if (indicator.metadata?.cadence) return indicator.metadata.cadence;
    if (indicator.name === 'aaii' || indicator.name === 'naaim') return 'Weekly / positioning';
    if (indicator.name === 'put_call' || indicator.name === 'social' || indicator.name === 'news') return 'Daily / tactical';
    if (indicator.name === 'vix') return 'Live / tactical';
    return 'Periodic';
}

export function getIndicatorHorizon(indicator: IndicatorData) {
    if (indicator.metadata?.horizon) return indicator.metadata.horizon;
    if (indicator.name === 'aaii' || indicator.name === 'naaim') return '1-4 weeks';
    if (indicator.name === 'put_call' || indicator.name === 'social' || indicator.name === 'news' || indicator.name === 'vix') return '1-5 trading days';
    return 'Context dependent';
}

export function getIndicatorStaleAfterDays(indicator: IndicatorData) {
    if (indicator.name === 'put_call' || indicator.name === 'social' || indicator.name === 'news' || indicator.name === 'vix') return 2;
    if (indicator.name === 'aaii' || indicator.name === 'naaim') return 14;
    return 14;
}

export function getFreshnessLabel(lastUpdated: string, staleAfterDays = 14) {
    const date = new Date(lastUpdated);
    if (Number.isNaN(date.getTime())) return 'Unknown';

    const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

    if (ageDays > staleAfterDays) return 'Stale';
    if (ageDays > Math.max(1, staleAfterDays * 0.75)) return 'Mixed';
    return 'Fresh';
}

export function getFreshnessTone(label: string, theme: CockpitTheme = 'dark') {
    if (theme === 'light') {
        if (label === 'Fresh') return 'text-emerald-700';
        if (label === 'Mixed') return 'text-amber-700';
        return 'text-rose-700';
    }
    if (label === 'Fresh') return 'text-emerald-200';
    if (label === 'Mixed') return 'text-amber-200';
    return 'text-rose-200';
}

export function getAgreementLabel(signal: MarketSignal) {
    const activeCount = Object.values(signal.components).filter((component) => component.enabled).length;
    const agreedCount = Math.round((signal.confidence.agreement_pct / 100) * activeCount);
    return `${agreedCount} of ${activeCount}`;
}

export function getPrimaryCaveat(signal: MarketSignal) {
    const quality = signal.metadata.signal_quality;
    const toggle = signal.metadata.counterfactuals?.source_toggle;
    const warningText = quality?.warnings?.[0] || signal.confidence.warning || null;

    if (quality?.freshness === 'stale' || quality?.warnings.some((warning) => warning.toLowerCase().includes('stale'))) {
        return warningText || 'Some active inputs are stale, so the read should be treated cautiously.';
    }

    if (quality?.source_coverage === 'limited') {
        return signal.confidence.cap_reason || 'Coverage is limited, so signal alignment is capped and the read is directional only.';
    }

    if (signal.confidence.cap_reason || signal.confidence.warning) {
        return signal.confidence.cap_reason || signal.confidence.warning || null;
    }

    if (toggle && !toggle.active) {
        return `${toggle.source_label} is disabled, so weights are redistributed across active sources.`;
    }

    return warningText;
}

export function getTopDrivers(signal: MarketSignal) {
    const drivers = [...(signal.metadata.score_drivers ?? [])].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const positive = drivers.find((driver) => driver.impact === 'positive') || null;
    const negative = drivers.find((driver) => driver.impact === 'negative') || null;
    return { positive, negative };
}

export function getDriverSummary(signal: MarketSignal) {
    const drivers = [...(signal.metadata.score_drivers ?? [])]
        .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    const topDriver = drivers[0];

    if (!topDriver) {
        return signal.interpretation.reasoning;
    }

    if (topDriver.impact === 'positive') {
        return `${topDriver.name} is the clearest supporting driver right now: ${topDriver.detail}`;
    }

    if (topDriver.impact === 'negative') {
        return `${topDriver.name} is the clearest challenge to the current read: ${topDriver.detail}`;
    }

    const supportingDriver = drivers.find((driver) => driver.impact === 'positive');
    if (supportingDriver) {
        return `${topDriver.name} is the largest weighted input but is neutral/mixed; ${supportingDriver.name} is the clearest supporting driver: ${supportingDriver.detail}`;
    }

    return `${topDriver.name} is the largest weighted input but is neutral/mixed: ${topDriver.detail}`;
}

export function getReadHeadline(tier: SignalTier, mode: 'standard' | 'contrarian') {
    if (mode === 'standard') {
        if (tier === 'strong-buy') return 'Conditions are strongly positive';
        if (tier === 'buy') return 'Conditions are leaning positive';
        if (tier === 'neutral') return 'Conditions are mixed';
        if (tier === 'sell') return 'Conditions are leaning negative';
        return 'Conditions are strongly negative';
    }

    if (tier === 'strong-buy') return 'Fear looks overdone';
    if (tier === 'buy') return 'Fear may be overdone';
    if (tier === 'neutral') return 'Fear and optimism are balanced';
    if (tier === 'sell') return 'Optimism may be overcrowded';
    return 'Optimism looks overcrowded';
}

export function getDecisionReliability(signal: MarketSignal) {
    const quality = signal.metadata.signal_quality;
    const sourceCount = signal.confidence.source_count ?? Object.values(signal.components).filter((component) => component.enabled).length;

    if (!quality) return 'Unspecified';
    if (quality.source_coverage === 'limited' || quality.freshness === 'stale' || sourceCount <= 2) return 'Limited';
    if (quality.source_coverage === 'moderate' || quality.freshness === 'mixed' || signal.confidence.level === 'moderate') return 'Moderate';
    return 'Strong';
}

export function getActiveSourceSummary(signal: MarketSignal) {
    const count = signal.confidence.source_count ?? Object.values(signal.components).filter((component) => component.enabled).length;
    return `${count} active source${count === 1 ? '' : 's'}`;
}

export function getSourceFreshnessSummary(signal: MarketSignal) {
    const active = Object.values(signal.components).filter((component) => component.enabled);
    const stale = active.filter((component) => getFreshnessLabel(component.last_updated) === 'Stale');
    const fresh = active.filter((component) => getFreshnessLabel(component.last_updated) === 'Fresh');

    return {
        staleSource: stale.length > 0 ? stale.map((component) => component.display_name).join(', ') : 'None',
        freshSource: fresh.length > 0 ? fresh.map((component) => component.display_name).join(', ') : 'None',
    };
}

export function getSignalHorizon(signal: MarketSignal) {
    const metadataHorizon = (signal.metadata as MarketSignal['metadata'] & { horizon?: string }).horizon;
    return metadataHorizon || 'Not model-defined';
}

export function getBroadMarketConfirmation(signal: MarketSignal) {
    return getBroadMarketValidation(signal).summary;
}

export function getBroadMarketValidation(signal: MarketSignal) {
    const trend = signal.metadata.index_trend ?? [];
    if (trend.length === 0) {
        return {
            summary: 'Unavailable',
            aligned: 0,
            total: 0,
            warning: null,
        };
    }

    const action = getSignalAction(signal.tier);
    const positive = trend.filter((item) => item.trend === 'positive').length;
    const negative = trend.filter((item) => item.trend === 'negative').length;
    const flat = trend.length - positive - negative;
    const aligned = action === 'BUY' ? positive : action === 'SELL' ? negative : flat;
    const summary = action === 'NEUTRAL'
        ? `${aligned} of ${trend.length} indexes aligned with neutral/mixed read`
        : `${aligned} of ${trend.length} indexes aligned`;

    return {
        summary,
        aligned,
        total: trend.length,
        warning: signal.mode === 'contrarian' && aligned === 0
            ? 'Index breadth does not confirm this read.'
            : null,
    };
}

export function getEvidenceConcentration(signal: MarketSignal) {
    return getEvidenceConcentrationDetails(signal).summary;
}

export function getEvidenceConcentrationDetails(signal: MarketSignal) {
    const drivers = [...(signal.metadata.score_drivers ?? [])].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    if (drivers.length === 0) {
        return {
            level: 'Unavailable',
            driver: 'Unavailable',
            share: null as number | null,
            summary: 'Evidence concentration unavailable',
        };
    }

    const total = drivers.reduce((sum, driver) => sum + Math.abs(driver.contribution), 0);
    const top = drivers[0];
    const share = total > 0 ? Math.round((Math.abs(top.contribution) / total) * 100) : 0;
    const activeCount = Object.values(signal.components).filter((component) => component.enabled).length;
    const level = share >= 60 ? 'High' : share >= 40 ? 'Moderate' : 'Distributed';

    return {
        level,
        driver: top.name,
        share,
        summary: `${top.name}, ${share}% across ${activeCount} active inputs`,
    };
}

export function getDataCaveatSummary(signal: MarketSignal) {
    const warnings = signal.metadata.signal_quality?.warnings ?? [];
    const staleWarning = warnings.find((warning) => warning.toLowerCase().includes('stale'));
    if (staleWarning) return staleWarning;

    const primaryCaveat = getPrimaryCaveat(signal);
    if (primaryCaveat) return primaryCaveat;

    return 'No active data caveat';
}

export function getModelInvalidationSummary() {
    return 'Not defined for this read';
}

export function getReadLimitations(signal: MarketSignal) {
    const limitations: string[] = [];
    const concentration = getEvidenceConcentrationDetails(signal);
    const activeSourceCount = signal.confidence.source_count ?? Object.values(signal.components).filter((component) => component.enabled).length;
    const freshness = getSourceFreshnessSummary(signal);
    const articles = signal.metadata.articles ?? [];
    const quality = signal.metadata.signal_quality;

    if (concentration.level === 'High' && concentration.share !== null) {
        limitations.push(`Evidence is concentrated in ${concentration.driver} (${concentration.share}%).`);
    }

    if (freshness.staleSource !== 'None') {
        limitations.push(`${freshness.staleSource} data is stale.`);
    }

    if (activeSourceCount <= 2) {
        limitations.push(`Only ${activeSourceCount} active sources are contributing.`);
    }

    if (articles.length === 0) {
        limitations.push('News/social context is unavailable or excluded.');
    }

    if (quality?.source_coverage === 'limited' || quality?.freshness !== 'fresh') {
        limitations.push('Source coverage or freshness limits this read.');
    }

    limitations.push('No historical validation is shown.');
    return Array.from(new Set(limitations)).slice(0, 5);
}

function clampSentiment(value: number) {
    return Math.max(-1, Math.min(1, value));
}

