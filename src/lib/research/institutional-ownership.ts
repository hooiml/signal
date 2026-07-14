import type { InstitutionalOwnershipEvidence, InstitutionalOwnershipBuyer } from '../types/research-discovery';

class InstitutionalOwnershipError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InstitutionalOwnershipError';
    }
}

const objectValue = (value: unknown): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : null;

const formattedNumber = (value: unknown): number | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.replace(/[$,%\s,]/g, '');
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
};

const validOwnershipPercent = (value: unknown): number | null => {
    const parsed = formattedNumber(value);
    return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const isoDate = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const parts = value.split('/').map(Number);
    if (parts.length !== 3) return null;
    const [month, day, year] = parts;
    if (month === undefined || day === undefined || year === undefined) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return date.toISOString().slice(0, 10);
};

const parseBuyer = (value: unknown): InstitutionalOwnershipBuyer | null => {
    const row = objectValue(value);
    const name = typeof row?.ownerName === 'string' ? row.ownerName.trim() : '';
    const reportDate = isoDate(row?.date);
    const sharesHeld = formattedNumber(row?.sharesHeld);
    const sharesAdded = formattedNumber(row?.sharesChange);
    if (!name || reportDate === null || sharesHeld === null || sharesAdded === null || sharesAdded <= 0) return null;
    const sourcePath = typeof row?.url === 'string' && row.url.startsWith('/') ? row.url : null;
    return {
        name,
        reportDate,
        sharesHeld,
        sharesAdded,
        positionChangePercent: row?.sharesChangePCT === 'New' ? null : formattedNumber(row?.sharesChangePCT),
        newPosition: row?.sharesChangePCT === 'New',
        marketValueThousands: formattedNumber(row?.marketValue),
        sourceUrl: sourcePath === null ? null : `https://www.nasdaq.com${sourcePath}`,
    };
};

const positionShares = (data: Record<string, unknown>, label: string): number | null => {
    const activePositions = objectValue(data.activePositions);
    if (!Array.isArray(activePositions?.rows)) return null;
    const row = activePositions.rows.map(objectValue).find((candidate) => candidate?.positions === label);
    return formattedNumber(row?.shares);
};

const activityFor = (increasedShares: number | null, decreasedShares: number | null): InstitutionalOwnershipEvidence['activity'] => {
    if (increasedShares === null || decreasedShares === null) return 'mixed';
    if (increasedShares > decreasedShares * 1.25) return 'increases-led';
    if (decreasedShares > increasedShares * 1.25) return 'decreases-led';
    return 'mixed';
};

export const parseNasdaqInstitutionalHoldings = (payload: unknown, symbol: string): InstitutionalOwnershipEvidence => {
    const root = objectValue(payload);
    const data = objectValue(root?.data);
    const transactions = objectValue(data?.holdingsTransactions);
    const table = objectValue(transactions?.table);
    if (!data) throw new InstitutionalOwnershipError('Nasdaq returned invalid institutional holdings data.');
    const transactionRows = Array.isArray(table?.rows) ? table.rows : [];
    const buyers = transactionRows.map(parseBuyer).filter((buyer): buyer is InstitutionalOwnershipBuyer => buyer !== null).slice(0, 5);
    const ownershipSummary = objectValue(data.ownershipSummary);
    const ownershipPercent = objectValue(ownershipSummary?.SharesOutstandingPCT);
    const increasedShares = positionShares(data, 'Increased Positions');
    const decreasedShares = positionShares(data, 'Decreased Positions');
    const institutionalOwnershipPercent = validOwnershipPercent(ownershipPercent?.value);
    if (buyers.length === 0 && increasedShares === null && decreasedShares === null && institutionalOwnershipPercent === null) {
        throw new InstitutionalOwnershipError('Nasdaq returned no usable institutional holdings evidence.');
    }
    return {
        activity: activityFor(increasedShares, decreasedShares),
        institutionalOwnershipPercent,
        increasedShares,
        decreasedShares,
        reportPeriod: buyers.map((buyer) => buyer.reportDate).sort().at(-1) ?? null,
        buyers,
        source: 'Nasdaq institutional holdings',
        sourceUrl: `https://www.nasdaq.com/market-activity/stocks/${symbol.toLowerCase()}/institutional-holdings`,
    };
};

export const fetchInstitutionalOwnership = async (symbol: string): Promise<InstitutionalOwnershipEvidence> => {
    const response = await fetch(`https://api.nasdaq.com/api/company/${encodeURIComponent(symbol)}/institutional-holdings?limit=5&type=INCREASED&sortColumn=sharesChange&sortOrder=DESC`, {
        headers: {
            Accept: 'application/json, text/plain, */*',
            Origin: 'https://www.nasdaq.com',
            Referer: 'https://www.nasdaq.com/',
            'User-Agent': 'Mozilla/5.0 Signal research dashboard',
        },
        signal: AbortSignal.timeout(8_000),
        next: { revalidate: 21600 },
    });
    if (!response.ok) throw new InstitutionalOwnershipError(`Nasdaq institutional holdings failed (${response.status}).`);
    return parseNasdaqInstitutionalHoldings(await response.json(), symbol);
};
