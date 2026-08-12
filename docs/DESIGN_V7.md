# Signal V7 Design Contract

## 0. Status

- Status: Implemented, promoted, and locally verified.
- Scope: Presentation and interaction architecture for Market Conditions V7 and Investment Research V7.
- Live aliases: `/main-v7` and `/research-v7`.
- Promoted routes: `/` and `/research` use V7 presentation; `/main-v6` and `/research-v6` remain rollback references.
- Promotion status: Phases 3-5 implemented and locally verified on 2026-08-13. Deployment remains a separate delivery state.
- Post-promotion polish: mobile Research prioritizes the selected security before optional overview disclosures; responsive Market controls wrap without horizontal scrolling; reused domain surfaces inherit the V7 surface scale; destructive Research removal is separated from the quote.

### Intentional V7 presentation differences

- Market adds the calmer V7 shell and a live first-reading hierarchy for posture, score, support, conflict, freshness, and conditions date; detailed V6 evidence, calibration, alerts, context, and methodology remain below it.
- Research adds the shared V7 shell, intent-group controls, and selected-security decision context while retaining the existing workspace identifiers, URL state, persistence, review, evidence, queue, portfolio, backup, notification, and storage boundaries.
- V7 removes the V6 atmospheric page treatment and uses opaque neutral surfaces. No scoring, provider, API, persistence, or authored-research semantics change.
- This document does not authorize changes to scoring, data contracts, APIs, persistence, research decision rules, analytics privacy, or notification behavior.
- Existing behavior remains governed by `docs/PROJECT_OBJECTIVE_AND_FLOWS.md`, `docs/signal-scoring.md`, `docs/ARCHITECTURE.md`, and the current V6 contract in `src/components/v6/DESIGN.md`.

## 1. Purpose

V7 should make Signal calmer, clearer, and easier to scan without turning it into a generic finance dashboard. It should combine the visual restraint of the approved V7 Market prototype with Signal's existing evidence-first product model.

The design must help a user answer five questions in order:

1. What is the current interpretation?
2. How trustworthy and current is it?
3. What evidence supports or conflicts with it?
4. What changed, and what could change the interpretation next?
5. Where can the user inspect the detailed evidence and methodology?

V7 is successful when the first viewport is calm and understandable while the complete evidence trail remains reachable without changing its meaning.

## 2. Product Boundary

Signal remains one product with two connected but independent workspaces:

- **Market Conditions** is a top-down assessment of the market environment.
- **Investment Research** is a bottom-up assessment of an individual security.

The workspaces share navigation, visual language, theme, status treatments, and evidence conventions. They must not share decision logic.

Market context may be handed into Research as explicitly labeled context. It must never overwrite a security thesis, checklist, valuation, trigger, or decision state.

## 3. V7 Design Principles

### 3.1 Decision first

The primary interpretation appears before charts, controls, methodology, or secondary facts. The user should not need to infer the conclusion from a grid of metrics.

### 3.2 Trust stays adjacent

Freshness, coverage, source status, conditions date, and conflicts sit beside the output they qualify. Trust information must not be moved to a distant footer or hidden behind a generic information icon.

### 3.3 One visual emphasis per viewport

Market gives primary visual emphasis to score history. Research gives primary visual emphasis to the selected security document. Supporting metrics and utility navigation remain quieter.

### 3.4 Fewer containers

Use cards only for a bounded summary, selected item, chart, or interactive field. Use spacing, dividers, and headings for repeated evidence. Do not nest cards to manufacture hierarchy.

### 3.5 Progressive evidence, not progressive truth

The primary conclusion, strongest support, strongest conflict, freshness, and date remain visible. Progressive disclosure is reserved for detail, methodology, non-scored context, and long historical evidence.

### 3.6 Calm does not mean vague

The interface may reduce borders, color, and density, but it must retain exact values, dates, sources, prior comparisons, missing states, and limitations.

### 3.7 Behavior parity before promotion

V7 presentation may be promoted only after it preserves current route state, deep links, storage behavior, domain decisions, loading/error behavior, and relevant V6 workflows.

## 4. Shared Application Shell

### 4.1 Desktop shell

- Maximum content width: 1400px.
- Outer gutter: 24px at desktop widths.
- Header height: approximately 68px.
- Header placement, left to right:
  1. Signal wordmark.
  2. Primary navigation: `Market | Research`.
  3. Route-owned controls.
  4. Theme and refresh utilities.
- Use one bottom hairline to separate the header from the page.
- Do not add a permanent icon sidebar. Two primary destinations do not justify unlabeled navigation.

### 4.2 Tablet shell

- Outer gutter: 16px.
- Keep wordmark and primary navigation visible.
- Route-owned controls may wrap into one secondary command row.
- Preserve at least 40px control targets.

### 4.3 Mobile shell

- Outer gutter: 14-16px.
- First row: wordmark on the left and essential utilities on the right.
- Second row: equal-width `Market | Research` navigation.
- Market, mode, filter, density, and other route controls move into the first route-owned control band below navigation.
- Do not hide the active market, mode, ticker, or workspace state inside an unlabeled menu.

### 4.4 Route identity

- Use `Market Conditions` as the Market page label.
- Use `Investment Research` as the Research page label where the full name is needed.
- Keep top-level navigation labels short: `Market | Research`.
- Do not use version numbers in user-facing navigation or page headings.

## 5. Visual Language

### 5.1 Proposed color roles

V7 should use neutral opaque surfaces. The V6 emerald-lit grid and translucent panel atmosphere should not carry into V7.

| Role | Light proposal | Dark proposal | Use |
|---|---:|---:|---|
| Canvas | `#EEF1EF` | `#080C0B` | Outer application background |
| Primary surface | `#FFFFFF` | `#111715` | Main application window and bounded primary panels |
| Quiet surface | `#F7F8F7` | `#171E1B` | Metrics and low-emphasis utility regions |
| Primary text | `#18201D` | `#EEF4F1` | Headings, decisions, and values |
| Secondary text | `#52605A` | `#AAB8B1` | Explanations and supporting facts |
| Muted text | `#75817B` | `#819089` | Dates, source metadata, and labels |
| Border | `#DFE5E1` | `#2A3430` | Hairlines and bounded surfaces |
| Emerald accent | `#147A4B` | `#55B783` | Active state, support, and selected data |
| Risk | `#B23B43` | `#EF7B82` | Conflicts, errors, and negative exceptions |

Rules:

- Emerald is the single brand accent and a semantic support color.
- Red is reserved for conflict, error, and material negative evidence.
- Amber is reserved for caution or aging evidence.
- Neutral states remain neutral; do not color every metric.
- Every semantic color must be paired with text, an icon, a line style, or an explicit status label.

### 5.2 Typography

- Retain the installed `Source Sans 3` body/display family and `Roboto Mono` numeric family for the first V7 implementation. A font change is a separate approved design decision.
- Use sentence case for page titles, panel titles, buttons, and navigation.
- Use uppercase only for short eyebrow labels such as `MARKET CONDITIONS`.
- Use monospaced numerals for scores, percentages, contributions, prices, and table values.
- Avoid all-caps explanatory copy and avoid ornamental italic text.

Recommended hierarchy:

| Role | Desktop | Mobile | Placement rule |
|---|---:|---:|---|
| Page interpretation | 40-48px | 30-34px | First content heading; maximum 24 characters per visual line where possible |
| Workspace title | 28-34px | 24-28px | Selected ticker or primary workspace identity |
| Section title | 16-18px | 16-18px | Immediately above the content it owns |
| Panel title | 14-16px | 14-16px | Top-left of a bounded panel |
| Body | 14-16px | 14-16px | Maximum readable width of approximately 65 characters |
| Label/metadata | 12-13px | 12-13px | Never below 12px for essential content |
| Numeric emphasis | 28-36px | 26-32px | One dominant value per summary surface |

### 5.3 Shape and elevation

- Application window: 16-18px radius.
- Primary bounded panels: 10-12px radius.
- Compact controls: 8-9px radius.
- Use one restrained application-window shadow only.
- Use borders and surface contrast for internal hierarchy; avoid card-by-card shadows.
- Never use outer glows, neon accents, or decorative glass effects.

### 5.4 Spacing rhythm

- Page section gap: 24px desktop, 20px tablet, 18px mobile.
- Panel padding: 18-20px desktop, 14-16px mobile.
- Label-to-value gap: 8-10px.
- Heading-to-supporting-copy gap: 8-12px.
- Repeated evidence-row padding: 10-12px vertical with a single divider.
- Do not reduce vertical spacing merely to keep more cards above the fold.

## 6. Text Placement and Content Hierarchy

### 6.1 Placement contract

Every major surface follows this order when the fields exist:

1. **Eyebrow or owner label** identifies the subject.
2. **Headline or value** carries the primary interpretation.
3. **One supporting sentence** explains the meaning in plain language.
4. **Status metadata** names date, freshness, coverage, or persistence boundary.
5. **Detailed evidence** follows in ranked or task order.
6. **Action** appears beside or after the content it affects.

Do not place the explanation before the conclusion, or the action before the user understands its consequence.

### 6.2 Decision language

- Market posture is a complete plain-language sentence, for example: `Risk-on, with disciplined sizing.`
- Research decision remains one of the domain-owned states: `Ready`, `DCA`, `Wait for price`, `Watch`, or `Avoid`.
- Decision state must not be expressed through color alone.
- Avoid language such as `high confidence` when the value actually represents indicator agreement or evidence coverage.

### 6.3 Metadata placement

- Place `Conditions available`, conditions date, and decision-support disclaimer to the right of the Market headline on desktop.
- Stack the same metadata directly below the Market summary sentence on mobile.
- Place source, observed date, and freshness directly below the evidence title or reading they qualify.
- Attach prior comparisons to the current value they explain.
- Use exact dates instead of `yesterday` when snapshots may skip days.

### 6.4 Source line format

Use a stable readable sequence:

`Source name · Observed date/time · Freshness state`

If the content is synthesized, label synthesis separately from deterministic or cited evidence. Do not combine provider evidence, saved analysis, and observational outcomes into one generic confidence label.

### 6.5 Truncation

- Do not truncate the primary interpretation, decision state, conflict, invalidation, or error.
- Long headlines may wrap to two lines on mobile.
- Ticker names and source titles may truncate only when the complete value remains available through an adjacent detail surface.
- Never use hover-only text for information required to understand a decision.

## 7. Market Conditions V7

### 7.1 Desktop arrangement

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Signal   Market   Research                 US   Standard   Theme   Refresh   │
├──────────────────────────────────────────────────────────────────────────────┤
│ MARKET CONDITIONS                                                           │
│ Risk-on, with disciplined sizing.          Conditions available             │
│ Momentum remains broad, but...             Date · disclaimer                 │
├───────────────────────┬───────────────────────┬──────────────────────────────┤
│ Composite score       │ Signal alignment      │ Data quality                 │
│ 72 / 100              │ 78%                   │ 28 / 31                      │
│ Prior comparison      │ Meaning               │ Coverage · freshness         │
├───────────────────────────────────────────────┬──────────────────────────────┤
│ Score history                                  │ Why it changed               │
│ Dominant responsive chart                      │ Ranked contribution shifts   │
│ Range controls                                 │ Strongest conflict           │
│ Current value and direct annotations           ├──────────────────────────────┤
│                                                │ Trust and freshness          │
├────────────────────────────────────────────────┴──────────────────────────────┤
│ What deserves attention next: support | conflict | freshness                 │
├──────────────────────────────────────────────────────────────────────────────┤
│ Historical outcomes and detailed score evidence                              │
│ Calibration · scenarios · non-scored context · alerts · methodology          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 First-viewport reading order

1. Market posture headline.
2. One-sentence interpretation and primary caveat.
3. Conditions state, date, and disclaimer.
4. Composite score with prior comparison.
5. Indicator alignment and combined data quality.
6. Score history.
7. Ranked change attribution and strongest conflict.
8. Trust and freshness summary.
9. Three concise next-attention statements.

The score must not visually overpower the posture headline. It supports the interpretation; it is not the product's only answer.

### 7.3 Orientation metrics

- Use at most three summary surfaces in the first viewport.
- Give the composite score slightly more visual ownership than alignment and data quality.
- Keep regime language in the posture sentence or supporting explanation instead of adding a fourth equal card.
- Put score delta beneath the score, not in a separate card.
- Put quality coverage and freshness together because they qualify the evidence set.

### 7.4 Primary evidence row

- Use an approximately 70/30 desktop split between score history and the evidence rail.
- Score history owns the dominant chart and range controls.
- The right rail contains, in order:
  1. `Why it changed`.
  2. Strongest conflict or divergence.
  3. `Trust and freshness`.
- Sort driver changes by material contribution shift or the established domain order; never by visual convenience.
- Avoid unused vertical space in the chart panel. Use direct chart annotations or reduce the row height rather than stretching an empty surface to match the rail.

### 7.5 What deserves attention next

- Desktop may show three concise columns: strongest support, strongest conflict, and freshness/coverage concern.
- Each item uses one top rule, one short title, and no more than two short lines of explanation where possible.
- Mobile must stack the items as full-width rows. Never preserve three narrow columns on a phone.

### 7.6 Detailed reading order below the first viewport

1. Current-zone historical forward outcomes.
2. Detailed `Why this score` history and weighted evidence.
3. Historical calibration and provenance.
4. Deterministic forward scenarios.
5. Non-scored valuation, macro, and breadth context.
6. Market alerts.
7. Terms, limitations, trust, and methodology.

The same ordering applies to US and Malaysia modes. Market-specific content changes; hierarchy does not.

### 7.7 Market controls

- Market and interpretation mode remain visible in the page command area.
- Social-source state remains visible when it affects the request.
- Refresh sits at the far right of route controls and reports its request state without implying whole-system health.
- Disable duplicate refresh while a request is active.
- Do not hide configuration state behind the chart.

### 7.8 Market responsive behavior

At 768px:

- Headline metadata moves below the summary when horizontal space is insufficient.
- Orientation metrics may use one dominant score row followed by two supporting columns.
- Chart and evidence rail stack when the rail would become narrower than a readable evidence row.

At 375px:

- Use one document column.
- Score spans the full row; alignment and quality may share the next row if their text remains readable.
- Chart controls wrap or scroll within their own control strip without widening the document.
- Evidence rail becomes full-width sections below the chart.
- Attention-next items stack vertically.
- Tables use stacked records or an explicitly labeled local scroller only when columns cannot be represented truthfully as records.

## 8. Investment Research V7

### 8.1 Research character

Research uses the same V7 shell and surface language but a higher information density. It should feel like a focused research document, not the Market dashboard with ticker data substituted into its cards.

The selected security and its saved research are primary. Daily attention, portfolio summaries, discovery, comparison, and administrative workspaces remain secondary destinations.

### 8.2 Desktop arrangement for ticker Research

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Signal   Market   Research               Search ticker   Theme   Commands   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Watchlist | Discovery | Activity | Analyze | Portfolio | Review | More       │
│ Related workspace navigation for the selected section                        │
├───────────────────┬──────────────────────────────────────────────────────────┤
│ Watchlist         │ MSFT · Microsoft                                          │
│ Search + filters  │ Price · market · observed time                            │
│                   │ Decision: Watch · reason · next incomplete check          │
│ Selected row      ├──────────────────────────────────────────────────────────┤
│ Other rows        │ Readiness strip and highest-priority gap                  │
│                   ├──────────────────────────────────────────────────────────┤
│                   │ Overview | Fundamentals | Valuation | Events | Chart ... │
│                   ├──────────────────────────────────────────────────────────┤
│                   │ Thesis and invalidation          Decision/check summary  │
│                   ├──────────────────────────────────────────────────────────┤
│                   │ Evidence, source dates, and selected detail workspace     │
│                   ├──────────────────────────────────────────────────────────┤
│                   │ Read-only journal summary · explicit review action        │
│                   │ Review history                                             │
└───────────────────┴──────────────────────────────────────────────────────────┘
```

### 8.3 Research navigation hierarchy

Primary Research sections remain:

`Watchlist | Discovery | Activity | Analyze | Portfolio | Review | More`

Related workspaces remain grouped by intent:

- Discovery: Market scan and Picker.
- Activity: Queue, Alerts, Calendar, Changes, and Filings.
- Analyze: Compare, Peers, Map, and Currency.
- Portfolio: portfolio-owned workflows.
- Review: Evidence, Policy, Outcomes, and Replay.
- More: Sources, Export, Backup, and Usage.

Rules:

- Preserve existing workspace identifiers and query-string deep links.
- Show only the workspaces owned by the active section.
- Do not repeat ticker-only filters in non-ticker workspaces.
- At desktop widths, primary sections are visible text navigation rather than icon-only controls.

### 8.4 Selected-security header

Place information in this order:

1. Ticker and company name.
2. Market and provider observation time.
3. Current price and relevant comparison.
4. Domain-owned decision state.
5. One-sentence decision reason.
6. Next incomplete research check or next review date.

The decision state and reason belong together. Do not place price movement between the decision label and its explanation.

### 8.5 Watchlist rail

- Desktop width: approximately 220-250px.
- Search and filters sit at the top.
- Rows remain flat and separated by spacing or hairlines.
- Only the selected row receives a quiet emerald selection treatment.
- Each row prioritizes ticker, decision state, and one useful secondary fact.
- Avoid mini-cards, repeated shadows, and multiple badges per row.

### 8.6 Research document order

For the selected ticker, the default document follows this order:

1. Identity, price, observation time, and decision.
2. Readiness strip naming the highest-priority gap.
3. Thesis, bull case, and invalidation.
4. Decision/check summary and next incomplete check.
5. Fundamentals and valuation evidence.
6. Events, technical context, and saved triggers.
7. Evidence coverage, freshness, and conflicts.
8. Read-only journal summary.
9. Explicit review workflow.
10. Newest-first review history.

Detailed tabs may focus the document on one evidence category, but they must not reorder identity, decision, or ownership context above the selected content.

### 8.7 Thesis and invalidation placement

- Keep thesis and invalidation in the same visual region so support cannot be read without the condition that would break it.
- Use a wider thesis column and a quieter decision/check column at desktop widths.
- Invalidation uses explicit text and restrained risk color; it is not an alert unless the condition is currently matched.
- Authored thesis text must never be silently replaced by provider or AI synthesis.

### 8.8 Review workflow placement

- The journal opens as read-only content.
- `Submit review` or the equivalent explicit action appears with the journal owner section, not in the global header.
- Editing mode reveals assisted findings and editable fields in the same document position.
- `Cancel` and `Save review` remain together at the end of the editable workflow.
- Cancellation must remain recoverable and must discard unsaved edits.
- Evidence-only actions must state that they do not change thesis, checklist, or decision.

### 8.9 Research overview and attention

- Daily attention and portfolio guardrails remain available through one compact overview disclosure.
- Do not place a large inbox above every Research workspace.
- Group repeated attention conditions by ticker.
- Show one ticker on mobile and at most two in the default wider preview before progressive expansion.
- Opening an item returns the user to the owning ticker and workspace without losing unrelated URL context.

### 8.10 Non-ticker workspaces

Discovery, Activity, Analyze, Portfolio, Review, and More workspaces use the shared shell but not the watchlist-detail layout when a selected ticker is not their primary subject.

- Use one workspace heading and one sentence defining the task.
- Place filters directly above the data they change.
- Place counts beside filter state, not in a separate KPI row.
- Use tables or flat lists for repeated comparable records.
- Use cards only for a selected candidate, bounded configuration, or necessary summary.
- Preserve unavailable and partial-coverage states in the same position as the missing value.

### 8.11 Research responsive behavior

At 768px:

- Watchlist becomes a horizontal selected-security strip above the document.
- Primary sections may scroll horizontally; active section remains visible.
- Related workspace navigation moves to a second compact row.
- The selected-security header stacks decision context below identity and price.

At 375px:

- Use a section selector and workspace selector with visible current labels.
- Keep ticker search visible.
- Put market and decision filters behind one labeled disclosure that reports active-filter count.
- The watchlist becomes a horizontal ticker strip or explicit picker above the document.
- All document content becomes one column.
- Thesis, invalidation, evidence, and review actions use natural document flow.
- Do not use sticky overlays that cover content or actions.
- Wide evidence tables own a labeled local scroller; the page itself must not scroll horizontally.

## 9. Shared Component and Surface Rules

### 9.1 Surface tiers

- **Primary:** Page interpretation, dominant chart, selected-security document.
- **Secondary:** Ranked evidence, thesis, decision/check summary, selected comparison.
- **Utility:** Filters, metadata, source detail, disclosures, method notes.
- **Action:** Explicit save, refresh, review, import, export, or notification controls.
- **Risk:** Current conflict, validation error, failed request, or matched invalidation condition.

Surface tier is determined by task importance, not by component type.

### 9.2 Repeated content

- Repeated evidence, watchlist items, alerts, history, and sources use flat rows with dividers.
- Do not put every repeated row inside its own rounded card.
- Keep numeric values aligned and use tabular figures.
- Put row actions at the trailing edge on desktop and after row content on mobile.

### 9.3 Charts

- Give every chart a visible title, selected range, units, and textual summary.
- Label current or decision-relevant values directly.
- Use neutral grids and one emerald primary series.
- Use risk color only for meaningful conflicting or negative evidence.
- Recalculate labels and ticks responsively; never scale down unreadable fixed charts.
- Chart tooltips must include date, value, provenance, and relevant freshness/origin state.

### 9.4 Controls

- Minimum target: 40px.
- Labels sit above form fields unless a compact segmented control is self-explanatory.
- One control group owns one primary action.
- Use tactile pressed feedback without decorative looping motion.
- Disable controls only with a visible reason or request state.

### 9.5 Disclosures

- Disclosure labels state both owner and current state, for example `Macro context · Non-scored`.
- Methodology, limitations, and long supporting detail may start collapsed.
- Primary conflict, primary caveat, error, or stale state must not start hidden.

## 10. Interaction States

### 10.1 Loading

- Use skeletons that match the owned content geometry.
- Keep stable route identity, controls, and prior valid content where truthful.
- Do not replace a complete prior Market snapshot with an empty full-page loader during refresh.

### 10.2 Empty

- Name what is empty.
- Explain why it may be empty.
- Offer the smallest valid next action, such as broadening a filter or adding a watchlist record.
- Do not invent placeholder evidence or sample records inside an authenticated or persisted workflow.

### 10.3 Error

- Place the error inside the surface that owns the failed request.
- State whether prior data remains visible and whether it may be stale.
- Keep retry beside the error when retry is safe.
- Do not describe one failed provider or request as whole-system failure.

### 10.4 Stale and partial

- Show the value when it remains useful, with date and stale/partial qualification adjacent.
- Keep missing, stale, conflicting, assumption, and unsupported states semantically distinct.
- Never convert unavailable evidence to zero or neutral.

### 10.5 Save and mutation feedback

- Distinguish saving, saved, not saved, conflicted, and storage unavailable.
- A successful UI transition must not imply persistence until the owning boundary confirms it.
- Preserve a recoverable cancel path for unsaved Research edits.

## 11. Accessibility

- Target WCAG 2.1 AA where practicable.
- Preserve native heading hierarchy, list semantics, tables, definition lists, and form labels.
- Maintain visible keyboard focus and logical document order.
- Provide text summaries for charts.
- Pair semantic color with labels or shapes.
- Respect reduced-motion preferences.
- Do not place essential explanations only in hover states.
- Keep body copy at 14px or larger where possible and never below 12px for essential content.
- Verify controls, disclosures, tabs, menus, chart ranges, and review actions by keyboard.

## 12. Motion

- Motion is functional and restrained.
- Use short transform/opacity transitions for selection, disclosure, and layout continuity.
- Do not animate score changes in a way that implies live-market urgency when the data is snapshot-based.
- Do not use perpetual decorative animations.
- Never animate layout through `top`, `left`, `width`, or `height` when a transform can express the same interaction.

## 13. V7 Compatibility Contract

V7 must preserve:

- Market score and mode semantics.
- Driver contributions, conflicts, history, provenance, and calibration behavior.
- US/MY market distinctions.
- Research decision states and checklist rules.
- Authored thesis and journal ownership.
- Existing API request and response contracts.
- Existing persistence and browser-local boundaries.
- Workspace, ticker, tab, filter, density, and handoff URL state.
- Unknown query parameters when current navigation preserves them.
- Deep links and browser-history behavior.
- Analytics privacy boundaries.
- Accessibility and responsive behavior.

V7 must not require rewriting domain services merely to fit the layout.

## 14. Proposed Implementation Sequence

### Phase 1: Contract and prototype refinement

- Approve this V7 contract.
- Refine the Market prototype's score ownership, chart height, and mobile attention rows.
- Produce and approve a Research Overview prototype using the same shell.

### Phase 2: Shared V7 foundation

- Add isolated V7 routes and components.
- Add route-scoped V7 tokens and surface helpers.
- Reuse existing installed typography and icon capabilities.
- Keep V6 tokens and routes unchanged.

### Phase 3: Market V7

- Compose V7 presentation from existing Market data and domain helpers.
- Preserve current configuration, refresh, alerts, calibration, context, and methodology behavior.
- Verify US and MY modes before promotion.

### Phase 4: Research V7

- Implement the shared shell and selected-security document first.
- Port Research workspaces by intent group without changing identifiers or deep links.
- Preserve review, evidence, persistence, queue, portfolio, and notification boundaries.

### Phase 5: Parity and promotion

- Run behavior-parity and visual QA.
- Record intentional V7 differences.
- Promote `/` and `/research` only after explicit approval.
- Retain V6 routes as rollback references until the removal policy is separately approved.

## 15. Verification Contract

V7 visual work is incomplete without real Chromium verification at:

- 1280px desktop.
- 768px tablet.
- 375px mobile.
- Light and dark themes.

Every affected surface must verify:

- No document-level horizontal overflow.
- No overlap or clipped text.
- Correct reading order.
- Visible active navigation and filters.
- Keyboard-operable controls and disclosures.
- Loading, empty, stale/partial, error, and success states relevant to the surface.
- Console and page errors: none introduced.
- Failed same-origin requests: none unexplained.

Market parity must additionally cover:

- US and MY modes.
- Standard and contrarian interpretation.
- Social-source enabled and disabled states.
- Initial load, manual refresh, stale-response protection, and refresh failure.
- Score history, change attribution, calibration, non-scored context, and alerts.

Research parity must additionally cover:

- All seven primary sections and their workspace mapping.
- Ticker, workspace, tab, filter, density, and handoff URL restoration.
- Watchlist selection and mobile ticker navigation.
- Read-only journal, edit, cancel, save, conflict, and history behavior.
- Evidence, queue, portfolio, backup, notification, and storage-unavailable boundaries applicable to the changed surfaces.

## 16. Acceptance Criteria

V7 is ready for route promotion only when:

1. A user can identify the Market posture, strongest support, strongest conflict, freshness, and date from the first viewport.
2. A user can identify the selected Research security, decision, reason, thesis, invalidation, next gap, and owning review action without searching across unrelated panels.
3. Market and Research feel like one product while retaining distinct top-down and bottom-up workflows.
4. Calm visual treatment does not hide missing, stale, conflicting, or partial evidence.
5. V7 preserves relevant V6 behavior and data meaning.
6. Desktop, tablet, mobile, keyboard, light theme, dark theme, and relevant runtime states pass the verification contract.
7. Promotion and rollback paths are documented and separately approved.

## 17. Open Design Decisions

- [ ] Confirm whether the Market score remains a dominant summary surface or integrates more tightly into the posture region.
- [ ] Confirm the final Market chart height after testing real annotations and the evidence-rail content range.
- [ ] Approve the Research Overview prototype before generalizing V7 surfaces across all Research workspaces.
- [ ] Confirm whether a third contextual evidence rail improves any Research detail tab; default remains a two-column watchlist/document layout.
- [ ] Validate Source Sans 3 and Roboto Mono against the V7 visual direction before considering a separate typography change.
- [ ] Validate the information density with real long titles, missing evidence, stale states, and Malaysia-specific data before freezing component dimensions.
