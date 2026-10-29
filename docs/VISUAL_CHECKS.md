# Visual comparisons (G7)

`npm run qa:visual` compares 20 fixture screenshots using the existing public
`playwright/test` export. No extra dependency or application behavior is added.
The `Visual comparisons` job is part of **Signal validation** and fails on a missing
golden or any changed pixel (`threshold: 0`, `maxDiffPixels: 0`, no retries).

## Coverage and evidence

Each light/dark desktop (1280x900) and phone (375x812) project captures:

- Market: connected score, evidence coverage and controls.
- Research: selected saved AAPL reading, returned quote and guest note layout.
- Holdings: populated local holdings/cash snapshot, research match and missing prices.
- Settings: open modal over Market, selected theme and default controls.
- Glossary: open P/E definition in the Valuation tab, with its surrounding context.

These are bounded viewport images, not every scroll position or browser workflow.
Existing interaction suites own tablet/narrow widths, errors, keyboard behavior,
other tabs, providers and owner access. This suite does not verify deployment.

`scripts/visual/fixtures.mjs` reuses the real Market request and Research read
fixtures with isolated providers/SQL. Compact guest records, a synthetic local
portfolio and the validated G5 skipped state are seeded only in fresh test contexts.
All unknown APIs, mutations and external requests are blocked and fail the test.
The public earnings Calendar POST is allowed only with its exact single-symbol,
null-review-fields payload and returns a fixed empty fixture. No real account,
provider or database is used.

Time is fixed at 2026-09-12T00:00:00Z, timezone Asia/Kuala_Lumpur, locale en-US,
DPR 1, headless Chromium and reduced motion. Service workers are blocked. The
suite waits for hydrated target controls, loaded bundled Source Sans 3 and Roboto
Mono, settled frames and two identical PNG captures. Screenshot animations and
carets are disabled. Every test checks document overflow and browser/request errors.

Diagnostics live in `.tmp/visual-checks/`, uploaded even on failure as the
`signal-visual-comparisons` artifact:

- `report/index.html`: Playwright report with images and traces.
- `results.json`: test results and attachment paths.
- `results/screens-<screen>-<project>/`: candidate PNG, `environment.json`, failure
  trace/screenshot, and Playwright's `*-expected.png`, `*-actual.png`, `*-diff.png`
  when an existing golden mismatches. A missing golden has no expected/diff image;
  its settled `*-candidate.png` is still uploaded and the job fails.
- `server.log`: owned production-server output.

## Rendering environment contract

Playwright **1.60.0**, Chromium **148.0.7778.96** (revision 1223), lockfile, fonts,
headless mode and capture configuration must be reviewed together. The config
fails if Playwright changes. Do not substitute installed Chrome.

CI runs on `ubuntu-24.04` inside the official Noble Playwright image pinned to:

```text
mcr.microsoft.com/playwright:v1.60.0-noble@sha256:9bd26ad900bb5e0f4dee75839e957a89ae89c2b7ab1e76050e559790e946b948
```

Linux execution requires that exact `SIGNAL_VISUAL_CONTAINER` value and Ubuntu
24.04 userspace. The workflow supplies it alongside the matching image. The
environment report records the browser, OS/kernel, architecture, image, viewport,
theme and font hashes; review unexpected differences before accepting images.

Baselines are under `scripts/visual/baselines/<renderer>/<project>/<screen>.png`.
Windows local baselines use `win32-10.0.19045-pw1.60.0`; the CI container uses
`linux-noble-9bd26ad900bb-pw1.60.0`. There is no fallback between them. A Windows
runner name alone does not establish matching rasterization. Hardware and runner
changes can still matter even with pinned userspace: investigate diffs rather than
loosening tolerances. See [Playwright visual comparison guidance](https://playwright.dev/docs/test-snapshots)
and [official Docker guidance](https://playwright.dev/docs/docker).

## Local use and deliberate failure proof

Check the configured port's ownership, build the application, then run typecheck after build.
`SIGNAL_QA_URL` may select another bare local HTTP origin for an isolated worktree;
fixtures enforce that exact origin. CI continues to use port 3000.
Use the documented placeholder DB URL. These guest browser scenarios intercept
the owner-session read; they do not unlock the server or require an owner secret.
The isolated Research read fixture supplies its existing fixture-only fallback.
Start one owned production server:

```powershell
$env:DATABASE_URL = 'postgresql://signal_ci:signal_ci@127.0.0.1:5432/signal_ci'
npm run build
npm run typecheck
npm run start -- --hostname 127.0.0.1 --port 3000
```

In another terminal in this checkout, run `npm run qa:visual`. Stop the owned
server at handoff. The suite never starts or reuses an unknown local server.

To prove the gate detects a controlled change without editing application CSS:

```powershell
$env:SIGNAL_VISUAL_PROBE = '1'
npm run qa:visual -- --project=desktop-light --grep 'market$'
# Must fail, with expected/actual/diff showing the injected magenta top border.
Remove-Item Env:SIGNAL_VISUAL_PROBE
npm run qa:visual -- --project=desktop-light --grep 'market$'
# Must pass against the original golden. Preserve probe artifacts before rerunning.
```

The probe cannot run in snapshot-update mode. CI also rejects all update modes,
including command-line overrides. Never combine a probe with baseline acceptance.

## Explicit baseline review/update

E28 Windows review (29 October 2026): reviewed and updated only the eight Market
and Settings PNGs across desktop/phone light/dark. Market now includes the qualified
Latest Market Brief; unavailable readings use the existing muted tier styling and
invalid accounting withholds the coverage ring. Settings changes are confined to the
dimmed Market background. The other twelve comparisons were unchanged. All twenty
normal comparisons pass at zero tolerance on win32-10.0.19045 / Playwright 1.60.0.
Review artifacts are in `.tmp/market-brief/` and `.tmp/visual-checks/`. Linux baseline
review and CI are separate delivery checks; Windows images must not be copied there.

E28 Linux review (29 October 2026): reviewed run `40860622370`, artifact
`12891073552`, head `d37dd5989cbdbfb6ae34778393d5774392b82a91`. Only the eight
Market and Settings comparisons differed; the other twelve passed unchanged.
All twenty environment reports match the pinned container, Chromium, font hashes,
clock, locale, timezone and DPR, with empty browser/request error arrays. Each
changed candidate matches its actual image, and each expected image matches the
previous Linux baseline. Independent expected/actual/diff/candidate review approved
the qualified brief, score wording and resulting Market height; Settings changes
are confined to its dimmed Market background. Copied only those eight approved
Linux candidates. The next normal CI run must establish zero-tolerance stability.

R3 Windows review (28 October 2026): updated only the four Research screenshots
for the new earnings availability line in the quote band and its resulting vertical
shift. All four Glossary comparisons stayed unchanged. The focused Research/Glossary
run passed 8/8 after review at zero tolerance on the isolated port 3113 server.
Ticket success and boundary screenshots are in `.tmp/research-earnings/`.

R3 Linux review (28 October 2026): reviewed run `40628422556`, artifact
`12789874827`, head `19be074f16e1213e020e6506fa467feb5ca40d44`. Sixteen comparisons
passed; only four Research images differed. All four expected/candidate/diff sets
show the intended earnings line and vertical shift, with consistent typography and
contained controls. The pinned container, Chromium, font hashes and empty browser
error arrays match the rendering contract. Accepted only those four Research PNGs;
the next normal CI run must prove zero-tolerance stability.

Initial local review on 25 October 2026 covered all 20 PNGs. Unchanged comparisons
passed at zero tolerance; a test-only 16px magenta border failed on 202,710 pixels,
with expected/actual/diff artifacts, and restoration passed. A temporarily missing
golden also failed without being recreated and retained its settled candidate.
The final Holdings captures scroll to the data panel so phone images include the
holding and cash totals. This is Windows-only proof, not Linux CI acceptance.

1. Reproduce the exact rendering environment and fixture state. Read the relevant
   source diff and expected/actual/diff images. Determine whether the change is intended.
2. For an intentional local update, select one affected screen and project:
   `npm run qa:visual -- --project=desktop-light --grep 'market$' --update-snapshots=changed`.
   For a new local baseline use `--update-snapshots=missing`; missing captures are
   written but that initial run still fails. Review the PNG before rerunning normally.
3. Inspect and stage only explicitly reviewed PNGs plus their necessary code/docs.
   Rerun the affected comparison without update flags, then the full matrix if
   shared rendering or fixture inputs changed. Never accept all differences automatically.

### Initial Linux enrollment (parent-owned remote follow-up)

The initial implementation contained reviewed Windows PNGs and local pass/fail/pass
proof. Docker was unavailable locally. The first CI job intentionally failed for missing
Linux goldens; it did not compare Windows PNGs or autoaccept its own output. The
reviewed candidates are now committed and the next normal comparison passed all 20.
This enrollment process remains the update contract:

1. Download `signal-visual-comparisons` for the exact reviewed PR head. All 20 tests
   must reach only the missing-golden assertion, with empty environment error arrays.
   Missing candidates, browser errors or other failures require a fix, not acceptance.
2. Inspect each of the 20 `results/screens-<screen>-<project>/<screen>-candidate.png`
   files and its `environment.json`. Confirm the pinned image, browser and font
   hashes. Compare intent and layout with the reviewed Windows references by eye,
   never through cross-platform pixel equality.
3. Copy only those approved candidate files to
   `scripts/visual/baselines/linux-noble-9bd26ad900bb-pw1.60.0/<project>/<screen>.png`,
   removing `-candidate` from each filename. Record the source run/head and review
   outcome here, commit the PNGs, and push. No automatic copying occurs in CI.
4. Require the next normal CI run in the same pinned container to pass all 20
   comparisons. Only then is Linux baseline stability established. For future
   intentional Linux changes use the same artifact-review process on the changed
   images; the existing expected/actual/diff artifacts provide the comparison.

The task that creates this PR hands remote verification to its parent immediately
after local proof and PR attachment; it does not wait for CI or merge the PR.

**Linux candidate review (2026-10-25):** accepted all 20 images from workflow run
`40192599021`, artifact `12598059704`, head `3d8c0f583f55504bcb48fa0aa597691242042056`.
Every test reached only the missing-golden assertion. Browser/image/font/clock/locale/
timezone/DPR metadata matched this contract; browser error arrays were empty.
Independent visual review accepted each candidate against the corresponding Windows
reference for intended state and layout, without cross-platform pixel equality. Phone
table scrolling and viewport crops are intentional. Only these reviewed PNGs were copied
to the Linux namespace. Workflow run `40193090823`, head `0764ebc`, then passed all 20
normal comparisons in the same pinned container at zero tolerance. This establishes the
Linux visual gate; these fixture images do not prove live-provider or deployment behavior.

**E25 Linux candidate review (2026-10-28):** accepted only the 12 changed Market,
Holdings and Settings images across desktop/phone and light/dark from workflow
[40200576760](https://github.com/hooiml/signal/actions/runs/40200576760), artifact
`12601663793`, PR #59 head `0b23e3e91e4b323159ded5572bca839d3225ea57`.
The tested merge `8e307f1e9d7247d1060afebb2037f43b0da4a082` has the same tree as
main `4304ce0aa5e875d0aeef111a305a49329dae7845`. All 20 environment reports match
the pinned container, Chromium, font hashes, clock, locale, timezone and DPR;
browser/request error arrays are empty. The 12 failures are screenshot mismatches
only; each candidate equals its actual image and each expected image equals the
previous Linux baseline. The eight Research/glossary candidates remain identical
to their existing Linux baselines.

Expected/actual/diff review and independent visual review accepted every changed
candidate against E25's source diff and approved Windows layout: the Market depth
label, consolidated Holdings caveats and compact cost table, and shorter Settings
copy. Holdings' shorter page changes the bounded capture's scroll position; phone
table scrolling and modal viewport crops remain intentional. No application code,
fixtures, tolerances, browser versions or Windows baselines changed. Review artifacts
and the verdict are in `.tmp/e25-linux/`.
Normal CI run [40623907818](https://github.com/hooiml/signal/actions/runs/40623907818),
head `92167f7`, passed all 20 comparisons at zero tolerance in the same pinned
container, including build and post-build typecheck. This establishes the updated
Linux baselines. The complete validation status is tracked in
[PR #60](https://github.com/hooiml/signal/pull/60); merge and deployment remain separate.
