import {
    pickerHorizons,
    pickerMaximumPerSector,
    pickerMinimumScores,
    pickerPickCounts,
    pickerRiskProfiles,
    type PickerConfig,
} from './picker';

export const PICKER_PRESETS_STORAGE_KEY = 'signal-picker-presets-v1';
export const PICKER_PRESET_LIMIT = 12;

export type PickerPreset = {
    readonly id: string;
    readonly name: string;
    readonly config: PickerConfig;
    readonly savedAt: string;
};

export type PickerPresetsLoadResult =
    | { readonly status: 'ready'; readonly presets: readonly PickerPreset[] }
    | { readonly status: 'invalid' | 'unavailable'; readonly presets: readonly PickerPreset[]; readonly error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isPickerConfig = (value: unknown): value is PickerConfig => {
    if (!isRecord(value)) return false;
    return (pickerHorizons as readonly string[]).includes(String(value.horizon))
        && (pickerRiskProfiles as readonly string[]).includes(String(value.riskProfile))
        && (pickerMinimumScores as readonly number[]).includes(Number(value.minimumScore))
        && (pickerPickCounts as readonly number[]).includes(Number(value.pickCount))
        && (pickerMaximumPerSector as readonly number[]).includes(Number(value.maximumPerSector))
        && typeof value.excludeSavedSymbols === 'boolean';
};

/**
 * Validates browser-local Stock Picker presets against strict PickerConfig domains.
 */
export function parsePickerPresets(value: unknown): readonly PickerPreset[] {
    if (!Array.isArray(value)) throw new Error('Saved Picker presets must be an array.');
    if (value.length > PICKER_PRESET_LIMIT) {
        throw new Error(`Saved Picker presets exceed the ${PICKER_PRESET_LIMIT}-item limit.`);
    }
    const ids = new Set<string>();
    return value.map((item) => {
        if (!isRecord(item)) throw new Error('A saved Picker preset must be an object.');
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        const savedAt = typeof item.savedAt === 'string' ? item.savedAt : '';
        if (!id || id.length > 80 || ids.has(id)) throw new Error('Saved Picker preset id is invalid.');
        ids.add(id);
        if (!name || name.length > 40) throw new Error('Saved Picker preset name must be 1–40 characters.');
        if (!Number.isFinite(Date.parse(savedAt))) throw new Error('Saved Picker preset timestamp is invalid.');
        if (!isPickerConfig(item.config)) throw new Error('Saved Picker preset configuration is invalid.');
        return {
            id,
            name,
            config: {
                horizon: item.config.horizon,
                riskProfile: item.config.riskProfile,
                minimumScore: item.config.minimumScore,
                pickCount: item.config.pickCount,
                maximumPerSector: item.config.maximumPerSector,
                excludeSavedSymbols: item.config.excludeSavedSymbols,
            },
            savedAt: new Date(savedAt).toISOString(),
        };
    });
}

function makePresetId(name: string, nowIso: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'preset';
    const stamp = Date.parse(nowIso);
    const suffix = Number.isFinite(stamp) ? stamp.toString(36) : 'local';
    return `${slug}-${suffix}`.slice(0, 64);
}

/**
 * Adds or updates a named preset (case-insensitive match on name) and bounds to 12 items.
 */
export function addPickerPreset(
    presets: readonly PickerPreset[],
    rawName: string,
    config: PickerConfig,
    nowIso: string,
): readonly PickerPreset[] {
    const name = rawName.trim();
    if (!name || name.length > 40) {
        throw new Error('Preset name must be between 1 and 40 characters.');
    }
    if (!Number.isFinite(Date.parse(nowIso))) {
        throw new Error('Preset timestamp is invalid.');
    }
    const existing = presets.find(item => item.name.toLowerCase() === name.toLowerCase());
    const entry: PickerPreset = {
        id: existing?.id ?? makePresetId(name, nowIso),
        name,
        config: { ...config },
        savedAt: new Date(nowIso).toISOString(),
    };
    const next = [
        entry,
        ...presets.filter(item => item.name.toLowerCase() !== name.toLowerCase()),
    ].slice(0, PICKER_PRESET_LIMIT);
    return parsePickerPresets(next);
}

/**
 * Removes a browser-local Picker preset by id without mutating input arrays.
 */
export function removePickerPreset(presets: readonly PickerPreset[], id: string): readonly PickerPreset[] {
    return presets.filter(item => item.id !== id);
}

/**
 * Reads Stock Picker presets from browser localStorage without mutating corrupt or blocked storage.
 */
export function loadPickerPresets(): PickerPresetsLoadResult {
    let raw: string | null;
    try {
        raw = window.localStorage.getItem(PICKER_PRESETS_STORAGE_KEY);
    } catch {
        return {
            status: 'unavailable',
            presets: [],
            error: 'Browser storage is unavailable on this device; presets are session-only.',
        };
    }
    if (raw === null) return { status: 'ready', presets: [] };
    try {
        return { status: 'ready', presets: parsePickerPresets(JSON.parse(raw)) };
    } catch (error) {
        return {
            status: 'invalid',
            presets: [],
            error: error instanceof Error
                ? `Saved presets on this device could not be read (${error.message}). Original storage was left untouched.`
                : 'Saved presets on this device could not be read. Original storage was left untouched.',
        };
    }
}

/**
 * Persists Stock Picker presets to browser localStorage, catching blocked/quota errors cleanly.
 */
export function savePickerPresets(presets: readonly PickerPreset[]): { readonly ok: boolean; readonly error?: string } {
    try {
        const validated = parsePickerPresets(presets);
        window.localStorage.setItem(PICKER_PRESETS_STORAGE_KEY, JSON.stringify(validated));
        return { ok: true };
    } catch {
        return {
            ok: false,
            error: 'Browser storage is unavailable or full; preset changes were kept for this session only.',
        };
    }
}
