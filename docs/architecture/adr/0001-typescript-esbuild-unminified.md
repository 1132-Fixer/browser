# ADR 0001: TypeScript sources, esbuild bundles, no minification

Status: accepted, 2026-09-10.

## Context

The extension was four vanilla JavaScript files at the repository root with no build step and no
dependencies. Sharing one implementation across Chrome, Edge, Brave, and Firefox needs modules;
extension pages cannot load ES modules across a copied directory layout without a bundler or import
maps (import maps are inline script and are blocked by the MV3 CSP). The directive prefers
TypeScript with strict typing where compatible.

## Decision

- Shipped sources are TypeScript under `packages/*/src`, type-checked with `tsc --noEmit` under
  `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, and `erasableSyntaxOnly`.
- Bundling uses esbuild to plain IIFE scripts, ES2022, per-family engine target, **unminified**, with
  no source maps, so a reviewer can read the shipped bundle and diff it against the sources.
- Unit tests import the TypeScript files directly through Node's built-in type stripping (Node 22.18+),
  which is why only erasable syntax is allowed.
- The BRAVIA TV client stays plain JavaScript (JSDoc, `checkJs`) because it is served as-is by GitHub
  Pages and by Sony's runtime, with no build step.

## Consequences

- Four pinned dev dependencies (esbuild, typescript, playwright, web-ext) and a lockfile replace the
  previous global-install hack. Nothing from `node_modules` ships.
- AMO requires source submission for bundled code; every target README carries the reproducible
  build recipe and `.nvmrc` pins Node.
- The injected page cleaner must stay self-contained; a unit test executes its source text in a bare
  `vm` to enforce that, and the e2e mock executes the bundled function for real.
