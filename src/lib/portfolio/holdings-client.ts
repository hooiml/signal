'use client';

import { parsePortfolioHoldingsSnapshot } from './holdings';
import type { PortfolioHoldingsSnapshot } from '../types/portfolio-holdings';

export const PORTFOLIO_HOLDINGS_STORAGE_KEY = 'signal-portfolio-holdings-v1';
export const PORTFOLIO_HOLDINGS_CHANGE_EVENT = 'signal:portfolio-holdings-change';

export type PortfolioHoldingsLoadResult =
    | { readonly status: 'empty'; readonly snapshot: null }
    | { readonly status: 'ready'; readonly snapshot: PortfolioHoldingsSnapshot }
    | { readonly status: 'invalid' | 'unavailable'; readonly snapshot: null; readonly message: string };

export const loadPortfolioHoldingsSnapshot = (): PortfolioHoldingsLoadResult => {
    let stored: string | null;
    try {
        stored = window.localStorage.getItem(PORTFOLIO_HOLDINGS_STORAGE_KEY);
    } catch {
        return {
            status: 'unavailable',
            snapshot: null,
            message: 'Browser storage is unavailable. You can preview a CSV, but it cannot be saved in this browser.',
        };
    }
    if (stored === null) return { status: 'empty', snapshot: null };
    try {
        return { status: 'ready', snapshot: parsePortfolioHoldingsSnapshot(JSON.parse(stored)) };
    } catch (error) {
        return {
            status: 'invalid',
            snapshot: null,
            message: error instanceof Error
                ? `Saved portfolio data is invalid: ${error.message}`
                : 'Saved portfolio data is invalid.',
        };
    }
};

export const savePortfolioHoldingsSnapshot = (snapshot: PortfolioHoldingsSnapshot): void => {
    const validated = parsePortfolioHoldingsSnapshot(snapshot);
    try {
        window.localStorage.setItem(PORTFOLIO_HOLDINGS_STORAGE_KEY, JSON.stringify(validated));
        window.dispatchEvent(new CustomEvent(PORTFOLIO_HOLDINGS_CHANGE_EVENT));
    } catch {
        throw new Error('Browser storage is unavailable. The portfolio snapshot was not saved.');
    }
};
