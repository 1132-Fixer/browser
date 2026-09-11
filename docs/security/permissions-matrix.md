# Permissions matrix

Every permission and host pattern any target requests, with the reason. This file is machine-checked:
`npm run verify:permissions` (tooling/packaging/verify-permissions.js) fails when a built manifest
requests something that has no row here, when a row marks a target `yes` that no longer requests it,
or when the justification is missing. Add the row first, then the permission.

Rules that bound every row:

- No `<all_urls>`, no `browsingData`, no `tabs`, no `history`, no `webRequest`, no `storage`,
  no `alarms`, no `identity`, no `nativeMessaging`, no background worker, no content scripts.
- No optional permissions. Nothing is requested beyond what the one-button cleanup needs.
- Host access is Zoom only. Both schemes are listed because a non-Secure cookie is mapped to an
  `http://` URL and would otherwise be invisible to the extension.

| Permission | chrome | edge | brave | firefox | Why it is needed | Narrower alternative considered |
|---|---|---|---|---|---|---|
| `cookies` | yes | yes | yes | yes | Enumerate and delete cookies for `zoom.us` and `zoom.com`, including subdomains and partitioned cookies, after the user presses FIX ZOOM. The only destructive API call in the extension is `cookies.remove`. | None. There is no narrower API for deleting a site's cookies. `browsingData` would be broader and cannot target one tab's storage. |
| `activeTab` | yes | yes | yes | yes | Read the active tab's URL when the popup opens, to decide between ZOOM DETECTED and NOT ZOOM, and reload that tab after the cleanup. Grants temporary host access to the current tab only, in response to the user's click on the action. | The `tabs` permission would expose every tab's URL permanently. Rejected. |
| `scripting` | yes | yes | yes | yes | Inject one self-contained function into the active Zoom tab after FIX ZOOM to clear that origin's `localStorage`, `sessionStorage`, Cache API, and IndexedDB. The function re-checks the hostname and refuses non-Zoom origins. No content script is registered; nothing injects on install or page load. | `browsingData.remove` with an origins filter: cannot clear `sessionStorage` and is not limited to the current tab. Rejected. |
| `https://*.zoom.us/*` | yes | yes | yes | yes | Required by the `cookies` API to read and remove cookies on Zoom domains, and by `scripting` to inject only into Zoom pages. | A narrower host list would miss Zoom subdomains such as `us02web.zoom.us`. |
| `https://*.zoom.com/*` | yes | yes | yes | yes | Same as above for Zoom's second domain. | Same. |
| `http://*.zoom.us/*` | yes | yes | yes | yes | Non-Secure Zoom cookies are mapped to an `http://` URL by the browser; without this pattern they would survive the cleanup. | Dropping http would make the cleanup silently incomplete. |
| `http://*.zoom.com/*` | yes | yes | yes | yes | Same as above for Zoom's second domain. | Same. |

## Runtime permission behaviour by browser

| Behaviour | Chromium (Chrome, Edge, Brave) | Firefox |
|---|---|---|
| Host permissions at install | Granted, shown in the install prompt. | Granted and shown in the install prompt from Firefox 127 (source: MDN `host_permissions`). Users can revoke them at any time in the Add-ons Manager. |
| What the popup does when host access is missing | Shows **ACCESS NEEDED**; pressing FIX ZOOM calls `permissions.request` from inside the click handler. | Same code path. The request is issued synchronously in the click handler because Firefox only prompts from a user-input handler. |
| `permissions` API | Available without a manifest entry. | Available without a manifest entry. |
| Data collection declaration | Chrome Web Store privacy questionnaire (dashboard). | `data_collection_permissions.required = ["none"]` (fix flow) and `optional = ["technicalAndInteraction"]` (bug reports; consent requested from the Submit click, refusal sends nothing). Required for new AMO submissions since 3 November 2025. ADR 0007. |

## Explicitly not requested

| Permission | Why not |
|---|---|
| `<all_urls>` | The extension only ever touches Zoom. |
| `browsingData` | Broader than one tab; cannot clear `sessionStorage`. |
| `tabs` | `activeTab` is enough and only lasts for the user-invoked tab. |
| `storage` | The popup stores nothing. The report page keeps one support token in its own extension-origin `localStorage`. |
| `webRequest`, `webNavigation`, `alarms` | No background work exists. Nothing runs without a click. |
| `identity` | No accounts. |
| `nativeMessaging` | No companion process. |
