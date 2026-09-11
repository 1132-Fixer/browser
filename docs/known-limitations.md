# Known limitations

1. **The extension reports an operation result, not a Zoom outcome.** It removes Zoom cookies and
   the active tab's Zoom site data and reloads the tab. It cannot detect Error 1132 or verify that
   Zoom recovered. Copy is bound to this by the operator ruling in issue #20 and by `npm run lint`.
2. **Current profile only.** Cookies are cleared in the profile the popup runs in. An incognito
   window has its own jar and is reachable only if the extension is allowed in incognito.
3. **Partitioned cookies are best-effort.** Browsers that reject the empty `partitionKey` filter
   (Chrome before 119) return only the unpartitioned jar.
4. **Support-service product code.** The support service accepts `WINDOWS`, `CHROME`, and `MACOS`
   only, so every browser build registers bug reports as `CHROME`. Adding Edge / Firefox / Brave
   codes is a change to the `feedback-proxy` service in the Windows repository.
5. **Firefox data-collection declaration for the report page** is an open policy question; the
   manifest declares `none` for the fix flow. See `docs/platforms/firefox.md`.
6. **Branded-browser and real-device runs are manual.** Playwright side-loads extensions only into
   Chromium; Firefox installs, branded Chrome / Edge / Brave, and BRAVIA Professional Displays need a
   person. Labels in `docs/platforms/compatibility-matrix.md`.
7. **BRAVIA is a guide, not a cleaner.** TV software does not let one app clear another's data.
   Consumer BRAVIA sets are unsupported.
8. **No Safari build.** The packaging path is documented; it needs a Mac with Xcode.
9. **Store listings are not automated** for Edge and Firefox. The Chrome Web Store workflow uploads a
   draft only when an operator dispatches it.
10. **The live Chrome Web Store listing is older than this tree** (measured 1.2.1 on 2026-08-23).
    Publishing is an operator action.
