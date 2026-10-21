import type { MarketSignal } from './types/signal-v2';

// Display-only labels. Do not alter the calculator's tiers, scores or weights.
export const marketReadingLabel = (tier: MarketSignal['tier']): string => ({
    'strong-buy': 'Strongly positive', buy: 'Leaning positive', neutral: 'Neutral',
    sell: 'Leaning negative', 'strong-sell': 'Strongly negative',
})[tier];

// Calendar reporting dates do not imply a time; actual timestamps retain UTC time.
export function marketTimestampLabel(value: string | null | undefined): string {
    if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
        ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }),
    }).format(new Date(value));
}

const direction = (tier: MarketSignal['tier']) => tier.includes('buy') ? 'positive' : tier.includes('sell') ? 'negative' : 'neutral';

export function marketReadingSummary(signal: MarketSignal): string {
    const active = Object.values(signal.components).filter(item => item.enabled && item.weight > 0);
    if (!active.length) return 'No scored observations are available to explain this reading.';
    const counts = { positive: 0, neutral: 0, negative: 0 };
    for (const item of active) counts[direction(item.signal)]++;
    const descriptions = Object.entries(counts).filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}`);
    const mode = signal.mode === 'contrarian' ? 'Contrarian' : 'Momentum';
    return `Included indicator readings: ${descriptions.join(', ')} under ${mode}.`;
}

export function marketAlignment(signal: MarketSignal): { summary: string; detail: string } {
    const active = Object.values(signal.components).filter(item => item.enabled && item.weight > 0);
    if (active.length < 2) return {
        summary: active.length ? 'Only one input available; agreement cannot be assessed.' : 'No scored inputs; agreement cannot be assessed.',
        detail: 'Cross-input agreement needs at least two scored observations. It is not forecast accuracy.',
    };
    const matching = active.filter(item => direction(item.signal) === direction(signal.tier)).length;
    const percent = Math.round(matching / active.length * 100);
    // Do not silently reconcile inconsistent external metrics in the presentation layer.
    const consistent = active.length === signal.confidence.source_count
        && direction(signal.tier).toUpperCase().replace('POSITIVE', 'BUY').replace('NEGATIVE', 'SELL') === signal.confidence.majority_signal
        && percent === signal.confidence.agreement_pct;
    return consistent ? {
        summary: `Indicator alignment · ${matching} of ${active.length} match this reading`,
        detail: `${percent}% of included indicators match the composite's direction, counted equally rather than by weight. Positive and negative include their strongly positive/negative tiers. Alignment is not forecast accuracy.`,
    } : {
        summary: 'Indicator alignment · source details need checking',
        detail: 'The returned agreement does not reconcile with the included indicator classifications. No replacement percentage is inferred.',
    };
}
