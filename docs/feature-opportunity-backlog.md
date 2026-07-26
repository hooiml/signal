# Signal Feature Opportunity Backlog

## Purpose

This document records potential additions for Signal's two primary product surfaces:

- **Market Conditions** at `/`
- **Investment Research** at `/research`

The opportunities are ranked from highest to lowest expected product value. The ranking is based on the current `main` working tree reviewed on 17 July 2026, including a browser walkthrough of both routes and inspection of the owning components, API routes, domain logic, product objective, and test contract.

This is a **product hypothesis backlog**, not validated customer research. The ranking should be revised when usage analytics, interviews, or support evidence becomes available.

Delivery status: **Release 1 — Unified catalyst and review calendar is implemented and verified.** Its usage gate should be evaluated before starting the persistent alert center.

## Desired outcome

Help a self-directed investor make more traceable decisions and close the loop from market context to security research, portfolio action, later review, and learning.

The most useful additions should improve at least one of these outcomes:

1. Reduce the time from new information to a clear next action.
2. Improve decision quality without hiding uncertainty or disagreement.
3. Make portfolio-level risk visible before a user acts on a ticker.
4. Make scheduled follow-up and thesis invalidation harder to miss.
5. Let the user learn from prior decisions rather than only storing them.

## Current capability baseline

The following features already exist and should not be rebuilt as new backlog items.

### Market Conditions

- US and Malaysia market selection.
- Momentum and Contrarian interpretation modes.
- Optional social-sentiment source.
- Decision-first market story and composite score.
- Contribution-ranked drivers, conflicts, freshness, coverage, and source methodology.
- Previous-snapshot change attribution and score history.
- Seven-day and 30-day historical zone calibration.
- Forward scenarios, market background, macro context, and valuation backdrop.
- Browser-local market alert rules evaluated on refresh.
- Evidence-only handoff from Market Conditions into Research.
- Loading, retry, partial-data, theme, and responsive behavior.

### Investment Research

- Browser-local workflow analytics with fixed, privacy-safe events, 180-day retention, workspace adoption, guided review pathways, meaningful actions, and local disable/clear controls.
- Search, market and decision filters, watchlist add/remove, and ticker URL state.
- Research inbox with attention, upcoming, stale-review, seen, and snooze states.
- Security overview, fundamentals, valuation, events, charts, and technical analysis.
- Relative-strength and benchmark evidence for US and Malaysia securities.
- Thesis, bull/bear case, triggers, invalidation, checklist, and calculated decision.
- Review history, accepted evidence provenance, prior-outcome fields, and revision safety.
- Position-planning inputs with estimated portfolio risk and sector concentration summary.
- Trend Discovery with leaders, contenders, early trends, filters, saved views, and change tracking.
- Comparison of up to three watchlist securities.
- Research alerts and server-side notification-delivery infrastructure.
- Versioned structured thesis-trigger monitoring with fixed numeric rules, unavailable coverage, immutable review history, explicit Queue handoff, and digest-safe explanations.
- Assisted findings with an evidence-based fallback.
- Catalyst and review calendar with 30-day/90-day ranges, list/calendar views, filters, changed-date disclosure, degraded-provider behavior, and direct review/Events navigation.

## Prioritization approach

Items are ordered by a qualitative combination of:

- **Decision value:** likely improvement to the quality or safety of an investment decision.
- **Frequency:** how often the capability can support the primary workflow.
- **Loop closure:** whether it connects context, research, action, monitoring, and learning.
- **Product fit:** alignment with Signal's transparent, non-advisory decision-support role.
- **Delivery cost and risk:** implementation effort, data dependencies, and risk of creating false confidence.

Priority meanings:

- **High:** strong fit with the core workflow and likely to create repeated value.
- **Medium:** useful after the high-priority decision loop is complete.
- **Low:** convenience or expansion work with weaker evidence of core value.

## Ranked backlog

| Rank | Feature opportunity | Surface | Priority | Expected value | Effort | Why it ranks here |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Portfolio exposure and risk cockpit | Research | High | Very high | High | Converts separate ticker plans into one portfolio decision and exposes concentration before action. |
| 2 | Unified catalyst and review calendar (Release 1 delivered) | Both | High | Very high | Medium | Makes earnings, review dates, invalidation checks, and important market events actionable in one time-based workflow. |
| 3 | Persistent alert center with delivery preferences | Both | High | Very high | Medium | Completes the existing alert infrastructure so important conditions can reach the user without reopening the exact browser state. |
| 4 | Decision outcome analytics | Research | High | Very high | Medium | Turns saved review history into a learning loop showing which decisions and confidence levels were well calibrated. |
| 5 | Market-to-watchlist exposure map | Both | High | High | High | Shows which holdings or candidates are most exposed to the current market drivers while preserving ticker-level independence. |
| 6 | Peer and sector benchmarking | Research | High | High | Medium | Makes valuation and quality judgments more defensible than comparing only a manually chosen watchlist set. |
| 7 | Market score sensitivity simulator | Market | Medium | High | Medium | Lets the user test how specific driver changes could alter the score instead of relying only on prose scenarios. |
| 8 | Filing, earnings, guidance, and thesis-change inbox | Research | Medium | High | High | Surfaces material evidence changes and maps them to the saved thesis, triggers, and invalidation conditions. |
| 9 | User-defined discovery universes and ranking policies | Research | Medium | Medium-high | Medium | Extends the fixed discovery scan to the user's actual investable universe and constraints. |
| 10 | Historical conditions replay and snapshot comparison | Market | Medium | Medium-high | Medium | Makes any historical score point explainable and comparable, not just the latest change. |
| 11 | Research workflow queue and review templates | Research | Medium | Medium | Low-medium | Helps users process incomplete research consistently across different security types. |
| 12 | Exportable decision packet | Both | Medium | Medium | Low-medium | Creates a portable Markdown/PDF record of the evidence, limitations, decision, and review date. |
| 13 | Source-health and coverage dashboard | Both | Medium | Medium | Medium | Makes provider gaps, stale feeds, regional coverage, and fallback behavior visible before they affect a decision. |
| 14 | Account-based sync and backup | Both | Low | Medium | High | Improves cross-device continuity, but authentication, privacy, and migration cost are substantial for a personal tool. |
| 15 | Custom dashboard layout and command palette | Both | Low | Low-medium | Medium | Improves power-user speed but does less for decision quality than the items above it. |

## High-priority opportunity detail

### 1. Portfolio exposure and risk cockpit

**Opportunity**

Research currently captures planned allocation, cost or entry, invalidation, estimated portfolio-at-risk, and basic sector concentration. It does not yet provide a complete view of how proposed and owned positions interact at portfolio level.

**Minimum valuable version**

- A browser-local, versioned read-only holdings snapshot imported through a documented bounded CSV contract.
- Complete import preview with rejected rows, duplicate/conflict disclosure, add-only default, and separately acknowledged exact replacement.
- Actual quantities, cost basis, cash, and available currency-scoped weights kept visibly separate from research position plans.
- Exact market+symbol research reconciliation only, with unmatched holdings and missing values retained as unavailable.
- One portfolio view built from existing position-plan records.
- Planned and owned allocation totals with an explicit unallocated amount.
- Sector, market, currency, and single-name concentration.
- Portfolio-at-risk based only on positions with valid lower invalidation levels.
- Beta and correlation matrix where sufficient history exists.
- Scenario exposure for a broad market decline, volatility spike, and user-defined percentage shock.
- Clear unavailable states and a reminder that this is planning data, not a brokerage ledger.

**Success signal**

- More position plans contain valid allocation and invalidation inputs.
- Users open the cockpit before saving a Ready or DCA review.
- Fewer plans exceed user-defined concentration or risk limits without acknowledgment.

**Key risk**

The UI could imply precision that the inputs do not support. Every aggregate should show data coverage and exclude incomplete positions rather than silently treating them as zero risk.

### 2. Unified catalyst and review calendar

**Opportunity**

Research already knows upcoming earnings, next-review dates, stale reviews, and monitoring conditions, while Market tracks dated snapshots and source cadences. These signals are scattered across separate sections rather than organized around when the user needs to act.

**Minimum valuable version**

- A calendar/list toggle covering the next 30 and 90 days.
- Earnings dates, scheduled research reviews, saved thesis catalysts, and invalidation checkpoints.
- Important market-source releases only when their cadence is known and relevant.
- Filters for market, ticker, event type, and urgency.
- One-click navigation to the exact ticker and relevant Research tab.
- Explicit timezone and provider timestamp on every event.

**Success signal**

- Increased completion of scheduled reviews by their due date.
- More calendar items lead directly to a saved review or monitoring update.

**Key risk**

Provider dates can move. Events need freshness, last-checked time, and a changed-date state rather than appearing authoritative indefinitely.

### 3. Persistent alert center with delivery preferences

**Opportunity**

Market rules are browser-local and checked when market conditions refresh. Research has an alert view and signed background-digest delivery infrastructure, but there is no single user-facing place to manage persistent rules, delivery destinations, history, quiet hours, and failures.

**Minimum valuable version**

- One alert center for market and security conditions.
- Server-persisted rules with browser-local fallback clearly labeled.
- In-app history showing triggered, delivered, acknowledged, snoozed, and failed states.
- Daily digest and urgent-only delivery modes.
- Quiet hours and per-rule delivery preferences.
- Deduplication and a visible explanation of why each alert fired.

**Success signal**

- Alert-to-review conversion: a triggered alert leads to opening Research or saving a review.
- Low duplicate-delivery and false-positive acknowledgment rates.

**Key risk**

This adds security and privacy obligations. Delivery endpoints and credentials must remain server-owned, encrypted where appropriate, and excluded from client payloads and logs.

### 4. Decision outcome analytics

**Opportunity**

The journal already stores immutable review snapshots, confidence, observed context, benchmark evidence, prior-review linkage, and outcome fields. The missing step is aggregated feedback about how decisions performed and where the user's process is well or poorly calibrated.

**Minimum valuable version**

- Outcome summary by decision state, confidence, market, and holding horizon.
- Price and benchmark-relative change from each saved review.
- Thesis-valid, thesis-broken, and unresolved groupings.
- Calibration view such as “high-confidence Ready decisions” versus later outcomes.
- Process metrics: review timeliness, checklist completeness, and invalidation adherence.
- Minimum sample sizes and prominent non-prediction limitations.

**Success signal**

- A higher share of old reviews receive an outcome assessment.
- Repeated weak process patterns become less frequent over later reviews.

**Key risk**

Returns alone do not prove decision quality. The feature should separate process quality, thesis validity, absolute return, and benchmark-relative return.

### 5. Market-to-watchlist exposure map

**Opportunity**

The current handoff correctly keeps the market score as evidence and does not overwrite a ticker decision. The next useful step is to show where the current market drivers matter most across the watchlist or position plan.

**Minimum valuable version**

- Map current market drivers to relevant sectors, factors, and saved securities.
- Rank affected names by evidence coverage, not by an opaque recommendation score.
- Explain each relationship, for example rate sensitivity, volatility sensitivity, or broad-index exposure.
- Show supporting and conflicting company-level evidence.
- Let the user open the relevant ticker tab without changing its checklist or decision.

**Delivered:** the Market exposure map connects active scored drivers to same-market watchlist sectors through disclosed deterministic rules, preserves driver direction, prioritizes owned and stale reviews, and leaves unknown classifications unmapped without estimating price sensitivity or changing a decision.

**Success signal**

- Market-to-Research handoffs result in more targeted reviews and fewer indiscriminate watchlist checks.

**Key risk**

Exposure mapping can become an unearned recommendation engine. Relationships need cited inputs, confidence, and explicit “unknown” states.

### 6. Peer and sector benchmarking

**Opportunity**

The existing comparison workspace is useful for up to three manually selected watchlist securities, but valuation and quality conclusions are stronger when compared with an appropriate peer set and historical distribution.

**Minimum valuable version**

- Suggested peers with a visible reason for inclusion.
- Sector median and percentile for growth, margins, leverage, valuation, and cash-flow metrics.
- Historical valuation band for the selected security when data coverage is sufficient.
- User control to remove inappropriate peers or build a custom peer set.
- Provider period, currency, and unavailable-state disclosure for every metric.

**Success signal**

- More research reviews contain an evidence-backed valuation assessment.
- Users modify suggested peer sets when the automatic set is not comparable.

**Key risk**

Incorrect peer grouping is worse than no peer comparison. Suggested peers should be editable and never silently determine the saved decision.

**Historical valuation slice delivered:** the selected US ticker's Valuation tab now shows up to eight accession-aligned annual `10-K`/`10-K/A` observations for P/E, price-to-sales, and FCF yield. Every value retains filing availability, strict next-close price date, split/share basis, exact inputs, formulas, gaps, amendment status, and sources. It is intentionally separate from peer percentiles. Malaysia and analyst estimate/revision history remain unavailable because the repo has no suitable period-correct or licensed source.

## Medium-priority opportunity notes

### 7. Market score sensitivity simulator

Provide controlled what-if inputs for active drivers and show the resulting score, zone, weight regime, and conflicts. Keep the live score visually separate from simulated results and offer preset scenarios before allowing free-form inputs.

**Delivered:** the Market simulator provides ±15 presets and per-driver normalized-score sliders, preserves current weights and neutral reserve, shows the simulated tier and alignment conflicts, and explicitly leaves raw inputs, VIX regime selection, and the live score unchanged.

### 8. Filing, earnings, guidance, and thesis-change inbox

Create a provenance-preserving queue of new material facts. Diff each item against the saved bull case, bear case, triggers, and invalidation, then let the user accept evidence into a review without automatic text replacement.

**Delivered:** the Changes workspace scans a bounded saved-record set through the existing sourced assistant, distinguishes new, changed, and unchanged evidence versions, preserves local dismissals, and stages frozen evidence into an editable review without rewriting any thesis field.

### 9. User-defined discovery universes and ranking policies

Allow a user to define markets, sectors, liquidity floor, risk exclusions, and a bounded list of ranking preferences. Preserve the current default methodology and expose how any user policy changes rank or eligibility.

**Delivered:** Discovery now saves up to five US-scan policies with sector, liquidity, risk, and extreme-valuation eligibility plus three bounded ranking preferences. Policy rank, default rank, exact score adjustment, and exclusion reasons remain visible; unsupported Malaysia scanning is not offered.

### 10. Historical conditions replay and snapshot comparison

Make score-history points selectable. Reconstruct the story, drivers, weights, freshness, coverage, and conflicts for that date, then compare any two snapshots without presenting hindsight as a trading backtest.

**Delivered:** the Replay workspace compares full persisted observed snapshots and keeps reconstructed score-only rows explicitly outside evidence replay.

### 11. Research workflow queue and review templates

Add templates such as new idea, earnings update, valuation-only refresh, thesis challenge, and post-event review. Each template should reduce fields without weakening the core decision rules.

**Delivered:** the Queue workspace persists bounded browser-local review tasks and opens five fixed templates in the existing editor. Thesis Changes, Calendar, Alerts, and Market Exposure can now create source-labelled, deduplicated tasks with workflow-specific templates and due dates. Templates focus narrative fields while retaining the complete checklist, decision journal, valuation, position plan, evidence, and save contract.

### 12. Exportable decision packet

Export a point-in-time Markdown or PDF packet containing the market context, ticker thesis, evidence links, limitations, decision, confidence, and next-review date. The export should be immutable and timestamped so later data does not rewrite the record.

**Delivered:** the Export workspace freezes a timestamped Markdown packet and opens a print-ready browser document for Save as PDF.

### 13. Source-health and coverage dashboard

Summarize source status, last successful fetch, cadence, regional coverage, fallbacks, and affected features. This should complement—not duplicate—the per-view trust disclosures.

**Delivered:** the Sources workspace separates live health, degraded, unconfigured, and unchecked states without exposing credentials or raw provider payloads.

## Low-priority opportunity notes

### 14. Account-based sync and backup

Consider only after validating cross-device demand. Start with encrypted export/import or a recovery code before committing to full authentication and multi-user authorization.

**First step delivered:** the Backup workspace provides passphrase-encrypted export/import without adding accounts or a third-party storage dependency. Decryption and preview stay local; import defaults to add-only and makes replacement a separately acknowledged action.

### 15. Custom dashboard layout and command palette

Add saved density/layout preferences, keyboard navigation, and quick ticker/route actions only after the core decision loop has enough usage evidence to show where navigation time is actually lost.

**Delivered:** the shared Ctrl/Cmd+K palette provides fixed route/theme actions plus Market configuration and Research workspace/ticker/view commands. Research also supports up to eight browser-local named views that restore filters, ticker, detail tab, workspace, and compact or comfortable density without mutating saved research.

## Suggested delivery sequence

0. **Workflow analytics — delivered:** privacy-safe browser-local events now measure workspace adoption and guided actions without collecting ticker or research content.
1. **Calendar foundation — delivered:** unified scheduled reviews, stale-review deadlines, and monitored earnings without adding a new external provider.
2. **Alert center — delivered:** existing research rules, device-local market rules, delivery preferences, and bounded delivery history now share one observable workflow.
3. **Portfolio cockpit — delivered:** saved position plans drive allocation, concentration, defined-risk coverage, market metrics, and bounded scenarios. A separate versioned local-only CSV snapshot now adds actual holdings, cost basis, cash, exact research reconciliation, and safe add/replace preview without becoming a brokerage ledger or entering research sync.
   - **Pre-trade sandbox delivered:** up to twenty explicit session-only legs produce an atomic before/after illustration by account and currency, including cash deficits, concentration, exact-sector coverage, defined downside, and semantically valid policy checks. It persists nothing, sends no scenario data, and places no orders.
4. **Outcome analytics — delivered:** linked review history now produces explicit resolved and unresolved feedback without claiming predictive accuracy.
5. **Cross-workspace exposure — delivered:** active market drivers now connect to same-market watchlist names through visible sector rules and direct review links.
6. **Peer benchmarking — delivered:** editable peer sets now expose medians, favorable-direction percentiles, and per-metric coverage.

This sequence reuses current records and infrastructure before introducing broader data dependencies.

## Validation plan before major implementation

The top opportunities still contain desirability and usability assumptions. Validate them before committing to full builds.

| Opportunity | Riskiest assumption | Fast validation experiment | Proceed signal |
| --- | --- | --- | --- |
| Portfolio cockpit | Users will maintain enough position-plan data for useful aggregates. | Add a static cockpit prototype using existing saved records and observe whether users complete missing allocation/invalidation fields. | At least 60% of planned positions have enough data for a valid risk estimate. |
| Unified calendar | A time-based view is more actionable than the current inbox alone. | Add a read-only 30-day event list behind a temporary route or prototype. | Users open ticker research from calendar events and complete due reviews. |
| Persistent alert center | Users want delivery outside the current browser session. | Offer in-app history plus one opt-in daily digest before supporting multiple channels. | Repeated opt-in use with low mute and duplicate rates. |
| Outcome analytics | Users will assess old decisions honestly enough to learn from them. | Generate a read-only summary for completed reviews and prompt only unresolved outcomes. | More than half of eligible reviews receive an outcome within two review cycles. |
| Exposure map | Users understand evidence relationships without treating them as recommendations. | Test a clickable prototype with explanations and confidence labels. | Users can correctly explain why a ticker is linked and still distinguish it from its saved decision. |
| Peer benchmarking | Suggested peers are comparable enough to improve valuation judgment. | Manually curate peers for three representative US and Malaysia securities. | Users retain most peers and change valuation notes based on the comparison evidence. |

## Intentionally deferred ideas

## Next feature sequence

### 16. Evidence coverage and freshness map

Map saved thesis fields to accepted evidence using visible per-field freshness windows. Keep supported, stale, conflicting, assumption, and missing states distinct, and allow gaps to create a deduplicated Queue task without changing saved research.

**Delivered:** the Evidence workspace evaluates seven thesis fields, prefers reporting periods over acceptance dates, exposes the exact freshness rule and evidence age, and connects unresolved gaps to an `Evidence coverage` Queue task.

### 17. Investment-policy guardrails

Compare saved position plans and decisions with user-defined allocation, concentration, evidence, review-age, and valuation limits. Guardrails must remain advisory and must never silently change a decision.

**Delivered:** the Policy workspace persists bounded browser-local limits, evaluates every saved record through deterministic rules, excludes missing allocations from totals, and connects breaches to a source-labelled Queue review.

### 18. Multi-currency performance

Separate security return from currency contribution for MYR and USD base views, using explicit exchange-rate, dividend, and fee inputs. Missing cost or price data must stay unavailable.

**Delivered:** the Currency workspace uses saved cost/entry data and hydrated quotes with browser-local USD/MYR assumptions. It compounds price and FX changes, applies explicit adjustments, and labels saved-benchmark comparison as potentially period-misaligned context.

### 19. Filing and earnings evidence diff

Compare cited evidence versions across immutable reviews without inventing access to raw filing prose. Preserve source values, reporting periods, additions, removals, and an explicit missing-baseline state.

**Delivered:** the Filings workspace compares current accepted evidence with the previous saved review, groups structured evidence through disclosed label matching, preserves source links, and connects changes to a `Filing evidence` Queue task.

**Primary-document extension delivered:** Filings now also retains up to 25 bounded exact primary-document excerpts per ticker, discovers recent supported US filings from official SEC metadata, supports explicitly unverified manual Bursa/issuer capture, freezes citations in immutable review history, and compares added/changed/removed/unchanged captures by stable identity and content fingerprint. It does not download documents, scrape arbitrary URLs, summarize prose, or infer management intent.

### 20. Saved portfolio scenario library

**Delivered:** the Portfolio workspace now saves up to eight browser-local market, sector, or currency shocks, validates every restored entry, shows allocation coverage, and calculates deterministic allocation-weighted impact without changing saved research.

**Delivered:** researched tickers now retain a bounded version-1 fixed-taxonomy factor-assumption set inside existing research continuity. Portfolio joins those declarations to browser-local actual holdings by exact market+symbol, keeps accounts and currencies separate, reports known-value direction shares plus value/count coverage, leaves unmatched/unpriced/undeclared positions explicit, and supports narrow revision-safe editing plus deduplicated Queue review without inference or analytics leakage.

### 21. Paper decision tracker

**Delivered:** the Outcomes Decision Review Lab now records browser-local act-or-pass decisions with a 1M, 3M, 6M, or 1Y horizon, freezes due candidate and VOO or FBM KLCI observations from validated chart history, reports path drawdown/upside and benchmark-relative decision effect, and gates action/confidence/horizon cohort statistics at five and twenty observations. Manual resolution remains a due-only fallback when provider history is unavailable, and the feature still makes no brokerage execution or investment-return claim.

**Delivered:** the collapsed Since Last Visit briefing now waits for canonical saved research and lazily summarizes US/Malaysia posture changes, new or revised records, accepted-evidence changes, upcoming reviews and earnings, alerts, policy breaches, inbox attention, and degraded sources. Users explicitly save a versioned browser-local checkpoint, provider failures degrade independently, and a deterministic top-three priority list links back to the owning workspace without mutating saved research.

**Delivered:** Fundamentals now show up to five annual periods with revenue growth, margins, net income, free cash flow, debt, cash, and share-count evidence. US data remains normalized from SEC Company Facts; Malaysia gains MYR history from Yahoo Finance with missing fields preserved and an explicit Bursa-filing verification warning. The existing current snapshot and derived valuation use the newest available period without inventing historical valuation multiples.

**Delivered:** The Calendar workspace now combines Federal Reserve, BLS, OpenDOSM, and a transparently maintained annual BNM MPC schedule in a separate macro-event contract. Provider failures degrade independently, source links remain explicit, and relevance is limited to same-market tracked symbols without claiming ticker-specific sensitivity.

**Delivered:** The journal editor now offers Core, Quality compounder, Growth, Value, Income, and Turnaround analysis templates. They change session-only questions and evidence priorities without auto-filling research, changing checklist state, altering the decision rule, or persisting a strategy classification.

**Delivered:** Private continuity now includes an opt-in, bearer-protected single-user ciphertext vault with stale-revision protection and local decryption into the existing import preview. Alerts can also request device-native permission for bounded, deduplicated risk-only or all-alert notices while Signal is open. Neither surface claims multi-user accounts, automatic merging, service-worker push, or passphrase recovery.

### 22. Research relationship graph

**Delivered:** the Map workspace connects ticker records only through explicit shared watchlist sectors and accepted-evidence providers, exposes every reason for each edge, and supports focused filtering and ticker navigation without semantic inference.

### 23. Encrypted cross-device transfer

**Delivered:** the Backup workspace can create and copy a versioned AES-GCM transfer package, paste and decrypt it on another device, and preview new or conflicting revisions before an explicit import. It is manual transfer rather than background sync because Signal has no account or synchronization server.

### 24. Structured thesis-trigger monitoring

**Delivered:** research records now retain up to ten version-1 fixed-enum numeric review prompts without parsing thesis prose. The pure evaluator covers current price, RSI, price relative to MA50/MA200, earnings windows, research/evidence age, and a bounded set of period-provenanced current valuation/fundamental metrics. Missing or stale inputs remain unavailable, matches join Alerts and the privacy-safe scheduled digest, Queue handoff is explicit and deduplicated per rule, settings saves preserve optimistic revision safety, and immutable reviews freeze the then-current rule set.

The following should not be prioritized without stronger evidence and data controls:

- Automated buy/sell execution or brokerage integration.
- A single AI-generated trade recommendation.
- Social leaderboards or public performance claims.
- Unconstrained strategy backtesting on sparse historical snapshots.
- Automatic checklist changes based on market score, news sentiment, or model output.

These ideas either expand Signal beyond decision support or can create false precision, security risk, and incentive problems before the core learning loop is mature.

## Next decision

Run the Calendar validation gate for one to two review cycles. If dated events lead to ticker opens and completed reviews rather than duplicating the Today inbox, begin Release 2 planning for the **Persistent alert center** in a separate change.
