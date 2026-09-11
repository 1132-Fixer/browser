# Packaging and release

## Outputs

| Target | Build output | Release artifact |
|---|---|---|
| chrome | `dist/chrome/` | `release/chrome/1132-fixer-chrome-<version>.zip` |
| edge | `dist/edge/` | `release/edge/1132-fixer-edge-<version>.zip` |
| brave | `dist/brave/` | `release/brave/1132-fixer-brave-<version>.zip` |
| firefox | `dist/firefox/` | `release/firefox/1132-fixer-firefox-<version>.zip` |
| bravia | `dist/bravia/` | `release/bravia/1132-fixer-bravia-<version>.zip` |
| all | | `release/SHA256SUMS.txt` |

Every extension zip contains exactly these 19 entries, in this order, with `manifest.json` first:

```text
manifest.json
popup.html  popup.css  popup.js
report.html report.css report.js
icons/icon.png icons/icon16.png icons/icon32.png icons/icon48.png icons/icon128.png icons/popup-logo.png
LICENSE NOTICE.md TRADEMARKS.md ASSET-LICENSE.md README.md PRIVACY_POLICY.md
```

`README.md` inside a zip is that target's README from `apps/extensions/<target>/README.md`.
Timestamps are fixed, so the same tree produces the same bytes. Nothing else is ever added: the
packager refuses source maps, TypeScript, tests, editor files, and anything that looks like a
credential, and fails on any inventory drift.

## Commands

```bash
npm run build            # every target -> dist/
npm run build:firefox    # one target
npm run package          # every target -> release/ + SHA256SUMS.txt
npm run package:edge     # one target
npm run verify:packages  # inspect the zips
```

## Version

One version for everything. `npm run bump` (or `bump:minor`, `bump:major`, or an explicit
`node tooling/release/bump-version.js 1.4.2`) updates the base manifest, `package.json`,
`package-lock.json`, both page version chips, and the BRAVIA launcher manifest together. The build
refuses to run if any copy drifts. Do not hand-edit versions.

## Version authority

The browser extension and the Windows app are separate products with **independent version lines**,
by evidence rather than by accident:

- The browser line is 1.x (1.1.0 in May 2026, 1.2.1 first Chrome Web Store submission, 1.2.7 now);
  every browser package, the base manifest, `package.json`, and the BRAVIA launcher share this one
  number.
- The Windows line is 6.x (`1132-Fixer/windows` `package.json` 6.4.0, release `v6.4.0` on
  2026-09-05, with its own changelog and release workflow).
- The canonical 1132 product-family issue (Botify-Network#24209) and the public product registry
  (Botify Network website: "Windows 5.6.0 ... Chrome 1.2.7") record the two numbers separately, and
  no directive ties them together.

Decision (2026-09-11): keep the lines independent. Do not renumber the browser packages to 6.x.
A store may reject a version that jumps backward, and the Chrome Web Store already holds 1.2.1. If
the operator later wants one family version, do it with a deliberate major bump on the browser
side recorded in the changelog, never by editing numbers in place.

## Release checklist

1. `npm run bump` on a branch; `npm run check` passes locally.
2. Open a pull request; CI must be green; one approval is required by the branch ruleset.
3. Merge. Download the `1132-fixer-packages-<sha>` artifact from the CI run on `main`, or run
   `npm run package` from the merged commit and compare against `SHA256SUMS.txt`.
4. Tag `v<version>` on the merged commit (AMO reviewers rebuild from this tag).
5. Submit per store: `docs/release/store-preparation.md` (Chrome, Edge) and
   `docs/release/firefox-signing.md` (Firefox). BRAVIA: `docs/platforms/bravia.md`.

No workflow publishes automatically. The Chrome Web Store workflow is manual, uploads a draft by
default, and needs environment-scoped secrets.
