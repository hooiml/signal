import type { PortfolioReconciledHolding } from '../portfolio/holdings';
import type { PortfolioCurrency } from '../types/portfolio-holdings';
import {
    researchFactorDirections,
    researchFactorIds,
    researchFactorMaterialities,
    type ResearchFactorAssumption,
    type ResearchFactorAssumptionSet,
    type ResearchFactorDirection,
    type ResearchFactorId,
    type ResearchFactorMateriality,
} from '../types/research';

export const RESEARCH_FACTOR_ASSUMPTION_LIMIT = 10;
export const RESEARCH_FACTOR_EVIDENCE_NOTE_LIMIT = 500;

export const researchFactorTaxonomy: Readonly<Record<ResearchFactorId, {
    readonly label: string;
    readonly description: string;
}>> = {
    'interest-rates': {
        label: 'Interest rates',
        description: 'Broad borrowing-cost and discount-rate pressure.',
    },
    'usd-myr-fx': {
        label: 'USD/MYR FX',
        description: 'A rise means one USD buys more MYR.',
    },
    'oil-energy-prices': {
        label: 'Oil / energy prices',
        description: 'Broad oil, fuel, and energy price pressure.',
    },
    'semiconductor-cycle': {
        label: 'Semiconductor cycle',
        description: 'Demand, inventory, utilization, and pricing across semiconductors.',
    },
    'ai-data-center-capex': {
        label: 'AI / data-center capex',
        description: 'Capital spending on AI compute and data-center infrastructure.',
    },
    'china-growth': {
        label: 'China growth',
        description: 'Broad Chinese economic and business-activity growth.',
    },
    'consumer-demand': {
        label: 'Consumer demand',
        description: 'Broad discretionary and household spending demand.',
    },
    'credit-conditions': {
        label: 'Credit conditions',
        description: 'A rise means credit is more available and easier, not tighter.',
    },
    'broad-volatility': {
        label: 'Broad volatility',
        description: 'Broad market volatility and risk aversion.',
    },
    'commodity-input-costs': {
        label: 'Commodity / input costs',
        description: 'Broad non-energy commodity and operating input costs.',
    },
};

export const researchFactorDirectionLabels: Readonly<Record<ResearchFactorDirection, string>> = {
    'benefits-when-rises': 'Benefits when factor rises',
    'harmed-when-rises': 'Harmed when factor rises',
    mixed: 'Mixed',
};

export const researchFactorMaterialityLabels: Readonly<Record<ResearchFactorMateriality, string>> = {
    low: 'Low',
    moderate: 'Moderate',
    high: 'High',
};

export const defaultResearchFactorAssumptionSet: ResearchFactorAssumptionSet = {
    version: 1,
    migrationState: 'current',
    assumptions: [],
};

export class ResearchFactorAssumptionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchFactorAssumptionError';
    }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const enumValue = <T extends string>(value: unknown, values: readonly T[], label: string): T => {
    if (typeof value === 'string' && values.includes(value as T)) return value as T;
    throw new ResearchFactorAssumptionError(`${label} is invalid.`);
};

const evidenceDate = (value: unknown, label: string): string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new ResearchFactorAssumptionError(`${label} must use YYYY-MM-DD.`);
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new ResearchFactorAssumptionError(`${label} must be a valid calendar date.`);
    }
    return value;
};

export const parseResearchFactorAssumptionSet = (
    value: unknown,
    allowedEvidenceIds?: ReadonlySet<string>,
): ResearchFactorAssumptionSet => {
    if (!isObject(value) || value.version !== 1 || !Array.isArray(value.assumptions)) {
        throw new ResearchFactorAssumptionError('factorAssumptions must be a version-1 assumption set.');
    }
    if (value.assumptions.length > RESEARCH_FACTOR_ASSUMPTION_LIMIT) {
        throw new ResearchFactorAssumptionError(`factorAssumptions must contain at most ${RESEARCH_FACTOR_ASSUMPTION_LIMIT} assumptions.`);
    }
    const assumptions = value.assumptions.map((entry, index): ResearchFactorAssumption => {
        const label = `factorAssumptions.assumptions[${index}]`;
        if (!isObject(entry)) throw new ResearchFactorAssumptionError(`${label} must be an object.`);
        const evidenceNote = typeof entry.evidenceNote === 'string' ? entry.evidenceNote.trim() : '';
        if (evidenceNote.length > RESEARCH_FACTOR_EVIDENCE_NOTE_LIMIT) {
            throw new ResearchFactorAssumptionError(`${label}.evidenceNote must be at most ${RESEARCH_FACTOR_EVIDENCE_NOTE_LIMIT} characters.`);
        }
        const evidenceId = entry.evidenceId === null || entry.evidenceId === undefined
            ? null
            : typeof entry.evidenceId === 'string' && /^[A-Za-z0-9:._-]{1,180}$/.test(entry.evidenceId)
                ? entry.evidenceId
                : (() => { throw new ResearchFactorAssumptionError(`${label}.evidenceId is invalid.`); })();
        if (evidenceId !== null && allowedEvidenceIds && !allowedEvidenceIds.has(evidenceId)) {
            throw new ResearchFactorAssumptionError(`${label}.evidenceId does not belong to this research record.`);
        }
        return {
            factor: enumValue(entry.factor, researchFactorIds, `${label}.factor`),
            direction: enumValue(entry.direction, researchFactorDirections, `${label}.direction`),
            materiality: enumValue(entry.materiality, researchFactorMaterialities, `${label}.materiality`),
            evidenceNote,
            evidenceDate: evidenceDate(entry.evidenceDate, `${label}.evidenceDate`),
            evidenceId,
        };
    });
    if (new Set(assumptions.map((assumption) => assumption.factor)).size !== assumptions.length) {
        throw new ResearchFactorAssumptionError('factorAssumptions may contain at most one assumption per factor.');
    }
    return { version: 1, migrationState: 'current', assumptions };
};

export const migrateResearchFactorAssumptionSet = (
    value: unknown,
    allowedEvidenceIds?: ReadonlySet<string>,
): ResearchFactorAssumptionSet => {
    if (value === undefined) return { version: 1, migrationState: 'migrated-empty', assumptions: [] };
    try {
        return parseResearchFactorAssumptionSet(value, allowedEvidenceIds);
    } catch {
        return { version: 1, migrationState: 'invalid-recovered', assumptions: [] };
    }
};

export const researchFactorEvidenceIds = (record: {
    readonly acceptedEvidence: readonly { readonly id: string }[];
    readonly documentEvidence: { readonly citations: readonly { readonly id: string }[] };
}): ReadonlySet<string> => new Set([
    ...record.acceptedEvidence.map((evidence) => evidence.id),
    ...record.documentEvidence.citations.map((citation) => citation.id),
]);

export type PortfolioFactorCell = {
    readonly assumption: ResearchFactorAssumption;
    readonly marketValue: number | null;
};

export type PortfolioFactorHoldingRow = {
    readonly holding: PortfolioReconciledHolding['holding'];
    readonly matched: boolean;
    readonly missingPrice: boolean;
    readonly cells: Readonly<Partial<Record<ResearchFactorId, PortfolioFactorCell>>>;
};

export type PortfolioFactorAggregate = {
    readonly factor: ResearchFactorId;
    readonly knownValueDenominator: number;
    readonly knownValueWithAssumption: number;
    readonly benefitsKnownValue: number;
    readonly harmedKnownValue: number;
    readonly mixedKnownValue: number;
    readonly knownValueCoveragePercent: number | null;
    readonly benefitsSharePercent: number | null;
    readonly harmedSharePercent: number | null;
    readonly mixedSharePercent: number | null;
    readonly holdingsWithAssumption: number;
    readonly totalHoldings: number;
};

export type PortfolioFactorGroup = {
    readonly accountLabel: string;
    readonly currency: PortfolioCurrency;
    readonly rows: readonly PortfolioFactorHoldingRow[];
    readonly factors: readonly ResearchFactorId[];
    readonly aggregates: readonly PortfolioFactorAggregate[];
    readonly knownValue: number;
    readonly missingPriceCount: number;
    readonly unmatchedCount: number;
    readonly noAssumptionCount: number;
};

const percent = (numerator: number, denominator: number): number | null =>
    denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : null;

export const buildPortfolioFactorExposure = (
    reconciled: readonly PortfolioReconciledHolding[],
): readonly PortfolioFactorGroup[] => {
    const groups = new Map<string, PortfolioReconciledHolding[]>();
    for (const holding of reconciled) {
        const key = `${holding.holding.accountLabel}\u0000${holding.holding.currency}`;
        groups.set(key, [...(groups.get(key) ?? []), holding]);
    }
    return [...groups.values()].map((holdings): PortfolioFactorGroup => {
        const accountLabel = holdings[0]!.holding.accountLabel;
        const currency = holdings[0]!.holding.currency;
        const rows = holdings.map((holding): PortfolioFactorHoldingRow => ({
            holding: holding.holding,
            matched: holding.researchRecord !== null,
            missingPrice: holding.marketValue === null,
            cells: Object.fromEntries((holding.researchRecord?.factorAssumptions.assumptions ?? []).map((assumption) => [
                assumption.factor,
                { assumption, marketValue: holding.marketValue },
            ])),
        }));
        const factors = researchFactorIds.filter((factor) =>
            rows.some((row) => row.cells[factor] !== undefined));
        const knownValue = holdings.reduce((sum, holding) => sum + (holding.marketValue ?? 0), 0);
        const aggregates = factors.map((factor): PortfolioFactorAggregate => {
            const cells = rows.flatMap((row) => row.cells[factor] ? [row.cells[factor]!] : []);
            const valueFor = (direction: ResearchFactorDirection) => cells
                .filter((cell) => cell.assumption.direction === direction)
                .reduce((sum, cell) => sum + (cell.marketValue ?? 0), 0);
            const knownValueWithAssumption = cells.reduce((sum, cell) => sum + (cell.marketValue ?? 0), 0);
            const benefitsKnownValue = valueFor('benefits-when-rises');
            const harmedKnownValue = valueFor('harmed-when-rises');
            const mixedKnownValue = valueFor('mixed');
            return {
                factor,
                knownValueDenominator: Number(knownValue.toFixed(2)),
                knownValueWithAssumption: Number(knownValueWithAssumption.toFixed(2)),
                benefitsKnownValue: Number(benefitsKnownValue.toFixed(2)),
                harmedKnownValue: Number(harmedKnownValue.toFixed(2)),
                mixedKnownValue: Number(mixedKnownValue.toFixed(2)),
                knownValueCoveragePercent: percent(knownValueWithAssumption, knownValue),
                benefitsSharePercent: percent(benefitsKnownValue, knownValue),
                harmedSharePercent: percent(harmedKnownValue, knownValue),
                mixedSharePercent: percent(mixedKnownValue, knownValue),
                holdingsWithAssumption: cells.length,
                totalHoldings: rows.length,
            };
        });
        return {
            accountLabel,
            currency,
            rows,
            factors,
            aggregates,
            knownValue: Number(knownValue.toFixed(2)),
            missingPriceCount: holdings.filter((holding) => holding.marketValue === null).length,
            unmatchedCount: holdings.filter((holding) => holding.researchRecord === null).length,
            noAssumptionCount: holdings.filter((holding) =>
                holding.researchRecord !== null && holding.researchRecord.factorAssumptions.assumptions.length === 0).length,
        };
    }).sort((left, right) =>
        left.accountLabel.localeCompare(right.accountLabel) || left.currency.localeCompare(right.currency));
};
