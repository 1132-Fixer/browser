# Safari: documented path, not implemented

Safari can run this extension only inside a native macOS or iOS app produced with Apple's Safari web
extension packager. That requires a Mac with Xcode and an Apple Developer Program membership for
distribution. This repository has no macOS tooling, and the organization's macOS product lives in a
separate repository that this workspace does not touch.

## The path, when someone with a Mac picks it up

1. Build the Chrome target: `npm run build:chrome`.
2. On a Mac with Xcode installed:

   ```bash
   xcrun safari-web-extension-converter dist/chrome --project-location build/safari --app-name "1132 Fixer" --bundle-identifier xyz.fixer1132.safari --copy-resources
   ```

   The packager generates an Xcode project containing the extension and reports any manifest keys
   Safari does not support.
3. Expected review points:
   - `browser_specific_settings.safari.strict_min_version` may be added through a new overlay
     (`apps/extensions/safari/manifest.overlay.json`) following the Firefox pattern.
   - Safari does not show host permissions in the install prompt; the ACCESS NEEDED path already
     covers a user who has not granted site access.
   - `cookies` API, `scripting.executeScript` with `func`, and `permissions.request` exist in Safari's
     WebExtension implementation; behaviour with `partitionKey` must be verified on a device.
4. Distribution: sign the containing app; ship through the App Store, or Developer ID sign and
   notarize for distribution outside the Mac App Store.

## Verification status

Not implemented. No claim of support. Sources: `docs/research/primary-sources.md` (Safari rows).
