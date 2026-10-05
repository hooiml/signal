import type { ResearchSnapshot } from '../types/research-snapshot';

export type CurrentResearchAssessment = {
    headline: string;
    status: 'available' | 'partial' | 'outdated' | 'insufficient' | 'unsupported';
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

    const type = snapshot?.quote.instrumentType?.toUpperCase();
    const classification = snapshot?.quote.classification;
    const classifiedAt = classification ? Date.parse(classification.retrievedAt) : NaN;
    const knownSector = new Set(['Basic Materials', 'Communication Services', 'Consumer Cyclical',
        'Consumer Defensive', 'Energy', 'Healthcare', 'Industrials', 'Real Estate', 'Technology', 'Utilities']);
    const classificationCurrent = classification?.source === 'Yahoo Finance' && Number.isFinite(classifiedAt)
        && classifiedAt <= now && now - classifiedAt <= 2 * DAY;
    const applicable = type === 'EQUITY' && classificationCurrent && classification?.instrumentType === type
        && knownSector.has(classification.sector ?? '') && !!classification.industry && !/^REIT(?:\W|$)/i.test(classification.industry);
    if (snapshot && !applicable) return {
        status: 'unsupported',
        applicable: !!applicable, headline: 'Assessment not supported for this security',
        summary: type !== 'EQUITY' ? 'This company assessment requires provider identification as an equity. Funds, indices, other instruments and unidentified types are not assessed. Available facts remain below.' : !classificationCurrent || !classification?.sector || !classification.industry || classification.instrumentType !== type ? 'Current sector and industry classification could not be verified for this listing. Company checks are withheld; available facts remain below.' : 'The provider classification is outside the supported company checks, including financial businesses and REITs. Available facts remain below.',
        supporting: [], concerns: [], gaps, coverage,
        watchNext: 'Inspect the sourced facts and issuer report using measures appropriate to this instrument.',
    };
    const limited = coverage < 3;
    return {
        applicable: !!applicable,
        status: !snapshot || coverage === 0 ? 'insufficient' : oldSnapshot || oldPeriod ? 'outdated' : limited ? 'partial' : 'available',
        headline: !snapshot || coverage === 0 ? 'Not enough financial data' : oldSnapshot || oldPeriod ? 'Older data · assessment limited' : limited ? 'Partial financial picture' : concerns.length ? 'Reported financial pressures' : f?.revenueGrowthPercent === 0 ? 'Stable revenue and positive earnings reported' : 'Growth and positive earnings reported',
        summary: !snapshot ? 'An assessment will appear when provider data is available. No notes or checklist are required.' : 'A rules-based summary of the latest returned annual figures. This is evidence about the business, not a buy or sell decision.',
        supporting, concerns, gaps, coverage,
        watchNext: limited || oldPeriod || oldSnapshot ? 'Check the latest issuer report and refresh the available data before drawing a conclusion.' : concerns.length ? 'In the next company report, check whether the weaker figures improve and what management says caused them.' : 'In the next company report, check whether revenue, profit and cash flow remain consistent.',
    };
}

/** Compare only this session's returned assessment evidence, never saved personal research. */
export function compareResearchEvidence(previous: ResearchSnapshot | null, current: ResearchSnapshot | null, now: number): string | null {
    if (!previous || !current || previous.symbol !== current.symbol || previous.market !== current.market) return null;
    const before = assessCurrentResearch(previous, now);
    const after = assessCurrentResearch(current, now);
    if (after.status === 'unsupported') return 'Assessment unsupported. A refreshed quote does not make these company checks applicable.';
    if (after.status === 'insufficient') return 'Insufficient financial evidence returned. No unchanged-business conclusion can be drawn.';
    if (after.status === 'outdated') return 'Older or unverifiable data returned. A successful refresh does not establish current financial evidence.';
    if (before.status !== after.status) return 'Assessment coverage or availability changed. Review the evidence and limitations below.';
    if (JSON.stringify(previous.quote.classification && { sector: previous.quote.classification.sector, industry: previous.quote.classification.industry }) !== JSON.stringify(current.quote.classification && { sector: current.quote.classification.sector, industry: current.quote.classification.industry })) return 'Provider classification changed. Review assessment applicability and source details.';
    const a = previous.fundamentals, b = current.fundamentals;
    if (a.source !== b.source || a.reportingPeriod !== b.reportingPeriod) return 'Financial source or reporting period changed. Review the returned figures; this does not by itself show improvement.';
    if ([a.revenueGrowthPercent !== b.revenueGrowthPercent, a.annualNetIncome !== b.annualNetIncome, a.freeCashFlow !== b.freeCashFlow].some(Boolean)) return 'Financial summary inputs changed since the previous successful read in this session.';
    if (JSON.stringify([...previous.warnings].sort()) !== JSON.stringify([...current.warnings].sort())) return 'Provider notices changed. The available financial summary inputs are unchanged.';
    return 'No new financial evidence returned for this summary. The available inputs, source and reporting period are unchanged since the previous read in this session; quote changes are separate.';
}
