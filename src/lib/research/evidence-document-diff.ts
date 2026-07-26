import type {
    AcceptedResearchEvidence,
    ResearchEvidence,
    ResearchFindingTarget,
    ResearchRecord,
} from '../types/research';

export const evidenceDocumentChangeKinds = ['added', 'changed', 'removed', 'unchanged'] as const;
export const evidenceDocumentCategories = ['guidance', 'risk', 'margin', 'debt', 'cash-flow', 'growth', 'other'] as const;

export type EvidenceDocumentChangeKind = typeof evidenceDocumentChangeKinds[number];
export type EvidenceDocumentCategory = typeof evidenceDocumentCategories[number];

export type EvidenceDocumentVersion = {
    readonly findingTitle: string;
    readonly target: ResearchFindingTarget;
    readonly label: string;
    readonly value: string;
    readonly source: string;
    readonly sourceUrl: string;
    readonly reportingPeriod: string | null;
};

export type EvidenceDocumentDiffItem = {
    readonly id: string;
    readonly category: EvidenceDocumentCategory;
    readonly kind: EvidenceDocumentChangeKind;
    readonly before: EvidenceDocumentVersion | null;
    readonly after: EvidenceDocumentVersion | null;
};

export type EvidenceDocumentDiff = {
    readonly symbol: string;
    readonly baselineAt: string | null;
    readonly currentAt: string;
    readonly hasBaseline: boolean;
    readonly items: readonly EvidenceDocumentDiffItem[];
};

const categoryFor = (finding: AcceptedResearchEvidence, source: ResearchEvidence): EvidenceDocumentCategory => {
    const text = `${finding.title} ${finding.summary} ${source.label} ${source.id}`.toLowerCase();
    if (/\bguidance\b|\boutlook\b|\bforecast\b/.test(text)) return 'guidance';
    if (/\brisk\b|\binvalidation\b|\bdownside\b/.test(text)) return 'risk';
    if (/\bmargin\b|\bprofitability\b/.test(text)) return 'margin';
    if (/\bdebt\b|\bleverage\b|\bborrow/.test(text)) return 'debt';
    if (/\bcash flow\b|\bfree cash\b|\bfcf\b/.test(text)) return 'cash-flow';
    if (/\brevenue\b|\bgrowth\b|\bearnings\b|\bincome\b/.test(text)) return 'growth';
    return 'other';
};

const flattenEvidence = (
    evidence: readonly AcceptedResearchEvidence[],
): ReadonlyMap<string, { readonly category: EvidenceDocumentCategory; readonly version: EvidenceDocumentVersion }> => {
    const flattened = new Map<string, { readonly category: EvidenceDocumentCategory; readonly version: EvidenceDocumentVersion }>();
    for (const finding of evidence) {
        for (const source of finding.sources) {
            const id = `${finding.target}:${source.id}`;
            if (flattened.has(id)) continue;
            flattened.set(id, {
                category: categoryFor(finding, source),
                version: {
                    findingTitle: finding.title,
                    target: finding.target,
                    label: source.label,
                    value: source.value,
                    source: source.source,
                    sourceUrl: source.sourceUrl,
                    reportingPeriod: source.reportingPeriod,
                },
            });
        }
    }
    return flattened;
};

const sameVersion = (left: EvidenceDocumentVersion, right: EvidenceDocumentVersion): boolean =>
    left.value === right.value
    && left.reportingPeriod === right.reportingPeriod
    && left.sourceUrl === right.sourceUrl
    && left.label === right.label;

export const buildEvidenceDocumentDiff = (record: ResearchRecord): EvidenceDocumentDiff => {
    const baseline = record.reviewHistory.length >= 2 ? record.reviewHistory[1] ?? null : null;
    const before = flattenEvidence(baseline?.acceptedEvidence ?? []);
    const after = flattenEvidence(record.acceptedEvidence);
    const ids = [...new Set([...before.keys(), ...after.keys()])].sort();
    const items = ids.map((id): EvidenceDocumentDiffItem => {
        const previous = before.get(id) ?? null;
        const current = after.get(id) ?? null;
        const kind: EvidenceDocumentChangeKind = previous === null
            ? 'added'
            : current === null
                ? 'removed'
                : sameVersion(previous.version, current.version)
                    ? 'unchanged'
                    : 'changed';
        return {
            id,
            category: current?.category ?? previous?.category ?? 'other',
            kind,
            before: previous?.version ?? null,
            after: current?.version ?? null,
        };
    });
    return {
        symbol: record.symbol,
        baselineAt: baseline?.reviewedAt ?? null,
        currentAt: record.reviewHistory[0]?.reviewedAt ?? record.updatedAt,
        hasBaseline: baseline !== null,
        items,
    };
};
