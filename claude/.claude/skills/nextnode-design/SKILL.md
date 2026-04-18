---
name: nextnode-design
description: >-
  NextNode Solutions design system and brand guidelines. Colors, typography,
  logos, and UI conventions for all NextNode front-end projects. Load when
  building UI, choosing colors/fonts, or placing logos in NextNode projects.
user-invocable: true
synced-at: brand-guidelines-v2.0-dec-2024
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
