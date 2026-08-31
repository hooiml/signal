export const learnModuleIdsV03 = [
    'valuation-metrics',
    'multiple-change',
    'business-quality',
    'capital-allocation',
    'rates-yields',
    'inflation-cycle',
    'narrative-evidence',
    'catalysts',
    'investment-thesis',
    'scenarios',
    'portfolio-construction',
    'investment-risk',
    'behavioral-finance',
    'decision-journal',
] as const;

export type LearnModuleIdV03 = (typeof learnModuleIdsV03)[number];

export type LearnModuleV03 = {
    readonly id: LearnModuleIdV03;
    readonly eyebrow: string;
    readonly title: string;
    readonly principle: string;
    readonly concepts: readonly string[];
    readonly prompt: string;
};

export const learnModulesV03: readonly LearnModuleV03[] = [
    { id: 'valuation-metrics', eyebrow: '2.1', title: 'Alternative valuation', principle: 'A useful ratio matches the economics of its denominator; no ratio is universally best.', concepts: ['P/S and EV/Sales', 'EV/EBITDA', 'Price/FCF and FCF yield', 'Price/Book', 'Capital structure and accounting limits'], prompt: 'Which denominator best represents this business, and what does it leave out?' },
    { id: 'multiple-change', eyebrow: '2.2', title: 'Multiple change', principle: 'Fundamental growth and the price investors pay for it are separate return drivers.', concepts: ['Earnings change', 'Multiple expansion', 'Multiple compression', 'Dividend contribution'], prompt: 'How could EPS rise while the share price falls?' },
    { id: 'business-quality', eyebrow: '2.3', title: 'Business quality', principle: 'Durable economics can be valuable, but quality may already be reflected in valuation.', concepts: ['Switching costs', 'Scale and cost advantage', 'Network effects', 'Recurring revenue', 'Concentration and capital intensity'], prompt: 'What evidence supports durability, and what valuation already reflects it?' },
    { id: 'capital-allocation', eyebrow: '2.4', title: 'Capital allocation', principle: 'The same action can create or destroy value depending on price, leverage, and alternatives.', concepts: ['Reinvestment', 'Buybacks', 'Dividends', 'Debt repayment', 'Acquisitions and issuance'], prompt: 'Would this buyback still make sense at a high valuation and with high debt?' },
    { id: 'rates-yields', eyebrow: '2.5', title: 'Rates and yields', principle: 'A higher required return can compress long-duration valuations, but the relationship is not deterministic.', concepts: ['Policy rate', '2Y and 10Y Treasury', 'Yield curve', 'Discount-rate intuition', 'Real yield'], prompt: 'Which cash flows are most sensitive to a change in required return, and why?' },
    { id: 'inflation-cycle', eyebrow: '2.6', title: 'Inflation and cycle', principle: 'A strong release can improve growth evidence while also raising rate expectations.', concepts: ['CPI and PCE', 'GDP and employment', 'PMI', 'Expansion and slowdown', 'Second-order effects'], prompt: 'Separate the release fact, the expectation change, and the uncertain equity implication.' },
    { id: 'narrative-evidence', eyebrow: '2.7', title: 'Narrative evidence', principle: 'Narratives are interpretations; inspect observable revisions, price, sector, and volatility evidence.', concepts: ['News flow', 'Analyst revisions', 'Price momentum', 'Relative performance', 'Short interest and volatility'], prompt: 'Which observations support the narrative, and which are merely repetition?' },
    { id: 'catalysts', eyebrow: '2.8', title: 'Catalysts', principle: 'A catalyst may change expectations; it is not a complete thesis.', concepts: ['Earnings', 'Product launches', 'Regulation', 'Investor days', 'Guidance and macro releases'], prompt: 'What expectation could this event change, and what result is already priced in?' },
    { id: 'investment-thesis', eyebrow: '2.9', title: 'Investment thesis', principle: 'A defensible thesis connects business, evidence, expectations, risks, and invalidation.', concepts: ['Business and quality', 'Growth and valuation', 'Expectations', 'Risks and catalysts', 'Contrary evidence and invalidation'], prompt: 'What fact would cause you to change this view rather than defend it?' },
    { id: 'scenarios', eyebrow: '2.10', title: 'Scenarios', principle: 'Ranges expose assumptions; a single precise target can hide them.', concepts: ['Bear, Base, Bull', 'Revenue and margin', 'EPS or FCF', 'Multiple range', 'Probability and triggers'], prompt: 'Which assumption explains most of the difference between Bear and Bull?' },
    { id: 'portfolio-construction', eyebrow: '2.11', title: 'Portfolio construction', principle: 'A high ticker count is not diversification when holdings share the same economic exposure.', concepts: ['Concentration', 'Correlation', 'Sector and geography', 'Position sizing', 'Cash and rebalancing'], prompt: 'Which common factor could make several positions fall together?' },
    { id: 'investment-risk', eyebrow: '2.12', title: 'Investment risk', principle: 'Volatility is one risk measure, not a complete definition of permanent loss.', concepts: ['Drawdown', 'Liquidity', 'Thesis risk', 'Concentration', 'Leverage and permanent loss'], prompt: 'Which risk can impair value rather than only move the quoted price?' },
    { id: 'behavioral-finance', eyebrow: '2.13', title: 'Behavioral finance', principle: 'Potential bias should be tied to reasoning evidence, not diagnosed from the outcome.', concepts: ['FOMO', 'Confirmation bias', 'Anchoring', 'Recency and overconfidence', 'Sunk cost and disposition effect'], prompt: 'Which sentence in the reasoning shows the possible bias, and what evidence would test it?' },
    { id: 'decision-journal', eyebrow: '2.14', title: 'Decision journal', principle: 'Preserve the original commitment and append updates so learning is not rewritten by hindsight.', concepts: ['Original thesis', 'Evidence for and against', 'Scenario weights', 'Invalidation', 'Appended updates'], prompt: 'What changed in the evidence, and how did it change confidence or the thesis?' },
];

export const valuationMetricIdsV03 = ['price-sales', 'ev-sales', 'ev-ebitda', 'price-fcf', 'fcf-yield', 'price-book'] as const;
export type ValuationMetricIdV03 = (typeof valuationMetricIdsV03)[number];

export type ValuationMetricV03 = {
    readonly id: ValuationMetricIdV03;
    readonly label: string;
    readonly denominator: string;
    readonly usefulFor: string;
    readonly limitation: string;
    readonly structurallyWeakFor: readonly string[];
};

export const valuationMetricsV03: readonly ValuationMetricV03[] = [
    { id: 'price-sales', label: 'Price / Sales', denominator: 'Equity value / revenue', usefulFor: 'Early or temporarily unprofitable businesses with comparable gross-margin economics.', limitation: 'Ignores debt, margin quality, capital intensity, and cash conversion.', structurallyWeakFor: ['bank', 'insurer'] },
    { id: 'ev-sales', label: 'EV / Sales', denominator: 'Enterprise value / revenue', usefulFor: 'Cross-capital-structure comparison when operating margins are not yet stable.', limitation: 'Still treats high- and low-margin revenue alike.', structurallyWeakFor: ['bank', 'insurer'] },
    { id: 'ev-ebitda', label: 'EV / EBITDA', denominator: 'Enterprise value / EBITDA', usefulFor: 'Mature operating businesses with meaningful EBITDA and comparable capital intensity.', limitation: 'Can understate maintenance capital expenditure and working-capital needs.', structurallyWeakFor: ['bank', 'insurer', 'pre-profit'] },
    { id: 'price-fcf', label: 'Price / FCF', denominator: 'Equity value / free cash flow', usefulFor: 'Businesses with recurring, representative cash generation.', limitation: 'One period can be distorted by working capital or unusually low investment.', structurallyWeakFor: ['bank', 'early-growth'] },
    { id: 'fcf-yield', label: 'FCF Yield', denominator: 'Free cash flow / equity value', usefulFor: 'Comparing current owner cash generation with price and alternative required returns.', limitation: 'A high yield can reflect declining or unsustainable cash flow.', structurallyWeakFor: ['bank', 'early-growth'] },
    { id: 'price-book', label: 'Price / Book', denominator: 'Equity value / common book value', usefulFor: 'Asset-based and regulated financial businesses where book value has economic meaning.', limitation: 'Book value may poorly represent intangible assets or internally created advantages.', structurallyWeakFor: ['software', 'asset-light'] },
];

export type ValuationInputsV03 = {
    readonly marketCap: number;
    readonly enterpriseValue: number;
    readonly revenue: number;
    readonly ebitda: number;
    readonly freeCashFlow: number;
    readonly bookValue: number;
};

const finitePositive = (value: number) => Number.isFinite(value) && value > 0;
const ratio = (numerator: number, denominator: number) => finitePositive(numerator) && finitePositive(denominator) ? numerator / denominator : null;

export const calculateValuationMetricsV03 = (inputs: ValuationInputsV03): Readonly<Record<ValuationMetricIdV03, number | null>> => ({
    'price-sales': ratio(inputs.marketCap, inputs.revenue),
    'ev-sales': ratio(inputs.enterpriseValue, inputs.revenue),
    'ev-ebitda': ratio(inputs.enterpriseValue, inputs.ebitda),
    'price-fcf': ratio(inputs.marketCap, inputs.freeCashFlow),
    'fcf-yield': ratio(inputs.freeCashFlow * 100, inputs.marketCap),
    'price-book': ratio(inputs.marketCap, inputs.bookValue),
});

export type MultipleBridgeInputsV03 = {
    readonly startingEps: number;
    readonly endingEps: number;
    readonly startingMultiple: number;
    readonly endingMultiple: number;
    readonly dividends: number;
};

export type MultipleBridgeV03 = {
    readonly startingPrice: number;
    readonly endingPrice: number;
    readonly earningsContributionPercent: number;
    readonly multipleContributionPercent: number;
    readonly dividendContributionPercent: number;
    readonly totalReturnPercent: number;
};

export const calculateMultipleBridgeV03 = (inputs: MultipleBridgeInputsV03): MultipleBridgeV03 | null => {
    if (![inputs.startingEps, inputs.endingEps, inputs.startingMultiple, inputs.endingMultiple].every(finitePositive) || !Number.isFinite(inputs.dividends) || inputs.dividends < 0) return null;
    const startingPrice = inputs.startingEps * inputs.startingMultiple;
    const endingPrice = inputs.endingEps * inputs.endingMultiple;
    return {
        startingPrice,
        endingPrice,
        earningsContributionPercent: ((inputs.endingEps - inputs.startingEps) * inputs.startingMultiple / startingPrice) * 100,
        multipleContributionPercent: (inputs.endingEps * (inputs.endingMultiple - inputs.startingMultiple) / startingPrice) * 100,
        dividendContributionPercent: (inputs.dividends / startingPrice) * 100,
        totalReturnPercent: ((endingPrice + inputs.dividends - startingPrice) / startingPrice) * 100,
    };
};

export type MacroEvidenceV03 = {
    readonly metric: string;
    readonly value: string;
    readonly change: string;
    readonly interpretation: string;
    readonly uncertainty: string;
    readonly knownAsOf: string;
};

export const macroEvidenceV03: readonly MacroEvidenceV03[] = [
    { metric: 'Policy rate', value: '5.25%-5.50%', change: 'Held at the latest meeting', interpretation: 'A restrictive policy rate can raise required returns and financing costs.', uncertainty: 'Policy effects arrive with variable lags and differ by business.', knownAsOf: 'Illustrative 2023-09 snapshot' },
    { metric: '2Y Treasury', value: '5.04%', change: '+32 bps over three months', interpretation: 'The front end reflects tighter near-term policy expectations.', uncertainty: 'Yields can move with both inflation and growth expectations.', knownAsOf: 'Illustrative 2023-09 snapshot' },
    { metric: '10Y Treasury', value: '4.57%', change: '+70 bps over three months', interpretation: 'A higher long-term required return can pressure long-duration multiples.', uncertainty: 'Earnings revisions may offset or amplify the valuation effect.', knownAsOf: 'Illustrative 2023-09 snapshot' },
    { metric: 'Core inflation', value: '4.3% year over year', change: 'Slower than the prior reading', interpretation: 'Disinflation may reduce pressure for additional tightening.', uncertainty: 'One release does not establish a durable trend.', knownAsOf: 'Illustrative 2023-09 snapshot' },
];

export type ScenarioV03 = {
    readonly id: 'bear' | 'base' | 'bull';
    readonly name: string;
    readonly revenueGrowth: number;
    readonly margin: number;
    readonly earningsPower: number;
    readonly multipleLow: number;
    readonly multipleHigh: number;
    readonly probability: number;
    readonly trigger: string;
    readonly risk: string;
    readonly provenance: string;
};

export type ScenarioOutputV03 = ScenarioV03 & { readonly impliedLow: number; readonly impliedHigh: number; readonly midpoint: number };

export const calculateScenarioV03 = (scenario: ScenarioV03): ScenarioOutputV03 | null => {
    const numeric = [scenario.revenueGrowth, scenario.margin, scenario.earningsPower, scenario.multipleLow, scenario.multipleHigh, scenario.probability];
    if (!numeric.every(Number.isFinite) || scenario.earningsPower <= 0 || scenario.multipleLow <= 0 || scenario.multipleHigh < scenario.multipleLow || scenario.probability < 0 || scenario.probability > 100) return null;
    const impliedLow = scenario.earningsPower * scenario.multipleLow;
    const impliedHigh = scenario.earningsPower * scenario.multipleHigh;
    return { ...scenario, impliedLow, impliedHigh, midpoint: (impliedLow + impliedHigh) / 2 };
};

export const scenarioProbabilityTotalV03 = (scenarios: readonly ScenarioV03[]) => scenarios.reduce((total, scenario) => total + scenario.probability, 0);

export const calculateWeightedScenarioValueV03 = (scenarios: readonly ScenarioV03[]): number | null => {
    if (scenarioProbabilityTotalV03(scenarios) !== 100) return null;
    const outputs = scenarios.map(calculateScenarioV03);
    if (outputs.some((output) => output === null)) return null;
    return outputs.reduce((total, output) => total + output!.midpoint * (output!.probability / 100), 0);
};

export type PortfolioHoldingV03 = { readonly ticker: string; readonly weight: number; readonly sector: string; readonly factor: string };
export type PortfolioExposureV03 = { readonly key: string; readonly weight: number; readonly holdingCount: number };

export const calculatePortfolioExposuresV03 = (holdings: readonly PortfolioHoldingV03[], field: 'sector' | 'factor'): readonly PortfolioExposureV03[] => {
    const grouped = new Map<string, { weight: number; holdingCount: number }>();
    for (const holding of holdings) {
        if (!holding.ticker.trim() || !holding[field].trim() || !Number.isFinite(holding.weight) || holding.weight <= 0) continue;
        const current = grouped.get(holding[field]) ?? { weight: 0, holdingCount: 0 };
        grouped.set(holding[field], { weight: current.weight + holding.weight, holdingCount: current.holdingCount + 1 });
    }
    return [...grouped.entries()].map(([key, value]) => ({ key, ...value })).sort((a, b) => b.weight - a.weight);
};

export type EvidenceKindV03 = 'supports' | 'against' | 'context' | 'unknown';
export type EvidenceItemV03 = { readonly id: string; readonly kind: EvidenceKindV03; readonly text: string; readonly source: string };

export type ThesisCommitmentV03 = {
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
    readonly horizon: string;
};

export type JournalUpdateV03 = {
    readonly id: string;
    readonly createdAt: string;
    readonly reason: string;
    readonly currentThesis: string;
    readonly confidence: number;
    readonly newEvidenceRefs: readonly string[];
};

export type DecisionJournalEntryV03 = {
    readonly id: string;
    readonly createdAt: string;
    readonly original: ThesisCommitmentV03;
    readonly evidenceRefs: readonly string[];
    readonly scenarioRefs: readonly string[];
    readonly updates: readonly JournalUpdateV03[];
};

export const appendJournalUpdateV03 = (entry: DecisionJournalEntryV03, update: JournalUpdateV03): DecisionJournalEntryV03 => ({
    ...entry,
    updates: [...entry.updates, update],
});

const boundedText = (value: unknown, max = 2000): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const boundedTextArray = (value: unknown, maxItems = 25): value is string[] => Array.isArray(value) && value.length <= maxItems && value.every((item) => boundedText(item, 120));

export const isThesisCommitmentV03 = (value: unknown): value is ThesisCommitmentV03 => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return ['business', 'quality', 'growth', 'valuation', 'expectations', 'risks', 'catalysts', 'contraryEvidence', 'invalidation', 'horizon'].every((key) => boundedText(item[key]))
        && typeof item.confidence === 'number' && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 100;
};

export const parseDecisionJournalEntryV03 = (value: unknown): DecisionJournalEntryV03 | null => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (!boundedText(item.id, 120) || !boundedText(item.createdAt, 80) || !isThesisCommitmentV03(item.original) || !boundedTextArray(item.evidenceRefs) || !boundedTextArray(item.scenarioRefs) || !Array.isArray(item.updates) || item.updates.length > 50) return null;
    const updates = item.updates.filter((update): update is JournalUpdateV03 => {
        if (typeof update !== 'object' || update === null || Array.isArray(update)) return false;
        const candidate = update as Record<string, unknown>;
        return boundedText(candidate.id, 120) && boundedText(candidate.createdAt, 80) && boundedText(candidate.reason, 1200) && boundedText(candidate.currentThesis, 2000)
            && typeof candidate.confidence === 'number' && Number.isFinite(candidate.confidence) && candidate.confidence >= 0 && candidate.confidence <= 100
            && boundedTextArray(candidate.newEvidenceRefs);
    });
    if (updates.length !== item.updates.length) return null;
    return { id: item.id, createdAt: item.createdAt, original: item.original, evidenceRefs: item.evidenceRefs, scenarioRefs: item.scenarioRefs, updates };
};

export type InvestmentReplayCommitmentV03 = {
    readonly thesis: string;
    readonly scenario: 'bear' | 'base' | 'bull' | 'uncertain';
    readonly supportingEvidence: string;
    readonly contraryEvidence: string;
    readonly invalidation: string;
    readonly confidence: number;
};

export const isInvestmentReplayCommitmentV03 = (value: unknown): value is InvestmentReplayCommitmentV03 => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return boundedText(item.thesis, 1200)
        && ['bear', 'base', 'bull', 'uncertain'].includes(String(item.scenario))
        && boundedText(item.supportingEvidence, 1200)
        && boundedText(item.contraryEvidence, 1200)
        && boundedText(item.invalidation, 1200)
        && typeof item.confidence === 'number' && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 100;
};

export type LearnReflectionV03 = { readonly caseId: string; readonly heldUp: string; readonly missed: string; readonly thesisChange: string };
export type LearnProgressV03 = {
    readonly version: 3;
    readonly completedModules: readonly LearnModuleIdV03[];
    readonly completedWorkspaces: readonly string[];
    readonly reflections: readonly LearnReflectionV03[];
};

export const emptyLearnProgressV03 = (): LearnProgressV03 => ({ version: 3, completedModules: [], completedWorkspaces: [], reflections: [] });

export const parseLearnProgressV03 = (value: unknown): LearnProgressV03 => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return emptyLearnProgressV03();
    const item = value as Record<string, unknown>;
    if (item.version !== 3) return emptyLearnProgressV03();
    const completedModules = Array.isArray(item.completedModules)
        ? [...new Set(item.completedModules.filter((id): id is LearnModuleIdV03 => typeof id === 'string' && learnModuleIdsV03.includes(id as LearnModuleIdV03)))]
        : [];
    const completedWorkspaces = Array.isArray(item.completedWorkspaces)
        ? [...new Set(item.completedWorkspaces.filter((id): id is string => boundedText(id, 40)))].slice(0, 12)
        : [];
    const reflections = Array.isArray(item.reflections) ? item.reflections.filter((reflection): reflection is LearnReflectionV03 => {
        if (typeof reflection !== 'object' || reflection === null || Array.isArray(reflection)) return false;
        const candidate = reflection as Record<string, unknown>;
        return boundedText(candidate.caseId, 80) && boundedText(candidate.heldUp, 1200) && boundedText(candidate.missed, 1200) && boundedText(candidate.thesisChange, 1200);
    }).slice(-3) : [];
    return { version: 3, completedModules, completedWorkspaces, reflections };
};

export const isValidEvidenceRefsV03 = (value: unknown): value is string[] => boundedTextArray(value);
