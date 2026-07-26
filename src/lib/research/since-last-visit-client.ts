'use client';

import {
    parseResearchVisitSnapshot,
    type ResearchVisitSnapshot,
} from './since-last-visit';

export const RESEARCH_VISIT_STORAGE_KEY = 'signal-research-visit-v1';

export const readResearchVisitSnapshot = (): ResearchVisitSnapshot | null => {
    try {
        return parseResearchVisitSnapshot(JSON.parse(
            window.localStorage.getItem(RESEARCH_VISIT_STORAGE_KEY) ?? 'null',
        ));
    } catch {
        return null;
    }
};

export const writeResearchVisitSnapshot = (
    snapshot: ResearchVisitSnapshot,
): ResearchVisitSnapshot => {
    const parsed = parseResearchVisitSnapshot(snapshot);
    if (!parsed) throw new Error('Invalid research visit snapshot.');
    window.localStorage.setItem(RESEARCH_VISIT_STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
};
