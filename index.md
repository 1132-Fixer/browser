---
layout: default
title: 1132 Fixer for Chrome
description: Clear Zoom site data in Chrome with one guided action. Zoom-origin only. Zoom-only host permissions. MV3. User-triggered. No telemetry. No remote code.
hero_title: Fix Zoom 1132 in one click.
hero_sub: 1132 Fixer is a one-button Chrome extension that deletes Zoom cookies and this tab's Zoom site data, then reloads the active Zoom tab. Nothing is cleared until you press FIX ZOOM. Zoom-only host access. Everything runs locally in your browser. No accounts. No telemetry. No remote code.
permalink: /
---

<div class="cta-row" markdown="0">
  <div class="cta-card">
    <h3>Install</h3>
    <p>Build and load the 1.2.7 source for Chrome, Edge, Brave, or Firefox. The Chrome Web Store listing is live but older (measured 1.2.1) — this repo does not publish.</p>
    <a class="btn" href="https://github.com/1132-Fixer/chrome#quick-start">Get the extension</a>
  </div>
  <div class="cta-card">
    <h3>Privacy</h3>
    <p>Read the full canonical privacy policy. The fix flow is local; bug reports are optional and user-triggered.</p>
    <a class="btn secondary" href="./privacy.html">Read privacy policy</a>
  </div>
</div>

## What Error 1132 means here

In **this browser tool**, Zoom Error 1132 is treated as stale Zoom *browser* state: cookies on `zoom.us` / `zoom.com` and this tab's Zoom site data. Clearing that state after **FIX ZOOM** and reloading the tab is the whole job.

This is **not** the Windows-profile path. The [Windows app](https://github.com/1132-Fixer/windows) uses a helper account named `user1`. This extension does not create Windows accounts, does not touch `user1`, and does not launch Zoom Workplace.

## What it does

1132 Fixer is the Chrome sibling of [1132 Fixer for Windows](https://github.com/1132-Fixer/windows). One purpose: clear Zoom browser state related to error **1132**, then reload the Zoom tab.

- On `zoom.us`, `zoom.com`, or any of their subdomains, the popup shows **ZOOM DETECTED** and a single **FIX ZOOM** button. No options, no checkboxes, no log to read.
- On any other site (or `chrome://` / `about:` pages), the popup shows one line asking you to open a Zoom tab. No button is offered. The extension does not request access to non-Zoom hosts.
- Every clear is user-triggered. The popup never deletes anything on open, install, startup, page-load, or a timer.

Source version is **1.2.7**. Chrome, Edge, Brave, and Firefox packages are built from one shared implementation; Firefox behaviour is tested in the real Gecko engine, while a signed Firefox install is still `MANUAL_VALIDATION_REQUIRED`. The live Chrome Web Store listing was measured **1.2.1**. A [TV guide for Sony BRAVIA Professional Displays](./apps/tv/bravia/) explains why the extension cannot run on a television and what to do instead.

## What it does *not* do

- **No Windows `user1` / isolated-profile repair.** That is the Windows app only.
- **No unrelated-origin clearing.** Other sites, the global HTTP cache, and service workers are left alone. Zoom site data is cleared only in the active Zoom tab, and only after **FIX ZOOM**.
- No data collection. No analytics. No telemetry pings of any kind.
- No remote code. Every script ships in the package — no `fetch`, no `XMLHttpRequest`, no `WebSocket`, no `sendBeacon`, no `eval`, no `new Function`.
- No external fonts, stylesheets, images, or remote config.
- No reading of your cookie values. The extension only **deletes**; the UI surfaces a single count.
- No access to non-Zoom domains. Host permissions are scoped to Zoom's two domains — Chrome will not let the extension touch anything else.
- The global HTTP cache is **never** wiped.

## Permissions, in plain English

| Permission                                                                                        | Used for                                                                                                                |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `cookies`                                                                                         | Enumerate and delete cookies for `zoom.us` and `zoom.com`.                                                              |
| `activeTab`                                                                                       | Read the active tab's URL when you open the popup; reload it after a successful clear.                                  |
| `scripting`                                                                                       | One-shot inject into the active Zoom tab after **FIX ZOOM**, to clear that origin's `localStorage`, `sessionStorage`, Cache API, and IndexedDB. The injected function refuses any other host. No content script is registered. |
| Hosts: `https://*.zoom.us/*`, `https://*.zoom.com/*`, `http://*.zoom.us/*`, `http://*.zoom.com/*` | Required by `chrome.cookies` to operate on Zoom domains, and by `scripting` to inject only into those hosts. Both schemes are listed so non-Secure Zoom cookies are visible too. No broader host access is requested. |

There is no `browsingData` permission and no `<all_urls>` host permission. `scripting` is the minimum extra permission the in-page Zoom-origin cleaner needs.

## Where to go next

- **Privacy:** [Full privacy policy](./privacy.html)
- **Source:** [github.com/1132-Fixer/chrome](https://github.com/1132-Fixer/chrome)
- **Windows sibling:** [github.com/1132-Fixer/windows](https://github.com/1132-Fixer/windows)
- **License:** Code, documentation, and design tokens are [MIT](https://github.com/1132-Fixer/chrome/blob/main/LICENSE). The 1132 Fixer name, logo, icons, and brand artwork are **not** covered by the MIT licence, prospectively from the notice date — see [TRADEMARKS](https://github.com/1132-Fixer/chrome/blob/main/TRADEMARKS.md), the per-file [ASSET-LICENSE](https://github.com/1132-Fixer/chrome/blob/main/ASSET-LICENSE.md), and [NOTICE](https://github.com/1132-Fixer/chrome/blob/main/NOTICE.md).
- *Independent project. Not affiliated with Zoom Video Communications, Inc.*
