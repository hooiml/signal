import { selectSimilarScoreOutcomes, type SimilarScoreOutcome } from '@/lib/market-calibration';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const signedPercent = (value: number | null) => value === null ? 'Unavailable' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
const signedPoints = (value: number, digits: 0 | 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)} pts`;
const horizonLabel = (days: 7 | 30) => days === 7 ? 'One week after similar scores' : 'One month after similar scores';
const evidenceLabel = (state: SimilarScoreOutcome['state']) => state === 'established'
    ? 'Established'
    : state === 'preliminary'
        ? 'Preliminary'
        : state === 'insufficient'
            ? 'Insufficient'
            : 'Unavailable';

const MetricComparisonV6 = ({ label, similar, baseline, difference, differenceDigits, theme }: {
    readonly label: string;
    readonly similar: string;
    readonly baseline: string;
    readonly difference: number;
    readonly differenceDigits: 0 | 1;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    return <div>
        <dt className={'text-[10px] font-semibold uppercase tracking-[0.06em] ' + styles.textMuted}>{label}</dt>
        <dd className="mt-2 grid grid-cols-3 gap-2">
            <span><span className={'block text-[9px] font-semibold uppercase ' + styles.textMuted}>Similar scores</span><span className={'mt-1 block font-mono text-base font-bold ' + styles.textPrimary}>{similar}</span></span>
            <span><span className={'block text-[9px] font-semibold uppercase ' + styles.textMuted}>All scores</span><span className={'mt-1 block font-mono text-base font-bold ' + styles.textPrimary}>{baseline}</span></span>
            <span><span className={'block text-[9px] font-semibold uppercase ' + styles.textMuted}>Difference</span><span className={'mt-1 block font-mono text-base font-bold ' + styles.textPrimary}>{signedPoints(difference, differenceDigits)}</span></span>
        </dd>
    </div>;
};

const OutcomeSummaryV6 = ({ outcome, theme, divided }: {
    readonly outcome: SimilarScoreOutcome;
    readonly theme: ResearchThemeV6;
    readonly divided: boolean;
}) => {
    const styles = getThemeV6(theme);
    const cohort = outcome.cohort;
    const baseline = outcome.baseline;
    const className = divided
        ? 'min-w-0 border-t pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 '
        : 'min-w-0 pb-5 lg:pb-0 lg:pr-6 ';

    return <article className={className + styles.divider} data-testid={`similar-score-outcome-${outcome.days}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className={'text-sm font-bold ' + styles.textPrimary}>{horizonLabel(outcome.days)}</h3>
            <span className={'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ' + styles.divider + ' ' + styles.textSecondary}>
                Evidence: {evidenceLabel(outcome.state)}
            </span>
        </div>

        {outcome.state === 'unavailable' || !cohort ? <div className="mt-4">
            <p className={'text-base font-bold ' + styles.textPrimary}>Historical outcomes unavailable</p>
            <p className={'mt-1 text-sm leading-6 ' + styles.textSecondary}>Comparable calibration data is missing or invalid for this horizon.</p>
        </div> : outcome.state === 'insufficient' ? <div className="mt-4">
            <p className={'text-base font-bold ' + styles.textPrimary}>Insufficient historical evidence</p>
            <p className={'mt-1 text-sm leading-6 ' + styles.textSecondary}>
                Only {cohort.sample_count} comparable {cohort.sample_count === 1 ? 'period is' : 'periods are'} available; {outcome.minimumSampleSize} are required before outcomes are summarized.
            </p>
            <p className={'mt-2 text-xs ' + styles.textMuted}>{cohort.observed_count} observed · {cohort.reconstructed_count} reconstructed</p>
        </div> : baseline ? <>
            <dl className="mt-4 space-y-5">
                <MetricComparisonV6
                    label="Median historical return"
                    similar={signedPercent(cohort.median_forward_return_pct)}
                    baseline={signedPercent(baseline.median_forward_return_pct)}
                    difference={(cohort.median_forward_return_pct ?? 0) - (baseline.median_forward_return_pct ?? 0)}
                    differenceDigits={1}
                    theme={theme}
                />
                <MetricComparisonV6
                    label="Positive historical periods"
                    similar={`${cohort.positive_return_rate_pct}%`}
                    baseline={`${baseline.positive_return_rate_pct}%`}
                    difference={(cohort.positive_return_rate_pct ?? 0) - (baseline.positive_return_rate_pct ?? 0)}
                    differenceDigits={0}
                    theme={theme}
                />
            </dl>
            <div className={'mt-5 grid gap-3 border-t pt-4 text-xs sm:grid-cols-2 ' + styles.divider}>
                <p className={styles.textSecondary}><strong className={styles.textPrimary}>{cohort.sample_count} similar-score periods</strong><br />{cohort.observed_count} observed · {cohort.reconstructed_count} reconstructed</p>
                <p className={styles.textSecondary}><strong className={styles.textPrimary}>{baseline.sample_count} all-score periods</strong><br />{baseline.observed_count} observed · {baseline.reconstructed_count} reconstructed</p>
            </div>
        </> : <div className="mt-4">
            <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className={'text-[10px] font-semibold uppercase tracking-[0.06em] ' + styles.textMuted}>Median historical return</dt><dd className={'mt-1 font-mono text-xl font-bold ' + styles.textPrimary}>{signedPercent(cohort.median_forward_return_pct)}</dd></div>
                <div><dt className={'text-[10px] font-semibold uppercase tracking-[0.06em] ' + styles.textMuted}>Positive comparable periods</dt><dd className={'mt-1 text-sm font-bold leading-6 ' + styles.textPrimary}>{cohort.positive_return_rate_pct}% of comparable periods were positive</dd></div>
            </dl>
            <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>The all-score baseline is unavailable for this horizon.</p>
        </div>}
    </article>;
};

export const SimilarScoreOutcomesV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const calibration = signal.metadata.historical_validation;
    const outcomes = selectSimilarScoreOutcomes(signal.composite_score, calibration);
    const includesReconstructedScores = outcomes.some((outcome) => (outcome.cohort?.reconstructed_count ?? 0) > 0);

    return <section data-testid="similar-score-outcomes" aria-labelledby="similar-score-outcomes-title" data-surface-tier="secondary" className={'rounded-lg border p-5 backdrop-blur-sm sm:p-6 ' + styles.panelSecondary}>
        <div>
            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Historical outcomes</p>
            <h2 id="similar-score-outcomes-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Historical forward outcomes</h2>
            <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>Historical outcomes after comparable scores, measured against all eligible score snapshots. This is not a prediction of the next market move.</p>
        </div>

        <div className={'mt-5 grid lg:grid-cols-2 ' + styles.divider}>
            {outcomes.map((outcome, index) => <OutcomeSummaryV6
                key={outcome.days}
                outcome={outcome}
                theme={theme}
                divided={index > 0}
            />)}
        </div>

        <p className={'mt-5 border-t pt-4 text-xs leading-5 ' + styles.divider + ' ' + styles.textMuted}>“All scores” uses every eligible score snapshot from the same market, mode, source setting, benchmark window, and horizon. Differences are descriptive and do not establish predictive edge.</p>
        <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Historical forward returns are overlapping observations and exclude transaction costs.</p>
        {includesReconstructedScores ? <p className={'mt-1 text-xs leading-5 ' + styles.textMuted}>Some comparable scores were reconstructed. Historical calibration below explains their coverage and limitations.</p> : null}
        <a href="#historical-calibration" className={'mt-3 inline-flex min-h-10 items-center text-sm font-semibold underline underline-offset-4 ' + styles.positive}>View historical validation</a>
    </section>;
};
