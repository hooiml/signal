# Legacy route retirement (G6 / E22)

## Route contract

The version aliases are retired; their advanced engines are not all migrated to V8.
`src/proxy.ts` applies the pure `src/lib/legacy-routes.ts` contract before rendering.
Redirects are temporary HTTP 307 responses with fixed local destinations.

| Entry | Destination |
| --- | --- |
| `/`, `/main-v2`, `/main-v4`, `/main-v5`, `/main-v6`, `/main-v7`, `/backup/main` | `/main-v8` |
| `/research-v2`, `/research-v4`, `/research-v5`, `/research-v6`, `/research-v7`, `/backup/research` | `/research-v8` for ordinary reading; `/research` for advanced task links |
| `/research` | `/research-v8` for ordinary reading; existing shared Research controller for advanced task links |
| `/market/tools` | Retained detailed Market engine, including alerts and queued exposure reviews |

No V3 route existed. Unrelated routes are not matched. V8 demo routes remain isolated.
Advanced Research intent is the presence of `workspace`, `tab`, `review`, `query`,
`decision`, `density`, `setup`, `queueTask`, `returnTo`, or a `context*` key. Retaining
even empty or invalid explicit task values leaves validation and fallback behavior with
the existing owner. Ticker, market and unknown parameters alone remain ordinary reading.
In particular, an old `tab=fundamentals` or saved-chart link keeps its existing semantics.

The redirect changes only the pathname, retaining query values, repeated keys and unknown
parameters. Consumers retain their own validation; duplicate scalar selectors use the first
value, consistent with `URLSearchParams.get`. An unknown query value is never a redirect target.
Fragments are not sent in HTTP requests: browsers and Next client navigation retain them.
Known old Market anchors (drivers, limitations, sensitivity, calibration, alerts, macro context,
watchlist exposure and score evidence) continue from V8 to `/market/tools` with the query and
fragment intact; the matching disclosure opens and receives focus. An explicit Reading view
selection clears that tool-only fragment to avoid returning immediately to tools. Other
fragments remain intact when switching views.

`WorkspaceNavigation` replaces the version bar with Reading view and Advanced tools links.
It preserves URL context, including fragments in rendered links, and transfers the current
Market configuration. The retained Market controls update that URL when the user changes
configuration. No old version picker or build-time version-picker flag remains active.

## Jobs retained and migration still outstanding

| Job | V8 coverage | Preserved owner |
| --- | --- | --- |
| Holdings | G1 cost-only read-only view | `/research?workspace=portfolio`: CSV import, transaction import/reconciliation, covered attribution, what-if, allocation and risk tools |
| Research work | Basic company reading, charts, saved context and selected newer modules | `/research`: Today, Queue, alerts, calendar, changes, currency, outcomes, replay, backup, policy, packets, evidence and other workspace jobs |
| Score sensitivity | V8 Scenarios uses the same pure simulator | `/market/tools`: existing sensitivity controls and exact evidence anchors |
| Historical calibration | V8 History has timeline, forward outcomes, score zones, cases and method | `/market/tools`: retained full calibration evidence and raw outcome plots |
| Macro context | V8 Context shows US yield/financial conditions/breadth and Malaysia rates | `/market/tools`: existing disclosure and source-link layout |
| Market alerts | No matching V8 saved-rule editor | `/market/tools`: existing `signal-market-alerts-v6` rules and evaluation |
| Watchlist exposure | V8 shows saved-stock connections | `/market/tools`: existing queued market-context review action; Queue's source action returns to this section |

G1 is not full portfolio parity. Retiring the aliases does not authorize removal of these
owners or their shared components. A later migration needs explicit feature acceptance.

## Today continuity

The real chain is Today in `/research?workspace=today` → client router navigation to
`/?returnTo=today` → `/main-v8?returnTo=today`. V8 records the existing Market continuation
and exposes Back to Today. It does not mutate ticker decisions or introduce a new storage
schema. The same return action remains available when Market data is unavailable.

## Verification and rollback

`npm run harness` includes the table-driven route contract. `npm run qa:legacy-routes`
uses a built local server and intercepted API fixtures to check raw HTTP redirects,
browser URLs, repeated/unknown values, fragments, history, explicit markets, the actual
Today router chain, and advanced portfolio/Queue actions. The previous
`scripts/v8-version-navigation-qa.mjs` command forwards to this suite. Existing Market,
Settings, header, provenance and V7 interaction checks target the retained owners or the
new redirects. See [TESTING.md](TESTING.md) for the full required gate.

Local verification on 2026-10-25 passed the production build, post-build typecheck, lint,
full harness, independent review and 93 route-browser checks at 1280/768/375px. The latter
includes rendered fragment links after in-page evidence navigation, keyboard activation,
focus, current-view semantics, target geometry and middle-click destinations, with zero
console/page errors, request failures or unintended API mutations. Settings, first visit,
provenance, Queue and retained Market checks also passed; see E22 in the roadmap for the
scenario ledger and evidence paths. Remote CI and deployment are separate delivery steps.

Rollback is an application-code revert restoring the old page entries and version bar.
There is no database migration, dependency change or storage rewrite. The framework redirect
mechanism is documented in [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).
