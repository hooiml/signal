import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { fullDate, indicatorStatus } from './MarketV8ConnectedData';
import styles from './market-v8-coverage.module.css';

export const overallReadingText = (text: string) => text
    .replace(/majority (BUY|SELL|NEUTRAL) read/g, 'overall $1 reading')
    .replace(/component majority/g, 'overall reading');

export function missingInputExplanation(key: string, sourceEnabled: boolean) {
    if ((key === 'social' || key === 'news') && !sourceEnabled) return 'This input is switched off. Turn it on in the market controls to request current evidence.';
    if (key === 'social') return 'Social input is enabled, but the current response contains no usable sentiment observation. A missing reading is not neutral sentiment.';
    if (key === 'news') return 'News input is enabled, but the current response contains no usable news sentiment observation.';
    if (key === 'naaim') return 'No current manager-exposure observation was returned. Archived readings cannot establish today’s exposure.';
    if (key === 'bofa') return 'No current BofA SSI observation was supplied from the stored institutional inputs.';
    return 'No current observation was supplied. An archived reading is not substituted for the missing value.';
}

export function MarketCoverageNotices({ signal, inputKeys, date, sourceEnabled, onReview }: {
    signal: MarketSignal; inputKeys: string[]; date: string; sourceEnabled: boolean; onReview: () => void;
}) {
    const components = Object.entries(signal.components);
    const stale = components.filter(([key]) => indicatorStatus(signal, key, date).startsWith('Stale'));
    const missing = inputKeys.filter(key => !signal.components[key] && !((key === 'social' || key === 'news') && !sourceEnabled));
    const knownStaleWarnings = new Set(stale.map(([, item]) => `${item.display_name} data is stale (${item.last_updated}).`));
    const warnings = signal.metadata.signal_quality?.warnings ?? [];
    const isDisagreement = (text: string) => /not align with the majority (BUY|SELL|NEUTRAL) read|component majority/.test(text);
    const quality = warnings.filter(text => !knownStaleWarnings.has(text) && !isDisagreement(text));
    const disagreement = warnings.filter(isDisagreement).map(overallReadingText);
    const coverage = signal.metadata.coverage_adjustment;
    const conflicts = signal.confidence.conflicting_indicators;
    if (!disagreement.length && conflicts.length) {
        const names = conflicts.map(key => signal.components[key]?.display_name ?? getIndicatorDisplayName(key));
        disagreement.push(`${names.join(', ')} ${names.length === 1 ? 'does' : 'do'} not align with the overall ${signal.confidence.majority_signal} reading.`);
    }
    return <div className={styles.notices}>
        {(stale.length > 0 || missing.length > 0 || quality.length > 0) && <section className={styles.quality} aria-label="Data needs attention">
            <div className={styles.heading}><h2>Data needs attention</h2><button onClick={onReview}>Review source coverage ↗</button></div>
            <p>{quality.length > 0 ? `${quality[0]} ` : ''}{stale.length} stale {stale.length === 1 ? 'input' : 'inputs'} · {missing.length} unavailable.{coverage && coverage.missing_weight > 0 ? ` ${(coverage.missing_weight * 100).toFixed(0)}% of configured weight uses a neutral reserve, not observed evidence.` : ''}</p>
            <details><summary>Source-quality details</summary>
            <ul>
                {stale.map(([key, item]) => <li key={key}><b>{item.display_name}: stale observation.</b> Dated {fullDate(item.last_updated)} · still included in the score.</li>)}
                {missing.length > 0 && <li><b>Current values unavailable:</b> {missing.map(getIndicatorDisplayName).join(', ')}.</li>}
                {quality.map(text => <li key={text}>{text}</li>)}
            </ul>
            {coverage && coverage.missing_weight > 0 && <p>{(coverage.missing_weight * 100).toFixed(0)}% of configured weight uses the service’s neutral baseline ({coverage.neutral_points.toFixed(2)} points). This is missing-input accounting, not observed neutral evidence.</p>}
            </details>
        </section>}
        {disagreement.length > 0 && <section className={styles.alignment} aria-label="Indicator disagreement">
            <h2>Indicator disagreement</h2>{disagreement.map(text => <p key={text}>{text}</p>)}
            <details><summary>How disagreement is assessed</summary><small>Alignment compares indicators with the weighted composite classification. It does not count a majority vote or measure forecast accuracy.</small></details>
        </section>}
    </div>;
}
