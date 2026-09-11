# Sony BRAVIA: feasibility and deployment

## Conclusion

A browser extension cannot run on any BRAVIA television or display. No BRAVIA platform ships a
desktop browser with an extension runtime.

| BRAVIA family | Operating system | Delivery model that exists | 1132 Fixer status |
|---|---|---|---|
| Consumer BRAVIA (2015 to 2020 models) | Android TV | Android TV app via Google Play, or APK sideloading through Developer options / ADB | **Unsupported.** No extension runtime. A native TV app is not justified for a guidance page. |
| Consumer BRAVIA (2021 and later) | Google TV (Android TV OS) | Same as above | **Unsupported.** Same reason. |
| BRAVIA Professional Displays with Pro mode (BZ40P / BZ35P / BZ30P and other Pro models) | Android TV OS with Sony Pro mode and the Sony WebAppRuntime | HTML5 application launched from a hosted URL, from built-in storage, or from a USB drive; Android APK install from USB; IP control APIs | **Implemented: TV guide client** (`apps/tv/bravia`). Emulator-verified; physical-device validation required. |

Sources are recorded in `docs/research/primary-sources.md`.

## What the BRAVIA client is, and is not

The 1132 Fixer browser extension clears Zoom cookies and site data inside a desktop browser. A
television has no such browser and no API that lets one app clear another app's data. So the
closest maintainable supported client is a **guidance surface**: a ten-foot web page that tells the
viewer why the extension cannot run here and what to do instead, built for the Pro display HTML5
runtime.

It does:

- Explain the boundary honestly ("BROWSER EXTENSION NOT AVAILABLE ON THIS TV").
- Offer three D-pad navigable options: use the extension on a computer, use the Windows app, or clear
  a Zoom app installed on the TV through the TV's own Settings (generic Android TV path, with a
  note that menu names vary by model).
- Work offline (it needs no network after load), recover focus after resume, and show connectivity.

It does not:

- Clear anything. It cannot.
- Send anything. `tv.js` has no `fetch`, no storage, no analytics.
- Claim that Error 1132 will be fixed.

## Deployment on a BRAVIA Professional Display

The build writes `dist/bravia/` and `release/bravia/1132-fixer-bravia-<version>.zip` containing:

```text
index.html, tv.css, tv.js                          the client
sony/autorun.txt                                   { "action": "auid", "auid": "xyz.fixer1132.tvguide" }
sony/apps/webapps/1132-fixer/app/manifest.json     Sony launcher manifest, web_url -> hosted client
```

### Option A: hosted URL (primary)

1. Host `index.html`, `tv.css`, `tv.js` on an https server with a valid certificate. The GitHub
   Pages site for this repository serves them at
   `https://1132-fixer.github.io/chrome/apps/tv/bravia/` once this change is on `main` (the page is
   plain static content; no build step is needed).
2. On the display: `[Pro settings] → [Start Pro mode]`. Set the display's date and time (https
   fails on a wrong clock) and, if needed, import the root certificate under
   `[Pro settings] → [HTML5 platform]`.
3. Copy the `sony/` folder to the root of a USB drive and insert it. The display reads
   `autorun.txt`, matches the `auid` in the launcher manifest, and opens `web_url`.
4. Optional: `[Pro settings] → [Home key behaviour] → [Web app]` to bind the Home key, and
   `[Pro settings] → [Initial input source] → [Start-up app]` to open it on power-on.

### Option B: built-in storage or USB

Set `app.launch.local_path` to `file://localhost/doc/index.html` in the launcher manifest, place the
three client files in `sony/apps/webapps/1132-fixer/app/doc/`, and use `"action": "copyapp"` in
`autorun.txt` to install to built-in storage. See Sony's running-methods page for the `copyapp`,
`media`, and `removeapp` options.

### Remote control and keys

Arrow keys move focus, OK opens, BACK returns. The client handles key codes 37 to 40, 13, and Back as
8 / 27 / 461 / 10009. Sony documents extra keys (`VK_HOME`, channel keys) through the manifest's
`attachkeys`; none are needed. Verify the Back key code on a physical display and add it to
`KEY.BACK` in `tv.js` if it differs.

### Debugging

Enable `[Settings] → [Developer options]`, then `adb connect <display-ip>`, `adb logcat`, and
`chrome://inspect/#devices` on a PC, as documented on Sony's development-basics page.

## Verification status

| Check | Status |
|---|---|
| Layout at 1280x720, 1920x1080, 3840x2160; 5% safe area; no scrolling | Automated in Playwright Chromium (`npm run test:e2e:bravia`) |
| D-pad order, OK, BACK (8 / 27 / 461), focus recovery on `pageshow`, offline banner | Automated in Playwright Chromium |
| Launcher package structure and version | `verify:packages` |
| Behaviour inside Sony's WebAppRuntime, real remote key codes, Pro-mode launch, suspend/resume | **Requires physical-device validation** on a BRAVIA Professional Display in Pro mode |
| Consumer BRAVIA (Android TV / Google TV) | **Unsupported** by design |

## Why not an Android TV app

An Android TV app would need Android Studio, a Leanback launcher activity, Play Console publishing or
APK sideloading, and signing keys, to show the same guidance the HTML5 client shows. Sony's Pro
displays already run HTML5 apps natively, and consumer sets gain nothing from a guidance page they
cannot act on. The cost is not justified; this is recorded as ADR 0004.
