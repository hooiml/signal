import type { MarketSignal } from '@/lib/types/signal-v2';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const signedPercent = (value: number | null) => value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

export const MarketCalibrationV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const calibration = signal.metadata.historical_validation;
    if (!calibration) return null;
    const styles = getThemeV6(theme);

    return <section data-testid="market-calibration" aria-labelledby="market-calibration-title" data-surface-tier="secondary" className={'rounded-lg border p-5 backdrop-blur-sm sm:p-6 ' + styles.panelSecondary}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Historical calibration</p>
                <h2 id="market-calibration-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>Compare historical score zones</h2>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>{calibration.benchmark_name} forward returns across {calibration.mode === 'standard' ? 'Momentum' : 'Contrarian'} score zones.</p>
            </div>
            <p className={'text-xs ' + styles.textMuted}>{calibration.snapshot_count} total scores · {calibration.observed_snapshot_count} observed · {calibration.reconstructed_snapshot_count} reconstructed</p>
        </div>

        <details className={'mt-5 rounded-md border ' + styles.divider} data-testid="all-zone-calibration">
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
