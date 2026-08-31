# Codex Prompt — Implement Signal Learn from Release Specifications

Use this prompt when starting implementation of a Signal Learn release in Codex.

---

## Recommended first use

Start with **v0.1 only**.

Attach or reference:

- `signal-learn-v0.1-spec.md`
- the existing Signal repository
- optionally the higher-version specifications for context, but **do not implement them yet**

---

## Prompt

You are working inside the existing Signal codebase.

I am adding **Signal Learn**, an evidence-based investing and short-term trading education system.

The release specification supplied with this task is the source of truth for product behavior and scope.

### Primary instruction

Read the entire release specification before modifying code.

Then inspect the existing repository and determine how this feature should integrate with the current architecture, design system, routing, state management, data layer, API conventions, testing approach and responsive behavior.

Do **not** assume a framework, directory structure or architectural pattern that you have not verified from the repository.

### Product philosophy that must be preserved

Signal Learn teaches users to interpret evidence rather than blindly follow financial metrics or technical indicators.

It must distinguish:

- facts;
- interpretations;
- expectations;
- theses;
- uncertainty.

Historical exercises must avoid hindsight/look-ahead bias.

Current-market exercises must never imply that future outcomes are known.

The AI role, where present, is an explainer and reasoning challenger rather than an automatic stock picker or trade-signal generator.

Never convert a metric or technical indicator into an unsupported deterministic Buy/Sell label.

### Before implementation

Perform a repository audit relevant to this release.

Identify:

1. current application architecture;
2. routing/navigation relevant to adding Learn;
3. reusable UI components;
4. charting/data-visualization components;
5. state-management approach;
6. API/data-fetching conventions;
7. authentication/user persistence if relevant;
8. existing market/company data models;
9. existing financial-data sources;
10. testing frameworks;
11. mobile/responsive patterns;
12. loading/error/empty-state conventions;
13. source/provenance handling if any;
14. any existing Research/Market components that should be reused instead of duplicated.

### Then create an implementation plan

Before writing production code, produce a concise but concrete implementation plan containing:

#### A. Existing architecture findings
State what you verified from the repository.

#### B. Spec-to-code mapping
Map each required screen, flow and domain concept in the release spec to:

- existing code to reuse;
- code to extend;
- new code required.

#### C. Proposed domain/state model
Only introduce abstractions required by the current release.

Do not prematurely implement v0.2/v0.3/v0.4 architecture unless a small extensibility decision is clearly justified.

#### D. Data strategy
For every market/financial field required by the release, identify:

- whether an existing source already provides it;
- timestamp/freshness semantics;
- historical point-in-time availability;
- source/provenance requirements;
- missing-data behavior.

Do not fabricate unavailable data.

#### E. Historical Replay integrity
Explain how `effectiveAt` and `knownAsOf` or equivalent timestamps will be represented and enforced.

Point-in-time filtering must prevent future:

- prices;
- filings;
- estimates;
- news/events;
- derived indicator values where relevant.

Include deterministic tests for future-data leakage.

#### F. UI/UX plan
Describe:

- desktop layout;
- mobile layout;
- interaction states;
- loading states;
- error states;
- empty states;
- selected/active states;
- keyboard/focus behavior;
- reduced-motion behavior where applicable.

#### G. Test plan
Include unit, integration and end-to-end coverage appropriate to the repo.

Acceptance criteria from the release specification must be mapped to tests wherever practical.

#### H. Implementation slices
Break work into small, reviewable slices.

Each slice should leave the application in a runnable state.

### Implementation rules

After the plan, implement the release incrementally.

For each slice:

1. reuse existing design/system components where reasonable;
2. keep changes scoped to the release;
3. avoid unrelated refactoring;
4. preserve existing Market and Research behavior;
5. add or update tests;
6. run relevant lint/typecheck/test/build commands;
7. fix regressions caused by the changes;
8. summarize what changed and what remains.

### Data integrity rules

Never:

- invent a financial value;
- substitute a current value into a historical replay without explicit labeling;
- use later analyst estimates in an earlier replay;
- expose future prices before the learner commits;
- use a retrospective article as if it were point-in-time evidence;
- silently normalize data without documented methodology.

If point-in-time data cannot be guaranteed, the UI should explicitly mark the limitation or block that replay scenario rather than pretending it is historically clean.

### Reasoning/outcome rule

Historical Replay must preserve the user's original commitment.

The learner's initial:

- thesis;
- evidence;
- invalidation condition;
- confidence

must become immutable after the future is revealed.

Later reflection is appended separately.

Do not grade the learner solely according to subsequent stock price or trade P&L.

### AI behavior rules

If implementing AI-assisted functionality, AI may:

- explain;
- ask Socratic questions;
- challenge unsupported reasoning;
- highlight contradictory supplied evidence;
- help the user articulate assumptions;
- summarize a debrief.

AI must not:

- create hidden Buy/Sell ratings;
- claim certainty about future price;
- fabricate missing data;
- silently rewrite the user's thesis;
- present historical outcome knowledge before commitment.

### Scope control

Implement only the version requested.

If the current task is v0.1:

- do not implement v0.2 financial-statement modules;
- do not implement v0.3 portfolio/scenario systems beyond what v0.1 explicitly requires;
- do not implement v0.4 trading features.

You may leave clean extension points where justified, but avoid speculative architecture.

### Quality bar

The feature should feel like part of Signal, not a separate prototype bolted onto it.

Prioritize:

- clarity;
- evidence provenance;
- interaction feedback;
- responsive behavior;
- accessibility;
- deterministic historical integrity;
- maintainability;
- minimal cognitive load.

Avoid decorative animation or unnecessary dashboard density.

### Completion report

When the requested release is complete, provide:

1. files changed;
2. features implemented;
3. test/build commands executed and results;
4. acceptance criteria satisfied;
5. any acceptance criteria not satisfied;
6. missing or unreliable data sources;
7. technical debt intentionally deferred;
8. recommended next implementation slice or release.

Do not claim completion if any critical historical-data integrity requirement is unverified.

---

## Release usage

### v0.1
Use:
`signal-learn-v0.1-spec.md`

Goal:
Prove the Learn → Replay → Apply → Thesis → Reflect loop using EPS, P/E, Forward P/E, Earnings Growth and Expectations.

### v0.2
Use only after v0.1 is stable:
`signal-learn-v0.2-spec.md`

Goal:
Teach the underlying business through financial statements, margins, FCF, debt, ROIC and dilution.

### v0.3
Use only after v0.2 is stable:
`signal-learn-v0.3-spec.md`

Goal:
Combine business, valuation, expectations and macro evidence into complete investment analysis, scenarios, portfolio risk and journaling.

### v0.4
Use only after v0.3 is stable:
`signal-learn-v0.4-spec.md`

Goal:
Add structured short-term trading education covering price behavior, technical context, execution, risk, expectancy and strategy validation.

---

## Suggested opening command for v0.1

Read `signal-learn-v0.1-spec.md` completely, inspect the existing Signal repository, and perform the repository audit and implementation plan described in the Codex prompt. Do not write production code until you have mapped the v0.1 requirements to the verified existing architecture. After presenting the plan, proceed with the smallest coherent v0.1 implementation slice unless you encounter a genuine blocker that cannot be resolved from the repository.
