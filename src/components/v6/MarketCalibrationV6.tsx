'use client';

import { useState } from 'react';
import { getCalibrationZone, selectHistoricalValidationCases } from '@/lib/market-calibration';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { HistoricalCalibrationTimelineV6 } from './HistoricalCalibrationTimelineV6';
import { HistoricalOutcomeScatterV6 } from './HistoricalOutcomeScatterV6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type Calibration = NonNullable<MarketSignal['metadata']['historical_validation']>;
type CalibrationView = 'timeline' | 'forward' | 'zones' | 'mismatches' | 'methodology';

const views: ReadonlyArray<{ id: CalibrationView; label: string }> = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'forward', label: 'Forward outcomes' },
    { id: 'zones', label: 'Score zones' },
    { id: 'mismatches', label: 'Mismatches' },
    { id: 'methodology', label: 'Methodology' },
];

const signedPercent = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
const compactDate = (value: string | null) => value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'Unavailable';
const evidenceLabel = (value: Calibration['horizons'][number]['cohorts'][number]['evidence_level']) => value.charAt(0).toUpperCase() + value.slice(1);

const ForwardOutcomesView = ({ calibration, currentScore, theme }: {
    readonly calibration: Calibration;
    readonly currentScore: number;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const currentZone = getCalibrationZone(currentScore);
    return <div className="grid gap-6 xl:grid-cols-2" data-testid="calibration-forward-view">
        {calibration.horizons.map((horizon) => {
            const cohort = horizon.cohorts.find((candidate) => candidate.zone === currentZone);
            return <section key={horizon.days} className={'min-w-0 rounded border p-4 ' + styles.row}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h3 className={'text-sm font-bold ' + styles.textPrimary}>{horizon.days === 7 ? 'One-week forward returns' : 'One-month forward returns'}</h3>
                        <p className={'mt-1 text-xs ' + styles.textMuted}>Every eligible score snapshot, not a curated example set.</p>
                    </div>
                    {cohort ? <span className={'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ' + styles.divider + ' ' + styles.textSecondary}>{evidenceLabel(cohort.evidence_level)}</span> : null}
                </div>
                {cohort && cohort.median_forward_return_pct !== null && horizon.baseline.median_forward_return_pct !== null && horizon.observations.length > 0 ? <HistoricalOutcomeScatterV6
                    observations={horizon.observations}
                    currentScore={currentScore}
                    similarMedian={cohort.median_forward_return_pct}
                    baselineMedian={horizon.baseline.median_forward_return_pct}
                    benchmarkName={calibration.benchmark_name}
                    days={horizon.days}
                    theme={theme}
                /> : <p className={'mt-4 text-sm ' + styles.textMuted}>This horizon does not have enough usable observations for a distribution plot.</p>}
            </section>;
        })}
    </div>;
};

const ScoreZonesView = ({ calibration, styles }: { readonly calibration: Calibration; readonly styles: ReturnType<typeof getThemeV6> }) => {
    const week = calibration.horizons.find((horizon) => horizon.days === 7);
    const month = calibration.horizons.find((horizon) => horizon.days === 30);
    const labels = week?.cohorts ?? month?.cohorts ?? [];
    return <div data-testid="calibration-zones-view">
        <p className={'mb-4 text-sm leading-6 ' + styles.textSecondary}>Zone boundaries match the live Signal scoring contract. The all-period row is the unconditional market baseline.</p>
        <div className={'overflow-x-auto rounded border ' + styles.divider}>
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
                <thead className={styles.row}>
                    <tr>
                        <th className="px-3 py-3 font-semibold">Score zone</th>
                        <th className="px-3 py-3 font-semibold">7-day samples</th>
                        <th className="px-3 py-3 font-semibold">7-day median</th>
                        <th className="px-3 py-3 font-semibold">7-day positive</th>
                        <th className="px-3 py-3 font-semibold">30-day samples</th>
                        <th className="px-3 py-3 font-semibold">30-day median</th>
                        <th className="px-3 py-3 font-semibold">30-day positive</th>
                    </tr>
                </thead>
                <tbody>
                    {labels.map((label) => {
                        const weekZone = week?.cohorts.find((cohort) => cohort.zone === label.zone);
                        const monthZone = month?.cohorts.find((cohort) => cohort.zone === label.zone);
                        return <tr key={label.zone} className={'border-t ' + styles.divider}>
                            <th className={'px-3 py-3 font-mono font-bold ' + styles.textPrimary}>{label.label}</th>
                            <td className="px-3 py-3">{weekZone?.sample_count ?? '—'}</td>
                            <td className="px-3 py-3 font-mono">{signedPercent(weekZone?.median_forward_return_pct ?? null)}</td>
                            <td className="px-3 py-3">{weekZone?.positive_return_rate_pct ?? '—'}{weekZone?.positive_return_rate_pct !== null && weekZone?.positive_return_rate_pct !== undefined ? '%' : ''}</td>
                            <td className="px-3 py-3">{monthZone?.sample_count ?? '—'}</td>
                            <td className="px-3 py-3 font-mono">{signedPercent(monthZone?.median_forward_return_pct ?? null)}</td>
                            <td className="px-3 py-3">{monthZone?.positive_return_rate_pct ?? '—'}{monthZone?.positive_return_rate_pct !== null && monthZone?.positive_return_rate_pct !== undefined ? '%' : ''}</td>
                        </tr>;
                    })}
                    <tr className={'border-t font-semibold ' + styles.divider + ' ' + styles.row}>
                        <th className="px-3 py-3">All periods</th>
                        <td className="px-3 py-3">{week?.baseline.sample_count ?? '—'}</td>
                        <td className="px-3 py-3 font-mono">{signedPercent(week?.baseline.median_forward_return_pct ?? null)}</td>
                        <td className="px-3 py-3">{week?.baseline.positive_return_rate_pct ?? '—'}{week?.baseline.positive_return_rate_pct !== null && week?.baseline.positive_return_rate_pct !== undefined ? '%' : ''}</td>
                        <td className="px-3 py-3">{month?.baseline.sample_count ?? '—'}</td>
                        <td className="px-3 py-3 font-mono">{signedPercent(month?.baseline.median_forward_return_pct ?? null)}</td>
                        <td className="px-3 py-3">{month?.baseline.positive_return_rate_pct ?? '—'}{month?.baseline.positive_return_rate_pct !== null && month?.baseline.positive_return_rate_pct !== undefined ? '%' : ''}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <p className={'mt-3 text-xs leading-5 ' + styles.textMuted}>Sample counts are overlapping daily observations. Medians and positive-period rates are descriptive, not independent trials.</p>
    </div>;
};

const CasesList = ({ title, description, cases, styles }: {
    readonly title: string;
    readonly description: string;
    readonly cases: ReturnType<typeof selectHistoricalValidationCases>['aligned'];
    readonly styles: ReturnType<typeof getThemeV6>;
}) => <section className={'rounded border p-4 ' + styles.row}>
    <h3 className={'text-sm font-bold ' + styles.textPrimary}>{title}</h3>
    <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>{description}</p>
    {cases.length > 0 ? <ul className="mt-3 space-y-2">
        {cases.map((item) => <li key={`${item.kind}-${item.date}`} className={'border-t pt-2 text-xs first:border-t-0 first:pt-0 ' + styles.divider}>
            <span className={'font-mono font-bold ' + styles.textPrimary}>Score {item.score} · {signedPercent(item.forward_return_pct)}</span>
            <span className={'mt-0.5 block ' + styles.textMuted}>{compactDate(item.date)} · {item.tier} · {item.origin}</span>
        </li>)}
    </ul> : <p className={'mt-3 text-xs ' + styles.textMuted}>No eligible cases in the current 30-day dataset.</p>}
</section>;

const MismatchesView = ({ calibration, styles }: { readonly calibration: Calibration; readonly styles: ReturnType<typeof getThemeV6> }) => {
    const cases = selectHistoricalValidationCases(calibration);
    return <div data-testid="calibration-mismatches-view">
        <p className={'mb-4 text-sm leading-6 ' + styles.textSecondary}>Cases are selected mechanically from all eligible 30-day observations and ranked by absolute market move.</p>
        <div className="grid gap-4 lg:grid-cols-3">
            <CasesList title="Largest directional misses" description="A positive tier preceded a decline, or a negative tier preceded a rise." cases={cases.mismatches} styles={styles} />
            <CasesList title="Strongest aligned periods" description="The subsequent market direction matched the score tier." cases={cases.aligned} styles={styles} />
            <CasesList title="Neutral but market moved sharply" description="Neutral-tier observations followed by an absolute 30-day move of at least 5%." cases={cases.neutral} styles={styles} />
        </div>
    </div>;
};

const MethodologyView = ({ calibration, styles }: { readonly calibration: Calibration; readonly styles: ReturnType<typeof getThemeV6> }) => <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.72fr)]" data-testid="calibration-methodology-view">
    <div>
        <h3 className={'text-sm font-bold ' + styles.textPrimary}>Validation safeguards</h3>
        <ul className={'mt-3 list-disc space-y-2 pl-5 text-sm leading-6 ' + styles.textSecondary}>
            <li>Observed scores are stored snapshots. Reconstructed scores are separately labelled and use only stored historical inputs plus disclosed neutral fallbacks.</li>
            <li>Forward benchmark returns are calculated after the score date and are never inputs to the score.</li>
            <li>Each score zone is compared with every eligible score snapshot through the all-period baseline.</li>
            <li>Seven-day and 30-day observations overlap and are not statistically independent.</li>
            <li>Evidence strength follows the existing Insufficient, Preliminary, and Established thresholds.</li>
            <li>Observed provenance does not by itself mean out-of-sample validation.</li>
        </ul>
    </div>
    <dl className={'rounded border p-4 text-xs ' + styles.row}>
        <div><dt className={styles.textMuted}>Current scoring contract</dt><dd className={'mt-1 font-mono font-bold ' + styles.textPrimary}>{calibration.model_version}</dd></div>
        <div className="mt-4"><dt className={styles.textMuted}>Historical data window</dt><dd className={'mt-1 font-bold ' + styles.textPrimary}>{compactDate(calibration.data_start_date)} – {compactDate(calibration.data_through_date)}</dd></div>
        <div className="mt-4"><dt className={styles.textMuted}>Provenance</dt><dd className={'mt-1 font-bold ' + styles.textPrimary}>{calibration.observed_snapshot_count} observed · {calibration.reconstructed_snapshot_count} reconstructed</dd></div>
        <div className="mt-4"><dt className={styles.textMuted}>Out-of-sample result</dt><dd className={'mt-1 font-bold ' + styles.textPrimary}>Not yet available</dd><p className={'mt-1 leading-5 ' + styles.textMuted}>A fixed-model holdout or rolling evaluation must be collected before this label can change.</p></div>
    </dl>
</div>;

export const MarketCalibrationV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const calibration = signal.metadata.historical_validation;
    const [activeView, setActiveView] = useState<CalibrationView>('timeline');
    if (!calibration) return null;
    const styles = getThemeV6(theme);

    return <section id="historical-calibration" data-testid="market-calibration" aria-labelledby="market-calibration-title" data-surface-tier="secondary" className={'scroll-mt-24 rounded-lg border p-5 backdrop-blur-sm sm:p-6 ' + styles.panelSecondary}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Historical calibration</p>
                <h2 id="market-calibration-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Test the score against what happened next</h2>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>{calibration.benchmark_name} forward outcomes across the complete eligible history, including aligned periods and failures.</p>
            </div>
            <div className={'text-right text-xs leading-5 ' + styles.textMuted}>
                <p>{calibration.snapshot_count} timeline scores · {calibration.observed_snapshot_count} observed · {calibration.reconstructed_snapshot_count} reconstructed</p>
                {calibration.timeline_only_snapshot_count > 0 ? <p>{calibration.timeline_only_snapshot_count} limited points · timeline only</p> : null}
                <p>Through {compactDate(calibration.data_through_date)} · model {calibration.model_version}</p>
            </div>
        </div>

        <div className={'mt-5 overflow-x-auto border-b ' + styles.divider}>
            <div className="flex min-w-max gap-1" role="tablist" aria-label="Historical calibration views">
                {views.map((view) => <button
                    key={view.id}
                    id={`calibration-tab-${view.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeView === view.id}
                    aria-controls={`calibration-panel-${view.id}`}
                    onClick={() => setActiveView(view.id)}
                    className={'min-h-11 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ' + (activeView === view.id ? styles.textPrimary : styles.textMuted)}
                    style={{ borderBottomColor: activeView === view.id ? 'currentColor' : 'transparent' }}
                >{view.label}</button>)}
            </div>
        </div>

        <div id={`calibration-panel-${activeView}`} role="tabpanel" aria-labelledby={`calibration-tab-${activeView}`} className="mt-5" data-testid={`calibration-view-${activeView}`}>
            {activeView === 'timeline' ? <HistoricalCalibrationTimelineV6 points={calibration.timeline} benchmarkName={calibration.benchmark_name} theme={theme} /> : null}
            {activeView === 'forward' ? <ForwardOutcomesView calibration={calibration} currentScore={signal.composite_score} theme={theme} /> : null}
            {activeView === 'zones' ? <ScoreZonesView calibration={calibration} styles={styles} /> : null}
            {activeView === 'mismatches' ? <MismatchesView calibration={calibration} styles={styles} /> : null}
            {activeView === 'methodology' ? <MethodologyView calibration={calibration} styles={styles} /> : null}
        </div>

        {calibration.reconstruction_note ? <p className={'mt-5 text-xs leading-5 ' + styles.textMuted}><strong>Reconstruction coverage:</strong> {calibration.reconstruction_note}</p> : null}
        <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>{calibration.limitation}</p>
    </section>;
};
