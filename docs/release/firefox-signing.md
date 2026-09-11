# Firefox signing guide

Release and Beta builds of Firefox install only packages signed by Mozilla through
addons.mozilla.org (AMO). Signing happens on every upload, whether the extension is publicly listed
or self-distributed ("unlisted"). Developer Edition, Nightly, and ESR can load unsigned packages
after flipping `xpinstall.signatures.required` in `about:config`.

## Before the first upload

1. Keep `browser_specific_settings.gecko.id` at `1132-fixer@1132-fixer.xyz` forever. AMO checks that
   the id is unique on the first signing and ties every later version to it.
2. The data-collection declaration is settled (ADR 0007): `required: ["none"]`, `optional:
   ["technicalAndInteraction"]`, requested on Submit. The listing description must say: "The
   optional Report-a-Bug page sends your description, an optional screenshot, the extension version,
   your browser's user-agent string, and a per-install support identifier to the 1132 Fixer support
   service, only when you press Submit, and only after you allow it."
3. Confirm `npm run verify:manifests` reports `web-ext lint` with 0 errors.

## Upload (manual, operator action)

1. `npm run check` on the tagged commit; take `release/firefox/1132-fixer-firefox-<version>.zip`.
2. Create a source archive of the same commit for reviewers, because the bundles are produced by
   esbuild: `git archive --format=zip -o 1132-fixer-source-<version>.zip v<version>`.
3. On AMO (Developer Hub) choose **Submit a New Add-on** (first time) or **Upload New Version**:
   - Distribution: "On this site" (listed) is the intended path for a public tool. Unlisted
     (self-distributed) is possible for beta builds.
   - Upload the package zip. AMO's validator runs the same linter as `web-ext lint`.
   - When asked whether the code was minified, bundled, or transpiled, answer yes and upload the
     source archive with these build notes:

     ```text
     Operating system: any (verified on Windows 11 and Ubuntu CI)
     Node: see .nvmrc (22.x); npm 10+
     Commands: npm ci && npm run build:firefox
     Output: dist/firefox/ is byte-identical to the uploaded package
     ```

4. Listing: name "1132 Fixer for Firefox", summary "Clear Zoom site data in Firefox with one guided
   action.", description from `docs/release/chrome-web-store-listing.md` with Firefox wording,
   privacy policy URL `https://1132-fixer.github.io/browser/privacy.html`, support URL
   `https://github.com/1132-Fixer/browser/issues`, screenshots from `npm run assets`.
5. Submit. Automated validation signs within about 24 hours unless a manual review is triggered.

## Alternative: `web-ext sign`

`npx web-ext sign --source-dir dist/firefox --channel listed --api-key <JWT issuer> --api-secret <JWT secret>`
performs the same upload from the command line. The API credentials are operator secrets and must
never be committed or stored in the repository; there is no CI job for this on purpose.

## After signing

- Firefox updates listed add-ons automatically through AMO. No `update_url` is set.
- Verify the signed install on a physical Firefox: install from the listing, open a Zoom tab, press
  FIX ZOOM, confirm CLEARED and the reload; revoke Zoom site access in the Add-ons Manager and confirm
  the ACCESS NEEDED path. Record the result in `docs/platforms/compatibility-matrix.md`.
