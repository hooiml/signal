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

## Updating Generated Repo Knowledge

When files, scripts, or route structure change, refresh the generated map:

```powershell
npm run harness:update-map
```

Then run:

```powershell
npm run harness
```

## Adding A New API Route

1. Add the route under `src/app/api`.
2. Validate query/body values before service calls.
3. Keep data-fetching and scoring behavior in `src/lib`.
4. Add or update docs if the route changes repo behavior.
5. Run API smoke checks from `docs/TESTING.md` when the route depends on runtime data.

## Adding Or Changing Signal Logic

1. Update the relevant calculator or service in `src/lib`.
2. Keep `MarketSignal` types in sync when response shape changes.
3. Update `docs/signal-scoring.md` for score semantics, weights, confidence, or freshness rules.
4. Verify the dashboard still renders limited/degraded coverage clearly.

## Scheduled Refresh

- `vercel.json` runs `/api/signals/refresh` once per day to warm the current V2 dashboard snapshots.
- The default scheduled refresh warms:
  - `US + standard + social on`
  - `US + contrarian + social on`
  - `MY + standard + social on`
  - `MY + contrarian + social on`
- For a fuller manual warm, call `/api/signals/refresh?includeSourceOff=true` with the same cron/admin authorization header so source-off variants are also refreshed.
