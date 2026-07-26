'use client';

import { parsePaperDecisions, type PaperDecision } from './paper-decisions';

export const PAPER_DECISIONS_STORAGE_KEY = 'signal-paper-decisions-v1';

export const loadPaperDecisions = (): readonly PaperDecision[] => {
    try {
        return parsePaperDecisions(JSON.parse(localStorage.getItem(PAPER_DECISIONS_STORAGE_KEY) ?? '[]'));
    } catch {
        return [];
    }
};

export const savePaperDecisions = (decisions: readonly PaperDecision[]) => {
    localStorage.setItem(PAPER_DECISIONS_STORAGE_KEY, JSON.stringify(parsePaperDecisions(decisions)));
};
