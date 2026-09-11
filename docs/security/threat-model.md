# Threat model

Scope: the browser extension packages (Chrome, Edge, Brave, Firefox), the Report-a-Bug page, the
BRAVIA TV guide, the build and release tooling, and CI. Assets: the user's browser session data on
non-Zoom sites, the user's Zoom data (which the user asked to delete), the support-service token, the
integrity of shipped packages, and store publisher credentials.

| # | Threat | Where | Control | Verified by |
|---|---|---|---|---|
| 1 | Over-broad host permissions let a compromised extension touch every site | manifest | Host permissions are exactly the four Zoom patterns; `<all_urls>` and broad patterns are rejected. | `lint`, `verify:manifests`, `verify:permissions`, install smoke asserts `<all_urls>` is not granted |
| 2 | Content-script exposure: code running in web pages at load time | manifest, code | No `content_scripts`, no background worker, no `onInstalled` / `onStartup` / `alarms` / `tabs.onUpdated` hooks. The only injection is one function, after a click, into the active Zoom tab. | `lint` (source guards), `verify:manifests`, e2e ("opening the popup does not inject") |
| 3 | Injected function runs on the wrong origin (Zoom lookalike, or the tab navigated) | `packages/core/src/page-data.ts` | The popup checks `shouldClearPageDataForTabUrl`; the injected function independently re-checks `location.hostname` with a dot-boundary match and refuses otherwise. It closes over nothing. | Unit tests in a bare `vm`; e2e executes the serialized function against the popup's own origin and asserts refusal; lookalike-host e2e |
| 4 | Cross-site scripting in extension pages | UI | No inline script or handlers; CSP `script-src 'self'; object-src 'self'`; all user-visible text set with `textContent`; no `innerHTML` sinks anywhere. | `lint` (HTML sinks banned), `verify:manifests` (CSP), `test:integration` |
| 5 | Message spoofing / arbitrary command dispatch | messaging | There is no runtime messaging and no `externally_connectable`. The popup calls the core directly. | `verify:manifests` (`externally_connectable` absent), `lint` (adapter allowlist has no `runtime.onMessage`) |
| 6 | Unsafe DOM injection of remote content | UI | No remote content is loaded. Report page previews only an image the user chose, via `blob:` URL after magic-byte sniffing. | e2e (renamed text file rejected; MIME mismatch rejected) |
| 7 | Token and credential storage | report page | The support principal token is minted per install by the service and kept in the extension-origin `localStorage` under one key. It is not a shipped secret and grants only the right to file reports as that install. | `lint` pins `localStorage` use to `PRINCIPAL_KEY`; unit test asserts the origin literal |
| 8 | Sensitive logging | code | Cookie and storage values are never read into the UI; only counts are shown. Error text carries the exception message, never data. | `describeInterruption` unit test; e2e result-line assertions |
| 9 | Remote configuration / remote code | code, CSP | No `fetch` in the popup; report page fetches only `SUPPORT_ORIGIN + path`; bundles contain no `eval` / `new Function`; CSP forbids remote scripts. | `lint`, `test:integration`, `verify:packages` |
| 10 | Supply-chain risk in build tooling | devDependencies | Four pinned dev dependencies (esbuild, typescript, playwright, web-ext) with a lockfile and `npm ci`; nothing ships from `node_modules`. Bundles are unminified so reviewers can diff them against the sources. Dependabot watches npm and Actions. | `verify:packages` (inventory is exactly 19 known files); CI `npm ci` |
| 11 | Update integrity | stores | Updates flow only through the stores' signed channels; no `update_url`. Release zips carry SHA-256 sums. | `verify:manifests` (`update_url` absent), `release/SHA256SUMS.txt` |
| 12 | External messaging / native messaging | manifest | None. `nativeMessaging` is banned. | `verify:manifests` |
| 13 | BRAVIA client communication | TV | The guide makes no network call and stores nothing. Hosted over https. | `test:integration` (tv.js scanned), `verify:packages` (https `web_url`) |
| 14 | Store publisher credentials | CI | Chrome Web Store secrets live only in the `chrome-web-store` environment; the publish workflow is manual, requires the expected version typed in, and never interpolates inputs into shell. Edge and Firefox submissions are manual. | Workflow review; no automated publish for any store |
| 15 | Secrets committed to the repository | tree | `lint` scans every tracked text file for credential patterns. | `lint` |
| 16 | Least-privilege drift over time | process | Adding a permission without a written justification fails CI; the adapter's API surface is an explicit allowlist; overlays may change identity keys only. | `verify:permissions`, `lint` |

## Trust boundaries

```text
web page (untrusted) ──executeScript(func)──► injected cleaner (re-checks origin, returns plain object)
                                                          │
popup (extension origin) ◄────── result object ───────────┘
   │  all browser access through packages/browser-api (allowlisted surface)
   ▼
browser APIs: cookies (Zoom hosts only), tabs (active tab), scripting (active Zoom tab), permissions

report page (extension origin) ──fetch──► SUPPORT_ORIGIN only, user-initiated, bearer token per install
```

## Residual risks

- A user who grants site access to a malicious page that spoofs the Zoom login UI is outside this
  model; the extension only deletes data the user asked to delete.
- The support service's own security is documented in the Windows repository (`feedback-proxy`).
- Physical BRAVIA validation is outstanding; the client has no privileged capability to misuse.
