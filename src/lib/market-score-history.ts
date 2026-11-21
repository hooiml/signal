import { parseMarketReportDate } from './market-observation-date';
import { getUsV220Weights, normalizeV220Aaii, normalizeV220PutCall, normalizeV220Vix } from './market-score-v220';
import type { RecalculatedUsScoreV220 } from './types/signal-v2';

const normalizers = {
    vix: normalizeV220Vix,
    put_call: normalizeV220PutCall,
    aaii: normalizeV220Aaii,
};
type InputKey = keyof typeof normalizers;
const inputKeys: readonly InputKey[] = ['vix', 'put_call', 'aaii'];

function record(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
}

function onOrBeforeSnapshot(value: unknown, snapshotDate: string): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value !== 'string' || !parseMarketReportDate(value.slice(0, 10))) return false;
    const time = Date.parse(value);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) <= snapshotDate;
}

function archivedInput(components: Record<string, unknown>, key: InputKey, snapshotDate: string): number | null {
    const component = record(components[key]);
    const value = component?.raw_value;
    if (!component || typeof value !== 'number' || !Number.isFinite(value)) return null;
    if (key === 'aaii' ? value < 0 || value > 100 : value <= 0) return null;
    if (!onOrBeforeSnapshot(component.last_updated, snapshotDate) || !onOrBeforeSnapshot(component.retrieved_at, snapshotDate)) return null;
    return value;
}

/** Recalculate one archived US Standard score with social off using v2.2.0 inputs and weights. */
export function recalculateUsScoreV220(snapshotDate: string, components: unknown): RecalculatedUsScoreV220 | undefined {
    const archive = record(components);
    if (!archive || !parseMarketReportDate(snapshotDate)) return undefined;
    const inputs = Object.fromEntries(inputKeys.map(key => [key, archivedInput(archive, key, snapshotDate)]));
    const weights = getUsV220Weights(inputs.vix, false);
    const missingInputs: InputKey[] = [];
    let activeWeight = 0;
    let activePoints = 0;
    for (const key of inputKeys) {
        const raw = inputs[key];
        if (raw === null) {
            missingInputs.push(key);
            continue;
        }
        activeWeight += weights[key];
        activePoints += normalizers[key](raw) * weights[key];
    }
    if (missingInputs.length === inputKeys.length) return undefined;
    return {
        score: Math.round(activePoints + Math.max(0, 1 - activeWeight) * 50),
        missing_inputs: missingInputs,
    };
}
