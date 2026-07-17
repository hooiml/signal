import type { ResearchBenchmark, ResearchBenchmarkStatus } from '@/lib/types/research-snapshot';
import { getThemeV6, type ResearchThemeClassesV6, type ResearchThemeV6 } from './research-v6';

const statusLabels: Record<ResearchBenchmarkStatus, string> = {
    outperformed: 'Outperformed the S&P 500',
    lagged: 'Underperformed the S&P 500',
    'in-line': 'In line with the S&P 500',
    unavailable: 'Market comparison unavailable',
    'not-applicable': 'Market comparison not applicable',
};

const statusTone = (status: ResearchBenchmarkStatus, styles: ResearchThemeClassesV6) => {
    if (status === 'outperformed') return styles.positive;
    if (status === 'lagged' || status === 'unavailable') return styles.risk;
    return styles.textSecondary;
};

const formatReturn = (value: number | null) => value === null ? 'Unavailable' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

export const ResearchBenchmarkV6 = ({ benchmark, theme }: { readonly benchmark: ResearchBenchmark; readonly theme: ResearchThemeV6 }) => {
    if (benchmark.status === 'not-applicable') return null;
    const styles = getThemeV6(theme);
    const tone = statusTone(benchmark.status, styles);
    const basis = benchmark.returnBasis === 'adjusted close' ? 'Adjusted-close return basis.'
        : benchmark.returnBasis === 'close' ? 'Price return basis; adjusted history was unavailable.'
            : 'Return comparison is unavailable.';

    return (
        <section data-testid="index-test" data-surface-tier="utility" className={'rounded-lg border px-5 py-4 backdrop-blur-sm transition-colors duration-300 ' + styles.panelUtility} aria-labelledby="index-test-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className={'text-[10px] font-semibold uppercase tracking-[0.12em] ' + styles.positive}>Market comparison</p>
                    <h2 id="index-test-title" className={'mt-1 text-sm font-semibold ' + styles.textSecondary}>How did this company perform versus the S&amp;P 500?</h2>
                </div>
                <span className={'rounded-full border px-2 py-1 text-[11px] font-semibold ' + tone}>{statusLabels[benchmark.status]}</span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 min-[700px]:grid-cols-3">
                <div>
                    <dt className={'text-[11px] ' + styles.textMuted}>Candidate return</dt>
                    <dd className={'mt-1 font-mono text-sm font-bold tabular-nums ' + styles.textPrimary}>{formatReturn(benchmark.candidateReturnPercent)}</dd>
                </div>
                <div>
                    <dt className={'text-[11px] ' + styles.textMuted}>S&amp;P 500 return (VOO)</dt>
                    <dd className={'mt-1 font-mono text-sm font-bold tabular-nums ' + styles.textPrimary}>{formatReturn(benchmark.baselineReturnPercent)}</dd>
                </div>
                <div>
                    <dt className={'text-[11px] ' + styles.textMuted}>Difference vs market</dt>
                    <dd className={'mt-1 font-mono text-sm font-bold tabular-nums ' + tone}>{formatReturn(benchmark.relativeReturnPercent)}</dd>
                </div>
            </dl>
            <p className={'mt-3 text-[11px] leading-5 ' + styles.textMuted}>{benchmark.baselineName} · {benchmark.period} · {basis} This is evidence for review, not a recommendation.</p>
        </section>
    );
};
