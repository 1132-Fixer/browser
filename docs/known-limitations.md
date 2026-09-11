# Known limitations

1. **The extension reports an operation result, not a Zoom outcome.** It removes Zoom cookies and
   the active tab's Zoom site data and reloads the tab. It cannot detect Error 1132 or verify that
   Zoom recovered. Copy is bound to this by the operator ruling in issue #20 and by `npm run lint`.
2. **Current profile only.** Cookies are cleared in the profile the popup runs in. An incognito
   window has its own jar and is reachable only if the extension is allowed in incognito.
3. **Partitioned cookies are best-effort.** Browsers that reject the empty `partitionKey` filter
   (Chrome before 119) return only the unpartitioned jar.
4. **Support-service product code.** Each browser build registers with its own code (`EDGE`,
   `FIREFOX`, `BRAVE`) only when the deployed support service advertises it in `GET /health`
   `capabilities.products`; otherwise it registers as `CHROME`, which every deployment accepts. The
   service change (enum migration, product set, Discord tag fallback) is a separate pull request in
   the Windows repository (`feedback-proxy/`); its deployment is a manual `railway up` by the
   service owner.
5. **Firefox data-collection declaration** is resolved (ADR 0007): `required: none`, `optional:
   technicalAndInteraction` requested on Submit. Mozilla reviewers may still require more at review
   time; the request path accommodates it. Firefox 128 to 139 (end of life) cannot install the package.
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
