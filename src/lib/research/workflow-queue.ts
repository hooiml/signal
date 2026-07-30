import type { ResearchFindingTarget } from '../types/research';

export const researchWorkflowTemplateIds = [
    'new-idea',
    'earnings-update',
    'valuation-refresh',
    'thesis-challenge',
    'post-event',
] as const;

export type ResearchWorkflowTemplateId = typeof researchWorkflowTemplateIds[number];
export type ResearchWorkflowTextField = Extract<ResearchFindingTarget, 'whyInterested' | 'bullCase' | 'bearCase' | 'thesisBreak' | 'buyTrigger' | 'sellTrigger' | 'notes'>;

export const researchWorkflowSources = [
    'manual',
    'thesis-change',
    'evidence-coverage',
    'policy-guardrail',
    'document-diff',
    'calendar',
    'alert',
    'structured-trigger',
    'market-exposure',
    'factor-exposure',
    'dividend-cashflow',
    'portfolio-holdings',
] as const;

export type ResearchWorkflowSource = typeof researchWorkflowSources[number];

export type ResearchWorkflowTemplate = {
    readonly id: ResearchWorkflowTemplateId;
    readonly name: string;
    readonly description: string;
    readonly fields: readonly ResearchWorkflowTextField[];
};

export type ResearchWorkflowTask = {
    readonly id: string;
    readonly symbol: string;
    readonly templateId: ResearchWorkflowTemplateId;
    readonly source: ResearchWorkflowSource;
    readonly dedupeKey: string | null;
    readonly dueAt: string | null;
    readonly createdAt: string;
    readonly completedAt: string | null;
};

export const researchWorkflowTemplates: readonly ResearchWorkflowTemplate[] = [
    {
        id: 'new-idea',
        name: 'New idea',
        description: 'Build the complete thesis, triggers, invalidation, notes, checklist, and decision.',
        fields: ['whyInterested', 'bullCase', 'bearCase', 'thesisBreak', 'buyTrigger', 'sellTrigger', 'notes'],
    },
    {
        id: 'earnings-update',
        name: 'Earnings update',
        description: 'Reconcile reported evidence with the bull case, bear case, invalidation, and notes.',
        fields: ['bullCase', 'bearCase', 'thesisBreak', 'notes'],
    },
    {
        id: 'valuation-refresh',
        name: 'Valuation refresh',
        description: 'Refresh valuation state, target zone, notes, checklist, and the resulting decision.',
        fields: ['notes'],
    },
    {
        id: 'thesis-challenge',
        name: 'Thesis challenge',
        description: 'Pressure-test the bull case, bear case, invalidation, and review notes.',
        fields: ['bullCase', 'bearCase', 'thesisBreak', 'notes'],
    },
    {
        id: 'post-event',
        name: 'Post-event review',
        description: 'Update both cases, triggers, invalidation, notes, checklist, and decision after an event.',
        fields: ['bullCase', 'bearCase', 'buyTrigger', 'sellTrigger', 'thesisBreak', 'notes'],
    },
];

export const isResearchWorkflowTemplateId = (value: unknown): value is ResearchWorkflowTemplateId =>
    typeof value === 'string' && researchWorkflowTemplateIds.includes(value as ResearchWorkflowTemplateId);

export const isResearchWorkflowSource = (value: unknown): value is ResearchWorkflowSource =>
    typeof value === 'string' && researchWorkflowSources.includes(value as ResearchWorkflowSource);

const validTimestamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
const validDate = (value: unknown): value is string | null => value === null || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()));

export const parseResearchWorkflowTasks = (value: unknown): readonly ResearchWorkflowTask[] => {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): ResearchWorkflowTask[] => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
        const entry = Object.fromEntries(Object.entries(item));
        const source = entry.source === undefined ? 'manual' : entry.source;
        if (typeof entry.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(entry.id)
            || typeof entry.symbol !== 'string' || !/^[A-Z0-9.-]{1,20}$/.test(entry.symbol)
            || !isResearchWorkflowTemplateId(entry.templateId)
            || !isResearchWorkflowSource(source)
            || (entry.dedupeKey !== undefined && entry.dedupeKey !== null
                && (typeof entry.dedupeKey !== 'string' || !/^[A-Za-z0-9:._-]{1,180}$/.test(entry.dedupeKey)))
            || !validDate(entry.dueAt) || !validTimestamp(entry.createdAt)
            || (entry.completedAt !== null && !validTimestamp(entry.completedAt))) return [];
        return [{
            id: entry.id,
            symbol: entry.symbol,
            templateId: entry.templateId,
            source,
            dedupeKey: typeof entry.dedupeKey === 'string' ? entry.dedupeKey : null,
            dueAt: entry.dueAt,
            createdAt: entry.createdAt,
            completedAt: entry.completedAt,
        }];
    }).slice(-100);
};

export const upsertResearchWorkflowTask = (
    tasks: readonly ResearchWorkflowTask[],
    task: ResearchWorkflowTask,
): readonly ResearchWorkflowTask[] => [...tasks.filter((item) => item.id !== task.id), task].slice(-100);

export type ResearchWorkflowEnqueueInput = {
    readonly symbol: string;
    readonly templateId: ResearchWorkflowTemplateId;
    readonly source: Exclude<ResearchWorkflowSource, 'manual'>;
    readonly dedupeKey?: string;
    readonly dueAt: string | null;
};

export type ResearchWorkflowEnqueueResult = {
    readonly tasks: readonly ResearchWorkflowTask[];
    readonly task: ResearchWorkflowTask;
    readonly created: boolean;
};

export const enqueueResearchWorkflowTask = (
    tasks: readonly ResearchWorkflowTask[],
    input: ResearchWorkflowEnqueueInput,
    id: string,
    createdAt: string,
): ResearchWorkflowEnqueueResult => {
    const existing = tasks.find((task) => task.completedAt === null
        && (input.dedupeKey
            ? task.dedupeKey === input.dedupeKey
            : task.symbol === input.symbol
                && task.templateId === input.templateId
                && task.source === input.source));
    if (existing) {
        const dueAt = [existing.dueAt, input.dueAt]
            .filter((value): value is string => value !== null)
            .sort()[0] ?? null;
        const task = dueAt === existing.dueAt ? existing : { ...existing, dueAt };
        return { tasks: upsertResearchWorkflowTask(tasks, task), task, created: false };
    }
    const task: ResearchWorkflowTask = {
        id,
        symbol: input.symbol,
        templateId: input.templateId,
        source: input.source,
        dedupeKey: input.dedupeKey ?? null,
        dueAt: input.dueAt,
        createdAt,
        completedAt: null,
    };
    return { tasks: upsertResearchWorkflowTask(tasks, task), task, created: true };
};

export const sortResearchWorkflowTasks = (
    tasks: readonly ResearchWorkflowTask[],
): readonly ResearchWorkflowTask[] => [...tasks].sort((left, right) =>
    Number(left.completedAt !== null) - Number(right.completedAt !== null)
    || (left.dueAt ?? '9999-12-31').localeCompare(right.dueAt ?? '9999-12-31')
    || left.createdAt.localeCompare(right.createdAt));

export const getResearchWorkflowTemplate = (id: ResearchWorkflowTemplateId): ResearchWorkflowTemplate =>
    researchWorkflowTemplates.find((template) => template.id === id) ?? researchWorkflowTemplates[0];
