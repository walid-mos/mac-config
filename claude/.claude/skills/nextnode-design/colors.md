# Color Palette

Based on Brand Guidelines v2.0 (December 2024).

## Primary Colors

| Name | Hex | Tailwind | Usage |
|---|---|---|---|
| Teal 500 | `#0D9488` | `teal-500` | Primary color — CTAs, links, primary actions |
| Orange 500 | `#F97316` | `orange-500` | Accent — highlights, attention-grabbers |
| Dark Navy | `#141A30` | custom | Dark mode backgrounds, dark UI surfaces |

## Background Colors

| Context | Hex | Usage |
|---|---|---|
| Dark mode | `#141A30` | Page background, card backgrounds in dark mode |
| Light mode | `#F8FAFC` | Page background, card backgrounds in light mode |

## Teal Scale

The brand uses the full Teal 50-700 range from Tailwind. The scale is available via `@nextnode-solutions/standards/tailwind`.

| Token | Tailwind Class | Typical Usage |
|---|---|---|
| Teal 50 | `teal-50` | Subtle backgrounds, hover states (light mode) |
| Teal 100 | `teal-100` | Light backgrounds, badges |
| Teal 200 | `teal-200` | Borders, dividers |
| Teal 300 | `teal-300` | Secondary elements |
| Teal 400 | `teal-400` | Hover state for primary elements |
| Teal 500 | `teal-500` | **Primary** — CTAs, links, active states |
| Teal 600 | `teal-600` | Pressed/active state for primary elements |
| Teal 700 | `teal-700` | Dark accents, text on light backgrounds |

## Usage Rules

- **Teal is the brand color** — use it for all primary UI interactions (buttons, links, focus rings, active tabs)
- **Orange is accent only** — reserved for highlights, badges, alerts, or elements that need to stand out from the teal primary. Never use orange for primary actions.
- **Dark Navy (`#141A30`) is NOT black** — always use this specific shade for dark mode backgrounds, never `#000000` or Tailwind's default grays
- **Light background is `#F8FAFC`** — use Slate 50 equivalent for light mode backgrounds, not pure white
- Always use Tailwind utility classes (`text-teal-500`, `bg-orange-500`) — never hardcode hex values in components
