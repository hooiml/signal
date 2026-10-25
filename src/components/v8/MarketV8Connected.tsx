'use client';

import { useEffect, useRef, useState } from 'react';
import { VersionSwitcher } from '@/components/navigation/VersionSwitcher';
import { V8Settings } from './V8Settings';
import { V8FirstVisit } from './V8FirstVisit';
import { readSignalConfig, type SignalConfig } from '@/lib/signal-config';
import { readData as read, readPolicies } from './read-data';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { parseMarketReplayIndex, parseMarketReplaySnapshot, type MarketReplaySnapshot, type MarketReplaySummary } from '@/lib/types/market-replay';
import { getIndicatorBaseWeights, getIndicatorDisplayName } from '@/lib/indicator-registry';
import { MarketChart } from './MarketV8Chart';
import { ConnectedHistory, defaultHistory } from './MarketV8ConnectedHistory';
import { MarketCoverageNotices, MarketCurrentAssessment } from './MarketV8Coverage';
import { MarketV81Hero } from './MarketV81Hero';
import { MarketContextSummary } from './MarketV8ContextSummary';
import { MarketIndicatorEvidence } from './MarketIndicatorEvidence';
import layout from './market-v8-connected.module.css';
import { MarketV8Exposure } from './MarketV8Exposure';
import { MarketV8Outcomes } from './MarketV8Outcomes';
import { MarketMobileSection } from './MarketMobileSection';
import { marketEvidenceCoverage } from '@/lib/market-evidence-coverage';
import { marketReadingLabel, marketTimestampLabel } from '@/lib/market-display';
import { ConnectedIndicator, ConnectedPanels, emptyScenario } from './MarketV8ConnectedPanels';
import { archivedSeries, fullDate, formatMarketDates, marketSourceToggleStatus, overviewHistory, parseConnectedSignal } from './MarketV8ConnectedData';
import { signed, tabs, type InvestigationTab, type Market, type Mode, type Point } from './market-v8-fixtures';
import styles from './market-v8.module.css';
import { MetricGlossary } from './MetricGlossary';
import { metricForIndicator } from '@/lib/learn/metric-links';

type ResponseState = { key: string; signal: MarketSignal | null; loading: boolean; error: string; received: string };
type ArchiveState = { key: string; summaries: readonly MarketReplaySummary[]; samples: readonly MarketReplaySummary[]; snapshots: Record<string, MarketReplaySnapshot>; loading: boolean; error: string; states?: Record<string, 'pending' | 'loaded' | 'failed' | 'unavailable'> };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Data could not be loaded.';
const tierClasses: Record<MarketSignal['tier'], string> = {
    'strong-buy': styles.tierStrongBuy, buy: styles.tierBuy, neutral: styles.tierNeutral,
    sell: styles.tierSell, 'strong-sell': styles.tierStrongSell,
};

export function MarketV8Connected({ initialMarket }: { initialMarket?: Market }) {
    const [defaults, setDefaults] = useState<ReturnType<typeof readSignalConfig> | null>(null);
    useEffect(() => {
        const timer = window.setTimeout(() => setDefaults(readSignalConfig()), 0);
        return () => window.clearTimeout(timer);
    }, []);
    if (!defaults) return <div className={styles.app}><main className={styles.canvas}><p role="status">Loading Market preferences…</p></main></div>;
    return <MarketView initialConfig={{ ...defaults.config, market: initialMarket ?? defaults.config.market }} initialPreferenceError={defaults.error} />;
}

function MarketView({ initialConfig, initialPreferenceError }: { initialConfig: SignalConfig; initialPreferenceError: string }) {
    const [preferenceError, setPreferenceError] = useState(initialPreferenceError);
    const [advanced, setAdvanced] = useState(false);
    const [archiveRequested, setArchiveRequested] = useState(false);
    const indicatorsRef = useRef<HTMLDivElement>(null);
    // Basic view: the indicator list beside the chart already shows the inputs, so the Evidence tab is advanced-only.
    const visibleTabs = tabs.filter(name => advanced || (name !== 'History' && name !== 'Scenarios' && name !== 'Evidence'));
    const [market, setMarketState] = useState<Market>(initialConfig.market);
    const [mode, setMode] = useState<Mode>(initialConfig.mode);
    const [social, setSocial] = useState(initialConfig.enableSocial);
    const [revision, setRevision] = useState(0);
    const [archiveRevision, setArchiveRevision] = useState(0);
    const [tab, setTab] = useState<InvestigationTab>('What changed');
    const [investigationOpen, setInvestigationOpen] = useState(false);
    const [selected, setSelected] = useState<string | null>(null);
    const [historical, setHistorical] = useState<Point | null>(null);
    const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
    const [replayPoint, setReplayPoint] = useState<Point | null>(null);
    const [range, setRange] = useState('3M');
    const [scenario, setScenario] = useState(emptyScenario);
    const [historyState, setHistoryState] = useState(defaultHistory);
    const [resetNotice, setResetNotice] = useState('');
    const priorView = useRef<{ tab: InvestigationTab; selected: string | null; point: Point | null; scroll: number }>({ tab: 'What changed', selected: null, point: null, scroll: 0 });
    const [response, setResponse] = useState<ResponseState>({ key: '', signal: null, loading: true, error: '', received: '' });
    const [archive, setArchive] = useState<ArchiveState>({ key: '', summaries: [], samples: [], snapshots: {}, loading: true, error: '' });
    const [replay, setReplay] = useState<{ date: string; snapshot: MarketReplaySnapshot | null; loading: boolean; error: string }>({ date: '', snapshot: null, loading: false, error: '' });
    const modal = useRef<HTMLDialogElement>(null);
    const rail = useRef<HTMLElement>(null);
    const trigger = useRef<HTMLButtonElement | null>(null);
    const inspectorScroll = useRef(0);
    const key = `${market}-${mode}-${social}`;
    const query = `market=${market}&mode=${mode}&enableSocial=${social}`;
    const data = response.key === key ? response.signal : null;
    const archiveData = archive.key === key ? archive : null;
    const loading = response.key !== key || response.loading;

    function setMarket(next: Market) {
        const url = new URL(window.location.href);
        url.searchParams.set('market', next);
        window.history.replaceState(null, '', url);
        setMarketState(next);
    }

    useEffect(() => {
        const controller = new AbortController();
        setResponse(previous => ({ key, signal: previous.key === key ? previous.signal : null, loading: true, error: '', received: previous.key === key ? previous.received : '' }));
        void (async () => {
            try {
                const signal = parseConnectedSignal(await read(`/api/signals/v2?${query}`, controller.signal), market, mode);
                if (controller.signal.aborted) return;
                setResponse({ key, signal, loading: false, error: '', received: new Date().toISOString() });
            } catch (error) {
                if (!controller.signal.aborted) setResponse(previous => ({ ...previous, loading: false, error: errorText(error) }));
            }
        })();
        return () => controller.abort();
    }, [key, query, market, mode, social, revision]);

    useEffect(() => {
        if (!data || loading) return;
        const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) setArchiveRequested(true); });
        if (indicatorsRef.current) observer.observe(indicatorsRef.current);
        return () => observer.disconnect();
    }, [data, loading]);

    useEffect(() => {
        if (loading || (!advanced && !archiveRequested)) return;
        const controller = new AbortController();
        setArchive(previous => previous.key === key ? { ...previous, loading: true, error: '' } : { key, summaries: [], samples: [], snapshots: {}, loading: true, error: '' });
        void (async () => {
            const archiveController = new AbortController();
            const cancelArchive = () => archiveController.abort();
            controller.signal.addEventListener('abort', cancelArchive, { once: true });
            const deadline = setTimeout(() => archiveController.abort(), 60000);
            try {
                const index = parseMarketReplayIndex(await read(`/api/signals/replay?${query}`, archiveController.signal, readPolicies.archive));
                if (index.market !== market || index.mode !== mode || index.enableSocial !== social) throw new Error('The archive returned a different configuration.');
                const samples = [...index.summaries].sort((a,b) => b.date.localeCompare(a.date)).slice(0,12);
                const snapshots: Record<string, MarketReplaySnapshot> = {};
                const states: NonNullable<ArchiveState['states']> = Object.fromEntries(samples.map(row => [row.date, row.hasFullEvidence ? 'pending' : 'unavailable']));
                const publish = (loading: boolean) => {
                    if (!controller.signal.aborted) setArchive(previous => ({ key, summaries: index.summaries, samples, snapshots: { ...(previous.key === key ? previous.snapshots : {}), ...snapshots }, states: { ...states }, loading, error: failures ? `${failures} archived records failed. Available evidence is retained with gaps.` : '' }));
                };
                let failures = 0;
                publish(true);
                for (let offset = 0; offset < samples.length; offset += 4) {
                    await Promise.all(samples.slice(offset, offset + 4).map(async summary => {
                        if (!summary.hasFullEvidence) return;
                        const cached = archiveData?.snapshots[summary.date];
                        if (cached) { snapshots[summary.date] = cached; states[summary.date] = 'loaded'; return; }
                        try {
                            const snapshot = parseMarketReplaySnapshot(await read(`/api/signals/replay?${query}&date=${summary.date}`, archiveController.signal, readPolicies.archive));
                            if (snapshot.summary.date !== summary.date) throw new Error('Archive date mismatch.');
                            snapshots[summary.date] = snapshot;
                            states[summary.date] = 'loaded';
                        } catch { failures++; states[summary.date] = 'failed'; }
                        publish(true);
                    }));
                    if (controller.signal.aborted) return;
                }
                publish(false);
            } catch (error) {
                if (!controller.signal.aborted) setArchive(previous => ({ ...previous, loading: false, error: errorText(error) }));
            } finally { clearTimeout(deadline); controller.signal.removeEventListener('abort', cancelArchive); }
        })();
        return () => controller.abort();
    // Archive progress must not restart its own batch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, query, market, mode, social, revision, archiveRevision, advanced, archiveRequested, loading]);

    useEffect(() => {
        if (!historical) return;
        const controller = new AbortController();
        const date = historical.date;
        const cached = archiveData?.snapshots[date];
        setReplay({ date, snapshot: cached ?? null, loading: !cached, error: '' });
        if (!cached) void (async () => {
            try {
                const snapshot = parseMarketReplaySnapshot(await read(`/api/signals/replay?${query}&date=${date}`, controller.signal, readPolicies.archive));
                if (snapshot.summary.date !== date) throw new Error('Archive date mismatch.');
                if (!controller.signal.aborted) setReplay({ date, snapshot, loading: false, error: '' });
            } catch (error) {
                if (!controller.signal.aborted) setReplay({ date, snapshot: null, loading: false, error: errorText(error) });
            }
        })();
        return () => controller.abort();
    // Archive progress must not restart a replay read or erase its loading/error state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [historical, query, revision]);

    function closeInspector() {
        modal.current?.close(); setSelected(null);
        requestAnimationFrame(() => {
            (trigger.current?.isConnected ? trigger.current : document.getElementById('market-content'))?.focus({ preventScroll: true });
            window.scrollTo({ top: inspectorScroll.current });
        });
    }
    function resetView() { modal.current?.close(); setSelected(null); setHistorical(null); setReplayPoint(null); setCurrentPoint(null); setTab('What changed'); setScenario(emptyScenario()); setHistoryState(defaultHistory()); setResetNotice('Market configuration changed. Temporary investigation settings and scenario assumptions were reset.'); }
    function enterReplay(point: Point) { if (!historical) priorView.current = { tab, selected, point: currentPoint, scroll: window.scrollY }; setSelected(null); modal.current?.close(); setHistorical(point); setReplayPoint(point); }
    function returnCurrent() { setHistorical(null); setTab(priorView.current.tab); setSelected(priorView.current.selected); setCurrentPoint(priorView.current.point); requestAnimationFrame(() => window.scrollTo({ top: priorView.current.scroll })); }
    function openIndicator(indicatorKey: string, element: HTMLButtonElement) {
        trigger.current = element;
        inspectorScroll.current = window.scrollY;
        setSelected(indicatorKey); setArchiveRequested(true);
        requestAnimationFrame(() => {
            if (matchMedia('(min-width: 901px)').matches && rail.current) {
                rail.current.focus({ preventScroll: true });
                const box = rail.current.getBoundingClientRect();
                if (box.top < 0 || box.top >= window.innerHeight) rail.current.scrollIntoView({ block: 'start' });
            }
        });
    }
    function openTab(name: InvestigationTab) { setTab(name); setInvestigationOpen(true); requestAnimationFrame(() => { const panel = document.getElementById('investigation-panel'); panel?.scrollIntoView({ block: 'start' }); panel?.focus({ preventScroll: true }); }); }
    function reviewEvidence() {
        if (advanced) { openTab('Evidence'); return; }
        requestAnimationFrame(() => { indicatorsRef.current?.scrollIntoView({ block: 'start' }); indicatorsRef.current?.focus({ preventScroll: true }); });
    }
    function retryArchive() { setArchiveRequested(true); setArchiveRevision(value => value + 1); }
    useEffect(() => {
        if (!selected) return;
        const media = matchMedia('(max-width: 900px)');
        const previous = document.body.style.overflow;
        const sync = () => {
            if (media.matches) { if (!modal.current?.open) modal.current?.showModal(); document.body.style.overflow = 'hidden'; }
            else {
                const wasModal = modal.current?.open;
                modal.current?.close(); document.body.style.overflow = previous;
                if (wasModal) (trigger.current?.isConnected ? trigger.current : rail.current)?.focus({ preventScroll: true });
            }
        };
        sync(); media.addEventListener('change', sync);
        return () => { media.removeEventListener('change', sync); document.body.style.overflow = previous; };
    }, [selected]);

    const history = data ? overviewHistory(data) : [];
    const latest = history.at(-1)?.date;
    const cutoff = latest ? new Date(`${latest}T00:00:00Z`) : null;
    if (cutoff) cutoff.setUTCMonth(cutoff.getUTCMonth() - (range === '1M' ? 1 : 3));
    const chartPoints = range === 'All' ? history : history.filter(point => !cutoff || Date.parse(point.date) >= cutoff.getTime());
    const preview = chartPoints.find(point => point.date === (historical ? replayPoint?.date ?? historical.date : currentPoint?.date));
    const previewArchive = archiveData?.summaries.find(row => row.date === preview?.date);
    const configured = data ? getIndicatorBaseWeights(market, { highVolatilityOverride: market === 'US' && (data.components.vix?.value ?? 0) > 30 }) : {};
    const inputKeys = [...new Set([...Object.keys(configured).filter(input => configured[input] > 0), ...Object.keys(data?.components ?? {})])];
    const snapshotDate = data?.metadata.score_delta?.snapshot_date;
    const date = snapshotDate ?? '';
    const currentCoverage = data ? marketEvidenceCoverage(data, snapshotDate) : null;
    const previewCoverage = !preview ? null : snapshotDate && preview.date === snapshotDate && preview.origin === 'observed' && currentCoverage?.observedPct !== null && currentCoverage?.observedPct !== undefined
        ? `Scored weight ${currentCoverage.observedPct.toFixed(1)}% (${currentCoverage.scoredCount}/${currentCoverage.configuredCount}) · ${currentCoverage.verifiedPartition ? 'Freshness partition verified' : 'Fresh/stale split not fully verifiable'}`
        : 'Historical source-weight percentage unavailable for this point.';
    const archived = historical && replay.date === historical.date ? replay.snapshot : null;
    const score = historical ? archived?.summary.score ?? historical.value : data?.composite_score;
    const hasScore = !!data && Object.keys(data.components).length > 0;
    const scoreDelta = data?.metadata.score_delta;
    const changeSummary = typeof scoreDelta?.delta === 'number' && Number.isFinite(scoreDelta.delta)
        ? `${Math.abs(scoreDelta.delta) < 0.005 ? 'Score unchanged' : `${signed(scoreDelta.delta)} score points`} · ${scoreDelta.previous_date ? `since ${fullDate(scoreDelta.previous_date)}` : 'prior date unavailable'}`
        : 'Score comparison unavailable';
    const archiveStates = Object.values(archiveData?.states ?? {});
    const indicatorHistoryState = {
        loading: !archiveData || archiveData.loading, error: archiveData?.error ?? '',
        loaded: archiveStates.filter(state => state === 'loaded').length,
        pending: archiveStates.filter(state => state === 'pending').length,
        failed: archiveStates.filter(state => state === 'failed').length,
        unavailable: archiveStates.filter(state => state === 'unavailable').length,
        total: archiveData?.samples.length ?? 0,
    };
    const inspector = selected && data ? <ConnectedIndicator signal={data} indicatorKey={selected} onClose={closeInspector} sourceEnabled={social} advanced={advanced} history={archivedSeries(selected, archiveData?.samples ?? [], archiveData?.snapshots ?? {}, data.components[selected]?.display_name, data.components[selected]?.metadata?.unit)} historyState={indicatorHistoryState} onRetryHistory={retryArchive} /> : null;

    return <div className={styles.app} onKeyDown={event => { if (event.key === 'Escape' && selected) closeInspector(); }}>
        <a className={styles.skip} href="#market-content">Skip to market conditions</a>
        <header className={styles.header}><a className={styles.logo} href="/main-v8">∿ Signal</a><nav aria-label="Primary"><a href="/main-v8" aria-current="page">Market</a><a href={`/research-v8?market=${market}`}>Research</a></nav><V8Settings onDefaultsSaved={() => setPreferenceError('')} /></header>
        {preferenceError && <p role="status" className={styles.canvas}>{preferenceError}</p>}
        <div className={styles.canvas}>
            <V8FirstVisit surface="market" mode={mode} ready={!!data && Number.isFinite(data.composite_score) && hasScore && !loading && !response.error && !historical && response.key === key} />
            <div className={styles.toolbar}><div className={styles.marketControls}><label className={styles.visuallyHidden} htmlFor="market-select">Market</label><select id="market-select" value={market} onChange={event => { setMarket(event.target.value as Market); resetView(); }}><option value="US">US Market</option><option value="MY">Malaysia</option></select><fieldset className={styles.segment}><legend className={styles.visuallyHidden}>Interpretation mode</legend>{(['standard','contrarian'] as const).map(value => <button key={value} aria-pressed={mode===value} onClick={() => { setMode(value); resetView(); }}>{value==='standard'?'Momentum':'Contrarian'}</button>)}</fieldset><label className={styles.sourceToggle}><input type="checkbox" checked={social} onChange={event => { setSocial(event.target.checked); resetView(); }} />{market==='MY'?'Include news in score':'Include social in score'}</label><details className={`${styles.muted} ${layout.controlHelp}`}><summary>About these settings</summary><div><p data-testid="mode-explanation">{mode === 'standard' ? 'Momentum: high scores read as trend confirmation' : 'Contrarian: high scores read as crowding risk, low scores as opportunity'}</p><p data-testid="social-inclusion-status">{marketSourceToggleStatus(market, social, data, loading, response.key === key ? response.error : '')}</p></div></details></div><div className={styles.depthActions}><button className={styles.secondaryButton} aria-pressed={advanced} onClick={() => { if (advanced) { if (historical) returnCurrent(); if (tab === 'History' || tab === 'Scenarios' || tab === 'Evidence' || historical) setTab('What changed'); } setAdvanced(!advanced); }}>{advanced ? 'Back to basic view' : <>Advanced<span className={layout.longLabel}> tools</span></>}</button><button className={styles.secondaryButton} disabled={loading} onClick={() => { setRevision(value=>value+1); }}>{loading?'Loading…':<>Reload<span className={layout.longLabel}> data</span></>}</button></div></div>
            <main id="market-content" tabIndex={-1} className={`${styles.workspace} ${layout.layout}`}>
                <div className={styles.mainColumn}>
                    {resetNotice && <p role="status">{resetNotice}</p>}
                    {selected && <div className={styles.inspectorAccess}><span role="status"><MetricGlossary metric={metricForIndicator(selected)}>{data?.components[selected]?.display_name ?? getIndicatorDisplayName(selected)}</MetricGlossary> detail updated.</span><button onClick={() => rail.current?.focus({ preventScroll: true })}>Move to indicator detail</button></div>}
                    {(!data || !hasScore || historical) && <div className={styles.hero}><div className={styles.heroKicker}><span>{market==='US'?'United States':'Malaysia'} / {historical?'Historical snapshot':'Market conditions'}</span><span className={styles.fixtureBadge}>{historical ? `Snapshot ${fullDate(historical.date)}` : snapshotDate ? `Snapshot ${fullDate(snapshotDate)}` : data ? `Retrieved ${fullDate(response.received)}` : "Awaiting source data"}</span></div><h1>{historical ? `Reading on ${fullDate(historical.date)}` : !data ? loading?'Market conditions':'Market data unavailable.' : !hasScore?'No observations. No market call.':data.metadata.interpretation_context?.regime ?? data.interpretation.action}</h1><p>{historical?'Archived scores and evidence are kept separate from the current reading.':data && !hasScore ? 'No current component observations were returned. Stored history remains separate.' : data?.interpretation.reasoning ?? 'Current values will appear when the service returns. No demo values are substituted.'}</p></div>}
                    {response.key===key && response.error && <div className={styles.warning} role="alert"><b>{response.error}</b><span>{data?'The previous response is retained for this same configuration.':'No replacement score has been inferred.'}</span></div>}
                    {loading && !data && <div className={styles.loadingSkeleton} role="status" aria-label="Loading current scores, evidence coverage and score history"><div><span>Composite reading</span><span className={styles.skeletonLine} /></div><div><span>Evidence coverage</span><span className={styles.skeletonLine} /></div><div><span>Score history</span><span className={styles.skeletonLine} /></div></div>}{loading && data && <p role="status">Reloading this configuration; the previous response remains visible with its original date.</p>}
                    {data && hasScore && <>
                        {historical && <div className={styles.historyBanner}><span>{fullDate(historical.date)} · {archived?.summary.origin ?? data.metadata.score_history?.find(point=>point.date===historical.date)?.origin ?? 'Origin unavailable'}</span><button onClick={returnCurrent}>Return to current ↗</button></div>}
                        {!historical && <MarketV81Hero signal={data} snapshotDate={snapshotDate} tierClass={tierClasses[data.tier]} onEvidence={reviewEvidence} onDrivers={()=>openTab('What changed')} onSelect={openIndicator} />}
                        <div className={layout.analysisGrid}>
                            <section className={`${styles.scorePanel} ${layout.history}`} aria-label="Market score and history">
                                {historical ? <div className={styles.scoreStrip}><div className={styles.score}><strong data-testid="connected-score">{score}</strong><span>/100</span></div><span className={`${styles.zone} ${tierClasses[(historical ? archived?.summary.tier : data.tier) ?? 'neutral']}`}>{archived?.summary.tier ? marketReadingLabel(archived.summary.tier) : 'Stored reading'}</span><div className={`${styles.scoreMeta} ${styles.scoreDelta}`}><b>{!historical && data.metadata.score_delta?.delta != null ? signed(data.metadata.score_delta.delta) : '—'} <small>points</small></b><span>{!historical ? `vs ${fullDate(data.metadata.score_delta?.previous_date)}`:'Current comparison withheld'}</span></div><div className={styles.scoreMeta}><b>{historical?archived?`${archived.agreementPercent.toFixed(0)}%`:'—':`${data.confidence.agreement_pct.toFixed(0)}%`} <small>agreement</small></b><span>Not forecast accuracy</span></div><button className={styles.coverageButton} disabled={!!historical} onClick={()=>openTab('Evidence')}><b>{historical?archived?.components.length ?? '—':`${Object.keys(data.components).length}/${inputKeys.length}`} <small>scored inputs</small></b><span>{!historical?`${Math.round((data.metadata.coverage_adjustment?.active_weight ?? Object.values(data.components).reduce((sum,item)=>sum+item.weight,0))*100)}% included weight ↗`:'Archived evidence only'}</span></button></div> : null}
                            <div className={styles.chartHeader}><h2>Market condition score</h2><div className={styles.range} aria-label="Chart range">{['1M','3M','All'].map(value=><button key={value} aria-pressed={range===value} onClick={()=>setRange(value)}>{value}</button>)}</div></div>
                            <MarketChart key={`${key}-${range}-${latest}-${historical?.date}`} points={chartPoints} sourced replayAvailable={advanced} selectedDate={historical ? replayPoint?.date ?? historical.date : currentPoint?.date} onSelect={point => historical ? setReplayPoint(point) : setCurrentPoint(point)} />
                            <div className={styles.chartFoot}><span>{preview ? `${fullDate(preview.date)} · ${preview.value}/100 · ${preview.origin ?? "Origin unavailable"}` : "Select a point to preview its evidence."}</span>{previewCoverage && <span className={styles.v81PreviewCoverage}>{previewCoverage}</span>}{advanced && <button className={styles.textButton} disabled={!preview || !previewArchive?.hasFullEvidence} onClick={() => preview && enterReplay(preview)}>Open historical snapshot</button>}<span>{advanced && preview && (!archiveData || archiveData.loading) ? "Checking snapshot availability…" : advanced && preview && !previewArchive?.hasFullEvidence ? "No full archived snapshot is available for this point." : ""}</span></div>
                            <details className={layout.historyDetails}><summary>History and comparison details</summary><div className={styles.chartFoot}><span>{chartPoints.length} snapshots shown ({range}) · {history.length} in returned history · observed and reconstructed</span>{advanced && <button className={styles.textButton} disabled={!!historical} onClick={()=>openTab('History')}>Historical calibration →</button>}<span>{historical?`Selected snapshot ${fullDate(historical.date)}`:snapshotDate?`Snapshot ${fullDate(snapshotDate)}`:`Retrieved ${fullDate(response.received)} · snapshot date unavailable`}</span></div>
                            {!historical && data.metadata.trend_context && <div className={styles.seriesSummary}><span>{formatMarketDates(data.metadata.trend_context.score_trend)}</span><span>{formatMarketDates(data.metadata.trend_context.last_signal_change)}</span></div>}
                            </details>

                            </section>
                                {historical ? <section className={styles.panel} aria-label="Archived indicator evidence"><h2>Evidence for {fullDate(historical.date)}</h2>{replay.loading?<p role="status">Loading this archived record…</p>:archived?<><p>{archived.summary.coverageNote ?? 'Observed snapshot. Individual source timestamps remain distinct from snapshot capture.'}</p><div className={styles.contextList}>{archived.components.map(item=><details key={item.key}><summary><span><b>{item.displayName}</b><small>Raw {item.rawValue ?? 'unavailable'} {item.unit ?? '· unit unavailable'} · normalized {item.score ?? 'unavailable'} / 100</small></span><span aria-hidden="true">＋</span></summary><p><MetricGlossary metric={metricForIndicator(item.key)}>{item.displayName}</MetricGlossary></p><dl className={`${styles.keyValues} ${styles.observationTimes}`}><div><dt>Stored weight</dt><dd>{item.weight===null?'Unavailable':`${(item.weight*100).toFixed(1)}%`}</dd></div><div><dt>Contribution</dt><dd>{item.score===null||item.weight===null?'Unavailable':`${(item.score*item.weight).toFixed(2)} points`}</dd></div><div><dt>{item.timestampBasis === 'observed' ? 'Observed' : item.timestampBasis === 'retrieved' ? 'Retrieved' : 'Recorded time · basis unavailable'}</dt><dd>{marketTimestampLabel(item.lastUpdated)}</dd></div>{item.timestampBasis === 'observed' && item.retrievedAt && <div><dt>Retrieved</dt><dd>{marketTimestampLabel(item.retrievedAt)}</dd></div>}</dl><p>No present-day values are used.</p></details>)}</div></>:<div className={styles.unavailable}><b>Historical indicator records unavailable</b><p>{replay.error} <button onClick={() => setRevision(value => value + 1)}>Retry snapshot</button> This date retains its stored score only. Current context, articles and outcomes are withheld.</p><p>{data.metadata.score_history?.find(point=>point.date===historical.date)?.coverage_note}</p></div>}</section> : <div ref={indicatorsRef} tabIndex={-1} className={layout.evidenceSlot} data-inspecting={!!selected}>
                                <div className={layout.evidenceList}>
                                    <MarketIndicatorEvidence key={key} signal={data} inputKeys={inputKeys} configured={configured} date={date} sourceEnabled={social} onSelect={openIndicator} />
                                </div>
                                {selected && <aside className={`${styles.rail} ${layout.inspector} ${layout.desktopInspector}`} ref={rail} tabIndex={-1} id="indicator-inspector" aria-label="Selected indicator">{inspector}</aside>}
                                <details className={layout.archiveNote}><summary>About indicator history{archiveData?.error ? ' · some history unavailable' : ''}</summary><p>History is available inside each indicator. Archive {archiveData ? archiveData.loading ? 'loading; partial history' : 'loaded' : archiveRequested ? 'loading' : 'not requested yet'} · {Object.values(archiveData?.states ?? {}).filter(state => state === 'loaded').length} loaded / {Object.values(archiveData?.states ?? {}).filter(state => state === 'pending').length} pending / {Object.values(archiveData?.states ?? {}).filter(state => state === 'failed').length} failed / {Object.values(archiveData?.states ?? {}).filter(state => state === 'unavailable').length} unavailable. The latest {archiveData?.samples.length ?? 0} archived snapshot dates retain gaps. Raw readings stored in snapshots are not continuous provider histories. {archiveData?.error} {!!archiveData?.error && <button disabled={indicatorHistoryState.loading} onClick={retryArchive}>Retry archive</button>}</p></details>
                            </div>}
                            {!historical && <MarketContextSummary signal={data} onExplore={()=>openTab('Context')} />}
                        </div>
                        {!historical && <>
                            <MarketV8Outcomes signal={data} onHistory={() => { setAdvanced(true); openTab('History'); }} />
                            <MarketV8Exposure key={market} signal={data} />
                            <nav className={layout.researchLinks} aria-label="Find stocks in Research"><div><b>From market to stocks</b><span>US large caps with sustained momentum, a rule-based shortlist, and upcoming earnings.{market === 'MY' ? ' The trend scan covers US stocks only.' : ''}</span></div><a href="/research-v8?market=US&discover=trending#discover">Trending · Top 20 →</a><a href="/research-v8?market=US&discover=picker#discover">Stock Picker →</a><a href={`/research-v8?market=${market}&discover=calendar#discover`}>Earnings calendar →</a></nav>
                            <details className={layout.readingDetails}><summary>How to read this assessment · methodology and limits</summary><div><MarketCurrentAssessment signal={data} date={date} onSelect={openIndicator} showLeadingEvidence={false} /><MarketCoverageNotices signal={data} inputKeys={inputKeys} date={date} sourceEnabled={social} onReview={reviewEvidence} /></div></details>
                            <MarketMobileSection name="investigation" title="What changed" summary={changeSummary} className={`${styles.investigation} ${layout.mobileInvestigation}`} id="investigation" open={investigationOpen} onOpenChange={setInvestigationOpen}>
                                <div className={styles.tabs} role="tablist" aria-label="Market investigation">{visibleTabs.map((name,index)=><button key={name} id={`tab-${index}`} role="tab" aria-selected={tab===name} aria-controls="investigation-panel" tabIndex={tab===name?0:-1} onClick={()=>setTab(name)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?visibleTabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+visibleTabs.length)%visibleTabs.length;document.getElementById(`tab-${next}`)?.focus();}}>{name}</button>)}</div><div className={styles.panel} id="investigation-panel" role="tabpanel" tabIndex={-1} aria-labelledby={`tab-${visibleTabs.indexOf(tab)}`} key={`${key}-${tab}`}>{tab==='History'?<ConnectedHistory signal={data} state={historyState} setState={setHistoryState}/>:<ConnectedPanels advanced={advanced} signal={data} tab={tab} onSelect={openIndicator} scenario={scenario} setScenario={setScenario}/>}</div>
                            </MarketMobileSection>
                        </>}
                    </>}
                    {data && !hasScore && <section className={styles.empty}><h2>No usable observations returned.</h2><p>The service supplied no current components. A neutral placeholder is not shown as market evidence.</p>{history.length>0&&<><h3>Stored history only</h3><MarketChart points={history} sourced name="Stored score history"/><details><summary>Stored score records</summary><table className={styles.zoneTable}><thead><tr><th>Date</th><th>Score</th></tr></thead><tbody>{history.map(point=><tr key={point.date}><td>{fullDate(point.date)}</td><td>{point.value}</td></tr>)}</tbody></table></details></>}</section>}
                </div>

            </main>
            {/* The optional install offer docks here instead of floating over the page. */}<div id="signal-install-slot" /><footer className={styles.footer}><span>Market conditions · dated evidence</span><details><summary>Data scope & limitations</summary><p>Scores, raw inputs, context and calibration come from the existing service. Provider availability and old source dates are not repaired in the UI. Historical reconstructed records remain labelled; mini-charts use bounded archived snapshots. The existing service manages its own cache and snapshot storage. Scenarios are local assumptions. Research uses existing saved records.</p><a className={styles.textButton} href="/main-v8?demo=1">Open representative demo →</a></details><VersionSwitcher placement="footer" /></footer>
        </div>
        <dialog className={styles.mobileInspector} ref={modal} onCancel={event=>{event.preventDefault();closeInspector();}} onKeyDown={event=>{
            if(event.key!=='Tab')return;
            const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')).filter(el=>el.getClientRects().length&&!el.hasAttribute('disabled'));
            const first=controls[0],last=controls.at(-1);
            if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
            else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
        }} aria-label="Indicator detail"><div className={styles.mobileInspectorTop}><button onClick={closeInspector}>← Back to Market</button><span>Service-supplied evidence</span></div>{inspector}</dialog>
    </div>;
}
