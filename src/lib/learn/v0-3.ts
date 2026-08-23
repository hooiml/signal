export const investmentModuleIdsV03 = [
    'valuation-frameworks',
    'multiple-change',
    'business-quality',
    'capital-allocation',
    'rates-yields',
    'inflation-cycle',
    'narrative',
    'catalysts',
    'thesis',
    'scenarios',
    'portfolio',
    'risk',
    'behavior',
    'journal',
] as const;

export type InvestmentModuleIdV03 = typeof investmentModuleIdsV03[number];

export const investmentModulesV03: readonly {
    readonly id: InvestmentModuleIdV03;
    readonly eyebrow: string;
    readonly title: string;
    readonly objective: string;
}[] = [
    { id: 'valuation-frameworks', eyebrow: '2.1', title: 'Valuation frameworks', objective: 'Choose a useful valuation denominator for the economics of the business.' },
    { id: 'multiple-change', eyebrow: '2.2', title: 'Multiple expansion & compression', objective: 'Separate changes in business earnings from changes in what investors are willing to pay.' },
    { id: 'business-quality', eyebrow: '2.3', title: 'Business quality', objective: 'Evaluate durability, concentration, capital intensity, and competitive advantages without turning quality into a Buy rule.' },
    { id: 'capital-allocation', eyebrow: '2.4', title: 'Management & capital allocation', objective: 'Judge reinvestment, buybacks, dividends, debt, and acquisitions relative to opportunity cost.' },
    { id: 'rates-yields', eyebrow: '2.5', title: 'Rates & Treasury yields', objective: 'Understand why a higher required return can pressure valuation without implying every stock must fall.' },
    { id: 'inflation-cycle', eyebrow: '2.6', title: 'Inflation & the economic cycle', objective: 'Interpret macro data through second-order effects rather than deterministic thresholds.' },
    { id: 'narrative', eyebrow: '2.7', title: 'Narrative & sentiment evidence', objective: 'Decompose narrative into observable evidence instead of relying on a black-box sentiment label.' },
    { id: 'catalysts', eyebrow: '2.8', title: 'Catalysts', objective: 'Distinguish events that may change expectations from the underlying investment thesis.' },
    { id: 'thesis', eyebrow: '2.9', title: 'Investment thesis', objective: 'Build a falsifiable view that includes contrary evidence, uncertainty, and invalidation.' },
    { id: 'scenarios', eyebrow: '2.10', title: 'Bull / Base / Bear scenarios', objective: 'Express uncertainty through explicit assumptions and ranges rather than one deterministic target.' },
    { id: 'portfolio', eyebrow: '2.11', title: 'Portfolio construction', objective: 'Understand diversification, concentration, correlation, position sizing, and exposure.' },
    { id: 'risk', eyebrow: '2.12', title: 'Investment risk', objective: 'Separate volatility from permanent loss, thesis risk, liquidity risk, and concentration.' },
    { id: 'behavior', eyebrow: '2.13', title: 'Behavioral finance', objective: 'Recognize common decision traps without diagnosing an outcome after the fact.' },
    { id: 'journal', eyebrow: '2.14', title: 'Decision journal', objective: 'Preserve what you believed at the time so later outcomes cannot rewrite the original reasoning.' },
];

export type MultipleChangeResultV03 = {
    readonly startingPrice: number | null;
    readonly endingPrice: number | null;
    readonly priceChangePercent: number | null;
    readonly earningsChangePercent: number | null;
    readonly multipleChangePercent: number | null;
};

const percentChange = (start: number, end: number): number | null =>
    Number.isFinite(start) && Number.isFinite(end) && start !== 0 ? ((end / start) - 1) * 100 : null;

export const calculateMultipleChangeV03 = (
    startEps: number,
    startMultiple: number,
    endEps: number,
    endMultiple: number,
): MultipleChangeResultV03 => {
    if (![startEps, startMultiple, endEps, endMultiple].every(Number.isFinite) || startEps <= 0 || startMultiple <= 0 || endEps <= 0 || endMultiple <= 0) {
        return { startingPrice: null, endingPrice: null, priceChangePercent: null, earningsChangePercent: null, multipleChangePercent: null };
    }
    const startingPrice = startEps * startMultiple;
    const endingPrice = endEps * endMultiple;
    return {
        startingPrice,
        endingPrice,
        priceChangePercent: percentChange(startingPrice, endingPrice),
        earningsChangePercent: percentChange(startEps, endEps),
        multipleChangePercent: percentChange(startMultiple, endMultiple),
    };
};

export type ScenarioInputV03 = {
    readonly name: 'Bear' | 'Base' | 'Bull';
    readonly earnings: number;
    readonly multiple: number;
    readonly probability: number;
    readonly note: string;
};

export type ScenarioResultV03 = ScenarioInputV03 & {
    readonly impliedValue: number | null;
};

export const calculateScenarioV03 = (scenario: ScenarioInputV03): ScenarioResultV03 => ({
    ...scenario,
    impliedValue: Number.isFinite(scenario.earnings) && Number.isFinite(scenario.multiple) && scenario.earnings > 0 && scenario.multiple > 0
        ? scenario.earnings * scenario.multiple
        : null,
});

export const scenarioProbabilityTotalV03 = (scenarios: readonly ScenarioInputV03[]) =>
    scenarios.reduce((total, scenario) => total + (Number.isFinite(scenario.probability) ? scenario.probability : 0), 0);

export type InvestmentThesisDraftV03 = {
    readonly business: string;
    readonly quality: string;
    readonly growth: string;
    readonly valuation: string;
    readonly expectations: string;
    readonly risks: string;
    readonly catalysts: string;
    readonly contraryEvidence: string;
    readonly invalidation: string;
    readonly confidence: number;
};

export const investmentThesisGapsV03 = (draft: InvestmentThesisDraftV03): readonly string[] => {
    const required: readonly [keyof InvestmentThesisDraftV03, string][] = [
        ['business', 'Business'],
        ['quality', 'Quality'],
        ['growth', 'Growth'],
        ['valuation', 'Valuation'],
        ['expectations', 'Expectations'],
        ['risks', 'Risks'],
        ['contraryEvidence', 'Contrary evidence'],
        ['invalidation', 'Invalidation'],
    ];
    const gaps = required.flatMap(([key, label]) => typeof draft[key] === 'string' && draft[key].trim().length > 0 ? [] : [label]);
    if (!Number.isFinite(draft.confidence) || draft.confidence < 0 || draft.confidence > 100) gaps.push('Confidence');
    return gaps;
};

export type LearningJournalEntryV03 = {
    readonly id: string;
    readonly symbol: string;
    readonly createdAt: string;
    readonly thesis: InvestmentThesisDraftV03;
    readonly scenarios: readonly ScenarioResultV03[];
};

export type LearningJournalUpdateV03 = {
    readonly id: string;
    readonly entryId: string;
    readonly createdAt: string;
    readonly note: string;
};
