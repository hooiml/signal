export const learnModuleIdsV02 = [
    'revenue',
    'income-statement',
    'margins',
    'balance-sheet',
    'cash-flow',
    'debt-resilience',
    'roic',
    'dilution',
    'statement-connections',
] as const;

export type LearnModuleIdV02 = typeof learnModuleIdsV02[number];

export type LearnModuleV02 = {
    readonly id: LearnModuleIdV02;
    readonly eyebrow: string;
    readonly title: string;
    readonly objective: string;
    readonly concepts: readonly string[];
    readonly exercise: string;
    readonly question: string;
    readonly evidenceNeeded: string;
    readonly connectedConcept: string;
};

export const learnModulesV02: readonly LearnModuleV02[] = [
    {
        id: 'revenue', eyebrow: '1.1', title: 'Revenue',
        objective: 'Judge growth quality rather than treating one headline percentage as the whole story.',
        concepts: ['Revenue', 'YoY and QoQ growth', 'CAGR', 'Organic growth', 'Acquired growth', 'Segment and geographic growth', 'Acceleration and deceleration'],
        exercise: 'Two companies report 20% growth. One is mostly organic; the other acquired most of the increase.',
        question: 'What evidence is needed before calling their growth quality equivalent?',
        evidenceNeeded: 'Separate organic and acquired growth, acquisition cost, segment durability, comparable periods, currency effects, and the margin or cash contribution.',
        connectedConcept: 'Growth quality affects the durability assumed in valuation.',
    },
    {
        id: 'income-statement', eyebrow: '1.2', title: 'Income statement',
        objective: 'Trace revenue through operating economics to net income and EPS.',
        concepts: ['Revenue', 'Cost of revenue', 'Gross profit', 'Operating expenses', 'Operating income', 'Interest expense', 'Taxes', 'Net income', 'EPS'],
        exercise: 'Change gross margin, operating expenses, interest expense, and share count in the Financials Lab.',
        question: 'Which operating or financing change explains the largest movement in EPS?',
        evidenceNeeded: 'Use the waterfall values and preserve the distinction between reported inputs and derived outputs.',
        connectedConcept: 'EPS is the denominator of P/E from v0.1.',
    },
    {
        id: 'margins', eyebrow: '1.3', title: 'Margins and operating leverage',
        objective: 'Explain why earnings can grow faster or slower than revenue.',
        concepts: ['Gross margin', 'Operating margin', 'Net margin', 'Expansion and compression', 'Fixed and variable costs', 'Operating leverage'],
        exercise: 'Revenue grows 15% while EPS grows 30%. Test margin, interest, tax, and share-count explanations.',
        question: 'Which driver is operational, which is financial, and which changes only per-share economics?',
        evidenceNeeded: 'Compare gross margin, operating expenses, interest, tax rate, and diluted shares across consistent periods.',
        connectedConcept: 'Sustainable margin changes alter expected EPS and valuation interpretation.',
    },
    {
        id: 'balance-sheet', eyebrow: '1.4', title: 'Balance sheet',
        objective: 'Assess flexibility, funding dependence, working-capital demands, and liability growth.',
        concepts: ['Cash', 'Receivables', 'Inventory', 'Assets', 'Debt', 'Current liabilities', 'Long-term liabilities', 'Equity', 'Working capital'],
        exercise: 'Inspect a company whose liabilities and working-capital needs are increasing faster than revenue.',
        question: 'What could constrain the company even if the income statement still looks healthy?',
        evidenceNeeded: 'Debt maturity, liquidity, receivable and inventory trends, current obligations, and operating cash conversion.',
        connectedConcept: 'Financial resilience changes the risk embedded in a valuation multiple.',
    },
    {
        id: 'cash-flow', eyebrow: '1.5', title: 'Cash flow and FCF',
        objective: 'Keep accounting earnings separate from cash generated after capital expenditure.',
        concepts: ['Operating cash flow', 'Investing cash flow', 'Financing cash flow', 'CapEx', 'Free cash flow', 'FCF margin', 'Cash conversion'],
        exercise: 'Net income rises while free cash flow falls.',
        question: 'Is working capital, CapEx, a non-cash item, or timing causing the divergence?',
        evidenceNeeded: 'Reconcile net income to operating cash flow, then subtract CapEx using a consistent period and sign convention.',
        connectedConcept: 'FCF yield provides a cash-based valuation lens alongside P/E.',
    },
    {
        id: 'debt-resilience', eyebrow: '1.6', title: 'Debt and resilience',
        objective: 'Interpret debt relative to cash generation, cyclicality, interest burden, and refinancing needs.',
        concepts: ['Total and net debt', 'Debt/equity', 'Net debt/EBITDA', 'Interest expense', 'Interest coverage', 'Maturity and refinancing risk'],
        exercise: 'Compare a stable cash generator and a cyclical company with the same headline debt ratio.',
        question: 'Why can identical ratios imply different financial risk?',
        evidenceNeeded: 'Cash-flow stability, interest coverage, maturity timing, collateral, covenant headroom, and cycle sensitivity.',
        connectedConcept: 'A low P/E may coexist with rising balance-sheet risk.',
    },
    {
        id: 'roic', eyebrow: '1.7', title: 'ROIC and capital efficiency',
        objective: 'Ask how much incremental capital is required to produce additional operating profit.',
        concepts: ['ROE', 'ROA', 'ROIC', 'Invested capital', 'Reinvestment', 'Capital intensity'],
        exercise: 'Compare two companies with similar earnings growth but materially different capital requirements.',
        question: 'Which business converts reinvestment into profit more efficiently, and what evidence supports that?',
        evidenceNeeded: 'Consistent after-tax operating profit, invested-capital inputs, reinvestment, and multi-period context.',
        connectedConcept: 'Capital efficiency can support durability, but does not set a fair multiple by itself.',
    },
    {
        id: 'dilution', eyebrow: '1.8', title: 'Dilution, SBC and buybacks',
        objective: 'Translate company-level growth into the economics attributable to each diluted share.',
        concepts: ['Basic and diluted shares', 'Stock-based compensation', 'Issuance', 'Buybacks', 'Net share-count change', 'Per-share economics'],
        exercise: 'Company earnings grow 20% while diluted shares rise 15%.',
        question: 'How much of the corporate growth reaches each share?',
        evidenceNeeded: 'Use comparable diluted weighted-average shares and distinguish gross buybacks from net share-count change.',
        connectedConcept: 'Net income growth can exceed EPS growth when dilution rises.',
    },
    {
        id: 'statement-connections', eyebrow: '1.9', title: 'Connecting the statements',
        objective: 'Trace one economic engine from revenue to earnings, cash flow, per-share results, and valuation.',
        concepts: ['Revenue drivers', 'Margins', 'Net income', 'EPS', 'Operating cash flow', 'CapEx', 'FCF', 'Share count', 'P/E and FCF yield'],
        exercise: 'Follow the full Driver Tree in the Financials Lab and inspect every calculation input.',
        question: 'Which business driver most changes the current valuation interpretation?',
        evidenceNeeded: 'Use consistent periods, explicit formulas, source labels, timestamps, and missing-data warnings.',
        connectedConcept: 'Business economics are the foundation beneath v0.1 valuation metrics.',
    },
];

export const financialMetricIdsV02 = [
    'revenue', 'costOfRevenue', 'grossProfit', 'operatingExpenses', 'operatingIncome',
    'interestExpense', 'taxes', 'netIncome', 'operatingCashFlow', 'capex', 'freeCashFlow',
    'cash', 'receivables', 'inventory', 'totalAssets', 'debt', 'currentLiabilities',
    'longTermLiabilities', 'equity', 'sharesDiluted', 'investedCapital',
] as const;

export type FinancialMetricIdV02 = typeof financialMetricIdsV02[number];
export type FinancialMetricValuesV02 = Readonly<Record<FinancialMetricIdV02, number | null>>;

export type FinancialStatementSnapshotV02 = {
    readonly id: string;
    readonly companyId: string;
    readonly companyName: string;
    readonly fiscalPeriod: string;
    readonly periodType: 'annual' | 'quarterly';
    readonly reportedAt: string;
    readonly knownAsOf: string;
    readonly currency: string;
    readonly unit: 'millions';
    readonly sourceId: string;
    readonly sourceLabel: string;
    readonly methodologyVersion: 'learn-financials-v0.2';
    readonly values: FinancialMetricValuesV02;
};

export type DerivedMetricV02 = {
    readonly value: number | null;
    readonly status: 'derived' | 'unavailable';
    readonly formula: string;
    readonly inputs: readonly { readonly label: string; readonly value: number | null }[];
    readonly methodologyVersion: 'learn-financials-v0.2';
};

export type DerivedMetricIdV02 = 'grossMargin' | 'operatingMargin' | 'netMargin' | 'fcfMargin' | 'cashConversion' | 'netDebt' | 'interestCoverage' | 'roic' | 'eps' | 'pe' | 'fcfYield';

const derived = (formula: string, inputs: DerivedMetricV02['inputs'], calculate: () => number | null): DerivedMetricV02 => {
    const value = calculate();
    return {
        value: value !== null && Number.isFinite(value) ? Number(value.toFixed(2)) : null,
        status: value !== null && Number.isFinite(value) ? 'derived' : 'unavailable',
        formula,
        inputs,
        methodologyVersion: 'learn-financials-v0.2',
    };
};

const ratioPercent = (numerator: number | null, denominator: number | null) =>
    numerator === null || denominator === null || denominator === 0 ? null : (numerator / denominator) * 100;

const ratio = (numerator: number | null, denominator: number | null) =>
    numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator;

export const calculateDerivedMetricsV02 = (snapshot: FinancialStatementSnapshotV02, sharePrice: number | null): Readonly<Record<DerivedMetricIdV02, DerivedMetricV02>> => {
    const value = snapshot.values;
    const nopat = value.operatingIncome === null || value.taxes === null || value.netIncome === null || value.interestExpense === null
        ? null
        : value.operatingIncome * (1 - (value.taxes / Math.max(value.netIncome + value.taxes + value.interestExpense, 1)));
    const eps = ratio(value.netIncome, value.sharesDiluted);
    const marketCap = sharePrice === null || value.sharesDiluted === null ? null : sharePrice * value.sharesDiluted;
    return {
        grossMargin: derived('Gross profit / Revenue', [{ label: 'Gross profit', value: value.grossProfit }, { label: 'Revenue', value: value.revenue }], () => ratioPercent(value.grossProfit, value.revenue)),
        operatingMargin: derived('Operating income / Revenue', [{ label: 'Operating income', value: value.operatingIncome }, { label: 'Revenue', value: value.revenue }], () => ratioPercent(value.operatingIncome, value.revenue)),
        netMargin: derived('Net income / Revenue', [{ label: 'Net income', value: value.netIncome }, { label: 'Revenue', value: value.revenue }], () => ratioPercent(value.netIncome, value.revenue)),
        fcfMargin: derived('Free cash flow / Revenue', [{ label: 'Free cash flow', value: value.freeCashFlow }, { label: 'Revenue', value: value.revenue }], () => ratioPercent(value.freeCashFlow, value.revenue)),
        cashConversion: derived('Free cash flow / Net income', [{ label: 'Free cash flow', value: value.freeCashFlow }, { label: 'Net income', value: value.netIncome }], () => ratioPercent(value.freeCashFlow, value.netIncome)),
        netDebt: derived('Debt - Cash', [{ label: 'Debt', value: value.debt }, { label: 'Cash', value: value.cash }], () => value.debt === null || value.cash === null ? null : value.debt - value.cash),
        interestCoverage: derived('Operating income / Interest expense', [{ label: 'Operating income', value: value.operatingIncome }, { label: 'Interest expense', value: value.interestExpense }], () => ratio(value.operatingIncome, value.interestExpense)),
        roic: derived('Estimated NOPAT / Invested capital', [{ label: 'Estimated NOPAT', value: nopat }, { label: 'Invested capital', value: value.investedCapital }], () => ratioPercent(nopat, value.investedCapital)),
        eps: derived('Net income / Diluted shares', [{ label: 'Net income', value: value.netIncome }, { label: 'Diluted shares', value: value.sharesDiluted }], () => eps),
        pe: derived('Share price / EPS', [{ label: 'Share price', value: sharePrice }, { label: 'EPS', value: eps }], () => eps === null || eps <= 0 || sharePrice === null ? null : sharePrice / eps),
        fcfYield: derived('Free cash flow / Market capitalization', [{ label: 'Free cash flow', value: value.freeCashFlow }, { label: 'Market capitalization', value: marketCap }], () => ratioPercent(value.freeCashFlow, marketCap)),
    };
};

export type IncomeWaterfallInputsV02 = {
    readonly revenue: number;
    readonly grossMarginPercent: number;
    readonly operatingExpenses: number;
    readonly interestExpense: number;
    readonly taxRatePercent: number;
    readonly dilutedShares: number;
};

export type IncomeWaterfallV02 = IncomeWaterfallInputsV02 & {
    readonly grossProfit: number;
    readonly operatingIncome: number;
    readonly preTaxIncome: number;
    readonly taxes: number;
    readonly netIncome: number;
    readonly eps: number | null;
};

export const calculateIncomeWaterfallV02 = (inputs: IncomeWaterfallInputsV02): IncomeWaterfallV02 => {
    const grossProfit = inputs.revenue * (inputs.grossMarginPercent / 100);
    const operatingIncome = grossProfit - inputs.operatingExpenses;
    const preTaxIncome = operatingIncome - inputs.interestExpense;
    const taxes = Math.max(preTaxIncome, 0) * (inputs.taxRatePercent / 100);
    const netIncome = preTaxIncome - taxes;
    return {
        ...inputs,
        grossProfit,
        operatingIncome,
        preTaxIncome,
        taxes,
        netIncome,
        eps: inputs.dilutedShares > 0 ? netIncome / inputs.dilutedShares : null,
    };
};

export const createFinancialMetricValuesV02 = (input: Partial<FinancialMetricValuesV02>): FinancialMetricValuesV02 => ({
    revenue: null, costOfRevenue: null, grossProfit: null, operatingExpenses: null, operatingIncome: null,
    interestExpense: null, taxes: null, netIncome: null, operatingCashFlow: null, capex: null, freeCashFlow: null,
    cash: null, receivables: null, inventory: null, totalAssets: null, debt: null, currentLiabilities: null,
    longTermLiabilities: null, equity: null, sharesDiluted: null, investedCapital: null,
    ...input,
});

export const createFinancialSnapshotV02 = (input: Omit<FinancialStatementSnapshotV02, 'periodType' | 'unit' | 'sourceId' | 'sourceLabel' | 'methodologyVersion'>): FinancialStatementSnapshotV02 => ({
    ...input,
    periodType: 'annual',
    unit: 'millions',
    sourceId: 'signal-learn-curated-v0.2',
    sourceLabel: 'Curated educational dataset',
    methodologyVersion: 'learn-financials-v0.2',
});

export type BusinessLabCompanyV02 = {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly sharePrice: number;
    readonly snapshots: readonly FinancialStatementSnapshotV02[];
};

export const businessLabCompaniesV02: readonly BusinessLabCompanyV02[] = [
    {
        id: 'northstar-software', name: 'Northstar Software', sharePrice: 40,
        description: 'Asset-light recurring-revenue business with high margins, net cash, and modest capital requirements.',
        snapshots: [
            createFinancialSnapshotV02({ id: 'northstar-2024', companyId: 'northstar-software', companyName: 'Northstar Software', fiscalPeriod: '2024-12-31', reportedAt: '2025-02-12', knownAsOf: '2025-02-12', currency: 'USD', values: createFinancialMetricValuesV02({ revenue: 10000, costOfRevenue: 3000, grossProfit: 7000, operatingExpenses: 3500, operatingIncome: 3500, interestExpense: 100, taxes: 714, netIncome: 2686, operatingCashFlow: 3000, capex: 500, freeCashFlow: 2500, cash: 4000, receivables: 1500, inventory: 100, totalAssets: 16000, debt: 1500, currentLiabilities: 2500, longTermLiabilities: 2200, equity: 9000, sharesDiluted: 1000, investedCapital: 8000 }) }),
            createFinancialSnapshotV02({ id: 'northstar-2023', companyId: 'northstar-software', companyName: 'Northstar Software', fiscalPeriod: '2023-12-31', reportedAt: '2024-02-13', knownAsOf: '2024-02-13', currency: 'USD', values: createFinancialMetricValuesV02({ revenue: 8700, costOfRevenue: 2871, grossProfit: 5829, operatingExpenses: 3306, operatingIncome: 2523, interestExpense: 110, taxes: 507, netIncome: 1906, operatingCashFlow: 2250, capex: 460, freeCashFlow: 1790, cash: 3300, receivables: 1320, inventory: 90, totalAssets: 14200, debt: 1700, currentLiabilities: 2300, longTermLiabilities: 2400, equity: 7600, sharesDiluted: 1010, investedCapital: 7600 }) }),
            createFinancialSnapshotV02({ id: 'northstar-2022', companyId: 'northstar-software', companyName: 'Northstar Software', fiscalPeriod: '2022-12-31', reportedAt: '2023-02-14', knownAsOf: '2023-02-14', currency: 'USD', values: createFinancialMetricValuesV02({ revenue: 7800, costOfRevenue: 2808, grossProfit: 4992, operatingExpenses: 3120, operatingIncome: 1872, interestExpense: 120, taxes: 368, netIncome: 1384, operatingCashFlow: 1800, capex: 440, freeCashFlow: 1360, cash: 2800, receivables: 1200, inventory: 80, totalAssets: 12800, debt: 1900, currentLiabilities: 2100, longTermLiabilities: 2600, equity: 6500, sharesDiluted: 1020, investedCapital: 7200 }) }),
        ],
    },
    {
        id: 'harbor-industrials', name: 'Harbor Industrials', sharePrice: 18,
        description: 'Cyclical capital-intensive manufacturer with thinner margins, higher debt, and heavier reinvestment.',
        snapshots: [
            createFinancialSnapshotV02({ id: 'harbor-2024', companyId: 'harbor-industrials', companyName: 'Harbor Industrials', fiscalPeriod: '2024-12-31', reportedAt: '2025-03-01', knownAsOf: '2025-03-01', currency: 'USD', values: createFinancialMetricValuesV02({ revenue: 10000, costOfRevenue: 6000, grossProfit: 4000, operatingExpenses: 2500, operatingIncome: 1500, interestExpense: 400, taxes: 220, netIncome: 880, operatingCashFlow: 1900, capex: 1400, freeCashFlow: 500, cash: 1200, receivables: 2200, inventory: 2000, totalAssets: 19000, debt: 5500, currentLiabilities: 3900, longTermLiabilities: 5000, equity: 7200, sharesDiluted: 800, investedCapital: 7000 }) }),
            createFinancialSnapshotV02({ id: 'harbor-2023', companyId: 'harbor-industrials', companyName: 'Harbor Industrials', fiscalPeriod: '2023-12-31', reportedAt: '2024-03-02', knownAsOf: '2024-03-02', currency: 'USD', values: createFinancialMetricValuesV02({ revenue: 9500, costOfRevenue: 5510, grossProfit: 3990, operatingExpenses: 2375, operatingIncome: 1615, interestExpense: 330, taxes: 257, netIncome: 1028, operatingCashFlow: 1700, capex: 1050, freeCashFlow: 650, cash: 1500, receivables: 1950, inventory: 1800, totalAssets: 17600, debt: 4800, currentLiabilities: 3500, longTermLiabilities: 4500, equity: 7100, sharesDiluted: 790, investedCapital: 6600 }) }),
            createFinancialSnapshotV02({ id: 'harbor-2022', companyId: 'harbor-industrials', companyName: 'Harbor Industrials', fiscalPeriod: '2022-12-31', reportedAt: '2023-03-03', knownAsOf: '2023-03-03', currency: 'USD', values: createFinancialMetricValuesV02({ revenue: 8500, costOfRevenue: 5100, grossProfit: 3400, operatingExpenses: 2210, operatingIncome: 1190, interestExpense: 260, taxes: 186, netIncome: 744, operatingCashFlow: 1400, capex: 850, freeCashFlow: 550, cash: 1300, receivables: 1700, inventory: 1600, totalAssets: 15800, debt: 4100, currentLiabilities: 3100, longTermLiabilities: 4000, equity: 6800, sharesDiluted: 780, investedCapital: 6100 }) }),
        ],
    },
];

export const businessReplayCasesV02 = [
    { id: 'margin-expansion', title: 'Margin expansion', pattern: 'Moderate revenue growth with faster earnings growth as profitability improves.' },
    { id: 'cash-flow-deterioration', title: 'Cash-flow deterioration', pattern: 'Reported earnings remain resilient while free cash flow weakens.' },
    { id: 'balance-sheet-stress', title: 'Balance-sheet stress', pattern: 'Headline valuation looks undemanding while debt and interest pressure rise.' },
] as const;

export type BusinessReplayCaseIdV02 = typeof businessReplayCasesV02[number]['id'];

export type BusinessReplayCommitmentV02 = {
    readonly interpretation: 'improving' | 'mixed' | 'deteriorating';
    readonly confidence: number;
    readonly primaryDriver: string;
    readonly contraryEvidence: string;
    readonly valuationImplication: string;
};

export type BusinessReplayIntroV02 = {
    readonly caseId: BusinessReplayCaseIdV02;
    readonly replayId: string;
    readonly title: string;
    readonly pattern: string;
    readonly knownAsOf: string;
    readonly snapshot: FinancialStatementSnapshotV02;
    readonly sharePrice: number;
    readonly sourceNote: string;
};

export type BusinessReplayRevealV02 = BusinessReplayIntroV02 & {
    readonly nextSnapshot: FinancialStatementSnapshotV02;
    readonly nextSharePrice: number;
    readonly debrief: readonly string[];
};

const boundedText = (value: unknown, maxLength = 700) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;

export const isBusinessReplayCommitmentV02 = (value: unknown): value is BusinessReplayCommitmentV02 => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return (item.interpretation === 'improving' || item.interpretation === 'mixed' || item.interpretation === 'deteriorating')
        && typeof item.confidence === 'number' && Number.isInteger(item.confidence) && item.confidence >= 0 && item.confidence <= 100
        && boundedText(item.primaryDriver) && boundedText(item.contraryEvidence) && boundedText(item.valuationImplication);
};

export type LearnReflectionV02 = {
    readonly caseId: BusinessReplayCaseIdV02;
    readonly replayId: string;
    readonly createdAt: string;
    readonly driverHeldUp: string;
    readonly missedEvidence: string;
    readonly valuationLesson: string;
    readonly revisitConcept: LearnModuleIdV02;
};

export type LearnProgressV02 = {
    readonly version: 2;
    readonly completedModules: readonly LearnModuleIdV02[];
    readonly applyCompleted: boolean;
    readonly reflections: readonly LearnReflectionV02[];
};

export const emptyLearnProgressV02 = (): LearnProgressV02 => ({ version: 2, completedModules: [], applyCompleted: false, reflections: [] });

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isModuleId = (value: unknown): value is LearnModuleIdV02 => typeof value === 'string' && learnModuleIdsV02.some((candidate) => candidate === value);
const isCaseId = (value: unknown): value is BusinessReplayCaseIdV02 => typeof value === 'string' && businessReplayCasesV02.some((candidate) => candidate.id === value);

const readReflection = (value: unknown): LearnReflectionV02 | null => {
    if (!isRecord(value) || !isCaseId(value.caseId) || !isModuleId(value.revisitConcept) || typeof value.replayId !== 'string' || typeof value.createdAt !== 'string') return null;
    if (!boundedText(value.driverHeldUp) || !boundedText(value.missedEvidence) || !boundedText(value.valuationLesson)) return null;
    return value as LearnReflectionV02;
};

export const parseLearnProgressV02 = (value: unknown): LearnProgressV02 => {
    if (!isRecord(value) || value.version !== 2) return emptyLearnProgressV02();
    const completedModules = Array.isArray(value.completedModules) ? [...new Set(value.completedModules.filter(isModuleId))] : [];
    const reflections = Array.isArray(value.reflections)
        ? value.reflections.map(readReflection).filter((item): item is LearnReflectionV02 => item !== null).slice(-3)
        : [];
    return { version: 2, completedModules, applyCompleted: value.applyCompleted === true, reflections };
};
