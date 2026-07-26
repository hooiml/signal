'use client';

import {
    defaultInvestmentPolicy,
    parseInvestmentPolicy,
    type InvestmentPolicy,
} from './investment-policy';

export const INVESTMENT_POLICY_STORAGE_KEY = 'signal-investment-policy-v1';
export const INVESTMENT_POLICY_CHANGE_EVENT = 'signal:investment-policy-change';

export const readInvestmentPolicy = (): InvestmentPolicy => {
    try {
        return parseInvestmentPolicy(JSON.parse(localStorage.getItem(INVESTMENT_POLICY_STORAGE_KEY) ?? 'null'));
    } catch {
        return defaultInvestmentPolicy;
    }
};

export const writeInvestmentPolicy = (policy: InvestmentPolicy): InvestmentPolicy => {
    const parsed = parseInvestmentPolicy(policy);
    localStorage.setItem(INVESTMENT_POLICY_STORAGE_KEY, JSON.stringify(parsed));
    window.dispatchEvent(new CustomEvent(INVESTMENT_POLICY_CHANGE_EVENT));
    return parsed;
};
