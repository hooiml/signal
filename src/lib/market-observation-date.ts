/** Calendar reporting dates cannot be later than an explicitly supplied retrieval day. */
export function parseMarketReportDate(value: unknown, retrievedAt?: string): string | null {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const time = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
    if (retrievedAt !== undefined) {
        // Date.parse rolls impossible ISO days forward; validate the written day first.
        if (!parseMarketReportDate(retrievedAt.slice(0, 10))) return null;
        const retrieval = Date.parse(retrievedAt);
        if (!Number.isFinite(retrieval) || value > new Date(retrieval).toISOString().slice(0, 10)) return null;
    }
    return value;
}

/**
 * Older Cboe and undated NAAIM adapters labelled retrieval timestamps as observations.
 * Their actual reporting dates are calendar dates. Keep ambiguous recorded clocks but
 * withhold their observation claim; neither stored values nor explicit retrieval times change.
 */
export function storedMarketTimestampBasis(
    key: string, basis: unknown, lastUpdated: unknown, retrievedAt?: unknown,
): 'observed' | 'retrieved' | null {
    if (basis !== 'observed' && basis !== 'retrieved') return null;
    if (basis === 'observed' && (key === 'put_call' || key === 'naaim')) {
        if (!parseMarketReportDate(lastUpdated)) return null;
        // An absent historical retrieval clock does not invalidate a genuine calendar date.
        if (retrievedAt !== undefined && retrievedAt !== null
            && (typeof retrievedAt !== 'string' || !parseMarketReportDate(lastUpdated, retrievedAt))) return null;
    }
    return basis;
}
