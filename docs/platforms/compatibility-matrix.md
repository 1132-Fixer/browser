# Supported-platform and feature-compatibility matrix

Status vocabulary, used everywhere in this repository:

| Status | Meaning |
|---|---|
| `AUTOMATED` | Verified by a script that runs in CI on every push. |
| `EMULATED` | Verified automatically in a desktop engine standing in for the real device. |
| `PACKAGE_INSPECTED` | The built artifact was inspected; runtime not exercised. |
| `MANUAL_VALIDATION_REQUIRED` | A person must run it on the real browser or device before it is called supported. |
| `STORE_REVIEW` | Depends on a store's review. |
| `UNSUPPORTED` | Does not run there; a documented alternative exists. |
| `NOT_IMPLEMENTED` | Path documented, no artifact. |

## Targets

| Capability | Chrome | Edge | Brave | Firefox | BRAVIA Pro (HTML5) | BRAVIA consumer | Safari |
|---|---|---|---|---|---|---|---|
| Build produces an independent package | AUTOMATED | AUTOMATED | AUTOMATED | AUTOMATED | AUTOMATED | UNSUPPORTED | NOT_IMPLEMENTED |
| Manifest / launcher identity validated | AUTOMATED | AUTOMATED | AUTOMATED | AUTOMATED (+ web-ext lint) | AUTOMATED | n/a | n/a |
| Popup: Zoom detection, NOT ZOOM state | AUTOMATED (Chromium) | shares Chrome bundle | shares Chrome bundle | AUTOMATED (Gecko) | n/a | n/a | n/a |
| FIX ZOOM: cookie cleanup incl. partitioned cookies | AUTOMATED (mock API) | shares | shares | AUTOMATED (mock API, Gecko) | n/a | n/a | n/a |
| FIX ZOOM: tab site-data cleanup via injected function | AUTOMATED; injected function executed for real against a non-Zoom origin and refused | shares | shares | AUTOMATED (Gecko) | n/a | n/a | n/a |
| Tab reload after cleanup | AUTOMATED (mock) | shares | shares | AUTOMATED (mock) | n/a | n/a | n/a |
| Host access revoked → ACCESS NEEDED → request on click | AUTOMATED | shares | shares | AUTOMATED | n/a | n/a | n/a |
| Report-a-Bug page: fallback, validation, submit, failure | AUTOMATED (Chromium) | shares | shares | AUTOMATED (Gecko) | n/a | n/a | n/a |
| Install unpacked, first run with the real API | AUTOMATED (Playwright Chromium) | AUTOMATED (Playwright Chromium loading the Edge package) | AUTOMATED (Playwright Chromium loading the Brave package) | MANUAL_VALIDATION_REQUIRED | EMULATED (TV viewports) | UNSUPPORTED | NOT_IMPLEMENTED |
| Branded browser load-unpacked | MANUAL_VALIDATION_REQUIRED | MANUAL_VALIDATION_REQUIRED | MANUAL_VALIDATION_REQUIRED | MANUAL_VALIDATION_REQUIRED | MANUAL_VALIDATION_REQUIRED (physical display) | UNSUPPORTED | NOT_IMPLEMENTED |
| Store / signed distribution | STORE_REVIEW (Chrome Web Store; manual draft upload workflow exists) | STORE_REVIEW (Partner Center, manual) | via Chrome Web Store | STORE_REVIEW (AMO signing, manual) | n/a (hosted URL / USB) | n/a | STORE_REVIEW |
| Keyboard / D-pad navigation and visible focus | AUTOMATED | shares | shares | AUTOMATED | AUTOMATED (D-pad order, OK, BACK) | n/a | n/a |
| Reduced-motion and forced-colors styles | PACKAGE_INSPECTED (CSS present) | shares | shares | PACKAGE_INSPECTED | PACKAGE_INSPECTED | n/a | n/a |
| Offline behaviour | Popup needs no network (AUTOMATED: zero requests). Report page shows the GitHub fallback (AUTOMATED). | shares | shares | AUTOMATED | AUTOMATED (offline banner; guide works offline) | n/a | n/a |

## Browser versions

| Target | Minimum | Reason |
|---|---|---|
| Chrome / Edge / Brave | Chromium 114 | Unchanged from the previous release; partition-key support (119+) degrades gracefully. |
| Firefox | 128.0 | `indexedDB.databases()` (126+) and the minimum version that can receive signed updates. |
| BRAVIA Pro | Sony WebAppRuntime `minimum_web_platform_version` 1.0 | Sony's documented baseline. |
