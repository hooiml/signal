# Explicit Portfolio Factor Exposure

Signal stores version-1 factor assumptions that the user deliberately declares for one exact research record, then joins those assumptions to the browser-local imported holdings snapshot. The feature reveals concentration in shared assumptions. It is not a factor model, beta estimate, correlation study, forecast, expected-return model, or recommendation.

## Fixed Version-1 Taxonomy

| Factor ID | Visible meaning when the factor rises |
|---|---|
| `interest-rates` | Broad borrowing-cost and discount-rate pressure rises. |
| `usd-myr-fx` | One USD buys more MYR. |
| `oil-energy-prices` | Broad oil, fuel, and energy prices rise. |
| `semiconductor-cycle` | Semiconductor demand, utilization, inventory clearing, and pricing strengthen. |
| `ai-data-center-capex` | AI compute and data-center capital spending rises. |
| `china-growth` | Broad Chinese economic and business activity strengthens. |
| `consumer-demand` | Broad discretionary and household spending demand strengthens. |
| `credit-conditions` | Credit becomes more available/easier, not tighter. |
| `broad-volatility` | Broad market volatility and risk aversion rises. |
| `commodity-input-costs` | Broad non-energy commodity and operating input costs rise. |

Version 1 does not accept custom factor names, numeric betas, formulas, prose extraction, provider classifications, or automatic sector mappings.

## Record Contract And Persistence

`ResearchRecord.factorAssumptions` is a version-1 set:

```text
{
  version: 1,
  migrationState: "current" | "migrated-empty" | "invalid-recovered",
  assumptions: [{
    factor,
    direction: "benefits-when-rises" | "harmed-when-rises" | "mixed",
    materiality: "low" | "moderate" | "high",
    evidenceNote,
    evidenceDate,
    evidenceId
  }]
}
```

- A record retains at most ten assumptions and at most one assumption per fixed factor.
- `evidenceNote` is optional text capped at 500 characters.
- `evidenceDate` is a required valid `YYYY-MM-DD` calendar date.
- `evidenceId` is optional. When set or changed, it must identify an accepted evidence finding or primary-document citation currently owned by the same research record.
- An evidence item removed later leaves the prior ID visibly unavailable. The assumption remains readable, but the next factor save must select a current same-record ID or remove the link.
- A missing legacy set migrates to an empty `migrated-empty` set. A malformed persisted set recovers to an empty `invalid-recovered` set so the UI can repair it explicitly.

The set is stored inside version 3 of the existing `accepted_evidence` JSONB bundle beside accepted findings and document citations. No database column or new server endpoint is added. A `mode: factors` update validates and replaces only the factor set under the existing optimistic revision; it cannot mutate thesis fields, checklist, decision journal, position plan, monitoring rules, accepted evidence, document citations, or review history. A later full review copies the current factor set into its immutable snapshot.

Factor assumptions therefore share the current encrypted research backup/sync boundary. They are plaintext only wherever the existing research record is already plaintext. Imported holdings remain browser-local and are never added to research persistence, backup, sync, or an API.

## Exact Holdings Join

The matrix restores the accepted version-1 local holdings snapshot and reuses the existing reconciliation rule:

```text
research identity = exact normalized market + exact normalized symbol
```

Account labels, sector, issuer names, descriptions, prose, market scores, and AI output never create a match or an assumption. Unmatched holdings stay visible. A matched record with no factor assumption remains `Not declared`, never neutral.

Rows are imported actual holdings. Columns follow the fixed taxonomy order but appear only when at least one visible matched holding has a declared assumption. Cells show direction plus materiality. The saved evidence date, note, and link availability are disclosed on demand.

## Aggregation And Coverage

Every calculation is isolated to one exact account label and currency. USD and MYR are never combined and Signal does not invent an FX rate.

For one account, currency, factor, and direction:

```text
direction share =
  known current market value explicitly declared in that direction
  / all known current holding value in the same account and currency
```

Factor value coverage uses the same denominator:

```text
known-value coverage =
  known current market value with any declared assumption for that factor
  / all known current holding value in the same account and currency
```

Count coverage is reported separately as declared holdings / all holdings. Missing-price positions remain in the count denominator and missing-price count but are excluded from value numerators and denominators. Unmatched and matched-with-no-assumption counts remain explicit. Cash is not assigned any factor.

The UI may say, for example, “66.7% of known USD holding value is explicitly marked harmed when interest rates rise,” only when it also shows the currency numerator, denominator, value coverage, and holding-count coverage. It does not call the result beta, sensitivity, risk forecast, or expected return.

## Queue, Privacy, And Product Boundaries

- `Edit assumptions` selects and focuses the ticker’s factor editor inside Portfolio.
- An uncovered matched holding can create one pending `factor:<symbol>:coverage` Queue task.
- A direction at or above 50% of known account-currency value can explicitly create a stable `factor:<symbol>:<factor>` Queue task.
- Queue creation uses the existing browser-local bounded/deduplicated contract and never writes research.
- Symbols, account labels, currencies, holdings, quantities, weights, factors, directions, materialities, notes, dates, evidence IDs, numerators, and denominators are excluded from product analytics.
- No brokerage/order action, AI extraction, sector inference, correlation/beta estimation, forecast, or new provider request is added.
