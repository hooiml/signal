# Agent Guide

This file is the map, not the manual. Keep it short so agents can quickly find the repo-local sources of truth.

## Start Here

- Architecture: `docs/ARCHITECTURE.md`
- Testing and verification: `docs/TESTING.md`
- Quality rules: `docs/QUALITY.md`
- Harness engineering standards: `docs/HARNESS.md`
- Repo workflows: `docs/WORKFLOWS.md`
- Signal scoring rules: `docs/signal-scoring.md`
- Generated repo map: `docs/generated/repo-map.md`

## Required Behavior

- Keep changes small, reversible, and scoped to the requested behavior.
- Reuse existing repo patterns before adding new abstractions.
- Validate external data and request parameters at route or service boundaries.
- Do not add dependencies unless the existing stack cannot solve the problem.
- Update docs when behavior, commands, architecture, or operating rules change.
- Run the verification commands in `docs/TESTING.md` before claiming completion.
- Use the LIGHT lane for docs, scripts, package scripts, and harness-only changes; use UI-LIGHT for isolated non-shared UI changes, and escalate to Standard when shared components, routes, responsive behavior, API state, or visual-reference fidelity are affected.
- For UI changes involving screenshots, alignment, spacing, or visual polish, follow the Visual QA Contract in `docs/TESTING.md`; do not claim completion from lint, typecheck, or build alone.
