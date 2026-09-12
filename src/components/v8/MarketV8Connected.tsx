'use client';

import { useEffect, useRef, useState } from 'react';
import { formatRawValue } from '@/components/v2/cockpit-utils';
import { readData as read, readPolicies } from './read-data';
import type { MarketSignal } from '@/lib/types/signal-v2';
import { parseMarketReplayIndex, parseMarketReplaySnapshot, type MarketReplaySnapshot, type MarketReplaySummary } from '@/lib/types/market-replay';
import { getIndicatorBaseWeights, getIndicatorDisplayName } from '@/lib/indicator-registry';
import { MarketChart } from './MarketV8Chart';
import { ConnectedHistory } from './MarketV8ConnectedHistory';
import { MarketCoverageNotices } from './MarketV8Coverage';
import { ConnectedIndicator, ConnectedPanels } from './MarketV8ConnectedPanels';
import { archivedSeries, fullDate, indicatorStatus, overviewHistory, parseConnectedSignal } from './MarketV8ConnectedData';
import { signed, tabs, type InvestigationTab, type Market, type Mode, type Point } from './market-v8-fixtures';
import styles from './market-v8.module.css';

type ResponseState = { key: string; signal: MarketSignal | null; loading: boolean; error: string; received: string };
type ArchiveState = { key: string; summaries: readonly MarketReplaySummary[]; samples: readonly MarketReplaySummary[]; snapshots: Record<string, MarketReplaySnapshot>; loading: boolean; error: string; states?: Record<string, 'pending' | 'loaded' | 'failed' | 'unavailable'> };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Data could not be loaded.';
const tierClasses: Record<MarketSignal['tier'], string> = {
    'strong-buy': styles.tierStrongBuy, buy: styles.tierBuy, neutral: styles.tierNeutral,
    sell: styles.tierSell, 'strong-sell': styles.tierStrongSell,
};

export function MarketV8Connected() {
    const [market, setMarket] = useState<Market>('US');
    const [mode, setMode] = useState<Mode>('standard');
    const [social, setSocial] = useState(true);
    const [revision, setRevision] = useState(0);
    const [tab, setTab] = useState<InvestigationTab>('What changed');
    const [selected, setSelected] = useState<string | null>(null);
    const [historical, setHistorical] = useState<Point | null>(null);
    const [range, setRange] = useState('3M');
    const [response, setResponse] = useState<ResponseState>({ key: '', signal: null, loading: true, error: '', received: '' });
    const [archive, setArchive] = useState<ArchiveState>({ key: '', summaries: [], samples: [], snapshots: {}, loading: true, error: '' });
    const [replay, setReplay] = useState<{ date: string; snapshot: MarketReplaySnapshot | null; loading: boolean; error: string }>({ date: '', snapshot: null, loading: false, error: '' });
    const modal = useRef<HTMLDialogElement>(null);
    const rail = useRef<HTMLElement>(null);
    const trigger = useRef<HTMLButtonElement | null>(null);
    const key = `${market}-${mode}-${social}`;
    const query = `market=${market}&mode=${mode}&enableSocial=${social}`;
    const data = response.key === key ? response.signal : null;
    const archiveData = archive.key === key ? archive : null;
    const loading = response.key !== key || response.loading;

    useEffect(() => {
        const controller = new AbortController();
        setResponse(previous => ({ key, signal: previous.key === key ? previous.signal : null, loading: true, error: '', received: previous.key === key ? previous.received : '' }));
        setArchive(previous => previous.key === key ? { ...previous, loading: true, error: '' } : { key, summaries: [], samples: [], snapshots: {}, loading: true, error: '' });
        void (async () => {
            try {
                const signal = parseConnectedSignal(await read(`/api/signals/v2?${query}`, controller.signal), market, mode);
                if (controller.signal.aborted) return;
                setResponse({ key, signal, loading: false, error: '', received: new Date().toISOString() });
            } catch (error) {
                if (!controller.signal.aborted) setResponse(previous => ({ ...previous, loading: false, error: errorText(error) }));
            }
        })();
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
    }, [key, query, market, mode, social, revision]);

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
        requestAnimationFrame(() => trigger.current?.isConnected && trigger.current.focus());
    }
    function resetView() { modal.current?.close(); setSelected(null); setHistorical(null); setTab('What changed'); }
    function openIndicator(indicatorKey: string, element: HTMLButtonElement) { trigger.current = element; setSelected(indicatorKey); }
    function openTab(name: InvestigationTab) { setTab(name); requestAnimationFrame(() => { const panel = document.getElementById('investigation-panel'); panel?.scrollIntoView({ block: 'start' }); panel?.focus({ preventScroll: true }); }); }
    useEffect(() => {
        if (!selected) return;
        const media = matchMedia('(max-width: 900px)');
        const previous = document.body.style.overflow;
        const sync = () => {
            if (media.matches) { if (!modal.current?.open) modal.current?.showModal(); document.body.style.overflow = 'hidden'; }
            else { modal.current?.close(); document.body.style.overflow = previous; rail.current?.querySelector<HTMLButtonElement>('button')?.focus(); }
        };
        sync(); media.addEventListener('change', sync);
        return () => { media.removeEventListener('change', sync); document.body.style.overflow = previous; };
    }, [selected]);

    const history = data ? overviewHistory(data) : [];
    const latest = history.at(-1)?.date;
    const cutoff = latest ? new Date(`${latest}T00:00:00Z`) : null;
    if (cutoff) cutoff.setUTCMonth(cutoff.getUTCMonth() - (range === '1M' ? 1 : 3));
    const chartPoints = range === 'All' ? history : history.filter(point => !cutoff || Date.parse(point.date) >= cutoff.getTime());
    const configured = data ? getIndicatorBaseWeights(market, { highVolatilityOverride: market === 'US' && (data.components.vix?.value ?? 0) > 30 }) : {};
    const inputKeys = [...new Set([...Object.keys(configured).filter(input => configured[input] > 0), ...Object.keys(data?.components ?? {})])];
    const conflictKeys = data?.confidence.conflicting_indicators ?? [];
    const aligned = data ? Object.entries(data.components).filter(([input,item])=>!conflictKeys.includes(input)&&!conflictKeys.includes(item.display_name)).sort(([,a],[,b])=>b.weight-a.weight)[0] : undefined;
    const conflicting = data ? Object.entries(data.components).find(([input,item])=>conflictKeys.includes(input)||conflictKeys.includes(item.display_name)) : undefined;
    const snapshotDate = data?.metadata.score_delta?.snapshot_date;
    const date = snapshotDate ?? response.received;
    const archived = historical && replay.date === historical.date ? replay.snapshot : null;
    const score = historical ? archived?.summary.score ?? historical.value : data?.composite_score;
    const hasScore = !!data && Object.keys(data.components).length > 0;
    const inspector = selected && data ? <ConnectedIndicator signal={data} indicatorKey={selected} onClose={closeInspector} sourceEnabled={social} history={archivedSeries(selected, archiveData?.samples ?? [], archiveData?.snapshots ?? {}).at(-1) ?? []} /> : null;

    return <div className={styles.app} onKeyDown={event => { if (event.key === 'Escape' && selected) closeInspector(); }}>
        <a className={styles.skip} href="#market-content">Skip to market conditions</a>
        <header className={styles.header}><a className={styles.logo} href="/main-v8">∿ Signal<span>V8</span></a><nav aria-label="Primary"><a href="/main-v8" aria-current="page">Market</a><a href="/research-v8">Research ↗</a></nav><span className={styles.headerNote}>Connected to Signal</span></header>
        <div className={styles.canvas}>
            <div className={styles.toolbar}><div className={styles.marketControls}><label className={styles.visuallyHidden} htmlFor="market-select">Market</label><select id="market-select" value={market} onChange={event => { setMarket(event.target.value as Market); resetView(); }}><option value="US">US Market</option><option value="MY">Malaysia</option></select><fieldset className={styles.segment}><legend className={styles.visuallyHidden}>Interpretation mode</legend>{(['standard','contrarian'] as const).map(value => <button key={value} aria-pressed={mode===value} onClick={() => { setMode(value); resetView(); }}>{value==='standard'?'Momentum':'Contrarian'}</button>)}</fieldset><label className={styles.sourceToggle}><input type="checkbox" checked={social} onChange={event => { setSocial(event.target.checked); resetView(); }} />{market==='MY'?'News input':'Social input'}</label></div><button className={styles.secondaryButton} disabled={loading} onClick={() => { setRevision(value=>value+1); }}>{loading?'Loading…':'Reload data'}</button></div>
            <main id="market-content" tabIndex={-1} className={styles.workspace}>
                <div className={styles.mainColumn}>
                    <div className={styles.hero}><div className={styles.heroKicker}><span>{market==='US'?'United States':'Malaysia'} / {historical?'Historical snapshot':'Market conditions'}</span><span className={styles.fixtureBadge}>Existing Signal data</span></div><h1>{historical ? `Reading on ${fullDate(historical.date)}` : !data ? loading?'Loading the market reading…':'Market data unavailable.' : !hasScore?'No observations. No market call.':data.metadata.interpretation_context?.regime ?? data.interpretation.action}</h1><p>{historical?'Archived scores and evidence are kept separate from the current reading.':data && !hasScore ? 'No current component observations were returned. Stored history remains separate.' : data?.interpretation.reasoning ?? 'Current values will appear when the service returns. No demo values are substituted.'}</p></div>
                    {response.key===key && response.error && <div className={styles.warning} role="alert"><b>{response.error}</b><span>{data?'The previous response is retained for this same configuration.':'No replacement score has been inferred.'}</span></div>}
                    {loading && <p role="status">{data?'Reloading this configuration; the previous response remains visible.':'Loading current scores and source coverage…'}</p>}
                    {data && hasScore && <>
                        {historical && <div className={styles.historyBanner}><span>{fullDate(historical.date)} · {archived?.summary.origin ?? data.metadata.score_history?.find(point=>point.date===historical.date)?.origin ?? 'Origin unavailable'}</span><button onClick={()=>setHistorical(null)}>Return to current ↗</button></div>}
                        {!historical && <MarketCoverageNotices signal={data} inputKeys={inputKeys} date={date} sourceEnabled={social} onReview={()=>openTab('Evidence')} />}
                        <section className={styles.scorePanel} aria-label="Market score and history">
                            <div className={styles.scoreStrip}><div className={styles.score}><strong data-testid="connected-score">{score}</strong><span>/100</span></div><span className={`${styles.zone} ${tierClasses[(historical ? archived?.summary.tier : data.tier) ?? 'neutral']}`}>{(historical?archived?.summary.tier:data.tier)?.replaceAll('-',' ') ?? 'Stored score'}</span><div className={`${styles.scoreMeta} ${styles.scoreDelta}`}><b>{!historical && data.metadata.score_delta?.delta != null ? signed(data.metadata.score_delta.delta) : '—'} <small>points</small></b><span>{!historical ? `vs ${fullDate(data.metadata.score_delta?.previous_date)}`:'Current comparison withheld'}</span></div><div className={styles.scoreMeta}><b>{historical?archived?`${archived.agreementPercent.toFixed(0)}%`:'—':`${data.confidence.agreement_pct.toFixed(0)}%`} <small>agreement</small></b><span>Not forecast accuracy</span></div><button className={styles.coverageButton} disabled={!!historical} onClick={()=>openTab('Evidence')}><b>{historical?archived?.components.length ?? '—':`${Object.keys(data.components).length}/${inputKeys.length}`} <small>scored inputs</small></b><span>{!historical?`${Math.round((data.metadata.coverage_adjustment?.active_weight ?? Object.values(data.components).reduce((sum,item)=>sum+item.weight,0))*100)}% included weight ↗`:'Archived evidence only'}</span></button></div>
                            <div className={styles.chartHeader}><h2>Market condition score</h2><div className={styles.range} aria-label="Chart range">{['1M','3M','All'].map(value=><button key={value} aria-pressed={range===value} onClick={()=>setRange(value)}>{value}</button>)}</div></div>
                            <MarketChart key={`${key}-${range}-${latest}-${historical?.date}`} points={chartPoints} sourced selectedDate={historical?.date} onSelect={point=>{ setSelected(null); modal.current?.close(); setHistorical(point); }} />
                            <div className={styles.chartFoot}><span>{chartPoints.length} / {history.length} stored snapshots · observed and reconstructed</span><button className={styles.textButton} disabled={!!historical} onClick={()=>openTab('History')}>Historical calibration →</button><span>{snapshotDate?`Snapshot ${fullDate(snapshotDate)}`:`Retrieved ${fullDate(response.received)} · snapshot date unavailable`}</span></div>
                            {!historical && data.metadata.trend_context && <div className={styles.seriesSummary}><span>{data.metadata.trend_context.score_trend}</span><span>{data.metadata.trend_context.last_signal_change}</span></div>}
                        </section>
                        {historical ? <section className={styles.panel} aria-label="Archived indicator evidence"><h2>Evidence for {fullDate(historical.date)}</h2>{replay.loading?<p role="status">Loading this archived record…</p>:archived?<><p>{archived.summary.coverageNote ?? 'Observed snapshot. Individual source timestamps remain distinct from snapshot capture.'}</p><div className={styles.contextList}>{archived.components.map(item=><details key={item.key}><summary><span><b>{item.displayName}</b><small>Raw {item.rawValue ?? 'unavailable'} · normalized {item.score ?? 'unavailable'}</small></span><span>{fullDate(item.lastUpdated)} ＋</span></summary><p>Stored weight {item.weight===null?'unavailable':`${(item.weight*100).toFixed(0)}%`} · contribution {item.score===null||item.weight===null?'unavailable':`${(item.score*item.weight).toFixed(2)} points`}. Source date: {fullDate(item.lastUpdated)}. No present-day values are used.</p></details>)}</div></>:<div className={styles.unavailable}><b>Historical indicator records unavailable</b><p>{replay.error} <button onClick={() => setRevision(value => value + 1)}>Retry snapshot</button> This date retains its stored score only. Current context, articles and outcomes are withheld.</p><p>{data.metadata.score_history?.find(point=>point.date===historical.date)?.coverage_note}</p></div>}</section>:<>
                            <section className={styles.indicators} aria-label="Explore indicators"><div className={styles.sectionHeading}><div><h2>Explore indicators</h2><p>Current raw values and dated evidence from the same configuration.</p></div><button className={styles.textButton} onClick={()=>openTab('Evidence')}>All evidence ↗</button></div><div className={styles.indicatorGrid}>{inputKeys.map(input=>{const item=data.components[input];const groups=archivedSeries(input,archiveData?.samples??[],archiveData?.snapshots??{});const lastArchived=groups.at(-1)?.at(-1);const disabled=(input==='social'||input==='news')&&!social;return <button key={input} data-indicator={input} className={`${styles.indicatorTile} ${selected===input?styles.selectedTile:''}`} aria-pressed={selected===input} onClick={event=>openIndicator(input,event.currentTarget)}><span className={styles.tileName}>{item?.display_name ?? getIndicatorDisplayName(input)}<span>↗</span></span><strong>{item ? formatRawValue(item, market):'—'}</strong><span className={styles.tileUnits}>Raw input · {item?`${Number(item.score.toFixed(2))}/100 normalized`:'not supplied'}</span><ArchiveSpark groups={groups} loading={!archiveData||archiveData.loading} /><span className={indicatorStatus(data,input,date).startsWith('Stale')?styles.conflict:styles.muted}>{disabled?'Disabled by you':!item?'Current value unavailable':indicatorStatus(data,input,date)}</span><small>{item?fullDate(item.last_updated):!archiveData?.loading&&lastArchived?`Historical readings only · last archived snapshot ${fullDate(lastArchived.date)}`:disabled?'Excluded by your setting':'No current observation date'}</small></button>;})}</div><p className={styles.indicatorFootnote}>Archive {archiveData?.loading ? "loading; partial history" : "loaded"} · {Object.values(archiveData?.states ?? {}).filter(state => state === "loaded").length} loaded / {Object.values(archiveData?.states ?? {}).filter(state => state === "pending").length} pending / {Object.values(archiveData?.states ?? {}).filter(state => state === "failed").length} failed / {Object.values(archiveData?.states ?? {}).filter(state => state === "unavailable").length} unavailable. Mini-charts use the latest {archiveData?.samples.length ?? 0} archived snapshot dates, retaining gaps. They are raw readings stored in snapshots, not continuous provider histories. {archiveData?.error} {!!archiveData?.error && <button onClick={() => setRevision(value => value + 1)}>Retry archive</button>}</p></section>
                            <section className={styles.confirmation} aria-label="Market confirmation"><div><span className={styles.eyebrow}>Market context · separate from the score</span><h3>Check the wider market.</h3><p>{data.metadata.interpretation_context?.breadth_note ?? 'Review dated benchmark, rates and valuation records alongside the scored inputs.'}</p></div><button className={styles.textButton} onClick={()=>openTab('Context')}>Explore market context →</button></section>
                            <section className={styles.investigation} id="investigation"><div className={styles.tabs} role="tablist" aria-label="Market investigation">{tabs.map((name,index)=><button key={name} id={`tab-${index}`} role="tab" aria-selected={tab===name} aria-controls="investigation-panel" tabIndex={tab===name?0:-1} onClick={()=>setTab(name)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;document.getElementById(`tab-${next}`)?.focus();}}>{name}</button>)}</div><div className={styles.panel} id="investigation-panel" role="tabpanel" tabIndex={-1} aria-labelledby={`tab-${tabs.indexOf(tab)}`} key={`${key}-${tab}`}>{tab==='History'?<ConnectedHistory signal={data}/>:<ConnectedPanels signal={data} tab={tab} onSelect={openIndicator}/>}</div></section>
                        </>}
                    </>}
                    {data && !hasScore && <section className={styles.empty}><h2>No usable observations returned.</h2><p>The service supplied no current components. A neutral placeholder is not shown as market evidence.</p>{history.length>0&&<><h3>Stored history only</h3><MarketChart points={history} sourced name="Stored score history"/><details><summary>Stored score records</summary><table className={styles.zoneTable}><thead><tr><th>Date</th><th>Score</th></tr></thead><tbody>{history.map(point=><tr key={point.date}><td>{fullDate(point.date)}</td><td>{point.value}</td></tr>)}</tbody></table></details></>}</section>}
                </div>
                <aside className={`${styles.rail} ${selected?styles.railSelected:''}`} ref={rail} aria-label={selected?'Selected indicator':'Reading context'}>{inspector ?? <><span className={styles.eyebrow}>The wider reading</span><h2>{historical?'Dated evidence only.':'Evidence and its limits.'}</h2>{data&&hasScore&&!historical?<>
                    {aligned&&<button className={`${styles.evidenceCard} ${styles.supportCard}`} onClick={event=>openIndicator(aligned[0],event.currentTarget)}><span className={styles.cardIcon}>↗</span><span><small>Largest aligned weight</small><b>{aligned[1].display_name}</b><span>{Number(aligned[1].score.toFixed(2))}/100 normalized · {fullDate(aligned[1].last_updated)}</span></span></button>}
                    {conflicting&&<button className={`${styles.evidenceCard} ${styles.conflictCard}`} onClick={event=>openIndicator(conflicting[0],event.currentTarget)}><span className={styles.cardIcon}>↘</span><span><small>Conflicting input</small><b>{conflicting[1].display_name}</b><span>Disagrees with the overall weighted reading.</span></span></button>}
                    <p>{data.confidence.warning ?? data.metadata.interpretation_context?.limitation ?? 'Agreement is descriptive, not a probability forecast.'}</p><div className={styles.railSection}><h3>Conflicting evidence</h3><p>{data.confidence.conflicting_indicators.map(input=>data.components[input]?.display_name ?? getIndicatorDisplayName(input)).join(', ') || 'No conflicts identified by the service.'}</p></div><div className={styles.railSection}><h3>Source coverage</h3><p>{data.metadata.signal_quality?.confidence_explanation ?? 'Inspect source dates and included weights before relying on the summary.'}</p><button className={styles.primaryButton} onClick={()=>openTab('Evidence')}>Review the evidence →</button></div></>:<p>{historical?'Return to current to inspect current context and scenarios.':'No interpretation is supplied until data is available.'}</p>}<a className={styles.researchLink} href="/research-v8"><span>Saved company research stays separate from market conditions.</span><b>Open Research ↗</b></a></>}</aside>
            </main>
            <footer className={styles.footer}><span>Connected Market V8 · existing Signal service</span><details><summary>Data scope & limitations</summary><p>Scores, raw inputs, context and calibration come from the existing service. Provider availability and old source dates are not repaired in the UI. Historical reconstructed records remain labelled; mini-charts use bounded archived snapshots. The existing service manages its own cache and snapshot storage. Scenarios are local assumptions. Research uses existing saved records.</p><a className={styles.textButton} href="/main-v8?demo=1">Open representative demo →</a></details></footer>
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

function ArchiveSpark({ groups, loading }: { groups: Point[][]; loading: boolean }) {
    const points=groups.flat();
    if (loading && !points.length) return <span className={styles.noHistory}>Loading archived readings…</span>;
    if (points.length<2) return <span className={styles.noHistory}>History unavailable</span>;
    const first=Date.parse(points[0].date), last=Date.parse(points.at(-1)!.date), values=points.map(point=>point.value);
    const min=Math.min(...values), max=Math.max(...values);
    const x=(point:Point)=>3+(Date.parse(point.date)-first)/(last-first||1)*154;
    const y=(point:Point)=>41-(point.value-min)/(max-min||1)*38;
    return <svg className={styles.sparkline} viewBox="0 0 160 44" aria-hidden="true" data-testid="archive-spark">{groups.map((group,index)=><g key={index}><path d={group.map((point,i)=>`${i?'L':'M'}${x(point)},${y(point)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2"/>{group.map(point=><circle key={point.date} cx={x(point)} cy={y(point)} r="2" fill="currentColor"/>)}</g>)}</svg>;
}
