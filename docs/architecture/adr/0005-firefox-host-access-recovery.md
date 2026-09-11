# ADR 0005: Handle revoked host access in the popup

Status: accepted, 2026-09-10.

## Context

Firefox treats host permissions as user-revocable at any time (MDN `host_permissions`). Chrome lets
users restrict an extension's site access too. The previous popup assumed access and would have
reported a partial failure with a misleading "cookie jar" message.

## Decision

The adapter exposes `hasHostAccess` and `requestHostAccess` (both built on the `permissions` API,
which needs no manifest entry). On open, the popup checks access when the tab is a Zoom tab; if
missing it shows **ACCESS NEEDED** and keeps the single FIX ZOOM button. On click it calls
`requestHostAccess` synchronously before any `await`, because Firefox only prompts from a user-input
handler. Refusal shows the recovery path and performs no cleanup. Browsers without a `permissions`
API are treated as having install-time access.

## Consequences

- No new manifest permission. `optional_host_permissions` is not used; the request names the same
  four Zoom patterns that are already in `host_permissions`.
- The one-button rule holds.
- `lint` checks the request-before-await ordering; e2e covers granted, refused, and no-API cases on
  both engines.
