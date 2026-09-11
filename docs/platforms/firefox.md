# Firefox

Firefox is the one target that is not Chromium. Its differences are handled in the manifest overlay,
the browser adapter, and the release process, never by copying code.

## Manifest differences (`apps/extensions/firefox/manifest.overlay.json`)

| Key | Value | Why |
|---|---|---|
| `browser_specific_settings.gecko.id` | `1132-fixer@1132-fixer.xyz` | Required to sign a Manifest V3 extension. AMO does not assign one. Never change it after the first signed upload. |
| `browser_specific_settings.gecko.strict_min_version` | `140.0` | The current extended-support release and the first version with Firefox's built-in data-collection consent, which this extension relies on (ADR 0007). Firefox 128 ESR reached end of life in 2025. `indexedDB.databases()` (126+) is covered too. |
| `browser_specific_settings.gecko.data_collection_permissions.required` | `["none"]` | Required for new AMO submissions since 3 November 2025. The fix flow collects and transmits nothing. |
| `browser_specific_settings.gecko.data_collection_permissions.optional` | `["technicalAndInteraction"]` | The Report-a-Bug page transmits the extension version, the user-agent string, and a per-install support identifier. Consent is requested from the Submit click (`permissions.request({ data_collection: [...] })`); refusal sends nothing. |
| `minimum_chrome_version` | removed | Chromium-only key. |
| `name`, `description` | Firefox wording | Store identity. |

Permissions, host permissions, CSP, icons, and the action are identical to the base manifest;
`tests/unit/targets.test.ts` asserts that.

## Runtime differences (handled by `packages/browser-api`)

- Namespace: `browser.*` is preferred when present; Gecko is detected by `runtime.getBrowserInfo`.
  No user-agent sniffing.
- Host access: users can revoke host permissions at any time in the Add-ons Manager. The popup checks
  `permissions.contains` on open; if access is missing it shows **ACCESS NEEDED** and, on FIX ZOOM,
  calls `permissions.request` synchronously inside the click handler (Firefox only prompts from a
  user-input handler). If the user refuses, nothing is read, removed, or injected.
- `cookies.getAll` / `cookies.remove` with `partitionKey` and `scripting.executeScript` with `func`
  behave as on Chromium.

## AMO data-collection decision (resolved 2026-09-11, ADR 0007)

Mozilla's Add-on Policies, section 6 ("Data Collection and Transmission Disclosure and Control",
read 2026-09-11), define data transmission as any data handled outside the add-on or the local
browser. The Report-a-Bug page transmits, only on Submit: the user's description, an optional
screenshot, the extension version, the user-agent string, and a per-install support principal
(a persistent identifier minted by the support service). Section 6.2.2.2 ("Implicit Consent for
Self-Evident, Single-Use Extension") would cover a user-initiated submission of the content the
user acted on, but it excludes transmissions that include persistent identifiers, so implicit
consent does not apply. Section 6.2.1 applies to add-ons that are only compatible with Firefox
140+ and use the built-in consent experience: the manifest must state the data practices
accurately. Decision:

- `strict_min_version` is `140.0`, so the built-in consent experience is always available.
- `required: ["none"]`: the fix flow (the extension's stated function) collects nothing.
- `optional: ["technicalAndInteraction"]`: version, user-agent, and the support identifier are
  technical data. The report page requests this consent synchronously in the Submit click handler
  and sends nothing if it is refused.
- The user's own description and screenshot are the content of the user's deliberate action; the
  form states exactly what Submit sends (self-evident UI), and the AMO listing must say the same
  (`docs/release/firefox-signing.md`).

Sources: `docs/research/primary-sources.md` (Firefox rows). This is an engineering decision that
Mozilla reviewers may still override at review time; if they require a stronger declaration, add it
to `optional` and request it on Submit the same way.

## Verification status

| Check | Status |
|---|---|
| Manifest composition and identity | `verify:manifests`, `verify:packages`, unit tests |
| `web-ext lint` on `dist/firefox` | `verify:manifests` (0 errors) |
| Data-collection consent requested on Submit, refusal sends nothing | `npm run test:e2e` (Firefox report suite) |
| Popup and report behaviour in the real Gecko engine (Playwright Firefox, mocked `browser.*` namespace) | `npm run test:e2e` |
| Host-access revoked / granted / refused paths | `npm run test:e2e` (both engines) |
| Installed as an extension in Firefox (`about:debugging` temporary load, then signed install) | **MANUAL_VALIDATION_REQUIRED.** Playwright cannot load extensions in Firefox. |
| AMO review and signing | **Requires store review.** |

## Local development

```bash
npm run dev:firefox
```

Then open `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on…**, and pick
`dist/firefox/manifest.json`. Reload the add-on after each rebuild.

## Signing and release

See `docs/release/firefox-signing.md`.
