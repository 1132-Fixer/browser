# Architecture overview

One product, one implementation, several packages.

```text
                        packages/core            pure cleanup logic (no browser namespace)
                              │
                        packages/browser-api     feature-detected adapter: browser.* or chrome.*
                              │
                        packages/ui              popup + report pages (TypeScript, HTML, CSS, icons)
                              │
              ┌───────────────┼──────────────────┬──────────────────┐
     apps/extensions/chrome  edge               brave             firefox
     (base manifest)         (overlay)          (overlay)         (overlay: gecko id, min 128,
                                                                    data-collection = none)
              │               │                  │                  │
         dist/chrome     dist/edge          dist/brave         dist/firefox      ← tooling/build
              │               │                  │                  │
       release/chrome    release/edge       release/brave      release/firefox   ← tooling/packaging

     apps/tv/bravia  ──►  dist/bravia  ──►  release/bravia    (static TV guide + Sony launcher)
```

## Principles

1. **One core.** `packages/core` contains every rule: which hosts are Zoom, how cookies are
   collected and removed, the injected page cleaner, and every user-facing outcome string. It has
   no `chrome.*` or `browser.*` reference; the cookie API is injected. `npm run lint` fails if a
   namespace reference appears there.
2. **One boundary.** `packages/browser-api` is the only file that touches a WebExtension namespace.
   It prefers `browser.*`, detects Gecko by `runtime.getBrowserInfo`, and exposes a typed surface of
   nine calls. The linter allowlists exactly those calls and asserts the only destructive one is
   `cookies.remove`.
3. **Thin targets.** A target directory holds a manifest (or overlay) and a README. Nothing else.
   Chrome is the base; other targets are `base + overlay` composed at build time, never copied.
4. **Build is the package.** `dist/<target>/` is what a browser loads unpacked and exactly what the
   zip contains. The packager refuses anything outside the 19-entry inventory.
5. **Truthful copy.** The popup reports the operation result (cookies removed, site data cleared,
   tab reloaded). It never claims Error 1132 is fixed; the approved product claim is "One-click Zoom
   cookie cleanup for Error 1132" (operator ruling in issue #20). A linter check rejects the
   rejected wording on every user-facing surface.

## Packages

| Package | Contents | Runtime dependency |
|---|---|---|
| `packages/platform-types` | Shared TypeScript types, including the minimal ambient declaration of the WebExtension surface this project uses. | none |
| `packages/core` | `zoom-hosts.ts`, `cookie-cleanup.ts`, `page-data.ts`, `outcome.ts`. | none |
| `packages/browser-api` | `detectBrowserApi()` and the `BrowserApi` interface. | `chrome.*` or `browser.*` at runtime |
| `packages/ui` | `popup.{html,css,ts}`, `report.{html,css,ts}`, `report-helpers.ts`, `icons/`. | core, browser-api |
| `packages/test-utils` | Recording namespace mock used by the end-to-end suites. Never shipped. | Playwright at test time |

Directories the reference layout suggested but this workspace does not need, and why:

- `packages/storage`: the popup stores nothing; the report page keeps one key in `localStorage`.
  An abstraction over one key would be speculative.
- `packages/messaging`: there is no runtime messaging (no background worker, no content script, no
  external connectivity). Adding a typed message bus with nothing to carry would be false structure.

Both are recorded in ADR 0002. If a background worker or content script is ever introduced, add the
package and the message schema validation at the same time.

## Build

`tooling/build/build.js` composes the manifest, bundles `popup.ts` and `report.ts` with esbuild
(IIFE, ES2022, unminified, no source maps, per-family engine target), copies static UI files, icons,
shipped documents, and the target README into `dist/<target>/`. The BRAVIA target is copied as-is
and its Sony launcher manifest receives the workspace version.

## Verification chain (`npm run check`)

`lint → typecheck → test:unit → build → verify:manifests → verify:permissions → test:integration →
package → verify:packages → test:e2e`. CI runs the same chain and uploads the release zips as review
artifacts. Nothing publishes.

## Decision records

`docs/architecture/adr/`.
