# Quality Rules

These rules capture repo taste as mechanical, repeatable guidance for future agent runs.

## Agent Legibility

- Keep `AGENTS.md` short and use it as a table of contents.
- Put durable project knowledge in `docs`.
- Put generated facts in `docs/generated`.
- Keep docs linked to actual files, scripts, and commands.
- Prefer explicit names over clever or compressed abstractions.
- Follow `docs/HARNESS.md` when adding or changing repo knowledge checks.

## Code Boundaries

- Validate request inputs in API route handlers before service calls.
- Keep market scoring and confidence calculations in `src/lib`.
- Keep dashboard components focused on presentation and typed payload rendering.
- Prefer shared helpers in `src/lib` when multiple routes or services need the same behavior.
- Avoid new dependencies unless they remove meaningful complexity and are documented in the change.

## Data Quality

- Treat external data as unreliable until validated, normalized, or guarded.
- Preserve source freshness and coverage metadata when changing signal outputs.
- Do not hide degraded or limited source coverage from the UI.
- Keep confidence wording clear that it means indicator agreement, not forecast accuracy.
- Historical financial calculations must retain fiscal period, filing availability, price date, units, source links, formulas, split convention, and per-input gaps. Never pair a historical price with current fundamentals or use a filing fact before it became public.

## Cleanup Policy

- Prefer deletion over new layers when removing stale code.
- Split cleanup into small, reviewable changes.
- Add or update docs when a cleanup changes an established pattern.
- Promote repeated review feedback into docs or harness checks.

## Harness Checks

Run:

```powershell
npm run harness
```

The harness currently checks:

- `AGENTS.md` links point to existing files
- required docs exist
- generated repo map is current
- large source files are visible as warnings

Harness checks should start deterministic and small. Keep early quality signals warning-first unless the failure is stable, actionable, and safe to block on.

## V8 Display Clarity


`node scripts/harness/display-clarity-regression.mjs` is included in the harness.
It checks display-only tier labels in both modes, single-source/unknown agreement,
compact monetary amounts, retained signs/unknown currencies, annual comparisons,
multi-year comparable annual history series (`annualHistorySeries`), and same-currency
position-plan price context (`positionPlanPriceContext`).
Comparisons require a unique matching current period, matching current summary values,
matching source/currency, and adjacent annual endpoints 350–380 days apart. Multi-year
trend strips require at least two consecutive annual periods (330–400 days apart) sharing
the current period's currency and source. Position-plan price rulers and percentage distances
require exact 3-letter currency equality between the saved plan and live quote. Missing,
ambiguous, incompatible and non-finite inputs are withheld. A zero/negative prior amount
permits an amount change but never a percentage. No scoring or assessment eligibility
rules change. Summary financial cards keep exact amounts and provider-reported growth
inside an explicit disclosure; quote and ratio formatting remain unchanged.

The Research assessment includes comparable annual profit and free-cash-flow
trends without changing its existing sign-based classification. Positive current
amounts may have declined from the prior year. Valuation disclosures show the
actual inputs and formulas; a negative cash-minus-debt balance is presented as a
positive net-debt amount, with the signed calculation retained in the disclosure.
Daily price change is labelled with the quote observation's UTC date, not "today".
Market input freshness is determined per input: an unknown observation date for
one input cannot make another dated input unknown. Aggregate freshness percentages
remain unavailable when a complete verified partition cannot be established.

Run `node scripts/v8-display-qa.mjs` against an owned local production server
(`SIGNAL_QA_URL`, default localhost:3000). It blocks service workers and intercepts every
API with fixtures, rejects mutations, and captures Market, populated/missing Research,
Financials and saved-research navigation at 1440/768/390/320px. `--before` captures the
same baseline states without expecting the new copy and navigation. Output is in
`.tmp/display-clarity/before` or `after`. These are controlled local checks, not production
provider validation or usability-test results. Also run the existing `v81-ui-qa.mjs`,
`v81-presentation-qa.mjs` and `research-unsaved-qa.mjs` matrices.

The Research home shows two tabs, Watchlist and Discover; opening Research without a ticker
lists the watchlist instead of opening its first stock. While reading a stock, the header has a
Watchlist switcher (selection) and a Workspace menu (current-stock content). Workspace opens
direct Thesis/Review reading, editing links, the existing Advanced tools switch, and all
existing workspace links. Legacy advanced/tab URLs still restore. No notes are created by opening these
controls; unsaved reading remains available.

## Research Reading Experience

Research V8 shows a provider-returned name for an unsaved security only when its
symbol and market match the active selection. A saved company name remains
user-authored; missing names fall back to the ticker. No exchange is inferred.
Late requests must not replace another security's identity or quote.

Price chart clicks/taps select the closest returned observation by elapsed time,
including irregularly spaced dates. The native date slider stays as the chart's
keyboard control (unseen; the chart frame shows its focus) and the exact-values
table remains available. Selected-period change uses the first/last returned closes and
shows their actual dates separately from daily quote change; it is not total return.
Single observations, invalid or reversed dates and non-finite values cannot produce
a range comparison. A zero starting close permits an amount change but no percentage.

Financial/valuation availability notes describe missing snapshot fields and the
existing calculator dependencies. They do not infer provider outages or guarantee
that retrying will help. Zero cash flow and negative net cash remain valid values;
non-positive earnings can withhold P/E without implying a failed request. MY dated
ordinary shares, undated quote outstanding shares and US SEC shares remain separate;
annual diluted averages are not substituted for MY outstanding shares. Valuation
exposes its exact share count, source and reporting date separately from the quote
observation and annual financial period. Known splits after an MY report withhold
that reported count; other subsequent corporate actions remain unverified.
Retained-response gaps remain labelled.

`node scripts/harness/research-reading-regression.mjs` runs in the repo harness.
`node scripts/research-reading-qa.mjs` runs against an owned production-mode local
server via `SIGNAL_QA_URL`, uses intercepted read-only fixtures and covers identity,
late responses, chart pointer/touch/keyboard selection, range changes, missing/flat/
single-point history and valuation dependencies at 1440/768/390/320px. `--before`
captures comparable baseline states. Evidence is in `.tmp/research-reading/`.
Run the existing display, V8.1 presentation and unsaved Research matrices too.
The `Signal validation` workflow now runs the display and reading suites and uploads their
artifacts. These are fixture tests, not provider-availability or user-comprehension
measurements. Hardware touch assistive-technology testing remains a release check.

The original reading slice did not change access or provider contracts. The follow-up
below completes those specific access and provenance gaps; instrument assessment
eligibility and cross-visit persistence remain unchanged.

## Owner Access and Reading Provenance

Private Research endpoints fail closed before processing requests. A locked browser,
an unconfigured deployment, an empty saved list and a failed refresh have different
copy and recovery actions. Unlock retains ticker, market, tab, depth and fragment.
Save denials preserve private-panel drafts; new-tab unlock is labelled, and saving
afterward remains explicit. A denied Memory read cannot trigger automatic writes.

Bookmarks make no personal-review claim. Saved decisions come from the user's journal;
calculated checklist statuses remain separately labelled. A review-history entry can
establish a review even when its decision is `Not recorded`. Daily change preserves
missing versus zero; currency and quote observation/retrieval labels retain the provider's
meaning. Annual financial results stay aligned while cash, debt and share balances
carry separate dates. Mixed and unknown periods are visible rather than inferred.

Market archive and change panels retain observed/retrieved/unknown clock provenance,
raw units and snapshot identity. A refetch, older observation or same-time revision
cannot be called a newer observation. Zero-net score/weight effects remain inspectable;
true no-change and unavailable comparisons remain distinct. History has local loading,
empty, partial, failed and retry states. Descriptive tier wording and semantic colors
apply in scenario and replay views. Leading named evidence is near the verdict; chart
then evidence is both the DOM and visual order at every responsive width.

Cboe and NAAIM adapters establish observation dates only from the provider's dated
reading. Unknown dates remain retrieval-only; legacy ambiguous full timestamps lose
their observation claim when read without rewriting archives. Research monitoring
uses the quote observation and dated chart values independently of retrieval time;
price-based valuations retain both the quote date and annual reporting period.

The three deterministic follow-up suites and four browser matrices are documented in
`docs/TESTING.md`. Browser checks must include 1280px, 768px and 375px screenshots,
contained long content, keyboard/focus behavior and error recovery. Authored-review
age is nullable across structured monitoring, policy and readiness: a saved bookmark
must not become a fresh review or satisfy a review-age policy. An explicit scheduled
review remains independent of whether a first review has been authored.
