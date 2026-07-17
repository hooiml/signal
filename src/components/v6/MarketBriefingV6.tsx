import type { MarketSignal } from '@/lib/types/signal-v2';
import {
    formatRawValue,
    getBroadMarketValidation,
    getEvidenceConcentrationDetails,
    getFreshnessTone,
    getIndicatorCadence,
    getIndicatorHorizon,
    getReadLimitations,
    getSignalAction,
    getTierTone,
} from '@/components/v2/cockpit-utils';
import { ScoreHistoryV6 } from './ScoreHistoryV6';
import { ChangeAttributionV6 } from './ChangeAttributionV6';
import { MarketAlertsV6 } from './MarketAlertsV6';
import { MarketContextV6 } from './MarketContextV6';
import { MarketToResearchLinkV6 } from './MarketResearchHandoffV6';
import { MarketCalibrationV6 } from './MarketCalibrationV6';
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
    const primaryPanel = 'rounded-lg border backdrop-blur-md ' + t.panelPrimary;
    const secondaryPanel = 'rounded-lg border backdrop-blur-sm ' + t.panelSecondary;
    const valuationBackdrop = signal.metadata.valuation_backdrop;
    const marketContext = signal.metadata.market_context;

    return (
        <div className="mt-4 space-y-5" aria-busy={updating}>
            {refreshError ? (
                <div role="status" className={'rounded-md border px-4 py-3 text-sm ' + (theme === 'light' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-amber-400/35 bg-amber-500/10 text-amber-100')}>
                    Showing the previous briefing while the latest refresh is unavailable: {refreshError}
                </div>
            ) : null}

            <div className="min-w-0">
                <section className={primaryPanel + ' min-w-0 overflow-hidden'} aria-labelledby="market-story-title" data-surface-tier="primary">
                    <div className={'h-1 bg-gradient-to-r ' + tierTone.rail} />
                    <div className="p-5 sm:p-7">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className={'text-xs font-semibold uppercase tracking-[0.12em] ' + t.textMuted}>Today&apos;s market story</p>
                            {updating ? <span className={'text-xs ' + t.textMuted}>Refreshing data...</span> : null}
                        </div>
                        <h1 id="market-story-title" className={'mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl ' + t.textPrimary}>{storyHeadline}</h1>
                        <p className={'mt-3 max-w-4xl text-base leading-7 sm:text-lg ' + t.textSecondary}>{posture.summary}</p>

                        <dl className={'mt-5 grid border-y sm:grid-cols-2 lg:grid-cols-4 ' + t.divider} data-testid="market-story-trust">
                            <StoryTrustItemV6 label="Composite score" value={Math.round(signal.composite_score) + ' / 100'} theme={theme} />
                            <StoryTrustItemV6 label="Indicator agreement" value={Math.round(signal.confidence.agreement_pct) + '%'} theme={theme} />
                            <StoryTrustItemV6 label="Data freshness" value={capitalize(quality?.freshness ?? 'unavailable')} valueClass={getFreshnessTone(capitalize(quality?.freshness ?? 'stale'), theme)} theme={theme} />
                            <StoryTrustItemV6 label="Briefing as of" value={formatCompactDateV6(signal.metadata.score_delta?.snapshot_date)} theme={theme} />
                        </dl>

                        <div className={'mt-6 border-t pt-5 ' + t.divider}>
                            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted}>What is driving the story</p>
                            <p className={'mt-2 max-w-3xl text-sm leading-6 ' + t.textSecondary}>The strongest readings explain the current interpretation. Complete score calculations remain in Why this score.</p>
                            <div className="mt-4 grid lg:grid-cols-3" data-testid="market-story-evidence">
                                {storyDrivers.map((driver, index) => (
                                    <StoryChapterV6 key={driver.key} driver={driver} index={index} signal={signal} theme={theme} />
                                ))}
                                {storyDrivers.length === 0 ? <p className={'text-sm ' + t.textMuted}>Ranked evidence is unavailable for this snapshot.</p> : null}
                            </div>
                            {drivers.length > storyDrivers.length ? <p className={'mt-3 text-xs leading-5 ' + t.textMuted}>Showing the {storyDrivers.length} largest score contributions. All {drivers.length} active indicators appear in the weighted evidence section below.</p> : null}
                        </div>
                    </div>
                </section>

            </div>

            <section className={secondaryPanel + ' overflow-hidden'} aria-labelledby="changed-title" data-surface-tier="secondary">
                <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-[220px_repeat(3,minmax(0,1fr))]">
                    <div className={'p-3.5 sm:p-4 ' + t.cell} data-testid="change-summary-cell">
                        <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted} data-testid="change-summary-label">Since the prior snapshot</p>
                        <h2 id="changed-title" className={'mt-2 break-words text-lg font-bold sm:text-xl ' + t.textPrimary} data-testid="change-summary-value">What changed</h2>
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

            <section className={primaryPanel + ' relative z-20 p-5 sm:p-6'} aria-labelledby="score-evidence-title" data-surface-tier="primary">
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
                        <div className={'mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2 ' + t.divider}>
                            <CompactFactV6 label="Trend" value={signal.metadata.trend_context?.score_trend ?? 'Not available'} theme={theme} />
                            <CompactFactV6 label="Last signal change" value={signal.metadata.trend_context?.last_signal_change ?? 'Not available'} theme={theme} />
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

            <MarketCalibrationV6 signal={signal} theme={theme} />

            <section className={'border-y py-5 sm:py-6 ' + t.divider} aria-label="Forward scenarios and market developments" data-surface-tier="secondary">
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

            <MarketToResearchLinkV6 signal={signal} theme={theme} />

            <section className={'border-t pt-5 sm:pt-6 ' + t.divider} aria-labelledby="terms-title" data-surface-tier="utility">
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
        <details className={'group overflow-hidden rounded-lg border backdrop-blur-sm ' + t.panelUtility} aria-labelledby="valuation-backdrop-title" data-testid="valuation-backdrop" data-surface-tier="utility">
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
    const reading = component ? formatRawValue(component, signal.metadata.market) : driver.raw_value.toString();
    const role = getStoryDriverRoleV6(driver, index);
    const roleTone = driver.conflict ? t.risk : driver.impact === 'negative' ? (theme === 'light' ? 'text-amber-800' : 'text-amber-200') : t.positive;
    const explanationTone = theme === 'light' ? 'text-slate-500' : 'text-[#9aa8b8]';
    const freshnessWarning = driver.freshness.toLowerCase() !== 'fresh';
    const divider = driver.conflict
        ? theme === 'light' ? 'border-rose-300' : 'border-rose-400/45'
        : t.divider;

    return (
        <article className={'flex min-w-0 flex-col border-t py-4 first:border-t-0 first:pt-0 lg:border-l lg:border-t-0 lg:px-4 lg:py-0 lg:first:border-l-0 lg:first:pl-0 lg:last:pr-0 ' + divider}>
            <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + roleTone}>{role}</p>
            <h2 className={'mt-1 text-base font-bold ' + t.textPrimary}>{component?.display_name ?? driver.name}</h2>
            <div className="mt-4">
                <p className={'text-xs font-semibold ' + t.textMuted}>Actual reading</p>
                <p className={'mt-1 text-xl font-bold tabular-nums ' + t.textPrimary}>{reading}</p>
            </div>
            <p className={'mt-3 text-sm leading-5 ' + explanationTone} data-testid="market-story-relationship">{getStoryRelationshipV6(driver)}</p>
            {freshnessWarning ? (
                <p className={'mt-4 border-l-2 pl-2 text-xs font-semibold ' + divider + ' ' + getFreshnessTone(driver.freshness, theme)} data-testid="market-story-freshness-warning">
                    Freshness: {driver.freshness}
                </p>
            ) : null}
        </article>
    );
};

const getStoryDriverRoleV6 = (driver: DriverV6, index: number) => {
    if (driver.conflict) return index === 0 ? 'Main conflict' : 'Conflicting signal';
    if (index === 0) return 'Strongest influence';
    if (driver.impact === 'negative') return 'Additional caution';
    if (driver.impact === 'positive') return 'Additional support';
    return 'Additional context';
};

const getStoryRelationshipV6 = (driver: DriverV6) => {
    if (driver.conflict) return 'This reading points away from the majority view and reduces indicator agreement.';
    if (driver.key === 'vix') return driver.impact === 'positive'
        ? 'Current volatility supports the positive market view.'
        : 'Current volatility adds caution to the market view.';
    if (driver.key === 'aaii') return 'Individual-investor sentiment supports the current interpretation.';
    if (driver.key === 'naaim') return 'Active-manager exposure supports the current interpretation.';
    if (driver.key === 'put_call') return 'Options positioning supports the current interpretation.';
    if (driver.impact === 'positive') return 'This reading adds support to the current market view.';
    if (driver.impact === 'negative') return 'This reading adds caution to the current market view.';
    return 'This reading provides context without a strong directional push.';
};

const StoryTrustItemV6 = ({ label, value, valueClass, theme }: { label: string; value: string; valueClass?: string; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    return (
        <div className={'min-w-0 border-b p-3 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 ' + t.divider + ' ' + t.cell}>
            <dt className={'text-[11px] font-semibold uppercase tracking-[0.08em] ' + t.textMuted}>{label}</dt>
            <dd className={'mt-1 break-words text-sm font-bold ' + (valueClass ?? t.textPrimary)}>{value}</dd>
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
        <article className={'min-w-0 p-3.5 sm:p-4 ' + t.cell} data-testid="change-summary-cell">
            <p className={'text-xs font-semibold uppercase tracking-[0.1em] ' + t.textMuted} data-testid="change-summary-label">{label}</p>
            <p className={'mt-2 break-words text-lg font-bold sm:text-xl ' + (valueClass ?? t.textPrimary)} data-testid="change-summary-value">{value}</p>
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
                <table className="w-full table-fixed border-separate border-spacing-y-1 text-left text-sm">
                    <thead>
                        <tr className={'text-xs uppercase tracking-[0.08em] ' + t.textMuted}>
                            <th className={'w-[42%] border-b pb-3 pl-3 font-semibold ' + t.divider}>Driver</th>
                            <th className={'w-[20%] border-b pb-3 font-semibold ' + t.divider}>Reading</th>
                            <th className={'w-[18%] border-b pb-3 text-right font-semibold ' + t.divider}>Weighted points</th>
                            <th className={'w-[20%] border-b pb-3 pr-3 text-right font-semibold ' + t.divider}>Freshness</th>
                        </tr>
                    </thead>
                    <tbody>
                        {drivers.map((driver, index) => <DriverRowV6 key={driver.key} driver={driver} signal={signal} maxContribution={maxContribution} tooltipPlacement={index === drivers.length - 1 ? 'top' : 'bottom'} theme={theme} />)}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 space-y-3 md:hidden">
                {drivers.map((driver, index) => <DriverCardV6 key={driver.key} driver={driver} signal={signal} maxContribution={maxContribution} tooltipPlacement={index === drivers.length - 1 ? 'top' : 'bottom'} theme={theme} />)}
            </div>
            <CoverageAdjustmentV6 signal={signal} theme={theme} />
        </>
    );
};

const CoverageAdjustmentV6 = ({ signal, theme }: { signal: MarketSignal; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    const coverage = signal.metadata.coverage_adjustment;
    if (!coverage) return null;

    const activePct = Math.round(coverage.active_weight * 100);
    const missingPct = Math.round(coverage.missing_weight * 100);
    return (
        <div className={'mt-4 rounded-md border px-3 py-2.5 text-xs leading-5 ' + t.row} data-testid="coverage-adjustment">
            <p className={t.textSecondary}>
                <span className={'font-semibold ' + t.textPrimary}>Score composition: </span>
                Active drivers ({activePct}% configured weight) contribute {coverage.active_points.toFixed(1)} points
                {coverage.missing_weight > 0.0001 ? ` + neutral reserve (${missingPct}% × ${coverage.neutral_baseline}) contributes ${coverage.neutral_points.toFixed(1)} points` : ''}
                {' = '}{signal.composite_score}.
            </p>
            {coverage.missing_weight > 0.0001 ? (
                <p className={'mt-1 ' + t.textMuted}>Unavailable configured weight stays at neutral {coverage.neutral_baseline}; it is not redistributed to the remaining drivers.</p>
            ) : null}
        </div>
    );
};

const DriverRowV6 = ({ driver, signal, maxContribution, tooltipPlacement, theme }: { driver: DriverV6; signal: MarketSignal; maxContribution: number; tooltipPlacement: 'top' | 'bottom'; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    const component = signal.components[driver.key];
    const cellSurface = driver.conflict
        ? theme === 'light' ? 'border-y border-rose-200 bg-rose-50/75' : 'border-y border-rose-400/25 bg-rose-500/[0.06]'
        : 'border-b ' + t.divider;
    const firstCellSurface = driver.conflict
        ? theme === 'light' ? 'rounded-l-md border-l border-rose-200 shadow-[inset_3px_0_0_#e11d48]' : 'rounded-l-md border-l border-rose-400/25 shadow-[inset_3px_0_0_#fb7185]'
        : '';
    const lastCellSurface = driver.conflict
        ? theme === 'light' ? 'rounded-r-md border-r border-rose-200' : 'rounded-r-md border-r border-rose-400/25'
        : '';
    return (
        <tr className="align-top">
            <td className={'py-3 pl-3 pr-3 ' + cellSurface + ' ' + firstCellSurface}>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={'font-semibold ' + t.textPrimary}>{driver.name}</span>
                    {driver.conflict ? <ConflictBadgeV6 driver={driver} signal={signal} placement={tooltipPlacement} theme={theme} /> : null}
                </div>
                <div className={'mt-2 h-1.5 overflow-hidden rounded-full ' + (theme === 'light' ? 'bg-slate-200' : 'bg-slate-700')}>
                    <div className={'h-full rounded-full ' + driverBarToneV6(driver)} style={{ width: Math.max(6, (Math.abs(driver.contribution) / maxContribution) * 100) + '%' }} />
                </div>
            </td>
            <td className={'py-3 pr-3 ' + cellSurface + ' ' + t.textSecondary}>{component ? formatRawValue(component, signal.metadata.market) : driver.raw_value.toString()}</td>
            <td className={'py-3 text-right tabular-nums ' + cellSurface}>
                <span className={'block font-bold ' + driverTextToneV6(driver, theme)}>{driver.contribution.toFixed(1)}</span>
                <span className={'mt-0.5 block text-[11px] font-medium ' + t.textMuted}>{Math.round(driver.weight * 100)}% configured weight</span>
            </td>
            <td className={'py-3 pr-3 text-right text-xs font-semibold ' + cellSurface + ' ' + lastCellSurface + ' ' + getFreshnessTone(driver.freshness, theme)}>{driver.freshness}</td>
        </tr>
    );
};

const DriverCardV6 = ({ driver, signal, maxContribution, tooltipPlacement, theme }: { driver: DriverV6; signal: MarketSignal; maxContribution: number; tooltipPlacement: 'top' | 'bottom'; theme: ResearchThemeV6 }) => {
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
                    <p className={'mt-0.5 text-[11px] font-medium ' + t.textMuted}>{Math.round(driver.weight * 100)}% configured weight</p>
                    <p className={'mt-1 text-xs font-semibold ' + getFreshnessTone(driver.freshness, theme)}>{driver.freshness}</p>
                </div>
            </div>
            <div className={'mt-3 h-1.5 overflow-hidden rounded-full ' + (theme === 'light' ? 'bg-slate-200' : 'bg-slate-700')}>
                <div className={'h-full rounded-full ' + driverBarToneV6(driver)} style={{ width: Math.max(6, (Math.abs(driver.contribution) / maxContribution) * 100) + '%' }} />
            </div>
            {driver.conflict ? (
                <div className="mt-2 flex items-center gap-2">
                    <span className={'text-xs font-semibold ' + t.risk}>Conflicts with the majority read</span>
                    <ConflictInfoV6 driver={driver} signal={signal} placement={tooltipPlacement} theme={theme} />
                </div>
            ) : null}
        </article>
    );
};

const ConflictBadgeV6 = ({ driver, signal, placement, theme }: { driver: DriverV6; signal: MarketSignal; placement: 'top' | 'bottom'; theme: ResearchThemeV6 }) => (
    <span className="inline-flex items-center gap-1.5">
        <span className={'rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] ' + (theme === 'light' ? 'border-rose-300 text-rose-700' : 'border-rose-400/40 text-rose-200')}>Conflicts</span>
        <ConflictInfoV6 driver={driver} signal={signal} placement={placement} theme={theme} />
    </span>
);

const ConflictInfoV6 = ({ driver, signal, placement, theme }: { driver: DriverV6; signal: MarketSignal; placement: 'top' | 'bottom'; theme: ResearchThemeV6 }) => {
    const explanation = getConflictExplanationV6(driver, signal);
    return (
        <details className="group relative z-0 open:z-50" data-testid="conflict-explanation" data-driver={driver.key}>
            <summary
                className={'flex size-5 cursor-help list-none items-center justify-center rounded-full border transition-colors marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 ' + (theme === 'light'
                    ? 'border-rose-300 bg-white text-rose-700 hover:bg-rose-100 focus-visible:outline-rose-600'
                    : 'border-rose-400/50 bg-slate-950 text-rose-200 hover:bg-rose-500/15 focus-visible:outline-rose-300')}
                aria-label={'Explain why ' + driver.name + ' conflicts'}
            >
                <svg viewBox="0 0 20 20" className="size-3" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M10 8.5v5M10 6.15v.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            </summary>
            <span
                role="note"
                className={'absolute left-1/2 z-40 w-72 max-w-[calc(100vw-3rem)] -translate-x-1/2 rounded-md border p-3 text-left text-xs font-normal normal-case leading-5 tracking-normal shadow-lg md:w-80 ' + (placement === 'top' ? 'bottom-[calc(100%+0.5rem)] ' : 'top-[calc(100%+0.5rem)] ') + (theme === 'light'
                    ? 'border-slate-300 bg-slate-950 text-slate-50 shadow-slate-900/15'
                    : 'border-slate-600 bg-slate-100 text-slate-900 shadow-black/35')}
            >
                <strong className="block font-semibold">Why this conflicts</strong>
                <span className="mt-2 block"><span className="font-semibold">Reading:</span> {explanation.reading}</span>
                <span className="mt-1 block"><span className="font-semibold">Source:</span> {explanation.source}</span>
                <span className="mt-1 block"><span className="font-semibold">Model conversion:</span> {explanation.scoring}</span>
                <span className="mt-1 block"><span className="font-semibold">Score contribution:</span> {explanation.contribution}</span>
                <span className="mt-1 block"><span className="font-semibold">Reason:</span> {explanation.reason}</span>
            </span>
        </details>
    );
};

const getConflictExplanationV6 = (driver: DriverV6, signal: MarketSignal) => {
    const component = signal.components[driver.key];
    const majority = signal.confidence.majority_signal;
    const majorityDirection = getDirectionLabelV6(majority);
    const componentAction = component ? getSignalAction(component.signal) : null;
    const reading = component ? formatRawValue(component, signal.metadata.market) : driver.raw_value.toString();
    const source = getDriverSourceV6(driver, signal);
    const scoring = getDriverScoringV6(driver, signal);
    const contribution = `${(component?.score ?? driver.score).toFixed(0)}/100 × ${Math.round(driver.weight * 100)}% configured weight = ${driver.contribution.toFixed(1)} weighted points.`;

    if ((driver.key === 'social' || driver.key === 'news') && component && Math.abs(component.value) < 0.005) {
        return {
            reading,
            source,
            scoring,
            contribution,
            reason: `The resulting 50/100 category is neutral, so it does not confirm the majority ${majorityDirection} direction. A displayed 0.00 is an active balanced reading, not “off”; an off or unavailable source is excluded entirely.`,
        };
    }
    if (componentAction === 'NEUTRAL' && majority !== 'NEUTRAL') {
        return {
            reading,
            source,
            scoring,
            contribution,
            reason: `${(component?.score ?? driver.score).toFixed(0)}/100 is in the neutral 40–64 band, so it does not confirm the majority ${majorityDirection} direction.`,
        };
    }
    if (componentAction && componentAction !== majority) {
        return {
            reading,
            source,
            scoring,
            contribution,
            reason: `The converted score maps ${getDirectionLabelV6(componentAction)} while the majority points ${majorityDirection}, so it pulls against the overall direction.`,
        };
    }
    if (driver.impact === 'negative') {
        return { reading, source, scoring, contribution, reason: `Its converted score is interpreted against the overall ${majorityDirection} read, so it reduces agreement with the majority.` };
    }
    return { reading, source, scoring, contribution, reason: `The signal engine flags it as not fully confirming the overall ${majorityDirection} read.` };
};

const getDriverScoringV6 = (driver: DriverV6, signal: MarketSignal) => {
    const component = signal.components[driver.key];
    const value = component?.value ?? driver.raw_value;
    const score = component?.score ?? driver.score;
    if (driver.key === 'aaii') {
        return `Model range: 20% bullish → 0; 50% bullish → 100. Current: (${value.toFixed(1)} − 20) ÷ 30 × 100 = ${score.toFixed(0)}/100.`;
    }
    if (driver.key === 'put_call') {
        return `Model range: 0.55 → 100 (call-heavy); 1.25 → 0 (put-heavy). Current: (1.25 − ${value.toFixed(2)}) ÷ 0.70 × 100 = ${score.toFixed(0)}/100.`;
    }
    if (driver.key === 'social' || driver.key === 'news') {
        return `Model range: −1 sentiment → 0; +1 → 100. Current: (${value.toFixed(2)} + 1) × 50 = ${score.toFixed(0)}/100.`;
    }
    if (driver.key === 'naaim') {
        return `Model range: 40% exposure → 0; 90% → 100, capped outside that range. Current result: ${score.toFixed(0)}/100.`;
    }
    return `The model converts this indicator’s raw reading to ${score.toFixed(0)}/100 using its configured calibration.`;
};

const getDriverSourceV6 = (driver: DriverV6, signal: MarketSignal) => {
    const component = signal.components[driver.key];
    const date = formatCompactDateV6(component?.last_updated ?? driver.last_updated);
    if (driver.key === 'aaii') return `AAII Investor Sentiment Survey, weekly reading dated ${date}.`;
    if (driver.key === 'social') return `Equal blend of current Reddit and StockTwits sentiment inputs, updated ${date}.`;
    if (driver.key === 'news') return `80% market-news and 20% Bursa-focused Reddit sentiment blend, updated ${date}.`;
    if (driver.key === 'put_call') return `Cboe, a major US options exchange. Total market put/call ratio, report dated ${date}.`;
    if (driver.key === 'naaim') return `NAAIM Exposure Index, weekly reading dated ${date}.`;
    if (driver.key === 'vix') return `${signal.metadata.market === 'MY' ? 'USD/MYR volatility proxy' : 'Cboe VIX market reading'}, updated ${date}.`;
    return `Stored ${driver.name} reading dated ${date}.`;
};

const getDirectionLabelV6 = (action: MarketSignal['confidence']['majority_signal']) => {
    if (action === 'BUY') return 'positive';
    if (action === 'SELL') return 'negative';
    return 'mixed';
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
        <details open={defaultOpen} className={'group rounded-lg border backdrop-blur-sm ' + t.panelUtility} data-surface-tier="utility">
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
