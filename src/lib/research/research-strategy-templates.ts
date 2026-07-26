import type { ResearchWorkflowTextField } from './workflow-queue';

export const researchStrategyTemplateIds = [
    'core',
    'quality-compounder',
    'growth',
    'value',
    'income',
    'turnaround',
] as const;

export type ResearchStrategyTemplateId = typeof researchStrategyTemplateIds[number];

export type ResearchStrategyTemplate = {
    readonly id: ResearchStrategyTemplateId;
    readonly name: string;
    readonly description: string;
    readonly fieldPrompts: Readonly<Record<ResearchWorkflowTextField, string>>;
    readonly evidenceFocus: readonly string[];
};

export const researchStrategyTemplates: readonly ResearchStrategyTemplate[] = [
    {
        id: 'core',
        name: 'Core research',
        description: 'Use the complete decision framework without assuming a specific investment strategy.',
        fieldPrompts: {
            whyInterested: 'Why does this security deserve research now?',
            bullCase: 'Which evidenced developments could make the thesis work?',
            bearCase: 'Which evidenced risks could make the thesis disappoint?',
            thesisBreak: 'Which observable fact would invalidate the thesis?',
            buyTrigger: 'What evidence and price conditions must be present before acting?',
            sellTrigger: 'What evidence, valuation, or risk change would justify exiting?',
            notes: 'What changed, what remains uncertain, and what needs verification next?',
        },
        evidenceFocus: ['Business model and competitive position', 'Financial trend and balance sheet', 'Valuation, catalysts, and downside'],
    },
    {
        id: 'quality-compounder',
        name: 'Quality compounder',
        description: 'Test whether durable reinvestment, margins, and cash generation can compound without relying on multiple expansion.',
        fieldPrompts: {
            whyInterested: 'What durable advantage and reinvestment runway make this a potential compounder?',
            bullCase: 'How could returns on reinvested capital, margins, and free cash flow compound?',
            bearCase: 'What could erode the moat, reinvestment runway, pricing power, or capital allocation?',
            thesisBreak: 'Which deterioration in unit economics, cash conversion, or competitive position would break the thesis?',
            buyTrigger: 'What quality evidence and valuation margin are required before acting?',
            sellTrigger: 'Which moat, reinvestment, governance, or valuation change would justify exiting?',
            notes: 'What evidence distinguishes durable compounding from a temporarily strong cycle?',
        },
        evidenceFocus: ['Multi-period organic growth and margins', 'Free-cash-flow conversion and reinvestment', 'Moat durability and capital allocation'],
    },
    {
        id: 'growth',
        name: 'Growth',
        description: 'Separate durable growth from expectations, dilution, fragile unit economics, and cyclical acceleration.',
        fieldPrompts: {
            whyInterested: 'What product, market, or adoption change could support durable growth?',
            bullCase: 'What evidence supports the growth runway and improving economics?',
            bearCase: 'How could competition, saturation, cyclicality, or funding needs slow growth?',
            thesisBreak: 'Which growth, retention, margin, or cash-burn threshold would invalidate the thesis?',
            buyTrigger: 'What growth durability and valuation evidence must be present before acting?',
            sellTrigger: 'Which deceleration, dilution, unit-economics, or expectation change would justify exiting?',
            notes: 'How much of the expected growth is already reflected in valuation?',
        },
        evidenceFocus: ['Organic growth and demand durability', 'Margins, cash burn, and dilution', 'Valuation implied expectations'],
    },
    {
        id: 'value',
        name: 'Value',
        description: 'Test whether apparent cheapness reflects recoverable earning power rather than structural impairment.',
        fieldPrompts: {
            whyInterested: 'What makes the security appear mispriced against normalized earning power or assets?',
            bullCase: 'What evidence could close the gap between price and conservative value?',
            bearCase: 'Why might the low valuation be justified or become a value trap?',
            thesisBreak: 'Which impairment, leverage, governance, or earning-power fact would invalidate the valuation case?',
            buyTrigger: 'What margin of safety and catalyst evidence are required before acting?',
            sellTrigger: 'Which realization of value, impairment, or thesis change would justify exiting?',
            notes: 'Which normalized assumptions matter most, and how sensitive is value to them?',
        },
        evidenceFocus: ['Normalized earnings or asset value', 'Balance-sheet and governance risk', 'Catalyst and margin of safety'],
    },
    {
        id: 'income',
        name: 'Income',
        description: 'Test distribution durability, coverage, balance-sheet resilience, and total-return tradeoffs.',
        fieldPrompts: {
            whyInterested: 'What makes the income stream attractive relative to its risks and alternatives?',
            bullCase: 'What evidence supports durable or growing distributions and total return?',
            bearCase: 'What could pressure coverage, cash generation, refinancing, or distributions?',
            thesisBreak: 'Which coverage, leverage, cash-flow, or policy change would invalidate the income thesis?',
            buyTrigger: 'What yield, coverage, and balance-sheet conditions are required before acting?',
            sellTrigger: 'Which distribution risk, leverage change, or relative-value shift would justify exiting?',
            notes: 'How do distributions, taxes, currency, and price risk affect expected total return?',
        },
        evidenceFocus: ['Distribution coverage and cash generation', 'Leverage and refinancing schedule', 'Yield versus total-return alternatives'],
    },
    {
        id: 'turnaround',
        name: 'Turnaround',
        description: 'Require observable milestones, liquidity runway, and downside controls before treating recovery as evidence.',
        fieldPrompts: {
            whyInterested: 'What specific operational or financial change could make recovery plausible now?',
            bullCase: 'Which measurable milestones would demonstrate a real turnaround?',
            bearCase: 'How could execution, liquidity, leverage, or industry pressure derail recovery?',
            thesisBreak: 'Which missed milestone, cash threshold, or balance-sheet event would invalidate the turnaround?',
            buyTrigger: 'Which verified milestone and downside buffer are required before acting?',
            sellTrigger: 'Which recovery milestone, setback, refinancing, or valuation change would justify exiting?',
            notes: 'What is the timeline, funding runway, and next externally verifiable milestone?',
        },
        evidenceFocus: ['Milestones and leading operating indicators', 'Liquidity runway and refinancing risk', 'Management execution and downside recovery value'],
    },
];

export const getResearchStrategyTemplate = (value: unknown): ResearchStrategyTemplate =>
    researchStrategyTemplates.find((template) => template.id === value) ?? researchStrategyTemplates[0];
