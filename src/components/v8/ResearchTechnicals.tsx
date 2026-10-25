'use client';

import { useEffect, useState } from 'react';
import { ResearchChartV6 } from '@/components/v6/ResearchChartV6';
import { parseResearchChartResponse } from '@/lib/research/snapshot-input';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { readData, readPolicies } from './read-data';
import { MetricGlossary } from './MetricGlossary';
import styles from './research-technicals.module.css';

type Chart = ResearchSnapshot['chart'];
type ChartRead = { chart: Chart | null; state: 'loading' | 'ready' | 'error' };

async function readChart(symbol: string, market: ResearchSnapshot['market'], signal: AbortSignal) {
    const payload = await readData(`/api/research/chart/${encodeURIComponent(symbol)}?market=${market}`, signal, readPolicies.provider);
    const chart = parseResearchChartResponse(payload);
    const data = (payload as { data: { symbol?: unknown; market?: unknown } }).data;
    if (data.symbol !== symbol || data.market !== market) throw new Error('Chart security mismatch');
    return chart;
}

/** Public provider reads only: chart access never depends on or updates a saved record. */
export function ResearchTechnicals({ snapshot }: { snapshot: ResearchSnapshot }) {
    const [history, setHistory] = useState<ChartRead>({ chart: null, state: 'loading' });
    const [revision, setRevision] = useState(0);
    const [compare, setCompare] = useState(false);
    const [benchmark, setBenchmark] = useState<ChartRead>({ chart: null, state: 'loading' });
    const [benchmarkRevision, setBenchmarkRevision] = useState(0);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const benchmarkSymbol = snapshot.market === 'US' ? 'VOO' : 'KLCI';
    const benchmarkLabel = snapshot.market === 'US' ? 'S&P 500 (VOO)' : 'FBM KLCI';

    useEffect(() => {
        const root = document.documentElement;
        const sync = () => setTheme(root.getAttribute('data-v8-theme') === 'dark' ? 'dark' : 'light');
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(root, { attributes: true, attributeFilter: ['data-v8-theme'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        readChart(snapshot.symbol, snapshot.market, controller.signal)
            .then(chart => { if (!controller.signal.aborted) setHistory({ chart, state: 'ready' }); })
            .catch(() => { if (!controller.signal.aborted) setHistory({ chart: null, state: 'error' }); });
        return () => controller.abort();
    }, [snapshot.symbol, snapshot.market, revision]);

    useEffect(() => {
        if (!compare || snapshot.symbol === benchmarkSymbol) return;
        const controller = new AbortController();
        readChart(benchmarkSymbol, snapshot.market, controller.signal)
            .then(chart => { if (!controller.signal.aborted) setBenchmark({ chart, state: chart.points.length ? 'ready' : 'error' }); })
            .catch(() => { if (!controller.signal.aborted) setBenchmark({ chart: null, state: 'error' }); });
        return () => controller.abort();
    }, [compare, benchmarkSymbol, snapshot.market, snapshot.symbol, benchmarkRevision]);

    const retry = () => { setHistory({ chart: null, state: 'loading' }); setRevision(value => value + 1); };
    // An explicit empty extended response stays empty; never replace it with illustrative data.
    const chart = history.chart ?? snapshot.chart;
    return <div className={styles.technicals} data-testid="research-technicals" data-theme={theme}>
        <p className={styles.intro}>Chart &amp; technicals · {snapshot.symbol} · {snapshot.market}. Price-derived indicators describe historical behaviour; they are not a forecast. No saved security or note is required.</p>
        {!chart.points.length ? <div role="status">
            <p>{history.state === 'loading' ? 'Loading daily chart history…' : 'Historical chart data is unavailable for this security. Missing observations are not filled.'}</p>
            {history.state !== 'loading' && <button className={styles.retry} type="button" onClick={retry}>Retry chart history</button>}
        </div> : <ResearchChartV6
            snapshot={snapshot} chart={chart} historyState={history.state}
            benchmarkChart={benchmark.chart} benchmarkLabel={benchmarkLabel}
            benchmarkState={compare ? benchmark.state : 'idle'} compareBenchmark={compare}
            onToggleBenchmark={() => { setBenchmark({ chart: null, state: 'loading' }); setCompare(value => !value); }}
            onRetryBenchmark={() => { setBenchmark({ chart: null, state: 'loading' }); setBenchmarkRevision(value => value + 1); }}
            onRetryHistory={retry} theme={theme} presentation="v7"
            renderMetricLabel={label => <MetricGlossary metric={label === 'RSI' || label === 'RSI (14)' ? 'rsi' : undefined}>{label}</MetricGlossary>}
        />}
    </div>;
}
