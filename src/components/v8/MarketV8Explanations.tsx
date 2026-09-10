import type { MarketSignal } from '@/lib/types/signal-v2';
import { getIndicatorBaseWeights } from '@/lib/indicator-registry';
import { dateLabel, stance, type ExplorerIndicator, type Market } from './market-v8-fixtures';
import styles from './market-v8.module.css';

type Rule = {
    formula: string;
    horizon: string;
    sourceBlend: string;
    expectedScore: number | null;
    scoreNote: string;
};

const roundScore = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

function ruleFor(indicator: ExplorerIndicator, market: Market): Rule {
    const raw = indicator.value;

    if (indicator.context) {
        return {
            formula: 'Context readings do not enter the composite score. The fixture keeps this tile separate from scored inputs.',
            horizon: `${indicator.cadence} context; it is not a score horizon.`,
            sourceBlend: `${indicator.source} is a separate context source. It is not blended into the market signal.`,
            expectedScore: null,
            scoreNote: 'No normalized score is produced for context. Any displayed fixture score is a placeholder for layout only.',
        };
    }

    switch (indicator.key) {
        case 'vix': {
            const formula = market === 'MY'
                ? 'Production first scales 20-day USD/MYR volatility by 4000, clamps the VIX-like gauge to 10–80, then applies the logistic rule 100 / (1 + exp((gauge − 24) / 6)).'
                : 'Clamp VIX to 5–100, then apply 100 / (1 + exp((VIX − 24) / 6)); round to two decimals.';
            return {
                formula,
                horizon: 'Daily source cadence. The current V2 volatility component does not attach an explicit horizon field; any short-horizon framing is interpretive.',
                sourceBlend: market === 'MY'
                    ? 'The MY path uses a USD/MYR volatility proxy. It is not a native equity-volatility index and is not blended with US VIX.'
                    : `${indicator.source} supplies the volatility input; it is a single source in this fixture.`,
                expectedScore: market === 'US' && raw !== null
                    ? roundScore(100 / (1 + Math.exp((clamp(raw, 5, 100) - 24) / 6)))
                    : null,
                scoreNote: market === 'MY'
                    ? `Illustrative assigned normalized score: ${indicator.score.toFixed(2)} /100. The fixture's ${raw === null ? 'missing' : raw.toFixed(2)} proxy units are not the production scaled gauge, so plugging them directly into the US VIX equation would be a mismatch.`
                    : 'The US fixture can be compared directly with the production logistic rule below.',
            };
        }
        case 'social':
            return {
                formula: 'Clamp the aggregate sentiment to −1…+1, then score = (aggregate + 1) × 50.',
                horizon: '1–5 trading days; social is a tactical context input.',
                sourceBlend: market === 'US'
                    ? 'The production US aggregate blends Reddit and StockTwits sentiment equally (50% / 50%) before normalization.'
                    : 'Social is not a configured scored input for MY. The MY source blend is carried by News Sentiment instead: market news 80% and Bursa-focused Reddit 20%.',
                expectedScore: raw !== null ? roundScore((clamp(raw, -1, 1) + 1) * 50) : null,
                scoreNote: market === 'MY'
                    ? `Illustrative assigned normalized score: ${indicator.score.toFixed(2)} /100, but this social row is excluded from the MY composite because its configured weight is zero.`
                    : 'This fixture uses the same linear score transform for the US social row.',
            };
        case 'news':
            return {
                formula: 'The headline scorer counts weighted bullish and bearish terms, applies four-hour age decay and a five-headline sparse-coverage factor, clamps the result to −1…+1, then score = (aggregate + 1) × 50.',
                horizon: '1–5 trading days; headline tone is tactical and decays quickly.',
                sourceBlend: 'The MY production source blend is market news at 80% and Bursa-focused Reddit at 20%. News carries 65% of the configured MY model weight.',
                expectedScore: raw !== null ? roundScore((clamp(raw, -1, 1) + 1) * 50) : null,
                scoreNote: 'The fixture score is compared with the final sentiment-to-score transform; the underlying headline records are not supplied here.',
            };
        case 'put_call':
            return {
                formula: 'Clamp the ratio to 0.55–1.25, then score = ((1.25 − clamped ratio) / 0.70) × 100; round to the nearest integer.',
                horizon: '1–5 trading days; options positioning is tactical.',
                sourceBlend: `${indicator.source} is the single put/call source. Hedging and directional activity are not separated by this score.`,
                expectedScore: raw !== null ? Math.round(((1.25 - clamp(raw, 0.55, 1.25)) / 0.7) * 100) : null,
                scoreNote: 'A lower ratio scores as more optimistic in the current model. It does not establish future price direction.',
            };
        case 'naaim':
            return {
                formula: 'Clamp manager exposure to 40–90%, then score = ((exposure − 40) / 50) × 100; round to the nearest integer.',
                horizon: '1–4 weeks; NAAIM is a weekly positioning observation.',
                sourceBlend: `${indicator.source} is a single weekly manager-exposure source. High exposure can confirm momentum and can also describe crowding.`,
                expectedScore: raw !== null ? Math.round(((clamp(raw, 40, 90) - 40) / 50) * 100) : null,
                scoreNote: 'This is a positioning score, not a forecast of the next price move.',
            };
        case 'aaii':
            return {
                formula: 'Clamp bullish survey percentage to 20–50%, then score = ((bullish% − 20) / 30) × 100; round to the nearest integer.',
                horizon: 'Weekly source cadence. The current institutional row does not attach a separate horizon field.',
                sourceBlend: market === 'MY'
                    ? 'AAII remains a US survey proxy in the MY fixture; it is not a survey of Malaysian investors.'
                    : `${indicator.source} is a single weekly survey source.`,
                expectedScore: raw !== null ? Math.round(((clamp(raw, 20, 50) - 20) / 30) * 100) : null,
                scoreNote: 'The range is the current production institutional normalizer. Survey optimism can also indicate crowding.',
            };
        case 'bofa':
            return {
                formula: 'Clamp the BofA SSI placeholder to 50–60, then score = ((SSI − 50) / 10) × 100; round to the nearest integer.',
                horizon: 'Manual cadence with a 45-day freshness window in the registry; no separate production horizon is attached.',
                sourceBlend: 'The BofA slot is a single manual input. An unset slot retains neutral reserve and does not imply neutral sentiment.',
                expectedScore: raw !== null ? Math.round(((clamp(raw, 50, 60) - 50) / 10) * 100) : null,
                scoreNote: 'This rule exists in the production institutional normalizer; the current V8 populated fixture leaves the manual slot unset.',
            };
        default:
            return {
                formula: 'No current V8 production normalizer is declared for this key.',
                horizon: `${indicator.cadence} cadence supplied by the fixture.`,
                sourceBlend: `${indicator.source} is shown as supplied; no source mixture is inferred.`,
                expectedScore: null,
                scoreNote: `Illustrative assigned normalized score: ${indicator.score.toFixed(2)} /100. It is not asserted as a production normalization.`,
            };
    }
}

export function IndicatorExplanation({ indicator, market }: { indicator: ExplorerIndicator; market: Market }) {
    const rule = ruleFor(indicator, market);
    const assigned = indicator.score;
    const matches = rule.expectedScore !== null && Math.abs(rule.expectedScore - assigned) <= 0.01;

    return <details className={styles.disclosure} data-testid={`indicator-explanation-${indicator.key}`}>
        <summary>How raw input becomes a score</summary>
        <dl className={styles.keyValues}>
            <div><dt>Raw input</dt><dd>{indicator.value === null ? 'Unavailable' : `${indicator.value} ${indicator.units}`}</dd></div>
            <div><dt>Known rule</dt><dd>{rule.formula}</dd></div>
            <div><dt>Horizon</dt><dd>{rule.horizon}</dd></div>
            <div><dt>Source blend</dt><dd>{rule.sourceBlend}</dd></div>
            <div><dt>Fixture normalized score</dt><dd>{indicator.context ? 'Not scored' : `${assigned.toFixed(2)} /100`}</dd></div>
        </dl>
        <p className={styles.muted}>{indicator.source} · representative fixture. {rule.scoreNote}</p>
        {!indicator.context && rule.expectedScore !== null && <p className={matches ? styles.support : styles.conflict}>
            {matches
                ? `This fixture assignment matches the known rule at ${rule.expectedScore.toFixed(2)} /100.`
                : `The known rule gives ${rule.expectedScore.toFixed(2)} /100, while the fixture assigns ${assigned.toFixed(2)} /100. Treat the fixture score as illustrative; no scoring or fixture value is changed here.`}
        </p>}
    </details>;
}

type WatchRule = { label: string; text: string };

function watchRules(signal: MarketSignal): WatchRule[] {
    const market = signal.metadata.market;
    const contrarian = signal.mode === 'contrarian';
    const zoneBoundaries = contrarian
        ? 'Contrarian tier boundaries are 20, 40, 65 and 85: ≤19 is Strong buy, 20–39 Buy, 40–64 Neutral, 65–84 Sell and ≥85 Strong sell.'
        : 'Momentum tier boundaries are 20, 40, 65 and 85: 0–19 Strongly negative, 20–39 negative, 40–64 mixed, 65–84 positive and 85–100 strongly positive.';

    if (market === 'US') {
        return [
            {
                label: 'Strengthen',
                text: contrarian
                    ? 'A lower composite score, especially when multiple components move below 40, strengthens the contrarian fear/opportunity interpretation. Independent inputs should still be available.'
                    : 'More components above 65 can strengthen the momentum reading. A VIX input at or below 30 keeps the normal multi-input weight regime active; confirmation from sentiment or positioning makes the reading less one-sided.',
            },
            {
                label: 'Weaken',
                text: 'Missing or stale inputs reduce eligible weight and replace it with the neutral 50 baseline. Component disagreement remains visible; agreement is not independent confirmation.',
            },
            {
                label: 'Regime boundary',
                text: `${zoneBoundaries} In the US calculator, VIX above 30 activates the high-volatility override: VIX receives 85% configured weight and social receives 15%.`,
            },
        ];
    }

    return [
        {
            label: 'Strengthen',
            text: contrarian
                ? 'A lower MY composite score with several components below 40 strengthens the contrarian fear/opportunity interpretation. Keep the US AAII proxy and local inputs distinct.'
                : 'A higher MY composite score is more persuasive when the news component and the USD/MYR volatility proxy move into supportive score ranges together. News has 65% of configured MY weight, so local evidence coverage matters most.',
        },
        {
            label: 'Weaken',
            text: 'A missing or stale Malaysia news record removes its observed contribution and retains neutral reserve. A narrow headline base can dominate the active reading, so background context does not count as score confirmation.',
        },
        {
            label: 'Regime boundary',
            text: `${zoneBoundaries} Malaysia uses a USD/MYR volatility proxy transformed from 20-day FX volatility; no US VIX-above-30 override is applied to this market.`,
        },
    ];
}

export function WatchNext({ signal }: { signal: MarketSignal }) {
    return <section className={styles.calibration} aria-label="Watch next" data-testid="market-v8-watch-next">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Before the simulator</span><h2>Watch what would strengthen or weaken this reading.</h2></div><span className={styles.tag}>{signal.metadata.market} · {signal.mode === 'standard' ? 'Momentum' : 'Contrarian'}</span></div>
        <p className={styles.panelIntro}>Use these source-grounded boundaries to frame a hypothetical normalized-input change. The current fixture score stays unchanged.</p>
        <div className={styles.contextList}>{watchRules(signal).map(rule => <details key={rule.label}><summary><span><b>{rule.label}</b><small>{rule.label === 'Regime boundary' ? 'Current model transition' : 'Qualitative check'}</small></span><span className={styles.muted}>Read ＋</span></summary><p>{rule.text}</p></details>)}</div>
    </section>;
}

type SourceRecord = {
    recordId: string;
    capturedAt: string;
    fields: readonly [readonly [string, string], ...readonly [string, string][]];
};

type DevelopmentFixture = {
    date: string;
    title: string;
    summary: string;
    relation: 'Driver-related' | 'Background';
    publication: string;
    sourceRecord: SourceRecord | null;
    interpretation: string;
};

const developmentFixtures: Record<Market, readonly DevelopmentFixture[]> = {
    US: [
        {
            date: '2026-09-04',
            title: 'Options tone is calmer in the example session',
            summary: 'A fictional market note describes a lower illustrative volatility reading alongside continued sentiment participation.',
            relation: 'Driver-related',
            publication: 'Fictional publication: The Volatility Ledger',
            sourceRecord: { recordId: 'US-DEV-2026-09-04-A', capturedAt: '2026-09-04T20:00:00Z', fields: [['market', 'US'], ['record type', 'synthetic development'], ['linked fixture key', 'vix'], ['source status', 'local example only']] },
            interpretation: 'Illustrative interpretation: this is a prompt to inspect whether the volatility and sentiment inputs point in the same direction. It does not establish that this note caused the score move.',
        },
        {
            date: '2026-09-03',
            title: 'Participation remains an open question',
            summary: 'A fictional weekly brief keeps breadth and concentration as a separate context check for the illustrative index move.',
            relation: 'Background',
            publication: 'Fictional publication: Northstar Market Brief',
            sourceRecord: { recordId: 'US-DEV-2026-09-03-B', capturedAt: '2026-09-03T16:00:00Z', fields: [['market', 'US'], ['record type', 'synthetic background context'], ['linked fixture key', 'breadth'], ['source status', 'local example only']] },
            interpretation: 'Illustrative interpretation: participation can add context around the scored inputs, but this record does not enter the composite and does not prove a market cause.',
        },
    ],
    MY: [
        {
            date: '2026-09-04',
            title: 'Local headline tone is slightly firmer in the example',
            summary: 'A fictional local-market note reflects the illustrative positive direction of the covered headline aggregate.',
            relation: 'Driver-related',
            publication: 'Fictional publication: Ringgit Signal Journal',
            sourceRecord: { recordId: 'MY-DEV-2026-09-04-A', capturedAt: '2026-09-04T11:00:00+08:00', fields: [['market', 'MY'], ['record type', 'synthetic development'], ['linked fixture key', 'news'], ['source status', 'local example only']] },
            interpretation: 'Illustrative interpretation: because news has the largest configured MY weight, this is a reason to inspect coverage and source breadth. It does not establish that headline tone caused the composite score.',
        },
        {
            date: '2026-09-03',
            title: 'Rates context remains separate from the market score',
            summary: 'A fictional rates brief keeps the MGS curve as background context while the scored inputs remain unchanged.',
            relation: 'Background',
            publication: 'Fictional publication: Bursa Almanac',
            sourceRecord: { recordId: 'MY-DEV-2026-09-03-B', capturedAt: '2026-09-03T10:00:00+08:00', fields: [['market', 'MY'], ['record type', 'synthetic background context'], ['linked fixture key', 'breadth'], ['source status', 'local example only']] },
            interpretation: 'Illustrative interpretation: the rates context can frame a follow-up question, but it is not a scored input and no causal relationship is asserted.',
        },
    ],
};

export function Developments({ market, partial, historical = false }: { market: Market; partial: boolean; historical?: boolean }) {
    if (historical) {
        return <section className={styles.calibration} aria-label="Developments" data-testid="market-v8-developments-historical">
            <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Dated view</span><h2>Current developments are hidden.</h2></div><span className={styles.tag}>Historical mode</span></div>
            <div className={styles.unavailable}><b>No current event records are shown for a historical snapshot.</b><p>Returning to the current reading is required before the 4 Sep 2026 synthetic developments can be inspected. No later event is backfilled into the past.</p></div>
        </section>;
    }

    const records = developmentFixtures[market];
    const visibleRecords = partial
        ? records.map((development, index) => index === 0 ? { ...development, sourceRecord: null } : development)
        : records;

    return <section className={styles.calibration} aria-label="Developments" data-testid="market-v8-developments">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Synthetic fixture developments</span><h2>What else is in the record?</h2></div><span className={styles.tag}>No live fetch</span></div>
        <p className={styles.panelIntro}>These dated examples are fictional prompts for investigation. Publication names and local records are synthetic; they are not external citations.</p>
        {partial && <p className={styles.studyNotice} data-testid="developments-partial"><b>Partial source coverage.</b> One development has no local source record. No replacement source record is inferred.</p>}
        <div className={styles.contextList}>{visibleRecords.map(development => <details key={`${development.date}-${development.title}`}>
            <summary><span><b>{development.title}</b><small>{dateLabel(development.date)} 2026 · {development.relation}</small></span><span className={styles.muted}>Inspect ＋</span></summary>
            <p>{development.summary}</p>
            <p><b>Publication label:</b> {development.publication}</p>
            {development.sourceRecord ? <details className={styles.disclosure}><summary>Expand local source record</summary><dl className={styles.keyValues}><div><dt>Record ID</dt><dd>{development.sourceRecord.recordId}</dd></div><div><dt>Captured</dt><dd>{development.sourceRecord.capturedAt}</dd></div>{development.sourceRecord.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.muted}>Local synthetic record only. No publisher URL or upstream document is attached.</p></details> : <div className={styles.unavailable}><b>Source record unavailable.</b><p>No replacement record or external URL is inferred for this partial fixture.</p></div>}
            <div className={styles.explanation}><b>Illustrative interpretation</b><p>{development.interpretation}</p></div>
        </details>)}</div>
    </section>;
}

export function SummaryLimits({ signal, indicators }: { signal: MarketSignal; indicators: ExplorerIndicator[] }) {
    const conflicts = indicators.filter(indicator => stance(indicator, signal) === 'Conflict');
    const components = Object.values(signal.components);
    const coverage = signal.metadata.coverage_adjustment;
    const activeWeight = coverage?.active_weight ?? components.reduce((sum, component) => sum + component.weight, 0);
    const missingWeight = coverage?.missing_weight ?? Math.max(0, 1 - activeWeight);
    const neutralPoints = coverage?.neutral_points ?? missingWeight * 50;
    const largest = components.slice().sort((a, b) => b.weight - a.weight)[0];
    const configuredWeights = Object.entries(getIndicatorBaseWeights(signal.metadata.market)).filter(([, weight]) => weight > 0);
    const configuredLeader = configuredWeights.sort(([, a], [, b]) => b - a)[0];

    return <section className={styles.calibration} aria-label="Summary limits" data-testid="market-v8-summary-limits">
        <div className={styles.sectionHeading}><div><span className={styles.eyebrow}>Limits of the summary</span><h2>Read agreement with its boundaries.</h2></div><span className={styles.tag}>{conflicts.length} conflict{conflicts.length === 1 ? '' : 's'}</span></div>
        <p className={styles.panelIntro}>The V8 stance list below uses each indicator&apos;s displayed component score and the composite score. It is an agreement description, not a probability or forecast.</p>
        <div className={styles.studyMetrics}>
            <div><span>Conflicting inputs</span><strong>{conflicts.length}</strong><small>{conflicts.length ? 'Full V8 stance list below' : 'None in this reading'}</small></div>
            <div><span>Eligible configured weight</span><strong>{Math.round(activeWeight * 100)}%</strong><small>{Math.round(missingWeight * 100)}% neutral reserve</small></div>
            <div><span>Largest active weight</span><strong>{largest ? `${Math.round(largest.weight * 100)}%` : '—'}</strong><small>{largest?.display_name ?? 'No active component'}</small></div>
        </div>
        {conflicts.length ? <div className={styles.contextList} data-testid="summary-limit-conflicts"><details open><summary><span><b>All conflicts ({conflicts.length})</b><small>V8 displayed stance</small></span><span className={styles.conflict}>Conflict</span></summary><ul>{conflicts.map(indicator => <li key={indicator.key}>{indicator.name}</li>)}</ul></details></div> : <p className={styles.studyNotice}>No indicator is classified as Conflict by the current V8 stance helper. Mixed, unavailable, stale and context-only states remain distinct.</p>}
        <p className={styles.studyNotice}>{configuredLeader ? `${configuredLeader[0]} has the largest normal configured share at ${Math.round(configuredLeader[1] * 100)}% for ${signal.metadata.market}.` : 'No configured scored inputs are available.'} {neutralPoints.toFixed(2)} points come from the neutral 50 baseline for missing or ineligible weight. Several inputs can reflect related sentiment or positioning, so concentration and source overlap limit how much agreement can tell us.</p>
        <details className={styles.disclosure}><summary>Glossary and stance definition</summary><p><b>Score:</b> a normalized 0–100 input where 50 is mixed. <b>Weight:</b> the configured share used for an eligible component. <b>Neutral reserve:</b> missing or stale configured weight multiplied by the fixed 50 baseline; it is accounting, not evidence.</p><p><b>V8 stance:</b> component and composite scores below 40 are negative, 40–64 are mixed, and 65 or above are positive. Matching directional buckets are Support; a mixed component is Mixed; an opposite directional bucket is Conflict. Context-only, unavailable, disabled and stale-excluded records keep their own labels.</p><p><b>Coverage:</b> eligible weight and source count describe what is present at this snapshot. They do not establish source independence, forecast accuracy or a causal explanation.</p></details>
    </section>;
}
