'use client';

import { useState } from 'react';
import {
    V7Button,
    V7ControlGroup,
    V7Shell,
    V7StateChip,
} from './foundation/V7Foundation';
import styles from './v7-prototype.module.css';

const MarketControls = ({ onRefresh }: { readonly onRefresh: () => void }) => (
    <>
        <V7ControlGroup label="Market">
            <V7StateChip strong>US</V7StateChip>
        </V7ControlGroup>
        <V7ControlGroup label="Interpretation">
            <V7StateChip>Standard</V7StateChip>
        </V7ControlGroup>
        <V7StateChip>Social on</V7StateChip>
        <V7Button type="button" compactOnMobile onClick={onRefresh}>
            <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.34 5.66M20 5v6h-6" /></svg>
            Refresh preview
        </V7Button>
    </>
);

const marketMetrics = [
    { label: 'Composite score', value: '72 / 100', note: '+4 from Jul 31', primary: true },
    { label: 'Signal alignment', value: '78%', note: '7 of 9 active indicators', primary: false },
    { label: 'Data quality', value: '28 / 31', note: 'Complete · 2 sources aging', primary: false },
] as const;

const evidenceRail = [
    { eyebrow: 'Why it changed', title: 'Breadth improved across sectors', copy: 'Participation added +3.1 points while momentum held its prior contribution.', tone: 'support' },
    { eyebrow: 'Strongest conflict', title: 'Volatility is not confirming', copy: 'VIX remains above the level normally associated with this score zone.', tone: 'risk' },
    { eyebrow: 'Trust and freshness', title: 'Most evidence is current', copy: '28 of 31 inputs available · two weekly sources are aging but still valid.', tone: 'neutral' },
] as const;

const attentionItems = [
    { label: 'Strongest support', title: 'Market breadth', copy: 'More sectors now participate in the advance.', tone: 'support' },
    { label: 'Strongest conflict', title: 'Volatility divergence', copy: 'Risk pricing remains cautious despite stronger momentum.', tone: 'risk' },
    { label: 'Freshness concern', title: 'Weekly sentiment', copy: 'AAII and NAAIM update later in the week.', tone: 'caution' },
] as const;

const ScoreChart = () => {
    const [range, setRange] = useState('3M');
    const ranges = ['1M', '3M', '6M', '1Y'] as const;

    return (
        <section className={styles.chartPanel} aria-labelledby="score-history-title">
            <div className={styles.panelHeading}>
                <div>
                    <p className={styles.eyebrow}>Primary evidence</p>
                    <h2 id="score-history-title">Score history</h2>
                    <p>Composite score · 0 to 100</p>
                </div>
                <div className={styles.rangeControl} aria-label="Score history range">
                    {ranges.map((item) => (
                        <button key={item} type="button" aria-pressed={item === range} onClick={() => setRange(item)}>{item}</button>
                    ))}
                </div>
            </div>
            <div className={styles.chart} role="img" aria-labelledby="score-chart-title score-chart-description">
                <span id="score-chart-title" className={styles.srOnly}>Composite market score history</span>
                <span id="score-chart-description" className={styles.srOnly}>The score rose from 57 to 72 over the selected {range} range, with a brief pullback in July.</span>
                <svg viewBox="0 0 760 220" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                        <linearGradient id="v7-score-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.22" />
                            <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <g className={styles.chartGrid}>
                        <path d="M0 42H760M0 92H760M0 142H760M0 192H760" />
                    </g>
                    <path className={styles.chartArea} d="M0 174 C55 164 78 156 118 160 S189 132 238 139 S314 111 356 119 S425 88 474 101 S548 124 590 99 S660 69 710 79 S742 63 760 58 L760 220 L0 220Z" />
                    <path className={styles.chartLine} d="M0 174 C55 164 78 156 118 160 S189 132 238 139 S314 111 356 119 S425 88 474 101 S548 124 590 99 S660 69 710 79 S742 63 760 58" />
                    <line className={styles.currentGuide} x1="760" x2="760" y1="58" y2="220" />
                </svg>
                <span className={styles.chartStart}>May 10</span>
                <span className={styles.chartMid}>Jun 25</span>
                <span className={styles.chartEnd}>Aug 9</span>
                <span className={styles.currentAnnotation}><strong>72</strong><small>Current</small></span>
            </div>
            <p className={styles.chartSummary}>Showing {range}: momentum broadened through June, paused in July, then recovered to the current score of 72.</p>
        </section>
    );
};

export const MarketPrototypeV7 = () => {
    const [refreshMessage, setRefreshMessage] = useState('Snapshot observed Aug 9, 2026 · 20:00 MYT');

    return (
        <V7Shell
            active="market"
            controls={<MarketControls onRefresh={() => setRefreshMessage('Preview refreshed · no data request was made')} />}
            footer="Presentation prototype · Representative static content · No saved data is changed"
            testId="v7-prototype"
        >
            <main className={styles.marketPage}>
                <section className={styles.marketIntro} aria-labelledby="market-posture">
                    <div className={styles.interpretation}>
                        <p className={styles.eyebrow}>Market conditions</p>
                        <h1 id="market-posture">Risk-on, with disciplined sizing.</h1>
                        <p>Momentum remains broad, but volatility is not yet confirming the improvement.</p>
                    </div>
                    <div className={styles.marketMeta}>
                        <strong><span className={styles.statusDot} /> Conditions available</strong>
                        <span>Conditions date · Aug 9, 2026</span>
                        <span>Decision support, not a forecast</span>
                        <span role="status" aria-live="polite">{refreshMessage}</span>
                    </div>
                </section>

                <section className={styles.metrics} aria-label="Market orientation metrics">
                    {marketMetrics.map((metric) => (
                        <div key={metric.label} className={`${styles.metric} ${metric.primary ? styles.metricPrimary : ''}`}>
                            <span>{metric.label}</span>
                            <strong>{metric.value}</strong>
                            <small>{metric.note}</small>
                        </div>
                    ))}
                </section>

                <section className={styles.primaryEvidence} aria-label="Primary market evidence">
                    <ScoreChart />
                    <aside className={styles.evidenceRail} aria-label="Ranked evidence and trust">
                        {evidenceRail.map((item) => (
                            <div key={item.eyebrow} className={styles.evidenceItem} data-tone={item.tone}>
                                <p>{item.eyebrow}</p>
                                <h2>{item.title}</h2>
                                <span>{item.copy}</span>
                            </div>
                        ))}
                    </aside>
                </section>

                <section className={styles.attention} aria-labelledby="attention-title">
                    <div className={styles.sectionHeading}>
                        <div>
                            <p className={styles.eyebrow}>Next reading</p>
                            <h2 id="attention-title">What deserves attention next</h2>
                        </div>
                    </div>
                    <div className={styles.attentionGrid}>
                        {attentionItems.map((item) => (
                            <div key={item.label} className={styles.attentionItem} data-tone={item.tone}>
                                <span>{item.label}</span>
                                <strong>{item.title}</strong>
                                <p>{item.copy}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <details className={styles.detailIndex}>
                    <summary>Detailed evidence and methodology · 7 sections</summary>
                    <ol>
                        <li>Current-zone historical forward outcomes</li>
                        <li>Detailed score evidence and weighted history</li>
                        <li>Historical calibration and provenance</li>
                        <li>Deterministic forward scenarios</li>
                        <li>Non-scored valuation, macro, and breadth context</li>
                        <li>Market alerts</li>
                        <li>Terms, limitations, trust, and methodology</li>
                    </ol>
                </details>
            </main>
        </V7Shell>
    );
};

const watchlist = [
    { ticker: 'MSFT', name: 'Microsoft', state: 'Watch', meta: 'Review due in 6 days', selected: true },
    { ticker: 'GOOGL', name: 'Alphabet', state: 'DCA', meta: 'Evidence current', selected: false },
    { ticker: 'NVDA', name: 'NVIDIA', state: 'Wait', meta: 'Price above zone', selected: false },
    { ticker: 'AMZN', name: 'Amazon', state: 'Watch', meta: '1 source aging', selected: false },
] as const;

const ResearchControls = () => (
    <>
        <label className={styles.tickerSearch}>
            <span>Search ticker</span>
            <input type="search" value="MSFT" readOnly aria-readonly="true" />
        </label>
        <V7StateChip>US market</V7StateChip>
        <V7StateChip>Comfortable density</V7StateChip>
    </>
);

const researchSections = ['Watchlist', 'Discovery', 'Activity', 'Analyze', 'Portfolio', 'Review', 'More'] as const;
const researchTabs = ['Overview', 'Fundamentals', 'Valuation', 'Events', 'Chart', 'Evidence'] as const;

export const ResearchOverviewPrototypeV7 = () => {
    const [reviewOpen, setReviewOpen] = useState(false);

    return (
        <V7Shell
            active="research"
            controls={<ResearchControls />}
            footer="Presentation prototype · Representative static content · No saved data is changed"
            testId="v7-prototype"
        >
            <main className={styles.researchPage}>
                <div className={styles.researchIdentityRow}>
                    <div>
                        <p className={styles.eyebrow}>Investment research</p>
                        <h1>Research overview</h1>
                        <p>A focused document for the selected security, its decision, and the evidence that qualifies it.</p>
                    </div>
                    <span className={styles.staticNotice}>Static prototype · No records loaded</span>
                </div>

                <nav className={styles.researchSections} aria-label="Research sections">
                    {researchSections.map((section) => <a key={section} href={section === 'Watchlist' ? '#research-document' : `#${section.toLowerCase()}`} aria-current={section === 'Watchlist' ? 'page' : undefined}>{section}</a>)}
                </nav>

                <div className={styles.mobileSelectors}>
                    <label><span>Section</span><select defaultValue="Watchlist"><option>Watchlist</option><option>Discovery</option><option>Activity</option></select></label>
                    <label><span>Workspace</span><select defaultValue="Overview"><option>Overview</option><option>Fundamentals</option><option>Valuation</option></select></label>
                </div>

                <div className={styles.researchLayout}>
                    <aside className={styles.watchlistRail} aria-labelledby="watchlist-title">
                        <div className={styles.railHeading}>
                            <div><p className={styles.eyebrow}>Saved research</p><h2 id="watchlist-title">Watchlist</h2></div>
                            <span>4</span>
                        </div>
                        <label className={styles.railSearch}><span>Filter watchlist</span><input type="search" placeholder="Ticker or company" /></label>
                        <div className={styles.filterSummary}>Filters · All markets · 0 active</div>
                        <div className={styles.watchlistRows}>
                            {watchlist.map((item) => (
                                <a key={item.ticker} href={item.selected ? '#research-document' : `#${item.ticker.toLowerCase()}`} className={item.selected ? styles.watchlistSelected : ''} aria-current={item.selected ? 'true' : undefined}>
                                    <span><strong>{item.ticker}</strong><small>{item.name}</small></span>
                                    <span><b>{item.state}</b><small>{item.meta}</small></span>
                                </a>
                            ))}
                        </div>
                    </aside>

                    <article className={styles.researchDocument} id="research-document">
                        <header className={styles.securityHeader}>
                            <div className={styles.securityIdentity}>
                                <p className={styles.eyebrow}>Selected security</p>
                                <h2>MSFT <span>Microsoft Corporation</span></h2>
                                <p>NASDAQ · Observed Aug 9, 2026 at 20:00 MYT</p>
                            </div>
                            <div className={styles.securityPrice}>
                                <span>Current price</span>
                                <strong>$527.75</strong>
                                <small>+1.4% since prior close</small>
                            </div>
                            <div className={styles.decisionBlock}>
                                <span>Decision · Watch</span>
                                <strong>Quality remains intact; valuation needs a better entry.</strong>
                                <small>Next gap · Refresh forward earnings evidence</small>
                            </div>
                        </header>

                        <section className={styles.readiness} aria-label="Research readiness">
                            <div><span>Readiness</span><strong>7 of 9 checks complete</strong></div>
                            <div className={styles.readinessTrack}><span /></div>
                            <p><b>Highest-priority gap</b> · Forward earnings evidence was last reviewed 42 days ago.</p>
                        </section>

                        <nav className={styles.detailTabs} aria-label="Security detail">
                            {researchTabs.map((tab) => <a key={tab} href={tab === 'Overview' ? '#overview' : `#${tab.toLowerCase()}`} aria-current={tab === 'Overview' ? 'page' : undefined}>{tab}</a>)}
                        </nav>

                        <div className={styles.documentColumns} id="overview">
                            <div className={styles.thesisRegion}>
                                <section aria-labelledby="thesis-title">
                                    <p className={styles.eyebrow}>Core view</p>
                                    <h3 id="thesis-title">Thesis</h3>
                                    <p>Microsoft combines durable enterprise distribution with expanding cloud and AI demand, supporting resilient long-term cash generation.</p>
                                    <div className={styles.bullCase}><span>Bull case</span><p>Azure growth reaccelerates while operating leverage offsets continued infrastructure investment.</p></div>
                                </section>
                                <section className={styles.invalidation} aria-labelledby="invalidation-title">
                                    <p className={styles.eyebrow}>What would break the thesis</p>
                                    <h3 id="invalidation-title">Invalidation</h3>
                                    <p>Two reporting periods of slowing cloud demand combined with structurally lower margins would require a full review.</p>
                                    <small>Not currently matched · Reviewed Jun 28, 2026</small>
                                </section>
                            </div>

                            <aside className={styles.checkSummary} aria-labelledby="checks-title">
                                <p className={styles.eyebrow}>Decision checks</p>
                                <h3 id="checks-title">What is complete</h3>
                                <ul>
                                    <li><span>Business quality</span><strong>Complete</strong></li>
                                    <li><span>Balance sheet</span><strong>Complete</strong></li>
                                    <li><span>Valuation zone</span><strong>Needs review</strong></li>
                                    <li><span>Invalidation</span><strong>Defined</strong></li>
                                </ul>
                                <p className={styles.nextReview}>Next scheduled review · Aug 16, 2026</p>
                            </aside>
                        </div>

                        <section className={styles.evidenceSection} aria-labelledby="evidence-title">
                            <div className={styles.sectionHeading}>
                                <div><p className={styles.eyebrow}>Saved evidence</p><h3 id="evidence-title">Fundamentals and valuation</h3></div>
                                <span>6 sources · 1 aging</span>
                            </div>
                            <div className={styles.evidenceRows}>
                                <div><span><strong>Revenue growth remains durable</strong><small>Microsoft FY2026 Q4 filing · Observed Jul 30 · Current</small></span><b>Supported</b></div>
                                <div><span><strong>Cloud margin progression</strong><small>Microsoft earnings materials · Observed Jul 30 · Current</small></span><b>Supported</b></div>
                                <div data-tone="caution"><span><strong>Forward earnings range</strong><small>Provider consensus · Observed Jun 28 · Aging</small></span><b>Review</b></div>
                            </div>
                        </section>

                        <section className={styles.journalSection} aria-labelledby="journal-title">
                            <div>
                                <p className={styles.eyebrow}>Research journal · Read only</p>
                                <h3 id="journal-title">Saved review summary</h3>
                                <p>Last review retained Watch: operating evidence improved, but the price remains above the saved accumulation zone.</p>
                                <small>Saved Jun 28, 2026 · Revision 12</small>
                            </div>
                            <button type="button" onClick={() => setReviewOpen((open) => !open)} aria-expanded={reviewOpen} aria-controls="review-preview">{reviewOpen ? 'Close review preview' : 'Submit review'}</button>
                        </section>

                        {reviewOpen ? (
                            <section className={styles.reviewPreview} id="review-preview" aria-live="polite">
                                <div><p className={styles.eyebrow}>Review owner</p><h3>Explicit review workflow</h3></div>
                                <p>This prototype stops before editing. A complete V7 workflow will keep assisted findings, editable fields, Cancel, and Save review in this document position.</p>
                                <button type="button" onClick={() => setReviewOpen(false)}>Cancel preview</button>
                            </section>
                        ) : null}

                        <details className={styles.reviewHistory}>
                            <summary>Review history · 12 revisions</summary>
                            <p>Newest-first review history remains attached to this security and is not loaded in the static prototype.</p>
                        </details>
                    </article>
                </div>
            </main>
        </V7Shell>
    );
};
