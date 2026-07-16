import type { MarketSignal } from '@/lib/types/signal-v2';
import {
    formatRawValue,
    getActiveSourceSummary,
    getBroadMarketValidation,
    getEvidenceConcentrationDetails,
    getFreshnessTone,
    getIndicatorCadence,
    getIndicatorHorizon,
    getPrimaryCaveat,
    getReadLimitations,
    getTierTone,
} from '@/components/v2/cockpit-utils';
import { ScoreHistoryV6 } from './ScoreHistoryV6';
import { ChangeAttributionV6 } from './ChangeAttributionV6';
import { MarketAlertsV6 } from './MarketAlertsV6';
import { MarketContextV6 } from './MarketContextV6';
import {
    formatCompactDateV6,
    formatSignedV6,
    getArticleDriverV6,
    getDecisionPostureV6,
    getRankedDriversV6,
    getScenariosV6,
    type DriverV6,
} from './market-v6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type MarketBriefingV6Props = {
    signal: MarketSignal;
    enableSocial: boolean;
    theme: ResearchThemeV6;
    updating: boolean;
    refreshError: string | null;
};

export const MarketBriefingV6 = ({ signal, enableSocial, theme, updating, refreshError }: MarketBriefingV6Props) => {
    const t = getThemeV6(theme);
    const tierTone = getTierTone(signal.tier, theme);
    const posture = getDecisionPostureV6(signal);
    const drivers = getRankedDriversV6(signal);
    const quality = signal.metadata.signal_quality;
    const breadth = getBroadMarketValidation(signal);
    const concentration = getEvidenceConcentrationDetails(signal);
    const caveat = getPrimaryCaveat(signal);
    const scenarios = getScenariosV6(signal);
    const limitations = getReadLimitations(signal);
    const delta = signal.metadata.score_delta?.delta;
    const contextItems = (signal.metadata.articles ?? []).slice(0, 3).map((article) => ({
        article,
        affected: getArticleDriverV6(article.title, signal),
    }));
    const storyDrivers = drivers.slice(0, 3);
    const storyHeadline = getStoryHeadlineV6(signal);
    const hasLinkedContext = contextItems.some((item) => item.affected.label !== 'Context');
    const panel = 'rounded-lg border backdrop-blur-md ' + t.panel;
    const quickReadContent = <QuickReadContentV6 signal={signal} posture={posture} quality={quality} delta={delta} drivers={drivers} scoreClass={tierTone.text} theme={theme} />;
    const valuationBackdrop = signal.metadata.valuation_backdrop;
    const marketContext = signal.metadata.market_context;

    return (
        <div className="mt-4 space-y-4" aria-busy={updating}>
            {refreshError ? (
                <div role="status" className={'rounded-md border px-4 py-3 text-sm ' + (theme === 'light' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-amber-400/35 bg-amber-500/10 text-amber-100')}>
                    Showing the previous briefing while the latest refresh is unavailable: {refreshError}
                </div>
            ) : null}

            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
                <section className={panel + ' min-w-0 overflow-hidden'} aria-labelledby="market-story-title">
                    <div className={'h-1 bg-gradient-to-r ' + tierTone.rail} />
                    <div className="p-5 sm:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + t.textMuted}>Today&apos;s market story</p>
                            {updating ? <span className={'text-xs ' + t.textMuted}>Refreshing data...</span> : null}
                        </div>
                        <h1 id="market-story-title" className={'mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl ' + t.textPrimary}>{storyHeadline}</h1>
                        <p className={'mt-3 max-w-4xl text-base leading-7 sm:text-lg ' + t.textSecondary}>{posture.summary}</p>
                        {caveat ? <p className={'mt-3 text-sm font-medium ' + (theme === 'light' ? 'text-amber-800' : 'text-amber-200')}>{caveat}</p> : null}

                        <section className={'mt-6 border-t pt-5 xl:hidden ' + t.divider} aria-label="Quick read">
                            {quickReadContent}
                        </section>

                        <div className={'mt-6 border-t pt-5 ' + t.divider}>
                            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>How the evidence builds</p>
                            <div className="mt-4 grid gap-0 lg:grid-cols-3">
                                {storyDrivers.map((driver, index) => (
                                    <StoryChapterV6 key={driver.key} driver={driver} index={index} signal={signal} theme={theme} />
                                ))}
                                {storyDrivers.length === 0 ? <p className={'text-sm ' + t.textMuted}>Evidence chapters are unavailable for this snapshot.</p> : null}
                            </div>
                        </div>
                    </div>
                </section>

                <aside className={panel + ' hidden p-5 xl:block'} aria-label="Quick read">
                    {quickReadContent}
                </aside>
            </div>

            <section className={panel + ' overflow-hidden'} aria-labelledby="changed-title">
                <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-[220px_repeat(3,minmax(0,1fr))]">
                    <div className={'p-5 ' + t.cell}>
                        <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>Since the prior snapshot</p>
                        <h2 id="changed-title" className={'mt-2 text-lg font-bold ' + t.textPrimary}>What changed</h2>
                    </div>
                    <SummaryMetricV6
                        label="Overall score"
                        value={typeof delta === 'number' ? formatSignedV6(delta) + ' pts' : 'No comparison'}
                        detail={signal.metadata.score_delta?.previous_score !== null && signal.metadata.score_delta?.previous_score !== undefined
                            ? signal.metadata.score_delta.previous_score + ' previously, now ' + Math.round(signal.composite_score)
                            : 'A previous snapshot is not available'}
                        valueClass={typeof delta === 'number' && delta < 0 ? t.risk : typeof delta === 'number' && delta > 0 ? t.positive : t.textPrimary}
                        theme={theme}
                    />
                    <SummaryMetricV6 label="Trend" value={signal.metadata.trend_context?.score_trend ?? 'Not available'} detail={signal.metadata.trend_context?.last_signal_change ?? 'No signal change recorded'} theme={theme} />
                    <SummaryMetricV6 label="Breadth check" value={breadth.total > 0 ? breadth.aligned + ' of ' + breadth.total + ' aligned' : 'Unavailable'} detail={breadth.summary} theme={theme} />
                </div>
                <ChangeAttributionV6
                    changes={signal.metadata.driver_changes ?? []}
                    previousDate={signal.metadata.score_delta?.previous_date ?? null}
                    available={signal.metadata.driver_changes_available ?? false}
                    theme={theme}
                />
            </section>

            <section className={panel + ' p-5 sm:p-6'} aria-labelledby="score-evidence-title">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>Score explanation</p>
                        <h2 id="score-evidence-title" className={'mt-1 text-xl font-bold ' + t.textPrimary}>Why this score</h2>
                    </div>
                    <p className={'max-w-xl text-xs leading-5 ' + t.textMuted}>History shows where the score sits; weighted evidence shows what produced it.</p>
                </div>
                <div className="mt-5 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
                    <div className="min-w-0">
                        <ScoreHistoryV6 signal={signal} theme={theme} />
                        <div className={'mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3 ' + t.divider}>
                            <CompactFactV6 label="Trend" value={signal.metadata.trend_context?.score_trend ?? 'Not available'} theme={theme} />
                            <CompactFactV6 label="Last signal change" value={signal.metadata.trend_context?.last_signal_change ?? 'Not available'} theme={theme} />
                            <CompactFactV6 label="Snapshot" value={formatCompactDateV6(signal.metadata.score_delta?.snapshot_date)} theme={theme} />
                        </div>
                    </div>
                    <section className="min-w-0" aria-labelledby="drivers-title">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className={'text-xs font-semibold ' + t.textMuted}>Contribution-ranked evidence</p>
                                <h3 id="drivers-title" className={'mt-0.5 text-lg font-bold ' + t.textPrimary}>What is driving the score</h3>
                            </div>
                            <p className={'text-xs ' + t.textMuted}>Largest absolute movers first</p>
                        </div>
                        <DriverTableV6 drivers={drivers} signal={signal} theme={theme} />
                    </section>
                </div>
            </section>

            <section className={panel + ' p-5 sm:p-6'} aria-label="Forward scenarios and market developments">
                <div className="grid items-start gap-8 lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)] lg:gap-0">
                    <section className="min-w-0 lg:pr-8" aria-labelledby="scenarios-title">
                        <SectionHeadingV6 eyebrow="Watch next" title="What could change the story" id="scenarios-title" theme={theme} />
                        <div className="mt-4 space-y-4">
                            {scenarios.map((scenario) => (
                                <div key={scenario.title} className={'border-l-2 pl-3 ' + scenarioBorder(scenario.tone, theme)}>
                                    <h3 className={'text-sm font-bold ' + t.textPrimary}>{scenario.title}</h3>
                                    <p className={'mt-1 text-sm leading-5 ' + t.textSecondary}>{scenario.detail}</p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className={'min-w-0 lg:border-l lg:pl-8 ' + t.divider} aria-labelledby="context-title">
                        <SectionHeadingV6 eyebrow={hasLinkedContext ? 'Signal-linked context' : 'Market background'} title="Developments behind the story" id="context-title" theme={theme} />
                        <div className="mt-4 space-y-4">
                            {contextItems.map(({ article, affected }) => {
                                const contextLabel = affected.label === 'Context' ? 'background' : 'affects ' + affected.label;
                                const content = <><span className={'text-sm font-semibold leading-5 ' + t.textPrimary}>{article.title}</span><span className={'mt-1 block text-xs ' + t.textMuted}>{article.source}{article.pubDate ? ' - ' + formatCompactDateV6(article.pubDate) : ''} - {contextLabel}</span></>;
                                return article.url ? <a key={article.title} href={article.url} target="_blank" rel="noreferrer" className={'block border-b pb-3 transition-colors last:border-0 last:pb-0 ' + t.divider + (theme === 'light' ? ' hover:text-emerald-700' : ' hover:text-emerald-200')} title={affected.detail}>{content}</a> : <div key={article.title} className={'border-b pb-3 last:border-0 last:pb-0 ' + t.divider} title={affected.detail}>{content}</div>;
                            })}
                            {contextItems.length === 0 ? <p className={'text-sm ' + t.textMuted}>No contextual headlines are available for this snapshot.</p> : null}
                        </div>
                    </section>
                </div>
            </section>

            {valuationBackdrop ? <ValuationBackdropV6 backdrop={valuationBackdrop} theme={theme} /> : null}
            {marketContext ? <MarketContextV6 context={marketContext} theme={theme} /> : null}

            <MarketAlertsV6 signal={signal} enableSocial={enableSocial} theme={theme} />

            <section className={panel + ' p-5 sm:p-6'} aria-labelledby="terms-title">
                <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-start">
                    <div>
                        <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>Plain-language guide</p>
                        <h2 id="terms-title" className={'mt-1 text-lg font-bold ' + t.textPrimary}>Terms in this briefing</h2>
                    </div>
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <GlossaryItemV6 term="Momentum" definition="How consistently prices and market participation are moving." theme={theme} />
                        <GlossaryItemV6 term="Agreement" definition="How many indicators point in the same direction. It is not a prediction." theme={theme} />
                        <GlossaryItemV6 term="Freshness" definition="How recently the underlying sources were updated." theme={theme} />
                    </dl>
                </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
                <DisclosureV6 title="Trust and limitations" theme={theme}>
                    <dl className="grid gap-4 sm:grid-cols-3">
                        <CompactFactV6 label="Evidence concentration" value={concentration.summary} theme={theme} />
                        <CompactFactV6 label="Coverage" value={capitalize(quality?.source_coverage ?? 'unavailable')} theme={theme} />
                        <CompactFactV6 label="Freshness" value={capitalize(quality?.freshness ?? 'unavailable')} valueClass={getFreshnessTone(capitalize(quality?.freshness ?? 'stale'), theme)} theme={theme} />
                    </dl>
                    <ul className={'mt-4 list-disc space-y-2 pl-5 text-sm leading-5 ' + t.textSecondary}>
                        {limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                        {limitations.length === 0 ? <li>No material model limitation is flagged for this snapshot.</li> : null}
                    </ul>
                </DisclosureV6>

                <DisclosureV6 title="Sources and methodology" theme={theme}>
                    <div className="space-y-4">
                        {Object.values(signal.components).filter((component) => component.enabled).map((component) => (
                            <div key={component.name} className={'grid gap-2 border-b pb-4 last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] ' + t.divider}>
                                <div>
                                    <p className={'text-sm font-bold ' + t.textPrimary}>{component.display_name}</p>
                                    <p className={'mt-1 text-xs leading-5 ' + t.textMuted}>{getIndicatorCadence(component)}; horizon {getIndicatorHorizon(component)}</p>
                                </div>
                                <div className="sm:text-right">
                                    <p className={'text-sm font-semibold ' + t.textSecondary}>{formatRawValue(component, signal.metadata.market)}</p>
                                    <p className={'mt-1 text-xs ' + getFreshnessTone(drivers.find((driver) => driver.key === component.name)?.freshness ?? 'Unknown', theme)}>Updated {formatCompactDateV6(component.last_updated)}</p>
                                </div>
                            </div>
                        ))}
                        <p className={'text-xs leading-5 ' + t.textMuted}>{signal.metadata.interpretation_context?.limitation ?? 'The score is a decision-support input, not a complete investment thesis.'}</p>
                    </div>
                </DisclosureV6>
            </div>
        </div>
    );
};

const ValuationBackdropV6 = ({ backdrop, theme }: {
    backdrop: NonNullable<MarketSignal['metadata']['valuation_backdrop']>;
    theme: ResearchThemeV6;
}) => {
    const t = getThemeV6(theme);
    const sourceLinks = getValuationSourceLinksV6(backdrop.source_url);
    const ratioLabel = `${backdrop.name}: ${backdrop.ratio_pct.toFixed(1)} percent`;

    return (
        <details className={'group overflow-hidden rounded-lg border backdrop-blur-md ' + t.panel} aria-labelledby="valuation-backdrop-title" data-testid="valuation-backdrop">
            <summary className={'flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none ' + t.textPrimary}>
                <span className="min-w-0">
                    <span className={'block text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>Non-scored context</span>
                    <span id="valuation-backdrop-title" className={'mt-1 block text-base font-bold sm:text-lg ' + t.textPrimary}>{backdrop.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                    <span className={'hidden rounded border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] sm:inline-flex ' + t.divider + ' ' + t.textMuted}>Not scored</span>
                    <span aria-hidden="true" className={'text-lg transition-transform group-open:rotate-45 ' + t.textMuted}>+</span>
                </span>
            </summary>

            <div className={'border-t ' + t.divider}>
                <div className="grid gap-px lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className={'p-5 ' + t.cell}>
                        <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>Long-horizon lens</p>
                        <p className={'mt-2 text-sm leading-5 ' + t.textSecondary}>A valuation backdrop for the US market, shown for context rather than as a timing signal.</p>
                    </div>

                    <div className={'grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(190px,0.78fr)_minmax(0,1.22fr)] ' + t.cell}>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
                                <p aria-label={ratioLabel} className={'text-3xl font-bold tabular-nums ' + t.textPrimary}>{backdrop.ratio_pct.toFixed(1)}%</p>
                                <span className={'rounded border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ' + (theme === 'light' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-sky-400/40 bg-sky-500/10 text-sky-200')}>Valuation context</span>
                            </div>
                            <p className={'mt-3 text-sm font-semibold ' + t.textPrimary}>{backdrop.label}</p>
                            <p className={'mt-2 text-sm leading-5 ' + t.textSecondary}>{backdrop.detail}</p>
                        </div>

                        <dl className={'grid gap-4 border-t pt-4 sm:grid-cols-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 ' + t.divider}>
                            <CompactFactV6 label="Market value" value={formatBillionsV6(backdrop.market_value_billions)} theme={theme} />
                            <CompactFactV6 label="Latest GDP" value={formatBillionsV6(backdrop.gdp_billions)} theme={theme} />
                            <CompactFactV6 label="Report date" value={formatCompactDateV6(backdrop.report_date)} theme={theme} />
                        </dl>
                    </div>
                </div>

                <div className={'flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between ' + t.divider + ' ' + t.cell}>
                    <div>
                        <p className={'text-xs font-semibold ' + t.textSecondary}>Not included in the composite score.</p>
                        <p className={'mt-1 text-xs ' + t.textMuted}>Use it as slow-moving strategic context, not a standalone decision.</p>
                    </div>
                    {sourceLinks.length > 0 ? (
                        <div className="flex flex-wrap gap-2" aria-label="Buffett Indicator source links">
                            {sourceLinks.map((source) => (
                                <a
                                    key={source.url}
                                    href={source.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={'inline-flex min-h-10 items-center rounded-md border px-3 text-xs font-semibold transition-colors ' + t.divider + ' ' + t.textSecondary + (theme === 'light' ? ' hover:border-sky-400 hover:text-sky-700' : ' hover:border-sky-300 hover:text-sky-200')}
                                >
                                    {source.label}
                                </a>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </details>
    );
};

const getStoryHeadlineV6 = (signal: MarketSignal) => {
    if (signal.tier === 'strong-buy') return 'Markets are moving with broad positive support.';
    if (signal.tier === 'buy') return 'Markets are cautiously optimistic.';
    if (signal.tier === 'neutral') return 'Markets are balanced, with no clear direction yet.';
    if (signal.tier === 'sell') return 'Markets are becoming more cautious.';
    return 'Markets are under broad pressure.';
};

const StoryChapterV6 = ({ driver, index, signal, theme }: { driver: DriverV6; index: number; signal: MarketSignal; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    const component = signal.components[driver.key];
    const relationship = driver.conflict
        ? 'This indicator disagrees with the majority view and reduces conviction.'
        : driver.impact === 'positive'
            ? 'This indicator is adding positive support to the current market view.'
            : driver.impact === 'negative'
                ? 'This indicator is adding caution to the current market view.'
                : 'This indicator is providing context without a strong directional push.';

    return (
        <article className={'relative min-w-0 border-l pl-5 pb-5 last:pb-0 lg:border-l-0 lg:border-t lg:px-5 lg:pb-0 lg:pt-6 first:lg:pl-0 last:lg:pr-0 ' + t.divider}>
            <span className={'absolute -left-3 top-0 flex size-6 items-center justify-center rounded-full border text-xs font-bold lg:-top-3 lg:left-5 first:lg:left-0 ' + (driver.conflict ? (theme === 'light' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/50 bg-[#111a23] text-rose-200') : (theme === 'light' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-emerald-400/50 bg-[#111a23] text-emerald-200'))}>{index + 1}</span>
            <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + (driver.conflict ? t.risk : t.textMuted)}>{driver.conflict ? 'Conflicting evidence' : 'Evidence chapter'}</p>
            <h2 className={'mt-1 text-base font-bold ' + t.textPrimary}>{component?.display_name ?? driver.name}</h2>
            <p className={'mt-2 text-sm leading-5 ' + t.textSecondary}>{relationship}</p>
            <div className={'mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] ' + t.textMuted}>
                <span>{driver.contribution.toFixed(1)} weighted points</span>
                <span>{driver.freshness}</span>
            </div>
        </article>
    );
};

const QuickReadContentV6 = ({ signal, posture, quality, delta, drivers, scoreClass, theme }: {
    signal: MarketSignal;
    posture: ReturnType<typeof getDecisionPostureV6>;
    quality: MarketSignal['metadata']['signal_quality'];
    delta: number | null | undefined;
    drivers: DriverV6[];
    scoreClass: string;
    theme: ResearchThemeV6;
}) => {
    const t = getThemeV6(theme);
    const primaryDriver = drivers[0];
    const scoreChange = typeof delta === 'number' ? formatSignedV6(delta) + ' pts since the prior snapshot' : 'No prior comparison';
    const scoreDetail = primaryDriver
        ? scoreChange + '. Largest influence: ' + primaryDriver.name + ' at ' + formatSignedV6(primaryDriver.contribution, 1) + ' weighted points.'
        : scoreChange + '. Weighted driver detail is unavailable.';
    return (
        <>
            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + t.textMuted}>Quick read</p>
            <div className="mt-4 space-y-4">
                <QuickReadItemV6 label="Market view" value={posture.headline} detail={signal.mode === 'contrarian' ? 'Contrarian interpretation' : 'Standard interpretation'} theme={theme} />
                <QuickReadItemV6 label="Evidence agreement" value={Math.round(signal.confidence.agreement_pct) + '%'} detail={signal.confidence.level + ' agreement, not forecast probability'} theme={theme} />
                <QuickReadItemV6 label="Data freshness" value={capitalize(quality?.freshness ?? 'unavailable')} detail={getActiveSourceSummary(signal)} valueClass={getFreshnessTone(capitalize(quality?.freshness ?? 'stale'), theme)} theme={theme} />
                <QuickReadItemV6 label="Composite score" value={Math.round(signal.composite_score) + ' / 100'} detail={scoreDetail} valueClass={scoreClass} theme={theme} />
            </div>
            <p className={'mt-5 border-t pt-4 text-xs leading-5 ' + t.divider + ' ' + t.textMuted}>Snapshot {formatCompactDateV6(signal.metadata.score_delta?.snapshot_date)}. Decision support only.</p>
        </>
    );
};

const QuickReadItemV6 = ({ label, value, detail, valueClass, theme }: { label: string; value: string; detail: string; valueClass?: string; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    return (
        <div className={'border-b pb-4 last:border-0 last:pb-0 ' + t.divider}>
            <p className={'text-[13px] font-semibold ' + t.textMuted}>{label}</p>
            <p className={'mt-1 text-base font-bold ' + (valueClass ?? t.textPrimary)}>{value}</p>
            <p className={'mt-1 text-[13px] leading-5 ' + t.textSecondary}>{detail}</p>
        </div>
    );
};

const GlossaryItemV6 = ({ term, definition, theme }: { term: string; definition: string; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    return (
        <div className={'border-l-2 pl-3 ' + (theme === 'light' ? 'border-sky-300' : 'border-sky-400/45')}>
            <dt className={'text-sm font-bold ' + t.textPrimary}>{term}</dt>
            <dd className={'mt-1 text-sm leading-5 ' + t.textSecondary}>{definition}</dd>
        </div>
    );
};

const SummaryMetricV6 = ({ label, value, detail, valueClass, theme }: { label: string; value: string; detail: string; valueClass?: string; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    return (
        <article className={'min-w-0 p-3.5 sm:p-4 ' + t.cell}>
            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>{label}</p>
            <p className={'mt-2 break-words text-lg font-bold sm:text-xl ' + (valueClass ?? t.textPrimary)}>{value}</p>
            <p className={'mt-1 text-xs leading-5 ' + t.textSecondary}>{detail}</p>
        </article>
    );
};

const CompactFactV6 = ({ label, value, valueClass, theme }: { label: string; value: string; valueClass?: string; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    return (
        <div className="min-w-0">
            <dt className={'text-xs font-semibold uppercase tracking-[0.08em] ' + t.textMuted}>{label}</dt>
            <dd className={'mt-1 break-words text-sm font-semibold ' + (valueClass ?? t.textPrimary)}>{value}</dd>
        </div>
    );
};

const DriverTableV6 = ({ drivers, signal, theme }: { drivers: DriverV6[]; signal: MarketSignal; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    const maxContribution = Math.max(...drivers.map((driver) => Math.abs(driver.contribution)), 1);

    if (drivers.length === 0) return <p className={'mt-5 text-sm ' + t.textMuted}>Driver contributions are unavailable.</p>;

    return (
        <>
            <div className="mt-4 hidden md:block">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                    <thead>
                        <tr className={'border-b text-xs uppercase tracking-[0.08em] ' + t.divider + ' ' + t.textMuted}>
                            <th className="w-[42%] pb-3 font-semibold">Driver</th>
                            <th className="w-[20%] pb-3 font-semibold">Reading</th>
                            <th className="w-[18%] pb-3 text-right font-semibold">Weighted points</th>
                            <th className="w-[20%] pb-3 text-right font-semibold">Freshness</th>
                        </tr>
                    </thead>
                    <tbody>
                        {drivers.map((driver) => <DriverRowV6 key={driver.key} driver={driver} signal={signal} maxContribution={maxContribution} theme={theme} />)}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 space-y-3 md:hidden">
                {drivers.map((driver) => <DriverCardV6 key={driver.key} driver={driver} signal={signal} maxContribution={maxContribution} theme={theme} />)}
            </div>
        </>
    );
};

const DriverRowV6 = ({ driver, signal, maxContribution, theme }: { driver: DriverV6; signal: MarketSignal; maxContribution: number; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    const component = signal.components[driver.key];
    const rowHighlight = driver.conflict ? (theme === 'light' ? 'bg-rose-50/75' : 'bg-rose-500/[0.06]') : '';
    return (
        <tr className={'border-b align-top last:border-0 ' + t.divider + ' ' + rowHighlight}>
            <td className="py-3 pr-3">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={'font-semibold ' + t.textPrimary}>{driver.name}</span>
                    {driver.conflict ? <span className={'rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ' + (theme === 'light' ? 'border-rose-300 text-rose-700' : 'border-rose-400/40 text-rose-200')}>Conflicts</span> : null}
                </div>
                <div className={'mt-2 h-1.5 overflow-hidden rounded-full ' + (theme === 'light' ? 'bg-slate-200' : 'bg-slate-700')}>
                    <div className={'h-full rounded-full ' + driverBarToneV6(driver)} style={{ width: Math.max(6, (Math.abs(driver.contribution) / maxContribution) * 100) + '%' }} />
                </div>
            </td>
            <td className={'py-3 pr-3 ' + t.textSecondary}>{component ? formatRawValue(component, signal.metadata.market) : driver.raw_value.toString()}</td>
            <td className={'py-3 text-right font-bold tabular-nums ' + driverTextToneV6(driver, theme)}>{driver.contribution.toFixed(1)}</td>
            <td className={'py-3 text-right text-xs font-semibold ' + getFreshnessTone(driver.freshness, theme)}>{driver.freshness}</td>
        </tr>
    );
};

const DriverCardV6 = ({ driver, signal, maxContribution, theme }: { driver: DriverV6; signal: MarketSignal; maxContribution: number; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    const component = signal.components[driver.key];
    return (
        <article className={'rounded-md border p-3 ' + (driver.conflict ? (theme === 'light' ? 'border-rose-300 bg-rose-50/75' : 'border-rose-400/35 bg-rose-500/[0.06]') : t.row)}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className={'font-semibold ' + t.textPrimary}>{driver.name}</p>
                    <p className={'mt-1 text-xs ' + t.textMuted}>{component ? formatRawValue(component, signal.metadata.market) : driver.raw_value.toString()}</p>
                </div>
                <div className="text-right">
                    <p className={'font-bold tabular-nums ' + driverTextToneV6(driver, theme)}>{driver.contribution.toFixed(1)} pts</p>
                    <p className={'mt-1 text-xs font-semibold ' + getFreshnessTone(driver.freshness, theme)}>{driver.freshness}</p>
                </div>
            </div>
            <div className={'mt-3 h-1.5 overflow-hidden rounded-full ' + (theme === 'light' ? 'bg-slate-200' : 'bg-slate-700')}>
                <div className={'h-full rounded-full ' + driverBarToneV6(driver)} style={{ width: Math.max(6, (Math.abs(driver.contribution) / maxContribution) * 100) + '%' }} />
            </div>
            {driver.conflict ? <p className={'mt-2 text-xs font-semibold ' + t.risk}>Conflicts with the majority read</p> : null}
        </article>
    );
};

const SectionHeadingV6 = ({ eyebrow, title, id, theme }: { eyebrow: string; title: string; id: string; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    return (
        <div>
            <p className={'text-xs font-semibold ' + t.textMuted}>{eyebrow}</p>
            <h2 id={id} className={'mt-0.5 text-lg font-bold ' + t.textPrimary}>{title}</h2>
        </div>
    );
};

const DisclosureV6 = ({ title, theme, children, defaultOpen = false }: { title: string; theme: ResearchThemeV6; children: React.ReactNode; defaultOpen?: boolean }) => {
    const t = getThemeV6(theme);
    return (
        <details open={defaultOpen} className={'group rounded-lg border backdrop-blur-md ' + t.panel}>
            <summary className={'flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-bold marker:content-none ' + t.textPrimary}>
                {title}
                <span aria-hidden="true" className={'text-lg transition-transform group-open:rotate-45 ' + t.textMuted}>+</span>
            </summary>
            <div className={'border-t px-5 py-5 ' + t.divider}>{children}</div>
        </details>
    );
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const formatBillionsV6 = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value >= 1000 ? value / 1000 : value);
    return '$' + formatted + (value >= 1000 ? 'tn' : 'bn');
};

const getValuationSourceLinksV6 = (sourceUrl: string) => sourceUrl
    .split(/\s+and\s+/)
    .map((url) => url.trim())
    .filter((url) => /^https?:\/\//i.test(url))
    .map((url, index) => ({
        url,
        label: url.includes('/GDP') ? 'FRED GDP series' : url.includes('BOGZ1') ? 'FRED equity series' : `Source ${index + 1}`,
    }));

const driverBarToneV6 = (driver: DriverV6) => {
    if (driver.conflict || driver.impact === 'negative') return 'bg-rose-500';
    if (driver.impact === 'positive') return 'bg-emerald-500';
    return 'bg-sky-500';
};

const driverTextToneV6 = (driver: DriverV6, theme: ResearchThemeV6) => {
    if (driver.conflict || driver.impact === 'negative') return theme === 'light' ? 'text-rose-600' : 'text-rose-300';
    if (driver.impact === 'positive') return theme === 'light' ? 'text-emerald-700' : 'text-emerald-300';
    return theme === 'light' ? 'text-sky-700' : 'text-sky-300';
};

const scenarioBorder = (tone: 'positive' | 'warning' | 'negative', theme: ResearchThemeV6) => {
    if (tone === 'positive') return theme === 'light' ? 'border-emerald-500' : 'border-emerald-300';
    if (tone === 'negative') return theme === 'light' ? 'border-rose-500' : 'border-rose-300';
    return theme === 'light' ? 'border-amber-500' : 'border-amber-300';
};
