# Research Alerts

The Alerts workspace evaluates current conditions for tickers already shown in the research watchlist. It remains the source-of-truth review surface and is not an automatic trading system.

## Background delivery

`GET /api/research/notifications/deliver` runs daily through Vercel Cron and can send the current attention digest to an operator-configured HTTPS webhook. Configure `RESEARCH_NOTIFICATION_WEBHOOK_URL`, `RESEARCH_NOTIFICATION_WEBHOOK_SECRET` (at least 16 characters), and `CRON_SECRET`; `APP_URL` optionally controls the deep link in the payload. If webhook configuration is absent, the job exits successfully with `reason: not-configured` and sends nothing.

The JSON event type is `signal.research.digest.v1`. Deliveries include no credentials and are signed with `X-Signal-Signature: sha256=<hmac>`. The date-scoped SHA-256 key is sent as both `Idempotency-Key` and `X-Signal-Delivery-ID`; receivers must deduplicate that key because delivery is at least once. A pending reservation can be reclaimed after a 15-minute lease, a successful request is marked delivered, a failed request is released for retry, and records older than 90 days are removed. The job evaluates the full watchlist in 50-name provider batches; the payload sends at most 20 attention items and reports total available and omitted counts. Use authenticated `?dryRun=true` mode to inspect the exact payload without reserving or sending it.

This is an opt-in integration surface for email automation, chat tools, or a private notification relay. The receiving endpoint owns recipient consent, quiet hours, and final channel delivery.

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
