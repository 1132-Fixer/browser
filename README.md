<p align="center">
  <img src="assets/social-preview.png" alt="1132 Fixer — A focused browser cleanup for Zoom error 1132" width="960">
</p>

<h1 align="center">1132 Fixer Browser Extension</h1>

<p align="center">
  <strong>One-click Zoom cookie cleanup for Error 1132.</strong><br>
  Clears Zoom cookies and this tab's Zoom site data, then reloads the current Zoom tab.<br>
  One shared implementation. Independently packaged for Chrome, Edge, Brave, and Firefox, plus a BRAVIA TV guide.
</p>

<p align="center">
  <img alt="Source version 1.2.7" src="https://img.shields.io/badge/source-v1.2.7-3A82F7">
  <img alt="Manifest V3" src="https://img.shields.io/badge/Manifest-V3-4285F4">
  <img alt="Local only" src="https://img.shields.io/badge/Privacy-Local%20only-39D353">
  <img alt="Zoom only" src="https://img.shields.io/badge/Scope-Zoom%20only-3A82F7">
  <img alt="MIT license" src="https://img.shields.io/badge/License-MIT-8FC2FF">
  <a href="https://github.com/1132-Fixer/chrome/actions/workflows/ci.yml"><img alt="Build status" src="https://github.com/1132-Fixer/chrome/actions/workflows/ci.yml/badge.svg"></a>
</p>

<p align="center">
  <a href="https://1132-fixer.xyz/"><strong>Visit Website</strong></a>
  &nbsp;•&nbsp;
  <a href="https://github.com/1132-Fixer/chrome/issues/new"><strong>Feedback &amp; Report</strong></a>
  &nbsp;•&nbsp;
  <a href="PRIVACY_POLICY.md"><strong>Privacy Policy</strong></a>
  &nbsp;•&nbsp;
  <a href="https://github.com/1132-Fixer/windows/releases/latest"><strong>Windows App</strong></a>
</p>

This is the canonical public source for the 1132 Fixer browser extension. Issues, pull requests, and
CI live here. Companion products: [Windows](https://github.com/1132-Fixer/windows) and
[macOS](https://github.com/1132-Fixer/macos).

Independent project. Not affiliated with Zoom Video Communications, Inc.

## What it does

When the active tab is on `zoom.us`, `zoom.com`, or a subdomain, the popup shows **ZOOM DETECTED**
and one **FIX ZOOM** button. After you press it, and only then, the extension:

1. Deletes cookies for `zoom.us` and `zoom.com`, including subdomains and partitioned cookies.
2. Clears this tab's Zoom-origin `localStorage`, `sessionStorage`, Cache API, and IndexedDB with a
   one-shot, origin-checked injected function.
3. Reloads the active Zoom tab.
4. Reports a cookie count and whether the tab's site data was cleared. Values are never shown.

On any other page the popup shows **NOT ZOOM** and no button. If the browser has revoked the
extension's Zoom site access, it shows **ACCESS NEEDED** and asks for it when you press FIX ZOOM.

It reports the operation result. It does not detect Error 1132 and cannot verify that Zoom
recovered. If the error survives a browser cleanup, use the Windows app.

## Supported targets

| Target | Package | Runtime status | Notes |
|---|---|---|---|
| Google Chrome | `release/chrome/1132-fixer-chrome-<v>.zip` | Automated behaviour tests (Chromium) and install smoke; branded Chrome manual | Base manifest. Chrome Web Store listing exists (older version). |
| Microsoft Edge | `release/edge/1132-fixer-edge-<v>.zip` | Install smoke in Chromium; branded Edge manual | Own store identity for Edge Add-ons. Not yet listed. |
| Brave | `release/brave/1132-fixer-brave-<v>.zip` | Install smoke in Chromium; branded Brave manual | Brave users install the Chrome Web Store package. |
| Mozilla Firefox | `release/firefox/1132-fixer-firefox-<v>.zip` | Automated behaviour tests in real Gecko; `web-ext lint`; extension install manual | Own Gecko id, Firefox 128+, data-collection declaration. AMO signing is manual. |
| Sony BRAVIA Professional Displays | `release/bravia/1132-fixer-bravia-<v>.zip` | Emulated at TV viewports; physical display validation required | A ten-foot guide client for Sony's HTML5 runtime. The extension cannot run on a TV. |
| Sony BRAVIA consumer TVs | none | Unsupported | No extension runtime. |
| Safari | none | Not implemented | Path documented in `docs/platforms/safari.md`. |

Full matrix with status vocabulary: [docs/platforms/compatibility-matrix.md](docs/platforms/compatibility-matrix.md).

## Quick start

```bash
git clone https://github.com/1132-Fixer/chrome.git
cd chrome
npm ci
npx playwright install chromium firefox
npm run check          # lint, typecheck, unit, build, manifests, permissions, integration, package, packages, e2e
```

Load a build unpacked: `npm run build:chrome`, then `chrome://extensions` → Developer mode → Load
unpacked → `dist/chrome`. Firefox: `npm run build:firefox`, then `about:debugging` → Load Temporary
Add-on → `dist/firefox/manifest.json`. Windows helper: `install.bat` opens the Chrome extensions
page and the `dist/chrome` folder.

## Repository structure

```text
apps/extensions/{chrome,edge,brave,firefox}   manifest (base or overlay) + shipped README per target
apps/tv/bravia                                 BRAVIA TV guide client + Sony launcher package
packages/core                                  the one cleanup implementation (no browser namespace)
packages/browser-api                           feature-detected adapter over browser.* / chrome.*
packages/ui                                    popup and report pages, icons
packages/platform-types, packages/test-utils   shared types; recording namespace mock for tests
tooling/{build,packaging,release,store-assets} build, zip, verify, bump, store assets
tests/{unit,integration,end-to-end}            node:test, source/build guards, Playwright suites
docs/                                          architecture, research, platforms, security, testing, release
```

Details: [docs/architecture/repository-layout.md](docs/architecture/repository-layout.md).

## Common commands

| Command | What it does |
|---|---|
| `npm run dev:<target>` | Build one target and rebuild on change (`chrome`, `edge`, `brave`, `firefox`, `bravia`). |
| `npm run build` / `build:<target>` | Write `dist/<target>/`. |
| `npm run package` / `package:<target>` | Zip `dist/<target>/` into `release/` with SHA-256 sums. |
| `npm run lint` | Source guards: Zoom-only, one browser boundary, nothing before FIX ZOOM, no telemetry or remote code, approved claim, no secrets. |
| `npm run typecheck` | Strict TypeScript check. |
| `npm test` | Unit + integration (needs a build for integration). |
| `npm run test:e2e` | Playwright matrix: Chromium, Firefox, extension install smoke, BRAVIA client. |
| `npm run verify:manifests` / `verify:permissions` / `verify:packages` | Generated manifests (+ `web-ext lint`), permission justifications, release zips. |
| `npm run check` | Everything, in CI order. |
| `npm run bump` | Patch version everywhere (never hand-edit versions). |
| `npm run assets` | Chrome Web Store screenshots and promo images. |

## Permissions

| Permission | Why |
|---|---|
| `cookies` | Find and remove Zoom cookies. |
| `activeTab` | Read the active tab's URL when the popup opens; reload it after the cleanup. |
| `scripting` | Inject the one-shot, origin-checked cleaner into the active Zoom tab after FIX ZOOM. |
| `zoom.us` / `zoom.com` hosts (http and https) | Limit cookie access and injection to Zoom. |

No `<all_urls>`, `browsingData`, `tabs`, `history`, background worker, content scripts, telemetry, or
remote code. Every permission is justified per target in
[docs/security/permissions-matrix.md](docs/security/permissions-matrix.md) and CI fails if a new one
appears without a justification.

## Verification status

`npm run check` is green locally and in CI on every push: source guards, strict type-check, unit
tests, five builds, generated-manifest validation with `web-ext lint`, permission justifications,
build integration checks, five release zips, package validation, and six end-to-end suites
(Chromium and Firefox popup and report, Chromium install smoke for Chrome / Edge / Brave, BRAVIA at
three TV viewports). What remains manual is listed in
[docs/testing/README.md](docs/testing/README.md) and [docs/known-limitations.md](docs/known-limitations.md).

## Documentation

- [Architecture overview](docs/architecture/overview.md) and [decision records](docs/architecture/adr/)
- [Primary-source research](docs/research/primary-sources.md)
- Platforms: [Chrome](docs/platforms/chrome.md), [Edge](docs/platforms/edge.md), [Brave](docs/platforms/brave.md), [Firefox](docs/platforms/firefox.md), [BRAVIA](docs/platforms/bravia.md), [Safari](docs/platforms/safari.md)
- Security: [threat model](docs/security/threat-model.md), [permissions matrix](docs/security/permissions-matrix.md)
- [Testing](docs/testing/README.md)
- Release: [packaging](docs/release/packaging.md), [store preparation](docs/release/store-preparation.md), [Firefox signing](docs/release/firefox-signing.md)
- [Migration from the flat layout](docs/migration/from-flat-layout.md), [troubleshooting](docs/troubleshooting.md), [known limitations](docs/known-limitations.md)

## Privacy

The fix flow makes no network request. The optional Report-a-Bug page is the only networked
surface; it sends only what you type and attach, only when you press Submit, to the project's
support service. Full text: [PRIVACY_POLICY.md](PRIVACY_POLICY.md).

## License

Code, documentation, and design tokens: [MIT](LICENSE). The 1132 Fixer product names, logo, icons,
and brand artwork are not covered by the MIT licence; see [TRADEMARKS.md](TRADEMARKS.md),
[ASSET-LICENSE.md](ASSET-LICENSE.md), and [NOTICE.md](NOTICE.md).
