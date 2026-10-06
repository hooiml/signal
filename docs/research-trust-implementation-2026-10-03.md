# Research trust slice — 3 October 2026

Status: implemented and locally verified; **full acceptance remains incomplete**.
The required live supported US assessment is blocked by missing SEC operator identification.
No deployment, provider configuration change, database migration or live research write was performed.

## Revision and baseline

- Baseline: `8b492fa664f39e91f693b4fc379f3d8f1098feec`, confirmed against remote `main` before editing.
- Implementation branch: `fix/research-trust-unsaved`. The delivery message identifies the tested commit; this report and the evidence are included in that commit.
- Production builds and browser checks used this branch's implementation. Final script/docs changes do not change the application build.
- Reproduced Malaysian Market mismatch: the calculation used scaled FX input 12 while the indicator displayed US VIX 20 under an FX label.
- Reproduced FCF yield precision: expected 0.40%, 3.46%, and −0.40% displayed/calculated as 0%, 3%, and 0%.
- Reproduced unsaved lookup barrier: MSFT with only AAPL saved made no provider request and produced no evidence within the 3-second observation window, in all three runs.
- Reproduced live US fundamentals failure: AAPL quote returned, SEC fundamentals did not. Provider warning: `SEC discovery is unavailable until SEC_USER_AGENT identifies the operator and contact.`

## Changes and result implications

1. Research accepts an unsaved ticker and US/MY market, fetches independently of saved-list availability, and keeps saved research optional. Keyed views, abort handling and identity validation prevent late/mismatched responses from appearing under another security.
2. Saving requires an explicit button action. `saveOnly` bookmarks have unknown thesis strength, unrecorded confidence and decision, empty notes and no review history. Save failure retains the reading; a late list response cannot discard a completed save. Compatibility changes let older Research views read the new empty states.
3. Assessment applicability now requires Yahoo's `EQUITY` type and excludes names matching financial-business/property-trust terms. Funds, indices, unknown types and these exclusions retain valid facts but withhold the company assessment. **This changes assessment eligibility.** It is a conservative name check, not a comprehensive sector classifier; specialized businesses whose names do not match remain a limitation.
4. Quote observation time is distinct from retrieval time. Existing Research source/period/age thresholds and financial interpretation rules are unchanged. No change-detection policy was added.
5. Malaysian Market displays the actual scaled FX input and its units, or explicitly labels the US VIX fallback. Retrieval timestamps no longer claim observation freshness in the affected V8 indicator. Incompatible old raw-history series are excluded from that indicator line; stored history is not rewritten. **Displayed values/source labels change; scoring weights, normalization and calculated Market results do not.** Thirteen comparable fixture payloads across all eight market/mode/source combinations retained their composite scores, tiers and component weights.
6. FCF yield multiplies the ratio by 100 before rounding. **This changes returned/calculated yield values**, including small positive and negative values; it does not change the current three-input business assessment.
7. Malaysian symbols already ending in `.KL` no longer receive a duplicate suffix.

The version switcher, broad layouts, scoring design and new historical-learning features were outside the change.

## Verification

| Check | Result and boundary |
| --- | --- |
| Lint, TypeScript, production build | Passed |
| Full repository harness | Passed, including Research/read/currency, Learn, Market request and new trust regressions |
| Scoring regression | Passed |
| Defect regression | Reproduces original revision with `--baseline`; corrected implementation passes with isolated provider/SQL boundaries |
| Browser fixture matrix | Passed at 1280, 768 and 375px; no unexpected page/console/request failures; overflow and control overlap checks passed |
| Supported US fixture | Unsaved sourced evidence and supported assessment passed |
| Supported MY fixture | Unsaved evidence, MYR amounts and supported assessment passed |
| Partial/missing fixtures | Partial assessment/explicit insufficiency; valid facts retained |
| Unsupported fixtures | ETF, bank-name and unidentified instrument assessment withheld; facts retained |
| Selection fixtures | Rapid SLOW → MSFT switch, late response and wrong-symbol payload passed |
| Saving fixtures | No automatic POST; explicit payload, failure/retry, no manufactured decision, delayed-list race passed |
| Saved-list failure fixture | Independent Research evidence remained usable |
| Market UI fixture | MY fallback label and unavailable observation date passed at all three widths |

Screenshots were inspected at desktop and mobile sizes. The browser fixtures block service workers;
the existing offline-support notice in screenshots is a test-environment consequence, not verified offline behavior.

### Live provider verification

The changed local **production build** used real provider requests. Only the watchlist GET was
intercepted with an empty list to avoid accessing personal records. No save was attempted.
These results establish provider-to-UI behavior, not live database persistence.

| Case | Result on 3 October 2026 |
| --- | --- |
| Tenaga, `5347`, MY | **Pass**: Yahoo EQUITY, MYR 12.96 quote, annual period 2025-12-31, sourced financial evidence and “Reported financial pressures” assessment. No provider warning. |
| Apple, `AAPL`, US | **Blocked supported case**: Yahoo EQUITY and USD 333.69 quote; SEC financial evidence absent, “Not enough financial data.” Correct limitation handling does not satisfy the supported-US acceptance requirement. |
| Maybank, `MAYBANK`, MY | **Pass unsupported case**: MYR 10.02 quote and financial facts retained; company assessment explicitly withheld. |
| Vanguard S&P 500 ETF, `VOO`, US | **Pass unsupported case**: ETF identification and USD 707.54 quote retained; company assessment withheld. SEC source notice also present. |

All four live browser cases had no page errors. Quote dates were 2 October; retrieval was 3 October.
The prices are recorded verification observations, not current investment guidance.

## Comparable timing measurements

Three runs per case per revision, production builds on the same local machine, Chrome at
1280×900, fresh browser contexts, service workers blocked, all APIs intercepted, fixed
250ms saved-list and 300ms provider delays, no network throttling or provider failures.
Thus provider cache-hit/miss differences do not explain the comparison. Measurements use
Playwright-visible milestones from navigation and include its polling overhead. Small sample;
no production speed or statistical significance claim.

| Journey / median milestone | Before | After |
| --- | ---: | ---: |
| Saved AAPL: first visible heading | 217ms | 278ms |
| Saved AAPL: first usable quote | 1,029ms | 1,083ms |
| Saved AAPL: supported assessment | 1,035ms | 1,091ms |
| Unsaved MSFT: first visible heading | 202ms | 241ms |
| Unsaved MSFT: first usable quote | Unavailable; provider never requested | 1,058ms |
| Unsaved MSFT: supported assessment | Unavailable; provider never requested | 1,064ms |

**No measured saved-journey speed improvement.** The demonstrated improvement is that the
unsaved journey works and does not depend on saved-list success. Single live request timings
from different deployment/local/cache conditions were excluded from performance claims.

Raw timing runs and browser/live summaries: [evidence JSON](evidence/research-trust-2026-10-03.json).
Reproduce fixture timings with `node scripts/research-reading-timing.mjs after 3102` against a
local production server; set `CHROME_PATH` if no bundled Playwright browser is installed.

## Remaining acceptance gaps and limitations

- Configure a legitimate operator identity and monitored contact as `SEC_USER_AGENT` in the intended environment, then rerun a supported US case end to end. No invented contact was substituted. Further upstream issues may become visible after this prerequisite is fixed.
- Explicit saving passed UI fixtures and real record/parser regressions; live database persistence was **not verified**. Verify it against the intended database before release.
- The existing non-null `last_reviewed_at` column receives bookmark creation date. V8 labels an unrecorded decision as “no personal review” and does not present that date as an authored review. Older surfaces may still expose this legacy date; no schema redesign was included.
- Name-based applicability exclusions are incomplete by design. They are not a new sector classification service or sector-specific valuation model.
- No deployment was performed. Full completion must not be claimed until the required supported US journey passes; release verification must also cover actual saving.
