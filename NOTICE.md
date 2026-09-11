# NOTICE

1132 Fixer for Chrome
Copyright (c) 2026 1132 Fixer

This product is licensed under the MIT License. See [LICENSE](LICENSE) for the
full licence text. This NOTICE file records attribution requests,
non-affiliation, and notices for the shipped tree. It does not add conditions
to the MIT licence.

---

## Attribution

The MIT licence does not require attribution beyond preserving the copyright and
permission notice. As a courtesy — not a licence condition — forks and copies
are asked to credit the canonical repository:

`https://github.com/1132-Fixer/browser`

The **1132 Fixer name, logo, and icons are trademarks and are not covered by the
MIT licence**, prospectively from the notice date. See [TRADEMARKS.md](TRADEMARKS.md)
for permitted uses and [ASSET-LICENSE.md](ASSET-LICENSE.md) for the exact file
list and provenance records.

---

## Independence / non-affiliation

1132 Fixer is an independent project. It is **not** made by, endorsed by,
sponsored by, or affiliated with Zoom Video Communications, Inc. "Zoom" is a
trademark of Zoom Video Communications, Inc., used here only to describe the
hosts this extension can clear (`zoom.us` and `zoom.com`).

This extension is also not made by, endorsed by, or affiliated with Google LLC,
Microsoft Corporation, Brave Software, Inc., or Mozilla Foundation. Chrome,
Edge, Brave, and Firefox names appear only to describe which browsers this
repository packages for.

Companion products:

- Windows app: `https://github.com/1132-Fixer/windows`
- macOS app: `https://github.com/1132-Fixer/macos`

The Chrome extension does **not** perform the Windows helper-account (`user1`)
or isolated-profile repair.

---

## Third-party components

The shipped extension does not bundle Electron, Node.js, or a browser runtime.
It runs inside the host browser and uses that browser's extension APIs
(`cookies`, `activeTab`, `scripting`). Those APIs are provided by the host
browser, not vendored in this tree.

Dev-only Node scripts under `scripts/` are not included in the store zip. They
are MIT-licensed project tooling and are not a runtime dependency of the
extension.

Image and icon assets under `icons/` and `assets/` are project brand assets —
see [TRADEMARKS.md](TRADEMARKS.md) and the per-file list in
[ASSET-LICENSE.md](ASSET-LICENSE.md).
