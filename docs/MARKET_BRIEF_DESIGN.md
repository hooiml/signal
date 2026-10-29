# Latest Market Brief

Status: Implemented and locally verified (E28). Written 2026-10-29; implementation based on
`main` at `d0f49d4`. UI follows [DESIGN.md](../DESIGN.md); verification follows
[TESTING.md](TESTING.md). The eligibility rules below are descriptive product policy,
not calibrated measures of market accuracy.

## Goal and scope

Help a reader answer: **What does the available evidence support, what challenges
that interpretation, and what should I check next?**

Add a deterministic brief inside the existing V8 Market assessment for US and MY,
under the selected mode. Call it **Latest Market Brief**, with the actual assessment
date and comparison date. A captured daily record is not an official market close.

Preserve scores, weights, tiers, source data, settings and saved research. No LLM,
new provider calls, persistence, recommendations to trade, or prediction probabilities.
Weekly aggregation, Research handoff and score exploration are later slices.

## Reader experience

Replace the indicator-count summary with a short conclusion and four compact rows:

| Element | Content |
| --- | --- |
| Conclusion | Current reading under the named mode, qualified by evidence status |
| What changed | Observation change, coverage/configuration change, or comparison limitation |
| Support | Highest-weight eligible input aligned with the reading |
| Counterevidence / limitation | Highest-weight eligible conflict, plus the main evidence gap if present |
| What to watch | At most two evidence-linked conditions for reassessment |

Reuse the existing inspector, coverage and change-accounting actions. Integrate the
existing leading-evidence rows instead of duplicating them. Keep the numeric score
and detailed accounting accessible. For unavailable assessments, lead with the
reason and label the retained score as a calculated score with insufficient evidence.

Use existing V8 tokens, native controls, visible keyboard focus and a single-column
phone layout. Mode and market changes must replace the entire brief together; do
not leave the previous market's conclusion visible while its replacement loads.
Loading, request failure and insufficient evidence remain distinct states.

## Evidence rules

Evaluate in the following order. Use configured positive-weight inputs and existing
registry freshness windows; retrieval time never substitutes for observation time.

| Status | v1 rule |
| --- | --- |
| Assessment unavailable | Invalid/non-finite score or component accounting, unreconciled configured weights, no usable assessment date, or no fresh scored observation with verified observation dating |
| Limited assessment | Some fresh evidence exists, but any configured input is missing, stale or unknown-dated; fewer than two registry categories contribute fresh evidence; or one input exceeds 50% of configured weight |
| Assessment available | Accounting reconciles, all configured evidence is fresh and observation-dated, at least two registry categories contribute, and no input exceeds 50% of configured weight |

These conditions qualify the existing model reading; they do not recalculate it.
Missing-input neutral fallback must never become a claim of observed neutrality.
Show every applicable limitation in details, with one specific reason in the summary.
Registry categories indicate variety, not statistical independence or confirmation.
Do not interpret the status as a confidence percentage.

The concentration rule is deliberately conservative: the current MY news-heavy
configuration and US high-volatility override can remain limited even with complete
coverage. Representative fixtures retain these limits; do not relax thresholds to
obtain an available status. Current live US social and MY news aggregates are
retrieval-dated, so both markets normally remain limited even when every source returns.
The available example below requires verified observation-dated fixtures; this version
does not invent aggregate provenance to make that status attainable. Distinguish documented
external proxies from local evidence; unknown geographic scope stays unknown.

Snapshot persistence failure alone does not invalidate a usable current assessment.
Without a verified current reference date, withhold freshness-dependent conclusions;
without comparable history, withhold only the change claim when the current reading
is otherwise usable. The UI uses the supplied snapshot date when present; otherwise it
uses the existing response-received clock, labelled Retrieved (UTC), as the freshness
reference. This is a client retrieval reference, not a server assessment or observation
timestamp; clock accuracy is a limitation. Never invent a snapshot date or successful save.

## Change, reasons and reassessment

- Compare only matching market, mode and social configuration. Known model or
  eligibility-policy changes get an explicit configuration-change explanation;
  unknown compatibility withholds a directional market-change claim.
  The existing service's exact `(market_type, mode, enable_social)` SQL predicate
  establishes request identity; use only its reconciliation, not chart or last-visit
  history. Model and MY eligibility versions are checked explicitly. Higher numeric
  scores strengthen Momentum but weaken Contrarian interpretation.
- Use existing reconciliation for new observations, same-date changed values,
  returning/missing inputs, weight changes and neutral fallback. A same-date changed
  value is not called a provider revision without provider evidence.
- Say “strengthened/weakened following new observations” only when comparable
  observation effects establish that direction. Explain mixed observation and
  coverage/weight effects separately; a higher score alone is insufficient.
  The source-supplied numerical score delta remains separately inspectable even when
  attribution or model compatibility is unknown: label it explicitly as score points
  or “Score unchanged,” never as a market development. A supplied previous score is
  required for the existing spectrum's previous-score marker.
- Distinguish offsetting changes from no change. Say “No new observations” only
  when all relevant comparable observation dates and values are known and unchanged;
  otherwise state which comparison cannot be established. A later date with the
  same value is a new observation with no score effect.
- Reuse the current leading-evidence convention: highest configured weight among
  aligned/conflicting included inputs, with stable indicator-key ties. For brief
  claims, restrict candidates to fresh, verified observations; retain stale and
  unknown inputs in evidence details and limitations. “Leading” means weight, not
  greatest causal effect. An unmatched reported conflict is a limitation.
- For a neutral reading, explain agreement with or disagreement from that category;
  do not rename every neutral score “mixed.” No eligible conflict means “No fresh
  conflicting input identified,” not unanimous confirmation.
- Select watch conditions in order: resolve the main coverage/date gap, then revisit
  the leading conflict or support if its classification changes under this mode.
  Link each condition to its actual input or coverage panel. Do not invent release
  dates, price targets or a claim that one reversal must flip the overall reading.

## Illustrative outputs

These examples describe fixtures, not live market conditions.

- **Available, observation-led increase:** “The reading leans positive under Momentum.
  New observations strengthened it compared with [comparison date].” Show the actual
  leading support and conflict; link “Reassess if [conflicting input] changes category.”
- **Limited, returning source:** “The reading leans positive under Contrarian, with
  limited evidence because [input] has no verified observation date. The score changed
  as [source] became available.” Do not call the coverage recovery market improvement.
- **Unavailable:** “A current assessment is unavailable: no scored input has a verified,
  fresh observation. Review source coverage.” No directional conclusion or invented
  reassurance; the underlying calculated score remains inspectable.

## Implementation boundary and acceptance

Owner: a pure `src/lib/market-brief.ts` processor returning structured status,
reason codes, dates and evidence keys. React renders those reasons and existing links.
Reuse these current owners, inspected for this design:

- [MarketV81Hero](../src/components/v8/MarketV81Hero.tsx): assessment placement.
- [market-display](../src/lib/market-display.ts) and
  [MarketV8Coverage](../src/components/v8/MarketV8Coverage.tsx): labels and leading evidence.
- [market-evidence-coverage](../src/lib/market-evidence-coverage.ts) and
  [indicator-registry](../src/lib/indicator-registry.ts): coverage, categories and freshness.
- [signal-change](../src/lib/signal-change.ts): observation and score reconciliation.
- [signal](../src/lib/signal.ts): daily snapshot updates and persistence provenance.

Implementation acceptance:

1. Identical inputs produce identical output without requests or mutations; existing
   score, weights, classifications and saved data remain unchanged.
2. Fixtures cover all statuses, partial/all missing evidence, stale/unknown dates,
   concentration, both markets/modes, neutral readings and unmatched conflicts.
3. Change fixtures cover new/same-date/older/unknown observations, zero-effect new
   observations, offsetting effects, returning/missing sources, changed weights/model,
   incompatible history and failed persistence. Every claim has supporting provenance.
4. Browser proof covers evidence links, loading/error/switching, keyboard use, and
   required phone/desktop and light/dark states without duplicated explanations.
5. Initial lane: Standard. Final lane: High because the seven production files include
   shared date/coverage behavior across summary, evidence and chart consumers. Run the
   required lint/type/harness checks and build/browser/visual proof per TESTING.md.
   The earlier design-only change used LIGHT with the repository harness and diff checks.

Local verification (2026-10-29): lint, full harness, production build, post-build
typecheck and independent review passed. Browser fixtures passed 35 brief checks,
28 phone-section checks, 20 display states and the presentation matrix. All 20 Windows
visual comparisons passed after review of eight Market/Settings PNGs. Evidence is in
`.tmp/market-brief/` and `.tmp/visual-checks/`. Linux CI, merge and deployment are
separate delivery states. The tests establish fixture behavior, not live provider health.

## Delivery order and remaining decisions

L4/W1 merged in PR #65. This slice reuses the existing per-input freshness windows,
adds strict calendar-date validation and exposes configured-weight verification to
the brief. Full M5/T1/L5 clocks, publication schedules and source-health UI remain
separate; no next-release date or outage cause is inferred. Deliver before M1/M3.
Keep one owner for overlapping Market assessment changes and sequential browser QA.

Retain the strict coverage/concentration policy and qualify it in evidence details.
No numerical confidence or statistically independent confirmation is claimed.

Weekly processing follows separately: define timezone/week boundaries, comparable
captures, gaps, configuration compatibility and unique observations. Add price-date
provenance before dated benchmark claims; the existing 1Y breadth comparison cannot
describe weekly participation. Research handoff follows once the brief is stable.
E4/E5 forward validation remains separate from this descriptive feature.
