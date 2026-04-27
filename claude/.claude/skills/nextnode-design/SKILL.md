---
name: nextnode-design
description: >-
  NextNode Solutions design system and brand guidelines. Colors, typography,
  logos, and UI conventions for all NextNode front-end projects. Load when
  building UI, choosing colors/fonts, or placing logos in NextNode projects.
user-invocable: true
synced-at: a755da5
---

# NextNode Design System

Brand guidelines and visual identity for NextNode Solutions projects. Based on Brand Guidelines v2.0 (December 2024).

## Arguments

- No argument: full design system overview
- `colors`: color palette and usage rules
- `typography`: font families, weights, sizes
- `logos`: logo variants, assets, and usage rules

## Instructions

### Phase 1: Read the project

1. Read `package.json` — check for `@nextnode-solutions/brand-assets`, Tailwind, font packages
2. Read the main CSS file — check if `@nextnode-solutions/standards/tailwind` is imported (it provides the brand theme)
3. Read layout/root component — check font loading (Plus Jakarta Sans, DM Sans, JetBrains Mono)
4. Check logo/icon imports — verify they use `@nextnode-solutions/brand-assets` subpath exports

### Phase 2: Provide guidance

Based on the argument, explain the specific design topic. If no argument, audit the project's compliance with the brand guidelines.

Use the relevant sub-file for details:
- [colors.md](colors.md) — full color palette, scales, and usage rules
- [typography.md](typography.md) — font families, weights, sizes, and hierarchy
- [logos.md](logos.md) — logo variants, assets kit, and usage rules

## Two design surfaces

NextNode currently runs **two distinct visual languages** — pick the right one for the project:

| Surface | Used by | Tokens / Theme | Tone |
|---------|---------|---------------|------|
| **NextNode brand v2.0** | All client-facing sites + marketing surfaces | `@nextnode-solutions/standards/tailwind` (currently minimal — the brand theme primarily lives as conventions, not tokens) + `@nextnode-solutions/brand-assets` for logos | Teal primary, orange accent, dark navy `#141A30` for dark mode. **This is the brand.** |
| **Navy (Lexington)** | `@nextnode-solutions/monitoring` only — the internal control-plane dashboard | `packages/monitoring/src/styles/tokens.css` — OKLCH `accent-*` (teal/mint) + `base-*` (off-white to slate), Inter / InterDisplay / JetBrains Mono fonts, layered shadows | Light theme, OKLCH palette, Navy foundation components (Button, Text, Wrapper, Kicker, Dots). **Internal tooling only — do not adopt for client work.** |

When in doubt: **client project → brand v2.0**, **monitoring/internal admin UI → Navy**. They are not interchangeable. The brand theme is what NextNode *is*; Navy is a stylistic baseline borrowed for the dashboard's specific needs (information density, light theme, mono-heavy data display).

For Navy specifics, see `packages/monitoring/CLAUDE.md` (in the @nextnode/core repo) — it documents the palette, component conventions, and the "stay flat white" content-area rule.

## Brand assets package

`@nextnode-solutions/brand-assets` ships every official logo, icon, and favicon as importable subpath assets — no need to copy SVGs into individual projects.

Subpath exports:

| Path | What it ships |
|------|---------------|
| `./icons/*` | Square icon variants (black/teal/white) + mini sizes + .png |
| `./icons-text/*` | Icon + text-aligned variants |
| `./logos-square/*` | Full square logo (black/teal/white + mini) |
| `./logos-landscape/*` | Landscape logos — long + short variants in each color |
| `./social/*` | Social avatars (avatar-light, avatar-dark) |
| `./favicon/*` | favicon.svg, favicon.png, favicon-mini.png |

Usage:

```ts
import logoTeal from '@nextnode-solutions/brand-assets/logos-square/logo-square-teal.svg'
import faviconSvg from '@nextnode-solutions/brand-assets/favicon/favicon.svg'
```

Never copy these SVGs into a project — install the package and import. This guarantees a single source of truth for brand artwork across all NextNode sites.

## Core Identity

- **Mission**: Custom, performant, maintainable digital solutions
- **Values**: Technical excellence, transparency, human support, pragmatic innovation
- **Name meaning**: Next = future/innovation, Node = connection/technical robustness

## Quick Reference

| Token | Value | Usage |
|---|---|---|
| Primary | `teal-500` / `#0D9488` | CTAs, links, primary actions |
| Accent | `orange-500` / `#F97316` | Highlights, attention-grabbers |
| Dark | `#141A30` | Dark mode backgrounds |
| Light | `#F8FAFC` | Light mode backgrounds |
| Display font | Plus Jakarta Sans | Hero titles, impact elements |
| Body font | DM Sans | Content, navigation, buttons |
| Code font | JetBrains Mono | Code blocks, technical data |

## Rules

1. **Use the Tailwind theme** — Import `@nextnode-solutions/standards/tailwind` in the main CSS. Never hardcode brand colors as raw hex values; use Tailwind classes (`text-teal-500`, `bg-orange-500`).
2. **Three fonts, strict roles** — Plus Jakarta Sans for display/hero only, DM Sans for everything else, JetBrains Mono for code. Never mix roles.
3. **Teal is primary, orange is accent** — Teal for CTAs, links, primary UI. Orange for highlights and attention only. Never use orange as a primary action color.
4. **Dark Navy for dark mode** — Use `#141A30` as the dark mode background, not black or gray.
5. **Logo integrity** — Never modify gradient colors, deform, stretch, add effects, or use below minimum sizes. Import SVGs from `@nextnode-solutions/brand-assets`.
6. **Font weights are prescribed** — Display: 600/700/800. Body: 400/500/600/700. Do not use weights outside these ranges.
7. **Size hierarchy matters** — Display 48px, H1 36px, H2 28px, Body 16px, Small 14px. Follow this scale consistently.
8. **Brand vs Navy is exclusive** — never mix brand v2.0 tokens with Navy tokens in the same surface. Client work uses brand. The internal monitoring dashboard uses Navy. Cross-pollination breaks both.
9. **Logos always come from `@nextnode-solutions/brand-assets`** — never copy SVGs into project trees, never modify them. Bumping the brand-assets version is the single touchpoint when artwork changes.
