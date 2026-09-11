# Browser store preparation

Common inputs for every store:

| Input | Source |
|---|---|
| Package | `release/<target>/1132-fixer-<target>-<version>.zip` (see `docs/release/packaging.md`) |
| Privacy policy URL | `https://1132-fixer.github.io/chrome/privacy.html` (canonical text: `PRIVACY_POLICY.md`) |
| Per-permission justification | `docs/security/permissions-matrix.md` |
| Single purpose | "Clear Zoom cookies and the active Zoom tab's site data with one click, then reload the tab." |
| Remote code | None. Declare "no remote code" everywhere it is asked. |
| Data collection | The fix flow collects nothing. The optional Report-a-Bug page sends user-authored text, an optional screenshot, the extension version, and the user-agent string, only on Submit. Declare user-provided data for app functionality (support), not sold, not shared. |
| Product claim | "One-click Zoom cookie cleanup for Error 1132". Never "One-click fix for Zoom Error 1132" (operator ruling, issue #20). Always "Independent project. Not affiliated with Zoom." |
| Screenshots and promo images | `npm run assets` (Chrome Web Store dimensions); reuse for Edge. |

## Chrome Web Store

- Listing copy, field by field, with limits checked by `npm run listing:verify`:
  `docs/release/chrome-web-store-listing.md`.
- Legacy full checklist (assets, dashboard tabs, privacy questionnaire): `docs/release/store-prep.md`.
- Upload: manual workflow **Actions → Publish to Chrome Web Store → Run workflow**, `mode=upload-draft`,
  type the expected version. Requires the `chrome-web-store` environment secrets. `upload-and-publish`
  only with operator approval.

## Microsoft Edge Add-ons (Partner Center)

1. Register as an Edge extension developer (one-time).
2. Partner Center → Edge → new extension → upload `release/edge/1132-fixer-edge-<version>.zip`.
   The manifest supplies name, description, and version; the package must not brand itself as a
   Chrome extension (`verify:packages` enforces this) and has no `update_url`.
3. Availability: public, all markets.
4. Properties: category Productivity; support URL `https://github.com/1132-Fixer/chrome/issues`.
5. Privacy: privacy policy URL above; single-purpose description; per-permission justification from
   the matrix; disclosures as in the table above.
6. Store listing: reuse the Chrome copy with "Edge" wording where the manifest says Edge; reuse the
   1280x800 screenshots.
7. Certification notes: point reviewers to the manual test steps in the package README.
8. Submit. Certification is Microsoft's; expect a review before the listing goes live.

## Firefox Add-ons (AMO)

`docs/release/firefox-signing.md`.

## Brave

No submission. Brave users install the Chrome Web Store listing.

## Store-facing gates that remain open

| Gate | Owner | Status |
|---|---|---|
| Chrome Web Store draft upload for the current version | Operator (secrets + dispatch) | Not run; listing still at the previously measured 1.2.1 |
| Edge Add-ons developer registration and first submission | Operator | Not started |
| AMO listing, data-collection policy question for the report page, first signed upload | Operator | Not started |
