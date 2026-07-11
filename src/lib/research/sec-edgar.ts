type SecFundamentals = {
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

const latest = (values: readonly FactValue[], annualOnly = false): number | null => {
    const eligible = annualOnly ? values.filter((item) => isAnnualFiling(item) && isAnnualDuration(item)) : values;
    return [...eligible].sort((left, right) => right.end.localeCompare(left.end) || right.filed.localeCompare(left.filed))[0]?.value ?? null;
};

const latestPeriod = (values: readonly FactValue[]): string | null => {
    const annual = values.filter((item) => isAnnualFiling(item) && isAnnualDuration(item));
    return [...annual].sort((left, right) => right.end.localeCompare(left.end) || right.filed.localeCompare(left.filed))[0]?.end ?? null;
};

const annualPair = (values: readonly FactValue[], durationOnly = true): readonly [number, number] | null => {
    const annual = values.filter((item) => isAnnualFiling(item) && (!durationOnly || item.start === null || isAnnualDuration(item)));
    const byEnd = new Map<string, FactValue>();
    for (const item of annual) if (!byEnd.has(item.end) || (byEnd.get(item.end)?.filed ?? '') < item.filed) byEnd.set(item.end, item);
    const sorted = [...byEnd.values()].sort((left, right) => right.end.localeCompare(left.end));
    return sorted.length >= 2 ? [sorted[0].value, sorted[1].value] : null;
};

const ratio = (numerator: number | null, denominator: number | null) =>
    numerator === null || denominator === null || denominator === 0 ? null : Number(((numerator / denominator) * 100).toFixed(1));

const totalDebt = (facts: Record<string, unknown>): number | null => {
    const current = latest(factValues(facts, ['LongTermDebtCurrent', 'LongTermDebtAndFinanceLeaseObligationsCurrent'], 'USD'));
    const noncurrent = latest(factValues(facts, ['LongTermDebtNoncurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'], 'USD'));
    if (current !== null && noncurrent !== null) return current + noncurrent;
    return latest(factValues(facts, ['LongTermDebtAndFinanceLeaseObligations', 'LongTermDebt'], 'USD'));
};

export const parseSecCompanyFacts = (payload: unknown): SecFundamentals => {
    const root = objectValue(payload);
    const facts = objectValue(root?.facts);
    const usGaap = objectValue(facts?.['us-gaap']);
    if (!usGaap) throw new Error('SEC EDGAR returned an invalid company facts response.');
    const revenue = factValues(usGaap, ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'], 'USD');
    const revenueLatest = latest(revenue, true);
    const pair = annualPair(revenue);
    const grossProfit = latest(factValues(usGaap, ['GrossProfit'], 'USD'), true);
    const operatingIncome = latest(factValues(usGaap, ['OperatingIncomeLoss'], 'USD'), true);
    const netIncome = latest(factValues(usGaap, ['NetIncomeLoss', 'ProfitLoss'], 'USD'), true);
    const operatingCash = latest(factValues(usGaap, ['NetCashProvidedByUsedInOperatingActivities'], 'USD'), true);
    const capex = latest(factValues(usGaap, ['PaymentsToAcquirePropertyPlantAndEquipment'], 'USD'), true);
    const debt = totalDebt(usGaap);
    const shares = factValues(usGaap, ['EntityCommonStockSharesOutstanding', 'CommonStockSharesOutstanding'], 'shares');
    const sharePair = annualPair(shares, false);
    return {
        revenueGrowthPercent: pair === null || pair[1] === 0 ? null : Number((((pair[0] - pair[1]) / Math.abs(pair[1])) * 100).toFixed(1)),
        grossMarginPercent: ratio(grossProfit, revenueLatest),
        operatingMarginPercent: ratio(operatingIncome, revenueLatest),
        freeCashFlow: operatingCash === null || capex === null ? null : operatingCash - capex,
        debt,
        cash: latest(factValues(usGaap, ['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], 'USD')),
        shares: latest(shares),
        annualRevenue: revenueLatest,
        annualNetIncome: netIncome,
        reportingPeriod: latestPeriod(revenue),
        shareChangePercent: sharePair === null || sharePair[1] === 0 ? null : Number((((sharePair[0] - sharePair[1]) / Math.abs(sharePair[1])) * 100).toFixed(1)),
    };
};

const secHeaders = () => ({
    Accept: 'application/json',
    'User-Agent': process.env.SEC_USER_AGENT?.trim() || 'Signal research dashboard research@example.invalid',
});

export const fetchSecFundamentals = async (symbol: string): Promise<SecFundamentals> => {
    const tickersResponse = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: secHeaders(), next: { revalidate: 86400 } });
    if (!tickersResponse.ok) throw new Error(`SEC ticker lookup failed (${tickersResponse.status}).`);
    const tickers = objectValue(await tickersResponse.json());
    const match = Object.values(tickers ?? {}).map(objectValue).find((item) => typeof item?.ticker === 'string' && item.ticker.toUpperCase() === symbol);
    if (!match || typeof match.cik_str !== 'number') throw new Error(`SEC has no CIK mapping for ${symbol}.`);
    const cik = Math.trunc(match.cik_str).toString().padStart(10, '0');
    const factsResponse = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: secHeaders(), next: { revalidate: 21600 } });
    if (!factsResponse.ok) throw new Error(`SEC company facts request failed (${factsResponse.status}).`);
    return parseSecCompanyFacts(await factsResponse.json());
};
