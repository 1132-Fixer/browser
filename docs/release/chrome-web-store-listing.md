# Chrome Web Store — listing copy, ready to paste

Everything below is the finished text for the developer dashboard, matching the repository's **v1.2.7** manifest (`cookies` + `activeTab` + `scripting`, four Zoom host patterns, user-triggered Zoom-origin site-data clear).

Two notes before you start:

- **These fields cannot be automated.** The Chrome Web Store API only uploads a package and publishes an item; listing copy, permission justifications and privacy answers exist solely in the dashboard UI. This file is the paste source.
- **Every field is plain text.** The dashboard does not render Markdown, so paste the blocks exactly as they appear — the line breaks and blank lines are the formatting.

Dashboard: <https://chrome.google.com/webstore/devconsole>

---

## Tab: Store listing

### Name

```text
1132 Fixer for Chrome
```

### Summary

The store pre-fills this from the manifest description; replace it with this so the wording matches the listing body.

```text
Clear Zoom site data in Chrome with one guided action.
```

### Detailed description

```text
Zoom error 1132 usually means stale Zoom browser state, not a broken account. 1132 Fixer deletes your Zoom cookies and this tab's Zoom site data, then reloads the tab so you can sign in again. One button, nothing to configure.

HOW IT WORKS

Open zoom.us or zoom.com (any subdomain works) and click the 1132 Fixer icon. The popup shows ZOOM DETECTED and a single FIX ZOOM button. Click it and the extension deletes every cookie Chrome holds for zoom.us and zoom.com, clears this tab's localStorage, sessionStorage, Cache API, and IndexedDB, reloads the active Zoom tab, and tells you what it cleared. That is the whole interface. Opening the popup, or merely detecting Zoom, does not clear anything.

On any other site, including chrome:// pages, the popup shows one line asking you to open a Zoom tab. The FIX ZOOM button does not appear, because there is nothing for it to do; only the footer links to the project website and issue page remain.

ZOOM-ORIGIN ONLY

This extension clears Zoom cookies and the active Zoom tab's Zoom site data. That is all it clears.

It does not touch other sites, service worker registrations, or Chrome's global HTTP cache. Page-data cleanup is injected only into the active Zoom tab after you click FIX ZOOM, and the injected function refuses to run on any other origin.

WHAT IT DOES NOT DO

- No data collection. No analytics. No telemetry.
- No network requests from the fix flow or the popup. The popup's code never contacts any server; its footer links open a normal browser tab only when you click them, and the tab reload after a clear loads the Zoom page like any ordinary visit. The only networked surface is the optional Report-a-Bug page: opening it asks our support service once whether reporting is available (no user data), and it transmits your report — description, optional screenshot, extension version, browser user-agent — only when you press Submit.
- No remote code. Every script ships inside the package; nothing is fetched or evaluated at runtime.
- No reading of your cookies. The extension deletes them and reports a count. Cookie names and values are never read into the interface, logged, or transmitted.
- No automatic clearing. Opening the popup deletes nothing. Nothing runs on install, on startup, on page load, or on a timer.
- No host permissions beyond Zoom, and no reading of any non-Zoom page. Chrome enforces the permission boundary, not just our code. The one non-Zoom connection the extension can make is the Report-a-Bug page's request to the project's own support service, described above — user-initiated, never page data.
- No account, no sign-in. Submitting a bug report mints a random per-install support reference so staff replies can be matched to your install; it identifies no person, is stored only on your machine, and is never used for tracking.

PERMISSIONS, IN PLAIN ENGLISH

- cookies: list and delete cookies for zoom.us and zoom.com.
- activeTab: read the active tab's address so the popup knows whether you are on Zoom, and reload that tab after a clear.
- scripting: inject a one-shot cleaner into the active Zoom tab after FIX ZOOM, so that origin's localStorage, sessionStorage, Cache API, and IndexedDB can be cleared. Nothing is injected on install or page load.
- Host access: zoom.us and zoom.com only, over both https and http. Both schemes are needed because Chrome hides a non-Secure cookie from an extension that only asks for https, which would leave stale cookies behind.

GOOD TO KNOW

- The clear covers subdomains such as us02web.zoom.us, and covers partitioned (CHIPS) cookies where your Chrome version supports it.
- Cookies are cleared for the Chrome profile you are using. An Incognito window keeps a separate cookie jar.
- You will be signed out of Zoom in the browser. That is the point: the next sign-in starts clean.
- If a 1132 loop survives this clear, the cause is elsewhere, and Chrome's own Settings > Privacy and security > Delete browsing data covers the heavier options.

SOURCE CODE

Source code is public under the MIT license: https://github.com/1132-Fixer/browser

The MIT license covers the code, the documentation, and the design tokens. The 1132 Fixer name, logo, icons, and brand artwork are not covered by it, prospectively from the notice date: https://github.com/1132-Fixer/browser/blob/main/TRADEMARKS.md (per-file list: https://github.com/1132-Fixer/browser/blob/main/ASSET-LICENSE.md). Forks are welcome under MIT — please pick your own name and icon.

The repository ships its own checks, including a validator that fails the build if a broader permission or a hidden auto-clear is ever reintroduced, and a browser test suite that verifies the extension does nothing at all on lookalike hostnames such as zoom.us.evil.com.

Chrome sibling of 1132 Fixer for Windows: https://github.com/1132-Fixer/windows

Independent project. Not affiliated with, endorsed by, or sponsored by Zoom Video Communications, Inc. "Zoom" is their trademark, used here only to say which site this extension works on.
```

### Category and language

| Field    | Value                   |
| -------- | ----------------------- |
| Category | Productivity            |
| Language | English (United States) |

### Graphic assets

Build them all with `npm run assets` (screenshot 4 is optional: `node tooling/store-assets/make-trust-card.js` produces the branded trust card — run manually and review against `ds-bundle/` before use, its styling is not yet design-system-aligned; `npm run assets:details` can replace it with a real chrome://extensions Details capture), then upload from `store-assets/`:

| Slot                            | File                                             |
| ------------------------------- | ------------------------------------------------ |
| Store icon (128×128)            | `store-assets/icon128-store.png`                 |
| Screenshot 1                    | `store-assets/01-zoom-detected.png`              |
| Screenshot 2                    | `store-assets/02-fix-complete.png`               |
| Screenshot 3                    | `store-assets/03-non-zoom-safe.png`              |
| Screenshot 4                    | `store-assets/04-extension-details-permissions.png` |
| Small promo tile (440×280)      | `store-assets/promo-440x280.png`                 |
| Marquee promo tile (1400×560)   | `store-assets/promo-1400x560.png`                |

`npm run assets:verify` confirms all seven are the exact required size and carry no alpha channel before you upload.

### Additional fields

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| Official URL    | None — leave unset until a domain is Search-Console-verified        |
| Homepage URL    | `https://github.com/1132-Fixer/browser`                             |
| Support URL     | `https://github.com/1132-Fixer/browser/issues`                      |
| Mature content  | No                                                                 |
| Item support    | On                                                                 |

---

## Tab: Privacy practices

### Single purpose

```text
1132 Fixer deletes cookies for zoom.us and zoom.com, including their subdomains, and clears the active Zoom tab's localStorage, sessionStorage, Cache API, and IndexedDB, then reloads that tab. It exists to clear Zoom error 1132 and similar stale Zoom-browser-state sign-in loops. Cleanup is user-triggered only. Zoom domains are the only sites it can reach.
```

### Permission justification — `cookies`

```text
The extension deletes cookies, so it needs the cookies permission to do its single job. It calls chrome.cookies.getAll to list the cookies stored for zoom.us and zoom.com and their subdomains, then chrome.cookies.remove to delete each one. Cookie values are never read, copied, logged, or transmitted anywhere: removal only needs a cookie name, domain, path and partition key. The popup reports a count, for example "Removed 17 Zoom cookies.", and never a cookie name or value. Nothing is deleted until the user clicks FIX ZOOM.
```

### Permission justification — `activeTab`

```text
The popup reads the active tab's URL when it opens, so it can tell whether the user is on a Zoom domain. On a Zoom tab it shows ZOOM DETECTED and a FIX ZOOM button; anywhere else it shows no FIX ZOOM button, which prevents the user from clearing data from a page where that would be surprising. After a clear completes, the extension calls chrome.tabs.reload on that same tab so the signed-out state takes effect immediately. No content script is injected at install or page-load time, and page content is never read.
```

### Permission justification — host permissions

Covers all four patterns: `https://*.zoom.us/*`, `https://*.zoom.com/*`, `http://*.zoom.us/*`, `http://*.zoom.com/*`.

```text
Chrome only exposes a cookie to an extension that holds host permission for the URL the cookie belongs to, so chrome.cookies cannot see or delete Zoom cookies without these patterns. The same host patterns let chrome.scripting.executeScript run only in Zoom tabs after FIX ZOOM. Both schemes are requested because Chrome maps a non-Secure cookie to an http:// URL: with https-only patterns, stale non-Secure Zoom cookies stay invisible and the clear silently misses them. Access is limited to zoom.us and zoom.com; no other host is requested, and the extension cannot read or change data on any other site. No content scripts are registered. `<all_urls>` is not requested.
```

### Permission justification — `scripting`

```text
scripting is required to run a one-shot, user-triggered cleaner inside the active Zoom tab so that origin's localStorage, sessionStorage, Cache API, and IndexedDB can be cleared. Those APIs are not reachable from chrome.cookies. The injected function re-checks location.hostname and refuses to run on any non-Zoom origin. No content script is registered, so nothing injects on install, startup, or page load. browsingData is not requested: it cannot clear sessionStorage and is broader than the current Zoom tab.
```

> Do not request `browsingData` or `<all_urls>`. If the form still shows a leftover `browsingData` justification from v1.1.0, clear it.

### Remote code

Select **No, I am not using remote code.** Every script and style ships inside the package; the extension makes no network requests of its own and uses no `eval` or `new Function`.

### Data usage — leave all nine boxes unchecked

| Disclosure                         | Answer        |
| ---------------------------------- | ------------- |
| Personally identifiable information | Not collected |
| Health information                 | Not collected |
| Financial and payment information  | Not collected |
| Authentication information         | Not collected — cookies are deleted, never read |
| Personal communications            | Not collected |
| Location                           | Not collected |
| Web history                        | Not collected |
| User activity                      | Not collected |
| Website content                    | Not collected — no content scripts, no page reads |

Then tick *I do not collect or transmit user data*.

### Certifications — tick all three

- I do not sell or transfer user data to third parties outside the approved use cases.
- I do not use or transfer user data for purposes unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

```text
https://1132-fixer.github.io/browser/privacy.html
```

---

## Tab: Distribution

| Field              | Value                                              |
| ------------------ | -------------------------------------------------- |
| Visibility         | Public — only after the manual walk and your approval |
| Geographic regions | All regions                                        |
| Pricing            | Free                                               |

---

## Privacy policy contact

`PRIVACY_POLICY.md` now names the repository issues page as the canonical public contact point, so no field is left as a placeholder. If you would rather publish a support email, swap it into the **Contact** section before submitting — the rest of that document already matches v1.2.0 behaviour.

## Before you submit

1. `npm test` — validator and e2e suites both green.
2. `npm run assets && npm run assets:verify` — all seven graphics conform.
3. `npm run build:chrome && npm run package:chrome` — builds `release/chrome/1132-fixer-chrome-<version>.zip` at the current manifest version.
4. Walk the manual checklist in [README.md](README.md), on a signed-in Zoom session. Rows 6 and 7 (signed out after the clear, preferences survive) are the two that only a real session can prove.
5. Optionally retake screenshot 2 during that walk, so it shows a real cookie count instead of the "No Zoom cookies were left to remove." state the mocked capture produces.
6. Upload: **Actions → Publish to Chrome Web Store**, `mode=upload-draft`. Review the draft in the dashboard, then re-run with `upload-and-publish` when you are satisfied.
