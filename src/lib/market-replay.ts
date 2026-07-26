import { sql } from './db';
import type {
    MarketReplayComponent,
    MarketReplayIndex,
    MarketReplaySnapshot,
    MarketReplaySummary,
} from './types/market-replay';
import type { SignalTier } from './types/signal-v2';

const tiers: readonly SignalTier[] = ['strong-buy', 'buy', 'neutral', 'sell', 'strong-sell'];

const objectValue = (value: unknown): Record<string, unknown> => {
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
                ? Object.fromEntries(Object.entries(parsed))
                : {};
        } catch {
            return {};
        }
    }
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {};
};

const arrayValue = (value: unknown): readonly Record<string, unknown>[] => {
    if (typeof value === 'string') {
        try {
            const parsed: unknown = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.map(objectValue) : [];
        } catch {
            return [];
        }
    }
    return Array.isArray(value) ? value.map(objectValue) : [];
};

const stringValue = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
const nullableString = (value: unknown) => typeof value === 'string' ? value : null;
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : Number(value);
const nullableNumber = (value: unknown) => {
    const number = numberValue(value);
    return Number.isFinite(number) ? number : null;
};

const summaryFromRow = (row: Record<string, unknown>): MarketReplaySummary => {
    const tierValue = row.tier;
    const tier = typeof tierValue === 'string' && tiers.includes(tierValue as SignalTier) ? tierValue as SignalTier : 'neutral';
    const origin = row.origin === 'reconstructed' ? 'reconstructed' : 'observed';
    const components = objectValue(row.components);
    return {
        date: stringValue(row.snapshot_date).slice(0, 10),
        score: nullableNumber(row.composite_score) ?? 50,
        tier,
        origin,
        coverageNote: nullableString(row.coverage_note),
        hasFullEvidence: origin === 'observed' && Object.keys(components).length > 0,
        updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : stringValue(row.updated_at),
    };
};

const componentsFromRow = (value: unknown): readonly MarketReplayComponent[] =>
    Object.entries(objectValue(value)).map(([key, raw]) => {
        const component = objectValue(raw);
        return {
            key,
            displayName: stringValue(component.display_name, key),
            rawValue: nullableNumber(component.raw_value),
            score: nullableNumber(component.score),
            weight: nullableNumber(component.weight),
            signal: nullableString(component.signal),
            lastUpdated: nullableString(component.last_updated),
        };
    });

export const listMarketReplaySnapshots = async (
    market: 'US' | 'MY',
    mode: 'standard' | 'contrarian',
    enableSocial: boolean,
): Promise<MarketReplayIndex> => {
    const rows = await sql`
        SELECT snapshot_date::text AS snapshot_date, composite_score, tier, origin, coverage_note, components, updated_at
        FROM signal_snapshots
        WHERE market_type = ${market} AND mode = ${mode} AND enable_social = ${enableSocial}
        ORDER BY snapshot_date DESC
        LIMIT 180
    `;
    return {
        market,
        mode,
        enableSocial,
        summaries: rows.map((row) => summaryFromRow(objectValue(row))),
    };
};

export const getMarketReplaySnapshot = async (
    market: 'US' | 'MY',
    mode: 'standard' | 'contrarian',
    enableSocial: boolean,
    date: string,
): Promise<MarketReplaySnapshot | null> => {
    const rows = await sql`
        SELECT snapshot_date::text AS snapshot_date, composite_score, tier, origin, coverage_note,
            confidence_level, agreement_pct, majority_signal, components, score_drivers, index_trend,
            signal_quality, interpretation_context, metadata_snapshot, updated_at
        FROM signal_snapshots
        WHERE market_type = ${market} AND mode = ${mode} AND enable_social = ${enableSocial}
            AND snapshot_date = ${date}
        LIMIT 1
    `;
    if (!rows[0]) return null;
    const row = objectValue(rows[0]);
    const summary = summaryFromRow(row);
    if (!summary.hasFullEvidence) return null;
    return {
        summary,
        confidenceLevel: stringValue(row.confidence_level, 'unknown'),
        agreementPercent: nullableNumber(row.agreement_pct) ?? 0,
        majoritySignal: stringValue(row.majority_signal, 'unknown'),
        components: componentsFromRow(row.components),
        scoreDrivers: arrayValue(row.score_drivers),
        indexTrend: arrayValue(row.index_trend),
        signalQuality: objectValue(row.signal_quality),
        interpretationContext: objectValue(row.interpretation_context),
        metadata: objectValue(row.metadata_snapshot),
    };
};
