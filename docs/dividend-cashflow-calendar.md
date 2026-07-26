# Dividend And Cash-Flow Calendar

Signal combines confirmed dividend evidence and explicit cash planning in the existing Research Calendar workspace. The feature is a browser-local planning aid. It is not a brokerage ledger, entitlement system, tax calculator, forecast, transaction simulator, or execution surface.

## Local Version-1 Contract

`signal-dividend-cashflow-v1` stores at most 200 current events and 500 bounded revision entries:

- dividend events: exact account, currency, market, symbol, declared or user-confirmed status, supplied declaration/record/ex/payment dates, optional amount per share, notes, and source provenance;
- cash-flow events: exact account, currency, planned date, positive amount, inflow/outflow direction, and one fixed category: contribution, withdrawal, fee, tax, interest, or other;
- snapshot revision, event revision, created/updated times, and prior values for create/edit/remove history.

Every mutation checks the expected snapshot revision against the latest browser value. A stale tab fails with a conflict instead of overwriting newer local state. Removing an event removes it from the current list while retaining its bounded prior value in revision history.

Account labels and currencies are exact filters. USD and MYR are never aggregated and Signal never invents or requests an FX rate. Planning events do not update the imported holdings snapshot, cash balances, research records, transactions, backups, encrypted sync, or orders.

## Official Provider Discovery

Only an imported holding with an exact market+symbol research-record match is eligible for provider discovery. Version 1 supports US tickers through Nasdaq's official dividend-history surface, an existing provider already used by Signal.

- The browser requests `/api/research/dividends/[symbol]` with the validated ticker only.
- The server sends only that ticker to Nasdaq. It does not receive account, quantity, currency filter, cash, note, or calculated-income data.
- Requests are capped at the first 20 exact matched US symbols in the selected account/currency, time out after eight seconds, and reuse a six-hour cache.
- The provider parser accepts at most 20 declared cash-dividend rows with a supplied declaration date and at least one supplied ex-date or payment date.
- Missing amount, record date, ex-date, or payment date remains unavailable. `N/A`, malformed, unsupported, and undeclared rows are not inferred.
- Malaysia and unmatched holdings remain manual-only. Signal does not scrape issuer pages or guess alternate symbols.

Provider discoveries remain read-only until the user selects **Confirm / edit** and saves a local event. The saved record freezes the original Nasdaq values, source link, declared status, and fetched-at time beside the editable working fields. Editing those fields never rewrites the frozen provider evidence.

## Illustrative Gross Amount

Signal shows an illustrative gross amount only when both values exist now:

```text
current exact holding quantity × declared amount per share
```

The UI shows the quantity, amount per share, arithmetic, currency, and imported snapshot date. It never uses inferred historical quantity. The result is not tax-adjusted, not an entitlement ledger, not a forecast, and not evidence that the user held the security on an entitlement date. Otherwise the amount remains unavailable.

## Calendar, Queue, And Briefing

- Saved dividend and cash-flow events appear in the same Calendar workspace and follow its 30/90-day and list/date-grouped presentation.
- Events without any supplied dividend date remain visible as `Date unavailable`; they are not placed on an invented date.
- A matched dividend can create one pending browser-local `post-event` Queue review. Confirmed provider events use the stable provider-event identity, so the same declared event does not duplicate across local account records; manual events use their stable local event ID. Neither key contains account or quantity data.
- Upcoming dated local events join the browser-local **Since last visit** event count. The projection contains only nullable symbol, fixed event type, and date. Account, currency, amount, quantity, and notes are omitted.
- Local planning records never enter the signed server-side research digest because that would cross the private browser boundary.

## Privacy Boundary

Holdings, quantities, account names, cash balances, event notes, provider confirmations, calculated income, and local revisions are excluded from:

- product analytics;
- application logs and console messages;
- query strings;
- provider requests;
- research persistence, backup, and encrypted sync;
- signed webhook notifications or any other external request.

The only external market-data request contains the exact validated ticker path. Queue tasks retain the ticker because the Queue already operates on saved research records; they never contain the account, quantity, currency, amount, or note.
