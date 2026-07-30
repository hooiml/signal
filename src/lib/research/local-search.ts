import type { ResearchRecord } from '../types/research';
import {
    getResearchWorkflowTemplate,
    researchWorkflowSourceLabels,
    type ResearchWorkflowTask,
} from './workflow-queue';

export const localResearchSearchGroups = [
    'Ticker',
    'Research',
    'Evidence',
    'Filings',
    'Queue',
] as const;

export type LocalResearchSearchGroup = typeof localResearchSearchGroups[number];

export type LocalResearchSearchDestination =
    | {
        readonly workspace: 'research';
        readonly symbol: string;
        readonly tab: 'overview';
    }
    | {
        readonly workspace: 'filings';
        readonly symbol: string;
    }
    | {
        readonly workspace: 'queue';
        readonly symbol: string;
        readonly taskId: string;
    };

export type LocalResearchSearchEntry = {
    readonly id: string;
    readonly group: LocalResearchSearchGroup;
    readonly symbol: string;
    readonly label: string;
    readonly searchableText: string;
    readonly snippetText: string;
    readonly destinationLabel: string;
    readonly destination: LocalResearchSearchDestination;
};

export type LocalResearchSearchResult = Omit<LocalResearchSearchEntry, 'searchableText' | 'snippetText'> & {
    readonly snippet: string;
};

export type LocalResearchSearchResponse = {
    readonly results: readonly LocalResearchSearchResult[];
    readonly totalMatches: number;
    readonly truncated: boolean;
};

export const localResearchSearchLimits = {
    records: 100,
    acceptedEvidencePerRecord: 25,
    citationsPerRecord: 25,
    queueTasks: 100,
    queryLength: 80,
    snippetLength: 150,
    resultsPerGroup: 8,
} as const;

const thesisFields = [
    ['whyInterested', 'Why interested', 2_000],
    ['bullCase', 'Bull case', 2_000],
    ['bearCase', 'Bear case', 2_000],
    ['buyTrigger', 'Buy trigger', 2_000],
    ['sellTrigger', 'Sell trigger', 2_000],
    ['thesisBreak', 'Thesis invalidation', 2_000],
    ['notes', 'Review notes', 5_000],
] as const satisfies readonly (readonly [keyof ResearchRecord, string, number])[];

const normalize = (value: string): string =>
    value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

const boundedText = (value: string, maximum: number): string =>
    value.trim().replace(/\s+/g, ' ').slice(0, maximum);

const tickerDestination = (symbol: string): LocalResearchSearchDestination => ({
    workspace: 'research',
    symbol,
    tab: 'overview',
});

const entry = (
    value: Omit<LocalResearchSearchEntry, 'searchableText'> & { readonly searchParts: readonly string[] },
): LocalResearchSearchEntry => {
    const { searchParts, ...rest } = value;
    return {
        ...rest,
        searchableText: normalize([rest.label, ...searchParts].join(' ')),
    };
};

export const buildLocalResearchSearchIndex = (
    records: readonly ResearchRecord[],
    queueTasks: readonly ResearchWorkflowTask[],
): readonly LocalResearchSearchEntry[] => {
    const entries: LocalResearchSearchEntry[] = [];
    const boundedRecords = records.slice(0, localResearchSearchLimits.records);

    for (const record of boundedRecords) {
        entries.push(entry({
            id: `ticker-${record.symbol}`,
            group: 'Ticker',
            symbol: record.symbol,
            label: `${record.symbol} · ${record.companyName}`,
            searchParts: [record.symbol, record.companyName],
            snippetText: `${record.market} saved research record`,
            destinationLabel: `${record.symbol} · Research · Overview`,
            destination: tickerDestination(record.symbol),
        }));

        for (const [field, fieldLabel, maximum] of thesisFields) {
            const text = boundedText(String(record[field]), maximum);
            if (!text) continue;
            entries.push(entry({
                id: `research-${record.symbol}-${field}`,
                group: 'Research',
                symbol: record.symbol,
                label: `${record.symbol} · ${fieldLabel}`,
                searchParts: [fieldLabel, text],
                snippetText: text,
                destinationLabel: `${record.symbol} · Research · Overview`,
                destination: tickerDestination(record.symbol),
            }));
        }

        for (const finding of record.acceptedEvidence.slice(0, localResearchSearchLimits.acceptedEvidencePerRecord)) {
            const sourceText = finding.sources.map((source) => `${source.label} · ${source.source}`).join(' · ');
            const snippetText = boundedText([finding.summary, sourceText].filter(Boolean).join(' · '), 2_000);
            entries.push(entry({
                id: `evidence-${record.symbol}-${finding.id}`,
                group: 'Evidence',
                symbol: record.symbol,
                label: `${record.symbol} · ${finding.title}`,
                searchParts: [
                    finding.title,
                    ...finding.sources.flatMap((source) => [source.label, source.source]),
                ],
                snippetText,
                destinationLabel: `${record.symbol} · Research · Overview`,
                destination: tickerDestination(record.symbol),
            }));
        }

        for (const citation of record.documentEvidence.citations.slice(0, localResearchSearchLimits.citationsPerRecord)) {
            const filingIdentity = [
                citation.sourceKind,
                citation.publicationDate,
                citation.reportingPeriod,
                citation.id,
                citation.providerLabel,
                citation.location,
            ].filter((value): value is string => Boolean(value)).join(' · ');
            entries.push(entry({
                id: `filing-${record.symbol}-${citation.id}`,
                group: 'Filings',
                symbol: record.symbol,
                label: `${record.symbol} · ${citation.title}`,
                searchParts: [
                    citation.title,
                    citation.sourceKind,
                    citation.publicationDate,
                    citation.reportingPeriod ?? '',
                    citation.id,
                    citation.providerLabel,
                    citation.location,
                ],
                snippetText: filingIdentity,
                destinationLabel: `${record.symbol} · Filings`,
                destination: { workspace: 'filings', symbol: record.symbol },
            }));
        }
    }

    for (const task of queueTasks.slice(-localResearchSearchLimits.queueTasks)) {
        const template = getResearchWorkflowTemplate(task.templateId);
        const sourceLabel = researchWorkflowSourceLabels[task.source];
        const taskState = task.completedAt ? 'Completed' : task.dueAt ? `Due ${task.dueAt}` : 'Pending · no due date';
        entries.push(entry({
            id: `queue-${task.id}`,
            group: 'Queue',
            symbol: task.symbol,
            label: `${task.symbol} · ${template.name}`,
            searchParts: [
                task.symbol,
                template.id,
                template.name,
                template.description,
                task.source,
                sourceLabel,
            ],
            snippetText: `${sourceLabel} · ${taskState} · ${template.description}`,
            destinationLabel: `${task.symbol} · Queue`,
            destination: { workspace: 'queue', symbol: task.symbol, taskId: task.id },
        }));
    }

    return entries;
};

const matchRank = (entryValue: LocalResearchSearchEntry, query: string, terms: readonly string[]): number => {
    const normalizedLabel = normalize(entryValue.label);
    if (normalize(entryValue.symbol) === query || normalizedLabel === query) return 0;
    if (normalizedLabel.startsWith(query)) return 1;
    if (normalizedLabel.includes(query)) return 2;
    if (terms.every((term) => normalizedLabel.includes(term))) return 3;
    return 4;
};

const snippetAroundMatch = (value: string, query: string, terms: readonly string[]): string => {
    const compact = boundedText(value, 5_000);
    if (!compact) return 'Saved local context';
    const normalized = normalize(compact);
    const matchedTerm = [query, ...terms].find((term) => normalized.includes(term));
    const matchedAt = matchedTerm ? normalized.indexOf(matchedTerm) : 0;
    const start = Math.max(0, matchedAt - 36);
    const available = localResearchSearchLimits.snippetLength - Number(start > 0) - Number(start + localResearchSearchLimits.snippetLength < compact.length);
    const body = compact.slice(start, start + Math.max(1, available)).trim();
    return `${start > 0 ? '…' : ''}${body}${start + body.length < compact.length ? '…' : ''}`;
};

export const searchLocalResearchIndex = (
    entries: readonly LocalResearchSearchEntry[],
    rawQuery: string,
): LocalResearchSearchResponse => {
    const query = normalize(rawQuery).slice(0, localResearchSearchLimits.queryLength);
    if (query.length < 2) return { results: [], totalMatches: 0, truncated: false };
    const terms = query.split(' ').filter(Boolean);
    const matches = entries
        .filter((candidate) => terms.every((term) => candidate.searchableText.includes(term)))
        .sort((left, right) =>
            localResearchSearchGroups.indexOf(left.group) - localResearchSearchGroups.indexOf(right.group)
            || matchRank(left, query, terms) - matchRank(right, query, terms)
            || left.label.localeCompare(right.label)
            || left.id.localeCompare(right.id));
    const groupCounts = new Map<LocalResearchSearchGroup, number>();
    const visible = matches.filter((candidate) => {
        const count = groupCounts.get(candidate.group) ?? 0;
        if (count >= localResearchSearchLimits.resultsPerGroup) return false;
        groupCounts.set(candidate.group, count + 1);
        return true;
    });
    return {
        results: visible.map((candidate) => ({
            id: candidate.id,
            group: candidate.group,
            symbol: candidate.symbol,
            label: candidate.label,
            destinationLabel: candidate.destinationLabel,
            destination: candidate.destination,
            snippet: snippetAroundMatch(candidate.snippetText, query, terms),
        })),
        totalMatches: matches.length,
        truncated: visible.length < matches.length,
    };
};
