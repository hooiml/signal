# Workflows

## Local Development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Before Finishing A Change

```powershell
npm run lint
npm run typecheck
npm run harness
```

Run `npm run build` for route, framework, dependency, or deployment changes.

### Research read schema prerequisite

Before deploying the Research read-path optimization, run `node scripts/check-research-schema.mjs`
against the intended deployment's database. It loads the configured environment, checks required
Research columns/types/nullability in a read-only transaction, and returns nonzero on missing
schema or connection failure. It does not run setup and does not establish database/deployment
identity: verify that pairing separately. Never replace this preflight with a schema check on every request.

`listResearchState()` now executes only the two ordered SELECTs. The watchlist endpoint,
Research attention/inbox enrichment, and notification delivery share that read function.
Other mutation paths retain their existing setup behavior; this is not a removal of all runtime DDL.

Fresh provisioning definitions are in `schema.sql`. Existing databases are not upgraded by
`CREATE TABLE IF NOT EXISTS`; the protected `src/app/api/admin/setup-db/route.ts` already contains
the Research upgrades. If preflight fails, stop deployment and obtain authorization for the required
setup/migration. Do not invoke that endpoint merely to check readiness: it performs broader setup.
After any separately approved setup, rerun preflight before deploying the read-path change.
Rollback restores the prior application code and leaves additive schema/data intact; never drop
columns or overwrite newer research revisions. No setup or migration is part of the read-only preflight.

The watchlist GET emits `Server-Timing` for `records`, `archived`, `mapping`, and `watchlist`
(handler work before response serialization). Timings contain no symbols, records or connection details.

## Commit Messages

Every commit subject must use a scoped Conventional Commit:

```text
<type>(<scope>): <short summary>
```

Examples:

```text
feat(research): add encrypted decision backups
fix(provider): stop serving stale market context
docs(workflows): document deployment verification
```

Keep the type and scope lowercase. Choose the narrowest scope that describes the change; split unrelated work instead of using a generic subject such as `Implement requested project changes`.

Activate the repository hook once per clone:

```powershell
git config core.hooksPath .githooks
```

The dependency-free `commit-msg` hook rejects missing scopes and generic subjects before Git creates the commit. Do not bypass it with `--no-verify`.

For Market V6 hierarchy, score-evidence, responsive layout, or control changes, run the reusable browser check instead of creating a task-specific Playwright script:

```powershell
npm run qa:market
```

Use `--scenario`, `--viewport`, and `--no-screenshots` for focused reruns. See `docs/TESTING.md` for the fixture/live split and evidence contract.

## Updating Generated Repo Knowledge

When files, scripts, or route structure change, refresh the generated map:

```powershell
npm run harness:update-map
```

Then run:

```powershell
npm run harness
```

## Updating Harness Standards

1. Update the owning doc in `docs`.
2. Keep `AGENTS.md` as a short map to that doc.
3. Update `scripts/harness/check-docs.ps1` when a doc becomes required.
4. Refresh the generated repo map if file or script structure changed.
5. Run `npm run harness`.

See `docs/HARNESS.md` for check design, eval artifacts, and completion evidence rules.

## Adding A New API Route

1. Add the route under `src/app/api`.
2. Validate query/body values before service calls.
3. Keep data-fetching and scoring behavior in `src/lib`.
4. Add or update docs if the route changes repo behavior.
5. Run API smoke checks from `docs/TESTING.md` when the route depends on runtime data.

For historical valuation changes, also run `npm run test:research` and `npm run qa:historical-valuation`. Preserve the point-in-time and privacy contract in `docs/historical-valuation.md`.

## PWA and Web Push

For manifest, service-worker, offline, notification, subscription, or scheduled push changes, run:

```powershell
npm run test:pwa
npm run qa:pwa
```

Use the security, environment, migration, key-rotation, deployment, and rollback contract in `docs/pwa-offline-web-push.md`. Never add a private or user-specific URL to the service-worker precache. Local notification verification must use the service-worker message test and must not contact an external push service.

## Configuring Official SEC Requests

Set `SEC_USER_AGENT` to an operator identity with a monitored contact email or an HTTP(S) contact URL, following the SEC access policy. Signal fails closed when that value is absent or malformed; do not substitute placeholder contact data.

The Filings workspace requests only SEC filing metadata through fixed `sec.gov` endpoints. Manual Bursa/issuer links are browser-opened citations and must never be added to a server-side fetch path.

## Adding Or Changing Signal Logic

1. Update the relevant calculator or service in `src/lib`.
2. Keep `MarketSignal` types in sync when response shape changes.
3. Update `docs/signal-scoring.md` for score semantics, weights, confidence, or freshness rules.
4. Verify the dashboard still renders limited/degraded coverage clearly.

## Long-Range Market Timeline Backfill

Generate the weekly US timeline-only reconstruction without writing data:

```powershell
node --env-file=.env.local scripts/backfill-signal-history.mjs --long-range
```

After reviewing the date range, candidate counts, source coverage, and observed-score validation, apply the tagged rows:

```powershell
node --env-file=.env.local scripts/backfill-signal-history.mjs --long-range --apply
```

The long-range profile uses weekly VIX closes, holds unavailable inputs neutral, writes `long_range_reconstruction_version: 1`, and sets `validation_eligible: false`. It must extend the timeline only. The rollback target is restricted to reconstructed US rows whose `metadata_snapshot->>'long_range_reconstruction_version'` equals `1`; never delete by date range alone.

## Scheduled Refresh

- `vercel.json` runs `/api/signals/refresh` once per day to warm the current V2 dashboard snapshots.
- Configure `CRON_SECRET` or `ADMIN_SECRET` in every environment that will call the protected refresh, admin, or diagnostic routes.
- The default scheduled refresh warms:
  - `US + standard + social on`
  - `US + contrarian + social on`
  - `MY + standard + social on`
  - `MY + contrarian + social on`
- For a fuller manual warm, call `/api/signals/refresh?includeSourceOff=true` with the same cron/admin authorization header so source-off variants are also refreshed.
- AAII is refreshed every Thursday at 15:00 UTC, after its normal weekly publication window. The signal warm then consumes the newest stored institutional value.
- NAAIM is fetched without the framework data cache whenever a US signal is calculated, so the weekly table cannot remain pinned to an older cached page.

### Manual Full Refresh

With the local server running and `ADMIN_SECRET` or `CRON_SECRET` configured in `.env.local`, run:

```powershell
npm run data:refresh
```

The script reads the local secret from `.env.local` only when the target is localhost. A shell environment variable takes precedence.

For a deployed environment, also set the base URL:

```powershell
$env:SIGNAL_BASE_URL = 'https://your-signal-host.example'
$env:ADMIN_SECRET = '<configured deployment secret>'
npm run data:refresh
```

The command refreshes AAII first, then warms all eight market, mode, and source-toggle combinations. It fails rather than reporting success if either stage is incomplete. Never commit the secret to `.env` files or scripts.

## Market score request readiness

Before deploying a version that removes request-time snapshot schema maintenance, run
`node scripts/check-market-schema.mjs` against the intended deployment database. It uses a
read-only transaction to inspect snapshot columns, insert defaults and valid upsert/lookup
indexes. Match database identity to deployment configuration separately. If readiness fails,
stop and document the missing prerequisite; do not call the broad setup endpoint as a preflight.
`schema.sql` describes fresh provisioning; the existing protected setup route owns upgrades.
Requests no longer create or upgrade `signal_snapshots`. Application rollback does not require
removing schema or saved snapshots.

The V2 score response emits `Server-Timing` for providers, stored Aura analysis, institutional
data, snapshot previous/history reads and write, the whole snapshot operation, calibration,
cache lookup/wait/load, and handler work before serialization. Timings include network/client
overhead, not pure SQL execution time. Snapshot stages are nested inside `snapshot`, which is
nested inside `signal_cache` and `signal`; do not add them together. Calibration includes its
one-hour cache lookup and any cache-miss work. Score-cache hits and shared waiters report only
their own cache wait and handler time, without reusing the loader request's stage timings.
Existing `X-Signal-Cache`, payloads, cache keys/TTL, awaited saving and error behavior are preserved.
