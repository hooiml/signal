import type { MarketSignal } from '@/lib/types/signal-v2';
import { signed } from './market-v8-fixtures';
import base from './market-v8.module.css';
import styles from './market-v8-connected.module.css';
import { MarketMobileSection } from './MarketMobileSection';

const INDEX_NAMES: Record<string, string> = {
    '^GSPC': 'S&P 500', '^IXIC': 'Nasdaq Composite', '^DJI': 'Dow Jones', '^RUT': 'Russell 2000',
    '^NDX': 'Nasdaq 100', '^VIX': 'VIX', '^KLSE': 'FBM KLCI', '^FTFBM100': 'FBM 100',
};
export const indexName = (symbol: string) => INDEX_NAMES[symbol.toUpperCase()] ?? symbol.replace(/^\^/, '');

/** Wider-market context shown beside the score: names each tracked index and its latest move. Separate from the score. */
export function MarketContextSummary({ signal, onExplore }: { signal: MarketSignal; onExplore: () => void }) {
    const indices = (signal.metadata.index_trend ?? []).filter(index => Number.isFinite(index.changePercent));
    const note = signal.metadata.interpretation_context?.breadth_note ?? 'Review dated benchmark, rates and valuation records alongside the scored inputs.';
    const benchmark = indices.find(index => index.symbol === (signal.metadata.market === 'MY' ? '^KLSE' : '^GSPC')) ?? indices[0];
    const down = indices.filter(index => index.changePercent < 0).length;
    const up = indices.filter(index => index.changePercent > 0).length;
    const summary = benchmark ? `${indexName(benchmark.symbol)} ${signed(benchmark.changePercent)}% · ${down}/${indices.length} down, ${up}/${indices.length} up` : 'Index moves unavailable';
    return <MarketMobileSection name="context" title="Market context" summary={summary} className={styles.contextCard}>
        <span className={base.eyebrow}>Market context · separate from the score</span>
        <h3>Check the wider market</h3>
        {indices.length > 0 ? <ul className={styles.indexList}>
            {indices.map(index => <li key={index.symbol} data-trend={index.changePercent > 0 ? 'positive' : index.changePercent < 0 ? 'negative' : 'flat'}>
                <span>{indexName(index.symbol)}</span><b>{signed(index.changePercent)}%</b>
            </li>)}
        </ul> : null}
        <p>{note}</p>
        <button type="button" className={base.textButton} onClick={onExplore}>Explore market context →</button>
    </MarketMobileSection>;
}
