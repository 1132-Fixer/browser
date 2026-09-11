# Migration from the flat layout

Before this change the extension was a flat tree at the repository root. Every move used `git mv`,
so history follows each file. Nothing was left behind as a compatibility copy.

## Old path → new path

| Old | New | Notes |
|---|---|---|
| `manifest.json` | `apps/extensions/chrome/manifest.json` | Base manifest; now also declares the CSP explicitly. Other targets compose from it. |
| `popup.html`, `popup.css` | `packages/ui/src/popup.html`, `packages/ui/src/popup.css` | Unchanged content. |
| `popup.js` | `packages/ui/src/popup.ts` (DOM wiring) + `packages/core/src/{zoom-hosts,cookie-cleanup,page-data,outcome}.ts` + `packages/browser-api/src/index.ts` | Split into core, adapter, and UI. Behaviour preserved; see "behaviour changes". |
| `report.html`, `report.css` | `packages/ui/src/report.html`, `packages/ui/src/report.css` | Version chip corrected from v1.2.5 to the real version. |
| `report.js` | `packages/ui/src/report.ts` + `packages/ui/src/report-helpers.ts` | Pure helpers separated for unit testing. |
| `icons/*` | `packages/ui/src/icons/*` | `.brand-assets.tsv` updated; the brand guard still checks them. |
| `scripts/browser-targets.js` | `tooling/build/targets.js` | Now the registry for every target, with overlay composition. |
| `scripts/package-extension.js` | `tooling/packaging/package.js` | Zips `dist/<target>/` instead of the source tree. |
| `scripts/test-packages.js` | `tooling/packaging/verify-packages.js` | Extended. |
| `scripts/validate-extension.js` | `tests/integration/validate-source.js` (lint) + `tests/integration/validate-dist.js` + `tooling/packaging/verify-manifests.js` | Split by what is checked: sources, build, generated manifests. |
| `scripts/test-popup-e2e.js` | `tests/end-to-end/popup.e2e.js` | Runs on Chromium and Firefox over loopback http. |
| `scripts/test-report-e2e.js` | `tests/end-to-end/report.e2e.js` | Same. |
| `scripts/bump-version.js` | `tooling/release/bump-version.js` | Also updates the lockfile, the report chip, and the BRAVIA launcher. |
| `scripts/lib/png.js` | `tooling/lib/png.js` | Unchanged. |
| `scripts/lib/playwright.js` | removed | Playwright is a pinned devDependency now. |
| `scripts/capture-*.js`, `make-*.js`, `letterbox-screenshots.js`, `verify-store-*.js` | `tooling/store-assets/` | Paths inside updated to the new layout. |
| `scripts/*.ps1` | removed | Documented as superseded by the Node scripts in the old STORE_PREP. |
| `STORE_PREP.md` | `docs/release/store-prep.md` | Paths updated. |
| `STORE_LISTING.md` | `docs/release/chrome-web-store-listing.md` | `npm run listing:verify` reads the new path. |
| `.github/workflows/version-bump.yml` | removed | ADR 0006: it targeted `master` and cannot push past the default-branch ruleset. |
| (new) | `apps/extensions/{edge,brave,firefox}/` | Overlays and shipped READMEs. |
| (new) | `apps/tv/bravia/` | BRAVIA TV guide client and Sony launcher. |
| (new) | `tests/unit/`, `tests/end-to-end/extension-install.e2e.js`, `tests/end-to-end/bravia.e2e.js` | |
| (new) | `docs/**` | Architecture, research, platforms, security, testing, release, migration. |

## Command changes

| Old | New |
|---|---|
| `npm test` (validator + popup e2e + packages) | `npm run check` (everything) or `npm test` (unit + integration) |
| `npm run validate` | `npm run lint` + `npm run verify:manifests` |
| `npm run e2e` | `npm run test:e2e` |
| `npm run package` → `store-assets/1132-fixer-chrome-<v>.zip` | `npm run package:chrome` → `release/chrome/1132-fixer-chrome-<v>.zip` |
| `npm run package:all` → `packages/*.zip` | `npm run package` → `release/<target>/*.zip` |
| `npm run release` | removed; use `npm run check` then `npm run package` |
| Load unpacked: repository root | Load unpacked: `dist/<target>` after `npm run build` |

## Behaviour changes in the shipped extension (all intentional, all tested)

1. Outcome copy no longer names Chrome: "The browser would not let us read the Zoom cookie jar."
   The old string was wrong on every non-Chrome target.
2. Interruption copy: "Something interrupted the cleanup" replaces "…the fix", in line with the
   approved claim wording.
3. New ACCESS NEEDED state when host access has been revoked (Firefox users can revoke it; Chrome
   users can restrict site access). Pressing FIX ZOOM asks for access first; refusal does nothing.
4. Report page version chip fallback now matches the manifest.
5. CSP is declared explicitly with Chrome's default value.

Permissions, host permissions, the one-button popup, the injected cleaner, and the report page's
single network origin are unchanged.

## External references to old paths

| Reference | Status |
|---|---|
| Chrome Web Store listing text mentions `popup.js` and the repository | Listing copy is in `docs/release/chrome-web-store-listing.md`; the store package itself still contains `popup.js`. No change needed. |
| PRIVACY_POLICY.md "Verifiability" section | Updated to the new paths. |
| GitHub Pages `index.md` install link | Updated anchor. |
| Windows repository links to this repository | Updated to `1132-Fixer/browser` by a Windows-repository pull request; GitHub redirects the old name for web and git. |
| Repository rename `1132-Fixer/chrome` → `1132-Fixer/browser` (2026-09-11) | Same repository id (1246919604); web and git redirects active; Pages moved to `https://1132-fixer.github.io/browser/` with **no redirect** from the old Pages URL (GitHub behaviour). Store privacy-URL field is an operator action. |

No transitional shims were added.
