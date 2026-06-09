---
name: nextnode-design
description: >-
  NextNode Solutions design system and brand guidelines (colors, typography,
  logos, UI conventions). Load when building UI or placing brand assets in any
  NextNode front-end project. For a full design or redesign workflow, use
  /design instead.
user-invocable: true
synced-at: a755da5
---

# NextNode Design System

Brand guidelines and visual identity for NextNode Solutions projects. The live source of truth is `nextnode-landing/src/styles/global.css`; the Brand Guidelines v2.0 (December 2024) doc is stale on token names. **If `global.css` is unreachable, fail hard** — refuse to emit colors/tokens rather than guessing or copying stale hex.

## Quick Reference

| NEVER | ALWAYS |
|---|---|
| Hardcode raw hex or OKLCH literals in components | Use semantic token classes (`text-accent-500`, `bg-accent-100`, `text-base-900`) |
| Use `text-teal-500` / `bg-orange-500` (stale Tailwind v3 names) | Use `accent-*` and `base-*` token classes |
| Fill large blocks with `accent-500` | Reserve `accent-500` for the single primary CTA and small indicators |
| Use orange for primary actions (Approve, Submit, Confirm) | Use orange for badges, highlights, alerts only |
| Copy SVGs into project trees or modify them | Import logos from `@nextnode-solutions/brand-assets` only |
| Use Plus Jakarta Sans for body text | Use DM Sans for body; Plus Jakarta Sans for display/hero only |
| Assume `@nextnode-solutions/standards/tailwind` carries brand tokens | Each project declares its own `@theme` mirroring `nextnode-landing/src/styles/global.css` |
| Invent a custom spacing/radius scale | Use Tailwind v4 defaults — `global.css` defines none (see Scale discipline) |
| Reach for arbitrary values by reflex — `text-[17px]`, `p-[13px]` | Default to the scale token — `text-sm`, `p-3`, `md:`; arbitrary only when the scale can't express the need |
| Guess brand colors when `global.css` is unreachable | Fail hard — refuse to emit tokens rather than ship a wrong palette |

## Instructions

### Phase 1: Read the project

1. Read `package.json` - check for `@nextnode-solutions/brand-assets`, Tailwind, font packages
2. Read the main CSS file - check if it declares an `@theme` block mirroring `nextnode-landing/src/styles/global.css` (`@nextnode-solutions/standards/tailwind` does NOT carry the brand palette; it ships only `--breakpoint-xs`)
3. Read layout/root component - check font loading (Plus Jakarta Sans, DM Sans, JetBrains Mono)
4. Check logo/icon imports - verify they use `@nextnode-solutions/brand-assets` subpath exports

### Phase 2: Provide guidance

Based on the argument, explain the specific design topic. If no argument, audit the project's compliance with the brand guidelines.

Use the relevant sub-file for details:
- [colors.md](colors.md) - full color palette, scales, and usage rules
- [typography.md](typography.md) - font families, weights, sizes, and hierarchy
- [logos.md](logos.md) - logo variants, assets kit, and usage rules

## Surfaces

Client-facing work uses **NextNode brand v2.0** (teal primary, orange accent, dark navy base-900 token for dark mode — see [colors.md](colors.md), Plus Jakarta Sans + DM Sans + JetBrains Mono). The internal `@nextnode-solutions/monitoring` dashboard uses a separate **Navy** visual language - see `packages/monitoring/CLAUDE.md` and do not adopt it for client work.

## Scale discipline — type, spacing, breakpoints & shadows

Mirrors `nextnode-landing/src/styles/global.css` (the brand source of truth) — copy from it, never invent.

**Default to the Tailwind scale tokens; arbitrary `[…]` values are the exception, not the reflex.** Reach for the stock utility first — `text-sm`, not `text-[17px]` — it's consistent, themeable, and ships its line-height for free. An arbitrary value is perfectly fine when the design genuinely needs something the scale can't express; just make it a deliberate, occasional choice rather than the first thing you type. When an off-scale value recurs, promote it to a named `@theme` token (the way shadows already work) instead of repeating the inline form.

- **Type** — default to the `text-*` scale (`text-xs`…`text-9xl`); each token ships its paired line-height for free. Map brand roles to tokens (see [typography.md](typography.md)). A recurring brand size that's off the scale → a named `@theme` token rather than a repeated `text-[1.75rem]`.
- **Spacing & radius** — NextNode uses **Tailwind v4 defaults**. `global.css` declares **no** custom `--spacing-*` or `--radius-*` scale, so use the stock utilities as-is (`p-4`, `gap-6`, `rounded-lg`, `rounded-xl`…). Don't invent a parallel scale; reach for an arbitrary `p-[…]` only for a genuine one-off the scale can't cover.
- **Breakpoints** — default to the five built-ins: `sm` 640px · `md` 768px · `lg` 1024px · `xl` 1280px · `2xl` 1536px, plus `xs` (shipped by `@nextnode-solutions/standards/tailwind` for the sub-`sm` range). An arbitrary `min-[712px]:` / `max-[877px]:` is for a genuine one-off, not a default move.
- **Shadows** — three named brand tokens, the **only** ones to use (full values live in `global.css`):
  - `shadow-dimensional` — default elevated surface (cards, popovers, raised panels).
  - `shadow-mobile-toggle` / `shadow-mobile-toggle-open` — the mobile nav toggle, closed / open states.
  - Anything else → reuse `shadow-dimensional`; never hand-roll a `box-shadow`.

If `global.css` is unreachable, **fail hard** (see top note) — don't guess these.

## Brand assets package

Logos, icons, and favicons ship from `@nextnode-solutions/brand-assets` as subpath exports. See [logos.md](logos.md) for full subpath table and usage.

## Rules

1. **Use OKLCH token classes** - Declare your project `@theme` mirroring `nextnode-landing/src/styles/global.css`. Never hardcode raw hex or OKLCH literals; use semantic Tailwind classes (`text-accent-500`, `bg-accent-100`, `text-base-900`). Never use `text-teal-500` or `bg-orange-500` — those are stale Tailwind v3 names that do not map to the brand OKLCH palette.
2. **Three fonts, strict roles** - Plus Jakarta Sans for display/hero only, DM Sans for everything else, JetBrains Mono for code.
3. **Teal is primary, orange is accent** - Teal for CTAs, links, primary UI. Orange for highlights only. Never use orange as a primary action color.
4. **Logos always come from `@nextnode-solutions/brand-assets`** - never copy SVGs into project trees, never modify them. Bumping the package version is the single touchpoint when artwork changes.
