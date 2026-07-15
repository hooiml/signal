import type { MarketSignal } from '@/lib/types/signal-v2';
import { formatCompactDateV6 } from './market-v6';
import { getThemeV6, type ResearchThemeV6 } from './research-v6';

type MarketContext = NonNullable<MarketSignal['metadata']['market_context']>;
type ContextTone = 'positive' | 'caution' | 'neutral';

type ContextCardProps = {
    label: string;
    value: string;
    badge: string;
    detail: string;
    reportLabel: string;
    reportDate: string;
    sourceUrls: readonly string[];
    tone: ContextTone;
    theme: ResearchThemeV6;
};

export const MarketContextV6 = ({ context, theme }: { context: MarketContext; theme: ResearchThemeV6 }) => {
    const t = getThemeV6(theme);
    const isUs = context.market === 'US';
    const cards = isUs ? buildUsCards(context, theme) : buildMalaysiaCards(context, theme);
    if (cards.length === 0) return null;

    return (
        <details className={'group overflow-hidden rounded-lg border backdrop-blur-md ' + t.panel} aria-labelledby="market-context-title" data-testid="market-context">
            <summary className={'flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:content-none ' + t.textPrimary}>
                <span className="min-w-0">
                    <span className={'block text-xs font-semibold uppercase tracking-[0.12em] ' + t.textMuted}>Context only</span>
                    <span id="market-context-title" className={'mt-1 block text-base font-bold sm:text-lg ' + t.textPrimary}>{isUs ? 'Macro and breadth context' : 'Malaysia rate context'}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                    <span className={'hidden rounded border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] sm:inline-flex ' + t.divider + ' ' + t.textMuted}>Not scored</span>
                    <span aria-hidden="true" className={'text-lg transition-transform group-open:rotate-45 ' + t.textMuted}>+</span>
                </span>
            </summary>

            <div className={'border-t ' + t.divider}>
                <p className={'px-5 pt-5 text-sm leading-5 ' + t.textSecondary}>{isUs
                    ? 'Independent checks that frame the market story without changing the composite score.'
                    : 'Native BNM rates keep Malaysia context local instead of applying US macro proxies.'}</p>

                <div className="grid gap-3 p-4 sm:p-5 md:grid-cols-3">
                    {cards.map((card) => <ContextCard key={card.label} {...card} theme={theme} />)}
                </div>

                <div className={'border-t px-5 py-4 ' + t.divider}>
                    <p className={'text-xs leading-5 ' + t.textMuted}>{isUs
                        ? 'The yield curve is a medium-term guardrail, NFCI is a weekly financial-conditions read, and breadth is a one-year comparison. None is a standalone recession or trading signal.'
                        : 'MGS, OPR, MYOR, and short-term bill readings are reference context only. They do not change the composite score.'}</p>
                </div>
            </div>
        </details>
    );
};

const ContextCard = ({ label, value, badge, detail, reportLabel, reportDate, sourceUrls, tone, theme }: ContextCardProps) => {
    const t = getThemeV6(theme);
    const toneClasses = getContextTone(tone, theme);

    return (
        <article className={'min-w-0 rounded-md border p-4 ' + t.row}>
            <div className="flex items-start justify-between gap-3">
                <p className={'text-xs font-semibold uppercase tracking-[0.08em] ' + t.textMuted}>{label}</p>
                <span className={'rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ' + toneClasses.badge}>{badge}</span>
            </div>
            <p className={'mt-4 break-words text-2xl font-bold tabular-nums ' + toneClasses.value}>{value}</p>
            <p className={'mt-2 text-sm leading-5 ' + t.textSecondary}>{detail}</p>
            <div className={'mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 ' + t.divider}>
                <p className={'text-xs ' + t.textMuted}>{reportLabel} {formatCompactDateV6(reportDate)}</p>
                <div className="flex flex-wrap gap-2" aria-label={label + ' sources'}>
                    {sourceUrls.map((url) => (
                        <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className={'inline-flex min-h-10 items-center rounded-md border px-2.5 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' + t.divider + ' ' + t.textSecondary + (theme === 'light' ? ' hover:border-sky-400 hover:text-sky-700 focus-visible:outline-sky-500' : ' hover:border-sky-300 hover:text-sky-200 focus-visible:outline-sky-300')}
                        >
                            {getSourceLabel(url)}
                        </a>
                    ))}
                </div>
            </div>
        </article>
    );
};

const buildUsCards = (context: Extract<MarketContext, { market: 'US' }>, theme: ResearchThemeV6): ContextCardProps[] => {
    const cards: ContextCardProps[] = [];
    if (context.yield_curve) {
        const curve = context.yield_curve;
        cards.push({
            label: '10Y–3M yield curve',
            value: formatSigned(curve.spread_pct, 2) + ' pp',
            badge: curve.state === 'inverted' ? 'Inverted' : 'Normal slope',
            detail: curve.state === 'inverted'
                ? 'Inverted; use as a guardrail, not a standalone recession forecast.'
                : 'Positive slope; medium-term context, not a standalone recession forecast.',
            reportLabel: 'Reported',
            reportDate: curve.report_date,
            sourceUrls: [curve.source_url],
            tone: curve.state === 'inverted' ? 'caution' : 'positive',
            theme,
        });
    }
    if (context.financial_conditions) {
        const conditions = context.financial_conditions;
        const stanceLabel = conditions.stance === 'tighter' ? 'Tighter than average' : conditions.stance === 'looser' ? 'Looser than average' : 'Near average';
        cards.push({
            label: 'Chicago Fed NFCI',
            value: formatSigned(conditions.value, 3),
            badge: conditions.stance === 'tighter' ? 'Tighter' : conditions.stance === 'looser' ? 'Looser' : 'Near average',
            detail: `${stanceLabel}; a broad weekly financial-conditions read that complements volatility data.`,
            reportLabel: 'Reported',
            reportDate: conditions.report_date,
            sourceUrls: [conditions.source_url],
            tone: conditions.stance === 'tighter' ? 'caution' : conditions.stance === 'looser' ? 'positive' : 'neutral',
            theme,
        });
    }
    if (context.breadth) {
        const breadth = context.breadth;
        const broadening = breadth.relative_return_pct > 0.1;
        const narrowing = breadth.relative_return_pct < -0.1;
        cards.push({
            label: 'Market breadth',
            value: formatSigned(breadth.relative_return_pct, 1) + ' pp',
            badge: broadening ? 'Broadening' : narrowing ? 'Narrowing' : 'Mixed',
            detail: `Equal-weight ${formatSigned(breadth.equal_weight_return_pct, 1)} vs cap-weight ${formatSigned(breadth.cap_weight_return_pct, 1)} over ${breadth.period_label}.`,
            reportLabel: 'Refreshed',
            reportDate: breadth.report_date,
            sourceUrls: breadth.source_urls,
            tone: broadening ? 'positive' : narrowing ? 'caution' : 'neutral',
            theme,
        });
    }
    return cards;
};

const buildMalaysiaCards = (context: Extract<MarketContext, { market: 'MY' }>, theme: ResearchThemeV6): ContextCardProps[] => {
    const rates = context.malaysia_rates;
    if (!rates) return [];

    const cards: ContextCardProps[] = [{
        label: 'MGS 10Y–3Y curve',
        value: formatSigned(rates.curve_spread_pct, 2) + ' pp',
        badge: rates.curve_spread_pct < 0 ? 'Inverted' : 'Normal slope',
        detail: `3Y ${rates.mgs_3y_pct.toFixed(2)}% · 10Y ${rates.mgs_10y_pct.toFixed(2)}%`,
        reportLabel: 'Trading date',
        reportDate: rates.report_date,
        sourceUrls: [rates.source_url],
        tone: rates.curve_spread_pct < 0 ? 'caution' : 'positive',
        theme,
    }, {
        label: 'OPR / MYOR',
        value: `${rates.opr_pct.toFixed(2)}% / ${rates.myor_pct.toFixed(2)}%`,
        badge: 'Policy context',
        detail: `OPR ${formatCompactDateV6(rates.opr_report_date)} · MYOR ${formatCompactDateV6(rates.report_date)}`,
        reportLabel: 'Latest',
        reportDate: rates.report_date,
        sourceUrls: [rates.source_url],
        tone: 'neutral',
        theme,
    }];

    if (rates.short_term_bill_3m_pct !== null) {
        cards.push({
            label: '3M short-term bill',
            value: rates.short_term_bill_3m_pct.toFixed(2) + '%',
            badge: 'Short rate',
            detail: `${rates.short_term_bill_name ?? 'BNM Monetary Notes'} · local short-term funding context.`,
            reportLabel: 'Trading date',
            reportDate: rates.report_date,
            sourceUrls: [rates.source_url],
            tone: 'neutral',
            theme,
        });
    }
    return cards;
};

const formatSigned = (value: number, decimals: number): string => `${value > 0 ? '+' : ''}${value.toFixed(decimals)}`;

const getContextTone = (tone: ContextTone, theme: ResearchThemeV6) => {
    if (tone === 'caution') return {
        value: theme === 'light' ? 'text-rose-600' : 'text-rose-300',
        badge: theme === 'light' ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-rose-400/40 bg-rose-500/10 text-rose-200',
    };
    if (tone === 'positive') return {
        value: theme === 'light' ? 'text-emerald-700' : 'text-emerald-300',
        badge: theme === 'light' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200',
    };
    return {
        value: theme === 'light' ? 'text-sky-700' : 'text-sky-300',
        badge: theme === 'light' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-sky-400/40 bg-sky-500/10 text-sky-200',
    };
};

const getSourceLabel = (url: string): string => {
    if (url.includes('financialmarkets.bnm.gov.my')) return 'BNM';
    if (url.includes('T10Y3M') || url.includes('NFCI')) return 'FRED';
    if (url.includes('SP500EW')) return 'Equal-weight';
    if (url.includes('GSPC')) return 'Cap-weight';
    return 'Source';
};
