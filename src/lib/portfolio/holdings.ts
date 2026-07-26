import type { ResearchMarket, ResearchRecord } from '../types/research';
import {
    portfolioHoldingSnapshotVersion,
    type PortfolioCurrency,
    type PortfolioHoldingsSnapshot,
    type PortfolioImportedCash,
    type PortfolioImportedHolding,
} from '../types/portfolio-holdings';

export const portfolioImportLimits = {
    maxFileBytes: 1_000_000,
    maxRows: 500,
    maxAccountLabelLength: 80,
    maxProvenanceLabelLength: 80,
} as const;

export type PortfolioCsvHoldingRow = Omit<PortfolioImportedHolding, 'importedAt' | 'provenanceLabel'>;
export type PortfolioCsvCashRow = Omit<PortfolioImportedCash, 'importedAt' | 'provenanceLabel'>;
export type PortfolioCsvRowError = {
    readonly rowNumber: number;
    readonly message: string;
    readonly values: Readonly<Record<string, string>>;
};
export type PortfolioCsvDuplicate = {
    readonly identity: string;
    readonly rowNumbers: readonly number[];
};
export type PortfolioCsvPreview = {
    readonly holdings: readonly PortfolioCsvHoldingRow[];
    readonly cashBalances: readonly PortfolioCsvCashRow[];
    readonly rejectedRows: readonly PortfolioCsvRowError[];
    readonly duplicates: readonly PortfolioCsvDuplicate[];
    readonly totalDataRows: number;
};

export type PortfolioImportConflictPolicy = 'add-only' | 'replace-matching';
export type PortfolioImportEffect = {
    readonly addedHoldings: number;
    readonly replacedHoldings: number;
    readonly skippedHoldings: number;
    readonly addedCashBalances: number;
    readonly replacedCashBalances: number;
    readonly skippedCashBalances: number;
    readonly unchangedExistingHoldings: number;
    readonly unchangedExistingCashBalances: number;
};

export type PortfolioReconciledHolding = {
    readonly holding: PortfolioImportedHolding;
    readonly researchRecord: ResearchRecord | null;
    readonly currentPrice: number | null;
    readonly marketValue: number | null;
    readonly costBasis: number;
};

export type PortfolioActualCurrencySummary = {
    readonly currency: PortfolioCurrency;
    readonly costBasis: number;
    readonly cashBalance: number;
    readonly knownMarketValue: number;
    readonly totalKnownValue: number;
    readonly missingMarketValues: number;
};

const canonicalColumns = [
    'account_label', 'row_type', 'symbol', 'market', 'quantity', 'average_cost', 'currency', 'cash_balance',
] as const;
type CanonicalColumn = typeof canonicalColumns[number];

const columnAliases: Readonly<Record<string, CanonicalColumn>> = {
    account_label: 'account_label',
    account: 'account_label',
    account_name: 'account_label',
    row_type: 'row_type',
    type: 'row_type',
    symbol: 'symbol',
    ticker: 'symbol',
    market: 'market',
    quantity: 'quantity',
    shares: 'quantity',
    units: 'quantity',
    average_cost: 'average_cost',
    avg_cost: 'average_cost',
    average_price: 'average_cost',
    currency: 'currency',
    ccy: 'currency',
    cash_balance: 'cash_balance',
    cash: 'cash_balance',
};

const requiredColumns: readonly CanonicalColumn[] = [
    'account_label', 'symbol', 'market', 'quantity', 'average_cost', 'currency',
];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const validTimestamp = (value: unknown): value is string =>
    typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value));

const normalizeText = (value: string) => value.trim();
const normalizeAccountKey = (value: string) => value.trim().toLocaleLowerCase('en');

export const portfolioHoldingIdentity = (
    value: Pick<PortfolioCsvHoldingRow, 'accountLabel' | 'market' | 'symbol'>,
): string => `${normalizeAccountKey(value.accountLabel)}:${value.market}:${value.symbol}`;

export const portfolioCashIdentity = (
    value: Pick<PortfolioCsvCashRow, 'accountLabel' | 'currency'>,
): string => `${normalizeAccountKey(value.accountLabel)}:${value.currency}`;

const boundedLabel = (value: unknown, label: string, maxLength: number): string => {
    if (typeof value !== 'string') throw new Error(`${label} must be text.`);
    const normalized = normalizeText(value);
    if (!normalized || normalized.length > maxLength) {
        throw new Error(`${label} must contain 1-${maxLength} characters.`);
    }
    return normalized;
};

export const parsePortfolioAccountLabel = (value: unknown): string =>
    boundedLabel(value, 'Account label', portfolioImportLimits.maxAccountLabelLength);

export const parsePortfolioSymbol = (value: unknown): string => {
    const symbol = boundedLabel(value, 'Symbol', 20).toUpperCase();
    if (!/^[A-Z0-9.-]+$/.test(symbol)) throw new Error('Symbol contains unsupported characters.');
    return symbol;
};

export const parsePortfolioMarket = (value: unknown): ResearchMarket => {
    const market = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (market !== 'US' && market !== 'MY') throw new Error('Market must be US or MY.');
    return market;
};

export const parsePortfolioCurrency = (value: unknown): PortfolioCurrency => {
    const currency = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (currency !== 'USD' && currency !== 'MYR') throw new Error('Currency must be USD or MYR.');
    return currency;
};

export const parsePortfolioFiniteNumber = (
    value: unknown,
    label: string,
    options: { readonly positive?: boolean } = {},
): number => {
    const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    if (!text) throw new Error(`${label} is required.`);
    const number = Number(text);
    if (!Number.isFinite(number) || number < 0 || number > 1_000_000_000_000_000) {
        throw new Error(`${label} must be a finite number between 0 and 1 quadrillion.`);
    }
    if (options.positive && number === 0) throw new Error(`${label} must be greater than zero.`);
    return number;
};

const parseCsvMatrix = (text: string): readonly string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index] ?? '';
        if (quoted) {
            if (character === '"' && text[index + 1] === '"') {
                cell += '"';
                index += 1;
            } else if (character === '"') {
                quoted = false;
            } else {
                cell += character;
            }
            continue;
        }
        if (character === '"' && cell.length === 0) {
            quoted = true;
        } else if (character === ',') {
            row.push(cell);
            cell = '';
        } else if (character === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else if (character !== '\r') {
            cell += character;
        }
    }
    if (quoted) throw new Error('CSV contains an unterminated quoted field.');
    row.push(cell);
    if (row.some((value) => value.length > 0) || rows.length === 0) rows.push(row);
    return rows;
};

const canonicalizeHeaders = (headers: readonly string[]): readonly CanonicalColumn[] => {
    const canonical: CanonicalColumn[] = [];
    const seen = new Set<CanonicalColumn>();
    for (const header of headers) {
        const normalized = header.trim().toLowerCase().replaceAll(' ', '_');
        const resolved = columnAliases[normalized];
        if (!resolved) throw new Error(`Unsupported CSV column "${header.trim() || '(blank)'}".`);
        if (seen.has(resolved)) throw new Error(`CSV contains more than one column for ${resolved}.`);
        seen.add(resolved);
        canonical.push(resolved);
    }
    for (const required of requiredColumns) {
        if (!seen.has(required)) throw new Error(`CSV is missing required column ${required}.`);
    }
    return canonical;
};

const valuesForRow = (
    headers: readonly CanonicalColumn[],
    row: readonly string[],
): Readonly<Record<CanonicalColumn, string>> => {
    const values = Object.fromEntries(canonicalColumns.map((column) => [column, ''])) as Record<CanonicalColumn, string>;
    headers.forEach((header, index) => {
        values[header] = row[index] ?? '';
    });
    return values;
};

export const parsePortfolioCsv = (text: string): PortfolioCsvPreview => {
    if (new TextEncoder().encode(text).byteLength > portfolioImportLimits.maxFileBytes) {
        throw new Error(`CSV is larger than ${portfolioImportLimits.maxFileBytes.toLocaleString()} bytes.`);
    }
    const matrix = parseCsvMatrix(text.replace(/^\uFEFF/, ''));
    if (matrix.length === 0 || (matrix.length === 1 && matrix[0]?.every((cell) => !cell.trim()))) {
        throw new Error('CSV is empty.');
    }
    const headers = canonicalizeHeaders(matrix[0] ?? []);
    const dataRows = matrix.slice(1)
        .map((row, index) => ({ row, rowNumber: index + 2 }))
        .filter(({ row }) => row.some((cell) => cell.trim()));
    if (dataRows.length > portfolioImportLimits.maxRows) {
        throw new Error(`CSV contains more than ${portfolioImportLimits.maxRows} data rows.`);
    }

    const parsed: Array<{
        readonly rowNumber: number;
        readonly kind: 'holding' | 'cash';
        readonly holding?: PortfolioCsvHoldingRow;
        readonly cash?: PortfolioCsvCashRow;
        readonly values: Readonly<Record<string, string>>;
        readonly identity: string;
    }> = [];
    const rejectedRows: PortfolioCsvRowError[] = [];

    dataRows.forEach(({ row, rowNumber }) => {
        const values = valuesForRow(headers, row);
        if (row.length > headers.length) {
            rejectedRows.push({ rowNumber, message: 'Row has more cells than the header.', values });
            return;
        }
        try {
            const kind = values.row_type.trim().toLowerCase() || 'holding';
            const accountLabel = boundedLabel(values.account_label, 'Account label', portfolioImportLimits.maxAccountLabelLength);
            const currency = parsePortfolioCurrency(values.currency);
            if (kind === 'cash') {
                const cash: PortfolioCsvCashRow = {
                    accountLabel,
                    currency,
                    balance: parsePortfolioFiniteNumber(values.cash_balance, 'Cash balance'),
                };
                parsed.push({ rowNumber, kind, cash, values, identity: `cash:${portfolioCashIdentity(cash)}` });
                return;
            }
            if (kind !== 'holding') throw new Error('Row type must be holding or cash.');
            const holding: PortfolioCsvHoldingRow = {
                accountLabel,
                symbol: parsePortfolioSymbol(values.symbol),
                market: parsePortfolioMarket(values.market),
                quantity: parsePortfolioFiniteNumber(values.quantity, 'Quantity', { positive: true }),
                averageCost: parsePortfolioFiniteNumber(values.average_cost, 'Average cost'),
                currency,
            };
            parsed.push({ rowNumber, kind, holding, values, identity: `holding:${portfolioHoldingIdentity(holding)}` });
        } catch (error) {
            rejectedRows.push({
                rowNumber,
                message: error instanceof Error ? error.message : 'Row is invalid.',
                values,
            });
        }
    });

    const rowsByIdentity = new Map<string, number[]>();
    for (const row of parsed) {
        const rowNumbers = rowsByIdentity.get(row.identity) ?? [];
        rowNumbers.push(row.rowNumber);
        rowsByIdentity.set(row.identity, rowNumbers);
    }
    const duplicateIdentities = new Set(
        [...rowsByIdentity.entries()].filter(([, rows]) => rows.length > 1).map(([identity]) => identity),
    );
    const duplicates = [...rowsByIdentity.entries()]
        .filter(([, rows]) => rows.length > 1)
        .map(([identity, rowNumbers]) => ({ identity, rowNumbers }))
        .sort((left, right) => left.rowNumbers[0]! - right.rowNumbers[0]!);
    for (const row of parsed) {
        if (duplicateIdentities.has(row.identity)) {
            rejectedRows.push({
                rowNumber: row.rowNumber,
                message: `Duplicate identity appears on rows ${rowsByIdentity.get(row.identity)?.join(', ')}.`,
                values: row.values,
            });
        }
    }

    return {
        holdings: parsed.flatMap((row) => row.holding && !duplicateIdentities.has(row.identity) ? [row.holding] : []),
        cashBalances: parsed.flatMap((row) => row.cash && !duplicateIdentities.has(row.identity) ? [row.cash] : []),
        rejectedRows: rejectedRows.sort((left, right) => left.rowNumber - right.rowNumber),
        duplicates,
        totalDataRows: dataRows.length,
    };
};

const validateImportedHolding = (value: unknown, index: number): PortfolioImportedHolding => {
    if (!isObject(value)) throw new Error(`Holding ${index + 1} must be an object.`);
    return {
        accountLabel: boundedLabel(value.accountLabel, `Holding ${index + 1} account label`, portfolioImportLimits.maxAccountLabelLength),
        symbol: parsePortfolioSymbol(value.symbol),
        market: parsePortfolioMarket(value.market),
        quantity: parsePortfolioFiniteNumber(value.quantity, `Holding ${index + 1} quantity`, { positive: true }),
        averageCost: parsePortfolioFiniteNumber(value.averageCost, `Holding ${index + 1} average cost`),
        currency: parsePortfolioCurrency(value.currency),
        importedAt: validTimestamp(value.importedAt) ? new Date(value.importedAt).toISOString() : (() => { throw new Error(`Holding ${index + 1} import time is invalid.`); })(),
        provenanceLabel: boundedLabel(value.provenanceLabel, `Holding ${index + 1} provenance`, portfolioImportLimits.maxProvenanceLabelLength),
    };
};

const validateImportedCash = (value: unknown, index: number): PortfolioImportedCash => {
    if (!isObject(value)) throw new Error(`Cash balance ${index + 1} must be an object.`);
    return {
        accountLabel: boundedLabel(value.accountLabel, `Cash balance ${index + 1} account label`, portfolioImportLimits.maxAccountLabelLength),
        currency: parsePortfolioCurrency(value.currency),
        balance: parsePortfolioFiniteNumber(value.balance, `Cash balance ${index + 1}`),
        importedAt: validTimestamp(value.importedAt) ? new Date(value.importedAt).toISOString() : (() => { throw new Error(`Cash balance ${index + 1} import time is invalid.`); })(),
        provenanceLabel: boundedLabel(value.provenanceLabel, `Cash balance ${index + 1} provenance`, portfolioImportLimits.maxProvenanceLabelLength),
    };
};

export const parsePortfolioHoldingsSnapshot = (value: unknown): PortfolioHoldingsSnapshot => {
    if (!isObject(value) || value.version !== portfolioHoldingSnapshotVersion) {
        throw new Error('Portfolio holdings snapshot version is unsupported.');
    }
    if (!validTimestamp(value.updatedAt)) throw new Error('Portfolio holdings update time is invalid.');
    if (!Array.isArray(value.holdings) || !Array.isArray(value.cashBalances)) {
        throw new Error('Portfolio holdings snapshot collections are invalid.');
    }
    if (value.holdings.length + value.cashBalances.length > portfolioImportLimits.maxRows) {
        throw new Error(`Portfolio holdings snapshot exceeds ${portfolioImportLimits.maxRows} rows.`);
    }
    const holdings = value.holdings.map(validateImportedHolding);
    const cashBalances = value.cashBalances.map(validateImportedCash);
    if (new Set(holdings.map(portfolioHoldingIdentity)).size !== holdings.length) {
        throw new Error('Portfolio holdings snapshot contains duplicate holdings.');
    }
    if (new Set(cashBalances.map(portfolioCashIdentity)).size !== cashBalances.length) {
        throw new Error('Portfolio holdings snapshot contains duplicate cash balances.');
    }
    return {
        version: portfolioHoldingSnapshotVersion,
        updatedAt: new Date(value.updatedAt).toISOString(),
        holdings,
        cashBalances,
    };
};

export const createPortfolioImportSnapshot = (
    preview: Pick<PortfolioCsvPreview, 'holdings' | 'cashBalances'>,
    provenanceLabel: string,
    importedAt = new Date().toISOString(),
): PortfolioHoldingsSnapshot => {
    if (!validTimestamp(importedAt)) throw new Error('Import time is invalid.');
    const normalizedTime = new Date(importedAt).toISOString();
    const provenance = boundedLabel(provenanceLabel, 'Provenance label', portfolioImportLimits.maxProvenanceLabelLength);
    return parsePortfolioHoldingsSnapshot({
        version: portfolioHoldingSnapshotVersion,
        updatedAt: normalizedTime,
        holdings: preview.holdings.map((holding) => ({ ...holding, importedAt: normalizedTime, provenanceLabel: provenance })),
        cashBalances: preview.cashBalances.map((cash) => ({ ...cash, importedAt: normalizedTime, provenanceLabel: provenance })),
    });
};

export const previewPortfolioImportEffect = (
    current: PortfolioHoldingsSnapshot | null,
    incoming: PortfolioHoldingsSnapshot,
    policy: PortfolioImportConflictPolicy,
): PortfolioImportEffect => {
    const currentHoldings = new Set((current?.holdings ?? []).map(portfolioHoldingIdentity));
    const currentCash = new Set((current?.cashBalances ?? []).map(portfolioCashIdentity));
    const holdingConflicts = incoming.holdings.filter((holding) => currentHoldings.has(portfolioHoldingIdentity(holding))).length;
    const cashConflicts = incoming.cashBalances.filter((cash) => currentCash.has(portfolioCashIdentity(cash))).length;
    return {
        addedHoldings: incoming.holdings.length - holdingConflicts,
        replacedHoldings: policy === 'replace-matching' ? holdingConflicts : 0,
        skippedHoldings: policy === 'add-only' ? holdingConflicts : 0,
        addedCashBalances: incoming.cashBalances.length - cashConflicts,
        replacedCashBalances: policy === 'replace-matching' ? cashConflicts : 0,
        skippedCashBalances: policy === 'add-only' ? cashConflicts : 0,
        unchangedExistingHoldings: (current?.holdings.length ?? 0) - holdingConflicts,
        unchangedExistingCashBalances: (current?.cashBalances.length ?? 0) - cashConflicts,
    };
};

export const mergePortfolioHoldingsSnapshots = (
    current: PortfolioHoldingsSnapshot | null,
    incoming: PortfolioHoldingsSnapshot,
    policy: PortfolioImportConflictPolicy,
    replacementAcknowledged = false,
): PortfolioHoldingsSnapshot => {
    const effect = previewPortfolioImportEffect(current, incoming, policy);
    const hasReplacements = effect.replacedHoldings + effect.replacedCashBalances > 0;
    if (policy === 'replace-matching' && hasReplacements && !replacementAcknowledged) {
        throw new Error('Replacing matching holdings requires explicit acknowledgement.');
    }
    const incomingHoldingKeys = new Set(incoming.holdings.map(portfolioHoldingIdentity));
    const incomingCashKeys = new Set(incoming.cashBalances.map(portfolioCashIdentity));
    const retainedHoldings = (current?.holdings ?? []).filter((holding) =>
        policy === 'add-only' || !incomingHoldingKeys.has(portfolioHoldingIdentity(holding)));
    const retainedCash = (current?.cashBalances ?? []).filter((cash) =>
        policy === 'add-only' || !incomingCashKeys.has(portfolioCashIdentity(cash)));
    const currentHoldingKeys = new Set(retainedHoldings.map(portfolioHoldingIdentity));
    const currentCashKeys = new Set(retainedCash.map(portfolioCashIdentity));
    return parsePortfolioHoldingsSnapshot({
        version: portfolioHoldingSnapshotVersion,
        updatedAt: incoming.updatedAt,
        holdings: [
            ...retainedHoldings,
            ...incoming.holdings.filter((holding) => !currentHoldingKeys.has(portfolioHoldingIdentity(holding))),
        ],
        cashBalances: [
            ...retainedCash,
            ...incoming.cashBalances.filter((cash) => !currentCashKeys.has(portfolioCashIdentity(cash))),
        ],
    });
};

export const reconcilePortfolioHoldings = (
    snapshot: PortfolioHoldingsSnapshot,
    records: readonly ResearchRecord[],
    prices: ReadonlyMap<string, number | null>,
): readonly PortfolioReconciledHolding[] => {
    const recordsByIdentity = new Map(records.map((record) => [`${record.market}:${record.symbol}`, record]));
    return snapshot.holdings.map((holding) => {
        const identity = `${holding.market}:${holding.symbol}`;
        const researchRecord = recordsByIdentity.get(identity) ?? null;
        const candidatePrice = researchRecord ? prices.get(identity) ?? null : null;
        const currentPrice = typeof candidatePrice === 'number' && Number.isFinite(candidatePrice) && candidatePrice >= 0
            ? candidatePrice
            : null;
        return {
            holding,
            researchRecord,
            currentPrice,
            marketValue: currentPrice === null ? null : Number((holding.quantity * currentPrice).toFixed(2)),
            costBasis: Number((holding.quantity * holding.averageCost).toFixed(2)),
        };
    });
};

export const buildPortfolioActualSummary = (
    snapshot: PortfolioHoldingsSnapshot,
    holdings: readonly PortfolioReconciledHolding[],
): readonly PortfolioActualCurrencySummary[] => {
    const currencies = [...new Set<PortfolioCurrency>([
        ...snapshot.holdings.map((holding) => holding.currency),
        ...snapshot.cashBalances.map((cash) => cash.currency),
    ])].sort();
    return currencies.map((currency) => {
        const currencyHoldings = holdings.filter((holding) => holding.holding.currency === currency);
        const costBasis = currencyHoldings.reduce((total, holding) => total + holding.costBasis, 0);
        const knownMarketValue = currencyHoldings.reduce((total, holding) => total + (holding.marketValue ?? 0), 0);
        const cashBalance = snapshot.cashBalances
            .filter((cash) => cash.currency === currency)
            .reduce((total, cash) => total + cash.balance, 0);
        return {
            currency,
            costBasis: Number(costBasis.toFixed(2)),
            cashBalance: Number(cashBalance.toFixed(2)),
            knownMarketValue: Number(knownMarketValue.toFixed(2)),
            totalKnownValue: Number((knownMarketValue + cashBalance).toFixed(2)),
            missingMarketValues: currencyHoldings.filter((holding) => holding.marketValue === null).length,
        };
    });
};

export const portfolioActualWeightPercent = (
    holding: PortfolioReconciledHolding,
    summary: PortfolioActualCurrencySummary,
): number | null => {
    if (holding.marketValue === null || summary.missingMarketValues > 0 || summary.totalKnownValue <= 0) return null;
    return Number(((holding.marketValue / summary.totalKnownValue) * 100).toFixed(2));
};

export const escapeSpreadsheetCell = (value: string): string =>
    /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

const quoteCsvCell = (value: string): string => {
    const safe = escapeSpreadsheetCell(value);
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const buildCanonicalPortfolioCsvTemplate = (): string => [
    canonicalColumns.join(','),
    ['Main account', 'holding', 'MSFT', 'US', '10', '420.50', 'USD', ''].map(quoteCsvCell).join(','),
    ['Main account', 'cash', '', '', '', '', 'USD', '2500'].map(quoteCsvCell).join(','),
].join('\r\n');
