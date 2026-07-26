# Historical Valuation Evidence

## Feasibility decision

Task 8 separates three capabilities because a historical price series alone is not a historical valuation series.

| Capability | Status | Evidence and boundary |
| --- | --- | --- |
| Historical prices | Supported for the existing US and Malaysia chart surfaces | Signal already uses the bounded Yahoo Finance chart adapter. Historical valuation uses its US daily close and split-event data only; it does not add a provider, scrape a page, or use a hidden browser credential. |
| Period-correct historical fundamentals and valuation | Supported only for bounded US annual filing observations | The official SEC Company Facts API exposes standardized US-GAAP facts by unit and filing context. Signal accepts only accession-aligned `10-K` and `10-K/A` annual facts and derives at most eight observations. Malaysia is unavailable because the repo has no approved, period-correct Bursa fundamentals source with the required filing availability and licensing contract. |
| Analyst estimate and revision history | Unavailable | No suitable estimate-history provider exists in the repository. Signal does not substitute scores, news sentiment, company guidance, current consensus, or invented estimates. A future provider is a separate license, contract, and implementation decision. |

The SEC documents its unauthenticated JSON APIs, Company Facts coverage, units, and real-time filing dissemination at [EDGAR Application Programming Interfaces](https://www.sec.gov/search-filings/edgar-application-programming-interfaces). Automated access follows the SEC [fair-access guidance](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data): identify the operator, use bounded requests, and remain below the published request-rate limit.

Yahoo Finance remains the existing repository price source. Task 8 does not expand it into fundamentals or estimates and does not create a new provider or dependency. Production or redistribution beyond the existing application remains subject to the operator's existing provider-use assessment; replacing it with a licensed market-data feed is intentionally outside Task 8.

## Supported observation contract

`GET /api/research/valuation-history/[symbol]?market=US` returns at most eight discrete annual filing observations, cached for six hours.

Each observation requires:

- one SEC accession and one fiscal start/end range;
- `fp: FY`, a duration from 300 through 430 days, and form `10-K` or `10-K/A`;
- USD revenue from the first supported standard concept;
- USD net income when available;
- USD operating cash flow and capital expenditure when both are available;
- diluted weighted-average shares in `shares`;
- the SEC filed date and official accession link;
- the first valid Yahoo daily close strictly after the filed date and no more than seven calendar days later;
- USD price currency;
- all later Yahoo stock-split factors needed to align the filing's reported diluted shares with the provider's current split-adjusted historical-close basis.

The strict-next-close rule is conservative because Company Facts supplies a filed date but not an exchange-session-safe public timestamp. Same-day close is never used. Signal does not use a fact before its filing date and does not combine facts from different accessions.

The chart connects discrete filing observations for readability. It is not a daily multiple series. The accessible table is the complete alternative and carries fiscal period, filing/form, price date, formulas, gaps, amendment status, and source links.

## Formulas and omission rules

For one accepted observation:

```text
split-adjusted shares = reported annual diluted weighted-average shares × subsequent split factors
market capitalization = first post-filing split-adjusted close × split-adjusted shares
P/E = market capitalization ÷ annual net income
price / sales = market capitalization ÷ annual revenue
free cash flow = annual operating cash flow − annual capital expenditure
FCF yield (%) = free cash flow ÷ market capitalization × 100
```

P/E is unavailable when net income is missing, zero, or negative. Price-to-sales is unavailable when revenue is missing, zero, or negative. All metrics are unavailable when price, USD currency, positive diluted shares, filing alignment, or the next trading close cannot be proven. FCF yield is unavailable when either cash-flow input is missing; negative free cash flow remains a valid negative numerator because the displayed formula and inputs make its sign unambiguous.

Exact duplicate SEC facts are deduplicated. Conflicting values for the same concept, unit, accession, fiscal range, filed date, and form fail closed rather than selecting one silently. Comparative prior-year values carried in a later filing never replace the accession's latest fiscal-period end.

`10-K/A` observations remain distinct. Signal compares their supported formula inputs with the earlier same-period `10-K` and labels them `amended-values-changed`, `amended-unchanged`, or `amended-baseline-unavailable`. It does not claim that an unchanged supported subset means the entire filing was unchanged.

## Provider and failure states

- If SEC succeeds and prices fail, filing observations remain visible with every price-dependent metric unavailable.
- If prices succeed and SEC fails or the symbol has no supported CIK/US-GAAP annual facts, historical-price capability can remain available while filing valuation is unavailable.
- If both providers fail, the route returns an error and the UI offers retry.
- A partial observation names every missing or unsafe input.
- Malaysia returns a successful capability report with zero observations and the source/license boundary.
- Analyst revisions always return a successful unavailable capability until a suitable provider is explicitly approved.

The endpoint accepts only a 1–15 character uppercase-normalized symbol matching `[A-Z0-9.-]` and market `US` or `MY`. Provider calls use fixed origins, 8–10 second timeouts, redirect rejection, bounded ten-year prices, at most 4,000 price rows, 100 split events, 500 entries per SEC concept, and eight output observations.

## Privacy and decision boundaries

Historical valuation is server/public-market-data only. The browser sends a body-free `GET` containing symbol and market. It does not read or send account labels, holdings, quantity, cost, balance, cash-flow planning, factor assumptions, thesis text, notes, evidence text, or other portfolio/research content.

Loading the workspace never mutates a research record, checklist, valuation state, Queue item, or decision. The figures are evidence for a user-controlled review and never become buy/sell advice, a target, a forecast, or an automatic saved judgment.

## Intentionally unsupported

- quarterly, trailing-twelve-month, daily, or interpolated historical multiples;
- enterprise-value metrics, EBITDA, book-value multiples, dividend yield, or opaque provider multiples;
- IFRS and foreign-private-issuer `20-F` facts;
- Malaysia historical valuation;
- companies without safe standard US-GAAP concepts;
- facts with incompatible units or ambiguous duplicates;
- intraday filing-time price alignment;
- analyst consensus, target-price, EPS-estimate, or revision history;
- automatic Queue creation or research-decision mutation.

Adding any of these requires a new feasibility gate, exact source/license contract, point-in-time rules, fixtures, and privacy review.
