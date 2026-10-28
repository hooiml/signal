# V8 Interaction Ideas — Market and Research

## Purpose

A shortlist of interactive enhancements to explore after E12/E13, written from a design review of
V8 Market, Research (stock page, Discover, Calendar) using the app-screen rules of the taste skill.
Nothing here is scheduled. When an idea is chosen, it becomes an `E` item in
[`ENHANCEMENT_ROADMAP.md`](ENHANCEMENT_ROADMAP.md) with its own scope, lane and evidence.

Every idea must keep the "Product Direction To Preserve" rules in
[`NEXT_PRODUCT_ROADMAP.md`](NEXT_PRODUCT_ROADMAP.md): descriptive, not advice; missing evidence
stays visible; nothing silently changes a saved record; currencies are never combined without FX
evidence; browser-local state is labelled as such.

## How an interaction earns its place

Signal is read daily and in short visits. An interaction is worth building only when it answers a
question the screen already raises, faster than reading does.

1. **One live thing per screen.** Each screen gets at most one signature interaction; the rest of
   the screen stays plain reading.
2. **Works without it.** The static view still answers the screen's question. The interaction adds
   a second answer; it never hides the first behind a gesture.
3. **Thumb first.** Every gesture has a tap version on a phone and a keyboard version on desktop.
4. **Exploration never saves.** What-if states are visibly temporary ("Exploring · not saved") and
   reset on reload. Saving stays an explicit button, as today.
5. **Built from data Signal already loads.** No new provider, dependency or background fetch unless
   the idea says so and goes through review first.
6. **Colour stays on data.** One hue for the main data, red/green only for direction, and nothing
   new on chrome.

## Market

The screen's question: *"What is the market mood today, and how much should I trust that reading?"*

### M1 · Score anatomy — switch an input off and watch the score move

The composite is a weighted sum the page already explains with impact chips (`(score − 50) ×
weight`). Make that sum touchable: each input in the evidence list gets a switch. Turning VIX off
recomputes the composite with the remaining weights and shows it beside the real one:
**57 → 54 without VIX Index**.

- Why: the most common question about a composite is "what is driving it?" This answers it by
  doing, not by reading a methodology note.
- Ease: one switch per row, one comparison figure; a "Reset" link restores the real reading.
- Guardrails: labelled "Exploring · not saved"; never writes settings; stale and missing inputs
  keep their states; the official score stays the largest figure.
- Data: existing component scores and weights. Lane: Standard.

### M2 · Rewind — scrub the score history and the page follows

Today the score chart previews a date, and Detailed view replays a stored snapshot. Make the chart
the page's time control: dragging (or arrow keys) along the history re-points the reading, the
coverage ring and the evidence rows to that day, with a persistent banner
**"Viewing 12 Sep 2026 · Return to today"**.

- Why: "Was the mood like this before the last drop?" is answered by moving one handle.
- Ease: one handle; the date is always written in the banner; one tap returns to today.
- Guardrails: reconstructed and observed points stay labelled; days with no stored snapshot say so
  instead of interpolating.
- Data: existing replay API. Lane: Standard. Depends on replay being available outside Advanced.

### M3 · Same tape, two readings — Momentum and Contrarian side by side

Momentum and Contrarian read the same inputs in opposite directions, but users only ever see one.
A "Compare modes" toggle splits the reading into two columns on the same evidence: each indicator
row shows its pull in points under each mode, and the two composites sit at the top.

- Why: it teaches what the modes mean using today's numbers instead of a glossary.
- Ease: one toggle; on a phone the two columns become a swipe between two cards.
- Guardrails: the user's chosen mode stays the default and is not changed by comparing.
- Data: one extra signal request for the other mode, only when the toggle is opened.

### M4 · Similar days, as dots — the history behind "after scores like today's"

Historical outcomes currently show a median and a hit rate. Draw the 86 similar-score periods as a
strip of dots, one per period, placed by forward return and filled by sign. Tapping a dot names the
date and its return; a thin line marks the all-score median.

- Why: a median hides the spread. Seeing that about two in five of those periods fell says more
  than "+0.6%".
- Ease: tap a dot, read a line. No legend beyond "each dot is one past period".
- Guardrails: overlapping periods stay disclosed; "descriptive history, not a prediction" stays in
  the heading's sentence.
- Data: needs the per-period rows behind the existing cohort summary (check the calibration payload
  first; if absent, this is an API change and gets its own review).

### M5 · Freshness clock — when will each input next update?

Each indicator has its own rhythm (VIX daily, AAII and NAAIM weekly, BofA monthly). Replace the bare
"stale" label with a small bar that fills as the input ages against its expected cadence, and the
words **"Updated Tue · next expected Thu"**.

- Why: "stale" alarms; "due Thursday" explains. Users stop wondering whether something is broken.
- Ease: no interaction needed; tapping opens the existing indicator detail.
- Guardrails: expected cadences are configuration, written down, never inferred from one gap.
- Data: indicator registry plus last-updated timestamps. Lane: UI-LIGHT once cadences are agreed.

## Research

The stock page's question: *"Where is this stock now against its own history and my plan?"*

### R1 · Measure — drag across the price chart for the change between two dates

Selected as [E14 in the enhancement roadmap](ENHANCEMENT_ROADMAP.md#e14--research-price-chart-measurement-r1).
The implementation counts **returned observations**, rather than implying complete trading-session
coverage, and uses a visible Measure button for the phone's two-tap path.

Click-and-drag (or tap one point, then another) draws a shaded span and reads
**"18 Aug → 9 Sep · +USD 21.40 (+7.0%) · 16 sessions"**. Keyboard: Shift + arrows extends the span.

- Why: "how much did it move since earnings / since I saved it?" is the most common chart question
  and today needs mental arithmetic from the tooltip.
- Ease: the gesture people already try on charts; Esc or a tap outside clears it.
- Guardrails: price change only, not total return (the same wording as the range change).
- Data: existing daily closes. Lane: Standard (chart interaction, phone and keyboard paths).

### R2 · Then vs now — a review card when a saved review comes due

When a saved review is due or overdue, the stock page opens with a compact card comparing the day
it was saved with today: price, distance from the 52-week high, market score, and the user's own
thesis line. One button, **"Start review"**, opens the existing Review tab.

- Why: Calendar already counts overdue reviews; the stock page should make doing one effortless.
- Ease: one card, one action, "Later" dismisses it for this visit only.
- Guardrails: it reads saved records and never edits them; the thesis is shown, not judged.
- Data: saved review dates and snapshots already stored. Lane: Standard.

R2 implementation uses owner reviews only: guest bookmarks store notes, not review schedules
or history. Scheduled dates include today in UTC; the independent age deadline becomes stale
only after its date, matching Calendar. The card uses the latest immutable review (or the
saved journal for a legacy personal review), its observed price/currency and authored thesis.
Missing historical price/currency stays explicit. Historical high-distance and market score
were never stored; the current stock response has no market score either. These gaps are
labelled rather than reconstructed. Current price/high-distance comes from the existing
stock response with its quote date. Long theses have a short preview and native full-text
disclosure. No additional provider call or research write is made.
Start review opens the existing editable `/research` workspace in a new tab with ticker and
market intact, preserving open drafts. Later lasts for the mounted stock visit; switching
away and back, reloading, or receiving a new saved revision restores the card. Tab changes
and provider refresh do not reset dismissal. Verification: `research-due-review-qa.mjs`
and the due-review contracts in the Research harness; see `TESTING.md`.

### R3 · Earnings ticket — the next event on the quote band

Implemented in connected Research: next supplied US date in the existing 30-day
Calendar window, linked to its selected day in a new tab. Nasdaq supplies no confirmed
flag, so dates stay unconfirmed without a countdown. Malaysia coverage remains
unavailable. See `docs/ARCHITECTURE.md` and `docs/TESTING.md` for boundaries and proof.

If the Calendar knows the stock's next earnings date, show it beside the price as a small ticket:
**"Earnings · Tue 28 Oct · after close · in 3 days"**. Tapping it opens the Calendar on that day.

- Why: it is the most time-sensitive fact about a stock and today lives two screens away.
- Ease: no new control; it is one line of text that links to where the detail already is.
- Guardrails: "time not supplied" when the provider gives none; no countdown on unconfirmed dates.
- Data: existing calendar endpoint for one symbol. Lane: UI-LIGHT.

### R4 · Peers on the chart — tap a peer to overlay its line

On Peers, each peer row gets an "Overlay" toggle that draws its price on the stock's chart,
rebased to 0% at the range start, in a neutral grey with its ticker at the line's end.

- Why: "is this the stock or the whole sector?" is answered at a glance.
- Ease: up to two overlays; the stock's own line keeps the data hue.
- Guardrails: rebased percentages only, so different currencies are never added or converted; a peer
  with no history in range says so.
- Data: one history request per overlaid peer, on demand.

### R5 · Plan ruler you can drag — preview a price against your own plan

E10 drew the saved position plan against the returned price. Let the user drag a "what if the price
were…" marker along that ruler and read the distance to each of their own plan levels.

- Why: it turns a static picture of the plan into a quick self-check before a review.
- Ease: one handle; the real price marker never moves.
- Guardrails: the dragged price is labelled hypothetical, is never saved, and the copy states
  distances only (no buy/sell wording); same-currency rule as E10.
- Data: existing plan and quote. Lane: Standard; needs owner/guest saved-plan fixtures for QA.

## Across both screens

### X1 · Quick jump — "/" to search, from anywhere

A keyboard shortcut and a header search button open one field that jumps to a stock, the Market of
either country, or a Discover view. Recent stocks appear first (browser-local, labelled).

- Why: the fastest path to a stock is currently home → search box. Daily users want one key.
- Ease: discoverable through a visible search button; the shortcut is a bonus.
- Data: existing lookup endpoint. Lane: Standard (shared header).

### X2 · Since your last visit, everywhere

Market already says "57 → 61 since your last visit". Extend the same browser-local note to the
Watchlist (which saved stocks moved most, which reviews became due) and to Discover (new names in
Trending since you last looked).

- Why: a returning user's first question is "what changed?".
- Guardrails: browser-local, per device, and labelled so; first visit shows nothing rather than a
  made-up baseline.

## A little creativity, inside the rules

Ideas that give Signal a face of its own without decoration. Each is optional and small.

- **The wave in the wordmark.** The `∿` in the logo becomes the one place the product shows its
  pulse: on Market, its amplitude follows the evidence coverage (a flat wave when inputs are
  missing, a full wave at full coverage), with an accessible label stating the coverage. It never
  encodes direction, so it cannot be read as a call.
- **A trading-day rhythm for the Calendar.** Weekends and US market holidays drawn one tone darker,
  and today's session status in words ("US market open · closes in 2 h 10 m"), so the calendar reads
  as a trading calendar rather than a generic month.
- **Words of the trade in empty states.** Replace generic "No data" with the market's own phrasing:
  "No AAII survey this week yet — it publishes Thursdays", "Quiet week: no watchlist earnings".
- **Score history as a tape.** On 1M, label the chart's turning points with the input that moved
  most that day ("VIX +3.4 pts"), taken from stored snapshots, so the line tells its own story.

## More enhancements (added 2026-10-25)

These items were added after the first version of this document. They come from the
same review and are not all interactions: some are layout, trust and platform work that make the
interactions above easier to use. IDs continue the existing letters (M, R) or start new ones
(L layout, T trust, W workflow, Q quality, P needs review).

### Layout and ease of use

#### L1 · Market on phones, folded · Implemented (E16)

Implemented as [E16 in the enhancement roadmap](ENHANCEMENT_ROADMAP.md#e16--fold-secondary-market-sections-on-phones-l1).
At 600px and narrower, summaries preserve evidence limits while the details start closed.
Desktop content stays visible; keyboard controls and investigation links reveal the right panel.

- What: on phones keep the reading, "since your last visit" and the evidence open; fold Market
  context, Historical outcomes, Exposure map and What changed into closed sections, each with a
  one-line summary ("S&P 500 −0.52%, 4 of 4 indexes down").
- Why: Market measures about 4,700px at 390px wide, roughly five and a half phone screens.
- Check: every folded section's summary carries its key figure; nothing is hidden without one.

#### L2 · Empty states as one line

- What: "No saved US stocks to map", "Insufficient evidence" and similar cards shrink to one sentence
  and the action that fills them, keeping their heading so the section stays findable.
- Why: a full bordered card that says "nothing here" is the largest thing on some screens.

#### L3 · Stock page tabs on phones · Implemented (E15)

Implemented as [E15 in the enhancement roadmap](ENHANCEMENT_ROADMAP.md#e15--phone-stock-page-tab-navigation-l3):
visible scroll buttons at 600px and narrower preserve the existing tabs and swipe path without
restoring an edge fade. Keyboard selection, direct links and resizing keep the active tab visible.

- What: show that the six-tab bar scrolls, or group Peers and Filings under "More" below 600px.
- Why: "Filings" is cut at the screen edge with no hint; the edge fade was removed in `b7cf762`, so
  the fix must not bring a fade back.

#### L4 · Watchlist sorting and review of the populated list

- What: sort the Watchlist by review due, closest to the 52-week high, or biggest move; figures
  right-aligned in tabular digits. First review the populated Watchlist screen, which has not been
  checked with saved stocks.
- Why: the Watchlist is the home for returning users and currently has one fixed order.

#### L5 · One "last updated" line per screen

- What: a single freshness line at the top ("Provider data retrieved 04:14 UTC"); a card shows its
  own time only when it differs.
- Why: repeated retrieval stamps on every card add reading without adding information.
- Guardrail: product rule 7 still holds; every timestamp stays available, only duplicates go.

### Trust and clarity

#### T1 · Source health

- What: a small panel listing each provider used on the screen with its last success or failure,
  from responses the page already received.
- Why: when something is missing, users can see whether a source is down instead of guessing.

#### T2 · Data-gap explainer

- What: "Insufficient evidence" names exactly what is missing ("SEC fundamentals not returned for
  this listing") and what would fill it.
- Why: a generic gap message reads like a bug; a specific one reads like an honest limit.

#### T3 · Malaysia coverage note

- What: on MY stocks, one line listing the panels that are US-only and why.
- Why: missing SEC-based panels then read as expected, not broken. Related to E7.

### Research workflow

#### W1 · Review queue

- What: stocks with a review due this week as a short inbox, oldest first, one tap to start each.
- Why: Calendar counts overdue reviews; this makes clearing them a single place. Pairs with R2.

#### W2 · Side-by-side compare

- What: two saved stocks on the same panels (price context, margins, valuation multiples).
- Guardrail: same currency only, or each side in its own currency with no combined figures (rule 6).

#### W3 · Things to watch on a saved stock

- What: pin up to three measures to a saved stock ("operating margin above 30%") and see each one's
  current value against the user's own line.
- Guardrail: display only; it never alerts, scores or edits the thesis on its own (rule 3).

### Market

#### M6 · Malaysia and US side by side

- What: both markets' readings on one screen, each with its own coverage and date.
- Why: users who follow both switch markets back and forth today.

#### M7 · Indicator detail pages

- What: each indicator's own history, cadence, source and weight in one place, linked from its
  evidence row. Natural home for M5's freshness clock.

### Quality and platform

#### Q1 · Accessibility pass

- What: chart descriptions for screen readers, focus order across tabs and disclosures, and 200%
  zoom at 1280px on Market and the stock page.

#### Q2 · First-screen speed

- What: measure time to the first useful screen on Market and a stock page (`qa:performance`), then
  let slow panels (outcomes, peers, filings) arrive after the reading.

#### Q3 · Offline reading

- What: when offline, show the last loaded reading with its date, clearly labelled as cached.
- Guardrail: cached data never looks current; extends the existing PWA reconnect state.

### Needs an architecture or privacy review first (product rule 9)

#### P1 · Due-review reminders

- What: an opt-in browser reminder when a saved review comes due. Background delivery needs review.

#### P2 · Export

- What: export a stock's reading or the user's own review notes as Markdown or PDF.
- Guardrail: authored notes stay private; nothing leaves the device without an explicit action.

## Project-wide additions · New (added 2026-10-25, after syncing main)

These ideas were added to address gaps beyond Market and Research. At the time, V8 had no
portfolio surface or Learn links, and older V2–V7 routes were still live beside it. IDs start
with G (global); the current delivery status and remaining scope are recorded under each item.

#### G1 · Portfolio in V8 · First slice implemented (E18)

- What: a V8 home for the portfolio work that today lives in the V6/V7 cockpit (holdings, import,
  reconciliation, covered attribution, what-if), starting with a read-only holdings view.
- Why: V8 is the default (`/` redirects to `/main-v8`), so portfolio users must leave it to reach
  their own records.
- First slice: scoped as [E18](ENHANCEMENT_ROADMAP.md#e18--read-only-v8-holdings-view-g1). It reuses
  the browser-local holdings snapshot and the existing holdings and covered-attribution contracts,
  so it adds no provider, storage, network behaviour or authentication and needs no separate design
  doc (rule 9 is not triggered).
- A design doc is needed first only if a later slice brings import, reconciliation or what-if
  editing into V8 (mutations, rule 8), adds new storage or API endpoints (rule 9), or shows a total
  across currencies (rule 6, approved FX evidence).
- Guardrails: rules 4–6 (holdings stay out of analytics, storage kinds stay distinct, no
  cross-currency totals without FX evidence).
- Delivered: Research home's Holdings tab reads the existing snapshot, separates cost/cash
  totals by currency, shows missing prices explicitly and opens exact saved-stock matches.
  This first slice is cost-only. Import, reconciliation, attribution and what-if remain in the
  linked Portfolio workspace; their migration into V8 is still outstanding.

#### G2 · Learn from where you read · Implemented (E17)

- What: metric labels in V8 (RSI, put/call ratio, NAAIM, P/E, free-cash-flow yield) link to the
  matching Learn concept lab; Learn takes the V8 tokens and header so it feels like the same product.
- Why: Learn exists but nothing in V8 points to it; definitions arrive at the moment of confusion.
- Delivered: new-tab links from Research RSI/current valuation and Market put/call/NAAIM details,
  five allowlisted lesson URLs, illustrative market exercises, and the V8 Learn header/theme.
  Existing courses, progress and command-palette actions remain available. Verification is in E17.

#### G3 · One glossary, one popover · Implemented

- What: a short definition for each metric in one shared glossary, shown in a small popover on tap
  or focus wherever the label appears, with "Learn more" to G2's lab.
- Why: definitions are currently spread across per-panel notes and "How to read" disclosures.
- Delivered: one shared short definition for each of G2's five metrics (RSI, P/E, FCF yield,
  put/call and NAAIM), native top-layer popovers, new-tab lessons, and repeated-label coverage in
  Market, Research, peers, filing history and chart tools. Existing metric selection controls keep
  their actions; Market's View indicator action follows the definition. Plain native options have
  an adjacent definition control, and accounting disclosures expose it when opened. Narrative
  mentions and other metrics are outside this glossary. See DESIGN.md and docs/TESTING.md.

#### G4 · V8 settings in one place · Implemented (E20)

- What: one settings view for theme, default market and mode, social-in-score default, guest data
  (export or clear this device's data) and owner unlock.
- Why: these live across the header, the Workspace menu and per-page toggles today.
- Guardrail: clearing guest data is a confirmed, recoverable-where-possible action (rule 8).
- Design: [`V8_SETTINGS_DESIGN.md`](V8_SETTINGS_DESIGN.md); one modal preserves Research drafts,
  existing keys and owner access, with explicit defaults and guest-only data actions.

#### G5 · First visit to V8 · Verified (E21)

- What: a three-step, skippable orientation on first visit: read the Market score, open a stock,
  save it to the Watchlist. Shown once per device, restartable from G4.
- Why: `/start` predates V8; new users land on a dense screen with no path through it.
- Design: [`V8_FIRST_VISIT_DESIGN.md`](V8_FIRST_VISIT_DESIGN.md); separate validated local
  progress, real reading/save evidence, already-saved acknowledgement and safe restart.

#### G6 · Retire legacy routes · Verified (E22)

- The actual V2/V4/V5/V6/V7 and backup aliases redirect to V8 for reading and canonical
  `/research` for explicit advanced jobs. There were no V3 aliases. Query values and fragments
  are retained; Today has a working V8 return action.
- G1 remains cost-only. Portfolio import/reconciliation/attribution/what-if, Queue, alerts,
  calendar, changes, currency, outcomes, replay and backup remain in canonical Research.
- Market alerts and queued exposure reviews remain at `/market/tools`; V8 coverage of
  sensitivity, calibration, context and exposure is not a claim of full Market parity.
- Inventory, route contract and migration boundary: [LEGACY_ROUTE_RETIREMENT.md](LEGACY_ROUTE_RETIREMENT.md).

#### G7 · Visual checks in CI · Verified (E23)

- What: keep baseline screenshots from the existing browser suites and flag pixel differences in the
  `Signal validation` workflow; optionally run the taste inspector in app mode as a warning step.
- Why: E12–E16 were verified by eye; a baseline catches the next regression without a manual pass.
- Implementation: twenty fixture screenshots cover Market, Research, Holdings, Settings and
  glossary at desktop/phone sizes in both themes, with separate Windows and pinned Linux
  baselines. Local comparisons and deliberate failure probes pass; all twenty independently
  reviewed Linux baselines pass the normal pinned-container CI comparison. See
  [VISUAL_CHECKS.md](VISUAL_CHECKS.md).

#### G8 · A shared V8 component kit · Verified (E24)

- What: pull the repeated V8 pieces (card, disclosure with summary line, segmented control, empty
  state, freshness line) into one set of components documented in `DESIGN.md`.
- Why: Market and Research each carry their own copies; L2 and L5 would otherwise be done twice.
- Implementation: connected Market and Research share the five primitives while preserving
  markup, classes, copy and state ownership. Pressed controls and automatic tabs have separate
  contracts. Phone disclosures and specialized navigation keep their owners. `DESIGN.md`
  documents the API and examples. Local full checks, affected browser matrices and all
  twenty G7 Windows comparisons pass with no baseline changes; see E24 for evidence and
  the separate remote CI/Linux verification boundary.

## Suggested order

| Order | Idea | Value | Effort | Lane | First check |
| ---: | --- | --- | --- | --- | --- |
| 1 | R1 Measure on the price chart (done, E14) | High, daily use | Small | Standard | Phone tap-tap path and keyboard Shift+arrows |
| 2 | R3 Earnings ticket | High, time-sensitive | Small | UI-LIGHT | Calendar endpoint returns one symbol cheaply |
| 3 | M1 Score anatomy | High, explains the product | Medium | Standard | Recomputed score matches the server's formula |
| 4 | M5 Freshness clock | Medium, reduces worry | Small | UI-LIGHT | Agree expected cadences per indicator |
| 5 | R2 Then vs now | Medium, drives reviews | Medium | Standard | Saved-record fixtures for due and overdue reviews |
| 6 | M2 Rewind | Medium | Medium | Standard | Replay availability outside Advanced |
| 7 | X1 Quick jump | Medium | Medium | Standard | Shared header; no layout shift on phones |
| 8 | M4 Similar days as dots | Medium | Medium–Large | Standard | Per-period rows exist in the payload |
| 9 | M3 Two readings | Teaching value | Medium | Standard | Extra request only on toggle |
| 10 | R4 Peers overlay, R5 Plan ruler | Niche | Medium | Standard | Currency and fixture coverage |

The later items are not ranked against these yet. L1 and L3 are implemented (E16, E15). Quick
wins remaining: L2 empty states and T2 data-gap explainer (small, no new data); W1 review queue fits
next to R2. G2–G8 are implemented, including G8's shared kit (E24). G1's read-only,
cost-only Holdings slice is implemented; import, reconciliation, attribution and what-if
editing still live in G6's canonical `/research` Portfolio workspace. Migrating those advanced
jobs into V8 remains a separate design task. Retained Market engines live at `/market/tools`.

## Not doing

- Price predictions, "likely next move", buy/sell or strength badges on stocks.
- Gamification: streaks, scores for the user, confetti.
- Animated tickers or auto-refreshing numbers that move while being read.
- Sparklines on every figure, rainbow indicator colours, or a dashboard of identical cards.
- Any interaction that edits a thesis, plan, review or watchlist without an explicit save.
