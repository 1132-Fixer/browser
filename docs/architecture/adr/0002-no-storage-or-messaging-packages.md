# ADR 0002: No `storage` or `messaging` packages

Status: accepted, 2026-09-10.

## Context

The reference layout lists `packages/storage` and `packages/messaging`. This extension has no
background worker, no content scripts, no `runtime.sendMessage`, no `externally_connectable`, and
stores nothing in the popup. The report page keeps a single support-principal token under one
`localStorage` key on the extension origin.

## Decision

Do not create either package. The compatibility layer covers only capabilities the project uses
(runtime manifest, active tab, cookies, one injection, permissions). The repository's own working
principle ("no abstractions for single-use code") and the directive's instruction to cover only
needed capabilities agree.

## Consequences

- If a background worker or content script is ever added, create `packages/messaging` with typed
  message schemas validated at the trust boundary in the same change, and extend
  `tests/integration/validate-source.js` to forbid unvalidated dispatch.
- If a second stored value is ever added, create `packages/storage` then.
