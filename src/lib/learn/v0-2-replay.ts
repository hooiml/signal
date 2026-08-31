import 'server-only';

import {
    businessReplayCasesV02,
    createFinancialMetricValuesV02,
    createFinancialSnapshotV02,
    type BusinessReplayCaseIdV02,
    type BusinessReplayIntroV02,
    type BusinessReplayRevealV02,
    type FinancialStatementSnapshotV02,
} from './v0-2';

type ReplayData = {
    readonly intro: FinancialStatementSnapshotV02;
    readonly sharePrice: number;
    readonly next: FinancialStatementSnapshotV02;
    readonly nextSharePrice: number;
    readonly debrief: readonly string[];
};

const replayData: Readonly<Record<BusinessReplayCaseIdV02, ReplayData>> = {
    'margin-expansion': {
        intro: createFinancialSnapshotV02({
            id: 'margin-expansion-2022', companyId: 'replay-margin', companyName: 'Orion Services',
            fiscalPeriod: '2022-12-31', reportedAt: '2023-02-20', knownAsOf: '2023-02-20', currency: 'USD',
            values: createFinancialMetricValuesV02({ revenue: 5000, costOfRevenue: 2250, grossProfit: 2750, operatingExpenses: 1900, operatingIncome: 850, interestExpense: 80, taxes: 154, netIncome: 616, operatingCashFlow: 720, capex: 180, freeCashFlow: 540, cash: 900, debt: 700, sharesDiluted: 500, investedCapital: 2400 }),
        }),
        sharePrice: 24,
        next: createFinancialSnapshotV02({
            id: 'margin-expansion-2023', companyId: 'replay-margin', companyName: 'Orion Services',
            fiscalPeriod: '2023-12-31', reportedAt: '2024-02-19', knownAsOf: '2024-02-19', currency: 'USD',
            values: createFinancialMetricValuesV02({ revenue: 5500, costOfRevenue: 2365, grossProfit: 3135, operatingExpenses: 1980, operatingIncome: 1155, interestExpense: 75, taxes: 216, netIncome: 864, operatingCashFlow: 980, capex: 190, freeCashFlow: 790, cash: 1250, debt: 620, sharesDiluted: 495, investedCapital: 2500 }),
        }),
        nextSharePrice: 35,
        debrief: ['Revenue grew 10%, while operating income grew faster as gross margin expanded.', 'Lower diluted shares slightly amplified per-share growth.', 'The later price does not prove the earlier view was correct; the driver evidence must still be evaluated.'],
    },
    'cash-flow-deterioration': {
        intro: createFinancialSnapshotV02({
            id: 'cash-flow-2022', companyId: 'replay-cash-flow', companyName: 'Meridian Commerce',
            fiscalPeriod: '2022-12-31', reportedAt: '2023-03-08', knownAsOf: '2023-03-08', currency: 'USD',
            values: createFinancialMetricValuesV02({ revenue: 7200, costOfRevenue: 4320, grossProfit: 2880, operatingExpenses: 1800, operatingIncome: 1080, interestExpense: 120, taxes: 192, netIncome: 768, operatingCashFlow: 1050, capex: 320, freeCashFlow: 730, cash: 1100, debt: 1600, sharesDiluted: 640, investedCapital: 4100 }),
        }),
        sharePrice: 28,
        next: createFinancialSnapshotV02({
            id: 'cash-flow-2023', companyId: 'replay-cash-flow', companyName: 'Meridian Commerce',
            fiscalPeriod: '2023-12-31', reportedAt: '2024-03-07', knownAsOf: '2024-03-07', currency: 'USD',
            values: createFinancialMetricValuesV02({ revenue: 7900, costOfRevenue: 4661, grossProfit: 3239, operatingExpenses: 1950, operatingIncome: 1289, interestExpense: 145, taxes: 229, netIncome: 915, operatingCashFlow: 760, capex: 520, freeCashFlow: 240, cash: 720, debt: 2100, sharesDiluted: 650, investedCapital: 4700 }),
        }),
        nextSharePrice: 25,
        debrief: ['Net income rose, but operating cash flow fell and CapEx increased.', 'Free cash flow deterioration is visible only after separating earnings, working-capital/timing effects, and reinvestment.', 'Rising debt and share count add contrary evidence to the earnings headline.'],
    },
    'balance-sheet-stress': {
        intro: createFinancialSnapshotV02({
            id: 'balance-stress-2022', companyId: 'replay-balance', companyName: 'Atlas Components',
            fiscalPeriod: '2022-12-31', reportedAt: '2023-03-15', knownAsOf: '2023-03-15', currency: 'USD',
            values: createFinancialMetricValuesV02({ revenue: 6400, costOfRevenue: 4160, grossProfit: 2240, operatingExpenses: 1280, operatingIncome: 960, interestExpense: 180, taxes: 156, netIncome: 624, operatingCashFlow: 820, capex: 400, freeCashFlow: 420, cash: 850, debt: 2600, sharesDiluted: 600, investedCapital: 3900 }),
        }),
        sharePrice: 16,
        next: createFinancialSnapshotV02({
            id: 'balance-stress-2023', companyId: 'replay-balance', companyName: 'Atlas Components',
            fiscalPeriod: '2023-12-31', reportedAt: '2024-03-14', knownAsOf: '2024-03-14', currency: 'USD',
            values: createFinancialMetricValuesV02({ revenue: 6100, costOfRevenue: 4148, grossProfit: 1952, operatingExpenses: 1300, operatingIncome: 652, interestExpense: 310, taxes: 68, netIncome: 274, operatingCashFlow: 560, capex: 360, freeCashFlow: 200, cash: 500, debt: 3300, sharesDiluted: 610, investedCapital: 4300 }),
        }),
        nextSharePrice: 9,
        debrief: ['Debt increased while cash, operating income, and interest coverage deteriorated.', 'A lower P/E can reflect a weaker earnings base and greater refinancing risk rather than an automatic bargain.', 'The balance sheet changed the interpretation of the headline valuation.'],
    },
};

export const isBusinessReplayCaseIdV02 = (value: string): value is BusinessReplayCaseIdV02 =>
    businessReplayCasesV02.some((candidate) => candidate.id === value);

export const getBusinessReplayIntroV02 = (caseId: BusinessReplayCaseIdV02): BusinessReplayIntroV02 => {
    const catalog = businessReplayCasesV02.find((candidate) => candidate.id === caseId) ?? businessReplayCasesV02[0];
    const data = replayData[caseId];
    return {
        caseId,
        replayId: data.intro.id,
        title: catalog.title,
        pattern: catalog.pattern,
        knownAsOf: data.intro.knownAsOf,
        snapshot: data.intro,
        sharePrice: data.sharePrice,
        sourceNote: 'Curated historical-pattern exercise. Values are illustrative and not claims about a public issuer.',
    };
};

export const revealBusinessReplayV02 = (caseId: BusinessReplayCaseIdV02, replayId: string): BusinessReplayRevealV02 | null => {
    const data = replayData[caseId];
    if (data.intro.id !== replayId) return null;
    return {
        ...getBusinessReplayIntroV02(caseId),
        nextSnapshot: data.next,
        nextSharePrice: data.nextSharePrice,
        debrief: data.debrief,
    };
};
