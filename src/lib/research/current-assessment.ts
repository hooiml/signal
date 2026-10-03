import type { ResearchSnapshot } from '../types/research-snapshot';

export type CurrentResearchAssessment = {
    headline: string;
    applicable: boolean;
    summary: string;
    supporting: string[];
    concerns: string[];
    gaps: string[];
    watchNext: string;
    coverage: number;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const DAY = 86_400_000;

/** Describes reported facts only. Never consumes authored records or generates a trade decision. */
export function assessCurrentResearch(snapshot: ResearchSnapshot | null, now: number): CurrentResearchAssessment {
    const supporting: string[] = [];
    const concerns: string[] = [];
    const gaps: string[] = [];
    const f = snapshot?.fundamentals;
    const period = f?.reportingPeriod ? Date.parse(f.reportingPeriod) : NaN;
    const validPeriod = Number.isFinite(period) && period <= now;
    const sourced = !!f?.source && validPeriod;
    const coverage = sourced ? [f?.revenueGrowthPercent, f?.annualNetIncome, f?.freeCashFlow].filter(finite).length : 0;
    const oldPeriod = validPeriod && now - period > 548 * DAY;
    const retrieved = snapshot ? Date.parse(snapshot.fetchedAt) : NaN;
    const oldSnapshot = !!snapshot && (!Number.isFinite(retrieved) || retrieved > now || now - retrieved > 2 * DAY);

    if (!sourced) gaps.push('Financial source or reporting period is unavailable. Company performance cannot be assessed from the price alone.');
    else {
        if (finite(f?.revenueGrowthPercent)) {
            const growth = f.revenueGrowthPercent;
            (growth < 0 ? concerns : supporting).push(growth === 0 ? 'Reported revenue was unchanged year over year.' : `Reported revenue ${growth > 0 ? 'grew' : 'fell'} ${Math.abs(growth).toFixed(1)}% year over year.`);
        } else gaps.push('Revenue growth is unavailable.');
        if (finite(f?.annualNetIncome)) {
            (f.annualNetIncome > 0 ? supporting : concerns).push(f.annualNetIncome > 0 ? 'The latest annual period reported a net profit.' : f.annualNetIncome < 0 ? 'The latest annual period reported a net loss.' : 'The latest annual period reported no net profit.');
        } else gaps.push('Annual net income is unavailable.');
        if (finite(f?.freeCashFlow)) {
            (f.freeCashFlow > 0 ? supporting : concerns).push(f.freeCashFlow > 0 ? 'Reported free cash flow was positive.' : f.freeCashFlow < 0 ? 'Reported free cash flow was negative; its cause needs context.' : 'Reported free cash flow was zero.');
        } else gaps.push('Free cash flow is unavailable.');
    }
    if (oldPeriod) gaps.push('The financial reporting period ended more than 18 months ago. These figures may no longer describe the business.');
    if (oldSnapshot) gaps.push('The provider response is older than two days or its retrieval date cannot be verified. Refresh before relying on it.');
    if (snapshot?.warnings.length) gaps.push('Provider coverage is limited. Source notices below explain which data could not be supplied.');
    gaps.push('These figures do not establish fair value, debt safety, or suitability. Company measures may not apply to funds or some sectors.');

    // Conservative exclusions, not a sector classifier or a new analytical model.
    // Legacy payloads lacking instrument metadata fail closed; facts remain available.
    const type = snapshot?.quote.instrumentType?.toUpperCase();
    const financialName = /bank|bancorp|financial|insurance|assurance|reit|investment trust/i.test(snapshot?.quote.name ?? '');
    const applicable = type === 'EQUITY' && !financialName;
    if (snapshot && !applicable) return {
        applicable, headline: 'Assessment not supported for this security',
        summary: type !== 'EQUITY' ? 'This company assessment requires provider identification as an equity. Funds, indices, other instruments and unidentified types are not assessed. Available facts remain below.' : 'The returned name may identify a financial business or property trust. These general company checks are not applied; available facts remain below.',
        supporting: [], concerns: [], gaps, coverage,
        watchNext: 'Inspect the sourced facts and issuer report using measures appropriate to this instrument.',
    };
    const limited = coverage < 3;
    return {
        applicable,
        headline: !snapshot || coverage === 0 ? 'Not enough financial data' : oldSnapshot || oldPeriod ? 'Older data · assessment limited' : limited ? 'Partial financial picture' : concerns.length ? 'Reported financial pressures' : f?.revenueGrowthPercent === 0 ? 'Stable revenue and positive earnings reported' : 'Growth and positive earnings reported',
        summary: !snapshot ? 'An assessment will appear when provider data is available. No notes or checklist are required.' : 'A rules-based summary of the latest returned annual figures. This is evidence about the business, not a buy or sell decision.',
        supporting, concerns, gaps, coverage,
        watchNext: limited || oldPeriod || oldSnapshot ? 'Check the latest issuer report and refresh the available data before drawing a conclusion.' : concerns.length ? 'In the next company report, check whether the weaker figures improve and what management says caused them.' : 'In the next company report, check whether revenue, profit and cash flow remain consistent.',
    };
}
