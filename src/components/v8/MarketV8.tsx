'use client';

import { useEffect, useRef, useState } from 'react';
import { MarketV8Connected } from './MarketV8Connected';
import { getCalibrationZone } from '@/lib/market-calibration';
import { contextIndicatorReading } from './market-v8-restored-fixtures';
import { MarketConfirmation } from './MarketV8Restored';
import { MarketChart, Sparkline } from './MarketV8Chart';
import { IndicatorInspector, InvestigationPanel } from './MarketV8Panels';
import { archiveDate, currentDate, dateLabel, indicatorsFor, scoreHistory, signalFor, signed, stance, tabs, zoneLabel, type Example, type InvestigationTab, type Market, type Mode, type Point } from './market-v8-fixtures';
import styles from './market-v8.module.css';

export function MarketV8({ demo = false }: { demo?: boolean }) {
    return demo ? <MarketV8Demo /> : <MarketV8Connected />;
}

function MarketV8Demo() {
    const [market, setMarket] = useState<Market>('US');
    const [mode, setMode] = useState<Mode>('standard');
    const [example, setExample] = useState<Example>('populated');
    const [sourceOn, setSourceOn] = useState(true);
    const [tab, setTab] = useState<InvestigationTab>('What changed');
    const [selected, setSelected] = useState<string | null>(null);
    const [historical, setHistorical] = useState<Point | null>(null);
    const [range, setRange] = useState('3M');
    const [refreshed, setRefreshed] = useState(false);
    const trigger = useRef<HTMLButtonElement | null>(null);
    const priorView = useRef<{ tab: InvestigationTab; selected: string | null }>({ tab: 'What changed', selected: null });
    const modal = useRef<HTMLDialogElement>(null);
    const rail = useRef<HTMLElement>(null);
    const currentIndicators = indicatorsFor(market, example).map(item => item.context ? { ...item, ...contextIndicatorReading(market, example === 'missing') } : item);
    const current = signalFor(currentIndicators, market, mode, sourceOn);
    const prior = signalFor(currentIndicators, market, mode, sourceOn, true);
    const archivedIndicators = indicatorsFor(market, 'populated', true);
    const archived = signalFor(archivedIndicators, market, mode, sourceOn, false, archiveDate);
    const hasEvidence = !historical || historical.date === archiveDate;
    const indicators = historical ? archivedIndicators : currentIndicators;
    const signal = historical ? archived : current;
    const activeDate = historical?.date ?? currentDate;
    const score = historical?.value ?? current.composite_score;
    const histories = scoreHistory(current.composite_score, archived.composite_score, prior.composite_score);
    const datedSeries = histories.filter(point => point.date <= activeDate);
    const recentStart = datedSeries[Math.max(0, datedSeries.length - 5)];
    const recentChange = score - recentStart.value;
    const lastZoneChange = datedSeries.slice(1).map((point, index) => getCalibrationZone(point.value) !== getCalibrationZone(datedSeries[index].value) ? point.date : null).filter(Boolean).at(-1);
    const chartPoints = range === '1M' ? histories.filter(p => p.date >= '2026-08-04') : histories;
    const selectedIndicator = indicators.find(i => i.key === selected);
    const empty = example === 'empty';
    const conflict = indicators.find(i => stance(i, signal) === 'Conflict');
    const support = [...indicators].filter(i => stance(i, signal) === 'Support').sort((a, b) => signal.components[b.key].score * signal.components[b.key].weight - signal.components[a.key].score * signal.components[a.key].weight)[0];
    const difference = current.composite_score - prior.composite_score;
    const headline = historical ? `Conditions were ${zoneLabel(score, mode).toLowerCase()}` : mode === 'contrarian' ? score >= 65 ? 'Optimism calls for caution.' : 'No clear sentiment extreme.' : score >= 65 ? 'Conditions lean positive.' : 'Conditions are mixed.';

    function openInvestigation(name: InvestigationTab) { setTab(name); requestAnimationFrame(() => { const panel = document.getElementById('investigation-panel'); panel?.scrollIntoView({ block: 'start' }); panel?.focus({ preventScroll: true }); }); }
    function closeInspector() {
        modal.current?.close(); setSelected(null);
        requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus(); });
    }
    function selectIndicator(key: string, element: HTMLButtonElement) { trigger.current = element; setSelected(key); }
    function resetView() { modal.current?.close(); setSelected(null); setHistorical(null); setTab('What changed'); setRefreshed(false); }
    function returnToCurrent() { setHistorical(null); setTab(priorView.current.tab); setSelected(priorView.current.selected); }
    function selectDate(point: Point) {
        if (point.date === currentDate) { returnToCurrent(); return; }
        if (!historical) priorView.current = { tab, selected };
        setHistorical(point); setTab('History'); setSelected(null);
    }
    useEffect(() => {
        if (!selected) return;
        const media = window.matchMedia('(max-width: 900px)');
        const previousOverflow = document.body.style.overflow;
        const syncInspector = () => {
            if (media.matches) {
                if (!modal.current?.open) modal.current?.showModal();
                document.body.style.overflow = 'hidden';
            } else {
                modal.current?.close();
                document.body.style.overflow = previousOverflow;
                rail.current?.querySelector<HTMLButtonElement>('button')?.focus();
            }
        };
        syncInspector();
        media.addEventListener('change', syncInspector);
        return () => { media.removeEventListener('change', syncInspector); document.body.style.overflow = previousOverflow; };
    }, [selected]);

    const inspector = selectedIndicator ? <IndicatorInspector indicator={selectedIndicator} signal={signal} previous={prior} date={activeDate} historical={!!historical} unavailable={!hasEvidence} onClose={closeInspector} /> : null;
    return <div className={styles.app} onKeyDown={e => { if (e.key === 'Escape' && selected && !modal.current?.open) closeInspector(); }}>
        <a className={styles.skip} href="#market-content">Skip to market conditions</a>
        <header className={styles.header}>
            <a className={styles.logo} href="/main-v8" aria-label="Signal Market V8"><svg viewBox="0 0 34 26" aria-hidden="true"><path d="M2 16h5c4 0 4-12 8-12s3 20 7 20 4-9 7-9h3" /></svg>Signal<span>V8</span></a>
            <nav aria-label="Primary"><a href="/main-v8" aria-current="page">Market</a><a href="/research-v8">Research <span aria-hidden="true">↗</span></a></nav>
            <span className={styles.headerNote}><span className={styles.liveDot} />A wider perspective.</span>
        </header>
        <div className={styles.canvas}>
            <div className={styles.toolbar}>
                <div className={styles.marketControls}><label className={styles.visuallyHidden} htmlFor="market-select">Market</label><select id="market-select" value={market} onChange={e => { setMarket(e.target.value as Market); resetView(); }}><option value="US">US Market</option><option value="MY">Malaysia</option></select><fieldset className={styles.segment}><legend className={styles.visuallyHidden}>Interpretation mode</legend>{(['standard', 'contrarian'] as const).map(value => <button key={value} aria-pressed={mode === value} onClick={() => { setMode(value); resetView(); }}>{value === 'standard' ? 'Momentum' : 'Contrarian'}</button>)}</fieldset><label className={styles.sourceToggle}><input type="checkbox" checked={sourceOn} disabled={market === 'MY'} onChange={e => { setSourceOn(e.target.checked); resetView(); }} />Social input{market === 'MY' ? ' · US only' : ''}</label></div>
                <label className={styles.exampleSelect}>Representative fixture<select aria-label="Example state" value={example} onChange={e => { setExample(e.target.value as Example); resetView(); }}><option value="populated">Populated</option><option value="missing">Partial / stale</option><option value="empty">Empty</option></select></label>
            </div>
            <main id="market-content" className={styles.workspace}>
                <div className={styles.mainColumn}>
                    <div className={styles.hero}>
                        <div className={styles.heroKicker}><span>{market === 'US' ? 'United States' : 'Malaysia'} / {historical ? 'Historical snapshot' : 'Market conditions'}</span><span className={styles.fixtureBadge}>Illustrative data</span></div>
                        <h1>{empty ? 'Start with the evidence.' : headline}</h1>
                        <p>{empty ? 'There are no market observations in this example. A missing reading is not a neutral market.' : historical ? `${dateLabel(activeDate)} 2026 · ${hasEvidence ? 'Explore the evidence available for this example snapshot.' : 'Only a score record is supplied for this date.'}` : example === 'missing' ? 'Coverage has fallen. Separate changes in available evidence from changes in market conditions.' : market === 'US' ? mode === 'standard' ? 'Sentiment supports the reading. Volatility keeps the picture from being one-sided.' : 'Strong sentiment can indicate crowding. Volatility complicates the contrarian interpretation.' : 'News carries 65% of the model weight. Independent local evidence matters.'}</p>
                    </div>
                    {empty ? <section className={styles.empty}><span className={styles.emptyGlyph}>∿</span><h2>No observations. No market call.</h2><p>Score, history and source coverage are unavailable. Explore a representative populated case to try the interface.</p><button className={styles.primaryButton} onClick={() => setExample('populated')}>Explore populated example →</button></section> : <>
                        {historical ? <div className={styles.historyBanner}><span>Viewing <b>{dateLabel(activeDate)} 2026</b> · {hasEvidence ? 'Dated fixture records' : 'Score record only'}</span><button onClick={returnToCurrent}>Return to current ↗</button></div> : example === 'missing' && <div className={styles.warning}><b>Some evidence is excluded.</b><span>Stale or missing inputs are excluded. Their weights retain neutral reserve, which does not count as current evidence.</span><button onClick={() => setTab('Evidence')}>Review coverage →</button></div>}
                        <section className={styles.scorePanel} aria-label="Market score and history">
                            <div className={styles.scoreStrip}><div className={styles.score}><strong>{score}</strong><span>/100</span></div><span className={styles.zone}>{zoneLabel(score, mode)}</span><div className={styles.scoreMeta}><b>{historical ? signed(current.composite_score - score, 0) : signed(difference, 0)} <small>points</small></b><span>{historical ? `Current ${current.composite_score} · 4 Sep` : `vs ${prior.composite_score} · 3 Sep`}</span></div><div className={styles.scoreMeta}><b>{hasEvidence ? `${Math.round(signal.confidence.agreement_pct)}%` : '—'} <small>agreement</small></b><span>{hasEvidence ? `${indicators.filter(item => stance(item, signal) === 'Conflict').length} conflicts · not forecast accuracy` : 'Not forecast accuracy'}</span></div><button className={styles.coverageButton} onClick={() => setTab('Evidence')}><b>{hasEvidence ? `${Object.keys(signal.components).length}/${market === 'US' ? 6 : 3}` : '—'} <small>scored inputs</small></b><span>{hasEvidence ? `${Math.round((signal.metadata.coverage_adjustment?.active_weight ?? 0) * 100)}% observed weight ↗` : 'Records unavailable'}</span></button></div>
                            <div className={styles.chartHeader}><h2>Market condition score</h2><div className={styles.range} aria-label="Chart range">{['1M', '3M', 'All'].map(value => <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{value}</button>)}</div></div>
                            <MarketChart key={`${range}-${activeDate}-${score}`} points={chartPoints} selectedDate={historical?.date} onSelect={selectDate} />
                            <div className={styles.chartFoot}><button className={styles.textButton} onClick={() => selectDate({ date: archiveDate, value: archived.composite_score })}>Compare 28 Aug snapshot ↗</button><button className={styles.textButton} onClick={() => openInvestigation('History')}>Historical calibration →</button><span>{historical ? 'Later scores shown for comparison only' : 'Snapshot · 4 Sep 2026, 21:00 UTC'}</span></div>
                            <div className={styles.seriesSummary} aria-label="Score trend summary"><span>Available overview series: {recentChange > 0 ? 'rising' : recentChange < 0 ? 'falling' : 'flat'} · {signed(recentChange, 0)} pts since {dateLabel(recentStart.date)}</span><span>Last zone change in available overview history: {lastZoneChange ? dateLabel(lastZoneChange) + ' 2026' : 'none recorded'}</span></div>
                        </section>
                        {!historical && <div className={styles.mobileChange}><b>{signed(difference, 0)} points since 3 Sep</b><span>{example === 'missing' ? 'Lost coverage explains most of the change.' : market === 'US' ? 'Volatility improved, but still conflicts.' : 'News strengthened; coverage remains concentrated.'}</span><button onClick={() => { setTab('What changed'); document.getElementById('investigation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>See what changed ↓</button></div>}
                        <section className={styles.indicators} aria-label="Explore indicators"><div className={styles.sectionHeading}><div><h2>Explore indicators</h2><p>Follow the individual signals behind the wider picture.</p></div><button className={styles.textButton} onClick={() => setTab('Evidence')}>All evidence ↗</button></div>
                            {!hasEvidence ? <div className={styles.unavailable}><b>Historical indicator records unavailable</b><p>No current readings are substituted. The 28 August example includes underlying records.</p><button className={styles.textButton} onClick={() => selectDate({ date: archiveDate, value: archived.composite_score })}>Inspect complete historical example →</button></div> : <div className={styles.indicatorGrid}>{indicators.map(indicator => {
                                const label = stance(indicator, signal);
                                const isStale = indicator.date === '2026-08-20';
                                return <button key={indicator.key} data-indicator={indicator.key} className={`${styles.indicatorTile} ${selected === indicator.key ? styles.selectedTile : ''}`} aria-pressed={selected === indicator.key} onClick={e => selectIndicator(indicator.key, e.currentTarget)}>
                                    <span className={styles.tileName}>{indicator.short}<span aria-hidden="true">↗</span></span><strong>{indicator.value === null ? '—' : indicator.value.toFixed(indicator.key === 'put_call' ? 3 : indicator.key === 'social' || indicator.key === 'news' ? 2 : 1)}</strong><span className={styles.tileUnits}>{indicator.units || 'Context only'}</span>
                                    <Sparkline points={indicator.history} weekly={indicator.cadence === 'Weekly'} />
                                    <span className={label === 'Conflict' || isStale ? styles.conflict : label === 'Support' ? styles.support : styles.muted}>{isStale ? 'Stale · excluded' : label}</span><small>{indicator.value === null ? 'No observation' : `${dateLabel(indicator.date)} · ${indicator.cadence}`}</small>
                                </button>;
                            })}</div>}<p className={styles.indicatorFootnote}>Raw trends · 3 Jun–{dateLabel(activeDate)} 2026 · weekly observations retain their cadence · context is not scored</p>
                        </section>
                        {!historical && <MarketConfirmation market={market} partial={example === 'missing'} onOpen={() => openInvestigation('Context')} />}
                        <section className={styles.investigation} id="investigation"><div className={styles.tabs} role="tablist" aria-label="Market investigation">{tabs.map((name, index) => <button key={name} id={`tab-${index}`} role="tab" aria-selected={tab === name} aria-controls="investigation-panel" tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; document.getElementById(`tab-${next}`)?.focus(); } }}>{name}</button>)}</div><div className={styles.panel} id="investigation-panel" role="tabpanel" tabIndex={-1} aria-labelledby={`tab-${tabs.indexOf(tab)}`}><InvestigationPanel partial={example === 'missing'} socialEnabled={sourceOn} key={`${market}-${mode}-${example}-${activeDate}-${sourceOn}-${tab}`} tab={tab} indicators={indicators} signal={signal} previous={prior} market={market} mode={mode} historical={!!historical} available={hasEvidence} date={activeDate} onSelect={selectIndicator} /></div></section>
                    </>}
                </div>
                <aside className={`${styles.rail} ${selected ? styles.railSelected : ''}`} ref={rail} aria-label={selected ? 'Selected indicator' : 'Reading context'}>
                    {inspector ?? <>
                        <div className={styles.railHeading}><span className={styles.eyebrow}>The wider reading</span><span className={styles.orbit} aria-hidden="true">◎</span></div><h2>{empty ? 'Evidence comes first.' : historical ? 'Past reading. Dated evidence.' : 'Evidence in balance.'}</h2>
                        {empty ? <p>No interpretation is supplied without observations. Choose a populated fixture to explore.</p> : historical ? <><p>{dateLabel(activeDate)} 2026 · synthetic snapshot. {hasEvidence ? 'Underlying fixture records are available.' : 'Only a score and date are supplied.'}</p><div className={styles.railSection}><span className={styles.eyebrow}>Current comparison</span><strong className={styles.comparisonScore}>{current.composite_score}<small>/100</small></strong><p>4 Sep 2026 · current is {Math.abs(current.composite_score - score)} points {current.composite_score >= score ? 'higher' : 'lower'}.</p><button className={styles.primaryButton} onClick={returnToCurrent}>Return to current →</button></div></> : <>
                            {support && <button className={`${styles.evidenceCard} ${styles.supportCard}`} onClick={e => selectIndicator(support.key, e.currentTarget)}><span className={styles.cardIcon}>↗</span><span><small>Strongest aligned input</small><b>{support.short === 'AAII' ? 'Investors remain optimistic' : support.name}</b><span>{support.cadence === 'Weekly' ? 'Weekly observation' : 'Available observation'} · {dateLabel(support.date)}</span></span></button>}
                            {conflict ? <button className={`${styles.evidenceCard} ${styles.conflictCard}`} onClick={e => selectIndicator(conflict.key, e.currentTarget)}><span className={styles.cardIcon}>↘</span><span><small>Unresolved conflict</small><b>{conflict.key === 'vix' ? 'Volatility still matters' : conflict.name}</b><span>Its reading disagrees with the composite.</span></span></button> : <div className={styles.explanation}><b>Agreement is incomplete</b><p>Mixed inputs and limited coverage can weaken the overall reading.</p></div>}
                            <div className={styles.railSection}><h3>What deserves a closer look?</h3><p>{market === 'US' ? 'Check whether calmer volatility is enough to support the sentiment-led reading.' : 'Check whether local evidence supports the news-led reading.'}</p><button className={styles.primaryButton} onClick={e => selectIndicator(market === 'US' ? 'vix' : 'news', e.currentTarget)}>Inspect {market === 'US' ? 'volatility' : 'news evidence'} →</button></div>
                            <div className={styles.railSection}><span className={styles.eyebrow}>Keep in mind</span><p>{market === 'US' ? 'The manual SSI slot is unset. Its neutral reserve is model accounting, not observed sentiment.' : 'AAII is a US survey proxy. Malaysia’s news weight makes source concentration particularly relevant.'}</p><button className={styles.textButton} onClick={() => setTab('Evidence')}>Coverage & methodology ↗</button></div>
                        </>}
                        <a className={styles.researchLink} href="/research-v8"><span>Next, the company’s own evidence.</span><b>Open Research <span>↗</span></b></a>
                    </>}
                </aside>
            </main>
            <footer className={styles.footer}><span><span className={styles.liveDot} />V8 exploration · synthetic data · nothing is saved <a href="/main-v8">Return to connected Market →</a></span><details><summary>Prototype scope & limitations</summary><p>Interactive Market exploration. No live feeds, API changes, persistence, notifications or financial recommendations. Fixture normalized scores use the existing calculator; scenarios use the existing sensitivity helper. Context observations and calibration outcomes are synthetic, with no provider evidence. Calibration is separate from score history. Research opens the existing V8 exploration. The fixed snapshot date is 4 September 2026.</p><button className={styles.secondaryButton} onClick={() => setRefreshed(true)}>Recheck fixture</button><p role="status">{refreshed ? 'Fixture unchanged. No live request was sent.' : ''}</p></details></footer>
        </div>
        <dialog className={styles.mobileInspector} ref={modal} onCancel={e => { e.preventDefault(); closeInspector(); }} onKeyDown={e => {
            if (e.key !== 'Tab') return;
            const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])')).filter(el => el.getClientRects().length && !el.hasAttribute('disabled'));
            const first = controls[0]; const last = controls.at(-1);
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
        }} aria-label="Indicator detail"><div className={styles.mobileInspectorTop}><button onClick={closeInspector}>← Back to Market</button><span>Illustrative snapshot</span></div>{inspector}</dialog>
    </div>;
}
