# Covered Portfolio Attribution

## Purpose

This read-only browser-local view explains only portfolio contribution supported by accepted local evidence. It is not a return calculation, brokerage statement, tax result, forecast, or recommendation.

## Covered Unrealized Price Contribution

A holding is covered only when:

1. its exact account, market, symbol, currency, and quantity match transaction reconciliation;
2. the holdings snapshot supplies an explicit average cost;
3. an exact current watchlist price is available; and
4. the holding currency matches the supported market quote currency.

For covered holdings:

```text
cost basis = quantity × accepted snapshot average cost
known value = quantity × exact current price
unrealized price contribution = known value − cost basis
```

Currency totals include only covered rows, while the denominator shows all holdings. Cash is not included.

## Explicit Transaction Contributions

Dividend, fee, and tax totals are direct accepted transaction amounts grouped by their declared currency. They remain separate and are never combined into a return percentage.

Realized price contribution is unavailable because the current transaction contract has no proven opening lots or tax-lot method. FX contribution is unavailable because there is no explicit FX assumption or approved FX provider. USD and MYR are never combined.

## Exclusions

Signal does not claim:

- total portfolio performance, time-weighted return, money-weighted return, or brokerage return;
- realized gains, tax cost basis, tax treatment, or entitlements;
- FX contribution or converted cross-currency totals;
- split, merger, transfer, reinvestment, or other corporate-action treatment;
- predictive value or investment recommendation.

Unsafe decimal arithmetic fails closed. Holdings, transactions, research, analytics, APIs, backup/sync, and Cache Storage are never mutated by attribution.

## Verification

```powershell
npm run test:research
npm run qa:portfolio-attribution -- --base-url http://127.0.0.1:3000
```
