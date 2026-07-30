'use client';

import {
    parseResearchVisitSnapshot,
    parseTodayContinuation,
    type ResearchVisitSnapshot,
    type TodayContinuation,
} from './since-last-visit';

export const RESEARCH_VISIT_STORAGE_KEY = 'signal-research-visit-v1';
export const TODAY_CONTINUATION_STORAGE_KEY = 'signal-research-today-continuation-v1';

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

export const readTodayContinuation = (): TodayContinuation | null => {
    try {
        return parseTodayContinuation(JSON.parse(
            window.localStorage.getItem(TODAY_CONTINUATION_STORAGE_KEY) ?? 'null',
        ));
    } catch {
        return null;
    }
};

export const writeTodayContinuation = (
    continuation: TodayContinuation | null,
): TodayContinuation | null => {
    if (!continuation) return null;
    const parsed = parseTodayContinuation(continuation);
    if (!parsed) return null;
    try {
        window.localStorage.setItem(TODAY_CONTINUATION_STORAGE_KEY, JSON.stringify(parsed));
        return parsed;
    } catch {
        return null;
    }
};
