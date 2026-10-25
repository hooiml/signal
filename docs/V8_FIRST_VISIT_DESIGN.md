# V8 first visit (G5 / E21)

## Reviewed contract

The orientation is a nonblocking, skippable inline callout on connected V8 Market and
Research. It teaches three actions: understand the current Market score, open a stock,
then explicitly save it. Existing V8 typography, theme tokens and 44px controls apply.
It never steals focus or covers the reading. Demo routes and the `/start` owner checklist
keep their independent lifecycles.

An architecture review before implementation identified an ABA race in a stage-only
design. The accepted contract is the exact local-only object
`{ version: 1, stage: 'market' | 'stock' | 'save' | 'skipped' | 'complete', revision: number }`
at `signal-v8-first-visit-v1`. Revision is a nonnegative safe integer, incremented on each
update; a missing/corrupt lifecycle starts with a fresh high random revision on its first
write. This also distinguishes a new lifecycle after browser storage is cleared. Revision
is concurrency metadata, not a user/device identifier. There are no tickers,
notes, URLs, dates, provider payloads, analytics or server synchronization in this store.

Missing progress starts at Market in memory without a write. Invalid or unsupported
bytes are retained with an explicit error; only Settings' explicit restart replaces
them. Blocked reads/writes and unavailable Web Locks have visible failure feedback.
Writes use one Web Lock, reread validated bytes, compare expected stage/revision, and
increment revision. Stale operations are no-ops. Restart rereads under the same lock;
corrupt recovery uses a fresh high random safe-integer revision instead of zero. Numeric
exhaustion fails explicitly. Same-tab events and native storage events reread storage,
including clear/removal, rather than trusting event payloads.

## Evidence and transitions

- Market → stock: explicit **I understand** after the current configuration has settled
  successfully, with a finite score and actual components. Loading, retained failed data
  and historical views cannot pass. Copy explains score context and mode, not predictions.
- Stock → save: the existing Research parser has resolved the selected symbol/market,
  with a positive finite quote; no link click or tour-only query counts. Missing data
  remains unavailable. A successful reading on the current page can satisfy this stage.
- Save → complete: the existing explicit Save stock has persisted guest data or returned
  a parsed, identity-matched owner record. The callback captures the tour revision before
  saving and cannot affect a restarted/dismissed run. Persistence errors are separate from
  the underlying Save result. An already-saved stock instead offers an explicit accurate
  **Finish with this saved stock** acknowledgement; passive record arrival never completes.
  At the save stage, this acknowledgement needs the validated saved record, not a fresh quote;
  the earlier reading step is already complete. Later provider failure cannot trap this action.
- Skip/completed stays dismissed on reload. Settings can restart at Market without
  unmounting Research, changing its URL or discarding a draft. An explicit new-tab Market
  link preserves the current editor. No automatic save, unlock, navigation or provider call.

## Verification

High lane: strict store/race regressions, one owned production server at port 3000,
fixture-only owner and guest browser flows, failed saves and unavailable data, blocked and
corrupt storage, same/cross-tab state, dirty-note restart, and unchanged unrelated storage
and request boundaries. Keyboard and light/dark geometry/screenshots cover 1280, 768, 375
and 320px. Run lint, build, post-build typecheck, harness, affected browser suites and an
independent review before a scoped commit and new PR. Remote CI and deployment remain
separate from local fixture proof.
