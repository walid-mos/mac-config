---
paths:
  - "~/Development/SaaS/**"
  - "~/Development/Nextnode/**"
---

# NextNode Brand Guidelines - Strict Mode

Activated when working in NextNode project directories.

## Colors: Semantic Tokens ONLY

- Primary: Teal #0D9488 (light) / #14B8A6 (dark)
- Accent: Orange #F97316 (light) / #FB923C (dark)
- Background: #F8FAFC (light) / #141A30 (dark)

**ALWAYS**: `bg-primary`, `text-foreground`, `bg-card`, `border-border`

**NEVER**: `bg-white`, `text-black`, `bg-[#hex]`, `bg-slate-*`

## Typography: 3 Fonts ONLY

- `font-display` (Plus Jakarta Sans) -> H1, H2, Hero
- `font-body` (DM Sans) -> Body, H3, H4, UI
- `font-mono` (JetBrains Mono) -> Code only

## Tailwind v4

- No `tailwind.config.ts` for colors/fonts
- Everything in `globals.css` with `@theme {}`
- Dark mode: `@custom-variant dark`

## Dark Mode

ALL components must support both light and dark modes.
