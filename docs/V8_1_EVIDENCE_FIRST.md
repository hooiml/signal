# Signal V8.1 Evidence-First UI Enhancements

Status: Phase 1 and Phase 2 implementation branches are under review (draft PRs #16 and #17). Do not treat these branches as deployed production behavior until tested and merged.

## Goals

Maintain a research tool, not a trading terminal. The priority order is: current reading, strength of evidence, what changed, and deeper investigation. Existing Research Memory, replay isolation, context inspector, and provenance remain separate sources of truth.

## Phase 1 — usability and loading

- Keep V8 version links and demo access in the V8 footer; retain V6 and V7 navigation behavior.
- Keep required PWA offline and update alerts prominent, but treat optional install notices as secondary.
- Render focus-only skip links visibly when focused.
- Use structural Market skeletons for missing current responses; retain valid same-configuration snapshots and timestamps while refreshing.
- Show scored indicator cards first, with missing configured inputs disclosed below rather than placeholders taking grid space.
- Compress zero-input and unsupported financial assessments without hiding source reasons or failed refresh state; place Research security search above the selected result header.
- Preserve URL Market context when entering Research, including the case where the saved list has no matching market securities.

## Phase 2 — score, coverage and historical context

- Derive active versus neutral-fallback weight from the service's \`metadata.coverage_adjustment\`.
- Determine the configured denominator from the same market weight registry and high-volatility rule as the calculator; exclude zero-weight context inputs.
- Partition observed scored weight into fresh and stale only when each active input's observation date and registry cadence threshold can be verified. A retrieval-only timestamp is **unknown**, never fresh.
- Verify \`fresh + stale + fallback = 100%\` using unrounded weights and a small floating-point tolerance; round only labels. If the three-way partition cannot be verified, display **scored versus fallback**, and explicitly disclose the unavailable freshness split.
- Promote the score + weight coverage + leading reported drivers above methodology and notices. The two preview drivers are not necessarily a complete reconciliation of the score delta; preserve all drivers in "What changed".
- Score history is zoomed to the returned values (snapped to tens inside 0–100, at least 40 points tall, always including the neutral band) and labels its axis range; keep neutral **score-tier** reference lines from \`src/lib/market-score-thresholds.ts\`. The separate market-regime label still depends on volatility and market breadth; do not present score tiers as its precise regime thresholds.
- Preserve the existing solid observed/dashed reconstructed line convention. Do not encode coverage with the same stroke styles.
- Current-snapshot coverage may be displayed only if the selected date matches the current observed snapshot. Historical points without original coverage metadata must show "Historical source-weight percentage unavailable for this point."
- Never use today's weights or source ages to reconstruct past snapshot evidence.

## Deferred or explicitly outside this slice

- A new cache layer, provider substitutions, extra market widgets, external news ranking, artificial coverage cutoffs, financial scoring methodology changes, and retroactive reconstruction of archived weights.
- Price history derivatives and the richer selected-security Research journey may be added in a separate audited slice after testing provider/corporate-action conventions.

## Acceptance

- \`npm run lint\`, \`npm run typecheck\`, \`npm run harness\`, and \`npm run build\` pass.
- Browser fixture checks at desktop/tablet/mobile widths verify layout, keyboard navigation, no overflow, failure/partial-loading behavior and no fictional provenance.
- Existing chart and Research behaviors remain functional, or tests are explicitly updated with a justified behavior change.

## 2026-10-19 readability follow-up

- Market: the score chart axis zooms to the data (see above); the Momentum/Contrarian toggle carries a one-line reading of each mode; wider-market context names each tracked index and its latest move and sits beneath the chart. It remains separate from the score.
- Research: provider-returned price context (52-week range, 50/200-day averages, RSI, 20-day average volume) is shown beneath the quote when supplied, and hidden when absent. It is descriptive, not a trading signal.
- Current assessment tolerates up to 10 minutes of server-ahead clock skew before treating a classification or retrieval as future-dated.
- The optional install offer remembers "Not now" (or a browser dismissal) for 30 days.
