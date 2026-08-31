import 'server-only';

export const investmentReplayCaseIdsV03 = ['duration-reset-2022', 'cyclical-peak-2021'] as const;
export type InvestmentReplayCaseIdV03 = (typeof investmentReplayCaseIdsV03)[number];

export type InvestmentReplaySnapshotV03 = {
    readonly revenueGrowth: string;
    readonly margin: string;
    readonly earningsPower: string;
    readonly valuation: string;
    readonly estimates: string;
    readonly rates: string;
    readonly inflation: string;
    readonly events: readonly string[];
    readonly narrativeEvidence: readonly string[];
};

export type InvestmentReplayIntroV03 = {
    readonly caseId: InvestmentReplayCaseIdV03;
    readonly replayId: string;
    readonly title: string;
    readonly knownAsOf: string;
    readonly setup: string;
    readonly snapshot: InvestmentReplaySnapshotV03;
    readonly sourceNote: string;
};

export type InvestmentReplayRevealV03 = InvestmentReplayIntroV03 & {
    readonly nextKnownAsOf: string;
    readonly nextSnapshot: InvestmentReplaySnapshotV03;
    readonly debrief: readonly string[];
};

const cases: Readonly<Record<InvestmentReplayCaseIdV03, { intro: InvestmentReplayIntroV03; reveal: InvestmentReplayRevealV03 }>> = {
    'duration-reset-2022': {
        intro: {
            caseId: 'duration-reset-2022',
            replayId: 'duration-reset-2022-q2',
            title: 'Long-duration growth during a rate reset',
            knownAsOf: '2022-06-30',
            setup: 'A profitable subscription business still grows quickly, but inflation and Treasury yields have risen. Build the view using only the evidence known at this checkpoint.',
            snapshot: {
                revenueGrowth: '28% year over year, down from 36%',
                margin: '22% operating margin, up 1 point',
                earningsPower: '$4.20 forward EPS consensus',
                valuation: '34x forward earnings; five-year range 25x-62x',
                estimates: 'Consensus EPS revised down 4% over 60 days',
                rates: '2Y 2.95%; 10Y 3.01%; policy range 1.50%-1.75%',
                inflation: 'Headline CPI 8.6% year over year',
                events: ['Management maintained full-year revenue guidance.', 'The central bank raised its policy range by 75 bps.'],
                narrativeEvidence: ['Shares underperformed the sector by 12 points over three months.', 'Two published estimate revisions were negative and one was unchanged.'],
            },
            sourceNote: 'Curated educational case. Dates and values are illustrative, internally consistent, and separated by known-as-of checkpoint.',
        },
        reveal: undefined as never,
    },
    'cyclical-peak-2021': {
        intro: {
            caseId: 'cyclical-peak-2021',
            replayId: 'cyclical-peak-2021-fy',
            title: 'Record margins in a cyclical business',
            knownAsOf: '2021-12-15',
            setup: 'A materials producer reports record margins and cash flow while capacity remains constrained. Decide whether current earnings are representative before viewing the next period.',
            snapshot: {
                revenueGrowth: '41% year over year',
                margin: '26% operating margin versus 13% five-year median',
                earningsPower: '$9.10 trailing EPS',
                valuation: '8x trailing earnings; historical range 7x-18x',
                estimates: 'Next-year consensus EPS is 14% below trailing EPS',
                rates: '2Y 0.66%; 10Y 1.46%; policy range 0%-0.25%',
                inflation: 'Headline CPI 6.8% year over year',
                events: ['Management approved a large buyback.', 'Two competitors announced capacity additions for the following year.'],
                narrativeEvidence: ['Sector relative performance reached a three-year high.', 'Analysts raised current-year estimates but trimmed the following year.'],
            },
            sourceNote: 'Curated educational case. Dates and values are illustrative, internally consistent, and separated by known-as-of checkpoint.',
        },
        reveal: undefined as never,
    },
};

const reveals: Readonly<Record<InvestmentReplayCaseIdV03, Omit<InvestmentReplayRevealV03, keyof InvestmentReplayIntroV03>>> = {
    'duration-reset-2022': {
        nextKnownAsOf: '2023-03-31',
        nextSnapshot: {
            revenueGrowth: '19% year over year',
            margin: '20% operating margin',
            earningsPower: '$3.85 forward EPS consensus',
            valuation: '25x forward earnings',
            estimates: 'Consensus EPS fell another 8% from the checkpoint',
            rates: '2Y 4.06%; 10Y 3.49%; policy range 4.75%-5.00%',
            inflation: 'Headline CPI slowed to 6.0% year over year',
            events: ['Management reduced its growth outlook.', 'Cost reductions were announced.'],
            narrativeEvidence: ['Sector relative performance stabilized.', 'Estimate revisions remained net negative.'],
        },
        debrief: ['Separate the operating slowdown from the additional multiple compression.', 'A lower share price does not by itself prove the original thesis was wrong.', 'Potential recency or anchoring bias requires evidence in the written reasoning, not the outcome.'],
    },
    'cyclical-peak-2021': {
        nextKnownAsOf: '2022-09-30',
        nextSnapshot: {
            revenueGrowth: '6% year over year',
            margin: '15% operating margin',
            earningsPower: '$5.60 trailing EPS',
            valuation: '10x trailing earnings',
            estimates: 'Next-year consensus EPS was revised down 22%',
            rates: '2Y 4.28%; 10Y 3.83%; policy range 3.00%-3.25%',
            inflation: 'Headline CPI 8.3% year over year',
            events: ['New industry capacity began production.', 'The buyback retired shares below the earlier market price.'],
            narrativeEvidence: ['Sector relative performance reversed.', 'Analyst revisions turned broadly negative.'],
        },
        debrief: ['A low trailing multiple can reflect peak rather than durable earnings.', 'Evaluate the buyback against valuation, leverage, and reinvestment alternatives at the time.', 'Do not infer bias solely because the later outcome differed from the commitment.'],
    },
};

for (const caseId of investmentReplayCaseIdsV03) {
    const current = cases[caseId];
    (current as { reveal: InvestmentReplayRevealV03 }).reveal = { ...current.intro, ...reveals[caseId] };
}

export const isInvestmentReplayCaseIdV03 = (value: string): value is InvestmentReplayCaseIdV03 => investmentReplayCaseIdsV03.includes(value as InvestmentReplayCaseIdV03);

export const getInvestmentReplayIntroV03 = (caseId: InvestmentReplayCaseIdV03): InvestmentReplayIntroV03 => cases[caseId].intro;

export const revealInvestmentReplayV03 = (caseId: InvestmentReplayCaseIdV03, replayId: string): InvestmentReplayRevealV03 | null => {
    const replay = cases[caseId];
    return replay.intro.replayId === replayId ? replay.reveal : null;
};
