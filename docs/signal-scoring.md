# Signal Scoring Reference

This dashboard is a decision-support tool. It summarizes indicator agreement and market regime context; it does not measure forecast accuracy or produce financial advice.

## Current Score Meaning

The composite score is a 0-100 sentiment and momentum index.

- `0-19`: extreme bearish pressure
- `20-39`: bearish pressure
- `40-64`: neutral or mixed
- `65-84`: bullish pressure
- `85-100`: extreme bullish pressure

Mode changes the interpretation:

- `standard`: high score supports momentum/trend-following.
- `contrarian`: high score means crowding/greed risk; low score means fear/opportunity risk.

The visible score-zone bar must stay mode-aware:

- `standard`: `0-39 Negative`, `40-64 Mixed`, `65-84 Positive`, `85-100 Strong positive`.
- `contrarian`: `0-39 Low risk`, `40-64 Elevated`, `65-84 Cautionary`, `85-100 Extreme risk`.

These are current model breakpoints only. They are not validated return thresholds and should not be treated as empirical forward-return claims until backtesting exists.

## Current Base Weights

US:

- VIX: 35%
- Social sentiment: 20%
- Put/call ratio: 10%
- AAII: 20%
- NAAIM manager exposure: 10%
- BofA SSI placeholder/manual input: 5%

Malaysia:

- USD/MYR volatility proxy: 25%
- Social sentiment: 15%
- News sentiment: 50%
- AAII: 10%

Weights are proportionally redistributed across enabled sources. If a source is missing or disabled, its base weight is redistributed to active sources.

## High-Volatility Override

For US signals, when VIX is above `30`, the engine treats volatility stress as the dominant regime:

- VIX: 85%
- Social sentiment: 15%
- AAII: 0%
- BofA SSI: 0%

The intent is to avoid slow sentiment surveys overwhelming acute volatility stress.

## AAII Interpretation

AAII is stored as bullish percentage, not bearish percentage. It is normalized as:

- 20% bullish = fear/low score
- 50% bullish = greed/high score

This is deliberately mode-aware:

- In `standard` mode, high AAII bullishness can confirm momentum, but extreme bullishness is also a crowding risk.
- In `contrarian` mode, high AAII bullishness is cautionary; low bullishness is a potential opportunity because fear can precede rebounds.

AAII is weekly. The survey date should be visible whenever AAII contributes to the signal.

## Put/Call Interpretation

The US put/call ratio is a daily tactical options-positioning input sourced from Cboe daily market statistics.

- Low put/call means call-heavy optimism or complacency and maps to a higher greed/momentum score.
- High put/call means fear or hedging and maps to a lower score.

This input can disagree with broader sentiment because options positioning may reflect hedging demand rather than pure directional conviction.

## NAAIM Interpretation

NAAIM manager exposure is a weekly positioning input. It measures reported equity exposure among active managers.

- Low exposure maps to fear/risk-off positioning.
- High exposure maps to greed/crowding or strong momentum participation.

It is scored for US signals, but should be interpreted as weekly positioning rather than an intraday trigger.

## Buffett Indicator Backdrop

The Buffett Indicator is exposed as a non-scored valuation backdrop. It compares domestic nonfinancial corporate equity market value against GDP using FRED pages.

It is intentionally not part of the daily composite score because valuation moves slowly and should not override tactical evidence by itself.

## Main-page Macro Context

The Main page may show additional context that is deliberately excluded from the composite score:

- US 10Y–3M Treasury spread: daily medium-term curve context with an inversion state. It is not a standalone recession predictor.
- Chicago Fed NFCI: weekly financial-conditions context. Positive values are tighter than average; negative values are looser than average.
- Equal-weight versus cap-weight S&P 500 returns: a one-year breadth/concentration comparison, shown as relative return context rather than a score input.
- Malaysia native rates: BNM MGS 3Y/10Y curve, OPR, MYOR, and short-term bill readings. US curve and NFCI proxies are not applied to the MY view.

These cards must remain visibly labeled as context-only and include their report or refresh date and source links.

The US Research Index Test is also non-scored context. It compares a research ticker's one-year return with VOO using adjusted closes when available; it informs the manual `betterThanCashOrIndex` review question but does not alter signal scores or automatic research decisions.

## Historical calibration

Persisted daily score snapshots are compared with subsequent VOO returns for US mode and FBM KLCI closes for Malaysia mode at approximately 7 and 30 calendar days. Results remain separated by market, Momentum or Contrarian mode, social-source setting, and the documented score zones. Directional alignment follows the tier saved for that mode; mixed snapshots have no directional hit-rate claim.

For US dates before complete snapshot logging began, the calibration reconstructs current-model scores from stored VIX and social-sentiment readings. These partial reconstructions preserve the current model's neutral contribution for unavailable put/call and weekly institutional inputs. They are identified separately from observed snapshots, never replace an observed score on an overlapping date, and must retain their coverage note in the UI. Malaysia calibration currently uses observed snapshots only because the legacy rows do not contain the native historical inputs needed for a defensible reconstruction.

The visible US score history may also contain dates labelled Backfilled. Backfilling uses the latest source reading available on or before the target date, carries market-close readings across non-trading days, and never overwrites an observed snapshot. Retained historical social readings are used when present; otherwise social-enabled history uses raw sentiment `0` (normalized score `50`). Social-disabled history omits that driver and preserves its configured weight as neutral reserve. Coverage notes must identify historical, carried, or unavailable sources. Backfilled remains distinct from observed in machine-readable provenance and calibration.

Calibration uses the newest 1,000 snapshots within the benchmark's ten-year window and an explicitly revalidated one-hour cache. This keeps the interactive signal response bounded while allowing completed forward-return observations to advance.

The long-range US timeline may additionally include one limited reconstruction per week from 2020 onward. These rows use the historical VIX close with social and every unavailable positioning input held at the documented neutral contribution. They carry `long_range_reconstruction_version: 1`, `cadence: weekly`, and `validation_eligible: false` in snapshot metadata. They extend only the synchronized score-versus-VOO timeline; forward outcomes, score-zone statistics, mismatch cases, evidence levels, and the unconditional baseline must exclude them. The benchmark and snapshot lookup use a ten-year provider window so the `3Y`, `5Y`, and `All` timeline ranges can display the stored context.

The UI withholds outcome statistics until a zone has at least five eligible observations. A directional sample is not labelled established until it has at least 20 eligible outcomes including at least five observed scores; reconstruction-only evidence remains preliminary regardless of its row count. A concise current-zone summary shows one-week and one-month median return, positive-period frequency, sample size, observed-versus-reconstructed provenance, the all-period baseline, and the existing evidence level. The detailed Historical calibration area provides synchronized score and rebased-benchmark timelines, raw score-to-forward-return plots, one combined score-zone table, mechanically selected aligned and mismatched 30-day cases, and methodology. Raw plots distinguish observed from reconstructed scores and draw current-zone and all-score median references. The all-score baseline is calculated from the underlying forward returns, never by averaging zone medians, and its difference remains descriptive rather than a claimed predictive edge. Mismatch cases are ranked from all eligible observations by absolute subsequent move rather than curated manually; neutral cases require an absolute 30-day move of at least 5%. Observed provenance is explicitly not treated as out-of-sample validation, and the UI must keep out-of-sample status unavailable until a fixed-model holdout or rolling evaluation exists. These are overlapping historical observations without transaction costs, not a backtest or forecast, and the limitation must remain visible wherever the calibration is rendered.

## Signal Alignment Meaning

Signal alignment means indicator agreement only. It is not a probability that the read will be correct.

- High signal alignment: most active indicators agree.
- Moderate signal alignment: some agreement with meaningful disagreement or neutral components.
- Low signal alignment: few sources, low agreement, or unreliable coverage.

The dashboard may still use `confidence` as an internal data-field name for backward compatibility, but visible UI should describe this as signal alignment.

## Freshness Rules

Current stale warning behavior treats a component as stale when `last_updated` is more than 14 days old. This is acceptable for weekly AAII but should be tightened per source later:

- VIX and index breadth: live/request-time or clearly timestamped.
- Put/call ratio: daily.
- Social feeds: live to 15 minutes.
- AAII: weekly, normally Thursday release.
- NAAIM: weekly.
- Buffett Indicator: quarterly / strategic context.

## Article Feed Role

The article/feed section is context. It may show sources that also contribute to social/news sentiment, but the cards themselves are not separately weighted as individual score components.
