# PWA, Bounded Offline Mode, and Web Push

Signal is installable as a Progressive Web App, but its offline mode is intentionally narrow. Web Push is an optional extension of the existing authenticated research digest path. Neither feature changes the privacy boundary for research or browser-local portfolio planning.

## Data Classification and Cache Boundary

`public/sw.js` owns one versioned cache, `signal-offline-v1`. It contains only `/offline`, `/manifest.webmanifest`, and the two repo-owned icons under `/icons`.

Navigations are network-only. When a navigation fails, the service worker returns the static offline page. It does not cache a successfully loaded page or add runtime responses to Cache Storage.

The service worker never handles or caches:

- `/api/**`, `/admin/**`, `/research/**`, or `/backup/**`
- authenticated responses, research records, thesis notes, accepted evidence, factor assumptions, decision journals, or sync ciphertext
- imported holdings, account cash, dividend planning, what-if scenarios, or any other browser-local planning record
- auth headers, bearer tokens, push subscriptions, secrets, analytics requests, or provider responses

Browser-local planning data remains in its existing browser storage and mounted-page state. Offline support does not copy, mutate, sync, or promise access to that data from the fallback page. Live market, provider, research, alert, and sync views remain unavailable when disconnected. The offline indicator and fallback show the browser's last-online timestamp when one exists; this is connection context, not market-data freshness.

Changing the precache list is a security-sensitive change. Review every added URL for private or user-specific content, increment the cache version, and retain the obsolete-cache cleanup assertion.

## Install and Update Lifecycle

The App Router manifest defines Signal's identity, standalone display mode, start URL, colors, categories, and repository-owned vector icons. `PwaLifecycle` registers `/sw.js` with `updateViaCache: "none"`, reports offline state, exposes the deferred browser install prompt, and surfaces a waiting service worker.

An update never forces an immediate reload. The user must choose **Update available — review and apply**, then confirm that unsaved research or planning work has been saved. Only then does the waiting worker call `skipWaiting`; the page reloads once on `controllerchange`.

## Authentication and Subscription Ownership

`/api/research/push/subscriptions` reuses the single-user private-sync bearer in `RESEARCH_SYNC_BEARER_SECRET`.

- The bearer must contain 32 to 256 visible characters and is checked with the existing timing-safe SHA-256 comparison.
- The browser holds it only in mounted component state and sends it in the Authorization header. It is not persisted or sent to analytics.
- GET, POST, and DELETE require the bearer. POST and DELETE additionally require same-origin JSON browser requests; cross-site and missing-origin mutations fail closed.
- The route never returns a subscription endpoint, browser key, encrypted value, endpoint hash, or another device's record. Authenticated GET returns only the public VAPID key and aggregate slot counts.
- One private owner (`default`) may retain at most five active subscriptions. PostgreSQL serializes registrations for this owner so concurrent requests cannot bypass the bound.
- Registration is idempotent by SHA-256 endpoint hash. Removal is idempotent and deletes only the authenticated owner's matching hash.

Subscription endpoints are bearer capabilities. Accepted endpoints must be credential-free HTTPS URLs on the explicit Google FCM, Mozilla Autopush, Apple Web Push, or Windows Notification Service hosts in `push-contract.ts`. The request body is limited to 8 KiB; endpoints, expiration, uncompressed P-256 public keys, and 16-byte auth secrets are structurally bounded.

## At-Rest Protection and Schema

The endpoint and browser encryption keys are serialized together and protected with AES-256-GCM before database insertion. The authenticated owner and endpoint hash are authenticated additional data. The database retains only the owner, endpoint hash, encrypted subscription, optional expiration, and bounded delivery/dedupe, lease, retry, and disable metadata.

It does not retain the bearer or VAPID private key. Expired, invalid, and HTTP 404/410 subscriptions have encrypted capability material cleared. Explicit unsubscribe deletes the row.

The schema is in `schema.sql` and is also created defensively by the store. Apply the `research_push_subscriptions` table and partial active index before enabling Web Push in a controlled deployment.

## Delivery Contract

The existing authenticated `/api/research/notifications/deliver` cron route still builds the bounded research digest and preserves webhook lease/dedupe behavior. When Web Push configuration is complete, the same scheduled run claims eligible subscriptions independently.

The push payload contains only its schema type, a bounded generic title, action/upcoming counts, a digest-derived dedupe tag, and `/research?workspace=alerts`. It never contains symbols, titles, alert details, notes, holdings, evidence, warnings, webhook URLs, or subscription data.

`web-push` 3.6.7 performs standards-compliant payload encryption and VAPID authentication with `aes128gcm`. Sends use a 10-second timeout, five-minute TTL, normal urgency, and a bounded coalescing topic.

Each subscription/digest pair is claimed with a recoverable 15-minute lease. Success records the delivered digest. If the push service accepts a message but its database acknowledgement fails, a second bounded write marks that digest ambiguous and suppresses automatic resend; operators can see the aggregate ambiguous count without subscription disclosure. Retryable provider failures use 5, 10, 20, 40, then 80 minute backoff. The fifth failed attempt disables and clears the capability. HTTP 404 and 410 disable and clear it immediately. Delivery history records only channel outcome counts and digest IDs; raw endpoint, keys, response bodies, and provider errors are not logged.

The service worker validates every push payload again, ignores malformed messages, deduplicates by tag, and accepts only same-origin relative click paths. A click focuses and navigates an existing Signal window when available, otherwise it opens one.

## Required Environment

All of these values are required before registration or delivery becomes available:

- `DATABASE_URL`
- `RESEARCH_SYNC_BEARER_SECRET`
- `WEB_PUSH_VAPID_PUBLIC_KEY`
- `WEB_PUSH_VAPID_PRIVATE_KEY`
- `WEB_PUSH_VAPID_SUBJECT`
- `WEB_PUSH_SUBSCRIPTION_ENCRYPTION_KEY`

Generate VAPID keys once in a trusted operator shell:

```powershell
npx web-push generate-vapid-keys --json
```

Generate a separate 32-byte URL-safe-base64 subscription encryption key with an approved secrets tool. Do not use the VAPID private key as the encryption key. Set `WEB_PUSH_VAPID_SUBJECT` to a monitored `mailto:` address or credential-free HTTPS operator URL. Store all private values in the deployment secret manager; never paste them into source, logs, screenshots, tickets, browser storage, or analytics.

Changing the VAPID key invalidates future use of existing browser subscriptions. Changing the at-rest key makes stored capabilities unreadable. Treat both as controlled rotations: disable delivery, delete existing subscription rows, rotate the secrets, and require users to opt in again.

## Verification

Run:

```powershell
npm run test:pwa
npm run qa:pwa
```

The Alerts workspace also provides **Run local-only notification test** after browser permission is granted. It posts a message to the local service worker and does not call a push service or require real VAPID keys.

## Deployment and Rollback

Deployment prerequisites:

1. Apply the schema.
2. Configure all required environment variables in the secret manager.
3. Build and deploy over HTTPS.
4. Confirm `/sw.js` returns `Cache-Control: no-cache, no-store, must-revalidate` and `Service-Worker-Allowed: /`.
5. Confirm installability, exact cache contents, authenticated opt-in, one scheduled delivery, unsubscribe, and 404/410 cleanup in the target environment.

Rollback:

1. Remove the four `WEB_PUSH_*` variables to fail closed; webhook delivery remains independent.
2. Deploy the prior application/service worker. Its activation removes obsolete `signal-offline-*` cache versions.
3. After confirming no rollback code reads the table, drop it with `DROP TABLE IF EXISTS research_push_subscriptions;`.
4. Remove `web-push` and `@types/web-push` only when reverting the code and lockfile together.

Clearing or dropping subscription rows is destructive and requires users to opt in again. Do not perform it as part of normal rollback unless key rotation or incident response requires capability invalidation.
