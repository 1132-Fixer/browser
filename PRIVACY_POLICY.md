---
layout: default
title: Privacy Policy
description: Privacy policy for the 1132 Fixer Chrome extension. Zoom-origin site data only, no telemetry, no remote code; bug reports are optional and send only what you choose to submit.
hero_title: Privacy Policy
hero_sub: The fix deletes Zoom cookies and this tab's Zoom site data locally in your own browser, and only when you click. The optional bug-report page sends only what you type and attach, only when you press Submit.
permalink: /privacy.html
---

*Last updated: 2026-08-23.*

This is the privacy policy for the **1132 Fixer** Chrome extension distributed via the Chrome Web Store and hosted at <https://github.com/1132-Fixer/browser>. This document is the canonical source and is also published at <https://1132-fixer.github.io/browser/privacy.html>.

## Summary

**The fix flow does not collect, transmit, sell, share, or store any personal data.** It deletes **Zoom-origin browser state only** (`zoom.us` and `zoom.com` cookies, including subdomains, plus the active Zoom tab's `localStorage`, `sessionStorage`, Cache API, and IndexedDB), only after the user clicks **FIX ZOOM** in the popup, and only inside the user's own browser. Detecting a Zoom tab never clears anything by itself.

**Bug reports are optional and entirely user-initiated.** The separate Report-a-Bug page (opened from the popup's "Feedback & Report" link) sends **only what you type and attach** — your description, an optional screenshot you choose, the extension version, and your browser's user-agent string — to the 1132 Fixer support service, and it sends that report **only when you press Submit**. The one thing the page does on its own is a single availability check when it opens (`GET /health`, carrying **no user data**) to decide whether to show the form or a GitHub fallback link; see the dedicated section below.

## What the extension does

- It is the Chrome sibling of [1132 Fixer for Windows](https://github.com/1132-Fixer/windows/releases/latest). It exists to mitigate Zoom error 1132 as stale Zoom *browser* state (cookies plus this tab's Zoom site data). It does not perform the Windows `user1` / isolated-profile repair.
- When the active tab is on `zoom.us`, `zoom.com`, or any of their subdomains, the popup shows **ZOOM DETECTED** and a single **FIX ZOOM** button. Clicking it deletes Zoom cookies, clears this tab's Zoom site data, and reloads the active Zoom tab.
- On any other site (or `chrome://` / `about:` pages), **FIX ZOOM** stays hidden. The website and feedback links remain available. The extension does not request host access to non-Zoom domains.
- All clearing is **user-triggered**. Opening the popup never deletes anything by itself; no install, startup, page-load, or timer hook clears data.

## What data the extension may clear (locally, after a user click)

When the user explicitly clicks **FIX ZOOM**, the extension deletes these categories of data, all Zoom-origin only:

- HTTP cookies for `zoom.us`, `zoom.com`, and their subdomains — Secure and non-Secure, and partitioned (CHIPS) cookies where the installed Chrome version supports the partition filter. Uses Chrome's `chrome.cookies` API.
- `localStorage` and `sessionStorage` for the **active Zoom tab origin**.
- Cache API (`caches`) entries for the **active Zoom tab origin**.
- IndexedDB databases for the **active Zoom tab origin**.

The last three run as a one-shot injected function in that tab. The function re-checks `location.hostname` and **refuses to run on any non-Zoom origin**. No content script is registered, so nothing injects on page load, install, or popup open.

The extension **does not** clear:

- Service worker registrations.
- The global HTTP cache.
- Anything at all belonging to a non-Zoom site.

`browsingData` is **not** requested. It cannot clear `sessionStorage`, and an origins filter is still broader than the current Zoom tab. `scripting` is the minimum extra permission the in-page cleaner needs.

The extension **never reads, transmits, copies, or logs the values** of cookies or page content. Its only operation on cookies is **deletion**. The popup reports a count and whether this tab's Zoom site data was cleared — never a cookie or storage value.

## What data the extension collects or transmits

- The **FIX ZOOM** action sends **no cookie data and issues no direct network request of its own**. After clearing, it reloads the active Zoom tab, and that reload loads the page's own resources exactly like any normal visit — the extension adds nothing to that traffic. The website link opens a normal browser tab only when the user clicks it. **The popup itself makes no network request of any kind.**
- **No telemetry, analytics, or remote logging.** No Google Analytics, no Mixpanel, no Amplitude, no Sentry, no Segment, no PostHog, no Hotjar, no custom beacon — confirmed by the source-level validator. The popup contains no `fetch`, `XMLHttpRequest`, `WebSocket`, or `sendBeacon`; the Report-a-Bug page may `fetch` **exactly one origin** (the 1132 Fixer support service), which the validator pins.
- **No remote code.** All scripts and styles ship in the package. Nothing is fetched at runtime, evaluated, or injected from a remote URL. The extension does not use `eval` or `new Function`.
- **No external fonts, images, or stylesheets.**
- **No remote configuration.** Behavior is fixed at install time and changes only via Chrome Web Store updates.
- **No account or sign-in of any kind.** Submitting a bug report mints a random per-install support reference (see below) — it is not an account and identifies no person.

## Bug reports (optional, user-initiated)

The popup's "Feedback & Report" link opens the extension's own Report-a-Bug page. On that page:

- **What is sent, and only when you press Submit:** your bug description, an optional screenshot **you** picked/pasted (images only — PNG, JPEG, WebP, GIF — max 5 MB), the extension version, and your browser's user-agent string. Nothing else. Nothing is sent while you type.
- **Where it goes:** the 1132 Fixer support service (a server operated by this project), which forwards the report to the project's private staff support channel. The service strips embedded EXIF/textual metadata from JPEG and PNG screenshots before storing them, stores screenshots for at most 90 days, and uses report contents solely to handle your report.
- **Capability check:** when the page opens it makes one `GET` request to the support service to ask whether reporting is available. That request carries **no user data**. If the service is unavailable, the page shows a GitHub link instead of the form.
- **Support reference:** the first submission mints a random per-install support token so staff replies can be matched to your install. It is stored locally in the extension's own storage, contains no personal information, and is never used for tracking.
- **Choice:** never opening the report page — or never pressing Submit — means nothing is ever transmitted. The fix flow is completely independent of it.

## Permissions, in plain English

| Permission                                          | Used for                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `cookies`                                           | Enumerate and delete cookies for `zoom.us` and `zoom.com`. Cookie **values** are never read or transmitted.           |
| `activeTab`                                         | Read the active tab's URL when the popup opens (to detect a Zoom tab) and reload that tab after a successful clear.    |
| `scripting`                                         | Inject a one-shot cleaner into the **active Zoom tab after FIX ZOOM**, so that origin's `localStorage`, `sessionStorage`, Cache API, and IndexedDB can be cleared. The injected function refuses to run on any other host. No content script is registered; nothing injects on install or page load. |
| Hosts: `https://*.zoom.us/*`, `https://*.zoom.com/*`, `http://*.zoom.us/*`, `http://*.zoom.com/*` | Required by Chrome's `cookies` API to operate on Zoom domains, and by `scripting` to inject only into those hosts. Both schemes are listed because Chrome maps a non-Secure cookie to an `http://` URL and hides it from an https-only extension — without `http`, stale non-Secure Zoom cookies would be missed. **No** other hosts are requested. `<all_urls>` is not requested. |

The extension holds **no** `browsingData` permission.

## Children's privacy

The extension does not target or knowingly process data about children. Because it processes no personal data at all, it imposes no child-specific data risk.

## Changes to this policy

If extension behavior changes in a way that affects this policy, this document will be updated with a new "Last updated" date and a corresponding Chrome Web Store update. The version history is available in the public Git repository.

## Affiliation

1132 Fixer is an independent open-source project. It is **not** affiliated with, endorsed by, or sponsored by Zoom Video Communications, Inc. "Zoom" is a registered trademark of Zoom Video Communications, Inc., used here only to describe the site the extension operates on.

## Contact

- **Owner:** `1132 Fixer` — published on the Chrome Web Store by `High-Texas` (the listing shows "Offered by High-Texas").
- **Support / privacy questions:** open an issue at <https://github.com/1132-Fixer/browser/issues> — this is the canonical public contact point for this extension.
- **Repository:** <https://github.com/1132-Fixer/browser>.
- **Hosted privacy URL:** <https://1132-fixer.github.io/browser/privacy.html>.

## Verifiability

The claims above can be verified directly from this repository:

- `npm run lint` (`tests/integration/validate-source.js`) checks the source. It bans `fetch` in the popup, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval`, remote code, telemetry, HTML injection sinks, broad host access, `browsingData`, background/service-worker cleanup, and content-script auto-injection, and pins the Report-a-Bug page's network access to the single support-service origin.
- `npm run test:e2e` checks the built popup in Playwright Chromium and Firefox. It proves Zoom detection vs non-Zoom pages, that nothing is cleared until **FIX ZOOM**, that unrelated-origin cookies/storage/cache/idb are not cleared, that permissions are not silently widened, that there is no hidden background cleanup, that revoked site access is handled without cleaning anything, and that failures are reported. The report suite proves the report page shows an honest fallback when the service is down, validates screenshots by content, and sends only the submitted report.
- `apps/extensions/chrome/manifest.json` (the base every browser package is composed from) lists three permissions (`cookies`, `activeTab`, `scripting`) and the four Zoom host patterns documented above. `npm run verify:manifests` and `npm run verify:permissions` check every generated manifest against this policy.
- `packages/core/src` holds the cleanup logic and never references a browser API. `packages/browser-api/src/index.ts` is the only file that calls browser APIs; its surface is an explicit allowlist and the only destructive call is `cookies.remove`, scoped to Zoom domains. Page-data cleanup is a one-shot `scripting.executeScript` into the active Zoom tab. Both are gated behind an explicit click on `#zoomFixBtn` in `packages/ui/src/popup.ts`. The shipped `popup.js` is an unminified bundle of exactly these files.
