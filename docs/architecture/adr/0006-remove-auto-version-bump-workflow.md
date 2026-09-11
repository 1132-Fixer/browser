# ADR 0006: Remove the automatic version-bump workflow

Status: accepted, 2026-09-10.

## Context

`.github/workflows/version-bump.yml` pushed a bot commit to `master` whenever runtime files changed.
The default branch is now `main` (the workflow never fired since the rename), and the repository
ruleset requires a pull request with one approval for every change to the default branch with no
bypass actors, so a bot push would be rejected.

## Decision

Delete the workflow. Versions change only through `npm run bump` (patch / minor / major) in a pull
request; the build refuses to run when any copy of the version drifts.

## Consequences

- Releases are explicit and reviewed.
- The store-prep checklist's "Automatic bump" row is replaced by the manual command.
