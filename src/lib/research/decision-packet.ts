import type { MarketReplaySnapshot } from '../types/market-replay';
import type { InvestmentChecklist, ResearchRecord } from '../types/research';

export type ResearchDecisionPacket = {
    readonly title: string;
    readonly filename: string;
    readonly generatedAt: string;
    readonly recordRevision: number;
    readonly marketSnapshotDate: string | null;
    readonly markdown: string;
};

const checklistLabels: Readonly<Record<keyof InvestmentChecklist, string>> = {
    understandBusiness: 'Understand the business',
    revenueGrowingOrStable: 'Revenue is growing or stable',
    marginsHealthyOrImproving: 'Margins are healthy or improving',
    debtManageable: 'Debt is manageable',
    freeCashFlowPositiveOrImproving: 'Free cash flow is positive or improving',
    valuationReasonable: 'Valuation is reasonable',
    catalystOrCompoundingReason: 'Catalyst or compounding reason exists',
    downsideAcceptable: 'Downside is acceptable',
    betterThanCashOrIndex: 'Better than cash or the benchmark',
};

const singleLine = (value: string): string => value.replace(/\s+/g, ' ').trim();
const valueOrMissing = (value: string): string => singleLine(value) || 'Not recorded.';
const valueOrUnavailable = (value: number | null, suffix = ''): string =>
    value === null || !Number.isFinite(value) ? 'Not recorded.' : `${value}${suffix}`;
const markdownUrl = (value: string): string => value.replace(/\)/g, '%29');
const filenamePart = (value: string): string => value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'research';

const marketContextLines = (snapshot: MarketReplaySnapshot | null): readonly string[] => {
    if (!snapshot) {
        return [
            '## Market context',
            '',
            'No full observed market snapshot was available when this packet was generated.',
        ];
    }
    return [
        '## Market context',
        '',
        `- Snapshot date: ${snapshot.summary.date}`,
        `- Stored posture: ${snapshot.summary.tier}`,
        `- Composite score: ${snapshot.summary.score}`,
        `- Evidence agreement: ${snapshot.agreementPercent}%`,
        `- Majority signal: ${snapshot.majoritySignal}`,
        `- Confidence: ${snapshot.confidenceLevel}`,
        `- Snapshot origin: ${snapshot.summary.origin}`,
        `- Model version: ${String(snapshot.metadata.scoring_model_version ?? 'Unavailable')}`,
        `- Stored limitation: ${String(snapshot.interpretationContext.limitation ?? 'No limitation text was stored.')}`,
    ];
};

export const buildResearchDecisionPacket = ({
    record,
    generatedAt,
    marketContext,
}: {
    readonly record: ResearchRecord;
    readonly generatedAt: string;
    readonly marketContext: MarketReplaySnapshot | null;
}): ResearchDecisionPacket => {
    const evidence = record.acceptedEvidence.flatMap((item) => item.sources.map((source) => ({
        item,
        source,
    })));
    const checklist = Object.entries(record.checklist) as [keyof InvestmentChecklist, boolean][];
    const completedChecklist = checklist.filter(([, complete]) => complete).length;
    const position = record.positionPlan;
    const lines = [
        `# ${record.symbol} decision packet`,
        '',
        `> Frozen point-in-time research record generated ${generatedAt}. Saved research revision ${record.revision}.`,
        '',
        '## Record metadata',
        '',
        `- Company: ${valueOrMissing(record.companyName)}`,
        `- Market: ${record.market}`,
        `- Status: ${record.status}`,
        `- Position: ${record.positionState}`,
        `- Last reviewed: ${record.lastReviewedAt}`,
        `- Saved record updated: ${record.updatedAt}`,
        `- Generated: ${generatedAt}`,
        '',
        ...marketContextLines(marketContext),
        '',
        '## Decision',
        '',
        `- Decision: ${record.decisionJournal.decision}`,
        `- Confidence: ${record.decisionJournal.confidence}`,
        `- Thesis strength: ${record.thesisStrength}`,
        `- Valuation state: ${record.valuationState}`,
        `- In saved buy zone: ${record.inBuyZone ? 'Yes' : 'No'}`,
        `- Observed price: ${valueOrUnavailable(record.decisionJournal.observedPrice)}`,
        `- Next review: ${record.decisionJournal.nextReviewAt ?? 'Not scheduled'}`,
        `- Prior decision outcome: ${record.decisionJournal.priorReviewId ? record.decisionJournal.priorOutcome : 'No linked prior review'}`,
        `- Outcome note: ${valueOrMissing(record.decisionJournal.outcomeNote)}`,
        '',
        '## Thesis',
        '',
        `- Why interested: ${valueOrMissing(record.whyInterested)}`,
        `- Bull case: ${valueOrMissing(record.bullCase)}`,
        `- Bear case: ${valueOrMissing(record.bearCase)}`,
        `- Buy trigger: ${valueOrMissing(record.buyTrigger)}`,
        `- Sell trigger: ${valueOrMissing(record.sellTrigger)}`,
        `- Thesis break: ${valueOrMissing(record.thesisBreak)}`,
        `- Notes: ${valueOrMissing(record.notes)}`,
        '',
        '## Position plan',
        '',
        `- Planned allocation: ${valueOrUnavailable(position.plannedAllocationPercent, '%')}`,
        `- Average cost: ${valueOrUnavailable(position.averageCost)}`,
        `- Planned entry price: ${valueOrUnavailable(position.plannedEntryPrice)}`,
        `- Invalidation price: ${valueOrUnavailable(position.invalidationPrice)}`,
        '',
        `## Checklist (${completedChecklist}/${checklist.length})`,
        '',
        ...checklist.map(([key, complete]) => `- [${complete ? 'x' : ' '}] ${checklistLabels[key]}`),
        '',
        '## Accepted evidence',
        '',
        ...(evidence.length > 0 ? evidence.map(({ item, source }) =>
            `- ${valueOrMissing(item.title)}: ${valueOrMissing(source.label)} = ${valueOrMissing(source.value)} — [${valueOrMissing(source.source)}](${markdownUrl(source.sourceUrl)})${source.reportingPeriod ? `, period ${source.reportingPeriod}` : ''}`,
        ) : ['No accepted evidence was saved with this record.']),
        '',
        '## Review history',
        '',
        `- Saved review snapshots: ${record.reviewHistory.length}`,
        ...record.reviewHistory.slice(0, 5).map((review) =>
            `- ${review.reviewedAt}: ${review.decisionJournal.decision} (${review.decisionJournal.confidence} confidence), thesis ${review.thesisStrength}`,
        ),
        '',
        '## Limitations and decision boundary',
        '',
        '- This packet freezes saved research state and, when available, one persisted observed market snapshot. It does not refresh after generation.',
        '- Market posture is context, not a ticker-level buy or sell instruction.',
        '- Missing fields and missing accepted evidence remain explicitly unavailable; they are not inferred.',
        '- Prices, fundamentals, and market conditions can change after the timestamps above.',
        '- This is a research record, not financial advice or a prediction of future returns.',
        '',
    ];
    const date = generatedAt.slice(0, 10);
    return {
        title: `${record.symbol} decision packet`,
        filename: `${filenamePart(record.symbol)}-decision-packet-${filenamePart(date)}.md`,
        generatedAt,
        recordRevision: record.revision,
        marketSnapshotDate: marketContext?.summary.date ?? null,
        markdown: lines.join('\n'),
    };
};
