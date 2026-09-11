# Brave and other Chromium browsers

Brave installs extensions from the Chrome Web Store. There is no Brave store and no Brave pipeline.
The supported path for Brave users is the Chrome package.

The workspace still builds `release/brave/1132-fixer-brave-<version>.zip` from the overlay in
`apps/extensions/brave/`, which changes only the manifest `name` and `description`, so that a build
someone loads unpacked in Brave does not describe itself as a Chrome extension. This was merged in
PR #22 and kept.

Other Chromium browsers (Vivaldi, Opera, Arc, and so on) can load the Chrome package unpacked. They
are not tested and are not claimed as supported.

## Verification status

| Check | Status |
|---|---|
| Manifest composition, no Chrome claim | `verify:manifests`, `verify:packages` |
| Install unpacked and first run | `npm run test:e2e:install` loads `dist/brave` into Playwright Chromium |
| Branded Brave | MANUAL_VALIDATION_REQUIRED (`brave://extensions`, Load unpacked, `dist/brave`) |
