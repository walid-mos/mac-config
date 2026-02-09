---
name: nextnode-brand
description: NextNode brand guidelines — color palette, typography, logo system, and per-project branding rules. Use when doing UI/frontend work on a NextNode project.
user-invocable: true
autoload-dirs: []
---

# NextNode Brand Guidelines

## Per-Project Branding Question (MANDATORY — ask ONCE per project)

When this skill loads on a NextNode/SaaS project, **check if a `.nextnode-branding.json` file exists at the project root**. If it does NOT exist, you MUST ask the user the following question BEFORE doing any UI/frontend work:

> **Do you want to apply NextNode branding to this project?**

Use `AskUserQuestion` with these options:

| Option | Description |
|--------|-------------|
| **Full branding** | Typography + colors + logo — full NextNode identity |
| **Typography only** | Fonts (Plus Jakarta Sans, DM Sans, JetBrains Mono) + type scale — project picks its own colors |
| **Colors + typography** | NextNode palette + fonts — but no logo/icon integration |
| **No branding** | Project has its own identity — skip all NextNode brand rules |

After the user answers, create `.nextnode-branding.json` at the project root:

```json
{
  "level": "full" | "typography" | "colors-typography" | "none",
  "decidedAt": "2024-12-08"
}
```

On subsequent sessions, read the file and apply the chosen level silently. Never re-ask.

## Brand Identity

- **Name:** NextNode Solutions (EURL)
- **Tagline meaning:** Next = innovation, future / Node = connection, technical robustness
- **Values:** Technical excellence, transparency, human guidance, pragmatic innovation

## Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `teal-500` | `#0D9488` | Primary — CTAs, links, active states |
| `orange-500` | `#F97316` | Accent — highlights, secondary CTAs |
| `dark-navy` | `#141A30` | Dark mode backgrounds |

### Teal Scale

| Token | Hex |
|-------|-----|
| `teal-50` | Light teal (use Tailwind `teal-50`) |
| `teal-100` – `teal-400` | Intermediate steps (Tailwind defaults) |
| `teal-500` | `#0D9488` (primary) |
| `teal-600` | Hover states |
| `teal-700` | Dark teal |

### Background Tokens

| Context | Hex |
|---------|-----|
| Light page bg | `#F8FAFC` (slate-50) |
| Dark page bg | `#141A30` (dark navy) |
| Card dark bg | `#141A30` |
| Card light bg | `#F8FAFC` |

### Tailwind Config Mapping

When using Tailwind, extend the theme with:

```ts
colors: {
  brand: {
    teal: {
      DEFAULT: '#0D9488',
      50: '#F0FDFA',   // teal-50
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#0D9488',  // primary
      600: '#0F766E',
      700: '#115E59',
    },
    orange: {
      DEFAULT: '#F97316',
    },
    navy: '#141A30',
  },
}
```

## Typography

### Three Font Families

| Role | Font | Weights | Usage |
|------|------|---------|-------|
| **Display** | Plus Jakarta Sans | 600, 700, 800 | Hero titles, impact elements |
| **Body** | DM Sans | 400, 500, 600, 700 | All text content, navigation, buttons |
| **Code** | JetBrains Mono | 400, 500 | Code blocks, technical data |

### Type Scale

| Token | Size | Font |
|-------|------|------|
| Display | 48px | Plus Jakarta Sans 800 |
| H1 | 36px | Plus Jakarta Sans 700 |
| H2 | 28px | Plus Jakarta Sans 600 |
| Body | 16px | DM Sans 400 |
| Small | 14px | DM Sans 400 |

### Font Loading (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Tailwind Font Config

```ts
fontFamily: {
  display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
  sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
},
```

## Logo System

### SVG Assets Location

All original SVGs are at: `/Users/walid/Documents/NextNode/Branding/`

### Available Variants

| Folder | Files | Usage |
|--------|-------|-------|
| `icons/` | `icon-teal.svg`, `icon-white.svg`, `icon-black.svg` | Favicons, app icons, watermarks |
| `icons-text/` | `icon-text-{teal,white,black}.svg` | App icon with "NextNode" text below |
| `logos-square/` | `logo-square-{teal,white,black}.svg` | Social profiles, email signatures (400x400) |
| `logos-landscape/` | `logo-landscape-{teal,white,black}.svg` | Website headers, documents (500x100) |
| `logos-landscape/` | `logo-landscape-{teal,white,black}-short.svg` | Short version — "NextNode" only |
| `social/` | `avatar-dark.svg` (`#141A30` bg), `avatar-light.svg` (`#F8FAFC` bg) | Social media avatars |
| `favicon/` | `favicon.svg` | Browser favicon (32x32) |

### Gradient Specs

The NN symbol uses a **unified single-path SVG** with `gradientUnits="userSpaceOnUse"`.

| Variant | Gradient Stops |
|---------|---------------|
| **Teal** (primary) | `#5EEAD4` → `#14B8A6` → `#0D9488` |
| **White** (dark bg) | `#FFFFFF` → `#E2E8F0` → `#CBD5E1` |
| **Black** (print) | `#475569` → `#334155` → `#1E293B` |

### Context to File Quick Reference

| Context | File |
|---------|------|
| Website header | `logos-landscape/logo-landscape-teal.svg` |
| Favicon | `favicon/favicon.svg` |
| LinkedIn / Twitter | `social/avatar-dark.svg` |
| Email signature | `logos-landscape/logo-landscape-teal-short.svg` |
| App icon | `icons-text/icon-text-teal.svg` |
| Dark backgrounds | `-white` variants |
| Print / B&W | `-black` variants |

### Logo Rules

**DO:**
- Use original SVG files (copy from branding folder into project `public/` or `src/assets/`)
- Respect 25% clear space around the logo
- Choose the variant matching the background
- Maintain aspect ratio
- Use Black variant for B&W print

**DON'T:**
- Modify gradient colors
- Distort or stretch the logo
- Add effects (shadows, outlines)
- Place on low-contrast backgrounds
- Use below minimum sizes

### Minimum Sizes

| Context | Min Size |
|---------|----------|
| Favicon | 32x32px |
| Social | 48x48px |
| Header | 40px height |
| Print | 15x15mm |

## Branding Level Application Rules

Based on the `.nextnode-branding.json` `level` value:

| Level | Typography | Colors | Logo |
|-------|-----------|--------|------|
| `full` | Apply all 3 font families + type scale | Apply full teal/orange/navy palette | Copy appropriate SVGs into project |
| `colors-typography` | Apply all 3 font families + type scale | Apply full palette | Skip logo integration |
| `typography` | Apply all 3 font families + type scale | Project's own colors | Skip logo + palette |
| `none` | Skip entirely | Skip entirely | Skip entirely |
