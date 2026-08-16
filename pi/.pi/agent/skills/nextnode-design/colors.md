# Color Palette

**Source of truth** : `nextnode-landing/src/styles/global.css` (the @theme block).
The Brand Guidelines v2.0 (Dec 2024) doc — which described the palette in Tailwind hex (`teal-500 = #0D9488`, etc.) — is **stale**. Production migrated to OKLCH tokens with Tailwind v4, and the live `accent-500` does **not** equal Tailwind `teal-500` (slightly lighter + more chromatic). Always read the landing CSS first; never copy hex from this doc into a deliverable without cross-checking.

`@nextnode-solutions/standards/tailwind` is **brand-agnostic** (only `--breakpoint-xs` is shipped) — it does not carry the brand palette. Each project declares its own `@theme` mirroring `nextnode-landing/src/styles/global.css`.

## Accent scale (brand teal) — OKLCH

| Token | OKLCH | Typical usage |
|---|---|---|
| `--color-accent-50`  | `oklch(98.4% 0.014 180.72)`  | Hairline tints |
| `--color-accent-100` | `oklch(95.3% 0.051 180.801)` | Soft backgrounds, focus rings (`+3px accent-bg`) |
| `--color-accent-200` | `oklch(91% 0.096 180.426)`   | Light fills |
| `--color-accent-300` | `oklch(85.5% 0.138 181.071)` | Dark-mode hover variant |
| `--color-accent-400` | `oklch(77.7% 0.152 181.912)` | Dark-mode primary |
| `--color-accent-500` | `oklch(70.4% 0.14 182.503)`  | **Brand primary** — CTAs, primary buttons, active indicators |
| `--color-accent-600` | `oklch(60% 0.118 184.704)`   | Hover for primary, accent text on light bg |
| `--color-accent-700` | `oklch(51.1% 0.096 186.391)` | Deeper accent text |
| `--color-accent-800` | `oklch(43.7% 0.078 188.216)` | — |
| `--color-accent-900` | `oklch(38.6% 0.063 188.416)` | Dark-mode accent-bg |
| `--color-accent-950` | `oklch(27.7% 0.046 192.524)` | — |

## Base scale (neutrals) — OKLCH

| Token | OKLCH | Typical usage |
|---|---|---|
| `--color-base-50`  | `oklch(0.984 0.003 247.86)` | Page background (light) |
| `--color-base-100` | `oklch(0.968 0.007 247.84)` | Subtle surfaces / soft border |
| `--color-base-200` | `oklch(0.929 0.013 255.51)` | Borders |
| `--color-base-300` | `oklch(0.869 0.022 252.89)` | Mid borders |
| `--color-base-400` | `oklch(0.704 0.04 256.79)`  | Dark-mode muted text |
| `--color-base-500` | `oklch(0.554 0.046 257.42)` | Muted text |
| `--color-base-600` | `oklch(0.446 0.043 257.28)` | — |
| `--color-base-700` | `oklch(0.372 0.044 257.29)` | Dark-mode borders |
| `--color-base-800` | `oklch(0.279 0.041 260.03)` | Dark-mode surfaces |
| `--color-base-900` | `oklch(0.208 0.042 265.76)` | Primary text (light) / page bg (dark) |
| `--color-base-950` | `oklch(0.129 0.042 264.7)`  | — |

## Highlight color

| Name | Hex | Tailwind | Usage |
|---|---|---|---|
| Orange 500 | `#F97316` | `orange-500` | Highlights, badges, alerts only |

## Usage rules

- **Always mirror `nextnode-landing/src/styles/global.css`** — that file is the brand. Copy the OKLCH tokens verbatim into the consuming project. If a project's tokens drift from the landing, the project is wrong.
- **Accent-500 saturated fills are rare and reserved** — use the brand teal as a *signal*, not a *texture*. Saturated `accent-500` belongs to: (1) **the** primary CTA (one per context — not two, not three), (2) small indicators (focus rings, ~2px tab underlines, ~3px border-left strips, selection states). **Never** fill big content callouts, opt-cards, or large blocks with `accent-500` — the density kills the signal and reads as "flashy / fluo".
- **Content callouts use border-left, not bg fill** — for a "this is recommended" box, prose callout, or tradeoff card, ship `background: base-100 + border-left: 4px solid accent-500`. Do **not** fill with `accent-100` (pastel teal-bg) — `accent-100` is reserved for focus glow, selection state, and very light tints, not for highlighting a content block.
- **Secondary CTAs go outline, never a second saturated fill** — if you have two action buttons (e.g. `Approve` + `Approve & build`), the secondary must be `background: transparent; border: 1px solid accent-500; color: accent-600` and hover-fill `accent-100`. Two saturated teal buttons side by side = visual chaos.
- **Orange is accent only — *never* primary action.** No orange `Approve`, `Submit`, `Confirm` buttons. Orange is for badges, highlights, alerts that need to stand out *from* teal primary, not duplicate its CTA role.
- **Use semantic OKLCH tokens** — `var(--color-accent-500)` in CSS, `text-accent-500` / `bg-accent-100` in Tailwind. Never paste raw OKLCH literals (`oklch(70.4% ...)`) into components — that's the same anti-pattern as hardcoding hex.
- **Dark mode** — the landing currently ships light-only. For deliverables that need dark mode, mirror the same accent scale and pick `accent-400` (brighter) as primary on dark bg, `accent-900` as dark accent-bg, `accent-300` as hover variant. Base scale: swap `base-50` ↔ `base-900` and friends.
