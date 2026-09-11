# AGENTS.md

This file provides guidance when working with code in this repository.

## Working Principles

### Simplicity First

**Minimum code that solves the problem. Nothing speculative.**
**(This is the principle we care about most.)**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## Workspace shape

- One implementation: `packages/core` (no browser namespace), `packages/browser-api` (the only
  file that touches `browser.*` / `chrome.*`), `packages/ui`. A target under `apps/` holds only a
  manifest overlay and a README. Never copy code per browser.
- `npm run check` is the gate. Read `docs/architecture/overview.md` before changing structure and
  `docs/security/permissions-matrix.md` before touching permissions.
- Product claim: "One-click Zoom cookie cleanup for Error 1132". The extension never claims to
  detect or fix Error 1132 (issue #20 ruling; enforced by `npm run lint`).

## Design System
- `design-system/` is a git submodule (`https://github.com/1132-Fixer/design-system.git`) and the source of truth for all design decisions.
- For any design matter — colors, typography, spacing, components, icons, visual patterns — consult `design-system/` first and follow its tokens/components.
- Do not invent new visual patterns, colors, or component styles that diverge from `design-system/`.
- If `design-system/` lacks guidance for a needed case, ask the user before improvising rather than guessing.
- Run `git submodule update --init --recursive` if `design-system/` appears empty. No newline at end of file