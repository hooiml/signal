'use client';

import {
    parseSavedPortfolioScenarios,
    type SavedPortfolioScenario,
} from './scenario-library';

export const PORTFOLIO_SCENARIO_LIBRARY_STORAGE_KEY = 'signal-portfolio-scenario-library-v1';

export const loadSavedPortfolioScenarios = (): readonly SavedPortfolioScenario[] => {
    try {
        return parseSavedPortfolioScenarios(JSON.parse(localStorage.getItem(PORTFOLIO_SCENARIO_LIBRARY_STORAGE_KEY) ?? '[]'));
    } catch {
        return [];
    }
};

export const saveSavedPortfolioScenarios = (scenarios: readonly SavedPortfolioScenario[]) => {
    const validated = parseSavedPortfolioScenarios(scenarios);
    localStorage.setItem(PORTFOLIO_SCENARIO_LIBRARY_STORAGE_KEY, JSON.stringify(validated));
};
