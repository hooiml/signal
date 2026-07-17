import type { MarketSignal } from '@/lib/types/signal-v2';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

const currentZone = (score: number) => score <= 39 ? 'negative' : score <= 64 ? 'mixed' : score <= 84 ? 'positive' : 'strong-positive';

export const MarketCalibrationV6 = ({ signal, theme }: {
    readonly signal: MarketSignal;
    readonly theme: ResearchThemeV6;
}) => {
    const calibration = signal.metadata.historical_validation;
    if (!calibration) return null;
    const styles = getThemeV6(theme);
    const activeZone = currentZone(signal.composite_score);
    const activeZoneStyle = theme === 'light'
        ? 'rounded-md border border-emerald-200 bg-emerald-50/80 shadow-[inset_3px_0_0_#059669]'
        : 'rounded-md border border-emerald-400/25 bg-emerald-400/8 shadow-[inset_3px_0_0_#6ee7b7]';
    return <section data-testid="market-calibration" aria-labelledby="market-calibration-title" className={'rounded-lg border p-5 backdrop-blur-md sm:p-6 ' + styles.panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
                <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + styles.positive}>Historical calibration</p>
                <h2 id="market-calibration-title" className={'mt-1 text-xl font-bold ' + styles.textPrimary}>What followed earlier score zones</h2>
                <p className={'mt-2 max-w-3xl text-sm leading-6 ' + styles.textSecondary}>{calibration.benchmark_name} forward returns, evaluated separately for {calibration.mode === 'standard' ? 'Momentum' : 'Contrarian'} snapshots.</p>
            </div>
            <p className={'text-xs ' + styles.textMuted}>{calibration.snapshot_count} saved snapshot{calibration.snapshot_count === 1 ? '' : 's'} · minimum {calibration.minimum_sample_size} per zone</p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {calibration.horizons.map((horizon) => <section key={horizon.days} className={'rounded border p-4 ' + styles.row} aria-label={`${horizon.days}-day calibration`}>
                <h3 className={'text-sm font-bold ' + styles.textPrimary}>{horizon.days === 7 ? 'One week later' : 'One month later'}</h3>
                <div className="mt-3 space-y-1">
                    {horizon.cohorts.map((cohort) => {
                        const ready = cohort.sample_count >= calibration.minimum_sample_size;
                        const isActive = cohort.zone === activeZone;
                        return <div key={cohort.zone} className={'grid grid-cols-[72px_minmax(0,1fr)] gap-3 px-3 py-3 sm:grid-cols-[72px_1fr_1fr] ' + (isActive ? activeZoneStyle : `border-b last:border-b-0 ${styles.divider}`)}>
                            <div><p className={'font-mono text-xs font-bold ' + styles.textPrimary}>{cohort.label}</p><p className={'mt-1 text-[10px] ' + styles.textMuted}>n={cohort.sample_count}</p></div>
                            {ready ? <>
                                <div><p className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Average return</p><p className={'mt-1 font-mono text-sm font-bold ' + ((cohort.average_forward_return_pct ?? 0) >= 0 ? styles.positive : styles.risk)}>{cohort.average_forward_return_pct !== null && cohort.average_forward_return_pct > 0 ? '+' : ''}{cohort.average_forward_return_pct?.toFixed(1) ?? '—'}%</p></div>
                                <div><p className={'text-[10px] font-semibold uppercase ' + styles.textMuted}>Direction aligned</p><p className={'mt-1 font-mono text-sm font-bold ' + styles.textPrimary}>{cohort.alignment_rate_pct === null ? 'Not applicable' : `${cohort.alignment_rate_pct}%`}</p></div>
                            </> : <p className={'self-center text-xs leading-5 sm:col-span-2 ' + styles.textMuted}>Collecting · {cohort.sample_count}/{calibration.minimum_sample_size} eligible observations</p>}
                        </div>;
                    })}
                </div>
            </section>)}
        </div>
        <p className={'mt-4 text-xs leading-5 ' + styles.textMuted}>{calibration.limitation}</p>
    </section>;
};
