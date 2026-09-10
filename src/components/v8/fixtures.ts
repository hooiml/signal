import type { ResearchMarket, ResearchStatus } from '@/lib/types/research';

// Synthetic examples only. These are presentation fixtures, never scoring inputs or API records.
export type FixtureState = 'populated' | 'missing' | 'empty';
export type Lens = 'standard' | 'contrarian';
export type Driver = {
    name: string; reading: string; previous: string; score: number; weight: number;
    contribution: number; change: string; stance: 'Supports' | 'Conflicts' | 'Neutral';
    date: string; previousDate?: string; cadence: string; source: string; explanation: string;
};

export const marketFixtures: Record<ResearchMarket, {
    name: string; score: string; previous: string; change: string; alignment: string;
    headline: string; summary: string; drivers: Driver[];
}> = {
    US: {
        name: 'United States', score: '65.1', previous: '62.45', change: '+2.65', alignment: '3 of 6',
        headline: 'Calmer markets.\nUneven conviction.',
        summary: 'Easing volatility supports momentum. Options positioning tells a more guarded story. Read the disagreement before taking the headline at face value.',
        drivers: [
            { name: 'Volatility · VIX', reading: '18.4', previous: '20.5', score: 72, weight: 35, contribution: 25.2, change: '+2.45', stance: 'Supports', date: '04 Sep 2026, 20:00 UTC', cadence: 'Daily close', source: 'Cboe · illustrative reading', explanation: 'VIX describes expected near-term volatility from options prices. A lower reading can support a calmer market interpretation; it does not guarantee rising prices.' },
            { name: 'Social sentiment', reading: '+0.20', previous: '+0.10', score: 60, weight: 20, contribution: 12, change: '+1.00', stance: 'Neutral', date: '04 Sep 2026, 20:00 UTC', cadence: 'Intraday', source: 'Social aggregate · illustrative reading', explanation: 'A normalized aggregate of discussion tone. Neutral here means its normalized score remains in the mixed zone. Online discussion can be noisy and unrepresentative.' },
            { name: 'Options · put/call', reading: '1.12', previous: '0.98', score: 38, weight: 10, contribution: 3.8, change: '−0.80', stance: 'Conflicts', date: '04 Sep 2026, 20:00 UTC', cadence: 'Daily', source: 'Cboe · illustrative reading', explanation: 'Put/call compares put and call option activity. More puts can reflect defensive hedging, not necessarily a directional bearish bet. This conflicts with the stronger momentum readings.' },
            { name: 'Investor survey · AAII', reading: '41% bullish', previous: '41% bullish', score: 70, weight: 20, contribution: 14, change: '0.00', stance: 'Supports', date: '03 Sep 2026', cadence: 'Weekly survey', source: 'AAII · illustrative reading', explanation: 'AAII reports individual investors’ bullish percentage. Weekly observations describe positioning more slowly than daily volatility; high bullishness may also indicate crowding.' },
            { name: 'Manager exposure · NAAIM', reading: '76', previous: '76', score: 76, weight: 10, contribution: 7.6, change: '0.00', stance: 'Supports', date: '02 Sep 2026', cadence: 'Weekly survey', source: 'NAAIM · illustrative reading', explanation: 'Reported equity exposure among active investment managers. High exposure can support participation while leaving less room for further allocation.' },
            { name: 'Sell-side sentiment · SSI', reading: 'Manual example', previous: 'Manual example', score: 50, weight: 5, contribution: 2.5, change: '0.00', stance: 'Neutral', date: '31 Aug 2026', cadence: 'Manual input', source: 'BofA SSI placeholder · not a feed', explanation: 'A manual placeholder, not a connected institutional feed. This example is neutral. Its presence should never imply verified provider coverage.' },
        ],
    },
    MY: {
        name: 'Malaysia', score: '57.5', previous: '57.5', change: '0.0', alignment: 'Mixed',
        headline: 'A mixed picture.\nNews carries weight.',
        summary: 'The example remains in the mixed zone. News sentiment contributes half the configured weight, so the reading is sensitive to a narrow evidence base.',
        drivers: [
            { name: 'USD/MYR volatility proxy', reading: 'Low variability', previous: 'Low variability', score: 60, weight: 25, contribution: 15, change: '0.00', stance: 'Neutral', date: '04 Sep 2026', cadence: 'Daily', source: 'FX series · illustrative reading', explanation: 'An exchange-rate volatility proxy, not a native equity-volatility index. It describes currency conditions and has a different meaning from the US VIX.' },
            { name: 'Social sentiment', reading: 'Neutral', previous: 'Neutral', score: 50, weight: 15, contribution: 7.5, change: '0.00', stance: 'Neutral', date: '04 Sep 2026', cadence: 'Intraday', source: 'Social aggregate · illustrative reading', explanation: 'Discussion tone is mixed in this example. Missing or narrow coverage would weaken this observation.' },
            { name: 'News sentiment', reading: 'Slightly positive', previous: 'Slightly positive', score: 56, weight: 50, contribution: 28, change: '0.00', stance: 'Neutral', date: '04 Sep 2026', cadence: 'Intraday', source: 'News aggregate · illustrative reading', explanation: 'The largest configured input in the Malaysian model. Headline tone is not a direct measure of company cash flows or market breadth.' },
            { name: 'Investor survey · AAII', reading: '41% bullish', previous: '41% bullish', score: 70, weight: 10, contribution: 7, change: '0.00', stance: 'Supports', date: '03 Sep 2026', cadence: 'Weekly survey', source: 'AAII · US survey, illustrative reading', explanation: 'A US investor survey used as a cross-market sentiment proxy. It is not a survey of Malaysian investors.' },
        ],
    },
};

export type Company = { id: string; name: string; sector: string; market: ResearchMarket; status: ResearchStatus; coverage: string };
export const companies: Company[] = [
    { id: 'NORTH', name: 'Northstar Systems', sector: 'Enterprise software', market: 'US', status: 'watch', coverage: 'Populated case' },
    { id: 'MERIDIAN', name: 'Meridian Materials', sector: 'Specialty materials', market: 'US', status: 'waiting', coverage: 'Missing financials' },
    { id: 'RIMBA', name: 'Rimba Networks', sector: 'Network infrastructure', market: 'MY', status: 'watch', coverage: 'Unstarted case' },
];

export const researchEvidence = [
    { id: 'revenue', tone: 'Supports', title: 'Revenue grew; recurring demand is the hypothesis.', observation: 'Illustrative revenue: $120m, up from $100m in the prior comparable year.', source: 'Fictional FY2025 annual report · USD · published 20 Feb 2026', interpretation: 'The 20% increase is arithmetic from the fixture. It does not establish retention, pricing power, or future growth.', gap: 'Customer retention and concentration are not supplied.' },
    { id: 'cash', tone: 'Challenges', title: 'Growth has not translated into more free cash flow.', observation: 'Illustrative free cash flow: $8m, down from $12m in the prior comparable year.', source: 'Fictional FY2025 cash-flow statement · USD · published 20 Feb 2026', interpretation: 'Free cash flow declined while revenue increased. Investment or working capital could explain the gap; the cause is unverified.', gap: 'The working-capital bridge and capital-spending detail are missing.' },
    { id: 'valuation', tone: 'Gaps', title: 'A good business can still be a poor entry.', observation: 'No current price, comparable valuation, or target entry range is provided.', source: 'No source attached', interpretation: 'Value cannot be assessed from the available fixture. The research remains incomplete.', gap: 'Add a dated price and filing-aligned valuation assumptions before assessing an entry.' },
] as const;
