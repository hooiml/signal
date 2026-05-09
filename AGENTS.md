# Agent Guide

This file is the map, not the manual. Keep it short so agents can quickly find the repo-local sources of truth.

## Start Here

- Architecture: `docs/ARCHITECTURE.md`
- Testing and verification: `docs/TESTING.md`
- Quality rules: `docs/QUALITY.md`
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

