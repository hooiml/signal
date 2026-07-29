import {
    escapeSpreadsheetCell,
    parsePortfolioAccountLabel,
    parsePortfolioCurrency,
    parsePortfolioFiniteNumber,
    parsePortfolioMarket,
    parsePortfolioSymbol,
} from './holdings';
import {
    portfolioTransactionSnapshotVersion,
    portfolioTransactionTypes,
    type PortfolioTransaction,
    type PortfolioTransactionSnapshot,
    type PortfolioTransactionType,
} from '../types/portfolio-transactions';

export const portfolioTransactionImportLimits = {
    maxFileBytes: 1_000_000,
    maxRows: 500,
    maxTransactionIdLength: 100,
    maxProvenanceLabelLength: 80,
} as const;

type TransactionCsvRow = Omit<PortfolioTransaction, 'importedAt' | 'provenanceLabel'>;

export type PortfolioTransactionCsvRowError = {
    readonly rowNumber: number;
    readonly message: string;
    readonly values: Readonly<Record<string, string>>;
};

export type PortfolioTransactionCsvDuplicate = {
    readonly identity: string;
    readonly rowNumbers: readonly number[];
};

export type PortfolioTransactionCsvPreview = {
    readonly transactions: readonly TransactionCsvRow[];
    readonly rejectedRows: readonly PortfolioTransactionCsvRowError[];
    readonly duplicates: readonly PortfolioTransactionCsvDuplicate[];
    readonly totalDataRows: number;
};

export type PortfolioTransactionImportConflictPolicy = 'add-only' | 'replace-matching';

export type PortfolioTransactionImportEffect = {
    readonly added: number;
    readonly replaced: number;
    readonly skipped: number;
    readonly unchangedExisting: number;
};

const canonicalColumns = [
    'transaction_id',
    'account_label',
    'type',
    'date',
    'market',
    'symbol',
    'quantity',
    'amount',
    'currency',
] as const;
type CanonicalColumn = typeof canonicalColumns[number];

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const validTimestamp = (value: unknown): value is string =>
    typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));

const boundedText = (value: unknown, label: string, maxLength: number): string => {
    if (typeof value !== 'string') throw new Error(`${label} must be text.`);
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength) {
        throw new Error(`${label} must contain 1-${maxLength} characters.`);
    }
    return normalized;
};

const parseTransactionId = (value: unknown): string => {
    const id = boundedText(value, 'Transaction ID', portfolioTransactionImportLimits.maxTransactionIdLength);
    if (!/^[A-Za-z0-9._:-]+$/.test(id)) {
        throw new Error('Transaction ID may contain only letters, numbers, period, underscore, colon, and hyphen.');
    }
    return id;
};

const parseTransactionType = (value: unknown): PortfolioTransactionType => {
    const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!portfolioTransactionTypes.includes(type as PortfolioTransactionType)) {
        throw new Error(`Type must be ${portfolioTransactionTypes.join(', ')}.`);
    }
    return type as PortfolioTransactionType;
};

const parseTransactionDate = (value: unknown, today: string): string => {
    const date = typeof value === 'string' ? value.trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(`${date}T00:00:00.000Z`))
        || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date
        || date < '1900-01-01') {
        throw new Error('Date must be a valid YYYY-MM-DD value on or after 1900-01-01.');
    }
    if (date > today) throw new Error('Date cannot be in the future.');
    return date;
};

const transactionIdentityParts = (
    value: Pick<TransactionCsvRow, 'accountLabel' | 'id'>,
): string => `${value.accountLabel.trim().toLocaleLowerCase('en')}:${value.id.trim().toLocaleLowerCase('en')}`;

export const portfolioTransactionIdentity = (
    value: Pick<TransactionCsvRow, 'accountLabel' | 'id'>,
): string => transactionIdentityParts(value);

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
    const normalized = headers.map((header) => header.trim().toLowerCase().replaceAll(' ', '_'));
    if (normalized.length !== canonicalColumns.length
        || canonicalColumns.some((column) => !normalized.includes(column))
        || new Set(normalized).size !== normalized.length) {
        const unsupported = normalized.filter((header) => !canonicalColumns.includes(header as CanonicalColumn));
        if (unsupported.length > 0) throw new Error(`Unsupported CSV column "${unsupported[0]}".`);
        const missing = canonicalColumns.filter((column) => !normalized.includes(column));
        if (missing.length > 0) throw new Error(`CSV is missing required column ${missing[0]}.`);
        throw new Error('CSV must contain each canonical column exactly once.');
    }
    return normalized as CanonicalColumn[];
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

const rejectFormulaCells = (values: Readonly<Record<CanonicalColumn, string>>) => {
    const unsafe = Object.entries(values).find(([, value]) =>
        /^[\t\r]/.test(value) || /^[=+\-@]/.test(value.trimStart()));
    if (unsafe) throw new Error(`Formula-like value is not allowed in ${unsafe[0]}.`);
};

const optionalSecurity = (
    marketValue: string,
    symbolValue: string,
): { readonly market: TransactionCsvRow['market']; readonly symbol: TransactionCsvRow['symbol'] } => {
    const hasMarket = marketValue.trim().length > 0;
    const hasSymbol = symbolValue.trim().length > 0;
    if (hasMarket !== hasSymbol) throw new Error('Market and symbol must either both be provided or both be blank.');
    return hasMarket
        ? { market: parsePortfolioMarket(marketValue), symbol: parsePortfolioSymbol(symbolValue) }
        : { market: null, symbol: null };
};

const parseTransactionRow = (
    values: Readonly<Record<CanonicalColumn, string>>,
    today: string,
): TransactionCsvRow => {
    rejectFormulaCells(values);
    const type = parseTransactionType(values.type);
    const security = optionalSecurity(values.market, values.symbol);
    const quantityText = values.quantity.trim();
    const quantity = quantityText
        ? parsePortfolioFiniteNumber(quantityText, 'Quantity', { positive: true })
        : null;

    if (type === 'buy' || type === 'sell') {
        if (security.market === null || security.symbol === null) {
            throw new Error('Buy and sell rows require market and symbol.');
        }
        if (quantity === null) throw new Error('Buy and sell rows require quantity.');
    } else if (quantity !== null) {
        throw new Error('Quantity must be blank for non-trade rows.');
    }

    if ((type === 'dividend') && (security.market === null || security.symbol === null)) {
        throw new Error('Dividend rows require market and symbol.');
    }
    if ((type === 'deposit' || type === 'withdrawal') && security.market !== null) {
        throw new Error('Deposit and withdrawal rows must not include market or symbol.');
    }

    return {
        id: parseTransactionId(values.transaction_id),
        accountLabel: parsePortfolioAccountLabel(values.account_label),
        type,
        occurredOn: parseTransactionDate(values.date, today),
        market: security.market,
        symbol: security.symbol,
        quantity,
        amount: parsePortfolioFiniteNumber(values.amount, 'Amount', { positive: true }),
        currency: parsePortfolioCurrency(values.currency),
    };
};

export const parsePortfolioTransactionCsv = (
    text: string,
    today = new Date().toISOString().slice(0, 10),
): PortfolioTransactionCsvPreview => {
    if (new TextEncoder().encode(text).byteLength > portfolioTransactionImportLimits.maxFileBytes) {
        throw new Error(`CSV is larger than ${portfolioTransactionImportLimits.maxFileBytes.toLocaleString()} bytes.`);
    }
    const matrix = parseCsvMatrix(text.replace(/^\uFEFF/, ''));
    if (matrix.length === 0 || (matrix.length === 1 && matrix[0]?.every((cell) => !cell.trim()))) {
        throw new Error('CSV is empty.');
    }
    const headers = canonicalizeHeaders(matrix[0] ?? []);
    const dataRows = matrix.slice(1)
        .map((row, index) => ({ row, rowNumber: index + 2 }))
        .filter(({ row }) => row.some((cell) => cell.trim()));
    if (dataRows.length > portfolioTransactionImportLimits.maxRows) {
        throw new Error(`CSV contains more than ${portfolioTransactionImportLimits.maxRows} data rows.`);
    }

    const parsed: Array<{
        readonly rowNumber: number;
        readonly transaction: TransactionCsvRow;
        readonly identity: string;
        readonly values: Readonly<Record<string, string>>;
    }> = [];
    const rejectedRows: PortfolioTransactionCsvRowError[] = [];

    for (const { row, rowNumber } of dataRows) {
        const values = valuesForRow(headers, row);
        if (row.length > headers.length) {
            rejectedRows.push({ rowNumber, message: 'Row has more cells than the header.', values });
            continue;
        }
        try {
            const transaction = parseTransactionRow(values, today);
            parsed.push({
                rowNumber,
                transaction,
                identity: portfolioTransactionIdentity(transaction),
                values,
            });
        } catch (error) {
            rejectedRows.push({
                rowNumber,
                message: error instanceof Error ? error.message : 'Row is invalid.',
                values,
            });
        }
    }

    const rowsByIdentity = new Map<string, number[]>();
    for (const row of parsed) {
        rowsByIdentity.set(row.identity, [...(rowsByIdentity.get(row.identity) ?? []), row.rowNumber]);
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
                message: `Duplicate transaction identity appears on rows ${rowsByIdentity.get(row.identity)?.join(', ')}.`,
                values: row.values,
            });
        }
    }

    return {
        transactions: parsed.flatMap((row) => duplicateIdentities.has(row.identity) ? [] : [row.transaction]),
        rejectedRows: rejectedRows.sort((left, right) => left.rowNumber - right.rowNumber),
        duplicates,
        totalDataRows: dataRows.length,
    };
};

const validateTransaction = (value: unknown, index: number): PortfolioTransaction => {
    if (!isObject(value)) throw new Error(`Transaction ${index + 1} must be an object.`);
    const row = parseTransactionRow({
        transaction_id: typeof value.id === 'string' ? value.id : '',
        account_label: typeof value.accountLabel === 'string' ? value.accountLabel : '',
        type: typeof value.type === 'string' ? value.type : '',
        date: typeof value.occurredOn === 'string' ? value.occurredOn : '',
        market: typeof value.market === 'string' ? value.market : '',
        symbol: typeof value.symbol === 'string' ? value.symbol : '',
        quantity: typeof value.quantity === 'number' ? String(value.quantity) : '',
        amount: typeof value.amount === 'number' ? String(value.amount) : '',
        currency: typeof value.currency === 'string' ? value.currency : '',
    }, new Date().toISOString().slice(0, 10));
    if (!validTimestamp(value.importedAt)) throw new Error(`Transaction ${index + 1} import time is invalid.`);
    return {
        ...row,
        importedAt: new Date(value.importedAt).toISOString(),
        provenanceLabel: boundedText(
            value.provenanceLabel,
            `Transaction ${index + 1} provenance`,
            portfolioTransactionImportLimits.maxProvenanceLabelLength,
        ),
    };
};

export const parsePortfolioTransactionSnapshot = (value: unknown): PortfolioTransactionSnapshot => {
    if (!isObject(value) || value.version !== portfolioTransactionSnapshotVersion) {
        throw new Error('Portfolio transaction snapshot version is unsupported.');
    }
    if (!validTimestamp(value.updatedAt)) throw new Error('Portfolio transaction update time is invalid.');
    if (!Array.isArray(value.transactions) || value.transactions.length > portfolioTransactionImportLimits.maxRows) {
        throw new Error(`Portfolio transaction snapshot must contain at most ${portfolioTransactionImportLimits.maxRows} rows.`);
    }
    const transactions = value.transactions.map(validateTransaction);
    if (new Set(transactions.map(portfolioTransactionIdentity)).size !== transactions.length) {
        throw new Error('Portfolio transaction snapshot contains duplicate transaction identities.');
    }
    return {
        version: portfolioTransactionSnapshotVersion,
        updatedAt: new Date(value.updatedAt).toISOString(),
        transactions: [...transactions].sort((left, right) =>
            left.occurredOn.localeCompare(right.occurredOn)
            || portfolioTransactionIdentity(left).localeCompare(portfolioTransactionIdentity(right))),
    };
};

export const createPortfolioTransactionImportSnapshot = (
    preview: Pick<PortfolioTransactionCsvPreview, 'transactions'>,
    provenanceLabel: string,
    importedAt = new Date().toISOString(),
): PortfolioTransactionSnapshot => {
    if (!validTimestamp(importedAt)) throw new Error('Import time is invalid.');
    const normalizedTime = new Date(importedAt).toISOString();
    const provenance = boundedText(
        provenanceLabel,
        'Provenance label',
        portfolioTransactionImportLimits.maxProvenanceLabelLength,
    );
    return parsePortfolioTransactionSnapshot({
        version: portfolioTransactionSnapshotVersion,
        updatedAt: normalizedTime,
        transactions: preview.transactions.map((transaction) => ({
            ...transaction,
            importedAt: normalizedTime,
            provenanceLabel: provenance,
        })),
    });
};

export const previewPortfolioTransactionImportEffect = (
    current: PortfolioTransactionSnapshot | null,
    incoming: PortfolioTransactionSnapshot,
    policy: PortfolioTransactionImportConflictPolicy,
): PortfolioTransactionImportEffect => {
    const currentIdentities = new Set((current?.transactions ?? []).map(portfolioTransactionIdentity));
    const conflicts = incoming.transactions.filter((transaction) =>
        currentIdentities.has(portfolioTransactionIdentity(transaction))).length;
    return {
        added: incoming.transactions.length - conflicts,
        replaced: policy === 'replace-matching' ? conflicts : 0,
        skipped: policy === 'add-only' ? conflicts : 0,
        unchangedExisting: (current?.transactions.length ?? 0) - conflicts,
    };
};

export const mergePortfolioTransactionSnapshots = (
    current: PortfolioTransactionSnapshot | null,
    incoming: PortfolioTransactionSnapshot,
    policy: PortfolioTransactionImportConflictPolicy,
    replacementAcknowledged = false,
): PortfolioTransactionSnapshot => {
    const effect = previewPortfolioTransactionImportEffect(current, incoming, policy);
    if (policy === 'replace-matching' && effect.replaced > 0 && !replacementAcknowledged) {
        throw new Error('Replacing matching transactions requires explicit acknowledgement.');
    }
    const incomingIdentities = new Set(incoming.transactions.map(portfolioTransactionIdentity));
    const retained = (current?.transactions ?? []).filter((transaction) =>
        policy === 'add-only' || !incomingIdentities.has(portfolioTransactionIdentity(transaction)));
    const retainedIdentities = new Set(retained.map(portfolioTransactionIdentity));
    return parsePortfolioTransactionSnapshot({
        version: portfolioTransactionSnapshotVersion,
        updatedAt: incoming.updatedAt,
        transactions: [
            ...retained,
            ...incoming.transactions.filter((transaction) =>
                !retainedIdentities.has(portfolioTransactionIdentity(transaction))),
        ],
    });
};

const quoteCsvCell = (value: string): string => {
    const safe = escapeSpreadsheetCell(value);
    return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export const buildCanonicalPortfolioTransactionCsvTemplate = (): string => [
    canonicalColumns.join(','),
    ['broker-001', 'Main account', 'buy', '2026-07-01', 'US', 'MSFT', '10', '4205', 'USD'].map(quoteCsvCell).join(','),
    ['broker-002', 'Main account', 'dividend', '2026-07-15', 'US', 'MSFT', '', '15.50', 'USD'].map(quoteCsvCell).join(','),
    ['broker-003', 'Main account', 'deposit', '2026-07-20', '', '', '', '2500', 'USD'].map(quoteCsvCell).join(','),
].join('\r\n');
