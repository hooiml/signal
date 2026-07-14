import {
    defaultResearchMonitoringRules,
    positionStates,
    researchFindingTargets,
    researchFindingTones,
    researchMarkets,
    researchStatuses,
    researchSynthesisModes,
    researchUpdateModes,
    thesisStrengths,
    valuationStates,
    type AcceptedResearchEvidence,
    type InvestmentChecklist,
    type ResearchCreateInput,
    type ResearchEvidence,
    type ResearchUpdateInput,
    type ResearchMonitoringRules,
    type ResearchUpdateMode,
    type ResearchRecord,
    type ResearchReviewSnapshot,
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

const boundedString = (value: unknown, label: string, maxLength: number): string => {
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

const timestampValue = (value: unknown, label: string): string => {
    const timestamp = stringValue(value, label, 40);
    if (Number.isNaN(Date.parse(timestamp))) throw new ResearchInputError(`${label} must be an ISO timestamp.`);
    return timestamp;
};

const sourceUrlValue = (value: unknown, label: string): string => {
    const sourceUrl = stringValue(value, label, 1000);
    let parsed: URL;
    try {
        parsed = new URL(sourceUrl);
    } catch {
        throw new ResearchInputError(`${label} must be a valid URL.`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new ResearchInputError(`${label} must use HTTP or HTTPS.`);
    return sourceUrl;
};

const parseEvidenceSource = (value: unknown, label: string): ResearchEvidence => {
    const source = objectValue(value, label);
    const reportingPeriod = source.reportingPeriod === null
        ? null
        : boundedString(source.reportingPeriod, `${label}.reportingPeriod`, 40);
    return {
        id: stringValue(source.id, `${label}.id`, 120),
        label: stringValue(source.label, `${label}.label`, 160),
        value: stringValue(source.value, `${label}.value`, 500),
        source: stringValue(source.source, `${label}.source`, 160),
        sourceUrl: sourceUrlValue(source.sourceUrl, `${label}.sourceUrl`),
        reportingPeriod,
    };
};

const parseAcceptedEvidence = (value: unknown, label: string): readonly AcceptedResearchEvidence[] => {
    if (!Array.isArray(value)) throw new ResearchInputError(`${label} must be an array.`);
    if (value.length > 50) throw new ResearchInputError(`${label} must contain at most 50 findings.`);
    return value.map((item, index) => {
        const itemLabel = `${label}[${index}]`;
        const evidence = objectValue(item, itemLabel);
        if (!Array.isArray(evidence.sources) || evidence.sources.length === 0 || evidence.sources.length > 12) {
            throw new ResearchInputError(`${itemLabel}.sources must contain 1-12 items.`);
        }
        return {
            id: stringValue(evidence.id, `${itemLabel}.id`, 180),
            title: stringValue(evidence.title, `${itemLabel}.title`, 200),
            summary: stringValue(evidence.summary, `${itemLabel}.summary`, 2000),
            target: optionValue(evidence.target, researchFindingTargets, `${itemLabel}.target`),
            tone: optionValue(evidence.tone, researchFindingTones, `${itemLabel}.tone`),
            mode: optionValue(evidence.mode, researchSynthesisModes, `${itemLabel}.mode`),
            acceptedAt: timestampValue(evidence.acceptedAt, `${itemLabel}.acceptedAt`),
            sources: evidence.sources.map((source, sourceIndex) => parseEvidenceSource(source, `${itemLabel}.sources[${sourceIndex}]`)),
        };
    });
};

const parseChecklist = (value: unknown, label: string): Partial<InvestmentChecklist> => {
    const checklistBody = objectValue(value, label);
    let checklist: Partial<InvestmentChecklist> = {};
    for (const key of checklistKeys) {
        const item = checklistBody[key];
        if (item !== undefined) {
            if (typeof item !== 'boolean') throw new ResearchInputError(`${label}.${key} must be boolean.`);
            checklist = { ...checklist, [key]: item };
        }
    }
    return checklist;
};

const thresholdValue = (value: unknown, label: string, minimum: number, maximum: number): number | null => {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
        throw new ResearchInputError(`${label} must be null or an integer from ${minimum}-${maximum}.`);
    }
    return value;
};

export const parseResearchMonitoringRules = (value: unknown): ResearchMonitoringRules => {
    const rules = objectValue(value, 'monitoringRules');
    const buyZone = rules.buyZone ?? defaultResearchMonitoringRules.buyZone;
    const belowMa200 = rules.belowMa200 ?? defaultResearchMonitoringRules.belowMa200;
    if (typeof buyZone !== 'boolean' || typeof belowMa200 !== 'boolean') throw new ResearchInputError('monitoringRules buyZone and belowMa200 must be boolean.');
    return {
        buyZone,
        belowMa200,
        rsiBelow: thresholdValue(rules.rsiBelow === undefined ? defaultResearchMonitoringRules.rsiBelow : rules.rsiBelow, 'monitoringRules.rsiBelow', 1, 50),
        rsiAbove: thresholdValue(rules.rsiAbove === undefined ? defaultResearchMonitoringRules.rsiAbove : rules.rsiAbove, 'monitoringRules.rsiAbove', 50, 99),
        earningsWithinDays: thresholdValue(rules.earningsWithinDays === undefined ? defaultResearchMonitoringRules.earningsWithinDays : rules.earningsWithinDays, 'monitoringRules.earningsWithinDays', 1, 21),
        reviewAgeDays: thresholdValue(rules.reviewAgeDays === undefined ? defaultResearchMonitoringRules.reviewAgeDays : rules.reviewAgeDays, 'monitoringRules.reviewAgeDays', 1, 365),
    };
};

const parseReviewHistory = (value: unknown): readonly ResearchReviewSnapshot[] => {
    if (!Array.isArray(value)) throw new ResearchInputError('reviewHistory must be an array.');
    if (value.length > 25) throw new ResearchInputError('reviewHistory must contain at most 25 reviews.');
    return value.map((item, index) => {
        const label = `reviewHistory[${index}]`;
        const review = objectValue(item, label);
        const inBuyZone = review.inBuyZone;
        if (typeof inBuyZone !== 'boolean') throw new ResearchInputError(`${label}.inBuyZone must be boolean.`);
        return {
            id: stringValue(review.id, `${label}.id`, 80),
            reviewedAt: timestampValue(review.reviewedAt, `${label}.reviewedAt`),
            positionState: optionValue(review.positionState, positionStates, `${label}.positionState`),
            inBuyZone,
            status: optionValue(review.status, researchStatuses, `${label}.status`),
            targetBuyZone: boundedString(review.targetBuyZone, `${label}.targetBuyZone`, 120),
            valuationState: optionValue(review.valuationState, valuationStates, `${label}.valuationState`),
            thesisStrength: optionValue(review.thesisStrength, thesisStrengths, `${label}.thesisStrength`),
            whyInterested: boundedString(review.whyInterested, `${label}.whyInterested`, 2000),
            bullCase: boundedString(review.bullCase, `${label}.bullCase`, 2000),
            bearCase: boundedString(review.bearCase, `${label}.bearCase`, 2000),
            buyTrigger: boundedString(review.buyTrigger, `${label}.buyTrigger`, 2000),
            sellTrigger: boundedString(review.sellTrigger, `${label}.sellTrigger`, 2000),
            thesisBreak: boundedString(review.thesisBreak, `${label}.thesisBreak`, 2000),
            notes: boundedString(review.notes, `${label}.notes`, 5000),
            checklist: { ...emptyChecklist, ...parseChecklist(review.checklist, `${label}.checklist`) },
            acceptedEvidence: parseAcceptedEvidence(review.acceptedEvidence, `${label}.acceptedEvidence`),
        };
    });
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
    const checklist = body.checklist === undefined ? undefined : parseChecklist(body.checklist, 'checklist');
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
        checklist,
        monitoringRules: body.monitoringRules === undefined ? undefined : parseResearchMonitoringRules(body.monitoringRules),
        acceptedEvidence: body.acceptedEvidence === undefined ? undefined : parseAcceptedEvidence(body.acceptedEvidence, 'acceptedEvidence'),
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
        monitoringRules: update.monitoringRules ?? defaultResearchMonitoringRules,
        acceptedEvidence: update.acceptedEvidence ?? [],
        reviewHistory: body.reviewHistory === undefined ? [] : parseReviewHistory(body.reviewHistory),
        lastReviewedAt,
    };
};

export const parseResearchUpdateMode = (value: unknown): ResearchUpdateMode => {
    const body = objectValue(value, 'Request body');
    return body.mode === undefined ? 'review' : optionValue(body.mode, researchUpdateModes, 'mode');
};
