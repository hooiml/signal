import type { ReactNode } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
import { buildTechnicalOutlook, type TechnicalTone } from '@/lib/research/technical-outlook';
import type { ResearchSnapshot } from '@/lib/types/research-snapshot';
import { getThemeV6, type ResearchTabV6, type ResearchThemeClassesV6, type ResearchThemeV6 } from './research-v6';

const DataGridV6 = ({ children, themeClasses }: { children: ReactNode; themeClasses: ResearchThemeClassesV6 }) => (
    <dl className={'grid gap-px overflow-hidden rounded-lg border backdrop-blur-md sm:grid-cols-2 xl:grid-cols-3 ' + themeClasses.gridBorder}>
        {children}
    </dl>
);

const DataPointV6 = ({ label, value, wide, themeClasses }: {
    label: string;
    value: string;
    wide?: boolean;
    themeClasses: ResearchThemeClassesV6;
}) => (
    <div className={'p-4 transition-colors duration-300 ' + themeClasses.cell + ' ' + (wide ? 'sm:col-span-2 xl:col-span-3' : '')}>
        <dt className={'text-xs font-semibold ' + themeClasses.textMuted}>{label}</dt>
        <dd className={'mt-1 text-sm font-semibold leading-5 ' + themeClasses.textPrimary}>{value}</dd>
    </div>
);

const technicalToneClass = (tone: TechnicalTone, themeClasses: ResearchThemeClassesV6) => {
    if (tone === 'positive') return themeClasses.positive;
    if (tone === 'negative') return themeClasses.risk;
    return themeClasses.textSecondary;
};

const distanceFrom = (price: number | null, reference: number | null) => {
    if (price === null || reference === null || reference === 0) return 'Distance unavailable';
    const distance = ((price / reference) - 1) * 100;
    if (Math.abs(distance) < 0.05) return 'At the current price';
    return `${Math.abs(distance).toFixed(1)}% ${distance > 0 ? 'below price' : 'above price'}`;
};

const TechnicalMetricV6 = ({ label, value, context, themeClasses }: {
    label: string;
    value: string;
    context: string;
    themeClasses: ResearchThemeClassesV6;
}) => (
    <div className={'min-w-0 p-4 ' + themeClasses.cell}>
        <dt className={'text-[11px] font-bold uppercase tracking-[0.08em] ' + themeClasses.textMuted}>{label}</dt>
        <dd className={'mt-2 font-mono text-base font-bold tabular-nums ' + themeClasses.textPrimary}>{value}</dd>
        <p className={'mt-1 text-xs leading-5 ' + themeClasses.textMuted}>{context}</p>
    </div>
);

const TechnicalPanelV6 = ({ ticker, snapshot, theme, themeClasses }: {
    ticker: ResearchWatchlistItem;
    snapshot: ResearchSnapshot | null;
    theme: ResearchThemeV6;
    themeClasses: ResearchThemeClassesV6;
}) => {
    const outlook = snapshot ? buildTechnicalOutlook(snapshot) : null;
    const rangeLow = snapshot?.technicals.low52Week ?? null;
    const rangeHigh = snapshot?.technicals.high52Week ?? null;
    const price = snapshot?.quote.price ?? null;
    const rangePosition = price !== null && rangeLow !== null && rangeHigh !== null && rangeHigh > rangeLow
        ? Math.min(100, Math.max(0, ((price - rangeLow) / (rangeHigh - rangeLow)) * 100))
        : null;
    const macdContext = snapshot?.technicals.macd === null || snapshot?.technicals.macd === undefined
        ? 'Direction unavailable'
        : snapshot.technicals.macd >= 0 ? 'Above zero' : 'Below zero';
    const fallbackDetail = 'Live technical interpretation is unavailable. Saved indicator values remain visible.';
    const insights = outlook ? [
        { category: 'Trend', ...outlook.trend },
        { category: 'Momentum', ...outlook.momentum },
        { category: 'Participation', ...outlook.volume },
    ] : [
        { category: 'Trend', label: 'Trend unavailable', detail: fallbackDetail, tone: 'unavailable' as const },
        { category: 'Momentum', label: 'Momentum unavailable', detail: fallbackDetail, tone: 'unavailable' as const },
        { category: 'Participation', label: 'Volume unavailable', detail: fallbackDetail, tone: 'unavailable' as const },
    ];
    const metricContexts = {
        ma50: snapshot ? distanceFrom(price, snapshot.technicals.ma50) : 'Medium-term trend',
        ma200: snapshot ? distanceFrom(price, snapshot.technicals.ma200) : 'Long-term trend',
        rsi: outlook?.momentum.label ?? 'Momentum context',
        macd: macdContext,
        volume: outlook?.volume.label ?? 'Latest participation',
        range: rangePosition === null ? 'Position unavailable' : `${rangePosition.toFixed(0)}% through range`,
    };

    return (
        <section data-testid="technical-summary" aria-labelledby="technical-context-heading" className="space-y-4">
            <header className={'rounded-lg border p-5 ' + themeClasses.panelSecondary}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                        <p className={'text-[11px] font-bold uppercase tracking-[0.14em] ' + themeClasses.positive}>Technical context</p>
                        <h3 id="technical-context-heading" className={'mt-1 text-xl font-bold ' + themeClasses.textPrimary}>Market structure at a glance</h3>
                        <p className={'mt-2 text-sm leading-6 ' + themeClasses.textMuted}>Use price structure, momentum, and participation to understand timing and risk. These signals do not override the saved thesis, fundamentals, valuation, or downside checks.</p>
                    </div>
                    <div className={'rounded-full border px-3 py-1.5 text-xs font-bold ' + themeClasses.row + ' ' + technicalToneClass(outlook?.overall.tone ?? 'unavailable', themeClasses)}>
                        Technical posture · {outlook?.overall.label ?? 'Unavailable'}
                    </div>
                </div>
            </header>

            <dl data-testid="technical-metrics" className={'grid gap-px overflow-hidden rounded-lg border sm:grid-cols-2 min-[1100px]:grid-cols-3 min-[1350px]:grid-cols-6 ' + themeClasses.gridBorder}>
                <TechnicalMetricV6 label="50-day average" value={ticker.technical.ma50} context={metricContexts.ma50} themeClasses={themeClasses} />
                <TechnicalMetricV6 label="200-day average" value={ticker.technical.ma200} context={metricContexts.ma200} themeClasses={themeClasses} />
                <TechnicalMetricV6 label="RSI" value={ticker.technical.rsi} context={metricContexts.rsi} themeClasses={themeClasses} />
                <TechnicalMetricV6 label="MACD" value={ticker.technical.macd} context={metricContexts.macd} themeClasses={themeClasses} />
                <TechnicalMetricV6 label="Volume" value={ticker.technical.volume} context={metricContexts.volume} themeClasses={themeClasses} />
                <TechnicalMetricV6 label="52-week range" value={ticker.technical.range52Week} context={metricContexts.range} themeClasses={themeClasses} />
            </dl>

            <div data-testid="technical-insights" className="grid gap-3 min-[760px]:grid-cols-2">
                {insights.map((insight) => (
                    <article key={insight.category} className={'rounded-lg border p-5 ' + themeClasses.row}>
                        <p className={'text-[11px] font-bold uppercase tracking-[0.1em] ' + themeClasses.textMuted}>{insight.category}</p>
                        <h4 className={'mt-2 text-base font-bold ' + technicalToneClass(insight.tone, themeClasses)}>{insight.label}</h4>
                        <p className={'mt-2 text-sm leading-6 ' + themeClasses.textMuted}>{insight.detail}</p>
                    </article>
                ))}

                <article className={'rounded-lg border p-5 ' + themeClasses.row}>
                    <p className={'text-[11px] font-bold uppercase tracking-[0.1em] ' + themeClasses.textMuted}>Key levels</p>
                    <h4 className={'mt-2 text-base font-bold ' + themeClasses.textPrimary}>Support and resistance</h4>
                    <p className={'mt-2 text-sm leading-6 ' + themeClasses.textMuted}>{ticker.technical.supportResistance}</p>
                    <div
                        data-testid="technical-range-position"
                        role="img"
                        aria-label={rangePosition === null ? 'Current position within the 52-week range is unavailable' : `Current price is ${rangePosition.toFixed(0)} percent through the 52-week range`}
                        className="mt-5"
                    >
                        <div className={'relative h-1.5 rounded-full ' + themeClasses.statusSurface}>
                            {rangePosition !== null ? <>
                                <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/35" style={{ width: `${rangePosition}%` }} />
                                <span className={'absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-emerald-500 ' + (theme === 'light' ? 'bg-white' : 'bg-[#111a23]')} style={{ left: `${rangePosition}%` }} />
                            </> : null}
                        </div>
                        <div className={'mt-2 flex justify-between gap-3 font-mono text-[11px] tabular-nums ' + themeClasses.textMuted}>
                            <span>{rangeLow === null ? 'Low unavailable' : `Low ${rangeLow.toFixed(2)}`}</span>
                            <span>{rangeHigh === null ? 'High unavailable' : `High ${rangeHigh.toFixed(2)}`}</span>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    );
};

export const ResearchPanelsV6 = ({ ticker, tab, theme, snapshot = null }: {
    ticker: ResearchWatchlistItem;
    tab: ResearchTabV6;
    theme: ResearchThemeV6;
    snapshot?: ResearchSnapshot | null;
}) => {
    const themeClasses = getThemeV6(theme);
    const point = (label: string, value: string, wide = false) => (
        <DataPointV6 label={label} value={value} wide={wide} themeClasses={themeClasses} />
    );

    if (tab === 'chart') return null;

    if (tab === 'fundamentals') return (
        <DataGridV6 themeClasses={themeClasses}>
            {point('Sector', ticker.sector)}
            {point('Industry', ticker.industry)}
            {point('Market cap', ticker.marketCap)}
            {point('Revenue trend', ticker.revenueGrowth)}
            {point('Gross margin', ticker.grossMargin)}
            {point('Operating margin', ticker.operatingMargin)}
            {point('Free cash flow', ticker.freeCashFlowTrend)}
            {point('Debt', ticker.debtLevel)}
            {point('Cash position', ticker.cashPosition)}
            {point('Share count', ticker.shareCountTrend)}
            {point('Business description', ticker.description, true)}
        </DataGridV6>
    );
    if (tab === 'valuation') return (
        <DataGridV6 themeClasses={themeClasses}>
            {point('Target buy zone', ticker.targetBuyZone)}
            {point('P/E', ticker.valuation.pe)}
            {point('Forward P/E', ticker.valuation.forwardPe)}
            {point('Price / sales', ticker.valuation.priceSales)}
            {point('EV / EBITDA', ticker.valuation.evEbitda)}
            {point('FCF yield', ticker.valuation.fcfYield)}
            {point('Dividend yield', ticker.valuation.dividendYield)}
            {point('Five-year range', ticker.valuation.fiveYearRange)}
            {point('Peer note', ticker.valuation.peerNote, true)}
        </DataGridV6>
    );
    if (tab === 'events') return (
        <DataGridV6 themeClasses={themeClasses}>
            {point('Next earnings', ticker.event.nextEarnings)}
            {point('Last earnings', ticker.event.lastEarnings)}
            {point('Revenue result', ticker.event.revenueResult)}
            {point('EPS result', ticker.event.epsResult)}
            {point('Guidance', ticker.event.guidance, true)}
            {point('Event note', ticker.event.note, true)}
        </DataGridV6>
    );
    return <TechnicalPanelV6 ticker={ticker} snapshot={snapshot} theme={theme} themeClasses={themeClasses} />;
};
