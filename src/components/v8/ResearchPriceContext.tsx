import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import styles from './research-price-context.module.css';

const finite = (value: number | null | undefined): value is number => typeof value === 'number' && Number.isFinite(value);
const price = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = (value: number) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

/** Distance of the latest price from a moving average, e.g. "4.2% above". */
export function distanceLabel(current: number | null | undefined, average: number | null | undefined): string | null {
    if (!finite(current) || !finite(average) || average === 0) return null;
    const change = (current - average) / average * 100;
    if (Math.abs(change) < 0.05) return 'at the average';
    return `${Math.abs(change).toFixed(1)}% ${change > 0 ? 'above' : 'below'}`;
}

/** Position of the latest price inside its 52-week range, 0–100. */
export function rangePosition(current: number | null | undefined, low: number | null | undefined, high: number | null | undefined): number | null {
    if (!finite(current) || !finite(low) || !finite(high) || high <= low) return null;
    return Math.min(100, Math.max(0, (current - low) / (high - low) * 100));
}

export function rsiLabel(value: number | null | undefined): string | null {
    if (!finite(value)) return null;
    return value >= 70 ? 'Overbought zone (70+)' : value <= 30 ? 'Oversold zone (30 or less)' : 'Neutral range (30–70)';
}

/** Price-derived context the provider already returns; descriptive, not a trading signal. */
export function ResearchPriceContext({ snapshot }: { snapshot: ResearchSnapshot | null }) {
    if (!snapshot) return null;
    const { technicals: t, quote } = snapshot;
    const position = rangePosition(quote.price, t.low52Week, t.high52Week);
    const ma50 = distanceLabel(quote.price, t.ma50);
    const ma200 = distanceLabel(quote.price, t.ma200);
    const rsi = rsiLabel(t.rsi14);
    const items = [
        finite(t.low52Week) && finite(t.high52Week) ? { key: 'range', label: '52-week range', value: `${price(t.low52Week)} – ${price(t.high52Week)}`, note: position === null ? null : `${position.toFixed(0)}% of the way from low to high`, bar: position } : null,
        finite(t.ma50) ? { key: 'ma50', label: '50-day average', value: price(t.ma50), note: ma50 && `Price ${ma50}` } : null,
        finite(t.ma200) ? { key: 'ma200', label: '200-day average', value: price(t.ma200), note: ma200 && `Price ${ma200}` } : null,
        finite(t.rsi14) ? { key: 'rsi', label: 'RSI (14-day)', value: t.rsi14.toFixed(1), note: rsi } : null,
        finite(t.averageVolume20) ? { key: 'volume', label: 'Avg volume (20-day)', value: compact(t.averageVolume20), note: 'Shares per session' } : null,
    ].filter(item => item !== null);
    if (!items.length) return null;
    return <section className={styles.context} aria-label="Price context" data-testid="research-price-context">
        <dl className={styles.grid}>
            {items.map(item => <div key={item.key} className={styles.item}>
                <dt>{item.label}</dt>
                <dd><b>{item.value}</b>{'bar' in item && item.bar !== null && item.bar !== undefined && <span className={styles.range} aria-hidden="true"><span style={{ left: `${item.bar}%` }} /></span>}{item.note && <small>{item.note}</small>}</dd>
            </div>)}
        </dl>
        <p className={styles.note}>Calculated from {quote.currency || 'provider'} daily closes. Descriptive price context, not a trading signal.</p>
    </section>;
}
