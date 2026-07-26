import type { DiscoveryRisk, QualityDiscoveryResult } from '../types/research-discovery';

export const discoveryPolicyPreferences = [
    'quality',
    'trend',
    'sector-strength',
    'valuation',
    'catalyst',
    'liquidity',
] as const;
export const DISCOVERY_UNIVERSES_STORAGE_KEY = 'signal-discovery-universes-v1';

export type DiscoveryPolicyPreference = typeof discoveryPolicyPreferences[number];

export type DiscoveryUniversePolicy = {
    readonly sectors: readonly string[];
    readonly minimumDollarVolume: number;
    readonly maximumRisk: Exclude<DiscoveryRisk, 'high'>;
    readonly excludeExtremeValuation: boolean;
    readonly preferences: readonly DiscoveryPolicyPreference[];
};

export type SavedDiscoveryUniverse = {
    readonly id: string;
    readonly name: string;
    readonly policy: DiscoveryUniversePolicy;
};

export type DiscoveryPolicyRow<T extends QualityDiscoveryResult = QualityDiscoveryResult> = {
    readonly candidate: T;
    readonly defaultRank: number;
    readonly policyRank: number;
    readonly adjustment: number;
    readonly policyScore: number;
    readonly reasons: readonly string[];
};

export type DiscoveryPolicyResult<T extends QualityDiscoveryResult = QualityDiscoveryResult> = {
    readonly rows: readonly DiscoveryPolicyRow<T>[];
    readonly excluded: readonly { readonly symbol: string; readonly reason: string }[];
};

export const defaultDiscoveryUniversePolicy: DiscoveryUniversePolicy = {
    sectors: [],
    minimumDollarVolume: 20_000_000,
    maximumRisk: 'moderate',
    excludeExtremeValuation: false,
    preferences: [],
};

export const hasCustomDiscoveryUniversePolicy = (policy: DiscoveryUniversePolicy): boolean =>
    policy.sectors.length > 0
    || policy.minimumDollarVolume !== defaultDiscoveryUniversePolicy.minimumDollarVolume
    || policy.maximumRisk !== defaultDiscoveryUniversePolicy.maximumRisk
    || policy.excludeExtremeValuation
    || policy.preferences.length > 0;

const riskRank: Readonly<Record<DiscoveryRisk, number>> = { low: 0, moderate: 1, high: 2 };
const rounded = (value: number) => Number(value.toFixed(1));

const preferenceAdjustment = (
    candidate: QualityDiscoveryResult,
    preference: DiscoveryPolicyPreference,
): { readonly points: number; readonly reason: string } => {
    if (preference === 'quality') {
        if (candidate.qualityScore === null) return { points: 0, reason: 'Quality unavailable +0.0' };
        const points = (candidate.qualityScore - 50) * 0.1;
        return { points, reason: `Quality ${rounded(points) >= 0 ? '+' : ''}${rounded(points)}` };
    }
    if (preference === 'trend') {
        const points = (candidate.trendScore - 50) * 0.1;
        return { points, reason: `Trend ${rounded(points) >= 0 ? '+' : ''}${rounded(points)}` };
    }
    if (preference === 'sector-strength') {
        const points = Math.max(-5, Math.min(5, candidate.sectorRelativeStrengthPercent * 0.25));
        return { points, reason: `Sector strength ${rounded(points) >= 0 ? '+' : ''}${rounded(points)}` };
    }
    if (preference === 'valuation') {
        const pointsByGuardrail = { attractive: 5, fair: 2, expensive: -2, extreme: -5, unavailable: 0 } as const;
        const points = pointsByGuardrail[candidate.valuation.guardrail];
        return { points, reason: `Valuation ${points >= 0 ? '+' : ''}${points.toFixed(1)}` };
    }
    if (preference === 'catalyst') {
        const points = candidate.catalyst ? 3 : 0;
        return { points, reason: `Catalyst ${points >= 0 ? '+' : ''}${points.toFixed(1)}` };
    }
    const liquidityRatio = candidate.averageDollarVolume / 20_000_000;
    const points = Math.max(0, Math.min(5, Math.log10(Math.max(1, liquidityRatio)) * 2.5));
    return { points, reason: `Liquidity +${rounded(points)}` };
};

export const applyDiscoveryUniversePolicy = <T extends QualityDiscoveryResult>(
    candidates: readonly T[],
    policy: DiscoveryUniversePolicy,
): DiscoveryPolicyResult<T> => {
    const excluded: { symbol: string; reason: string }[] = [];
    const eligible = candidates.flatMap((candidate, index): Array<Omit<DiscoveryPolicyRow<T>, 'policyRank'>> => {
        if (policy.sectors.length > 0 && !policy.sectors.includes(candidate.sector)) {
            excluded.push({ symbol: candidate.symbol, reason: `Sector ${candidate.sector} is outside the selected universe.` });
            return [];
        }
        if (candidate.averageDollarVolume < policy.minimumDollarVolume) {
            excluded.push({ symbol: candidate.symbol, reason: `Dollar volume is below $${Math.round(policy.minimumDollarVolume / 1_000_000)}M.` });
            return [];
        }
        if (riskRank[candidate.risk] > riskRank[policy.maximumRisk]) {
            excluded.push({ symbol: candidate.symbol, reason: `Risk ${candidate.risk} exceeds the ${policy.maximumRisk} limit.` });
            return [];
        }
        if (policy.excludeExtremeValuation && candidate.valuation.guardrail === 'extreme') {
            excluded.push({ symbol: candidate.symbol, reason: 'Extreme valuation is excluded.' });
            return [];
        }
        const adjustments = policy.preferences.map((preference) => preferenceAdjustment(candidate, preference));
        const adjustment = rounded(adjustments.reduce((sum, item) => sum + item.points, 0));
        return [{
            candidate,
            defaultRank: index + 1,
            adjustment,
            policyScore: rounded(candidate.discoveryScore + adjustment),
            reasons: adjustments.map((item) => item.reason),
        }];
    });
    const rows = eligible
        .sort((left, right) => right.policyScore - left.policyScore || left.defaultRank - right.defaultRank)
        .map((row, index) => ({ ...row, policyRank: index + 1 }));
    return { rows, excluded };
};

const record = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

export const parseDiscoveryUniversePolicy = (value: unknown): DiscoveryUniversePolicy | null => {
    const policy = record(value);
    if (!policy || !Array.isArray(policy.sectors) || !policy.sectors.every((sector) => typeof sector === 'string' && sector.length <= 80)
        || typeof policy.minimumDollarVolume !== 'number' || ![20_000_000, 50_000_000, 100_000_000].includes(policy.minimumDollarVolume)
        || (policy.maximumRisk !== 'low' && policy.maximumRisk !== 'moderate')
        || typeof policy.excludeExtremeValuation !== 'boolean'
        || !Array.isArray(policy.preferences) || policy.preferences.length > 3
        || !policy.preferences.every((preference) => typeof preference === 'string' && discoveryPolicyPreferences.includes(preference as DiscoveryPolicyPreference))
        || new Set(policy.preferences).size !== policy.preferences.length) return null;
    return {
        sectors: [...new Set(policy.sectors)],
        minimumDollarVolume: policy.minimumDollarVolume,
        maximumRisk: policy.maximumRisk,
        excludeExtremeValuation: policy.excludeExtremeValuation,
        preferences: policy.preferences as readonly DiscoveryPolicyPreference[],
    };
};

export const parseSavedDiscoveryUniverses = (value: unknown): readonly SavedDiscoveryUniverse[] => {
    if (!Array.isArray(value)) return [];
    return value.slice(-5).flatMap((item): SavedDiscoveryUniverse[] => {
        const saved = record(item);
        const policy = saved ? parseDiscoveryUniversePolicy(saved.policy) : null;
        if (!saved || typeof saved.id !== 'string' || !/^[a-z0-9-]{1,48}$/.test(saved.id)
            || typeof saved.name !== 'string' || !saved.name.trim() || saved.name.length > 40 || !policy) return [];
        return [{ id: saved.id, name: saved.name.trim(), policy }];
    });
};

export const upsertSavedDiscoveryUniverse = (
    saved: readonly SavedDiscoveryUniverse[],
    name: string,
    policy: DiscoveryUniversePolicy,
): readonly SavedDiscoveryUniverse[] => {
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return saved;
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'universe';
    return [...saved.filter((item) => item.id !== id), { id, name: cleanName, policy: { ...policy, sectors: [...policy.sectors], preferences: [...policy.preferences] } }].slice(-5);
};

export const removeSavedDiscoveryUniverse = (
    saved: readonly SavedDiscoveryUniverse[],
    id: string,
): readonly SavedDiscoveryUniverse[] => saved.filter((item) => item.id !== id);
