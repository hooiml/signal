# Repair the missing 2026 US Market score history

## Why the chart has a break

The weekly VIX-backed reconstruction ends on **2026-02-13**, while the daily backfill starts on **2026-04-25**. That leaves **70 omitted calendar dates** (2026-02-14 through 2026-04-24, inclusive) between two scores 71 days apart.

The v9 chart intentionally refuses to connect points across a gap longer than 21 days. Do not remove this guard or linearly interpolate missing scores.

## Repair scope

Run `scripts/backfill-signal-history.mjs --repair-gap` against the production Signal database. This fixed profile restores **US / standard (Momentum) / social disabled** only.

- Use dated Yahoo `^VIX` historical closes and the existing v2.2.0 score reconstruction logic.
- Calendar dates without a new market quote use the most recent earlier VIX close, retaining the actual market observation date on the component.
- Put/call and AAII are used only if eligible historical observations exist at or before the reconstructed day; missing input weight uses the model's neutral reserve.
- Historical points are tagged `origin: reconstructed` with a source-coverage note; they must **not** be presented as contemporaneously observed signal snapshots.
- Existing `origin: observed` rows are protected by both candidate selection and the SQL `ON CONFLICT ... WHERE origin = 'reconstructed'` guard.
- The 7-day VIX freshness cutoff is enforced for this repair; missing/stale quotes abort the full repair before writes.

## Execute from a trusted environment that already has DATABASE_URL

1. Review the dry run (read-only): `node scripts/backfill-signal-history.mjs --repair-gap`.
2. Confirm the reported range, 70 target dates, source coverage, and candidate rows.
3. Apply the repair: `node scripts/backfill-signal-history.mjs --repair-gap --apply`.
4. Require the final `repairVerification` output to show `expectedDates: 70`, `presentDates: 70`, `missingDates: []`, and `invalidOrigins: []`.
5. Reload `/v9?market=US` and confirm the US standard/social-off recalculated score series connects through February–April 2026. If the API response is still cached, fetch `/api/signals/v2?market=US&mode=standard&enableSocial=false&refresh=true` from an authorized environment and recheck.

The script requires the real `DATABASE_URL` environment variable. **Do not paste the credential into a chat, PR, log, or shell history.** A PR merge or Vercel build by itself does not execute this database repair.

## Validation and limitations

- Production read-only API on 2026-11-23 returned 533 dated history records with the sole >21-day gap from 2026-02-13 to 2026-04-25. All existing records in that response had valid recalculated v2.2.0 scores.
- A point-in-time historical VIX query returned valid closes for all repair dates either on that date or within the prior three days. This confirms the VIX source suffices for the bounded reconstruction; the database may supply additional prior-dated institutional inputs.
- These values are **reconstructed scores**, not contemporaneous historical forecasts. Keep provenance, freshness and neutral-fallback caveats visible.
- This repair does not adjust the trend algorithm, infer indicator inputs, alter observed rows, or fill other intervals.

Automated offline checks: `node scripts/backfill-signal-history-qa.mjs`.
