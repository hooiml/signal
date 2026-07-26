# Pre-Trade What-If Sandbox Contract

Signal provides a version-1, browser-session portfolio simulation over the accepted local holdings snapshot. It is an illustration and review aid, not a recommendation, optimizer, forecast, order ticket, brokerage connection, or execution system.

## Inputs And Bounds

A scenario contains at most 20 explicit legs. Every leg requires:

- an exact account from the accepted holdings snapshot;
- a symbol using the holdings contract's normalized `A-Z`, `0-9`, `.`, and `-` rules;
- explicit `US` or `MY` market and `USD` or `MYR` currency;
- explicit `buy` or `sell`;
- finite positive quantity and assumed price.

Only one leg may target an account + market + symbol identity. Repeated buy, repeated sell, or conflicting buy/sell legs for the same identity are rejected as ambiguous. A sell requires an exact holding in the selected account and cannot exceed its quantity. Short positions are not supported.

The whole basket is atomic for illustration: if any leg is invalid, no leg is applied to the simulated result. Errors remain attached to their authored legs.

## Deterministic Calculation

The accepted holdings snapshot is parsed and copied before calculation. The simulator never mutates holdings, research records, watchlist items, position plans, policy settings, or remote state.

- Buy quantity is added. For an existing position, simulated average cost is `(existing quantity × existing average cost + buy quantity × assumed price) ÷ simulated quantity`.
- Partial sells retain the imported average cost. Full sells remove the simulated position.
- Cash effect is `quantity × assumed price`, negative for buys and positive for sells, inside the exact selected account and currency.
- Negative cash remains visible as a deficit warning. The simulator does not invent funding or block the scenario.
- No FX conversion is performed. No fee, tax, slippage, price, market, sector, currency, or account is inferred.
- Before values use only exact reconciled current research prices. A touched after-position uses its explicit assumed price. Other missing values remain unavailable.

## Coverage, Risk, And Policy

Research reconciliation uses exact normalized market + symbol only. Unmatched positions remain visible but have no inferred sector, research policy evidence, or invalidation evidence.

Each account + currency summary shows cash, known invested value, missing-value count, position weights where coverage is complete, largest position, exact-sector concentration, matched/unmatched coverage, defined downside, portfolio-at-risk, and policy breaches.

Defined downside includes only exact research matches with a finite valuation price and a valid saved invalidation below that price. Missing or invalid downside evidence is excluded and counted. Portfolio-at-risk is unavailable when the account/currency value denominator is incomplete.

The existing investment-policy evaluator is reused with simulated actual weights only where those weights are available. Sector limits are evaluated only for exact known sectors. Evidence coverage, review age, and Ready/DCA valuation rules continue to use the immutable saved research record. Every breach remains advisory.

## Privacy And Lifecycle

Scenario drafts are React session state only. They are not written to local storage, automatically resumed after reload, added to research backup or sync, sent to any API, or included in workflow analytics.

Reset clears only the draft. Optional CSV and Markdown exports contain the authored scenario plus deterministic before/after summaries, neutralize spreadsheet formula prefixes, and state that no orders were sent.
