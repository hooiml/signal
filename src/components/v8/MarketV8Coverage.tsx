import { getIndicatorDisplayName } from '@/lib/indicator-registry';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { fullDate, indicatorStatus } from './MarketV8ConnectedData';
import styles from './market-v8-coverage.module.css';

export function MarketLeadingEvidence({ signal, date, onSelect }: {
    signal: MarketSignal; date: string; onSelect: (key: string, element: HTMLButtonElement) => void;
}) {
    const conflicts = signal.confidence.conflicting_indicators;
    const entries = Object.entries(signal.components).filter(([, item]) => item.enabled && item.weight > 0).sort(([, a], [, b]) => b.weight - a.weight);
    const disagrees = ([key, item]: typeof entries[number]) => conflicts.includes(key) || conflicts.includes(item.display_name);
    const aligned = entries.find(entry => !disagrees(entry));
    const conflicting = entries.find(disagrees);
    return <div className={styles.leadingEvidence} role="group" aria-label="Leading evidence">
        {([[aligned, 'Leading support'], [conflicting, 'Leading conflict']] as const).map(([entry, label]) => <div key={label}>
            {entry ? <button onClick={event => onSelect(entry[0], event.currentTarget)}>
                <span><i className={styles.indicatorMarker} data-indicator={entry[0]} aria-hidden="true" /><b>{label}:</b> {entry[1].display_name} <span aria-hidden="true">↗</span></span>
                <small>Indicator category: {marketReadingLabel(entry[1].signal)} · overall: {marketReadingLabel(signal.tier)}</small>
                {/* Fresh inputs keep their dates in the evidence list; only exceptions surface here. */}
                {indicatorStatus(signal, entry[0], date) !== 'Included' && <small>{indicatorStatus(signal, entry[0], date)} · {entry[1].metadata?.timestamp_basis === 'observed' ? 'Observed' : entry[1].metadata?.timestamp_basis === 'retrieved' ? 'Retrieved' : 'Recorded'} {marketTimestampLabel(entry[1].last_updated)}</small>}
            </button> : <p><b>{label}:</b> {label === 'Leading support' ? 'No aligned included input identified.' : conflicts.length ? 'Reported conflict has no matching included observation.' : 'No conflicting included input identified; missing evidence can still limit this reading.'}</p>}
        </div>)}
        <details className={styles.leadingNote}><summary>What support and conflict mean</summary><p>Categories follow the selected mode. A conflict means a different indicator category, not necessarily a negative reading. Leading inputs are selected by weight; alignment is agreement, not forecast accuracy.</p></details>
    </div>;
}

export function MarketCurrentAssessment({ signal, date, onSelect, showLeadingEvidence = true }: {
    signal: MarketSignal; date: string; onSelect: (key: string, element: HTMLButtonElement) => void; showLeadingEvidence?: boolean;
}) {
    const delta = signal.metadata.score_delta;
    const compared = delta?.delta != null && !!delta.previous_date;
    return <section className={styles.assessment} aria-label="Current market assessment">
        <h2>What this reading means</h2>
        <p>The score describes the configured market indicators on a 0–100 scale. {signal.mode === 'contrarian'
            ? 'In Contrarian mode, higher scores indicate crowding or greed risk; lower scores indicate fear and potential opportunity.'
            : 'In Momentum mode, higher scores support positive momentum; lower scores indicate weaker momentum and a more cautious reading.'} It is not a return estimate or a probability of gains.</p>
        <p className={styles.change} data-testid="market-comparison">{compared ? delta.delta === 0 ? `Score unchanged vs ${fullDate(delta.previous_date)}. Individual inputs can still differ.` : `Score ${delta.delta! > 0 ? 'rose' : 'fell'} ${Math.abs(delta.delta!).toFixed(2)} points vs ${fullDate(delta.previous_date)}. This compares scores, not investment returns.` : 'No earlier comparable score supplied. A change cannot be established.'}</p>
        {showLeadingEvidence && <MarketLeadingEvidence signal={signal} date={date} onSelect={onSelect} />}
        <p><strong>Reading limits:</strong> {signal.metadata.interpretation_context?.limitation ?? 'Indicator agreement is descriptive and does not establish forecast accuracy.'} Source gaps and older observations remain part of the coverage notices.</p>
    </section>;
}

export const overallReadingText = (text: string) => text
    .replace(/majority (BUY|SELL|NEUTRAL) read/g, 'overall $1 reading')
    .replace(/component majority/g, 'overall reading');

type SourceAvailability = NonNullable<MarketSignal['metadata']['source_availability']>;

export function missingInputExplanation(key: string, sourceEnabled: boolean, availability?: SourceAvailability) {
    if ((key === 'social' || key === 'news') && !sourceEnabled) return 'This input is switched off. Turn it on in the market controls to request current evidence.';
    if (key === 'social') {
        const sources = availability ? [
            availability.reddit && `Reddit: ${availability.reddit.status === 'unconfigured' ? 'OAuth is not configured' : availability.reddit.status === 'no-results' ? 'no posts returned' : `${availability.reddit.count} posts returned`}`,
            availability.stocktwits && `StockTwits: ${availability.stocktwits.status === 'disabled' ? 'disabled by configuration' : availability.stocktwits.status === 'no-results' ? 'no messages returned' : `${availability.stocktwits.count} messages returned`}`,
        ].filter((value): value is string => !!value) : [];
        return `${sources.length ? `${sources.join('; ')}. ` : ''}Social input is enabled, but the current response contains no usable sentiment observation. A missing reading is not neutral sentiment.`;
    }
    if (key === 'news') return availability?.news
        ? `News input is enabled, but no usable news sentiment observation was produced. ${availability.news.count} news items were returned.${availability.news.status === 'no-fresh-evidence' ? ' None of the returned news or Reddit posts has a valid publication time within the 24-hour evidence window. Stale, future-dated and undated items do not count as current evidence.' : ''}`
        : 'News input is enabled, but the current response contains no usable news sentiment observation.';
    if (key === 'naaim') return 'The public page exposes a roughly three-month delayed reading, and no parsable current exposure was returned for this snapshot. Archived readings cannot establish today’s exposure.';
    if (key === 'bofa') return 'No manually supplied current SSI reading is available. The 50–60 normalization range is a placeholder, not evidence from a live source.';
    return 'No current observation was supplied. An archived reading is not substituted for the missing value.';
}

export function newsEvidenceText(evidence: NonNullable<MarketSignal['metadata']['news_evidence']>): string {
    const publicationRange = evidence.dated_count > 0
        ? `newest ${marketTimestampLabel(evidence.newest_published_at!)} · oldest ${marketTimestampLabel(evidence.oldest_published_at!)}`
        : 'publication dates unavailable';
    const window = evidence.evaluated_at ? `the evidence check at ${marketTimestampLabel(evidence.evaluated_at)}` : 'an unavailable evidence-check time';
    const eligibility = evidence.eligible_count === undefined ? ' Eligibility count unavailable.' : ` ${evidence.eligible_count} eligible dated news item${evidence.eligible_count === 1 ? '' : 's'}; stale, future-dated and unknown-date items are excluded from the current reading.`;
    return `${evidence.count} news items returned · ${evidence.dated_count} with publication dates · ${evidence.unknown_date_count} unknown dates · ${evidence.within_24h_count} dated within 24h of ${window} · ${publicationRange}.${eligibility}`;
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
