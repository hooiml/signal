# Portfolio Transaction Import

## Purpose

The Portfolio workspace can import a read-only transaction history for local review. This ledger is separate from planned allocations, actual holdings, research records, and every server-backed feature.

## Canonical CSV

Use these columns exactly once:

```text
transaction_id,account_label,type,date,market,symbol,quantity,amount,currency
```

- `transaction_id`: required stable broker/export identifier; combined with the normalized account label for exact conflict detection.
- `account_label`: required label of 1–80 characters.
- `type`: `buy`, `sell`, `dividend`, `fee`, `tax`, `deposit`, or `withdrawal`.
- `date`: exact `YYYY-MM-DD`, on or after 1900-01-01 and not in the future.
- `market` and `symbol`: required together for buys, sells, and dividends; optional together for fees and taxes; blank for deposits and withdrawals.
- `quantity`: positive and required for buys and sells; blank for every other type.
- `amount`: positive and required. The transaction type defines direction; negative values are rejected.
- `currency`: exactly `USD` or `MYR`.

The importer accepts at most 500 non-empty rows and 1,000,000 UTF-8 bytes. Unsupported or repeated columns fail the whole file. Invalid rows remain visible in the preview and are excluded from saving. Duplicate account/transaction-ID pairs are rejected as a group.

Formula-like cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return are rejected. Exported template text is spreadsheet-neutralized.

## Save Contract

- Every accepted row and every rejected row is shown before save.
- A non-sensitive provenance label is stored on each accepted transaction.
- Add-only is the default and skips exact matches.
- Replace-matching affects only the same normalized account label and transaction ID and requires a separate acknowledgement.
- Unrelated saved transactions are retained.
- The raw CSV is never persisted.
- Invalid or unavailable browser storage fails closed and remains visible.

The versioned snapshot uses the `signal-portfolio-transactions-v1` local-storage key. The store validates its complete shape before both read and write.

## Privacy And Scope Boundary

Transaction rows remain in the current browser. They are not included in research records, encrypted research backup or sync, server APIs, workflow analytics, broker integrations, or order placement. The first version deliberately does not:

- reconcile transactions into holdings or cash;
- infer missing market, symbol, currency, quantity, sign, account, or identifier;
- calculate realized or unrealized returns, fees-adjusted performance, tax lots, cost basis, or corporate actions;
- aggregate USD and MYR or apply foreign exchange rates;
- upload or retain the original CSV.

Clearing site data removes the local ledger. Users should retain their original broker export as the source of record.

## Verification

Run the pure contract regression and consolidated browser check:

```powershell
npm run test:research
npm run qa:portfolio-transactions -- --base-url http://127.0.0.1:3000
```

Repository-wide completion still follows `docs/TESTING.md`.
