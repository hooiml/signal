# Signal V6 Design Contract

## 0. Research Log

- Static reference: user-provided research-page screenshot reviewed on 2026-07-10.
- Theme reference: Research V2 page shell, palette, storage key, and ThemeModeSwitchV2.
- Existing behavior: V5 URL ticker state, checklist scoring, and research data remain intact.
- Market reference: `docs/design/main-v6-dashboard-reference.png`, refined from the generated dashboard draft and critique.
- Market behavior: V2 API payload, configuration controls, signal semantics, and snapshot history remain the source of truth.

## 1. Direction

Research V6 keeps the compact research-notebook layout while restoring the calmer V2 atmosphere. It uses the same emerald-lit grid background and translucent panels in both modes.

Market V6 uses the same atmosphere as a progressive-disclosure briefing. The signature is a decision-posture band followed by a wide history-and-evidence workspace: understand the read first, inspect the model second.

## 2. Theme Tokens

### Light

- Canvas: #f8fafc
- Surface: translucent white
- Border: slate-200
- Primary text: slate-950
- Secondary text: slate-700
- Muted text: slate-500
- Selection: emerald-600 on emerald-50

### Dark

- Canvas: #0b1118
- Surface: #111a23 at 70 percent opacity
- Border: #2a3948
- Primary text: #eef2f7
- Secondary text: #c8d2dd
- Muted text: #9aa8b8
- Selection: emerald-400 with a restrained emerald tint

## 3. Layout

- Market and Research share a 1280px maximum workspace shell with 16px mobile and 20px desktop gutters so route changes preserve the same outer alignment.
- Market and Research share the Signal app header: transparent canvas, a single 0.5px bottom hairline, compact SIGNAL wordmark, primary nav, theme toggle, and route-owned controls in one horizontal command row. Header-only CSS variables map to the V6 border, selection, text, and radius tokens.
- The shared header theme control is an icon-only sliding toggle: a compact bordered track with one thumb that moves between Light and Dark, while its accessible label states the destination mode.
- Desktop uses a fixed 220px watchlist rail and flexible research document.
- The watchlist rail and research detail share one themed workspace shell with 12-16px internal padding.
- A responsive divider separates the watchlist from the detail, while the watchlist heading keeps 16px separation before the ticker list.
- Mobile turns the watchlist into a horizontal strip above the document.
- On narrow screens the Research command header keeps ticker search visible, places market and decision filters behind one explicit disclosure, and keeps snapshot, result count, and theme controls in a compact utility row.
- Discovery, Compare, and Alerts do not repeat Research-only ticker filters; they retain a compact theme control so the active workspace begins near the top of the viewport.
- Research opens with a compact Today inbox above the watchlist-detail shell. The inbox owns one vertical list, keeps the page as the only vertical scroll container, and collapses its summary and filters into a single readable column on narrow screens.
- The V2 Light/Dark segmented control sits beside the watchlist heading.
- Overview uses a thesis and decision split followed by a full-width snapshot.
- US Overview adds a compact Index Test after the thesis and decision split. It compares the selected ticker with VOO over one year, labels the return basis, and remains evidence for review rather than a recommendation or automatic checklist update.

## 4. Component Rules

- Panels preserve V6's 8px radius while using V2 colors, borders, blur, and shadows.
- Watchlist rows stay flat; only the selected row receives the V2 emerald treatment.
- Status language remains Ready, DCA, Wait for price, Watch, and Avoid.
- Compare is a peer workspace, not a nested card: users select up to three watchlist companies and scan one evidence table with explicit unavailable states.
- The research journal exposes both sides of the thesis plus buy, sell, and invalidation triggers already owned by the persisted research record.
- The research journal opens as read-only details of the saved thesis, triggers, decision state, and checklist. Submit review reveals the assisted findings queue and editable fields, while Cancel discards unsaved changes and Save review creates the explicit review snapshot. Every finding links to its supporting Yahoo or SEC fact, labels AI synthesis separately from deterministic evidence, and requires an explicit Add or Dismiss action. Accepted text appends to rather than overwrites existing notes, while a separate accepted-evidence list preserves its source metadata and permits provenance removal before save; checklist and decision state remain manual.
- Review history is an expandable, newest-first timeline below the editor. Each explicit save creates a server-owned snapshot, identifies fields changed from the preceding review, and keeps the evidence links that supported that historical decision state.
- The Today inbox combines deterministic risk and opportunity conditions, upcoming US earnings catalysts, and research reviews older than 30 days. Every item names its source and uses review language rather than trade instructions.
- Today groups attention conditions by ticker so repeated symbols share one thesis summary and one Manage workflow while each condition retains its own category, evidence, source, unread state, and filter membership. The default preview shows one ticker on mobile and two at wider widths before progressive expansion.
- Inbox filters cover All, Action needed, Upcoming, and the recoverable Snoozed queue. Filter counts remain visible, empty states explain whether monitoring is clear or catalyst coverage is absent, and opening an item returns the user to that ticker's Research document.
- Inbox seen state, snooze timing, and the prior-check snapshot persist in the browser only. A changed condition becomes unread again, snoozed items leave the active queue until due, and these controls do not imply background notifications.
- Every inbox item names its deterministic distance from the saved trigger or event. What changed compares the current item signature with the preceding browser-local check; it is orientation for review, not historical market data or trading advice.
- Inbox management closes the review loop without forcing navigation: Reviewed today creates the same server-owned review snapshot as a full journal save, while an optional quick note appends to existing notes and never overwrites them.
- Thesis change context compares only the two latest saved review snapshots and names materially changed journal fields. It must remain visually distinct from live price-condition changes and must say when no prior comparison exists.
- Per-ticker monitoring rules persist with the research record. Users can monitor buy-zone entry, an MA200 break, configurable RSI bounds, earnings proximity, and review age; rules evaluate on Inbox refresh and do not imply background delivery.
- Trend Discovery keeps Leaders capped at ten and places ranks 11-20 behind one full-width Contenders disclosure. Expanded contender rows reuse leader anatomy and state why they missed the lead tier.
- Discovery filters form one compact control band above the evidence table. Sector, risk, trend stage, and valuation selections update the current scan without changing original ranks; active filters expose a match count and Reset command.
- Discovery ownership stays inside the category-and-evidence cell as a compact disclosure. It shows the raw disclosed increase/decrease balance plus up to five dated institutional increases, keeps unavailable coverage explicit on mobile and desktop, and must not alter ranking scores or claim that a disclosed position represents current buying or caused a price move.
- Theme preference uses the same local-storage key as Research V2.
- Market V6 reuses the V2 command header and places four scan targets below the decision posture: score, regime, alignment, and combined data quality.
- Market evidence is sorted by absolute contribution. Conflicting indicators are flagged inline instead of repeated in a separate panel.
- US market briefings may show a Buffett Indicator valuation backdrop after What changed. It is collapsed by default as a native disclosure row, labeled as non-scored context, includes its report date and FRED source links when expanded, and never changes the composite score.
- US market briefings may show a collapsed, non-scored Macro and breadth context disclosure with the 10Y–3M spread, Chicago Fed NFCI, and equal-weight versus cap-weight one-year returns. Malaysia briefings use the same progressive-disclosure pattern for a BNM-native rate panel with MGS 3Y/10Y, OPR, MYOR, and short-term bill context. These cards never change the composite score and must name their update date and source links when expanded.
- Market change attribution compares each driver with the prior daily snapshot and surfaces the three largest contribution shifts beneath What changed.
- Market alerts persist browser-local score, agreement, tier, freshness, and daily-move conditions scoped to the active market, interpretation mode, and social-source setting. They are evaluated on briefing refresh and must not imply background push delivery.
- The market command header exposes one manual briefing refresh command, reports the last successful check time, disables duplicate refreshes while a request is active, and prevents stale responses from replacing a newer market configuration.
- The Quick Read composite score names its largest weighted influence. A visible Why this score section follows What changed and keeps score history beside contribution-ranked weighted evidence.
- Score history is the dominant chart. Forward scenarios follow scored evidence, while valuation, macro/breadth, articles, alerts, glossary, trust, and methodology remain explicitly separated according to whether they affect the score.
- Detailed trust, limitations, and methodology live in disclosure panels below the primary briefing.

## 5. Responsive And Accessibility Constraints

- Body copy never drops below 12px; primary research text is 14px or larger.
- Controls maintain a minimum 40px touch target.
- Collapsed filters expose their state in the disclosure label so users do not need to reopen the panel to remember whether filtering is active.
- Tabs and the mobile watchlist scroll horizontally without widening the page.
- Horizontal research strips use one slim, theme-aware scrollbar treatment; dense comparison tables also name the scroll action on narrow screens.
- Positive, waiting, and risk states use text plus color.
- The theme switch exposes an accessible mode-change label.
- Market tables collapse to readable stacked rows on narrow screens with no required horizontal scrolling.
- Charts include textual summaries and do not rely on color alone.
- Visible decision language describes market conditions and conviction; it must not instruct position sizing or claim forecast accuracy.
- Inbox urgency never relies on color alone: category text, title, detail, source, and the explicit Open research action remain visible to keyboard, touch, and screen-reader users.
- Inbox review and rule controls live behind the existing Manage disclosure, retain 40px targets, expose saving/error/success feedback, and keep a recoverable Cancel path for unsaved edits.

## 6. Accepted Debt

- Watchlist seed symbols and posture values still come from the existing static fixture; Compare evidence is fetched from live research snapshots.
- Saved research reviews persist thesis, bear case, triggers, notes, valuation state, ownership state, checklist changes, accepted source provenance, and the latest 25 review snapshots.
- Monitoring rules are evaluated only while the Research page is open or refreshed; push notifications and scheduled background checks remain out of scope.
- Comparison is point-in-time evidence and does not yet preserve historical comparison snapshots.
- Market scenario statements are deterministic interpretations of current signal fields, not forecasts or personalized recommendations.

## 7. Story First Market Briefing

- The market screen opens as a short daily briefing rather than a scorecard. Its fixed reading order is: story headline, three evidence chapters, quick read, what changed, Why this score, forward scenarios, non-scored market context, alerts, then terms, trust, and methodology.
- The headline translates the current tier into plain market language. It must retain the existing deterministic posture summary and surface the primary caveat beside it.
- Chapters are generated from the strongest contribution-ranked drivers. Every chapter shows its source name, directional relationship to the majority view, freshness, and a short explanation; conflicting evidence remains visually explicit.
- The Quick Read rail keeps agreement, source coverage, freshness, score, and snapshot time visible without presenting agreement as forecast probability.
- Detailed score history and weighted contributions remain visible as primary evidence below the narrative layer. Progressive disclosure is reserved for non-scored context, limitations, and methodology.
- On narrow screens the reading order becomes headline, Quick Read, chapters, change comparison, Why this score, scenarios, context, alerts, terms, and details. No narrative panel may require horizontal scrolling.
- Story First uses existing V6 theme tokens and small-radius bordered surfaces. Numbered chapter markers and connecting rules create the narrative sequence; decorative illustrations, financial-terminal density, and new color tokens are not introduced.
