# Signal Features And Enhancement Roadmap

## Product Direction

Signal is transparent investment decision support. It is not an automated recommendation,
performance-accounting, tax, brokerage, or trade-execution system.

Every enhancement must preserve:

1. missing or unsupported evidence remains unavailable;
2. holdings, transactions, accounts, authored research, and credentials do not enter analytics;
3. browser-local and server-persisted state remain visibly separate;
4. currencies are not combined without explicit approved FX evidence;
5. mutations require intentional user action and conflict protection;
6. provider identity, timestamps, units, coverage, and failures remain explicit.

## Delivered Capability Groups

### Market And Research

- US and Malaysia market context with transparent signal contributions, conflicts, freshness,
  coverage, replay, scenarios, and score sensitivity.
- Revision-safe research records, immutable review history, accepted evidence, outcomes,
  structured triggers, filings, policy, Queue, Calendar, Changes, Evidence, Backup, Sources,
  Export, Usage, and command-palette workflows.
- Daily `Today` workflow with deterministic actions and independently degraded source states.
- Source-aware Queue navigation back to each connected task's owning Market or Research
  workspace, without changing the task or research record.
- Privacy-safe browser-local workflow measurement with bounded enums and no authored content.

### Portfolio

- Browser-local holdings and cash import with complete preview, add-only default, and
  acknowledged exact replacement.
- Session-only pre-trade what-if simulation with no order behavior.
- Explicit factor exposure and currency-separated portfolio views.
- Browser-local transaction import for buy, sell, dividend, fee, tax, deposit, and withdrawal.
- Read-only transaction reconciliation against holdings by exact account, security, and
  currency, including missing opening history and unsupported-action warnings.
- Explicit holdings-to-Research Queue handoff for exact research matches, with one
  deduplicated browser-local review task and no account, quantity, cost, currency, balance,
  or provenance data copied into the Queue.
- Explicit transaction-reconciliation-to-Research Queue handoff for non-matching exact
  securities, with one deduplicated browser-local review task and no account, quantity,
  difference, cost, currency, balance, transaction, or provenance data copied into the Queue.
- Covered contribution attribution:
  - unrealized price contribution only for exact reconciled holdings with accepted average
    cost and an exact current price;
  - dividends, fees, and taxes reported separately by currency;
  - realized contribution, FX contribution, tax results, and total-return claims unavailable
    without stronger evidence.

### Reliability And Privacy

- Lazy secondary Research workspaces and bounded quote/signal request behavior.
- Repeatable route-performance measurement.
- Encrypted research export/import and opt-in ciphertext continuity.
- Static-shell-only PWA caching and encrypted generic-count Web Push.
- Browser-local usage events with no ticker, company, account, holding, quantity, amount,
  thesis, note, evidence, URL, credential, or provider payload.

## Current Observation Lane

Continue observing Today and Usage for approximately 30 active-use days or two review cycles.
Do not change the default Research workspace until:

- at least five Today actions are opened;
- at least 40% reach their owning detailed workspace;
- at least 25% lead to a saved review or completed Queue task; and
- manual use shows no repeated navigation confusion.

This is a product-evidence activity, not another implementation lane.

## Reordered Next Work

### 1. Production Dependency Security Remediation

Status: **Implemented and verified on `codex/dependency-security-remediation`; deployment pending**

The dedicated remediation upgrades Next.js and its matching ESLint configuration from 16.1.0
to 16.2.12, then pins the patched PostCSS 8.5.18 and sharp 0.35.3 transitive versions. This
clears all production dependency findings reported by `npm audit --omit=dev`.

Verification completed:

- official Next.js and dependency advisory versions were checked before selecting the target;
- lint, typecheck, the full repository harness, and the production build pass;
- US, Malaysia, and invalid-parameter signal API smoke checks pass;
- the static PWA harness and full production PWA browser matrix pass;
- production Market and Research routes pass at 1280px, 768px, and 375px with no blocking
  console, page, request, response, or document-overflow failures; and
- the repeatable production performance probe completes for both routes.

The compatible development-toolchain remediation updates the lockfile to patched releases for
`@babel/core`, `ajv`, `flatted`, `js-yaml`, `minimatch`, and `picomatch` without changing direct
dependencies. One `brace-expansion` resource-exhaustion advisory remains in the ESLint dependency
tree. npm's force-fix would apply an incompatible ESLint major change and an invalid
`eslint-config-next` downgrade, while globally overriding `minimatch` would break consumers that
still require its legacy callable export. Keep the residual dev-only advisory visible until the
upstream ESLint plugin chain adopts a compatible patched matcher. It is not present in
`npm audit --omit=dev`. Production deployment configuration and deployed runtime behavior remain
unverified until release.

### 2. Malaysia Data Parity

Status: **Provider gated**

Select one narrow capability only after an approved provider or official source documents
automation, caching, storage, display, redistribution, identifiers, correction handling, and
rate limits. Candidate first slices:

- historical fundamentals;
- dividends;
- exchange announcements; or
- Discovery coverage.

Never substitute SEC, Nasdaq, US benchmark, or US ranking semantics for missing Malaysia data.

### 3. Account Continuity

Status: **Security and demand gated**

Proceed only after repeated cross-device failures justify identity infrastructure and after
owner authorization, threat model, session, recovery, deletion, CSRF, rate-limit, audit, and
rollback decisions are approved.

The first slice must keep server data owner-scoped ciphertext and include device/session
revocation, export, and deletion. The server must never hold the research passphrase.

### 4. Encrypted Offline Research

Status: **Security and demand gated**

Proceed only after repeated offline need and an approved plaintext-lifetime, unlock, recovery,
locking, and wipe design. The first slice should be opt-in read-only encrypted IndexedDB
summaries. Plaintext must never enter service workers, logs, analytics, URLs, or Cache Storage.

### 5. Primary-Document Ingestion Expansion

Status: **Provider and copyright gated**

Proceed only after a demonstrated manual citation bottleneck and approved retrieval/copyright
use. Use fixed official origins, strict redirect/size/type/time boundaries, exact filing
provenance, and user-selected bounded excerpts. Do not auto-mutate thesis, checklist, triggers,
confidence, or decisions.

## Deferred

- automated trade execution or brokerage integration;
- AI-generated buy/sell recommendations;
- automatic checklist or decision changes from scores, news, or model output;
- public performance leaderboards or social trading;
- total-return or realized-gain claims without complete cash-flow and lot evidence;
- tax advice, entitlement calculations, or inferred tax-lot optimization;
- cross-currency totals without explicit approved FX inputs;
- proxy Malaysia results manufactured from unsupported US data;
- unconstrained backtesting over sparse historical snapshots.

## Completion Rule

No additional product feature should start merely to keep the roadmap busy. A gated lane becomes
eligible only when its stated evidence exists. Until then, use observed workflow data, production
security findings, and real user friction to reorganize this list.

Commit, push, merge, deployment, dependency upgrades, provider activation, and destructive
operations remain separately authorized delivery actions.
