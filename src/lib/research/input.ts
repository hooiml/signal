import {
    positionStates,
    researchMarkets,
    researchStatuses,
    thesisStrengths,
    valuationStates,
    type InvestmentChecklist,
    type ResearchCreateInput,
    type ResearchUpdateInput,
    type ResearchRecord,
} from '../types/research';
import { createResearchRecord, emptyChecklist } from './records';

const checklistKeys = [
    'understandBusiness', 'revenueGrowingOrStable', 'marginsHealthyOrImproving',
    'debtManageable', 'freeCashFlowPositiveOrImproving', 'valuationReasonable',
    'catalystOrCompoundingReason', 'downsideAcceptable', 'betterThanCashOrIndex',
] as const satisfies readonly (keyof InvestmentChecklist)[];

export class ResearchInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchInputError';
    }
}

const objectValue = (value: unknown, label: string): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ResearchInputError(`${label} must be an object.`);
    return Object.fromEntries(Object.entries(value));
};

const stringValue = (value: unknown, label: string, maxLength: number): string => {
    if (typeof value !== 'string') throw new ResearchInputError(`${label} must be a string.`);
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) throw new ResearchInputError(`${label} must contain 1-${maxLength} characters.`);
    return trimmed;
};

const optionalString = (value: unknown, label: string, maxLength: number): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new ResearchInputError(`${label} must be a string.`);
    const trimmed = value.trim();
    if (trimmed.length > maxLength) throw new ResearchInputError(`${label} must be at most ${maxLength} characters.`);
    return trimmed;
};

const optionValue = <T extends string>(value: unknown, values: readonly T[], label: string): T => {
    if (typeof value === 'string') {
        for (const item of values) {
            if (item === value) return item;
        }
    }
    throw new ResearchInputError(`${label} is invalid.`);
};

export const parseResearchCreateInput = (value: unknown): ResearchCreateInput => {
    const body = objectValue(value, 'Request body');
    const symbol = stringValue(body.symbol, 'symbol', 20).toUpperCase();
    if (!/^[A-Z0-9.-]+$/.test(symbol)) throw new ResearchInputError('symbol contains unsupported characters.');
    return {
        symbol,
        market: optionValue(body.market, researchMarkets, 'market'),
        companyName: stringValue(body.companyName, 'companyName', 120),
    };
};

export const parseResearchUpdateInput = (value: unknown): ResearchUpdateInput => {
    const body = objectValue(value, 'Request body');
    const checklistBody = body.checklist === undefined ? undefined : objectValue(body.checklist, 'checklist');
    let checklist: Partial<InvestmentChecklist> = {};
    if (checklistBody) {
        for (const key of checklistKeys) {
            const item = checklistBody[key];
            if (item !== undefined) {
                if (typeof item !== 'boolean') throw new ResearchInputError(`checklist.${key} must be boolean.`);
                checklist = { ...checklist, [key]: item };
            }
        }
    }
    const booleanField = (key: 'inBuyZone'): boolean | undefined => {
        const item = body[key];
        if (item !== undefined && typeof item !== 'boolean') throw new ResearchInputError(`${key} must be boolean.`);
        return item;
    };
    return {
        companyName: optionalString(body.companyName, 'companyName', 120),
        positionState: body.positionState === undefined ? undefined : optionValue(body.positionState, positionStates, 'positionState'),
        inBuyZone: booleanField('inBuyZone'),
        status: body.status === undefined ? undefined : optionValue(body.status, researchStatuses, 'status'),
        targetBuyZone: optionalString(body.targetBuyZone, 'targetBuyZone', 120),
        valuationState: body.valuationState === undefined ? undefined : optionValue(body.valuationState, valuationStates, 'valuationState'),
        thesisStrength: body.thesisStrength === undefined ? undefined : optionValue(body.thesisStrength, thesisStrengths, 'thesisStrength'),
        whyInterested: optionalString(body.whyInterested, 'whyInterested', 2000),
        bullCase: optionalString(body.bullCase, 'bullCase', 2000),
        bearCase: optionalString(body.bearCase, 'bearCase', 2000),
        buyTrigger: optionalString(body.buyTrigger, 'buyTrigger', 2000),
        sellTrigger: optionalString(body.sellTrigger, 'sellTrigger', 2000),
        thesisBreak: optionalString(body.thesisBreak, 'thesisBreak', 2000),
        notes: optionalString(body.notes, 'notes', 5000),
        checklist: checklistBody ? checklist : undefined,
    };
};

export const parseResearchRecord = (value: unknown): ResearchRecord => {
    const body = objectValue(value, 'Research record');
    const identity = parseResearchCreateInput(body);
    const update = parseResearchUpdateInput(body);
    const lastReviewedAt = stringValue(body.lastReviewedAt, 'lastReviewedAt', 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastReviewedAt)) throw new ResearchInputError('lastReviewedAt must use YYYY-MM-DD.');
    return {
        ...createResearchRecord(identity),
        ...update,
        checklist: { ...emptyChecklist, ...update.checklist },
        lastReviewedAt,
    };
};
