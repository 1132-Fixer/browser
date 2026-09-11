# Contributing

Thanks for helping improve the 1132 Fixer browser extension.

## Ground rules

This extension is deliberately small, and the checks enforce that:

- **Zoom only.** Host access is limited to `zoom.us` and `zoom.com`.
- **Zoom-origin only.** Cookies plus the active Zoom tab's localStorage, sessionStorage, Cache API,
  and IndexedDB. Nothing runs until FIX ZOOM.
- **One button.** The popup has a single action and no options.
- **No telemetry, no remote code.** Nothing is fetched or reported at runtime; the Report-a-Bug page
  is the only networked surface and it is user-triggered.
- **One implementation.** Shared logic lives in `packages/core`; browser access goes through
  `packages/browser-api`; a target directory holds only a manifest overlay and a README.
- **Truthful copy.** The approved claim is "One-click Zoom cookie cleanup for Error 1132". The
  extension never claims to detect or fix Error 1132.

Changes that widen any of these need discussion in an issue first. `npm run lint`,
`npm run verify:manifests`, and `npm run verify:permissions` fail on violations by design.

## Developing

1. `npm ci` and `npx playwright install chromium firefox`.
2. `npm run dev:chrome` (or `dev:firefox`, `dev:edge`, `dev:brave`, `dev:bravia`) and load
   `dist/<target>` unpacked. The build rewrites on every change.
3. Keep the change as small as the problem allows. Put shared behaviour in `packages/core` with a
   unit test; put platform differences in the adapter or an overlay, never in a copied file.
4. Run `npm run check` before pushing. It is what CI runs.

## Pull requests

- Keep PRs focused: one change per PR.
- Use conventional commit style (`fix:`, `feat:`, `docs:`, `chore:`), matching the existing history.
- Do not hand-edit version numbers; `npm run bump` updates every copy together.
- A new permission needs a row in `docs/security/permissions-matrix.md` in the same PR.
- CI must be green. The default branch requires a pull request with one approval.

## Reporting bugs

See [SUPPORT.md](SUPPORT.md). For security issues, use [SECURITY.md](SECURITY.md), never a public
issue.
