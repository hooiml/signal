# Research Alerts

The Alerts workspace evaluates current conditions for tickers already shown in the research watchlist. It is an on-site monitor, not a notification delivery service or an automatic trading system.

## Conditions

- `Inside buy zone`: current price is within the two numeric bounds saved in `targetBuyZone`.
- `Approaching buy zone`: current price is no more than 3% above the upper bound.
- `Large daily move`: absolute daily change is at least 8%.
- `Below 200-day average`: price is below the long-term moving average.
- `Below 50-day average`: price is below MA50 but not below MA200.
- `Oversold review`: RSI is 30 or lower.
- `Momentum overextended`: RSI is 70 or higher.

Opportunity alerts identify a condition worth reviewing; they do not recommend a trade. Risk alerts sort before opportunity and watch conditions.

## Boundary And Coverage

`POST /api/research/alerts` accepts between 1 and 50 normalized ticker inputs and scans Yahoo data in batches of six. Invalid symbols and markets return `400`. Provider failures degrade per ticker and appear as a coverage warning.

Buy-zone text must contain exactly two positive numbers. Currency symbols, commas, and reversed bounds are accepted. Other prose is treated as an unset zone rather than guessed.
