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

- VIX: 40%
- Social sentiment: 30%
- AAII: 20%
- BofA SSI placeholder: 10%

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

## Signal Alignment Meaning

Signal alignment means indicator agreement only. It is not a probability that the read will be correct.

- High signal alignment: most active indicators agree.
- Moderate signal alignment: some agreement with meaningful disagreement or neutral components.
- Low signal alignment: few sources, low agreement, or unreliable coverage.

The dashboard may still use `confidence` as an internal data-field name for backward compatibility, but visible UI should describe this as signal alignment.

## Freshness Rules

Current stale warning behavior treats a component as stale when `last_updated` is more than 14 days old. This is acceptable for weekly AAII but should be tightened per source later:

- VIX and index breadth: live/request-time or clearly timestamped.
- Social feeds: live to 15 minutes.
- AAII: weekly, normally Thursday release.

## Article Feed Role

The article/feed section is context. It may show sources that also contribute to social/news sentiment, but the cards themselves are not separately weighted as individual score components.
