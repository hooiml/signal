'use client';

import { parsePortfolioTransactionSnapshot } from './transactions';
import type { PortfolioTransactionSnapshot } from '../types/portfolio-transactions';

export const PORTFOLIO_TRANSACTIONS_STORAGE_KEY = 'signal-portfolio-transactions-v1';
export const PORTFOLIO_TRANSACTIONS_CHANGE_EVENT = 'signal:portfolio-transactions-change';

export type PortfolioTransactionsLoadResult =
    | { readonly status: 'empty'; readonly snapshot: null }
    | { readonly status: 'ready'; readonly snapshot: PortfolioTransactionSnapshot }
    | { readonly status: 'invalid' | 'unavailable'; readonly snapshot: null; readonly message: string };

export const loadPortfolioTransactionSnapshot = (): PortfolioTransactionsLoadResult => {
    let stored: string | null;
    try {
        stored = window.localStorage.getItem(PORTFOLIO_TRANSACTIONS_STORAGE_KEY);
    } catch {
        return {
            status: 'unavailable',
            snapshot: null,
            message: 'Browser storage is unavailable. You can preview a CSV, but it cannot be saved in this browser.',
        };
    }
    if (stored === null) return { status: 'empty', snapshot: null };
    try {
        return { status: 'ready', snapshot: parsePortfolioTransactionSnapshot(JSON.parse(stored)) };
    } catch (error) {
        return {
            status: 'invalid',
            snapshot: null,
            message: error instanceof Error
                ? `Saved transaction data is invalid: ${error.message}`
                : 'Saved transaction data is invalid.',
        };
    }
};

export const savePortfolioTransactionSnapshot = (snapshot: PortfolioTransactionSnapshot): void => {
    const validated = parsePortfolioTransactionSnapshot(snapshot);
    try {
        window.localStorage.setItem(PORTFOLIO_TRANSACTIONS_STORAGE_KEY, JSON.stringify(validated));
        window.dispatchEvent(new CustomEvent(PORTFOLIO_TRANSACTIONS_CHANGE_EVENT));
    } catch {
        throw new Error('Browser storage is unavailable. The transaction snapshot was not saved.');
    }
};
