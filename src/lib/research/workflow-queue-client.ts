'use client';

import {
    enqueueResearchWorkflowTask,
    parseResearchWorkflowTasks,
    type ResearchWorkflowEnqueueInput,
    type ResearchWorkflowEnqueueResult,
    type ResearchWorkflowTask,
} from './workflow-queue';

export const RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY = 'signal-research-workflow-queue-v1';
export const RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT = 'signal:research-workflow-queue-change';

export const readResearchWorkflowTasks = (): readonly ResearchWorkflowTask[] => {
    try {
        return parseResearchWorkflowTasks(JSON.parse(localStorage.getItem(RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY) ?? '[]'));
    } catch {
        return [];
    }
};

export const writeResearchWorkflowTasks = (tasks: readonly ResearchWorkflowTask[]) => {
    const validated = parseResearchWorkflowTasks(tasks);
    localStorage.setItem(RESEARCH_WORKFLOW_QUEUE_STORAGE_KEY, JSON.stringify(validated));
    window.dispatchEvent(new CustomEvent(RESEARCH_WORKFLOW_QUEUE_CHANGE_EVENT));
    return validated;
};

export const enqueueResearchWorkflowTaskClient = (
    input: ResearchWorkflowEnqueueInput,
): ResearchWorkflowEnqueueResult => {
    const result = enqueueResearchWorkflowTask(
        readResearchWorkflowTasks(),
        input,
        crypto.randomUUID(),
        new Date().toISOString(),
    );
    return { ...result, tasks: writeResearchWorkflowTasks(result.tasks) };
};
