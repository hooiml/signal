const sectorBySymbol: Readonly<Record<string, string>> = {
    AAPL: 'Technology', MSFT: 'Technology', NVDA: 'Semiconductors', AMZN: 'Consumer', GOOGL: 'Communication',
    META: 'Communication', AVGO: 'Semiconductors', TSLA: 'Consumer', JPM: 'Financials', V: 'Financials',
    MA: 'Financials', UNH: 'Healthcare', XOM: 'Energy', COST: 'Consumer', HD: 'Consumer',
    NFLX: 'Communication', AMD: 'Semiconductors', CRM: 'Software', ORCL: 'Software', ADBE: 'Software',
    QCOM: 'Semiconductors', TXN: 'Semiconductors', AMAT: 'Semiconductor Equipment', LRCX: 'Semiconductor Equipment', MU: 'Semiconductors',
    SNDK: 'Data Storage', WDC: 'Data Storage', KLAC: 'Semiconductor Equipment', PANW: 'Software', CRWD: 'Software',
    NOW: 'Software', PLTR: 'Software', UBER: 'Industrials', INTC: 'Semiconductors', IBM: 'Technology',
    GE: 'Industrials', CAT: 'Industrials', GS: 'Financials', BAC: 'Financials', WMT: 'Consumer',
};

export const sectorForSymbol = (symbol: string): string => sectorBySymbol[symbol] ?? 'Other';

export const sectorRelativeStrength = (
    symbol: string,
    momentum3MonthPercent: number,
    candidates: readonly { readonly symbol: string; readonly momentum3MonthPercent: number }[],
): number => {
    const sector = sectorForSymbol(symbol);
    const peers = candidates.filter((candidate) => sectorForSymbol(candidate.symbol) === sector);
    const average = peers.length === 0 ? 0 : peers.reduce((sum, candidate) => sum + candidate.momentum3MonthPercent, 0) / peers.length;
    return Number((momentum3MonthPercent - average).toFixed(1));
};
