'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { companies, researchEvidence, type Company, type FixtureState } from './fixtures';
import { FinancialCoverageV8, ResearchChecksV8, ResearchToolsV8, ReviewCheckpointV8, researchV8Tabs as tabs, type ResearchV8Tab as Tab } from './ResearchV8Workflow';
import base from './market-v8.module.css';
import styles from './research-v8.module.css';

type EvidenceFilter = 'All' | 'Supports' | 'Challenges' | 'Gaps';

export function ResearchV8() {
    const [state, setState] = useState<FixtureState>('populated');
    const [selected, setSelected] = useState(companies[0]);
    const [query, setQuery] = useState('');
    const [region, setRegion] = useState('All');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const matches = companies.filter(company => (region === 'All' || company.market === region) && `${company.name} ${company.id} ${company.market}`.toLowerCase().includes(query.toLowerCase().trim()));
    const selectedIndex = matches.findIndex(company => company.id === selected.id);
    return <div className={`${base.app} ${styles.app}`}>
        <a className={base.skip} href="#v8-content">Skip to content</a>
        <header className={base.header}>
            <a className={base.logo} href="/main-v8">∿ Signal<span>V8</span></a>
            <nav aria-label="Primary"><a href="/main-v8">Market</a><a href="/research-v8" aria-current="page">Research</a></nav>
            <span className={base.headerNote}>Company research</span>
        </header>
        <main id="v8-content" tabIndex={-1} className={base.canvas}>
            <div className={styles.toolbar}>
                <label className={styles.search}><span>Find a company</span><span className={styles.searchField}><span aria-hidden="true">⌕</span><input type="search" placeholder="Name or example ID" value={query} onChange={event => setQuery(event.target.value)} disabled={state === 'empty'} /></span></label>
                <button className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="research-v8-filters" onClick={() => setFiltersOpen(open => !open)}>Filters{region !== 'All' ? ' (1)' : ''}</button>
                <label className={styles.stateControl}>Example state<select value={state} onChange={event => setState(event.target.value as FixtureState)}><option value="populated">Populated</option><option value="missing">Missing data</option><option value="empty">Empty</option></select></label>
            </div>
            {filtersOpen && <div id="research-v8-filters" className={styles.filterPanel}><label>Region<select value={region} onChange={event => setRegion(event.target.value)}><option>All</option><option>US</option><option>MY</option></select></label><button className={base.textButton} onClick={() => { setRegion('All'); setQuery(''); }}>Reset filters</button><span>{matches.length} matching example{matches.length === 1 ? '' : 's'}</span></div>}
            <ResearchToolsV8 />
            <div className={styles.fixtureNotice}><span className={base.fixtureBadge}>Design prototype</span><span>Fictional companies · synthetic financials · notes last for this session only</span></div>
            {state === 'empty' ? <section className={styles.emptyWorkspace}>
                <span className={styles.emptyIcon} aria-hidden="true">↗</span><span className={base.eyebrow}>YOUR RESEARCH WORKSPACE</span>
                <h1>Start with a question. Build a case.</h1><p>No companies or evidence in this example. Begin with a business you want to understand, then gather the evidence to test your view.</p>
                <button className={base.primaryButton} onClick={() => { setState('populated'); setQuery(''); setRegion('All'); setSelected(companies[0]); }}>Explore the populated example <span aria-hidden="true">↗</span></button>
            </section> : <>
                <section className={styles.companySection} aria-label="Company notebook">
                    <div className={styles.sectionLabel}><span>Your investigations <b>{matches.length} / {companies.length}</b></span><small>Example cases</small></div>
                    <div className={styles.companyList}>{matches.map(company => <button key={company.id} className={styles.companyButton} aria-pressed={selected.id === company.id} onClick={() => setSelected(company)}>
                        <span className={styles.monogram} aria-hidden="true">{company.id.slice(0, 1)}</span><span><b>{company.name}</b><small>{company.id} · {company.market} · {company.coverage}</small></span><span className={styles.companyArrow} aria-hidden="true">↗</span>
                    </button>)}</div>
                    <div className={styles.mobilePicker}><button aria-label="Previous company" disabled={selectedIndex <= 0} onClick={() => setSelected(matches[selectedIndex - 1])}>←</button><label><span className={base.visuallyHidden}>Selected company</span><select value={selectedIndex < 0 ? '' : selected.id} onChange={event => { const next = matches.find(company => company.id === event.target.value); if (next) setSelected(next); }}>{selectedIndex < 0 && <option value="" disabled>{selected.name} · outside results</option>}{matches.map(company => <option key={company.id} value={company.id}>{company.id} · {company.name}</option>)}</select></label><button aria-label="Next company" disabled={selectedIndex < 0 || selectedIndex >= matches.length - 1} onClick={() => setSelected(matches[selectedIndex + 1])}>→</button></div>
                    {matches.length === 0 && <div className={styles.searchEmpty}><p>No example matches{query.trim() ? ` “${query}”` : ' the selected region'}.</p><button className={base.textButton} onClick={() => { setQuery(''); setRegion('All'); }}>Clear search</button></div>}
                    {!matches.some(company => company.id === selected.id) && <p className={styles.searchHint}>The open case is outside these search results.</p>}
                </section>
                <ResearchCase key={selected.id} company={selected} state={state} />
            </>}
            <footer className={styles.footer}><span>Signal V8 · research exploration</span><details><summary>Data scope & limitations</summary><p>No real report or live quote is attached. Financial observations are synthetic; interpretations are examples, not recommendations. Your notes and review acknowledgement reset on reload, route or company changes, or entering Empty. Saved research, alerts and task creation are not connected.</p></details></footer>
        </main>
    </div>;
}

function ResearchCase({ company, state }: { company: Company; state: FixtureState }) {
    const [tab, setTab] = useState<Tab>('Overview');
    const [filter, setFilter] = useState<EvidenceFilter>('All');
    const [editor, setEditor] = useState(false);
    const [draft, setDraft] = useState('');
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('');
    const [reviewed, setReviewed] = useState(false);
    const [reviewDate, setReviewDate] = useState('');
    const [reviewReason, setReviewReason] = useState('');
    const [reviewContext, setReviewContext] = useState('General company review');
    const noteInput = useRef<HTMLTextAreaElement>(null);
    const statusRef = useRef<HTMLParagraphElement>(null);
    const investigation = useRef<HTMLElement>(null);
    const blank = company.id === 'RIMBA';
    const missing = state === 'missing' || company.id === 'MERIDIAN';
    const hasEvidence = !blank && !missing;
    const evidence = researchEvidence.filter(row => filter === 'All' || row.tone === filter);
    const openTab = (value: Tab, scroll = false) => {
        setTab(value);
        if (scroll) requestAnimationFrame(() => { investigation.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); document.getElementById(`research-tab-${value}`)?.focus({ preventScroll: true }); });
    };
    const startReview = () => { if (!editor) setDraft(note); setEditor(true); setStatus(''); setTab('Review'); requestAnimationFrame(() => noteInput.current?.focus()); };
    const announce = (message: string) => { setStatus(message); requestAnimationFrame(() => statusRef.current?.focus()); };
    const tabKeys = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')];
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        event.preventDefault(); buttons[next]?.focus();
    };
    return <div className={styles.workspace}>
        <article className={styles.case}>
            <div className={base.hero}>
                <div className={base.heroKicker}><span>{company.market} / {company.sector}</span><span className={base.fixtureBadge}>Fictional company</span></div>
                <h1>{company.name}</h1><p>{blank ? 'The first useful question is still unwritten.' : missing ? 'A thesis needs evidence you can inspect.' : 'Growth is visible. Cash conversion needs a closer look.'}</p>
            </div>
            <section className={styles.reading} aria-label="Research status">
                <div className={styles.decision}><small>Research position</small><strong>{hasEvidence ? 'Watch' : 'Not assessed'}</strong><span>{hasEvidence ? 'Example decision · gaps remain' : 'Evidence needed'}</span></div>
                <div><small>Financial evidence</small><b>{hasEvidence ? '2 observations' : 'Not available'}</b><span>{hasEvidence ? 'FY2025 · latest period unverified' : 'No comparable report'}</span></div>
                <div><small>Current price</small><b>Unavailable</b><span>No live quote</span></div>
                <button onClick={() => openTab('Valuation', true)}><small>Valuation</small><b>Not assessed <span aria-hidden="true">↗</span></b><span>Inputs needed</span></button>
            </section>
            <section className={styles.nextGap} aria-label="Next research gap"><div><span className={base.eyebrow}>NEXT RESEARCH GAP</span><h2>{blank ? 'Write a question you can test.' : hasEvidence ? 'Explain the cash-flow gap.' : 'Find a dated primary report.'}</h2><p>{hasEvidence ? 'Growth and cash flow moved in opposite directions. The cause is still unverified.' : 'Start with the business question and the evidence needed to answer it.'}</p></div><button className={base.primaryButton} onClick={hasEvidence ? () => openTab('Financials', true) : startReview}>{hasEvidence ? 'Inspect financials' : 'Draft the question'} <span aria-hidden="true">↗</span></button></section>
            <ResearchChecksV8 hasEvidence={hasEvidence} blank={blank} onNavigate={value => openTab(value, true)} />
            <section className={styles.investigation} ref={investigation} aria-label="Company investigation">
                <div className={`${base.tabs} ${styles.tabs}`} role="tablist" aria-label="Research investigation" onKeyDown={tabKeys}>{tabs.map(value => <button key={value} id={`research-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls="research-panel" tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)}>{value}{value === 'Review' && note && <span className={styles.noteDot} aria-label="Working note added" />}</button>)}</div>
                <div id="research-panel" role="tabpanel" aria-labelledby={`research-tab-${tab}`} tabIndex={0} className={`${base.panel} ${styles.panel}`}>
                    {tab === 'Overview' && <>
                        <div className={styles.overviewBrief}><span className={base.eyebrow}>THE CASE IN ONE MINUTE</span><h2>{blank ? 'Start with the business.' : hasEvidence ? 'Growth is visible. Its quality needs testing.' : 'Keep the thesis separate from missing facts.'}</h2><p>{hasEvidence ? 'The example thesis rests on recurring demand. Revenue increased, but cash generation weakened. Retention, spending and working-capital evidence are needed before judging durability.' : 'An unfinished case is a useful starting point. A view becomes testable when it has a dated source, a reason to believe it and a condition that would prove it wrong.'}</p><div className={styles.briefMetrics}><button onClick={() => openTab('Financials', true)}><span>Revenue change</span><b>{hasEvidence ? '+20%' : 'Unavailable'}</b><small>{hasEvidence ? 'FY2025 vs FY2024 · fixture' : 'No report supplied'}</small></button><button onClick={() => openTab('Financials', true)}><span>Free cash flow change</span><b className={styles.negative}>{hasEvidence ? '−33.3%' : 'Unavailable'}</b><small>{hasEvidence ? 'FY2025 vs FY2024 · fixture' : 'No report supplied'}</small></button></div></div>
                        <div className={styles.panelHeading}><div><span className={base.eyebrow}>OBSERVATIONS → INTERPRETATION → GAPS</span><h2>The evidence file</h2></div><span className={base.tag}>{hasEvidence ? '2 observations / 1 gap' : '0 observations'}</span></div>
                        <div className={styles.filters} aria-label="Filter research evidence">{(['All', 'Supports', 'Challenges', 'Gaps'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
                        {!hasEvidence ? <div className={styles.unavailable}><span className={styles.emptyIcon} aria-hidden="true">∅</span><h3>{blank ? 'No evidence attached yet.' : 'Financial evidence is missing.'}</h3><p>{blank ? 'Start with a primary report and one question you want it to answer.' : 'Revenue, cash flow and source provenance are unavailable. Missing values are not zero; no financial conclusion is generated.'}</p><button className={base.textButton} onClick={startReview}>Draft the next research question ↗</button></div> : evidence.map(row => <details className={styles.evidenceRow} key={row.id}>
                            <summary><span className={`${styles.tone} ${row.tone === 'Supports' ? styles.support : row.tone === 'Challenges' ? styles.challenge : styles.gap}`}>{row.tone}</span><h3>{row.title}</h3><span className={styles.expand} aria-hidden="true">+</span></summary>
                            <div className={styles.evidenceDetail}><div><span className={base.eyebrow}>FIXTURE OBSERVATION · NOT A SOURCED FACT</span><p>{row.observation}</p><small>{row.source}. No actual report is attached.</small></div><div><span className={base.eyebrow}>DERIVED INTERPRETATION · EXAMPLE</span><p>{row.interpretation}</p></div><div className={styles.gapNote}><b>Still unknown</b><p>{row.gap}</p><button className={base.textButton} onClick={() => { setReviewContext(row.gap); startReview(); }}>Investigate this gap ↗</button></div></div>
                        </details>)}
                        <p className={styles.helper}>Supporting evidence and conflicting evidence belong in the same case. Expand a row to inspect the reasoning.</p>
                    </>}
                    {tab === 'Financials' && <><FinancialComparison available={hasEvidence} /><FinancialCoverageV8 available={hasEvidence} onReview={startReview} /></>}
                    {tab === 'Thesis' && <>
                        <div className={styles.panelHeading}><div><span className={base.eyebrow}>EXAMPLE USER RESEARCH</span><h2>Working thesis</h2></div><span className={base.tag}>Authored reasoning</span></div>
                        <p className={styles.thesisText}>{blank ? 'No thesis written yet.' : missing ? 'Can growth fund itself? Financial evidence has not been attached.' : 'Recurring demand could support durable growth. Cash conversion needs to be established before considering an entry.'}</p>
                        <div className={styles.thesisGrid}><div><h3>Bull case · what needs to hold?</h3><p>{blank ? 'Define the business condition you want to test.' : 'Demand must be durable and growth must translate into cash. Retention and working-capital details remain unverified.'}</p></div><div><h3>Bear case · what could go wrong?</h3><p>{blank ? 'Write the strongest alternative explanation.' : 'Growth could require more investment than expected, while weaker cash conversion limits flexibility. This is a hypothesis to test, not an observed cause.'}</p></div><div><h3>What would invalidate this thesis?</h3><p>{blank ? 'Name an observable outcome that would challenge your view.' : 'Persistent cash-flow deterioration despite revenue growth would challenge this thesis. The cause and threshold still need evidence.'}</p></div><div><h3>Entry & exit conditions</h3><p>No price triggers or exit thresholds have been established. Valuation and downside assumptions are still needed.</p><button className={base.textButton} onClick={() => openTab('Valuation', true)}>Review valuation gaps ↗</button></div></div>
                        <p className={styles.helper}>This is example authored reasoning, not an automatic buy or sell rule.</p><button className={base.textButton} onClick={startReview}>Write your next thesis question ↗</button>
                    </>}
                    {tab === 'Valuation' && <>
                        <div className={styles.panelHeading}><div><span className={base.eyebrow}>BUSINESS QUALITY ≠ ENTRY PRICE</span><h2>Value still needs a price.</h2></div><span className={styles.tone}>Not assessed</span></div>
                        <p>No current price, comparable valuation or target entry range is supplied. The financial comparison alone cannot establish a suitable entry.</p>
                        <dl className={styles.valuationInputs}><div><dt>Dated market price</dt><dd>Unavailable</dd></div><div><dt>Filing-aligned valuation inputs</dt><dd>Incomplete</dd></div><div><dt>Downside assumptions</dt><dd>Not written</dd></div></dl>
                        <button className={base.primaryButton} onClick={startReview}>Draft a valuation question <span aria-hidden="true">↗</span></button>
                    </>}
                    {tab === 'Review' && <>
                        <div className={styles.panelHeading}><div><span className={base.eyebrow}>USER AUTHORED</span><h2>Your working note</h2></div><span className={base.tag}>Session only</span></div>
                        <div className={styles.reviewContext}><span className={base.eyebrow}>REVIEW FOCUS</span><p>{reviewContext}</p></div>
                        {note ? <p className={styles.noteText}>{note}</p> : <p>No note added in this session. Capture the question, then the evidence needed to answer it.</p>}
                        {!editor && <button className={base.textButton} onClick={startReview}>{note ? 'Edit working note ↗' : 'Write a working note ↗'}</button>}
                        {editor && <section className={styles.editor} aria-label="Focused review editor"><h3>One question. A traceable next step.</h3><form onSubmit={event => { event.preventDefault(); if (!draft.trim()) { setStatus('Write a research question before adding the note.'); return; } setNote(draft.trim()); setEditor(false); announce('Working note added for this session. It will reset on reload, navigation, switching cases, or entering Empty.'); }}>
                            <label htmlFor="v8-note">What do you need to establish, and what evidence would answer it?</label><textarea id="v8-note" ref={noteInput} autoFocus value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={5} placeholder="Did working capital explain the cash-flow decline? Inspect the statement and record the period…" aria-describedby="note-scope" />
                            <p id="note-scope" className={styles.helper}>{draft.length}/2000 · Session only. Not saved to your research records.</p><div className={styles.editorActions}><button type="submit" className={base.primaryButton}>Add working note</button><button type="button" className={base.textButton} onClick={() => { setEditor(false); announce('Draft dismissed. Existing working note retained.'); }}>Cancel</button></div>
                        </form></section>}
                        <ReviewCheckpointV8 date={reviewDate} reason={reviewReason} onDate={setReviewDate} onReason={setReviewReason} />
                    </>}
                    <p role="status" tabIndex={-1} ref={statusRef} className={status ? styles.status : base.visuallyHidden}>{status}</p>
                </div>
            </section>
        </article>
        <aside className={`${base.rail} ${styles.rail}`} aria-label="Research direction">
            <div className={base.railHeading}><span className={base.eyebrow}>THE NEXT USEFUL ACTION</span><span className={styles.actionIcon} aria-hidden="true">↗</span></div>
            <h2>{hasEvidence ? 'Explain the cash-flow gap.' : 'Find the first piece of evidence.'}</h2>
            <p>{hasEvidence ? 'Separate working capital from capital spending before judging the growth story.' : 'Locate a dated primary report. Record its fiscal period, currency and source.'}</p>
            <button className={`${base.primaryButton} ${styles.reviewButton}`} onClick={startReview}>Start a focused review <span aria-hidden="true">↗</span></button><small className={styles.railHint}>Opens your session note. No task or alert is saved.</small>
            <div className={base.railSection}><h3>Thesis at a glance</h3><p>{blank ? 'A working thesis has not been written.' : hasEvidence ? 'Recurring demand could support durable growth, if cash conversion holds up.' : 'Can growth fund itself? Evidence is still needed.'}</p><button className={base.textButton} onClick={() => openTab('Thesis', true)}>Explore the thesis ↗</button></div>
            {hasEvidence && <div className={styles.balance}>
                <button className={`${base.evidenceCard} ${base.supportCard}`} onClick={() => { setFilter('Supports'); openTab('Overview', true); }}><span className={base.cardIcon} aria-hidden="true">↗</span><span><small>Example support</small><b>Revenue grew 20%</b><span>Durable demand is still a hypothesis.</span></span></button>
                <button className={`${base.evidenceCard} ${base.conflictCard}`} onClick={() => { setFilter('Challenges'); openTab('Overview', true); }}><span className={base.cardIcon} aria-hidden="true">↘</span><span><small>Example challenge</small><b>Free cash flow fell 33.3%</b><span>The cause remains unverified.</span></span></button>
            </div>}
            <div className={base.railSection}><h3>Before a decision</h3><ul className={styles.gapList}><li>Validate the latest report</li><li>Explain cash conversion</li><li>Establish valuation and downside</li></ul><label className={styles.reviewCheck}><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I reviewed the example evidence</label><p className={styles.acknowledgement} aria-live="polite">{reviewed ? 'Review acknowledged in this session. The unresolved gaps remain.' : 'Acknowledging a review does not verify a source or change the decision.'}</p></div>
            <a className={styles.marketLink} href="/main-v8"><small>Keep company evidence separate from market conditions.</small><b>Open Market <span aria-hidden="true">↗</span></b></a>
        </aside>
    </div>;
}

function FinancialComparison({ available }: { available: boolean }) {
    const [metric, setMetric] = useState<'Revenue' | 'Free cash flow'>('Revenue');
    const [indexed, setIndexed] = useState(false);
    const previous = metric === 'Revenue' ? 100 : 12;
    const current = metric === 'Revenue' ? 120 : 8;
    const values = indexed ? [100, current / previous * 100] : [previous, current];
    const maximum = indexed || metric === 'Revenue' ? 150 : 15;
    const y = (value: number) => 176 - value / maximum * 136;
    return <section className={styles.comparison} aria-label="Financial comparison">
        <div className={styles.comparisonHead}><div><span className={base.eyebrow}>FINANCIAL SNAPSHOT</span><h2>The growth / cash gap</h2></div><span className={base.tag}>Synthetic annual observations</span></div>
        <div className={styles.metricTabs} aria-label="Financial metric">{(['Revenue', 'Free cash flow'] as const).map(value => <button key={value} aria-pressed={metric === value} onClick={() => setMetric(value)}><span>{value}</span><strong className={value === 'Free cash flow' ? styles.negative : styles.positive}>{available ? value === 'Revenue' ? '+20%' : '−33.3%' : '—'}</strong><small>{available ? value === 'Revenue' ? '$100m → $120m' : '$12m → $8m' : 'Not supplied'}</small></button>)}</div>
        {available ? <>
            <div className={styles.chartTools}><span>{metric} · {indexed ? 'FY2024 = 100' : 'USD millions'}</span><fieldset className={base.segment}><legend className={base.visuallyHidden}>Comparison scale</legend><button aria-pressed={!indexed} onClick={() => setIndexed(false)}>Amounts</button><button aria-pressed={indexed} onClick={() => setIndexed(true)}>Indexed</button></fieldset></div>
            <svg className={styles.chart} viewBox="0 0 640 210" role="img" aria-label={`${metric}: FY2024 ${indexed ? 'index ' : 'USD '}${values[0]}${indexed ? '' : ' million'}, FY2025 ${indexed ? 'index ' : 'USD '}${Number(values[1].toFixed(1))}${indexed ? '' : ' million'}. Synthetic observations.`}>
                {[0, maximum / 2, maximum].map(value => <g key={value}><line x1="60" x2="625" y1={y(value)} y2={y(value)} stroke="#dce7f4" strokeDasharray={value ? '3 5' : undefined} /><text x="45" y={y(value) + 4} textAnchor="end" fill="#607394" fontSize="12">{value}</text></g>)}
                {values.map((value, index) => <g key={index}><rect x={index ? 395 : 130} y={y(value)} width="105" height={176 - y(value)} rx="5" fill={index ? metric === 'Revenue' ? '#0a9474' : '#bc5270' : '#bdd2ef'} /><text x={index ? 447.5 : 182.5} y={y(value) - 10} textAnchor="middle" fill="#10234c" fontSize="16" fontWeight="600">{indexed ? value.toFixed(1) : `$${value}m`}</text><text x={index ? 447.5 : 182.5} y="200" textAnchor="middle" fill="#607394" fontSize="13">FY{2024 + index}</text></g>)}
            </svg>
            <div className={styles.chartConclusion}><span className={metric === 'Revenue' ? styles.positive : styles.negative} aria-hidden="true">{metric === 'Revenue' ? '↗' : '↘'}</span><p>{metric === 'Revenue' ? 'Revenue is up. Whether demand is recurring still needs evidence.' : 'Free cash flow is down. Working capital or investment could explain the gap.'}</p></div>
            <details className={styles.chartSource}><summary>Values, calculation & source context</summary><table><caption>Synthetic annual values · USD millions</caption><thead><tr><th scope="col">Metric</th><th scope="col">FY2024</th><th scope="col">FY2025</th></tr></thead><tbody><tr><th scope="row">Revenue</th><td>100</td><td>120</td></tr><tr><th scope="row">Free cash flow</th><td>12</td><td>8</td></tr></tbody></table><p>Change = (current ÷ prior − 1) × 100. Indexed = value ÷ FY2024 × 100. Each metric’s amount chart uses its own zero-based scale. Only two annual observations are available; no intervening trend is inferred.</p></details>
        </> : <div className={styles.chartUnavailable}><span className={styles.emptyIcon} aria-hidden="true">∅</span><h3>No comparable financial history</h3><p>No financial observations or source report attached. Values stay unavailable until evidence is supplied.</p></div>}
        <p className={styles.chartFootnote}>{available ? 'Fictional FY2025 report · USD · 20 Feb 2026. Latest reporting period unverified. No real report attached.' : 'Missing values are not zero. No financial conclusion is inferred.'}</p>
    </section>;
}
