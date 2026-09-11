# Firefox

Firefox is the one target that is not Chromium. Its differences are handled in the manifest overlay,
the browser adapter, and the release process, never by copying code.

## Manifest differences (`apps/extensions/firefox/manifest.overlay.json`)

| Key | Value | Why |
|---|---|---|
| `browser_specific_settings.gecko.id` | `1132-fixer@1132-fixer.xyz` | Required to sign a Manifest V3 extension. AMO does not assign one. Never change it after the first signed upload. |
| `browser_specific_settings.gecko.strict_min_version` | `128.0` | `indexedDB.databases()` needs Firefox 126; 128 is the extended-support release and the minimum that can still receive signed updates. |
| `browser_specific_settings.gecko.data_collection_permissions.required` | `["none"]` | Required for new AMO submissions since 3 November 2025. The fix flow collects and transmits nothing. |
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

## Open policy question: the Report-a-Bug page and data-collection consent

The manifest declares `required: ["none"]` because the fix flow collects nothing. The optional
Report-a-Bug page sends a report, an optional screenshot, the extension version, and the user-agent
string to the project's support service, only when the user presses Submit. Whether AMO treats a
user-authored support submission as "data collection" that must be declared (for example as optional
`technicalAndInteraction` requested through `permissions.request({ data_collection: [...] })`) has
not been ruled on. Resolve this with AMO policy before the first listed submission; if a declaration
is required, add the optional type and gate Submit on `permissions.request` in `report.ts`.

## Verification status

| Check | Status |
|---|---|
| Manifest composition and identity | `verify:manifests`, `verify:packages`, unit tests |
| `web-ext lint` on `dist/firefox` | `verify:manifests` (0 errors; 2 warnings about `data_collection_permissions` being newer than Firefox 128, expected) |
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
