'use client';

import { parsePickerRuns, type PickerRun } from './picker';

export const PICKER_RUNS_STORAGE_KEY = 'signal-picker-runs-v1';

export const loadPickerRuns = (): readonly PickerRun[] => {
    try {
        return parsePickerRuns(JSON.parse(localStorage.getItem(PICKER_RUNS_STORAGE_KEY) ?? '[]'));
    } catch {
        return [];
    }
};

export const savePickerRuns = (runs: readonly PickerRun[]): boolean => {
    try {
        localStorage.setItem(PICKER_RUNS_STORAGE_KEY, JSON.stringify(parsePickerRuns(runs)));
        return true;
    } catch {
        return false;
    }
};
