# Signal V4 Decisions

These decisions close the open questions from the Signal V4 handover spec.

## Reliability

Reliability is computed with freshness as a hard cap. Weak always wins over Moderate or Strong.

1. Weak when any source is stale for more than 3 days.
2. Weak when active source count is below 3.
3. Weak when agreement is below 60%.
4. Moderate when any source is recent but not fresh, between 1 and 3 days old.
5. Moderate when active source count is 3 or 4.
6. Moderate when agreement is below 80%.
7. Strong otherwise.

Example: 3 active sources with 1 stale source is Weak.

## Action Labels

Research action labels are deterministic. Editorial overrides are out of scope for V4.

Precedence:

1. Avoid: low thesis strength, failed downside gate, or expensive valuation without high thesis strength.
2. DCA: already owned, high thesis, core quality gates passed, and valuation is not expensive.
3. Ready: checklist count is at least 8, ticker is in its buy zone, valuation is reasonable, and downside is acceptable.
4. Wait: medium or high thesis with at least 6 checklist passes, but valuation is stretched or price is outside the buy zone.
5. Watch: everything else.

`inBuyZone` is a direct data field. It is not inferred from `valuationState`.
`positionState` is a direct data field. DCA requires `positionState: 'owned'`.

## Refresh

`/main-v4` uses polling, not WebSockets.

- Auto-refresh every 5 minutes while the tab is visible.
- Refresh on focus only when the last fetch is older than 5 minutes.
- Manual refresh is always available in the shared header.
- Pause polling while the tab is hidden.

The live dot is green when the latest snapshot is less than 15 minutes old and amber otherwise.

## Watchlist Ownership

The V4 watchlist is fixed by the app, not user-editable. The data includes an `order` field now so a future reorder/edit flow can be added without changing the render contract.

## Full Analysis Loading

Full analysis data is available on ticker select but starts collapsed. Clicking the CTA expands it locally. Changing the selected ticker intentionally collapses full analysis again.

The URL stores only the selected ticker, for example `/research-v4?ticker=MSFT`. Expanded analysis state is local session UI state and does not persist on reload.
