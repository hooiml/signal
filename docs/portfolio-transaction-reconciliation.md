# Portfolio Transaction Reconciliation

## Purpose

Signal can compare the accepted browser-local transaction history with the independently accepted browser-local holdings snapshot. The comparison is derived in memory and read-only. It does not replace either source and is not a brokerage ledger, tax-lot engine, performance report, entitlement calculation, or order surface.

Both validated version-1 snapshots are required. Invalid or unavailable browser storage fails closed.

## Exact Identities

Position comparison uses:

```text
normalized account label + market + symbol + currency
```

Cash comparison uses:

```text
normalized account label + currency
```

Accounts and currencies are never combined. A security appearing in more than one currency is shown as a conflict rather than converted or merged.

## Derivation Rules

Position quantity:

- `buy`: add explicit quantity;
- `sell`: subtract explicit quantity;
- every other transaction type: no quantity effect.

Cash:

- `sell`, `dividend`, and `deposit`: add explicit amount;
- `buy`, `fee`, `tax`, and `withdrawal`: subtract explicit amount.

The importer already requires positive amounts. Direction comes only from the transaction type. Signal does not infer whether a broker amount is gross, net, fee-inclusive, settled, or converted.

Quantity is rounded to eight decimal places for comparison. Cash is rounded to two decimal places within its declared currency.
If either calculation cannot remain within JavaScript safe-integer precision at that scale, reconciliation fails closed and leaves both snapshots unchanged.

## Statuses

- **Match:** derived and snapshot values are equal within the documented precision.
- **Difference:** both sources exist but disagree. The displayed difference is snapshot minus derived.
- **Opening history needed:** a snapshot value has no matching history, or imported sells/outflows require an earlier opening value.
- **Transactions only:** imported activity derives a non-zero value with no matching snapshot row.
- **Closed / zero derived:** transaction-only activity nets to zero.

An exact match proves arithmetic alignment only. It does not prove that the imported history is complete.

## Coverage And Limitations

The surface always shows the first and last imported transaction dates. Differences may reflect missing history before that range.

The following remain unsupported and are never inferred:

- stock splits, reverse splits, mergers, spin-offs, symbol changes, transfers, and reinvestments;
- opening quantities or cash balances;
- settlement timing and pending activity;
- gross-versus-net broker amount conventions;
- currency conversion or foreign-exchange rates;
- cost basis, realized or unrealized return, performance attribution, tax lots, tax treatment, or entitlements.

## Privacy And State Ownership

Reconciliation reads only `signal-portfolio-holdings-v1` and `signal-portfolio-transactions-v1` in the current browser. It writes no reconciliation snapshot. Holdings and transactions are not changed, uploaded, logged, added to URLs, included in analytics, copied into research backup/sync, placed in Cache Storage, or sent to a provider.

## Verification

Run:

```powershell
npm run test:research
npm run qa:portfolio-reconciliation -- --base-url http://127.0.0.1:3000
```

Repository-wide completion still follows `docs/TESTING.md`.
