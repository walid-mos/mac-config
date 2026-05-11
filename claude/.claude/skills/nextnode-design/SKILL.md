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

1. Read `package.json` - check for `@nextnode-solutions/brand-assets`, Tailwind, font packages
2. Read the main CSS file - check if `@nextnode-solutions/standards/tailwind` is imported (it provides the brand theme)
3. Read layout/root component - check font loading (Plus Jakarta Sans, DM Sans, JetBrains Mono)
4. Check logo/icon imports - verify they use `@nextnode-solutions/brand-assets` subpath exports

### Phase 2: Provide guidance

Based on the argument, explain the specific design topic. If no argument, audit the project's compliance with the brand guidelines.

Use the relevant sub-file for details:
- [colors.md](colors.md) - full color palette, scales, and usage rules
- [typography.md](typography.md) - font families, weights, sizes, and hierarchy
- [logos.md](logos.md) - logo variants, assets kit, and usage rules

## Surfaces

Client-facing work uses **NextNode brand v2.0** (teal primary, orange accent, dark navy `#141A30` for dark mode, Plus Jakarta Sans + DM Sans + JetBrains Mono). The internal `@nextnode-solutions/monitoring` dashboard uses a separate **Navy** visual language - see `packages/monitoring/CLAUDE.md` and do not adopt it for client work.

## Brand assets package

Logos, icons, and favicons ship from `@nextnode-solutions/brand-assets` as subpath exports. See [logos.md](logos.md) for full subpath table and usage.

## Rules

1. **Use the Tailwind theme** - Import `@nextnode-solutions/standards/tailwind` in the main CSS. Never hardcode brand colors as raw hex values; use Tailwind classes (`text-teal-500`, `bg-orange-500`).
2. **Three fonts, strict roles** - Plus Jakarta Sans for display/hero only, DM Sans for everything else, JetBrains Mono for code.
3. **Teal is primary, orange is accent** - Teal for CTAs, links, primary UI. Orange for highlights only. Never use orange as a primary action color.
4. **Logos always come from `@nextnode-solutions/brand-assets`** - never copy SVGs into project trees, never modify them. Bumping the package version is the single touchpoint when artwork changes.
