export const AURA_CACHE_MAX_AGE_DAYS = 7;

export const isAuraCacheFresh = (
    signalDate: unknown,
    now = new Date(),
    maxAgeDays = AURA_CACHE_MAX_AGE_DAYS
): boolean => {
    if (typeof signalDate !== 'string' && !(signalDate instanceof Date)) return false;
    const timestamp = new Date(signalDate).getTime();
    if (!Number.isFinite(timestamp) || !Number.isFinite(maxAgeDays) || maxAgeDays < 0) return false;
    const ageMs = now.getTime() - timestamp;
    return ageMs >= 0 && ageMs <= maxAgeDays * 24 * 60 * 60 * 1_000;
};
