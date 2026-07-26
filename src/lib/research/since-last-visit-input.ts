import type { ResearchMarket } from '../types/research';
import type { AlertSeverity } from '../types/research-alert';
import type { SignalTier } from '../types/signal-v2';
import type {
    ResearchVisitMarketSnapshot,
    SinceLastVisitBriefingInput,
} from './since-last-visit';

const signalTiers: readonly SignalTier[] = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];
const alertSeverities: readonly AlertSeverity[] = ['opportunity', 'watch', 'risk'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const validSymbol = (value: unknown): value is string =>
    typeof value === 'string' && /^[A-Z0-9.-]{1,15}$/.test(value);

export const parseSinceLastVisitMarket = (
    payload: unknown,
    expectedMarket: ResearchMarket,
    capturedAt: string,
): ResearchVisitMarketSnapshot => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
        || typeof payload.data.composite_score !== 'number'
        || !Number.isFinite(payload.data.composite_score)
        || payload.data.composite_score < 0
        || payload.data.composite_score > 100
        || typeof payload.data.tier !== 'string'
        || !signalTiers.includes(payload.data.tier as SignalTier)
        || !isRecord(payload.data.metadata)
        || payload.data.metadata.market !== expectedMarket
        || !Number.isFinite(Date.parse(capturedAt))) {
        throw new Error(`Invalid ${expectedMarket} market signal response.`);
    }
    return {
        market: expectedMarket,
        tier: payload.data.tier as SignalTier,
        score: payload.data.composite_score,
        snapshotAt: new Date(capturedAt).toISOString(),
    };
};

export const parseSinceLastVisitAlerts = (
    payload: unknown,
): SinceLastVisitBriefingInput['alerts'] => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
        || !Array.isArray(payload.data.alerts)) {
        throw new Error('Invalid research alerts response.');
    }
    return payload.data.alerts.map((value) => {
        if (!isRecord(value) || !validSymbol(value.symbol)
            || typeof value.severity !== 'string'
            || !alertSeverities.includes(value.severity as AlertSeverity)) {
            throw new Error('Invalid research alert data.');
        }
        return {
            symbol: value.symbol,
            severity: value.severity as AlertSeverity,
        };
    }).slice(0, 100);
};

export const parseSinceLastVisitSourceIssues = (
    payload: unknown,
): SinceLastVisitBriefingInput['sourceIssues'] => {
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)
        || !Array.isArray(payload.data.entries)) {
        throw new Error('Invalid source-health response.');
    }
    return payload.data.entries.flatMap((value) => {
        if (!isRecord(value) || typeof value.name !== 'string'
            || typeof value.status !== 'string'
            || !['healthy', 'degraded', 'unconfigured', 'unchecked'].includes(value.status)
            || !Array.isArray(value.affectedFeatures)
            || !value.affectedFeatures.every((item) => typeof item === 'string')) {
            throw new Error('Invalid source-health entry.');
        }
        if (value.status !== 'degraded') return [];
        return [{
            name: value.name,
            affectedFeatures: value.affectedFeatures.slice(0, 20),
        }];
    }).slice(0, 50);
};
