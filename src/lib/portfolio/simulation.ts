import {
    escapeSpreadsheetCell,
    parsePortfolioAccountLabel,
    parsePortfolioCurrency,
    parsePortfolioFiniteNumber,
    parsePortfolioHoldingsSnapshot,
    parsePortfolioMarket,
    parsePortfolioSymbol,
    portfolioHoldingIdentity,
} from './holdings';
import { assessInvestmentPolicy, type InvestmentPolicy, type InvestmentPolicyViolationKind } from '../research/investment-policy';
import { calculatePositionPlanRisk } from '../research/position-plan';
import type { PortfolioCurrency, PortfolioHoldingsSnapshot, PortfolioImportedHolding } from '../types/portfolio-holdings';
import type { ResearchMarket, ResearchRecord } from '../types/research';

export const portfolioSimulationVersion = 1 as const;
export const portfolioSimulationLimits = {
    maxLegs: 20,
    maxLegIdLength: 80,
} as const;

export type PortfolioSimulationSide = 'buy' | 'sell';

export type PortfolioSimulationLegInput = {
    readonly id: string;
    readonly accountLabel: string;
    readonly symbol: string;
    readonly market: string;
    readonly currency: string;
    readonly side: string;
    readonly quantity: number | string;
    readonly assumedPrice: number | string;
};

export type PortfolioSimulationResearchInput = {
    readonly record: ResearchRecord;
    readonly sector: string;
    readonly currentPrice: number | null;
};

export type PortfolioSimulationLegResult = {
    readonly id: string;
    readonly accountLabel: string;
    readonly symbol: string;
    readonly market: ResearchMarket | null;
    readonly currency: PortfolioCurrency | null;
    readonly side: PortfolioSimulationSide | null;
    readonly quantity: number | null;
    readonly assumedPrice: number | null;
    readonly cashEffect: number | null;
    readonly quantityBefore: number | null;
    readonly quantityAfter: number | null;
    readonly averageCostAfter: number | null;
    readonly researchMatched: boolean;
    readonly errors: readonly string[];
};

export type PortfolioSimulationPosition = {
    readonly accountLabel: string;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly currency: PortfolioCurrency;
    readonly quantity: number;
    readonly averageCost: number;
    readonly valuationPrice: number | null;
    readonly marketValue: number | null;
    readonly researchMatched: boolean;
    readonly sector: string | null;
    readonly weightPercent: number | null;
};

export type PortfolioSimulationPolicyBreach = {
    readonly symbol: string;
    readonly kind: InvestmentPolicyViolationKind;
    readonly message: string;
};

export type PortfolioSimulationBucket = {
    readonly accountLabel: string;
    readonly currency: PortfolioCurrency;
    readonly cashBalance: number;
    readonly knownInvestedValue: number;
    readonly totalKnownValue: number;
    readonly missingMarketValues: number;
    readonly importedPositions: number;
    readonly matchedPositions: number;
    readonly unmatchedPositions: number;
    readonly largestPosition: { readonly symbol: string; readonly weightPercent: number } | null;
    readonly sectors: readonly { readonly label: string; readonly weightPercent: number }[];
    readonly definedDownsideValue: number;
    readonly portfolioAtRiskPercent: number | null;
    readonly riskCoveredPositions: number;
    readonly riskExcludedPositions: number;
    readonly policyBreaches: readonly PortfolioSimulationPolicyBreach[];
};

export type PortfolioSimulationState = {
    readonly positions: readonly PortfolioSimulationPosition[];
    readonly buckets: readonly PortfolioSimulationBucket[];
};

export type PortfolioSimulationResult = {
    readonly version: typeof portfolioSimulationVersion;
    readonly status: 'empty' | 'invalid' | 'ready';
    readonly legs: readonly PortfolioSimulationLegResult[];
    readonly before: PortfolioSimulationState;
    readonly after: PortfolioSimulationState;
    readonly warnings: readonly string[];
    readonly assumptions: readonly string[];
};

type ValidatedLeg = {
    readonly index: number;
    readonly id: string;
    readonly accountLabel: string;
    readonly symbol: string;
    readonly market: ResearchMarket;
    readonly currency: PortfolioCurrency;
    readonly side: PortfolioSimulationSide;
    readonly quantity: number;
    readonly assumedPrice: number;
    readonly identity: string;
};

type MutableLeg = {
    input: PortfolioSimulationLegInput;
    validated: ValidatedLeg | null;
    errors: string[];
};

type WorkingHolding = Omit<PortfolioImportedHolding, 'importedAt' | 'provenanceLabel'>;

const round = (value: number, digits = 2): number => Number(value.toFixed(digits));
const researchIdentity = (market: ResearchMarket, symbol: string): string => `${market}:${symbol}`;
const bucketIdentity = (accountLabel: string, currency: PortfolioCurrency): string => `${accountLabel}\u0000${currency}`;

const validLegId = (value: unknown, index: number): string => {
    if (typeof value !== 'string') return `leg-${index + 1}`;
    const id = value.trim();
    return id && id.length <= portfolioSimulationLimits.maxLegIdLength ? id : `leg-${index + 1}`;
};

const validateLeg = (
    input: PortfolioSimulationLegInput,
    index: number,
    accounts: ReadonlySet<string>,
): MutableLeg => {
    const errors: string[] = [];
    let accountLabel = '';
    let symbol = '';
    let market: ResearchMarket | null = null;
    let currency: PortfolioCurrency | null = null;
    let side: PortfolioSimulationSide | null = null;
    let quantity: number | null = null;
    let assumedPrice: number | null = null;
    try {
        accountLabel = parsePortfolioAccountLabel(input.accountLabel);
        if (!accounts.has(accountLabel)) errors.push('Select an exact account from the accepted holdings snapshot.');
    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Account label is invalid.');
    }
    try {
        symbol = parsePortfolioSymbol(input.symbol);
    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Symbol is invalid.');
    }
    try {
        market = parsePortfolioMarket(input.market);
    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Market is invalid.');
    }
    try {
        currency = parsePortfolioCurrency(input.currency);
    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Currency is invalid.');
    }
    const normalizedSide = typeof input.side === 'string' ? input.side.trim().toLowerCase() : '';
    if (normalizedSide === 'buy' || normalizedSide === 'sell') side = normalizedSide;
    else errors.push('Side must be buy or sell.');
    try {
        quantity = parsePortfolioFiniteNumber(input.quantity, 'Quantity', { positive: true });
    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Quantity is invalid.');
    }
    try {
        assumedPrice = parsePortfolioFiniteNumber(input.assumedPrice, 'Assumed price', { positive: true });
    } catch (error) {
        errors.push(error instanceof Error ? error.message : 'Assumed price is invalid.');
    }
    const validated = errors.length === 0 && market && currency && side && quantity !== null && assumedPrice !== null
        ? {
            index,
            id: validLegId(input.id, index),
            accountLabel,
            symbol,
            market,
            currency,
            side,
            quantity,
            assumedPrice,
            identity: portfolioHoldingIdentity({ accountLabel, market, symbol }),
        }
        : null;
    return { input, validated, errors };
};

const researchMap = (
    inputs: readonly PortfolioSimulationResearchInput[],
): ReadonlyMap<string, PortfolioSimulationResearchInput> => new Map(inputs.map((input) => [
    researchIdentity(input.record.market, input.record.symbol),
    input,
]));

const applyWeights = (
    positions: readonly Omit<PortfolioSimulationPosition, 'weightPercent'>[],
    buckets: ReadonlyMap<string, { readonly totalKnownValue: number; readonly complete: boolean }>,
): readonly PortfolioSimulationPosition[] => positions.map((position) => {
    const bucket = buckets.get(bucketIdentity(position.accountLabel, position.currency));
    return {
        ...position,
        weightPercent: position.marketValue !== null && bucket?.complete && bucket.totalKnownValue > 0
            ? round((position.marketValue / bucket.totalKnownValue) * 100)
            : null,
    };
});

const buildState = (
    snapshot: PortfolioHoldingsSnapshot,
    holdings: readonly WorkingHolding[],
    research: ReadonlyMap<string, PortfolioSimulationResearchInput>,
    policy: InvestmentPolicy,
    today: string,
    assumedPrices: ReadonlyMap<string, number>,
): PortfolioSimulationState => {
    const basePositions = holdings.map((holding) => {
        const match = research.get(researchIdentity(holding.market, holding.symbol)) ?? null;
        const assumed = assumedPrices.get(portfolioHoldingIdentity(holding));
        const currentPrice = match && typeof match.currentPrice === 'number'
            && Number.isFinite(match.currentPrice) && match.currentPrice >= 0
            ? match.currentPrice
            : null;
        const valuationPrice = assumed ?? currentPrice;
        return {
            accountLabel: holding.accountLabel,
            symbol: holding.symbol,
            market: holding.market,
            currency: holding.currency,
            quantity: round(holding.quantity, 8),
            averageCost: round(holding.averageCost),
            valuationPrice,
            marketValue: valuationPrice === null ? null : round(holding.quantity * valuationPrice),
            researchMatched: match !== null,
            sector: match && match.sector.trim() ? match.sector.trim() : null,
        };
    }).sort((left, right) =>
        left.accountLabel.localeCompare(right.accountLabel)
        || left.currency.localeCompare(right.currency)
        || left.market.localeCompare(right.market)
        || left.symbol.localeCompare(right.symbol));

    const bucketKeys = new Set<string>([
        ...basePositions.map((position) => bucketIdentity(position.accountLabel, position.currency)),
        ...snapshot.cashBalances.map((cash) => bucketIdentity(cash.accountLabel, cash.currency)),
    ]);
    const preliminary = new Map([...bucketKeys].map((key) => {
        const [accountLabel = '', currency = 'USD'] = key.split('\u0000') as [string, PortfolioCurrency];
        const bucketPositions = basePositions.filter((position) =>
            position.accountLabel === accountLabel && position.currency === currency);
        const knownInvestedValue = round(bucketPositions.reduce((sum, position) => sum + (position.marketValue ?? 0), 0));
        const cashBalance = round(snapshot.cashBalances
            .filter((cash) => cash.accountLabel === accountLabel && cash.currency === currency)
            .reduce((sum, cash) => sum + cash.balance, 0));
        const missingMarketValues = bucketPositions.filter((position) => position.marketValue === null).length;
        return [key, {
            accountLabel,
            currency,
            cashBalance,
            knownInvestedValue,
            totalKnownValue: round(knownInvestedValue + cashBalance),
            complete: missingMarketValues === 0,
            missingMarketValues,
        }] as const;
    }));
    const positions = applyWeights(basePositions, preliminary);

    const buckets = [...preliminary.values()].map((summary): PortfolioSimulationBucket => {
        const bucketPositions = positions.filter((position) =>
            position.accountLabel === summary.accountLabel && position.currency === summary.currency);
        const weighted = bucketPositions.filter((position): position is PortfolioSimulationPosition & { weightPercent: number } =>
            position.weightPercent !== null);
        const sectorWeights = new Map<string, number>();
        for (const position of weighted) {
            if (position.sector) sectorWeights.set(position.sector, (sectorWeights.get(position.sector) ?? 0) + position.weightPercent);
        }
        const sectors = [...sectorWeights.entries()]
            .map(([label, weightPercent]) => ({ label, weightPercent: round(weightPercent) }))
            .sort((left, right) => right.weightPercent - left.weightPercent || left.label.localeCompare(right.label));
        const largestPosition = [...weighted]
            .sort((left, right) => right.weightPercent - left.weightPercent || left.symbol.localeCompare(right.symbol))[0] ?? null;

        let definedDownsideValue = 0;
        let riskCoveredPositions = 0;
        for (const position of bucketPositions) {
            const match = research.get(researchIdentity(position.market, position.symbol));
            if (!match || position.valuationPrice === null || position.marketValue === null) continue;
            const risk = calculatePositionPlanRisk({
                ...match.record.positionPlan,
                plannedAllocationPercent: 100,
                averageCost: null,
                plannedEntryPrice: null,
            }, position.valuationPrice);
            if (!risk) continue;
            riskCoveredPositions += 1;
            definedDownsideValue += position.quantity
                * (position.valuationPrice - match.record.positionPlan.invalidationPrice!);
        }

        const policyEntries = bucketPositions.flatMap((position) => {
            const match = research.get(researchIdentity(position.market, position.symbol));
            if (!match) return [];
            return [{
                record: {
                    ...match.record,
                    positionPlan: {
                        ...match.record.positionPlan,
                        plannedAllocationPercent: position.weightPercent,
                    },
                },
                sector: position.sector ?? 'Unknown',
            }];
        });
        const policyBreaches = assessInvestmentPolicy(policyEntries, policy, today).flatMap((assessment) =>
            assessment.violations
                .filter((violation) => violation.kind !== 'sector-allocation' || assessment.sector !== 'Unknown')
                .map((violation) => ({
                    symbol: assessment.symbol,
                    kind: violation.kind,
                    message: violation.message,
                })));

        return {
            accountLabel: summary.accountLabel,
            currency: summary.currency,
            cashBalance: summary.cashBalance,
            knownInvestedValue: summary.knownInvestedValue,
            totalKnownValue: summary.totalKnownValue,
            missingMarketValues: summary.missingMarketValues,
            importedPositions: bucketPositions.length,
            matchedPositions: bucketPositions.filter((position) => position.researchMatched).length,
            unmatchedPositions: bucketPositions.filter((position) => !position.researchMatched).length,
            largestPosition: largestPosition
                ? { symbol: largestPosition.symbol, weightPercent: largestPosition.weightPercent }
                : null,
            sectors,
            definedDownsideValue: round(definedDownsideValue),
            portfolioAtRiskPercent: summary.complete && summary.totalKnownValue > 0
                ? round((definedDownsideValue / summary.totalKnownValue) * 100)
                : null,
            riskCoveredPositions,
            riskExcludedPositions: bucketPositions.length - riskCoveredPositions,
            policyBreaches,
        };
    }).sort((left, right) =>
        left.accountLabel.localeCompare(right.accountLabel) || left.currency.localeCompare(right.currency));

    return { positions, buckets };
};

export const simulatePortfolioScenario = (
    snapshotInput: PortfolioHoldingsSnapshot,
    legInputs: readonly PortfolioSimulationLegInput[],
    researchInputs: readonly PortfolioSimulationResearchInput[],
    policy: InvestmentPolicy,
    today = new Date().toISOString().slice(0, 10),
): PortfolioSimulationResult => {
    const snapshot = parsePortfolioHoldingsSnapshot(snapshotInput);
    const accounts = new Set([
        ...snapshot.holdings.map((holding) => holding.accountLabel),
        ...snapshot.cashBalances.map((cash) => cash.accountLabel),
    ]);
    const research = researchMap(researchInputs);
    const mutableLegs = legInputs.map((input, index) => validateLeg(input, index, accounts));
    const globalErrors: string[] = [];
    if (legInputs.length > portfolioSimulationLimits.maxLegs) {
        globalErrors.push(`A scenario supports at most ${portfolioSimulationLimits.maxLegs} legs.`);
        mutableLegs.slice(portfolioSimulationLimits.maxLegs).forEach((leg) =>
            leg.errors.push(`This leg exceeds the ${portfolioSimulationLimits.maxLegs}-leg limit.`));
    }

    const byIdentity = new Map<string, MutableLeg[]>();
    for (const leg of mutableLegs) {
        if (!leg.validated) continue;
        const duplicates = byIdentity.get(leg.validated.identity) ?? [];
        duplicates.push(leg);
        byIdentity.set(leg.validated.identity, duplicates);
    }
    for (const duplicates of byIdentity.values()) {
        if (duplicates.length < 2) continue;
        duplicates.forEach((leg) => leg.errors.push('Duplicate or conflicting legs for the same account, market, and symbol are not allowed.'));
    }

    const holdingByIdentity = new Map(snapshot.holdings.map((holding) => [portfolioHoldingIdentity(holding), holding]));
    for (const leg of mutableLegs) {
        const value = leg.validated;
        if (!value) continue;
        const holding = holdingByIdentity.get(value.identity);
        if (holding && holding.currency !== value.currency) {
            leg.errors.push(`Currency must match the selected holding currency ${holding.currency}.`);
        }
        if (value.side === 'sell') {
            if (!holding) leg.errors.push('Sell leg requires an exact holding in the selected account.');
            else if (value.quantity > holding.quantity) {
                leg.errors.push(`Sell quantity exceeds the available holding quantity ${holding.quantity}.`);
            }
        }
    }

    const before = buildState(
        snapshot,
        snapshot.holdings.map(({ accountLabel, symbol, market, currency, quantity, averageCost }) =>
            ({ accountLabel, symbol, market, currency, quantity, averageCost })),
        research,
        policy,
        today,
        new Map(),
    );
    const invalid = globalErrors.length > 0 || mutableLegs.some((leg) => leg.errors.length > 0 || !leg.validated);

    const effects = new Map<string, {
        readonly quantityBefore: number;
        readonly quantityAfter: number;
        readonly averageCostAfter: number | null;
    }>();
    const assumedPrices = new Map<string, number>();
    const working = snapshot.holdings.map(({ accountLabel, symbol, market, currency, quantity, averageCost }) =>
        ({ accountLabel, symbol, market, currency, quantity, averageCost }));
    const cashDeltas = new Map<string, number>();

    if (!invalid) {
        for (const leg of mutableLegs) {
            const value = leg.validated!;
            const index = working.findIndex((holding) => portfolioHoldingIdentity(holding) === value.identity);
            const existing = index >= 0 ? working[index]! : null;
            const quantityBefore = existing?.quantity ?? 0;
            if (value.side === 'buy') {
                const quantityAfter = quantityBefore + value.quantity;
                const averageCostAfter = ((quantityBefore * (existing?.averageCost ?? 0)) + (value.quantity * value.assumedPrice))
                    / quantityAfter;
                const next: WorkingHolding = {
                    accountLabel: value.accountLabel,
                    symbol: value.symbol,
                    market: value.market,
                    currency: value.currency,
                    quantity: round(quantityAfter, 8),
                    averageCost: round(averageCostAfter),
                };
                if (index >= 0) working[index] = next;
                else working.push(next);
                effects.set(value.id, {
                    quantityBefore: round(quantityBefore, 8),
                    quantityAfter: next.quantity,
                    averageCostAfter: next.averageCost,
                });
            } else {
                const quantityAfter = round(quantityBefore - value.quantity, 8);
                if (quantityAfter === 0) working.splice(index, 1);
                else working[index] = { ...existing!, quantity: quantityAfter };
                effects.set(value.id, {
                    quantityBefore: round(quantityBefore, 8),
                    quantityAfter,
                    averageCostAfter: quantityAfter === 0 ? null : existing!.averageCost,
                });
            }
            assumedPrices.set(value.identity, value.assumedPrice);
            const cashKey = bucketIdentity(value.accountLabel, value.currency);
            const signedCash = value.quantity * value.assumedPrice * (value.side === 'buy' ? -1 : 1);
            cashDeltas.set(cashKey, (cashDeltas.get(cashKey) ?? 0) + signedCash);
        }
    }

    const simulatedSnapshot: PortfolioHoldingsSnapshot = {
        ...snapshot,
        cashBalances: snapshot.cashBalances.map((cash) => ({
            ...cash,
            balance: round(cash.balance + (cashDeltas.get(bucketIdentity(cash.accountLabel, cash.currency)) ?? 0)),
        })),
    };
    const cashKeys = new Set(snapshot.cashBalances.map((cash) => bucketIdentity(cash.accountLabel, cash.currency)));
    const additionalCash = invalid ? [] : [...cashDeltas.entries()].flatMap(([key, delta]) => {
        if (cashKeys.has(key)) return [];
        const [accountLabel = '', currency = 'USD'] = key.split('\u0000') as [string, PortfolioCurrency];
        return [{
            accountLabel,
            currency,
            balance: round(delta),
            importedAt: snapshot.updatedAt,
            provenanceLabel: 'Scenario-only cash delta',
        }];
    });
    const afterSnapshot = { ...simulatedSnapshot, cashBalances: [...simulatedSnapshot.cashBalances, ...additionalCash] };
    const after = invalid ? before : buildState(afterSnapshot, working, research, policy, today, assumedPrices);

    const legs = mutableLegs.map((leg): PortfolioSimulationLegResult => {
        const value = leg.validated;
        const holding = value ? holdingByIdentity.get(value.identity) : null;
        const effect = value ? effects.get(value.id) : null;
        return {
            id: validLegId(leg.input.id, value?.index ?? 0),
            accountLabel: value?.accountLabel ?? String(leg.input.accountLabel ?? '').trim(),
            symbol: value?.symbol ?? String(leg.input.symbol ?? '').trim().toUpperCase(),
            market: value?.market ?? null,
            currency: value?.currency ?? null,
            side: value?.side ?? null,
            quantity: value?.quantity ?? null,
            assumedPrice: value?.assumedPrice ?? null,
            cashEffect: value ? round(value.quantity * value.assumedPrice * (value.side === 'buy' ? -1 : 1)) : null,
            quantityBefore: effect?.quantityBefore ?? holding?.quantity ?? null,
            quantityAfter: effect?.quantityAfter ?? (invalid ? holding?.quantity ?? null : null),
            averageCostAfter: effect?.averageCostAfter ?? holding?.averageCost ?? null,
            researchMatched: value ? research.has(researchIdentity(value.market, value.symbol)) : false,
            errors: leg.errors,
        };
    });

    const warnings = [...globalErrors];
    if (!invalid) {
        after.buckets.filter((bucket) => bucket.cashBalance < 0).forEach((bucket) =>
            warnings.push(`${bucket.accountLabel} ${bucket.currency} has a simulated cash deficit of ${Math.abs(bucket.cashBalance).toFixed(2)}.`));
        const unmatched = legs.filter((leg) => leg.errors.length === 0 && !leg.researchMatched).length;
        if (unmatched > 0) warnings.push(`${unmatched} leg${unmatched === 1 ? '' : 's'} have no exact research match; sector, policy evidence, and defined downside remain unavailable.`);
        const missingValues = after.buckets.reduce((sum, bucket) => sum + bucket.missingMarketValues, 0);
        if (missingValues > 0) warnings.push(`${missingValues} simulated position value${missingValues === 1 ? ' is' : 's are'} unavailable and excluded from concentration totals.`);
    }

    return {
        version: portfolioSimulationVersion,
        status: legInputs.length === 0 ? 'empty' : invalid ? 'invalid' : 'ready',
        legs,
        before,
        after,
        warnings,
        assumptions: [
            'Only explicit quantities and assumed prices are applied; no market price, account, FX rate, fee, tax, or slippage is inferred.',
            'Cash changes stay inside the selected account and currency. Negative cash is shown as a warning and does not block the illustration.',
            'Exact market and symbol matches may reuse current research values, sector, policy evidence, and valid lower invalidation levels.',
            'This scenario is a browser-session illustration. It does not mutate holdings or research data, and no orders are sent.',
        ],
    };
};

const quoteCsv = (value: string | number): string => {
    const safe = escapeSpreadsheetCell(String(value));
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

const exportRows = (result: PortfolioSimulationResult, scenarioName: string): readonly (readonly (string | number)[])[] => [
    ['Scenario', escapeSpreadsheetCell(scenarioName || 'Untitled scenario')],
    ['Notice', 'No orders were sent. This is an illustration, not a recommendation, optimizer, forecast, or order ticket.'],
    ['Status', result.status],
    [],
    ['Leg', 'Account', 'Symbol', 'Market', 'Currency', 'Side', 'Quantity', 'Assumed price', 'Cash effect', 'Errors'],
    ...result.legs.map((leg) => [
        leg.id, leg.accountLabel, leg.symbol, leg.market ?? '', leg.currency ?? '', leg.side ?? '',
        leg.quantity ?? '', leg.assumedPrice ?? '', leg.cashEffect ?? '', leg.errors.join('; '),
    ]),
    [],
    ['State', 'Account', 'Currency', 'Cash', 'Known invested', 'Total known', 'Missing values', 'Matched', 'Unmatched', 'Largest position', 'Defined downside', 'Portfolio at risk', 'Policy breaches'],
    ...(['before', 'after'] as const).flatMap((state) => result[state].buckets.map((bucket) => [
        state,
        bucket.accountLabel,
        bucket.currency,
        bucket.cashBalance,
        bucket.knownInvestedValue,
        bucket.totalKnownValue,
        bucket.missingMarketValues,
        bucket.matchedPositions,
        bucket.unmatchedPositions,
        bucket.largestPosition ? `${bucket.largestPosition.symbol} ${bucket.largestPosition.weightPercent.toFixed(2)}%` : '',
        bucket.definedDownsideValue,
        bucket.portfolioAtRiskPercent ?? '',
        bucket.policyBreaches.map((breach) => `${breach.symbol}: ${breach.kind}`).join('; '),
    ])),
    [],
    ['Assumptions'],
    ...result.assumptions.map((assumption) => [assumption]),
];

export const buildPortfolioSimulationExport = (
    result: PortfolioSimulationResult,
    format: 'csv' | 'markdown',
    scenarioName = 'Untitled scenario',
): string => {
    const rows = exportRows(result, scenarioName);
    if (format === 'csv') return rows.map((row) => row.map(quoteCsv).join(',')).join('\r\n');
    return rows.map((row) => row.length === 0
        ? ''
        : `| ${row.map((cell) => escapeSpreadsheetCell(String(cell)).replaceAll('|', '\\|')).join(' | ')} |`).join('\n');
};
