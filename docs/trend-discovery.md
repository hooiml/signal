# Trend Discovery

Trend Discovery ranks sustained momentum and SEC-confirmed business quality within a curated universe of 40 established, liquid US-listed companies. It is a research shortlist, not a recommendation or a fraud detector.

## Eligibility

- At least 126 daily closes and usable 50-day and 200-day averages
- Price of at least $5
- Average 20-day dollar volume of at least $20 million
- High-risk candidates are excluded from the displayed top ten

The universe is intentionally bounded in `src/lib/research/discovery-universe.ts` so free Yahoo requests remain predictable. Expanding it requires reviewing provider load and scan latency.

## Trend Score

The 0-100 trend score combines:

- Three-month momentum, capped at 30 points
- Six-month momentum, capped at 30 points
- Price above the 50-day average, 12 points
- Price above the 200-day average, 18 points
- Normal volume confirmation, up to 10 points
- A deduction equal to 35% of the risk score

## Risk Signals

Risk is a pattern warning, not a determination of manipulation:

- Average dollar volume below $20 million: 30 points
- Largest recent daily move above 18%: 25 points
- Peak volume in the latest 20 sessions above four times the 20-day average: 20 points
- Price more than 25% above its 50-day average: 15 points
- Annualized 60-day volatility above 70%: 20 points

Scores below 15 are `low`, scores from 15 through 39 are `moderate`, and scores of 40 or more are `high`.

## Business Quality

The 15 strongest eligible trends are enriched from SEC EDGAR in batches of three. The 0-100 quality score allocates:

- Revenue growth: up to 25 points
- Gross margin: up to 15 points
- Operating margin: up to 20 points
- Positive free cash flow: 20 points
- Cash relative to debt: up to 10 points
- Stable or declining share count: up to 10 points

Candidates are labelled `quality compounder`, `cyclical acceleration`, `turnaround`, `momentum only`, or `fundamentally unsupported`. Missing SEC coverage is `unconfirmed`, never scored as poor quality. Fundamentally unsupported candidates are removed from the displayed top ten.

Revenue jumps above 100% are flagged as potentially non-comparable periods. SEC concept-name changes are resolved by selecting the newest annual filing across the supported revenue tags.

The combined discovery score is 65% trend and 35% business quality. Trend, quality, risk, category, and evidence remain visible separately so the combined score is auditable.

## History And Relative Strength

Each generated ranking stores its top-ten symbols, ranks, scores, and observed prices in `discovery_snapshots`. The UI compares the current score with the nearest retained 1-day, 1-week, and 1-month snapshots and shows when a candidate first appeared. Missing periods remain `collecting`; they are never backfilled with fabricated history.

Sector-relative strength compares each candidate's three-month momentum with the average for other scanned companies in its mapped industry group. Positive values indicate outperformance versus those peers, not a forecast.

The tracked-performance strip compares prior top-ten cohort prices with current scan prices after approximately 1 day, 1 week, and 1 month. It reports average return and positive-return coverage. This is observational validation of the discovery model, not a transaction-cost-adjusted backtest.

## Early Trends

The Early Trends view reuses the same liquid universe and risk rules but looks for controlled moves before they become extended. `Emerging` requires a positive six-month trend, price above MA200, at least 5% three-month momentum, and price from 2% below through 6% above MA50. `Confirmed` allows price up to 12% above MA50 with at least 8% three-month momentum. Moves above 35% in three months or more than 12% above MA50 are labelled `Extended` and do not enter the early list.

## Valuation And Catalysts

Valuation guardrails use SEC annual fundamentals and the current Yahoo price to derive P/E, price-to-sales, and free-cash-flow yield. The labels `attractive`, `fair`, `expensive`, and `extreme` are fixed screening thresholds, not fair-value estimates. Missing inputs remain `unavailable`.

Upcoming earnings catalysts are read from Nasdaq's public earnings calendar for the next 21 calendar days and cached for six hours. Dates outside that window or absent from Nasdaq remain blank. Provider failure degrades independently and is reported as a warning.

## Runtime

`/api/research/discovery` scans Yahoo chart history in batches of six, enriches the leader and early-trend shortlists through SEC EDGAR, checks the bounded Nasdaq catalyst window, and caches the computed response for one hour. Failed symbols, catalyst coverage, history storage, and missing fundamentals degrade independently and are reported as warnings. The UI exposes separate Leaders and Early Trends views with scan time, history, cohort performance, sector context, valuation, catalysts, evidence, category, and scores.
