import { unstable_cache } from 'next/cache';
import type { ResearchFundamentalPeriod, ResearchFundamentalProvenance } from '../types/research-snapshot';

type SecFundamentals = {
    readonly metricProvenance: ResearchFundamentalProvenance;
    readonly revenueGrowthPercent: number | null;
    readonly grossMarginPercent: number | null;
    readonly operatingMarginPercent: number | null;
    readonly freeCashFlow: number | null;
    readonly debt: number | null;
    readonly cash: number | null;
    readonly shares: number | null;
    readonly annualRevenue: number | null;
    readonly annualNetIncome: number | null;
    readonly reportingPeriod: string | null;
    readonly shareChangePercent: number | null;
    readonly source: 'SEC EDGAR';
    readonly history: readonly ResearchFundamentalPeriod[];
};

type FactValue = { readonly value: number; readonly start: string | null; readonly end: string; readonly filed: string; readonly form: string; readonly fiscalPeriod: string };

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const factValues = (facts: Record<string, unknown>, names: readonly string[], unit: string): FactValue[] => {
    const values: FactValue[] = [];
    for (const name of names) {
        const concept = objectValue(facts[name]);
        const units = objectValue(concept?.units);
        const entries = units?.[unit];
        if (!Array.isArray(entries)) continue;
        values.push(...entries.flatMap((entry): FactValue[] => {
            const item = objectValue(entry);
            const value = item?.val;
            const end = item?.end;
            const filed = item?.filed;
            const form = item?.form;
            const fiscalPeriod = item?.fp;
            const start = typeof item?.start === 'string' ? item.start : null;
            return typeof value === 'number' && Number.isFinite(value) && typeof end === 'string' && typeof filed === 'string' && typeof form === 'string' && typeof fiscalPeriod === 'string'
                ? [{ value, start, end, filed, form, fiscalPeriod }]
                : [];
        }));
    }
    return values;
};

const isAnnualFiling = (item: FactValue) => (item.form === '10-K' || item.form === '20-F') && item.fiscalPeriod === 'FY';
const isAnnualDuration = (item: FactValue) => item.start !== null && (Date.parse(item.end) - Date.parse(item.start)) / 86_400_000 >= 300;

const latestFact = (values: readonly FactValue[]): FactValue | null =>
    [...values].sort((left, right) => right.end.localeCompare(left.end) || right.filed.localeCompare(left.filed))[0] ?? null;

const annualPair = (values: readonly FactValue[], durationOnly = true): readonly [FactValue, FactValue] | null => {
    const annual = values.filter((item) => isAnnualFiling(item) && (!durationOnly || item.start === null || isAnnualDuration(item)));
    const byEnd = new Map<string, FactValue>();
    for (const item of annual) if (!byEnd.has(item.end) || (byEnd.get(item.end)?.filed ?? '') < item.filed) byEnd.set(item.end, item);
    const sorted = [...byEnd.values()].sort((left, right) => right.end.localeCompare(left.end));
    return sorted.length >= 2 ? [sorted[0], sorted[1]] : null;
};

const ratio = (numerator: number | null, denominator: number | null) =>
    numerator === null || denominator === null || denominator === 0 ? null : Number(((numerator / denominator) * 100).toFixed(1));

const change = (current: number | null, previous: number | null) =>
    current === null || previous === null || previous === 0
        ? null
        : Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));

const annualByEnd = (values: readonly FactValue[], durationOnly: boolean) => {
    const byEnd = new Map<string, FactValue>();
    for (const item of values.filter((value) => isAnnualFiling(value) && (!durationOnly || isAnnualDuration(value)))) {
        if (!byEnd.has(item.end) || (byEnd.get(item.end)?.filed ?? '') < item.filed) byEnd.set(item.end, item);
    }
    return byEnd;
};

const periodValue = (values: ReadonlyMap<string, FactValue>, period: string) =>
    values.get(period)?.value ?? null;

const totalDebt = (facts: Record<string, unknown>): { value: number | null; periods: readonly string[] } => {
    const current = latestFact(factValues(facts, ['LongTermDebtCurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent'], 'USD'));
    const noncurrent = latestFact(factValues(facts, ['LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'], 'USD'));
    if (current && noncurrent) return { value: current.value + noncurrent.value, periods: [...new Set([current.end, noncurrent.end])].sort() };
    const total = latestFact(factValues(facts, ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebt'], 'USD'));
    return { value: total?.value ?? null, periods: total ? [total.end] : [] };
};

export const parseSecCompanyFacts = (payload: unknown): SecFundamentals => {
    const root = objectValue(payload);
    const facts = objectValue(root?.facts);
    const usGaap = objectValue(facts?.['us-gaap']);
    if (!usGaap) throw new Error('SEC EDGAR returned an invalid company facts response.');
    const revenue = factValues(usGaap, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'], 'USD');
    const debt = totalDebt(usGaap);
    const shares = factValues(usGaap, ['EntityCommonStockSharesOutstanding', 'CommonStockSharesOutstanding'], 'shares');
    const sharePair = annualPair(shares, false);
    const latestShares = latestFact(shares);
    const latestCash = latestFact(factValues(usGaap, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], 'USD'));
    const revenueByPeriod = annualByEnd(revenue, true);
    const grossProfitByPeriod = annualByEnd(factValues(usGaap, ['GrossProfit'], 'USD'), true);
    const operatingIncomeByPeriod = annualByEnd(factValues(usGaap, ['OperatingIncomeLoss'], 'USD'), true);
    const netIncomeByPeriod = annualByEnd(factValues(usGaap, ['NetIncomeLoss', 'ProfitLoss'], 'USD'), true);
    const operatingCashByPeriod = annualByEnd(factValues(usGaap, ['NetCashProvidedByUsedInOperatingActivities'], 'USD'), true);
    const capexByPeriod = annualByEnd(factValues(usGaap, ['PaymentsToAcquirePropertyPlantAndEquipment'], 'USD'), true);
    const debtCurrentByPeriod = annualByEnd(factValues(usGaap, ['LongTermDebtCurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent'], 'USD'), false);
    const debtNoncurrentByPeriod = annualByEnd(factValues(usGaap, ['LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'], 'USD'), false);
    const debtTotalByPeriod = annualByEnd(factValues(usGaap, ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebt'], 'USD'), false);
    const cashByPeriod = annualByEnd(factValues(usGaap, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], 'USD'), false);
    const sharesByPeriod = annualByEnd(shares, false);
    const revenuePeriods = [...revenueByPeriod.keys()].sort((left, right) => right.localeCompare(left)).slice(0, 5);
    const history = revenuePeriods.map((reportingPeriod, index): ResearchFundamentalPeriod => {
        const annualRevenue = periodValue(revenueByPeriod, reportingPeriod);
        const previousPeriod = revenuePeriods[index + 1] ?? null;
        const operatingCashValue = periodValue(operatingCashByPeriod, reportingPeriod);
        const capexValue = periodValue(capexByPeriod, reportingPeriod);
        const debtCurrent = periodValue(debtCurrentByPeriod, reportingPeriod);
        const debtNoncurrent = periodValue(debtNoncurrentByPeriod, reportingPeriod);
        const debtFallback = periodValue(debtTotalByPeriod, reportingPeriod);
        const sharesValue = periodValue(sharesByPeriod, reportingPeriod);
        return {
            reportingPeriod,
            currency: 'USD',
            source: 'SEC EDGAR',
            annualRevenue,
            revenueGrowthPercent: change(annualRevenue, previousPeriod ? periodValue(revenueByPeriod, previousPeriod) : null),
            grossMarginPercent: ratio(periodValue(grossProfitByPeriod, reportingPeriod), annualRevenue),
            operatingMarginPercent: ratio(periodValue(operatingIncomeByPeriod, reportingPeriod), annualRevenue),
            annualNetIncome: periodValue(netIncomeByPeriod, reportingPeriod),
            freeCashFlow: operatingCashValue === null || capexValue === null ? null : operatingCashValue - capexValue,
            debt: debtCurrent !== null && debtNoncurrent !== null ? debtCurrent + debtNoncurrent : debtFallback,
            cash: periodValue(cashByPeriod, reportingPeriod),
            shares: sharesValue,
            shareChangePercent: change(sharesValue, previousPeriod ? periodValue(sharesByPeriod, previousPeriod) : null),
        };
    });
    // Income-statement and cash-flow figures all come from the latest annual revenue period.
    // A metric missing from that period stays unavailable rather than borrowing an older year.
    const current = history[0] ?? null;
    return {
        metricProvenance: {
            debt: { reportingPeriods: debt.periods, currency: 'USD' },
            cash: { reportingPeriods: latestCash ? [latestCash.end] : [], currency: 'USD' },
            shares: { reportingPeriods: latestShares ? [latestShares.end] : [], currency: null },
            shareChange: { reportingPeriods: sharePair ? [sharePair[1].end, sharePair[0].end] : [], currency: null },
        },
        revenueGrowthPercent: current?.revenueGrowthPercent ?? null,
        grossMarginPercent: current?.grossMarginPercent ?? null,
        operatingMarginPercent: current?.operatingMarginPercent ?? null,
        freeCashFlow: current?.freeCashFlow ?? null,
        debt: debt.value,
        cash: latestCash?.value ?? null,
        shares: latestShares?.value ?? null,
        annualRevenue: current?.annualRevenue ?? null,
        annualNetIncome: current?.annualNetIncome ?? null,
        reportingPeriod: current?.reportingPeriod ?? null,
        shareChangePercent: sharePair === null || sharePair[1].value === 0 ? null : Number((((sharePair[0].value - sharePair[1].value) / Math.abs(sharePair[1].value)) * 100).toFixed(1)),
        source: 'SEC EDGAR',
        history,
    };
};

export const getConfiguredSecHeaders = (): Readonly<Record<string, string>> => {
    const userAgent = process.env.SEC_USER_AGENT?.trim() ?? '';
    if (userAgent.length < 8 || userAgent.length > 200 || (!userAgent.includes('@') && !/^https?:\/\//i.test(userAgent))) {
        throw new Error('SEC discovery is unavailable until SEC_USER_AGENT identifies the operator and contact.');
    }
    return { Accept: 'application/json', 'User-Agent': userAgent };
};

export const parseSecTickerMapping = (payload: unknown, symbol: string): { readonly cik: string; readonly title: string } => {
    const tickers = objectValue(payload);
    const match = Object.values(tickers ?? {}).map(objectValue).find((item) =>
        typeof item?.ticker === 'string' && item.ticker.toUpperCase() === symbol.toUpperCase());
    if (!match || typeof match.cik_str !== 'number' || !Number.isInteger(match.cik_str) || match.cik_str <= 0) {
        throw new Error(`SEC has no CIK mapping for ${symbol}.`);
    }
    return {
        cik: Math.trunc(match.cik_str).toString().padStart(10, '0'),
        title: typeof match.title === 'string' && match.title.trim() ? match.title.trim().slice(0, 200) : symbol.toUpperCase(),
    };
};

export const fetchSecCompanyFactsDocument = async (symbol: string): Promise<{
    readonly cik: string;
    readonly title: string;
    readonly payload: unknown;
}> => {
    const headers = getConfiguredSecHeaders();
    const tickersResponse = await fetch('https://www.sec.gov/files/company_tickers.json', { headers, next: { revalidate: 86400 }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!tickersResponse.ok) throw new Error(`SEC ticker lookup failed (${tickersResponse.status}).`);
    const { cik, title } = parseSecTickerMapping(await tickersResponse.json(), symbol);
    const factsResponse = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(8_000) });
    if (!factsResponse.ok) throw new Error(`SEC company facts request failed (${factsResponse.status}).`);
    return { cik, title, payload: await factsResponse.json() };
};

const fetchAndNormalizeSecFundamentals = async (symbol: string): Promise<SecFundamentals> => {
    const document = await fetchSecCompanyFactsDocument(symbol);
    return parseSecCompanyFacts(document.payload);
};

export const fetchSecFundamentals = unstable_cache(
    fetchAndNormalizeSecFundamentals,
    ['sec-fundamentals-v3-provenance'],
    { revalidate: 21600 },
);
