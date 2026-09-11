# Manual validation record

The automated matrix (`docs/testing/README.md`) cannot side-load packages into branded browsers or
run on a physical television. This file is the record for those runs. Every row is filled in from a
real run; an unfilled row is an open gate, never a pass. Copy the package hash from
`release/SHA256SUMS.txt` of the commit under test (CI uploads the same file as an artifact, and the
local build is byte-identical since the LF checkout rule).

## Packages under test

| Commit | Package | SHA-256 |
|---|---|---|
| `170f7b5` (PR #27 head, CI run 34568223726, artifact `1132-fixer-packages-…`) | `chrome/1132-fixer-chrome-1.2.7.zip` | `dead517557cdbac3d65b2b704ab608dff195cd66af1200d16299a0421c9e7c1c` |
| same | `edge/1132-fixer-edge-1.2.7.zip` | `6478f2b9587e780ababcef52ab4a4ae04b770c9992ad12e24571c437813f7ddf` |
| same | `brave/1132-fixer-brave-1.2.7.zip` | `185d8892a3e62697f3065bfcf1627f8c84774edf51db2253266ef61c4b02a4cd` |
| same | `firefox/1132-fixer-firefox-1.2.7.zip` | `0d5530ad29902d12aa7675ae8f8bab125559bb603fb090ad8e5ed5b1f7c6a950` |
| same | `bravia/1132-fixer-bravia-1.2.7.zip` | `70a85711814691d154bda76d479b946782350a07b63a9b768d56d462fd57c56d` |

## Why these runs need a person

Google Chrome and Microsoft Edge removed the command-line flags that side-load an unpacked
extension, and Playwright cannot load extensions into Firefox at all. Loading an unpacked build
therefore needs the browser's own **Load unpacked** (or **Load Temporary Add-on**) dialog, which is a
native file picker. Everything before and after that dialog is prepared here.

## Procedure per browser (identical steps, different folder)

Preparation (done): `npm ci && npm run build` produces `dist/chrome`, `dist/edge`, `dist/brave`,
`dist/firefox`; on Windows, `install.bat` opens Chrome's extensions page and the `dist/chrome` folder.

The one operator action per browser:

| Browser | Open | Then | Expected |
|---|---|---|---|
| Google Chrome (branded) | `chrome://extensions`, Developer mode on | **Load unpacked** → `dist/chrome` | Card "1132 Fixer for Chrome 1.2.7", Site access limited to the four Zoom patterns. |
| Microsoft Edge | `edge://extensions`, Developer mode on | **Load unpacked** → `dist/edge` | Card "1132 Fixer for Edge 1.2.7". |
| Brave | `brave://extensions`, Developer mode on | **Load unpacked** → `dist/brave` | Card "1132 Fixer for Brave 1.2.7". |
| Firefox (temporary) | `about:debugging#/runtime/this-firefox` | **Load Temporary Add-on…** → `dist/firefox/manifest.json` | "1132 Fixer for Firefox 1.2.7" listed; install prompt shows no required data collection. |
| Firefox (signed) | AMO listing after signing (`docs/release/firefox-signing.md`) | **Add to Firefox** | Same, from the signed package. |

Then, in each browser, run the checklist below and fill one row of the results table.

### Checklist (5 minutes)

1. Open a non-Zoom tab, click the icon: **NOT ZOOM**, no button, no network request.
2. Open `https://zoom.us`, click the icon: **ZOOM DETECTED**, one **FIX ZOOM** button; nothing has
   been cleared yet (cookies still present in DevTools → Application → Cookies).
3. Press **FIX ZOOM**: **CLEARED**, "Removed N Zoom cookies. This tab's Zoom site data was cleared.
   Tab reloaded."; the tab reloads; Zoom cookies are gone; cookies for another site are untouched.
4. Press **FIX ZOOM** again: **CLEARED**, "No Zoom cookies were left to remove."
5. Revoke Zoom site access (Chromium: extension details → Site access → "On click"; Firefox: Add-ons
   Manager → Permissions), reopen on a Zoom tab: **ACCESS NEEDED**; press **FIX ZOOM**; accept the
   prompt; **CLEARED**.
6. Open **Feedback & Report**: with the support service reachable, the form shows the disclosure
   text above Submit; Firefox only: pressing Submit shows the data-collection prompt first.
7. Keyboard only: Tab reaches the button, Enter activates it, the focus ring is visible.

### Results

| Date | Tester | Browser and version | OS | Package SHA-256 (first 12) | Steps passed | Evidence (screenshot or log path) | Result |
|---|---|---|---|---|---|---|---|
| | | Google Chrome | | `dead517557cd` | | | OPEN |
| | | Microsoft Edge | | `6478f2b9587e` | | | OPEN |
| | | Brave | | `185d8892a3e6` | | | OPEN |
| | | Firefox (temporary) | | `0d5530ad2990` | | | OPEN |
| | | Firefox (signed) | | `0d5530ad2990` | | | OPEN |

Local machine facts at the time of writing (2026-09-11): Google Chrome 152.0.7977.84 and
Microsoft Edge 152.0.4191.66 are installed; Brave and Firefox are not. Playwright Chromium 1234
and Playwright Firefox 1538 are installed for the automated matrix.

## BRAVIA Professional Display

Preparation (done): `release/bravia/1132-fixer-bravia-1.2.7.zip` contains the client and the Sony
launcher package; the client is published at `https://1132-fixer.github.io/browser/apps/tv/bravia/`
once PR #27 is on `main`.

The one operator action: on a BRAVIA Professional Display in Pro mode with correct date and time,
copy the `sony/` folder from the zip to the root of a USB drive and insert it (procedure and Pro
settings paths in `docs/platforms/bravia.md`).

### Checklist

1. The guide opens full screen with the first card focused; no text is cut off at any edge.
2. Left/Right/Up/Down move focus between the three cards; OK opens a panel; BACK closes it and
   returns focus to the same card; BACK on the home screen leaves the app.
3. Unplug the network: the top-right pill shows OFFLINE and the guide still navigates.
4. Power the display off and on (or let it sleep): the guide returns with a card focused.
5. Record the display model, firmware, WebAppRuntime version (`navigator.userAgent`), and the BACK
   key code observed (add it to `KEY.BACK` in `apps/tv/bravia/tv.js` if it was not handled).

### Results

| Date | Tester | Display model and firmware | Launch method (USB / hosted / built-in) | Package SHA-256 (first 12) | Steps passed | Evidence | Result |
|---|---|---|---|---|---|---|---|
| | | | | `70a857118146` | | | OPEN |

Consumer BRAVIA (Android TV / Google TV): UNSUPPORTED by design; no row.
