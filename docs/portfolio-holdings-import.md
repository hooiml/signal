# Read-Only Portfolio Import

Signal accepts a browser-local holdings snapshot for portfolio context. This is not a brokerage ledger, transaction history, tax-lot system, or order-entry surface.

## Canonical CSV

Download the template from Research → Portfolio. The canonical columns are:

```text
account_label,row_type,symbol,market,quantity,average_cost,currency,cash_balance
```

- `row_type` is `holding` or `cash`. A missing `row_type` is treated as `holding` only when the canonical holding fields are present.
- Holding rows require `account_label`, `symbol`, `market`, `quantity`, `average_cost`, and `currency`.
- Cash rows require `account_label`, `row_type=cash`, `currency`, and `cash_balance`; holding-only cells stay blank.
- `market` must be explicit `US` or `MY`. `currency` must be explicit `USD` or `MYR`.
- Symbols use the existing 1–20 character uppercase `A-Z`, `0-9`, `.`, and `-` contract. Provider-qualified symbols such as `1155.KL` are preserved, not rewritten.
- The only aliases accepted are `account`/`account_name`, `type`, `ticker`, `shares`/`units`, `avg_cost`/`average_price`, `ccy`, and `cash`. Two columns resolving to the same canonical field are rejected as ambiguous.

The client rejects files over 1,000,000 bytes or 500 data rows, non-finite or negative numbers, zero holding quantities, unsupported columns, malformed quoted fields, invalid market/currency values, and duplicate exact identities. Duplicate rows are rejected as a group. Spreadsheet exports neutralize cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return.

## Preview And Save Contract

The complete preview shows valid holdings, valid cash rows, rejected rows, duplicate identities, and the exact add/skip/replace effect. Saving requires explicit confirmation.

- `Add only` is the default. Existing matches are skipped.
- `Replace exact matches` requires a separate acknowledgement when any match exists.
- A holding identity is case-normalized account label + exact market + exact normalized symbol.
- A cash identity is case-normalized account label + exact currency.
- Unrelated holdings and cash balances are never deleted by an import.

Only the validated version-1 snapshot is stored. Raw CSV contents, file names, broker credentials, and provider secrets are not persisted. The user supplies a non-sensitive provenance label; every accepted row retains that label and import timestamp.

## Portfolio Meaning And Limits

Imported actual holdings remain separate from research position plans. Exact market+symbol matches may reuse the current research quote; unmatched rows stay visible and are never guessed. Cost basis and cash are totaled by currency. Signal does not invent an FX rate or combine USD and MYR totals. A missing price leaves market value and actual weight unavailable rather than treating it as zero.

This release is local-only. Holdings are excluded from research backups, the encrypted remote research vault, plaintext APIs, analytics events, and all provider requests. There is no brokerage OAuth/API connection, credential storage, live trading, order placement, tax-lot accounting, or transaction history.
