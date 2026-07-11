import type { ReactNode } from 'react';
import type { ResearchWatchlistItem } from '@/components/research/ResearchDashboardV2';
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

export const ResearchPanelsV6 = ({ ticker, tab, theme }: {
    ticker: ResearchWatchlistItem;
    tab: ResearchTabV6;
    theme: ResearchThemeV6;
}) => {
    const themeClasses = getThemeV6(theme);
    const point = (label: string, value: string, wide = false) => (
        <DataPointV6 label={label} value={value} wide={wide} themeClasses={themeClasses} />
    );

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
    return (
        <DataGridV6 themeClasses={themeClasses}>
            {point('50-day average', ticker.technical.ma50)}
            {point('200-day average', ticker.technical.ma200)}
            {point('52-week range', ticker.technical.range52Week)}
            {point('RSI', ticker.technical.rsi)}
            {point('MACD', ticker.technical.macd)}
            {point('Volume', ticker.technical.volume)}
            {point('Support / resistance', ticker.technical.supportResistance, true)}
        </DataGridV6>
    );
};
