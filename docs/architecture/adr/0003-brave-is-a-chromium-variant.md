# ADR 0003: Brave is a Chromium variant, not a fourth pipeline

Status: accepted, 2026-09-10 (restates the operator ruling in issue #20 and the merged PR #22).

## Context

Brave installs extensions from the Chrome Web Store. There is no Brave store. PR #22 added a Brave
zip so that a package loaded unpacked in Brave does not describe itself as a Chrome extension.

## Decision

Keep `brave` as an extension target that shares the Chromium bundle and differs only in the manifest
`name` and `description`. Document the supported path for Brave users as the Chrome Web Store
package. No Brave-specific code, tests, or store metadata beyond the overlay.

## Consequences

- One more zip per release; zero extra code.
- Other Chromium browsers can load the Chrome package but are not claimed as supported.
