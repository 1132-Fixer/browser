# Google Chrome

Chrome is the base target. `apps/extensions/chrome/manifest.json` is the one hand-maintained
manifest; every other extension target is composed from it.

## Facts

| Item | Value |
|---|---|
| Manifest | V3, `minimum_chrome_version` 114 |
| Store | Chrome Web Store, item `fccnmckeeddpkhocebnbfnlapcjllljh` (live listing measured at 1.2.1 on 2026-08-23; this repository does not publish automatically) |
| Permissions | `cookies`, `activeTab`, `scripting`; hosts `zoom.us` / `zoom.com` over http and https |
| CSP | `script-src 'self'; object-src 'self';` (the Chrome default, declared explicitly) |
| Package | `release/chrome/1132-fixer-chrome-<version>.zip`, 19 entries, manifest bytes verbatim from the source |

## Behaviour notes

- Host permissions are granted at install. The popup still checks `permissions.contains` because
  Chrome lets users restrict site access per extension; the ACCESS NEEDED path then applies.
- `cookies.getAll` with an empty `partitionKey` (Chrome 119+) returns every partition; older Chrome
  rejects the filter and the code falls back to the unpartitioned query.
- `activeTab` is invoked by opening the popup, which is what allows `tabs.query` to return the URL
  and `scripting.executeScript` to target the tab.

## Verification status

| Check | Status |
|---|---|
| Source guards, manifest, permissions, package | `npm run check` |
| Popup and report behaviour (Playwright Chromium, mocked `chrome.*`) | `npm run test:e2e` |
| Install unpacked, real `chrome.*`, first run, host access granted, no `<all_urls>` | `npm run test:e2e:install` (Playwright Chromium; branded Google Chrome cannot side-load via flags) |
| Branded Google Chrome load-unpacked | MANUAL_VALIDATION_REQUIRED (steps below) |
| Chrome Web Store review | Requires store review |

## Manual check in branded Chrome

1. `npm run build:chrome`
2. Open `chrome://extensions`, enable Developer mode, **Load unpacked**, choose `dist/chrome`.
3. Open `https://zoom.us`, click the icon: **ZOOM DETECTED**, press **FIX ZOOM**, expect
   **CLEARED** and a reload.
4. Open a non-Zoom tab, click the icon: **NOT ZOOM**, no button.

## Store submission

`docs/release/store-preparation.md` and `docs/release/chrome-web-store-listing.md`. The manual
workflow `.github/workflows/publish-chrome-web-store.yml` uploads a draft only when an operator
dispatches it with the expected version typed in.
