# Changelog

Notable changes to the 1132 Fixer browser extension, which ships for Chrome,
Edge, Brave and Firefox from one source tree, alongside the BRAVIA guide client.
Versions follow the shipped `manifest.json` version; entries are summarized from
the git history.

## Unreleased

- Repository renamed to `1132-Fixer/browser` (same repository; GitHub redirects
  the old `chrome` name for web and git). Pages now live at
  `https://1132-fixer.github.io/browser/`; the old Pages URL does not redirect.
- Reproducible builds: `.gitattributes` checks every text file out with LF, so
  the packages built on Windows are byte-identical to CI's (verified against
  the CI artifact checksums).
- Firefox: minimum version 140 (current ESR) and the built-in data-collection
  consent (`required: none`, `optional: technicalAndInteraction`, requested when
  you press Submit on the Report-a-Bug page; refusal sends nothing). The form
  states exactly what Submit sends. ADR 0007.
- Report-a-Bug: each browser build registers with its own product code when
  the support service advertises it; otherwise `CHROME` as before.
- Cross-browser workspace: one shared TypeScript core (`packages/core`), a
  feature-detected browser adapter (`packages/browser-api`), shared UI
  (`packages/ui`), and thin per-target apps (`apps/extensions/{chrome,edge,
  brave,firefox}`) composed from the Chrome base manifest plus an overlay.
  esbuild produces unminified bundles into `dist/<target>/`; release zips go
  to `release/<target>/` with SHA-256 sums.
- Firefox target: its own Gecko id, `web-ext lint` in CI, and behaviour tests in
  the real Gecko engine. The minimum version and the data-collection declaration
  are described above. Popup handles revoked host access (**ACCESS NEEDED**) and
  re-requests it from the FIX ZOOM click.
- BRAVIA: a ten-foot TV guide client for Sony BRAVIA Professional Displays'
  HTML5 runtime (`apps/tv/bravia`) with a Sony launcher package. The
  extension cannot run on any BRAVIA; consumer sets are unsupported.
- Verification: `npm run check` chains lint, typecheck, unit, build, manifest
  and permission validation, integration, package validation, and a Playwright
  matrix (Chromium, Firefox, extension install smoke, TV viewports). A new
  permission without a justification fails CI.
- Copy: outcome text no longer names Chrome; "interrupted the fix" became
  "interrupted the cleanup"; report page version chip fixed. Permissions and
  hosts unchanged. CSP declared explicitly (Chrome default).
- Removed: the `master`-targeting auto version-bump workflow (ADR 0006), the
  superseded PowerShell asset scripts, and the global-Playwright resolver.
- README / NOTICE modernization: Error 1132 browser vs Windows-profile split,
  store-version honesty (source 1.2.7; live Chrome Web Store listing measured
  1.2.1). No store publish.

## 1.2.7 — 2026-08-23

- User-triggered Zoom-origin cleanup now includes the active Zoom tab's
  `localStorage`, `sessionStorage`, Cache API, and IndexedDB in addition to
  Zoom cookies. Detection still does not clear anything. Popup copy is
  **ZOOM DETECTED** / **FIX ZOOM**. `scripting` is the minimum extra MV3
  permission for the one-shot in-page cleaner; `browsingData` and
  `<all_urls>` stay out. Tests cover Zoom vs non-Zoom, click-gating,
  unrelated-origin isolation, permission freeze, no hidden background
  cleanup, and failure handling.
- Packaging paths for Chrome, Edge, Brave, and Firefox (`npm run package:all`).
  Firefox zip carries `browser_specific_settings.gecko`. One zip is not
  universal. Chrome-only claims stay on the Chrome package. No store publish.

## 1.2.6

- Public project documentation: security policy, contributing guide, code of
  conduct, support guide, trademark notice, issue and PR templates.
- Product identity strings aligned to the canonical 1132 Fixer wording.
- Report page fallback version label corrected to match the manifest.

## 1.2.5 — 2026-08-10

- In-extension Report-a-Bug page with optional screenshot attachment (#16, #17).
  The report page is the extension's only networked surface, pinned to the
  project's support service and always user-triggered.

## 1.2.4 — 2026-08-08

- Fixed the GitHub Pages build (and with it the public privacy-policy URL) by
  removing an unreachable private submodule reference (#12).
- CI workflow action versions updated (#6, #7, #8).

## 1.2.3 — 2026-08-07

- Store icon updated to the dimensional card artwork (#10).

## 1.2.2 — 2026-08-07

- New 1132 Fixer icon set, including 32 px manifest entries (#9).

## 1.2.1 — 2026-08-05

- **Cookies-only clear** (v1.2.0 work, #1): cookies are now the only data type
  the extension touches. The `browsingData` and `scripting` permissions were
  removed, the popup became a single FIX ZOOM button with no options, and the
  validator and e2e tests now enforce all of it.

## 1.1.0 — 2026-05-22

- Zoom-only restructure: host permissions narrowed to `zoom.us` / `zoom.com`,
  manual domain picker dropped. First Chrome Web Store submission.
