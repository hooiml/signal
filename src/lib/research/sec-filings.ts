import { unstable_cache } from 'next/cache';
import { getConfiguredSecHeaders, parseSecTickerMapping } from './sec-edgar';
import { secFormToResearchDocumentSourceKind } from './document-evidence';
import type { ResearchDocumentSourceKind } from '../types/research';

export const SEC_TICKER_ORIGIN = 'https://www.sec.gov';
export const SEC_DATA_ORIGIN = 'https://data.sec.gov';
export const SEC_DISCOVERY_FORMS = ['10-K', '10-Q', '8-K', '20-F', '6-K'] as const;
export const SEC_DISCOVERY_LIMIT = 10;

export type SecDiscoveryFiling = {
    readonly accessionNumber: string;
    readonly form: typeof SEC_DISCOVERY_FORMS[number];
    readonly sourceKind: ResearchDocumentSourceKind;
    readonly filingDate: string;
    readonly reportingPeriod: string | null;
    readonly title: string;
    readonly sourceUrl: string;
    readonly providerLabel: 'SEC EDGAR';
};

export type SecFilingDiscovery = {
    readonly symbol: string;
    readonly cik: string;
    readonly issuer: string;
    readonly filings: readonly SecDiscoveryFiling[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const validDate = (value: unknown): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const isAllowedForm = (value: unknown): value is typeof SEC_DISCOVERY_FORMS[number] =>
    typeof value === 'string' && SEC_DISCOVERY_FORMS.includes(value as typeof SEC_DISCOVERY_FORMS[number]);

export const buildOfficialSecFilingUrl = (cik: string, accessionNumber: string, primaryDocument: string): string => {
    if (!/^\d{10}$/.test(cik)) throw new Error('Invalid SEC CIK.');
    if (!/^\d{10}-\d{2}-\d{6}$/.test(accessionNumber)) throw new Error('Invalid SEC accession number.');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(primaryDocument) || primaryDocument.includes('..')) {
        throw new Error('Invalid SEC primary document path.');
    }
    return `${SEC_TICKER_ORIGIN}/Archives/edgar/data/${Number(cik)}/${accessionNumber.replaceAll('-', '')}/${primaryDocument}`;
};

export const parseSecSubmissions = (
    payload: unknown,
    identity: { readonly symbol: string; readonly cik: string; readonly issuer: string },
): SecFilingDiscovery => {
    if (!isObject(payload) || !isObject(payload.filings) || !isObject(payload.filings.recent)) {
        throw new Error('SEC returned malformed filing metadata.');
    }
    const recent = payload.filings.recent;
    const accessions = recent.accessionNumber;
    const forms = recent.form;
    const filingDates = recent.filingDate;
    const reportDates = recent.reportDate;
    const primaryDocuments = recent.primaryDocument;
    if (![accessions, forms, filingDates, reportDates, primaryDocuments].every(Array.isArray)) {
        throw new Error('SEC returned malformed filing metadata.');
    }
    const accessionList = accessions as unknown[];
    const formList = forms as unknown[];
    const filingDateList = filingDates as unknown[];
    const reportDateList = reportDates as unknown[];
    const primaryDocumentList = primaryDocuments as unknown[];
    const lengths = [accessionList.length, formList.length, filingDateList.length, reportDateList.length, primaryDocumentList.length];
    if (new Set(lengths).size !== 1 || lengths[0] > 5_000) throw new Error('SEC returned inconsistent filing metadata.');
    const filings: SecDiscoveryFiling[] = [];
    for (let index = 0; index < accessionList.length && filings.length < SEC_DISCOVERY_LIMIT; index += 1) {
        const form = formList[index];
        if (!isAllowedForm(form)) continue;
        const accessionNumber = accessionList[index];
        const filingDate = filingDateList[index];
        const reportingPeriod = reportDateList[index];
        const primaryDocument = primaryDocumentList[index];
        if (typeof accessionNumber !== 'string' || !validDate(filingDate) || typeof primaryDocument !== 'string'
            || reportingPeriod !== '' && !validDate(reportingPeriod)) {
            throw new Error('SEC returned an invalid filing entry.');
        }
        filings.push({
            accessionNumber,
            form,
            sourceKind: secFormToResearchDocumentSourceKind(form),
            filingDate,
            reportingPeriod: reportingPeriod || null,
            title: `${identity.issuer} ${form} filed ${filingDate}`,
            sourceUrl: buildOfficialSecFilingUrl(identity.cik, accessionNumber, primaryDocument),
            providerLabel: 'SEC EDGAR',
        });
    }
    return { ...identity, filings };
};

export const fetchSecFilingDiscovery = async (
    symbolValue: string,
    fetcher: typeof fetch = fetch,
): Promise<SecFilingDiscovery> => {
    const symbol = symbolValue.trim().toUpperCase();
    if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) throw new Error('Invalid US symbol.');
    const headers = getConfiguredSecHeaders();
    const tickerUrl = `${SEC_TICKER_ORIGIN}/files/company_tickers.json`;
    const tickerResponse = await fetcher(tickerUrl, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
    });
    if (!tickerResponse.ok) throw new Error(`SEC ticker lookup failed (${tickerResponse.status}).`);
    const mapping = parseSecTickerMapping(await tickerResponse.json(), symbol);
    const submissionsUrl = `${SEC_DATA_ORIGIN}/submissions/CIK${mapping.cik}.json`;
    const submissionsResponse = await fetcher(submissionsUrl, {
        headers,
        redirect: 'error',
        signal: AbortSignal.timeout(8_000),
    });
    if (!submissionsResponse.ok) throw new Error(`SEC submissions request failed (${submissionsResponse.status}).`);
    return parseSecSubmissions(await submissionsResponse.json(), {
        symbol,
        cik: mapping.cik,
        issuer: mapping.title,
    });
};

export const discoverRecentSecFilings = unstable_cache(
    fetchSecFilingDiscovery,
    ['sec-filing-discovery-v1'],
    { revalidate: 21_600 },
);
