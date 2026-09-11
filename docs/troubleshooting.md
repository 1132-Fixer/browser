# Troubleshooting

## Build and checks

| Symptom | Cause | Fix |
|---|---|---|
| `version drift: apps/extensions/chrome/manifest.json says X, package.json says Y` | A version was hand-edited. | `node tooling/release/bump-version.js <X>` to realign every copy, or revert the hand edit. |
| `dist/<target> is not built. Run: npm run build:<target>` | Packaging before building. | `npm run build` first. |
| `verify:permissions` fails with "no row" | A permission was added without a justification. | Add the row to `docs/security/permissions-matrix.md` with `yes` for each target that requests it. |
| `web-ext lint` errors | Firefox manifest problem. | Read the JSON report line in the `verify:manifests` output; the two warnings about `data_collection_permissions` versus Firefox 128 are expected. |
| `node --test` cannot import `.ts` | Node older than 22.18. | Use the version in `.nvmrc`. |
| esbuild "install scripts" warning on `npm install` | npm's allow-scripts policy. | Harmless; esbuild resolves its platform binary from optional dependencies. |
| Playwright cannot find a browser | Browsers not installed. | `npx playwright install chromium firefox`. |
| Install smoke test cannot discover the extension id | Chromium headless with extensions needs the `chromium` channel. | The test already uses it; make sure `npx playwright install chromium` fetched the full Chromium build, not only the headless shell. |
| Brand guard fails in CI | An icon changed or a new file name matches `icon|logo|badge|preview` | Icons must be byte-identical to `design-system/assets/exports/chrome/*`; register any new brand file in `.brand-assets.tsv`. |

## Extension at runtime

| Symptom | Meaning | Action |
|---|---|---|
| NOT ZOOM on a Zoom page | The active tab is not on `zoom.us` / `zoom.com`, or it is an internal page. | Check the address bar; click the icon again. |
| ACCESS NEEDED | The browser has revoked or restricted the extension's Zoom site access. | Press FIX ZOOM and accept the prompt, or enable site access in the browser's extension settings (Firefox: Add-ons Manager → Permissions). |
| PARTIAL: "…could not be removed" | The browser declined some cookie deletions (for example a policy-managed cookie). | Run again; deleting is safe to repeat. |
| PARTIAL: "site data could not be cleared" | Injection into the tab failed (page still loading, or a browser-internal page). | Reload the Zoom page and run again. |
| ERROR | Both the cookie jar and the tab injection failed. | Close and reopen the popup, then try again. |
| Report page shows the GitHub link instead of a form | The support service is unreachable or its screenshot capability is off. | Use the GitHub issue link; nothing was lost. |

## BRAVIA

| Symptom | Action |
|---|---|
| Display does not launch the app from USB | Confirm Pro mode is on, `autorun.txt` is at `USB:/sony/autorun.txt`, and the `auid` matches the launcher manifest. |
| Blank page over https | Set the display's date and time; import the site's root certificate under Pro settings → HTML5 platform. |
| BACK does nothing | The display sends a key code not in `KEY.BACK`; capture it with `adb logcat` and add it in `tv.js`. |
