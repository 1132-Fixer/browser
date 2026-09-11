# ADR 0004: BRAVIA delivery is a hosted HTML5 guide for Professional Displays

Status: accepted, 2026-09-10.

## Context

Sony BRAVIA televisions run Android TV (2015 to 2020) or Google TV (2021 onward). BRAVIA
Professional Displays add a Pro mode with Sony's HTML5 WebAppRuntime, launched from a hosted URL,
built-in storage, or USB. None of these platforms has a browser-extension runtime, and no TV app can
clear another app's data. The extension's function therefore has no equivalent on a TV.

## Decision

Ship `apps/tv/bravia`: a ten-foot, D-pad navigable static guide that states the boundary and routes
the viewer to the extension on a computer, the Windows app, or the TV's own Settings for a Zoom app
installed on the TV. Deliver it through Sony's documented HTML5 app mechanism (launcher manifest with
`web_url`, `autorun.txt`), hosted on the repository's GitHub Pages site. Consumer BRAVIA sets are
documented as unsupported.

Rejected alternatives:

- Android TV app: needs Android Studio, Play Console or sideloading, and signing keys, to show a
  guidance page. Not justified.
- Cast or companion app: nothing to cast; the extension's work happens in a desktop browser.
- Claiming BRAVIA support for the extension: false.

## Consequences

- The TV client can be verified in Chromium at TV viewports (automated) but the Sony runtime, remote
  key codes, and Pro-mode launch need a physical display.
- Merging to `main` publishes the guide on the Pages site (static files, no permissions, no
  network); the PR states this explicitly.
