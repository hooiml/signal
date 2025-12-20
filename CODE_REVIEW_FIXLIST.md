# Signal — Code Review Fix List

Date: 2025-12-20  
Scope: whole repo (Next.js app + API routes + lib modules)  
Goal: capture actionable fixes (no code changes in this pass)

## Status (Verified)

Verification run (local):
- `npm run build`: PASS (but still shows workspace-root warning)
- `npm audit --omit=dev`: PASS (0 vulnerabilities)
- `npm run lint`: FAIL (3 errors, 4 warnings)

Item statuses below reflect the current workspace state as verified on 2025-12-20.

## Commands & Current Status

- `npm run lint` fails (errors + warnings)
- `npm run build` succeeds (TypeScript OK), but warns about inferred workspace root due to multiple lockfiles
- `npm audit --omit=dev` succeeds (0 vulnerabilities)

## P0 — Must Fix (Build/Prod Blockers)

### 1) Production build fails (TypeScript)

- Status: FIXED (build now passes)
- Symptom: `next build` fails in `src/lib/yahoo-finance.ts`
- Error gist: returned array is typed as `({ ...; sparkline: number[] } | null)[]` and is not assignable to `MarketData[]` after filtering.

What to fix:
- Make the `Promise.all` result and filter step type-safe without relying on a type predicate that doesn’t match the inferred union.
- Ensure the async mapping returns a consistent `MarketData | null` and that the filter is recognized by TS (or restructure to avoid `null` in the array type).

Notes:
- This is a hard blocker: deployment builds won’t succeed until fixed.

### 2) Unauthenticated “expensive/mutating” API routes

- Status: NOT FIXED (no auth/rate-limit/env gating detected)
Routes:
- `src/app/api/signals/refresh/route.ts` (forces LLM + writes DB; also does `DELETE`)
- `src/app/api/signals/full/route.ts` (LLM + writes DB)
- `src/app/api/signals/debug/route.ts` (calls live data fetchers; leaks detailed internals)
- `src/app/api/test-db/route.ts` (DB connectivity & version info)

Risks:
- Token burn / cost exposure (LLM calls)
- Abuse to hammer external sources (Reddit/RSS/Yahoo/StockTwits)
- DB churn / write amplification
- Information disclosure (`version()`, internal calculation details)

What to fix:
- Add auth (header token or session) and rate limiting.
- Gate these endpoints behind environment checks (e.g., only in dev/staging) and/or move to admin-only routes.
- Consider removing `test-db` and `debug` from production builds entirely.

### 3) UI triggers live aggregation during page render

File:
- `src/app/page.tsx` calls `getSmartSignal()` directly on server render.

Clarification (hybrid MVP is reasonable):
- “Read only from DB” is ideal at scale, but for an MVP “live dashboard”, it’s a good UX to keep *cheap* market data (prices/indices/sparklines) live-ish (ISR or client polling), while keeping *expensive* AI analysis (LLM summary + drivers) cached heavily / read from DB.
- The concern is not “don’t ever fetch on render”; it’s that the current orchestration couples cheap + expensive work behind `getSmartSignal()` so a page render can still trigger multi-source aggregation (and potentially LLM) and DB writes.

Why it matters:
- The blueprint suggests “cron precomputes → DB read”, but current flow is effectively “page render → fetch many sources → may call LLM → may write DB”.
- Even if Yahoo is cheap, Reddit/RSS/StockTwits + LLM + DB writes during SSR increases tail latency and failure modes (timeouts, rate limits, cost exposure).

What to fix:
- Split into two tiers and compose in the UI:
  - **Market Pulse (cheap/live-ish):** Yahoo prices/indices/charts via ISR (e.g., 30s) or client-side refresh.
  - **Market Aura (expensive/stable):** LLM output + derived drivers read from DB (daily or hourly), produced by cron/admin-only refresh.
- Avoid DB writes as a side-effect of a normal page render.

Status: PARTIALLY FIXED
- Confirmed: `src/lib/signal.ts` no longer generates LLM output on normal render; it reads latest aura from DB and returns a fallback if DB is empty.
- Still true: `src/app/page.tsx` triggers live multi-source aggregation via `getSmartSignal()` (Yahoo + Reddit/RSS/StockTwits). This is aligned with the “live-ish Market Pulse” goal, but it still needs endpoint hardening and failure isolation.

## P1 — Security / Reliability

### 4) External links from untrusted sources

- Status: NOT FIXED (missing rel + URL allowlisting)
File:
- `src/app/page.tsx` renders RSS links via `<a href={news.link} target="_blank">`.

What to fix:
- Enforce `rel="noopener noreferrer"` for `target="_blank"`.
- Validate/sanitize URLs (allow only `http:`/`https:`).

### 5) Fire-and-forget DB write in serverless request

File:
- `src/lib/signal.ts` saves to DB inside an immediately invoked async function after returning.

Risk:
- The runtime may freeze/terminate the process once the response is sent; the write may not complete reliably.

What to fix:
- Await the write or move writes to a durable job/queue/cron.

Status: FIXED
- Confirmed: `src/lib/signal.ts` no longer does “save to DB (Async, don't block return)” on the normal render path.

### 6) Non-transactional “DELETE then INSERT”

File:
- `src/app/api/signals/refresh/route.ts`

Risk:
- Brief window with no row; concurrency race conditions; inconsistent reads.

What to fix:
- Use `INSERT ... ON CONFLICT DO UPDATE` or wrap `DELETE+INSERT` in a transaction (preferred: avoid delete entirely).

Status: NOT FIXED
- Confirmed: `src/app/api/signals/refresh/route.ts` still deletes then inserts.

## P1 — Correctness / Consistency

### 7) `vixChangePct` isn’t actually a percent

Files:
- `src/lib/signal.ts` passes `vixData.change` into `vixChangePct`
- `src/app/api/signals/refresh/route.ts` does the same

Risk:
- Velocity adjustment logic in `src/lib/sentiment-calculator.ts` expects a percent value; behavior will be wrong.

What to fix:
- Pass an actual percent change (or rename the field and adjust the formula accordingly).

Status: NOT FIXED

### 8) Duplicated sentiment/aura logic across modules

Files:
- `src/lib/sentiment-calculator.ts` (primary score logic)
- `src/lib/signal.ts` (market orchestration + caching + DB write)
- `src/app/api/signals/*.ts` (multiple routes re-implement scoring and thresholds)

Risks:
- Drift over time (different thresholds, formulas, and labels)
- Stored DB values differ depending on which route ran last

What to fix:
- Centralize scoring + aura mapping in one module and re-use it everywhere.

Status: NOT FIXED

### 9) Encoding / garbled characters in UI and JSON

Files (examples):
- `src/app/page.tsx` and some API routes include strings that look like broken emoji/encoding artifacts.

Risk:
- UI looks unprofessional; may also break JSON consumers.

What to fix:
- Ensure file encoding is UTF-8, terminal/logging preserves UTF-8, and avoid non-ASCII tokens if any toolchain corrupts them.

Status: NOT FIXED

## P2 — Tooling / Maintainability

### 10) ESLint failures due to `any` and unused variables

Status: NOT FIXED (lint fails)
Findings:
- `src/lib/reddit.ts`: `any` in JSON mapping
- `src/lib/stocktwits.ts`: `any` in JSON mapping
- `src/lib/gemini.ts`, `src/lib/kimi.ts`, `src/lib/sentiment-calculator.ts`: unused vars

What to fix:
- Define response types (or minimal runtime-validated shapes) for external APIs.
- Remove/rename unused vars to satisfy lint.

### 11) Dependency vulnerabilities (via `snoowrap`)

Command:
- `npm audit --omit=dev` reports critical/high issues through `snoowrap -> request -> form-data/tough-cookie/ws`.

What to fix:
- If `snoowrap` isn’t used (you’re using Reddit public JSON), remove it.
- If you need Reddit auth later, prefer a maintained client that doesn’t depend on `request`.

Status: PARTIALLY FIXED
- Confirmed: `package.json` no longer depends on `snoowrap` and `npm audit --omit=dev` is clean.
- Remaining cleanup: `package-lock.json` still contains `snoowrap` entries and `npm ls snoowrap` reports it as extraneous (still installed).

### 12) Next.js workspace root warning (multiple lockfiles)

Build output indicates:
- Next inferred workspace root incorrectly due to another `package-lock.json` outside this repo.

What to fix:
- Set `turbopack.root` in `next.config.ts`, or remove the extra lockfile so tooling resolves the correct root deterministically.

Status: NOT FIXED (warning still appears during `npm run build`)

## Suggested Fix Order (Practical)

1. Fix `src/lib/yahoo-finance.ts` typing so `npm run build` passes.
2. Lock down or remove dangerous API routes (auth + rate limit + env gating).
3. Switch UI to “read from DB” and move aggregation to cron/admin.
4. Correct `vixChangePct` semantics and unify scoring logic.
5. Address lint failures (`any`, unused vars).
6. Remove/replace `snoowrap` to eliminate audit findings.
7. Fix workspace root warning and encoding artifacts.

## Quick Verification Checklist

- [ ] `npm run lint` exits 0
- [ ] `npm run build` succeeds
- [ ] Hitting public endpoints cannot trigger LLM/token burn without auth
- [ ] UI renders from DB without live aggregation
- [ ] `npm audit --omit=dev` is clean (or risk explicitly accepted and documented)
