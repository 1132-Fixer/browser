# 1132 Fixer — brand conventions

This is a **vanilla HTML/CSS system** (no framework, no build). Style with CSS custom properties from `styles.css` — never invent new color literals.

## Setup

Link `styles.css`. Set the page/container background to the navy gradient and default text color:

```html
<link rel="stylesheet" href="styles.css">
<body class="fixer-surface"> … </body>
```

`.fixer-surface` provides the navy Fluent stage (Windows STYLEGUIDE gradient); every component assumes it sits on navy, not white.

## Token vocabulary (the only colors that exist)

- Navy stage: `--bg-0` `#17243a` → `--bg-1` `#203857` (180° gradient)
- Surfaces: `--surface` `#1e2b46`, `--surface-elev` `#243453`
- Borders: `--border` `rgba(255,255,255,0.08)`, `--border-hi` `rgba(58,130,247,0.4)`
- Accent (primary action + focus): `--accent` `#3a82f7`, `--accent-hover` `#4b93ff`, `--accent-down` `#2f6fd6`, `--accent-soft` `#8fc2ff`
- Semantic: `--green-500` `#39d353` (success), `--amber-400` `#f2c94c` (warning), `--red-500` `#f85149` (error)
- Text: `--text` `#f4f7fb`, `--text-dim` `#9ca8bd` (AA on all stage colors; `#7e8597` is reserved for disabled states)
- Type: `--font` (Segoe UI Variable stack); headings weight 600; 12px minimum text size
- Radii: `--radius-btn` 8px for the action button, `--radius-pill` 999px for pills/chips

## Idiom

- One screen, one primary action: a single `.btn-zoom` flat accent button (8px radius, ≥48px tall). Never two primary buttons, never gradients or glow on it.
- State is a `.status-badge` pill (`.scanning` amber, `.done` green, `.error` red, `.neutral` surface) with an 8px `.status-dot`.
- Blue is the action + focus color; the brand orange lives ONLY inside the logo artwork. Green/red are outcomes only.
- Chips are pills (`.badge`): interactive chips (`.site-link`) keep a 44px minimum target; static info chips add `.static` for the compact size.
- Layout: static info pills top (version left, scope right), action links bottom, logo/status/action centered between.
- The hazard stripe motif is RETIRED — footers use a plain `--border` hairline.
- Labels are 12px, weight 600, 0.2px tracking; only the logo descriptor is uppercase.

## Truth

Read `styles.css` (it imports `tokens/tokens.css` and `_ds_bundle.css`) before styling. Component markup patterns live in each component's `.prompt.md`.

## Snippet

```html
<span class="status-badge done"><span class="status-dot"></span>CLEARED</span>
<button class="btn-zoom" type="button">FIX ZOOM</button>
```

---

# 1132 Fixer Design System

Hand-authored from the shipped extension (popup.css is the canonical token source; `1132-Fixer/browser`).

## Components

- Brand/LogoLockup — transparent gear mark + white wordmark + accent separator
- Components/StatusPill — ready / scanning / done / error / neutral
- Components/FixButton — the single flat accent action button
- Components/Badges — static version/scope chips + interactive link pills
- Screens/Popup — full 360px popup (Zoom + non-Zoom states, topbar layout)
