# ADR 0007: Firefox 140 minimum and built-in data-collection consent for bug reports

Status: accepted, 2026-09-11.

## Context

Mozilla's Add-on Policies (section 6, read 2026-09-11) treat any data handled outside the add-on or
the local browser as data transmission. The fix flow transmits nothing. The Report-a-Bug page
transmits, only when the user presses Submit: the description, an optional screenshot, the extension
version, the user-agent string, and a per-install support principal issued by the support service.
The "implicit consent for self-evident, single-use extensions" clause excludes transmissions that
carry persistent identifiers, so it cannot cover the support principal. For add-ons compatible with
Firefox 139 or earlier, the policy requires an in-add-on consent experience; for add-ons only
compatible with Firefox 140+, the built-in consent declared in the manifest is the mechanism, and
new AMO submissions must declare it anyway. Firefox 128 ESR reached end of life in 2025; 140 is the
current ESR.

## Decision

- Raise `strict_min_version` to `140.0`.
- Declare `data_collection_permissions: { required: ["none"], optional: ["technicalAndInteraction"] }`.
- In the report page, call `permissions.request({ data_collection: ["technicalAndInteraction"] })`
  synchronously inside the Submit click handler through the adapter; if it resolves false, send
  nothing and say so. On Chromium the adapter resolves true without calling anything, because that
  consent surface does not exist there and the Chrome Web Store questionnaire carries the disclosure.
- State on the form exactly what Submit sends.

## Consequences

- Firefox 128 to 139 users cannot install the Firefox package. None of those versions receive
  security updates from Mozilla any more.
- `web-ext lint` no longer warns about the data-collection key being newer than the minimum version.
- The AMO listing text must describe the report page's transmission (`docs/release/firefox-signing.md`).
- Mozilla reviewers can still require a broader declaration; the same request path accommodates it.
