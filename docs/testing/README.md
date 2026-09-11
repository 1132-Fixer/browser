# Testing

Shared behaviour is tested once at the package level; platform differences at the adapter and
end-to-end levels. Every command exits non-zero on failure and prints `Passed: N  Failed: M`.

## Commands

| Command | What it proves | Needs a build? | Needs browsers? |
|---|---|---|---|
| `npm run lint` | Source guards: Zoom-only hosts, one browser boundary with an allowlisted API surface, nothing runs before FIX ZOOM, no telemetry / eval / XHR / HTML sinks, one-button popup, approved claim only, no secrets, no TypeScript escape hatches, versions agree. | no | no |
| `npm run typecheck` | `tsc --noEmit` under strict settings over `packages/*` and the TV client. | no | no |
| `npm run test:unit` | `node:test` suites over the TypeScript sources: host matching, cookie collection and removal (partition fallback, dedupe, partial failure, unreadable jar), the injected cleaner executed from source text in a bare `vm` (self-contained, refuses non-Zoom origins, missing `indexedDB.databases` reported as an error), outcome copy, adapter detection and forwarding, report helpers, target registry and overlay composition. | no | no |
| `npm run verify:manifests` | Every generated manifest: MV3, exact permissions and hosts, CSP, no background / content scripts / `update_url`, icons and popup exist, Firefox gecko id + `strict_min_version` + data-collection declaration, Chromium `minimum_chrome_version`; then `web-ext lint` on `dist/firefox`. | yes | no |
| `npm run verify:permissions` | Every permission in every built manifest has a justified row in `docs/security/permissions-matrix.md`, and no row claims a permission that is not requested. | yes | no |
| `npm run test:integration` | Built output: page assets exist, bundles are plain scripts without source maps, popup bundle has no network call, report bundle pins one origin, injected cleaner survived bundling, icons and documents are byte-identical to sources, inventory is exactly 19 entries, TV client complete. | yes | no |
| `npm run verify:packages` | Release zips: inventory, manifest identity per target, no forbidden files, no dev endpoints, Chrome claims only on Chrome, Firefox identity, packages differ, BRAVIA launcher, checksums. | yes + package | no |
| `npm run test:e2e` | The matrix below. | yes | Playwright Chromium + Firefox |
| `npm run check` | The whole chain in order. This is what CI runs. | builds | yes |

Install browsers once: `npx playwright install chromium firefox` (CI adds `--with-deps`).

## End-to-end matrix (`tests/end-to-end/run-all.js`)

| Suite | Engine | Build | Covers |
|---|---|---|---|
| `popup.e2e.js` | Playwright Chromium | `dist/chrome` | Installation-free popup behaviour with a recording `chrome.*` mock: detection, one button, keyboard focus and visible focus ring, cookie removal incl. partitioned cookies, dedupe, partial failure, empty jar, unreadable jar, non-Zoom / internal / lookalike / no-tab states, unrelated origins untouched, injection failure, both-fail, host access granted / refused / no permissions API, double click. The bundled cleaner is executed for real against the popup's own origin and must refuse. |
| `popup.e2e.js` | Playwright Firefox (real Gecko) | `dist/firefox` | Same suite with a `browser.*` + `chrome.*` namespace and `runtime.getBrowserInfo`, so the Gecko detection path, rendering, and every state run in Firefox. |
| `report.e2e.js` | Chromium and Firefox | `dist/chrome`, `dist/firefox` | Service dark → GitHub fallback; live → form, label association, 50-char gate, screenshot rejected by content / MIME / size, submit carries base64 + bearer + idempotency key, success shows the case reference; service failure → honest error, Submit re-enabled, text preserved. |
| `extension-install.e2e.js` | Playwright Chromium, persistent context, `--load-extension` | `dist/chrome`, `dist/edge`, `dist/brave` | Real install: listed on `chrome://extensions`, popup opens as an extension page with the real `chrome.*`, no errors, real manifest name / version / permissions, Zoom host access granted, `<all_urls>` not granted, first run shows NOT ZOOM, report page falls back when the service is unreachable (network aborted). |
| `bravia.e2e.js` | Playwright Chromium at 720p / 1080p / 4K | `dist/bravia` | Safe area ≥ 5%, no scrolling, cards inside the title-safe box, D-pad order, OK opens, BACK (Escape / Backspace / 461) closes and restores focus, focus recovery on `pageshow`, offline banner, every control is a `<button>`. |

## Manual runs

Branded-browser and physical-display runs are recorded in
[manual-validation-record.md](manual-validation-record.md), with the package hashes under test, the
one operator action per target, the checklist, and a results table. An unfilled row is an open gate.

## What is not automated, and how it is labelled

| Item | Label | How to do it |
|---|---|---|
| Load-unpacked in branded Google Chrome, Microsoft Edge, Brave | MANUAL_VALIDATION_REQUIRED | `docs/platforms/<browser>.md` |
| Temporary and signed install in Firefox | MANUAL_VALIDATION_REQUIRED | `docs/platforms/firefox.md` |
| Sony BRAVIA Professional Display in Pro mode | Requires physical-device validation | `docs/platforms/bravia.md` |
| Consumer BRAVIA | UNSUPPORTED | n/a |
| Store reviews (Chrome Web Store, Edge Add-ons, AMO) | Requires store review | `docs/release/` |
| Uninstall cleanup | Not applicable: the extension stores nothing except the report page's support token, which the browser deletes with the extension's storage. | n/a |
| Browser restart / worker restart | Not applicable: there is no background worker; every popup open is a fresh page. | n/a |

## Adding a test

- Shared logic: `tests/unit/*.test.ts` (import the `.ts` module directly).
- A new guard on the source tree: `tests/integration/validate-source.js`.
- A new promise about the build: `tests/integration/validate-dist.js` or `verify-*`.
- A new user-visible behaviour: extend `popup.e2e.js` (it runs on both engines automatically).
