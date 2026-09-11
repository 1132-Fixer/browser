# Repository layout

```text
/
├── apps/
│   ├── extensions/
│   │   ├── chrome/     manifest.json (base), README.md (shipped)
│   │   ├── edge/       manifest.overlay.json, README.md
│   │   ├── brave/      manifest.overlay.json, README.md
│   │   └── firefox/    manifest.overlay.json, README.md
│   └── tv/
│       └── bravia/     index.html, tv.css, tv.js, sony/ (autorun.txt + launcher manifest)
├── packages/
│   ├── core/src/            zoom-hosts.ts, cookie-cleanup.ts, page-data.ts, outcome.ts, index.ts
│   ├── browser-api/src/     index.ts (the adapter)
│   ├── platform-types/src/  index.ts (types only)
│   ├── ui/src/              popup.*, report.*, report-helpers.ts, icons/
│   └── test-utils/src/      browser-mock.js
├── tooling/
│   ├── build/         targets.js (registry), build.js
│   ├── packaging/     package.js, verify-packages.js, verify-manifests.js, verify-permissions.js
│   ├── release/       bump-version.js
│   ├── store-assets/  Chrome Web Store screenshot / promo generators and checkers
│   └── lib/           zip.js, static-server.js, png.js
├── tests/
│   ├── unit/          node:test suites importing the TypeScript sources directly
│   ├── integration/   validate-source.js (lint), validate-dist.js
│   └── end-to-end/    popup, report, extension-install, bravia suites + run-all.js
├── docs/
│   ├── architecture/  overview, this file, adr/
│   ├── research/      primary-sources.md
│   ├── platforms/     chrome, edge, brave, firefox, bravia, safari, compatibility-matrix
│   ├── security/      threat-model.md, permissions-matrix.md
│   ├── testing/       README.md
│   ├── release/       packaging, store-preparation, firefox-signing, store-prep (legacy checklist), Chrome listing copy
│   ├── migration/     from-flat-layout.md
│   ├── troubleshooting.md
│   └── known-limitations.md
├── dist/              build output (ignored)
├── release/           zips + SHA256SUMS.txt (ignored)
├── design-system/     git submodule, read-only from this repository
├── ds-bundle/, .design-sync/   design tokens snapshot and sync conventions
├── assets/, _layouts/, index.md, _config.yml   GitHub Pages site (privacy policy, landing page, TV guide)
├── package.json, package-lock.json, tsconfig.json, .nvmrc
└── README, LICENSE, NOTICE, TRADEMARKS, ASSET-LICENSE, PRIVACY_POLICY, SECURITY, SUPPORT,
    CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG, AGENTS.md, CLAUDE.md, CODEOWNERS
```

What stays at the root: governance and entry files that GitHub, stores, and contributors expect
there. Long-form documentation lives in `docs/`.
