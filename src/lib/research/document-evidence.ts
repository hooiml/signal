import {
    researchDocumentCaptureMethods,
    researchDocumentSourceKinds,
    researchMarkets,
    type AcceptedResearchEvidence,
    type ResearchDocumentCitation,
    type ResearchDocumentEvidenceSet,
    type ResearchDocumentSourceKind,
    type ResearchMarket,
} from '../types/research';

export const RESEARCH_DOCUMENT_CITATION_LIMIT = 25;
export const RESEARCH_DOCUMENT_EXCERPT_LIMIT = 2_000;
export const defaultResearchDocumentEvidenceSet: ResearchDocumentEvidenceSet = {
    version: 1,
    migrationState: 'current',
    citations: [],
};

export class ResearchDocumentEvidenceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ResearchDocumentEvidenceError';
    }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (value: unknown, label: string, maximum: number): string => {
    if (typeof value !== 'string') throw new ResearchDocumentEvidenceError(`${label} must be a string.`);
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maximum) {
        throw new ResearchDocumentEvidenceError(`${label} must contain 1-${maximum} characters.`);
    }
    return trimmed;
};

const option = <T extends string>(value: unknown, values: readonly T[], label: string): T => {
    if (typeof value === 'string' && values.includes(value as T)) return value as T;
    throw new ResearchDocumentEvidenceError(`${label} is invalid.`);
};

const calendarDate = (value: unknown, label: string): string => {
    const date = requiredString(value, label, 10);
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new ResearchDocumentEvidenceError(`${label} must use a valid YYYY-MM-DD date.`);
    }
    return date;
};

const optionalPeriod = (value: unknown, label: string): string | null => {
    if (value === null) return null;
    return requiredString(value, label, 40);
};

export const canonicalPrimarySourceUrl = (value: unknown, label = 'sourceUrl'): string => {
    const sourceUrl = requiredString(value, label, 1_000);
    let parsed: URL;
    try {
        parsed = new URL(sourceUrl);
    } catch {
        throw new ResearchDocumentEvidenceError(`${label} must be a valid HTTPS URL.`);
    }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new ResearchDocumentEvidenceError(`${label} must be a credential-free HTTPS URL.`);
    }
    parsed.hash = '';
    return parsed.toString();
};

// Deterministic content fingerprint, not a document-authenticity claim.
export const researchDocumentContentDigest = (citation: Pick<ResearchDocumentCitation,
    'market' | 'symbol' | 'sourceKind' | 'publicationDate' | 'reportingPeriod' | 'title'
    | 'sourceUrl' | 'providerLabel' | 'location' | 'excerpt' | 'captureMethod'>): string => {
    const source = JSON.stringify([
        citation.market,
        citation.symbol,
        citation.sourceKind,
        citation.publicationDate,
        citation.reportingPeriod,
        citation.title,
        canonicalPrimarySourceUrl(citation.sourceUrl),
        citation.providerLabel,
        citation.location,
        citation.excerpt,
        citation.captureMethod,
    ]);
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(source)) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
};

export const parseResearchDocumentCitation = (
    value: unknown,
    label: string,
    owner?: { readonly market: ResearchMarket; readonly symbol: string },
): ResearchDocumentCitation => {
    if (!isObject(value)) throw new ResearchDocumentEvidenceError(`${label} must be an object.`);
    const market = option(value.market, researchMarkets, `${label}.market`);
    const symbol = requiredString(value.symbol, `${label}.symbol`, 20).toUpperCase();
    if (!/^[A-Z0-9.-]{1,20}$/.test(symbol)) throw new ResearchDocumentEvidenceError(`${label}.symbol is invalid.`);
    if (owner && (owner.market !== market || owner.symbol !== symbol)) {
        throw new ResearchDocumentEvidenceError(`${label} does not belong to ${owner.market}:${owner.symbol}.`);
    }
    const capturedAt = requiredString(value.capturedAt, `${label}.capturedAt`, 40);
    if (Number.isNaN(Date.parse(capturedAt))) throw new ResearchDocumentEvidenceError(`${label}.capturedAt must be an ISO timestamp.`);
    const citation: ResearchDocumentCitation = {
        id: requiredString(value.id, `${label}.id`, 120),
        market,
        symbol,
        sourceKind: option(value.sourceKind, researchDocumentSourceKinds, `${label}.sourceKind`),
        publicationDate: calendarDate(value.publicationDate, `${label}.publicationDate`),
        reportingPeriod: optionalPeriod(value.reportingPeriod, `${label}.reportingPeriod`),
        title: requiredString(value.title, `${label}.title`, 200),
        sourceUrl: canonicalPrimarySourceUrl(value.sourceUrl, `${label}.sourceUrl`),
        providerLabel: requiredString(value.providerLabel, `${label}.providerLabel`, 80),
        location: requiredString(value.location, `${label}.location`, 120),
        excerpt: requiredString(value.excerpt, `${label}.excerpt`, RESEARCH_DOCUMENT_EXCERPT_LIMIT),
        capturedAt: new Date(capturedAt).toISOString(),
        contentDigest: requiredString(value.contentDigest, `${label}.contentDigest`, 40),
        captureMethod: option(value.captureMethod, researchDocumentCaptureMethods, `${label}.captureMethod`),
    };
    if (citation.captureMethod === 'sec-official') {
        const official = new URL(citation.sourceUrl);
        if (official.hostname !== 'www.sec.gov' || !official.pathname.startsWith('/Archives/edgar/data/')
            || citation.providerLabel !== 'SEC EDGAR' || citation.market !== 'US') {
            throw new ResearchDocumentEvidenceError(`${label} has invalid official SEC provenance.`);
        }
    }
    if (!/^[A-Za-z0-9:._-]{1,120}$/.test(citation.id)) throw new ResearchDocumentEvidenceError(`${label}.id is invalid.`);
    const expectedDigest = researchDocumentContentDigest(citation);
    if (citation.contentDigest !== expectedDigest) {
        throw new ResearchDocumentEvidenceError(`${label}.contentDigest does not match the captured evidence.`);
    }
    return citation;
};

export const parseResearchDocumentEvidenceSet = (
    value: unknown,
    owner?: { readonly market: ResearchMarket; readonly symbol: string },
): ResearchDocumentEvidenceSet => {
    if (!isObject(value) || value.version !== 1 || !Array.isArray(value.citations)) {
        throw new ResearchDocumentEvidenceError('documentEvidence must be a version-1 citation set.');
    }
    if (value.citations.length > RESEARCH_DOCUMENT_CITATION_LIMIT) {
        throw new ResearchDocumentEvidenceError(`documentEvidence must contain at most ${RESEARCH_DOCUMENT_CITATION_LIMIT} citations.`);
    }
    const citations = value.citations.map((citation, index) =>
        parseResearchDocumentCitation(citation, `documentEvidence.citations[${index}]`, owner));
    if (new Set(citations.map((citation) => citation.id)).size !== citations.length) {
        throw new ResearchDocumentEvidenceError('documentEvidence citation ids must be unique.');
    }
    return { version: 1, migrationState: 'current', citations };
};

export const migrateResearchDocumentEvidenceSet = (
    value: unknown,
    owner?: { readonly market: ResearchMarket; readonly symbol: string },
): ResearchDocumentEvidenceSet => {
    if (value === undefined) return { version: 1, migrationState: 'migrated-empty', citations: [] };
    try {
        return parseResearchDocumentEvidenceSet(value, owner);
    } catch {
        return { version: 1, migrationState: 'invalid-recovered', citations: [] };
    }
};

export type PersistedResearchEvidenceBundle = {
    readonly version: 2;
    readonly acceptedEvidence: readonly AcceptedResearchEvidence[];
    readonly documentEvidence: ResearchDocumentEvidenceSet;
};

export const splitPersistedResearchEvidence = (value: unknown): {
    readonly acceptedEvidence: unknown;
    readonly documentEvidence: unknown;
} => isObject(value) && value.version === 2
    ? { acceptedEvidence: value.acceptedEvidence, documentEvidence: value.documentEvidence }
    : { acceptedEvidence: value, documentEvidence: undefined };

export const buildPersistedResearchEvidenceBundle = (
    acceptedEvidence: readonly AcceptedResearchEvidence[],
    documentEvidence: ResearchDocumentEvidenceSet,
): PersistedResearchEvidenceBundle => ({
    version: 2,
    acceptedEvidence,
    documentEvidence: { version: 1, migrationState: 'current', citations: documentEvidence.citations },
});

export type ResearchDocumentChangeKind = 'added' | 'changed' | 'removed' | 'unchanged';
export type ResearchDocumentDiffItem = {
    readonly id: string;
    readonly kind: ResearchDocumentChangeKind;
    readonly before: ResearchDocumentCitation | null;
    readonly after: ResearchDocumentCitation | null;
};

const sameCitationSet = (left: readonly ResearchDocumentCitation[], right: readonly ResearchDocumentCitation[]): boolean =>
    left.length === right.length
    && left.every((citation, index) => citation.id === right[index]?.id && citation.contentDigest === right[index]?.contentDigest);

export const buildResearchDocumentCitationDiff = (
    current: readonly ResearchDocumentCitation[],
    history: readonly { readonly reviewedAt: string; readonly documentEvidence: ResearchDocumentEvidenceSet }[],
): { readonly baselineAt: string | null; readonly items: readonly ResearchDocumentDiffItem[] } => {
    const latest = history[0] ?? null;
    const baseline = latest && sameCitationSet(current, latest.documentEvidence.citations)
        ? history[1] ?? null
        : latest;
    const before = new Map((baseline?.documentEvidence.citations ?? []).map((citation) => [citation.id, citation]));
    const after = new Map(current.map((citation) => [citation.id, citation]));
    const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
    return {
        baselineAt: baseline?.reviewedAt ?? null,
        items: ids.map((id) => {
            const previous = before.get(id) ?? null;
            const next = after.get(id) ?? null;
            return {
                id,
                kind: previous === null ? 'added' : next === null ? 'removed'
                    : previous.contentDigest === next.contentDigest ? 'unchanged' : 'changed',
                before: previous,
                after: next,
            };
        }),
    };
};

export const secFormToResearchDocumentSourceKind = (form: string): ResearchDocumentSourceKind => {
    if (form === '10-K') return '10-K';
    if (form === '10-Q') return '10-Q';
    if (form === '8-K') return '8-K';
    if (form === '20-F') return 'annual-report';
    if (form === '6-K') return 'exchange-announcement';
    throw new ResearchDocumentEvidenceError('Unsupported SEC form.');
};
