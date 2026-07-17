import type { MarketSignal } from '@/lib/types/signal-v2';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type Calibration = NonNullable<MarketSignal['metadata']['historical_validation']>;
type Cohort = Calibration['horizons'][number]['cohorts'][number];

const currentZone = (score: number): Cohort['zone'] => score <= 39 ? 'negative' : score <= 64 ? 'mixed' : score <= 84 ? 'positive' : 'strong-positive';

const zoneMeaning = (zone: Cohort['zone'], mode: Calibration['mode']) => {
    if (zone === 'mixed') return 'Mixed market backdrop';
    if (mode === 'contrarian') {
        if (zone === 'negative') return 'Fear or opportunity backdrop';
        if (zone === 'positive') return 'Cautionary crowding backdrop';
        return 'Extreme crowding-risk backdrop';
    }
    if (zone === 'negative') return 'Negative momentum backdrop';
    if (zone === 'positive') return 'Positive momentum backdrop';
    return 'Strong positive momentum backdrop';
};

const signedPercent = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

const evidenceLabel = (cohort: Cohort) => cohort.evidence_level === 'established'
    ? 'Established sample'
    : cohort.evidence_level === 'preliminary'
        ? 'Preliminary sample'
        : 'Insufficient history';

const HistoricalOutcomeV6 = ({ days, cohort, minimum, theme }: {
    readonly days: 7 | 30;
    readonly cohort: Cohort;
    readonly minimum: number;
    readonly theme: ResearchThemeV6;
}) => {
    const styles = getThemeV6(theme);
    const ready = cohort.sample_count >= minimum;
    return <article className={'rounded-md border p-4 ' + styles.row} data-testid={`current-zone-${days}-day`}>
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>{days === 7 ? 'One week later' : 'One month later'}</p>
                <p className={'mt-1 text-xs ' + styles.textMuted}>{evidenceLabel(cohort)} · n={cohort.sample_count}</p>
            </div>
            <span className={'rounded-full border px-2 py-1 text-[10px] font-semibold ' + styles.divider + ' ' + styles.textSecondary}>{cohort.observed_count} observed · {cohort.reconstructed_count} reconstructed</span>
        </div>
        {ready ? <dl className="mt-4 grid grid-cols-2 gap-4">
            <div><dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Median return</dt><dd className={'mt-1 font-mono text-lg font-bold ' + ((cohort.median_forward_return_pct ?? 0) >= 0 ? styles.positive : styles.risk)}>{signedPercent(cohort.median_forward_return_pct)}</dd></div>
            <div><dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Positive periods</dt><dd className={'mt-1 font-mono text-lg font-bold ' + styles.textPrimary}>{cohort.positive_return_rate_pct ?? '—'}%</dd></div>
            <div className="col-span-2"><dt className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Observed range</dt><dd className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{signedPercent(cohort.worst_forward_return_pct)} to {signedPercent(cohort.best_forward_return_pct)}</dd></div>
        </dl> : <p className={'mt-5 text-sm leading-6 ' + styles.textSecondary}>Collecting comparable outcomes · {cohort.sample_count}/{minimum} required before returns are shown.</p>}
    </article>;
};

export const MarketCalibrationV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const calibration = signal.metadata.historical_validation;
    if (!calibration) return null;
    const styles = getThemeV6(theme);
    const activeZone = currentZone(signal.composite_score);
    const activeCohorts = calibration.horizons.map((horizon) => ({
        days: horizon.days,
        cohort: horizon.cohorts.find((cohort) => cohort.zone === activeZone),
    })).filter((item): item is { days: 7 | 30; cohort: Cohort } => Boolean(item.cohort));
    const hasEstablishedDirection = activeCohorts.some(({ cohort }) => cohort.evidence_level === 'established');
    const hasDisplayableHistory = activeCohorts.some(({ cohort }) => cohort.sample_count >= calibration.minimum_sample_size);
    const readLabel = hasEstablishedDirection
        ? 'Historical pattern available'
        : hasDisplayableHistory
            ? 'Preliminary history — no established edge'
            : 'Historical edge not established';

    return <section data-testid="market-calibration" aria-labelledby="market-calibration-title" data-surface-tier="secondary" className={'rounded-lg border p-5 backdrop-blur-sm sm:p-6 ' + styles.panelSecondary}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Historical calibration</p>
                <h2 id="market-calibration-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>What followed similar scores</h2>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>{calibration.benchmark_name} forward returns for comparable {calibration.mode === 'standard' ? 'Momentum' : 'Contrarian'} score zones.</p>
            </div>
            <p className={'text-xs ' + styles.textMuted}>{calibration.snapshot_count} total scores · {calibration.observed_snapshot_count} observed · {calibration.reconstructed_snapshot_count} reconstructed</p>
        </div>

        <div className={'mt-5 rounded-lg border p-4 sm:p-5 ' + styles.row} data-testid="current-score-historical-read">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + styles.textMuted}>Current score meaning</p>
                    <h3 className={'mt-1 text-2xl font-bold ' + styles.textPrimary}>{Math.round(signal.composite_score)} / 100 · {zoneMeaning(activeZone, calibration.mode)}</h3>
                </div>
                <p className={'rounded-full border px-3 py-1.5 text-xs font-semibold ' + styles.divider + ' ' + (hasEstablishedDirection ? styles.positive : styles.textSecondary)}>{readLabel}</p>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {activeCohorts.map(({ days, cohort }) => <HistoricalOutcomeV6 key={days} days={days} cohort={cohort} minimum={calibration.minimum_sample_size} theme={theme} />)}
            </div>
            <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>“Positive periods” means the benchmark finished above its starting level. It is historical frequency, not the probability of the next move.</p>
        </div>

        <details className={'mt-4 rounded-md border ' + styles.divider} data-testid="all-zone-calibration">
            <summary className={'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:content-none ' + styles.textPrimary}>Compare all score zones<span aria-hidden="true" className={styles.textMuted}>+</span></summary>
            <div className={'border-t p-4 ' + styles.divider}>
                <div className="grid gap-4 lg:grid-cols-2">
                    {calibration.horizons.map((horizon) => <section key={horizon.days} className={'rounded border p-4 ' + styles.row} aria-label={`${horizon.days}-day calibration`}>
                        <h3 className={'text-sm font-bold ' + styles.textPrimary}>{horizon.days === 7 ? 'One week later' : 'One month later'}</h3>
                        <div className="mt-3 space-y-1">
                            {horizon.cohorts.map((cohort) => <div key={cohort.zone} className={'grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b px-2 py-3 last:border-b-0 sm:grid-cols-[72px_1fr_1fr] ' + styles.divider}>
                                <div><p className={'font-mono text-xs font-bold ' + styles.textPrimary}>{cohort.label}</p><p className={'mt-1 text-[10px] ' + styles.textMuted}>n={cohort.sample_count}</p></div>
                                {cohort.sample_count >= calibration.minimum_sample_size ? <>
                                    <div><p className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Median return</p><p className={'mt-1 font-mono text-sm font-bold ' + ((cohort.median_forward_return_pct ?? 0) >= 0 ? styles.positive : styles.risk)}>{signedPercent(cohort.median_forward_return_pct)}</p></div>
                                    <div><p className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Positive periods</p><p className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{cohort.positive_return_rate_pct ?? '—'}%</p></div>
                                </> : <p className={'self-center text-xs leading-5 sm:col-span-2 ' + styles.textMuted}>Collecting · {cohort.sample_count}/{calibration.minimum_sample_size}</p>}
                            </div>)}
                        </div>
                    </section>)}
                </div>
            </div>
        </details>

        {calibration.reconstruction_note ? <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}><strong>Reconstruction coverage:</strong> {calibration.reconstruction_note}</p> : null}
        <p className={'mt-2 text-xs leading-5 ' + styles.textMuted}>{calibration.limitation}</p>
    </section>;
};
