import { researchLayoutWorkspaces, type ResearchLayoutWorkspace } from './saved-layouts';

export const researchPinnedWorkspacesStorageKey = 'signal-research-pinned-workspaces-v1';
export const researchPinnedWorkspaceLimit = 3;

const isWorkspace = (value: unknown): value is ResearchLayoutWorkspace =>
    typeof value === 'string' && researchLayoutWorkspaces.some((workspace) => workspace === value);

// Malformed or unknown entries are dropped; order is the user's pin order.
export const parsePinnedResearchWorkspaces = (value: unknown): readonly ResearchLayoutWorkspace[] => {
    if (!Array.isArray(value)) return [];
    const pins: ResearchLayoutWorkspace[] = [];
    for (const item of value) {
        if (isWorkspace(item) && !pins.includes(item)) pins.push(item);
        if (pins.length === researchPinnedWorkspaceLimit) break;
    }
    return pins;
};

// Pinning past the limit is refused rather than evicting an older pin.
export const togglePinnedResearchWorkspace = (
    current: readonly ResearchLayoutWorkspace[],
    workspace: ResearchLayoutWorkspace,
): readonly ResearchLayoutWorkspace[] => {
    if (current.includes(workspace)) return current.filter((pin) => pin !== workspace);
    if (current.length >= researchPinnedWorkspaceLimit) return current;
    return [...current, workspace];
};

export type ResearchWorkspaceAttention = {
    readonly count: number;
    readonly label: string;
};

// Counts come only from state the dashboard already loaded. A source that has not loaded, or failed,
// yields no badge so a zero is never shown for something that was not checked.
export const buildResearchWorkspaceAttention = (input: {
    readonly incompleteQueueTasks: number | null;
    readonly overdueReviews: number | null;
}): Partial<Record<ResearchLayoutWorkspace, ResearchWorkspaceAttention>> => {
    const attention: Partial<Record<ResearchLayoutWorkspace, ResearchWorkspaceAttention>> = {};
    if (input.incompleteQueueTasks !== null && input.incompleteQueueTasks > 0) {
        attention.queue = { count: input.incompleteQueueTasks, label: `${input.incompleteQueueTasks} incomplete Queue ${input.incompleteQueueTasks === 1 ? 'task' : 'tasks'}` };
    }
    if (input.overdueReviews !== null && input.overdueReviews > 0) {
        attention.calendar = { count: input.overdueReviews, label: `${input.overdueReviews} overdue ${input.overdueReviews === 1 ? 'review' : 'reviews'}` };
    }
    return attention;
};
