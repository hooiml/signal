import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import type { ResearchRecord } from '@/lib/types/research';
import type { ResearchBenchmark } from '@/lib/types/research-snapshot';
import { ResearchEditorV6 } from './ResearchEditorV6';
import { ResearchBenchmarkV6 } from './ResearchBenchmarkV6';
import { ResearchHistoryV6 } from './ResearchHistoryV6';
import {
    checklistLabelsV6,
    getActionReasonV6,
    getActionToneV6,
    getChecklistCountV6,
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
    saving: boolean;
    saveError: string | null;
    onSave: (record: ResearchRecord) => Promise<boolean>;
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

export const OverviewPanelV6 = ({ ticker, action, theme, record, benchmark, saving, saveError, onSave }: OverviewPanelV6Props) => {
    const checkedCount = getChecklistCountV6(ticker);
    const nextCheck = Object.entries(ticker.checklist).find(([, passed]) => !passed)?.[0];
    const progress = String((checkedCount / 9) * 360) + 'deg';
    const decisionReason = getActionReasonV6(action);
    const themeClasses = getThemeV6(theme);

    return (
        <div className="space-y-3">
            <div className="grid gap-3 min-[700px]:grid-cols-[minmax(0,1.35fr)_minmax(190px,0.85fr)]">
                <section className={'rounded-lg border p-5 backdrop-blur-md transition-colors duration-300 ' + themeClasses.panel}>
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

                <section className={'flex min-h-[230px] flex-col items-center justify-center rounded-lg border p-5 text-center backdrop-blur-md transition-colors duration-300 ' + themeClasses.panel}>
                    <div
                        className="grid size-[92px] place-items-center rounded-full"
                        style={{ background: 'conic-gradient(#10b981 ' + progress + ', ' + themeClasses.ringTrackColor + ' 0deg)' }}
                        role="img"
                        aria-label={String(checkedCount) + ' of 9 research checks passed'}
                    >
                        <div className={'grid size-[74px] place-items-center rounded-full transition-colors duration-300 ' + themeClasses.ringInner}>
                            <span className={'text-lg font-extrabold ' + themeClasses.textPrimary}>{checkedCount}/9</span>
                            <span className={'-mt-5 text-[10px] font-semibold ' + themeClasses.textSecondary}>checks</span>
                        </div>
                    </div>
                    <span className={'mt-3 rounded-full border px-3 py-1 text-xs font-bold ' + themeClasses.statusSurface + ' ' + getActionToneV6(action, theme)}>{action}</span>
                    <p className={'mt-3 max-w-[240px] text-xs font-semibold leading-5 ' + themeClasses.textSecondary}>{decisionReason}</p>
                    <p className={'mt-2 max-w-[220px] text-xs leading-4 ' + themeClasses.textMuted}>
                        {nextCheck ? 'Next: ' + checklistLabelsV6[nextCheck] : 'All research checks are complete.'}
                    </p>
                </section>
            </div>

            {benchmark ? <ResearchBenchmarkV6 benchmark={benchmark} theme={theme} /> : null}

            <section className={'rounded-lg border px-5 py-4 backdrop-blur-md transition-colors duration-300 ' + themeClasses.panel}>
                <h2 className={'text-sm font-semibold ' + themeClasses.textSecondary}>Fundamentals snapshot</h2>
                <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 min-[700px]:grid-cols-3 xl:grid-cols-5">
                    <SnapshotMetric label="Market cap" value={ticker.marketCap} themeClasses={themeClasses} />
                    <SnapshotMetric label="Revenue" value={ticker.revenueGrowth} themeClasses={themeClasses} />
                    <SnapshotMetric label="Gross margin" value={ticker.grossMargin} themeClasses={themeClasses} />
                    <SnapshotMetric label="Op margin" value={ticker.operatingMargin} themeClasses={themeClasses} />
                    <SnapshotMetric label="FCF" value={ticker.freeCashFlowTrend} themeClasses={themeClasses} />
                </dl>
            </section>
            <ResearchEditorV6 key={(record.reviewHistory[0]?.id ?? record.lastReviewedAt) + record.symbol} initial={record} theme={theme} saving={saving} error={saveError} onSave={onSave} />
            <ResearchHistoryV6 record={record} theme={theme} />
        </div>
    );
};
