# Microsoft Edge

Edge is a Chromium-family target. The code is identical to Chrome; only the store identity differs.

## Facts

| Item | Value |
|---|---|
| Overlay | `apps/extensions/edge/manifest.overlay.json`: `name` "1132 Fixer for Edge", Edge description |
| Store | Microsoft Edge Add-ons via Partner Center. Not yet listed. |
| Certification rule | Microsoft requires that a package does not brand itself as a Chrome extension in `name` or `description`, and that `update_url` is absent. `verify:packages` enforces both. |
| Package | `release/edge/1132-fixer-edge-<version>.zip` |

## Verification status

| Check | Status |
|---|---|
| Manifest composition, no Chrome claim, no `update_url` | `verify:manifests`, `verify:packages` |
| Install unpacked and first run | `npm run test:e2e:install` loads `dist/edge` into Playwright Chromium. Microsoft Edge (branded) removed the side-load flags, so branded Edge is MANUAL_VALIDATION_REQUIRED. |
| Behaviour | Shared with Chrome (same engine family, same bundle) |
| Edge Add-ons certification | Requires store review |

## Manual check in branded Edge

1. `npm run build:edge`
2. Open `edge://extensions`, enable Developer mode, **Load unpacked**, choose `dist/edge`.
3. Repeat the Zoom / non-Zoom checks from `docs/platforms/chrome.md`.

## Submission

Partner Center: upload `release/edge/1132-fixer-edge-<version>.zip`; fill the Privacy page using
`docs/security/permissions-matrix.md` for the per-permission justification and
`https://1132-fixer.github.io/chrome/privacy.html` as the privacy policy URL; add certification
notes pointing at the target README's manual test steps. See `docs/release/store-preparation.md`.
