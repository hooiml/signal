# Structured Thesis-Trigger Contract

Structured thesis triggers are explicit, persisted review prompts owned by one research record. They do not interpret authored thesis text, recommend a trade, change a decision or checklist, place an order, or connect to a brokerage.

## Persisted contract

The existing `research_records.monitoring_rules` JSONB value owns the extension. No database column is added.

```ts
type ResearchStructuredTriggerSet = {
    version: 1;
    migrationState: 'current' | 'migrated-empty' | 'invalid-recovered';
    rules: ResearchStructuredTriggerRule[]; // maximum 10
};

type ResearchStructuredTriggerRule = {
    id: string; // stable, bounded identity
    enabled: boolean;
    purpose:
        | 'thesis-invalidation'
        | 'opportunity-review'
        | 'scheduled-evidence-review';
    metric: ResearchStructuredTriggerMetric;
    operator: 'above' | 'below' | 'within';
    threshold: number;
};
```

`monitoringRules.structuredTriggers` contains the set. Older records without it migrate to an empty version-1 set. Malformed persisted values recover to an empty `invalid-recovered` set so the rest of the research record remains readable; the UI requires an explicit replacement save.

Settings saves use the existing optimistic `revision` check and `mode: "settings"`. Server-side settings mode accepts only `monitoringRules`, so a trigger save cannot persist a broader journal draft, checklist toggle, decision, or thesis change. A later explicit review freezes the then-current monitoring contract inside the immutable review snapshot.

## Purposes

Purpose changes fixed presentation and Queue template only. It never changes metric evaluation.

| Purpose | Alert severity | Queue template |
| --- | --- | --- |
| Thesis invalidation | Risk | Thesis challenge |
| Opportunity review | Opportunity | Valuation refresh |
| Scheduled evidence review | Watch | Post-event review |

All three are review prompts, not trade signals.

## Supported metrics

Comparisons use finite explicit thresholds. `above` and `below` are strict, so equality does not match. `within` includes the configured day boundary.

| Metric | Operators | Unit and bounds | Trusted observation |
| --- | --- | --- | --- |
| Price | above, below | price, `0.0001-1,000,000,000` | Current validated Yahoo quote |
| RSI (14) | above, below | RSI points, `0-100` | Current calculated daily RSI |
| Price vs MA50 | above, below | percentage, `-100-1,000` | `(price / MA50 - 1) * 100` |
| Price vs MA200 | above, below | percentage, `-100-1,000` | `(price / MA200 - 1) * 100` |
| Earnings date | within | whole days, `0-90` | Bounded Nasdaq earnings-calendar scan |
| Research age | above | whole days, `1-3,650` | Saved `lastReviewedAt` |
| Latest evidence age | above | whole days, `1-3,650` | Latest accepted-evidence reporting period, falling back to accepted date |
| Price / earnings | above, below | ratio, `0-1,000` | Current price plus latest validated annual inputs |
| Free-cash-flow yield | above, below | percentage, `-100-1,000` | Current price plus latest validated annual inputs |
| Annual revenue growth | above, below | percentage, `-100-1,000` | Latest validated annual period |

Current quote and technical observations become unavailable after four days. Annual valuation and fundamental observations require source provenance and a reporting period no older than 550 days. Missing values, missing moving averages, absent dated evidence, stale inputs, unsupported Malaysia earnings coverage, or provider failure produce `unavailable`, never a false match.

A successful 90-day earnings scan with no matching date is a valid non-match. A failed scan is unavailable.

## Validation

The domain parser rejects:

- more than 10 rules;
- duplicate ids;
- duplicate metric/operator/threshold conditions, even if purposes differ;
- unsupported metric/operator combinations;
- non-finite values;
- fractional day thresholds;
- out-of-range thresholds;
- malformed ids, enums, versions, arrays, or booleans.

Removal and disabling are explicit. Disabled rules remain visible and are never evaluated as matches.

## Evaluation and explanations

`evaluateResearchStructuredTriggers()` is pure. It receives a validated research trigger record, validated current snapshot, bounded earnings result, provider coverage states, and an explicit clock. Each result is one of:

- `matched`;
- `not-matched` (shown as active);
- `unavailable`;
- `disabled`.

Matched explanations are fixed and bounded. They identify the metric, operator, configured threshold, observed value and date, purpose-derived title, source, and freshness or reporting period. Authored thesis text and notes are never included.

## Alerts, Queue, and notifications

Matched rules join the existing Research Alerts response. Alerts also show active, unavailable, disabled, empty, invalid-migration, and provider-degraded coverage.

Queue creation is an explicit button action. Its deterministic identity is:

```text
structured-trigger:<symbol>:<rule-id>
```

The Queue stores only the existing browser-local task contract and fixed template/source values. It does not store the threshold, observed provider payload, or authored research.

Scheduled notification digests include matched structured-trigger attention items under the existing bounded `signal.research.digest.v1` privacy contract. They may contain the already-allowed symbol and fixed alert explanation, but never authored thesis text, notes, credentials, URLs with credentials, accepted-evidence prose, or raw provider payloads. The existing date-scoped digest key, delivery lease, receiver idempotency header, and deduplication behavior remain unchanged.

## Intentionally omitted

- Free-text-to-rule extraction, AI interpretation, and arbitrary executable expressions.
- Historical valuation triggers: the snapshot does not expose a period-correct historical valuation series.
- EV/EBITDA, forward P/E, dividend-yield, guidance, and analyst-target thresholds: current validated snapshots do not expose them with sufficient provenance.
- Absolute debt, cash, revenue, income, or free-cash-flow thresholds: currency and reporting-period comparisons would be easy to misconfigure and add little value to this bounded MVP.
- Automatic decision, checklist, thesis, evidence, Queue, order, or brokerage mutations.
