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

- Desktop uses a fixed 220px watchlist rail and flexible research document.
- The watchlist rail and research detail share one themed workspace shell with 12-16px internal padding.
- A responsive divider separates the watchlist from the detail, while the watchlist heading keeps 16px separation before the ticker list.
- Mobile turns the watchlist into a horizontal strip above the document.
- The V2 Light/Dark segmented control sits beside the watchlist heading.
- Overview uses a thesis and decision split followed by a full-width snapshot.

## 4. Component Rules

- Panels preserve V6's 8px radius while using V2 colors, borders, blur, and shadows.
- Watchlist rows stay flat; only the selected row receives the V2 emerald treatment.
- Status language remains Ready, DCA, Wait for price, Watch, and Avoid.
- Theme preference uses the same local-storage key as Research V2.
- Market V6 reuses the V2 command header and places four scan targets below the decision posture: score, regime, alignment, and combined data quality.
- Market evidence is sorted by absolute contribution. Conflicting indicators are flagged inline instead of repeated in a separate panel.
- Score history is the dominant chart. Supporting context is compact and explicitly separated from weighted evidence.
- Detailed trust, limitations, and methodology live in disclosure panels below the primary briefing.

## 5. Responsive And Accessibility Constraints

- Body copy never drops below 12px; primary research text is 14px or larger.
- Controls maintain a minimum 40px touch target.
- Tabs and the mobile watchlist scroll horizontally without widening the page.
- Positive, waiting, and risk states use text plus color.
- The theme switch exposes an accessible mode-change label.
- Market tables collapse to readable stacked rows on narrow screens with no required horizontal scrolling.
- Charts include textual summaries and do not rely on color alone.
- Visible decision language describes market conditions and conviction; it must not instruct position sizing or claim forecast accuracy.

## 6. Accepted Debt

- Research values still come from the existing static watchlist fixture.
- V6 does not persist thesis edits or checklist changes.
- Market scenario statements are deterministic interpretations of current signal fields, not forecasts or personalized recommendations.

## 7. Story First Market Briefing

- The market screen opens as a short daily briefing rather than a scorecard. Its fixed reading order is: story headline, three evidence chapters, quick read, what changed, then detailed evidence.
- The headline translates the current tier into plain market language. It must retain the existing deterministic posture summary and surface the primary caveat beside it.
- Chapters are generated from the strongest contribution-ranked drivers. Every chapter shows its source name, directional relationship to the majority view, freshness, and a short explanation; conflicting evidence remains visually explicit.
- The Quick Read rail keeps agreement, source coverage, freshness, score, and snapshot time visible without presenting agreement as forecast probability.
- Detailed score history, weighted contributions, market context, limitations, and methodology remain available below the narrative layer. Progressive disclosure may reduce initial density but must not remove evidence.
- On narrow screens the reading order becomes headline, Quick Read, chapters, change comparison, glossary, and details. No narrative panel may require horizontal scrolling.
- Story First uses existing V6 theme tokens and small-radius bordered surfaces. Numbered chapter markers and connecting rules create the narrative sequence; decorative illustrations, financial-terminal density, and new color tokens are not introduced.
