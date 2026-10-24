import { selectSimilarScoreOutcomes, type SimilarScoreOutcome } from '@/lib/market-calibration';
import type { MarketSignal } from '@/lib/types/signal-v2';
import styles from './market-v8-outcomes.module.css';

const percent = (value: number | null) => value === null ? 'Unavailable' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`;
const points = (value: number, digits: 0 | 1) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)} pts`;
const tone = (value: number | null) => value === null ? 'flat' : value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
const evidence: Record<SimilarScoreOutcome['state'], string> = { established: 'Established', preliminary: 'Preliminary', insufficient: 'Insufficient', unavailable: 'Unavailable' };

function Horizon({ outcome }: { outcome: SimilarScoreOutcome }) {
    const { cohort, baseline } = outcome;
    return <article data-testid={`similar-score-outcome-${outcome.days}`}>
        <header><h3>{outcome.days === 7 ? 'One week later' : 'One month later'}</h3><span className={styles.tag} data-state={outcome.state}>Evidence: {evidence[outcome.state]}</span></header>
        {outcome.state === 'unavailable' || !cohort ? <p>Comparable calibration data is missing for this horizon.</p>
            : outcome.state === 'insufficient' ? <p>Only {cohort.sample_count} comparable {cohort.sample_count === 1 ? 'period is' : 'periods are'} available; {outcome.minimumSampleSize} are needed before outcomes are summarised.</p>
                : <>
                    <dl>
                        <div><dt>Median return</dt><dd data-direction={tone(cohort.median_forward_return_pct)}>{percent(cohort.median_forward_return_pct)}</dd>{baseline && <small>all scores {percent(baseline.median_forward_return_pct)} · {points((cohort.median_forward_return_pct ?? 0) - (baseline.median_forward_return_pct ?? 0), 1)}</small>}</div>
                        <div><dt>Positive periods</dt><dd>{cohort.positive_return_rate_pct ?? '—'}%</dd>{baseline && <small>all scores {baseline.positive_return_rate_pct ?? '—'}% · {points((cohort.positive_return_rate_pct ?? 0) - (baseline.positive_return_rate_pct ?? 0), 0)}</small>}</div>
                    </dl>
                    <p className={styles.meta}>{cohort.sample_count} similar-score periods ({cohort.observed_count} observed · {cohort.reconstructed_count} reconstructed){baseline ? ` vs ${baseline.sample_count} all-score periods` : ' · all-score baseline unavailable'}</p>
                </>}
    </article>;
}

// What the benchmark did after past readings close to today's score, against every eligible reading.
export function MarketV8Outcomes({ signal, onHistory }: { signal: MarketSignal; onHistory: () => void }) {
    const calibration = signal.metadata.historical_validation;
    if (!calibration) return null;
    const outcomes = selectSimilarScoreOutcomes(signal.composite_score, calibration);
    return <section className={styles.card} aria-labelledby="market-outcomes-title" data-testid="similar-score-outcomes">
        <div className={styles.heading}>
            <div><span className={styles.eyebrow}>Historical outcomes</span><h2 id="market-outcomes-title">After scores like today’s {signal.composite_score}</h2></div>
            <button className={styles.link} onClick={onHistory}>Full historical calibration →</button>
        </div>
        <p className={styles.meta}>{calibration.benchmark_name} returns after comparable past scores, compared with all eligible scores. Overlapping observations, before costs. Descriptive history, not a prediction of the next move.</p>
        <div className={styles.horizons}>{outcomes.map(outcome => <Horizon key={outcome.days} outcome={outcome} />)}</div>
    </section>;
}
