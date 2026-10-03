import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { AcceptedResearchEvidence, ResearchRecord } from '@/lib/types/research';
import type { ResearchWorkflowTemplateId } from '@/lib/research/workflow-queue';
import type { ResearchBenchmark } from '@/lib/types/research-snapshot';
import { ResearchEditorV6 } from './ResearchEditorV6';
import { ResearchBenchmarkV6 } from './ResearchBenchmarkV6';
import { ResearchHistoryV6 } from './ResearchHistoryV6';
import {
    getThemeV6,
    type ResearchActionV6,
    type ResearchThemeV6,
    type ResearchThemeClassesV6,
} from './research-v6';

type OverviewPanelV6Props = {
    ticker: ResearchWatchlistItem;
    action: ResearchActionV6;
    theme: ResearchThemeV6;
    record: ResearchRecord;
    benchmark: ResearchBenchmark | null;
    observedCurrency: string | null;
    startReview: boolean;
    stagedEvidence: AcceptedResearchEvidence | null;
    workflowTemplateId: ResearchWorkflowTemplateId | null;
    saving: boolean;
    saveError: string | null;
    onSave: (record: ResearchRecord) => Promise<boolean>;
    onReviewChange: (editing: boolean) => void;
};

const SnapshotMetric = ({ label, value, themeClasses }: {
    label: string;
    value: string;
    themeClasses: ResearchThemeClassesV6;
}) => (
    <div className="min-w-0">
        <dt className={'text-xs font-medium ' + themeClasses.textMuted}>{label}</dt>
        <dd className={'mt-0.5 text-sm font-semibold leading-5 ' + themeClasses.textPrimary} title={value}>{value}</dd>
    </div>
);

export const OverviewPanelV6 = ({ ticker, action, theme, record, benchmark, observedCurrency, startReview, stagedEvidence, workflowTemplateId, saving, saveError, onSave, onReviewChange }: OverviewPanelV6Props) => {
    const themeClasses = getThemeV6(theme);

    return (
        <div className="space-y-3">
            {!startReview ? <>
            <div>
                <section data-surface-tier="secondary" className={'rounded-lg border p-5 backdrop-blur-sm transition-colors duration-300 ' + themeClasses.panelSecondary}>
                    <h2 className={'text-sm font-semibold ' + themeClasses.textSecondary}>Thesis</h2>
                    <dl className="mt-3 space-y-3">
                        <div>
                            <dt className={'text-xs font-medium ' + themeClasses.textMuted}>Why interested</dt>
                            <dd className={'mt-0.5 text-sm font-semibold leading-5 ' + themeClasses.textPrimary}>{ticker.whyInterested}</dd>
                        </div>
                        <div>
                            <dt className={'text-xs font-medium ' + themeClasses.textMuted}>Bull case</dt>
                            <dd className={'mt-0.5 text-sm font-semibold leading-5 ' + themeClasses.textPrimary}>{ticker.bullCase}</dd>
                        </div>
                        <div>
                            <dt className={'text-xs font-medium ' + themeClasses.textMuted}>Invalidation</dt>
                            <dd className={'mt-0.5 text-sm font-semibold leading-5 ' + themeClasses.risk}>{ticker.thesisBreak}</dd>
                        </div>
                    </dl>
                </section>

            </div>

            {benchmark ? <ResearchBenchmarkV6 benchmark={benchmark} theme={theme} /> : null}

            <details data-surface-tier="utility" className={'rounded-lg border px-5 py-4 backdrop-blur-sm transition-colors duration-300 ' + themeClasses.panelUtility}>
                <summary className={'min-h-8 cursor-pointer text-sm font-semibold ' + themeClasses.textSecondary}>Fundamentals snapshot</summary>
                <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 min-[700px]:grid-cols-3 xl:grid-cols-5">
                    <SnapshotMetric label="Market cap" value={ticker.marketCap} themeClasses={themeClasses} />
                    <SnapshotMetric label="Revenue" value={ticker.revenueGrowth} themeClasses={themeClasses} />
                    <SnapshotMetric label="Gross margin" value={ticker.grossMargin} themeClasses={themeClasses} />
                    <SnapshotMetric label="Op margin" value={ticker.operatingMargin} themeClasses={themeClasses} />
                    <SnapshotMetric label="FCF" value={ticker.freeCashFlowTrend} themeClasses={themeClasses} />
                </dl>
            </details>
            </> : null}
            <ResearchEditorV6 key={(record.reviewHistory[0]?.id ?? record.lastReviewedAt) + record.symbol + String(startReview) + (stagedEvidence?.id ?? '') + (workflowTemplateId ?? '')} initial={record} theme={theme} startEditing={startReview} stagedEvidence={stagedEvidence} workflowTemplateId={workflowTemplateId} saving={saving} error={saveError} onSave={onSave} onEditingChange={onReviewChange} decision={action} observedPrice={ticker.price ?? null} observedCurrency={observedCurrency} benchmark={benchmark} />
            {!startReview ? <details className={'rounded-lg border p-4 ' + themeClasses.panelUtility}>
                <summary className={'min-h-8 cursor-pointer text-sm font-semibold ' + themeClasses.textSecondary}>Review history · {record.reviewHistory.length} saved</summary>
                <ResearchHistoryV6 record={record} theme={theme} />
            </details> : null}
        </div>
    );
};
