export const US_V220_BASE_WEIGHTS = { vix: 0.40, social: 0.15, put_call: 0.20, aaii: 0.25 } as const;
export const US_VIX_STRESS_START = 25;
export const US_VIX_STRESS_FULL = 40;
export const US_VIX_MAX_WEIGHT = 0.60;

export function getVixStressFactor(vixValue: number | null | undefined): number {
    if (typeof vixValue !== 'number' || !Number.isFinite(vixValue) || vixValue <= US_VIX_STRESS_START) return 0;
    return Math.min(1, (vixValue - US_VIX_STRESS_START) / (US_VIX_STRESS_FULL - US_VIX_STRESS_START));
}

export function getUsV220Weights(vixValue: number | null | undefined, enableSocial: boolean) {
    const { vix, social, put_call, aaii } = US_V220_BASE_WEIGHTS;
    const remainingWeight = enableSocial ? 1 : vix + put_call + aaii;
    const base = {
        vix: vix / remainingWeight,
        social: enableSocial ? social : 0,
        put_call: put_call / remainingWeight,
        aaii: aaii / remainingWeight,
    };
    const stress = getVixStressFactor(vixValue);
    if (stress === 0) return base;

    const stressedVix = base.vix + (US_VIX_MAX_WEIGHT - base.vix) * stress;
    const taperedAaii = base.aaii * (1 - 0.35 * stress);
    const nonVixTotal = base.social + base.put_call + taperedAaii;
    const nonVixTarget = 1 - stressedVix;
    return {
        vix: stressedVix,
        social: (base.social / nonVixTotal) * nonVixTarget,
        put_call: (base.put_call / nonVixTotal) * nonVixTarget,
        aaii: (taperedAaii / nonVixTotal) * nonVixTarget,
    };
}

export function normalizeV220Vix(value: number): number {
    const vix = Math.max(5, Math.min(100, value));
    const score = 100 / (1 + Math.exp((vix - 24) / 6));
    return Math.round(score * 100) / 100;
}

export function normalizeV220PutCall(ratio: number): number {
    const lowerBound = 0.55;
    const upperBound = 1.25;
    const clamped = Math.max(lowerBound, Math.min(upperBound, ratio));
    return Math.round(((upperBound - clamped) / (upperBound - lowerBound)) * 100);
}

export function normalizeV220Aaii(value: number): number {
    return Math.min(Math.max((value - 20) / (50 - 20) * 100, 0), 100);
}
