import type {
    HistoricalValuationFact,
    HistoricalValuationMetric,
    HistoricalValuationObservation,
    HistoricalValuationReport,
} from '../types/historical-valuation';
import type { ResearchMarket } from '../types/research';

export const historicalValuationLimits = {
    maxObservations: 8,
    maxFactEntriesPerConcept: 500,
    maxPriceRows: 4_000,
    maxSplitEvents: 100,
    maxPriceGapDays: 7,
} as const;

export const HISTORICAL_VALUATION_PRICE_CONVENTION = 'First available Yahoo Finance daily close strictly after the SEC filed date, on the provider current split-adjusted basis; reported diluted shares are multiplied by subsequent split factors to use the same basis.';
export const ANALYST_REVISIONS_UNAVAILABLE_DETAIL = 'Unavailable: no suitable analyst estimate or revision-history provider is connected. Signal scores, news sentiment, and company guidance are not substitutes.';

type RawFact = {
    readonly concept: string;
    readonly value: number;
    readonly unit: 'USD' | 'shares';
    readonly start: string;
    readonly end: string;
    readonly filed: string;
    readonly form: '10-K' | '10-K/A';
    readonly accession: string;
    readonly fiscalPeriod: string;
};

type PriceRow = { readonly date: string; readonly close: number };
type SplitEvent = { readonly date: string; readonly factor: number };

type HistoricalValuationBuildInput = {
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly cik: string | null;
    readonly companyName: string | null;
    readonly companyFacts: unknown | null;
    readonly chartPayload: unknown | null;
    readonly secError?: string | null;
    readonly priceError?: string | null;
    readonly generatedAt?: string;
};

const revenueConcepts = ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'] as const;
const netIncomeConcepts = ['NetIncomeLoss', 'ProfitLoss'] as const;
const operatingCashConcepts = ['NetCashProvidedByUsedInOperatingActivities'] as const;
const capexConcepts = ['PaymentsToAcquirePropertyPlantAndEquipment'] as const;
const dilutedSharesConcepts = ['WeightedAverageNumberOfDilutedSharesOutstanding'] as const;

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const finiteNumber = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const isIsoDate = (value: unknown): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`));

const durationDays = (start: string, end: string) =>
    Math.round((Date.parse(`${end}T00:00:00.000Z`) - Date.parse(`${start}T00:00:00.000Z`)) / 86_400_000);

const annualDuration = (fact: RawFact) => {
    const days = durationDays(fact.start, fact.end);
    return days >= 300 && days <= 430;
};

const factValues = (
    usGaap: Record<string, unknown>,
    concepts: readonly string[],
    unit: RawFact['unit'],
): readonly RawFact[] => {
    const parsed = concepts.flatMap((concept): RawFact[] => {
        const units = objectValue(objectValue(usGaap[concept])?.units);
        const entries = units?.[unit];
        if (!Array.isArray(entries)) return [];
        if (entries.length > historicalValuationLimits.maxFactEntriesPerConcept) {
            throw new Error(`SEC ${concept} exceeds the bounded fact-entry limit.`);
        }
        return entries.flatMap((entry): RawFact[] => {
            const item = objectValue(entry);
            const value = finiteNumber(item?.val);
            const form = item?.form;
            const accession = item?.accn;
            if (
                value === null
                || !isIsoDate(item?.start)
                || !isIsoDate(item?.end)
                || !isIsoDate(item?.filed)
                || (form !== '10-K' && form !== '10-K/A')
                || typeof accession !== 'string'
                || !/^\d{10}-\d{2}-\d{6}$/.test(accession)
                || typeof item?.fp !== 'string'
            ) return [];
            return [{
                concept,
                value,
                unit,
                start: item.start,
                end: item.end,
                filed: item.filed,
                form,
                accession,
                fiscalPeriod: item.fp,
            }];
        });
    });
    const unique = new Map<string, RawFact>();
    for (const fact of parsed) {
        const key = [fact.concept, fact.unit, fact.start, fact.end, fact.filed, fact.form, fact.accession, fact.fiscalPeriod].join('|');
        const existing = unique.get(key);
        if (existing && existing.value !== fact.value) {
            throw new Error(`SEC ${fact.concept} contains conflicting duplicate facts for one filing context.`);
        }
        unique.set(key, fact);
    }
    return [...unique.values()];
};

const firstMatchingFact = (
    values: readonly RawFact[],
    anchor: RawFact,
    concepts: readonly string[],
): RawFact | null => {
    for (const concept of concepts) {
        const match = values.find((fact) =>
            fact.concept === concept
            && fact.accession === anchor.accession
            && fact.start === anchor.start
            && fact.end === anchor.end
            && fact.filed === anchor.filed);
        if (match) return match;
    }
    return null;
};

const currentAnnualAnchors = (values: readonly RawFact[]) => {
    const byAccession = new Map<string, RawFact[]>();
    for (const fact of values.filter((candidate) => candidate.fiscalPeriod === 'FY' && annualDuration(candidate))) {
        byAccession.set(fact.accession, [...(byAccession.get(fact.accession) ?? []), fact]);
    }
    return [...byAccession.values()].flatMap((facts): RawFact[] => {
        const latestEnd = [...new Set(facts.map((fact) => fact.end))].sort().at(-1);
        if (!latestEnd) return [];
        for (const concept of revenueConcepts) {
            const anchor = facts.find((fact) => fact.end === latestEnd && fact.concept === concept);
            if (anchor) return [anchor];
        }
        return [];
    }).sort((left, right) => right.filed.localeCompare(left.filed) || right.accession.localeCompare(left.accession));
};

const factEvidence = (label: string, fact: RawFact | null): HistoricalValuationFact[] => fact ? [{
    label,
    concept: fact.concept,
    value: fact.value,
    unit: fact.unit,
    fiscalStart: fact.start,
    fiscalEnd: fact.end,
    filedAt: fact.filed,
    accession: fact.accession,
}] : [];

const parseChart = (payload: unknown): {
    readonly currency: string | null;
    readonly prices: readonly PriceRow[];
    readonly splits: readonly SplitEvent[];
} => {
    const chart = objectValue(objectValue(payload)?.chart);
    const results = chart?.result;
    const result = Array.isArray(results) ? objectValue(results[0]) : null;
    const meta = objectValue(result?.meta);
    const indicators = objectValue(result?.indicators);
    const quoteEntries = indicators?.quote;
    const quote = Array.isArray(quoteEntries) ? objectValue(quoteEntries[0]) : null;
    const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
    const closes = Array.isArray(quote?.close) ? quote.close : [];
    if (!result || !quote || timestamps.length > historicalValuationLimits.maxPriceRows || closes.length > historicalValuationLimits.maxPriceRows) {
        throw new Error('Yahoo Finance returned an invalid or oversized historical-price response.');
    }
    const prices = timestamps.flatMap((timestamp, index): PriceRow[] => {
        const seconds = finiteNumber(timestamp);
        const close = finiteNumber(closes[index]);
        if (seconds === null || close === null || close <= 0) return [];
        return [{ date: new Date(seconds * 1_000).toISOString().slice(0, 10), close }];
    }).sort((left, right) => left.date.localeCompare(right.date));
    const splitObject = objectValue(objectValue(result.events)?.splits);
    const splitEntries = Object.values(splitObject ?? {});
    if (splitEntries.length > historicalValuationLimits.maxSplitEvents) throw new Error('Yahoo Finance split history exceeds the bounded event limit.');
    const splits = splitEntries.flatMap((entry): SplitEvent[] => {
        const item = objectValue(entry);
        const seconds = finiteNumber(item?.date);
        const numerator = finiteNumber(item?.numerator);
        const denominator = finiteNumber(item?.denominator);
        if (seconds === null || numerator === null || denominator === null || numerator <= 0 || denominator <= 0) return [];
        return [{ date: new Date(seconds * 1_000).toISOString().slice(0, 10), factor: numerator / denominator }];
    }).sort((left, right) => left.date.localeCompare(right.date));
    return {
        currency: typeof meta?.currency === 'string' && /^[A-Z]{3}$/.test(meta.currency) ? meta.currency : null,
        prices,
        splits,
    };
};

const nextPrice = (prices: readonly PriceRow[], filedAt: string): PriceRow | null => {
    const row = prices.find((candidate) => candidate.date > filedAt) ?? null;
    if (!row || durationDays(filedAt, row.date) > historicalValuationLimits.maxPriceGapDays) return null;
    return row;
};

const subsequentSplitFactor = (splits: readonly SplitEvent[], priceDate: string) =>
    splits.filter((split) => split.date > priceDate).reduce((factor, split) => factor * split.factor, 1);

const rounded = (value: number) => Number(value.toFixed(2));

const metric = (value: number | null, formula: string, unavailableReason: string | null): HistoricalValuationMetric => ({
    value: value === null ? null : rounded(value),
    formula,
    unavailableReason: value === null ? unavailableReason : null,
});

const sameInputs = (left: HistoricalValuationObservation, right: HistoricalValuationObservation) =>
    left.annualRevenue === right.annualRevenue
    && left.annualNetIncome === right.annualNetIncome
    && left.operatingCashFlow === right.operatingCashFlow
    && left.capitalExpenditure === right.capitalExpenditure
    && left.reportedDilutedShares === right.reportedDilutedShares;

const buildObservations = (
    payload: unknown,
    cik: string,
    chart: ReturnType<typeof parseChart>,
): readonly HistoricalValuationObservation[] => {
    const usGaap = objectValue(objectValue(objectValue(payload)?.facts)?.['us-gaap']);
    if (!usGaap) throw new Error('SEC EDGAR returned no US-GAAP Company Facts.');
    const revenues = factValues(usGaap, revenueConcepts, 'USD');
    const netIncomeValues = factValues(usGaap, netIncomeConcepts, 'USD');
    const operatingCashValues = factValues(usGaap, operatingCashConcepts, 'USD');
    const capexValues = factValues(usGaap, capexConcepts, 'USD');
    const dilutedSharesValues = factValues(usGaap, dilutedSharesConcepts, 'shares');
    const anchors = currentAnnualAnchors(revenues).slice(0, historicalValuationLimits.maxObservations);

    const raw = anchors.map((anchor): HistoricalValuationObservation => {
        const revenue = firstMatchingFact(revenues, anchor, revenueConcepts);
        const netIncome = firstMatchingFact(netIncomeValues, anchor, netIncomeConcepts);
        const operatingCash = firstMatchingFact(operatingCashValues, anchor, operatingCashConcepts);
        const capex = firstMatchingFact(capexValues, anchor, capexConcepts);
        const dilutedShares = firstMatchingFact(dilutedSharesValues, anchor, dilutedSharesConcepts);
        const priceRow = nextPrice(chart.prices, anchor.filed);
        const priceCurrencySafe = chart.currency === 'USD';
        const splitFactor = priceRow ? subsequentSplitFactor(chart.splits, priceRow.date) : null;
        const splitAdjustedShares = dilutedShares && splitFactor !== null && dilutedShares.value > 0
            ? dilutedShares.value * splitFactor
            : null;
        const marketCapitalization = priceRow && priceCurrencySafe && splitAdjustedShares !== null
            ? priceRow.close * splitAdjustedShares
            : null;
        const freeCashFlow = operatingCash && capex ? operatingCash.value - capex.value : null;
        const sharedReason = !priceRow
            ? 'No daily close was available within seven calendar days strictly after the filing date.'
            : !priceCurrencySafe
                ? `Price currency ${chart.currency ?? 'unknown'} does not match SEC USD facts.`
                : !dilutedShares
                    ? 'The filing has no accession-aligned annual diluted weighted-average share fact.'
                    : dilutedShares.value <= 0
                        ? 'Diluted weighted-average shares are not positive.'
                        : null;
        const peReason = sharedReason ?? (!netIncome
            ? 'The filing has no accession-aligned annual net-income fact.'
            : netIncome.value <= 0 ? 'P/E is unavailable because annual net income is not positive.' : null);
        const psReason = sharedReason ?? (!revenue
            ? 'The filing has no accession-aligned annual revenue fact.'
            : revenue.value <= 0 ? 'Price-to-sales is unavailable because annual revenue is not positive.' : null);
        const fcfReason = sharedReason ?? (!operatingCash
            ? 'The filing has no accession-aligned annual operating-cash-flow fact.'
            : !capex ? 'The filing has no accession-aligned annual capital-expenditure fact.' : null);
        const accessionDirectory = anchor.accession.replaceAll('-', '');
        const filingUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accessionDirectory}/${anchor.accession}-index.html`;
        const facts = [
            ...factEvidence('Revenue', revenue),
            ...factEvidence('Net income', netIncome),
            ...factEvidence('Operating cash flow', operatingCash),
            ...factEvidence('Capital expenditure', capex),
            ...factEvidence('Diluted weighted-average shares', dilutedShares),
        ];
        const gaps = [peReason, psReason, fcfReason].filter((reason): reason is string => reason !== null)
            .filter((reason, index, reasons) => reasons.indexOf(reason) === index);
        return {
            id: `${anchor.accession}:${anchor.filed}`,
            fiscalPeriodStart: anchor.start,
            fiscalPeriodEnd: anchor.end,
            filedAt: anchor.filed,
            priceDate: priceRow?.date ?? null,
            price: priceRow && priceCurrencySafe ? rounded(priceRow.close) : null,
            priceCurrency: chart.currency,
            priceConvention: HISTORICAL_VALUATION_PRICE_CONVENTION,
            reportedDilutedShares: dilutedShares?.value ?? null,
            splitAdjustmentFactor: splitFactor === null ? null : rounded(splitFactor),
            splitAdjustedShares: splitAdjustedShares === null ? null : rounded(splitAdjustedShares),
            marketCapitalization: marketCapitalization === null ? null : rounded(marketCapitalization),
            annualRevenue: revenue?.value ?? null,
            annualNetIncome: netIncome?.value ?? null,
            operatingCashFlow: operatingCash?.value ?? null,
            capitalExpenditure: capex?.value ?? null,
            freeCashFlow,
            priceEarnings: metric(
                marketCapitalization !== null && netIncome && netIncome.value > 0 ? marketCapitalization / netIncome.value : null,
                'split-adjusted close × split-adjusted diluted shares ÷ annual net income',
                peReason,
            ),
            priceSales: metric(
                marketCapitalization !== null && revenue && revenue.value > 0 ? marketCapitalization / revenue.value : null,
                'split-adjusted close × split-adjusted diluted shares ÷ annual revenue',
                psReason,
            ),
            freeCashFlowYield: metric(
                marketCapitalization !== null && freeCashFlow !== null ? (freeCashFlow / marketCapitalization) * 100 : null,
                '(annual operating cash flow − annual capital expenditure) ÷ market capitalization × 100',
                fcfReason,
            ),
            form: anchor.form,
            accession: anchor.accession,
            isAmendment: anchor.form === '10-K/A',
            restatementStatus: 'original',
            filingUrl,
            facts,
            gaps,
        };
    });

    return raw.map((observation) => {
        if (!observation.isAmendment) return observation;
        const original = raw.find((candidate) =>
            !candidate.isAmendment
            && candidate.fiscalPeriodEnd === observation.fiscalPeriodEnd
            && candidate.filedAt < observation.filedAt);
        return {
            ...observation,
            restatementStatus: !original
                ? 'amended-baseline-unavailable' as const
                : !sameInputs(original, observation)
                    ? 'amended-values-changed' as const
                    : 'amended-unchanged' as const,
        };
    });
};

export const buildHistoricalValuationReport = (input: HistoricalValuationBuildInput): HistoricalValuationReport => {
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const warnings = [input.secError, input.priceError].filter((warning): warning is string => Boolean(warning));
    if (input.market !== 'US') {
        return {
            symbol: input.symbol,
            market: input.market,
            companyName: input.companyName,
            generatedAt,
            observationKind: 'filing observation',
            priceConvention: HISTORICAL_VALUATION_PRICE_CONVENTION,
            capabilities: {
                historicalPrices: { status: 'available', detail: 'Historical prices exist for charting, but are not used for valuation without period-correct filing facts.' },
                periodCorrectFundamentals: { status: 'unavailable', detail: 'Historical valuation is limited to US issuers with SEC US-GAAP 10-K facts. Bursa historical fundamentals require a separately approved licensed source.' },
                analystEstimateRevisions: { status: 'unavailable', detail: ANALYST_REVISIONS_UNAVAILABLE_DETAIL },
            },
            observations: [],
            sources: [],
            warnings,
        };
    }

    let chart: ReturnType<typeof parseChart> = { currency: null, prices: [], splits: [] };
    if (input.chartPayload !== null) {
        try {
            chart = parseChart(input.chartPayload);
        } catch (error) {
            warnings.push(error instanceof Error ? error.message : 'Historical prices could not be parsed.');
        }
    }
    let observations: readonly HistoricalValuationObservation[] = [];
    if (input.companyFacts !== null && input.cik) {
        try {
            observations = buildObservations(input.companyFacts, input.cik, chart);
        } catch (error) {
            warnings.push(error instanceof Error ? error.message : 'SEC Company Facts could not be parsed.');
        }
    }
    const metricCount = observations.reduce((count, observation) =>
        count + [observation.priceEarnings, observation.priceSales, observation.freeCashFlowYield]
            .filter((item) => item.value !== null).length, 0);
    const possibleMetricCount = observations.length * 3;
    const fundamentalsStatus = observations.length === 0
        ? 'unavailable' as const
        : metricCount === possibleMetricCount ? 'available' as const : 'partial' as const;
    return {
        symbol: input.symbol,
        market: input.market,
        companyName: input.companyName,
        generatedAt,
        observationKind: 'filing observation',
        priceConvention: HISTORICAL_VALUATION_PRICE_CONVENTION,
        capabilities: {
            historicalPrices: {
                status: chart.prices.length > 0 ? 'available' : 'unavailable',
                detail: chart.prices.length > 0
                    ? `${chart.prices.length} bounded daily closes were parsed; only the first close strictly after each filing is used.`
                    : 'Historical price rows are unavailable from the connected Yahoo Finance chart source.',
            },
            periodCorrectFundamentals: {
                status: fundamentalsStatus,
                detail: observations.length > 0
                    ? `${observations.length} accession-aligned annual filing observation${observations.length === 1 ? '' : 's'}; ${metricCount} of ${possibleMetricCount} metric values are calculable.`
                    : 'No safe accession-aligned SEC annual filing observations were available.',
            },
            analystEstimateRevisions: { status: 'unavailable', detail: ANALYST_REVISIONS_UNAVAILABLE_DETAIL },
        },
        observations,
        sources: [
            {
                name: 'SEC EDGAR Company Facts',
                url: input.cik ? `https://data.sec.gov/api/xbrl/companyfacts/CIK${input.cik}.json` : 'https://www.sec.gov/search-filings/edgar-application-programming-interfaces',
                detail: 'Official filing facts, accession, form, fiscal dates, units, and filed date.',
            },
            {
                name: 'Yahoo Finance chart',
                url: `https://finance.yahoo.com/quote/${encodeURIComponent(input.symbol)}/history/`,
                detail: 'Existing repository source for bounded daily closes and stock-split events.',
            },
        ],
        warnings,
    };
};
