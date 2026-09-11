## What this changes

<!-- One or two sentences. One change per PR. -->

## Checklist

- [ ] `npm run check` passes locally (lint, typecheck, unit, build, manifests, permissions,
      integration, package, packages, e2e).
- [ ] The change keeps the invariants: Zoom-only hosts, user-triggered Zoom-origin cleanup only,
      one-button popup, no telemetry, no remote code, no `<all_urls>`, one shared implementation.
- [ ] Any new permission has a justified row in `docs/security/permissions-matrix.md`.
- [ ] Version numbers were not hand-edited (`npm run bump` owns them).
- [ ] Docs updated if behavior, wording, paths, or commands changed.
