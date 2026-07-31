'use client';

import {
    FIRST_RUN_SETUP_STORAGE_KEY,
    parseFirstRunSetupState,
    type FirstRunSetupState,
} from './first-run';

export type FirstRunSetupReadResult =
    | { readonly status: 'missing'; readonly state: null }
    | { readonly status: 'ready'; readonly state: FirstRunSetupState }
    | { readonly status: 'invalid' | 'unavailable'; readonly state: null; readonly message: string };

export const readFirstRunSetupState = (): FirstRunSetupReadResult => {
    let stored: string | null;
    try {
        stored = window.localStorage.getItem(FIRST_RUN_SETUP_STORAGE_KEY);
    } catch {
        return {
            status: 'unavailable',
            state: null,
            message: 'Browser storage is unavailable. Setup actions still work, but progress cannot be resumed.',
        };
    }
    if (stored === null) return { status: 'missing', state: null };
    try {
        return { status: 'ready', state: parseFirstRunSetupState(JSON.parse(stored)) };
    } catch (error) {
        return {
            status: 'invalid',
            state: null,
            message: error instanceof Error
                ? `Saved setup progress is invalid: ${error.message}`
                : 'Saved setup progress is invalid.',
        };
    }
};

export const writeFirstRunSetupState = (stateInput: FirstRunSetupState): FirstRunSetupState => {
    const state = parseFirstRunSetupState(stateInput);
    try {
        window.localStorage.setItem(FIRST_RUN_SETUP_STORAGE_KEY, JSON.stringify(state));
        window.dispatchEvent(new CustomEvent('signal:first-run-setup-change'));
    } catch {
        throw new Error('Browser storage is unavailable. Setup progress was not saved.');
    }
    return state;
};

export const clearFirstRunSetupState = (): void => {
    try {
        window.localStorage.removeItem(FIRST_RUN_SETUP_STORAGE_KEY);
        window.dispatchEvent(new CustomEvent('signal:first-run-setup-change'));
    } catch {
        throw new Error('Browser storage is unavailable. Setup progress was not cleared.');
    }
};
