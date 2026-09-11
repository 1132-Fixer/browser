# 1132 Fixer for Firefox

One-click Zoom cookie cleanup for Error 1132. This package is the Mozilla Firefox build of the
1132 Fixer browser extension. Source, issues, and CI: <https://github.com/1132-Fixer/browser>.

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

## How this build differs from the Chromium builds

- `browser_specific_settings.gecko.id` is `1132-fixer@1132-fixer.xyz`. Firefox requires a stable
  id to sign a Manifest V3 extension.
- `strict_min_version` is `140.0`, the current extended-support release and the first version with
  Firefox's built-in data-collection consent. (The in-page cleaner also needs `indexedDB.databases()`,
  Firefox 126+.)
- `data_collection_permissions.required` is `["none"]`: the fix flow collects and transmits nothing.
  `optional` is `["technicalAndInteraction"]`: the Report-a-Bug page sends the extension version, your
  browser's user-agent string, and a per-install support identifier together with your report, and
  Firefox asks for that consent when you press Submit. If you refuse, nothing is sent and the page
  says so.
- `minimum_chrome_version` is removed.
- Host access can be revoked by the user at any time in the Add-ons Manager. If that happened, the
  popup shows **ACCESS NEEDED** and pressing **FIX ZOOM** asks Firefox to grant Zoom site access
  again before it cleans anything.

The code uses the `browser.*` namespace through a feature-detected adapter. It never inspects the
user agent.

## Permissions

| Permission | Why |
|---|---|
| `cookies` | Find and remove Zoom cookies. |
| `activeTab` | Read the active tab's URL when you open the popup, and reload it after the cleanup. |
| `scripting` | Inject the one-shot cleaner into the active Zoom tab after you press FIX ZOOM. |
| `zoom.us` / `zoom.com` hosts | Limit cookie access and the injection to Zoom sites only. |

No `<all_urls>`, no `browsingData`, no `tabs`, no `history`, no background script, no content scripts,
no telemetry, no remote code.

## Load temporarily (developers and reviewers)

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on…** and select `manifest.json` in this folder.
3. Open a Zoom tab and click the 1132 Fixer icon.

Release and Beta builds of Firefox only install signed packages. Signing happens through
addons.mozilla.org; see `docs/release/firefox-signing.md` in the repository.

## Reproducible build (for AMO reviewers)

`popup.js` and `report.js` are bundled, unminified, from TypeScript sources in `packages/ui/src` of
the repository above using esbuild. To rebuild byte-identically:

```bash
git clone https://github.com/1132-Fixer/browser.git
cd chrome
git checkout v<this version>
npm ci
npm run build:firefox
```

Use the Node version in `.nvmrc`. Compare `dist/firefox/` with this package.

## Privacy

The fix flow makes no network request. The optional Report-a-Bug page sends only what you type and
attach, only when you press Submit. Full text: `PRIVACY_POLICY.md` in this package and
<https://1132-fixer.github.io/browser/privacy.html>.

## Licence and marks

Code, documentation, and design tokens: MIT (`LICENSE`). The 1132 Fixer names, logo, icons, and
brand artwork are not covered by the MIT licence; see `TRADEMARKS.md`, `ASSET-LICENSE.md`, and
`NOTICE.md`.
