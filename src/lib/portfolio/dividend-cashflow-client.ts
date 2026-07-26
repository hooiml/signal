'use client';

import {
    migrateDividendCashFlowSnapshot,
    parseDividendCashFlowSnapshot,
} from './dividend-cashflow';
import type { DividendCashFlowSnapshot } from '../types/dividend-cashflow';

export const DIVIDEND_CASH_FLOW_STORAGE_KEY = 'signal-dividend-cashflow-v1';
export const DIVIDEND_CASH_FLOW_CHANGE_EVENT = 'signal:dividend-cashflow-change';

export type DividendCashFlowLoadResult =
    | { readonly status: 'empty'; readonly snapshot: DividendCashFlowSnapshot }
    | { readonly status: 'ready'; readonly snapshot: DividendCashFlowSnapshot }
    | { readonly status: 'invalid' | 'unavailable'; readonly snapshot: null; readonly message: string };

export const loadDividendCashFlowSnapshot = (): DividendCashFlowLoadResult => {
    let stored: string | null;
    try {
        stored = window.localStorage.getItem(DIVIDEND_CASH_FLOW_STORAGE_KEY);
    } catch {
        return {
            status: 'unavailable',
            snapshot: null,
            message: 'Dividend and cash-flow browser storage is unavailable.',
        };
    }
    if (stored === null) return { status: 'empty', snapshot: migrateDividendCashFlowSnapshot(null) };
    try {
        return { status: 'ready', snapshot: parseDividendCashFlowSnapshot(JSON.parse(stored)) };
    } catch (error) {
        return {
            status: 'invalid',
            snapshot: null,
            message: error instanceof Error
                ? `Saved dividend and cash-flow data is invalid: ${error.message}`
                : 'Saved dividend and cash-flow data is invalid.',
        };
    }
};

export const saveDividendCashFlowSnapshot = (snapshot: DividendCashFlowSnapshot): DividendCashFlowSnapshot => {
    const parsed = parseDividendCashFlowSnapshot(snapshot);
    try {
        window.localStorage.setItem(DIVIDEND_CASH_FLOW_STORAGE_KEY, JSON.stringify(parsed));
        window.dispatchEvent(new CustomEvent(DIVIDEND_CASH_FLOW_CHANGE_EVENT));
        return parsed;
    } catch {
        throw new Error('Browser storage is unavailable. The planning event was not saved.');
    }
};
