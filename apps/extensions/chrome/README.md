# 1132 Fixer for Chrome

One-click Zoom cookie cleanup for Error 1132. This package is the Google Chrome build of the
1132 Fixer browser extension. Source, issues, and CI: <https://github.com/1132-Fixer/chrome>.

Independent project. Not affiliated with Zoom Video Communications, Inc.

## What it does

When the active tab is on `zoom.us`, `zoom.com`, or a subdomain, the popup shows **ZOOM DETECTED**
and one **FIX ZOOM** button. After you press it, and only then, the extension:

1. Deletes cookies for `zoom.us` and `zoom.com`, including subdomains and partitioned cookies.
2. Clears this tab's Zoom-origin `localStorage`, `sessionStorage`, Cache API, and IndexedDB with a
   one-shot, origin-checked script.
3. Reloads the active Zoom tab.
4. Reports a cookie count and whether the tab's site data was cleared. Values are never shown.

It reports the operation result. It does not detect Error 1132 and does not verify that Zoom
recovered.

## Permissions

| Permission | Why |
|---|---|
| `cookies` | Find and remove Zoom cookies. |
| `activeTab` | Read the active tab's URL when you open the popup, and reload it after the cleanup. |
| `scripting` | Inject the one-shot cleaner into the active Zoom tab after you press FIX ZOOM. |
| `zoom.us` / `zoom.com` hosts | Limit cookie access and the injection to Zoom sites only. |

No `<all_urls>`, no `browsingData`, no `tabs`, no `history`, no background worker, no content scripts,
no telemetry, no remote code.

## Load unpacked (developers and reviewers)

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder (it contains `manifest.json`).
4. Open a Zoom tab and click the 1132 Fixer icon.

## Reproducible build

`popup.js` and `report.js` are bundled, unminified, from TypeScript sources in `packages/ui/src` of
the repository above. To rebuild byte-identically: clone the repository at the tag matching this
version, run `npm ci` and `npm run build:chrome` with the Node version in `.nvmrc`, then compare
`dist/chrome/` with this folder.

## Privacy

The fix flow makes no network request. The optional Report-a-Bug page sends only what you type and
attach, only when you press Submit. Full text: `PRIVACY_POLICY.md` in this package and
<https://1132-fixer.github.io/chrome/privacy.html>.

## Licence and marks

Code, documentation, and design tokens: MIT (`LICENSE`). The 1132 Fixer names, logo, icons, and
brand artwork are not covered by the MIT licence; see `TRADEMARKS.md`, `ASSET-LICENSE.md`, and
`NOTICE.md`.
