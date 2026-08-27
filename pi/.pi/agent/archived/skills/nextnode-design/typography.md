# Typography

Three complementary font families with strict roles. Based on Brand Guidelines v2.0 (December 2024).

## Font Families

### Display - Plus Jakarta Sans

- **Role**: Hero titles and high-impact elements only
- **Weights**: 600 (semibold), 700 (bold), 800 (extrabold)
- **Character**: Geometric, modern
- **Google Fonts**: `Plus+Jakarta+Sans:wght@600;700;800`

### Body - DM Sans

- **Role**: All body content, navigation, buttons, labels, form elements
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Character**: Humanist, highly readable
- **Google Fonts**: `DM+Sans:wght@400;500;600;700`

### Code - JetBrains Mono

- **Role**: Code blocks, inline code, technical data, terminal output
- **Weights**: 400 (regular)
- **Character**: Monospace, designed for code readability
- **Google Fonts**: `JetBrains+Mono`

## Type Scale

Default every role to a **Tailwind `text-*` token** — each ships its paired line-height for free. An arbitrary size (`text-[17px]`) is fine as an occasional, deliberate exception, just never the reflex; see [SKILL.md](SKILL.md) → Scale discipline.

| Role | Tailwind token | Size | Font | Usage |
|---|---|---|---|---|
| Display | `text-5xl` | 48px (3rem) | Plus Jakarta Sans | Hero titles, landing page headings |
| H1 | `text-4xl` | 36px (2.25rem) | Plus Jakarta Sans | Page titles |
| H2 | `text-3xl` | 30px (1.875rem) | Plus Jakarta Sans or DM Sans 700 | Section headings |
| Body | `text-base` | 16px (1rem) | DM Sans | Default text, paragraphs |
| Small | `text-sm` | 14px (0.875rem) | DM Sans | Captions, labels, helper text |

> **H2 previously sat off the default scale at 28px (1.75rem); it maps to `text-3xl` (30px).** Off-scale sizes: see [SKILL.md](SKILL.md) → Scale discipline.

## Font Loading

Fonts are **self-hosted as variable fonts** via Fontsource — never Google Fonts `<link>` tags (the landing migrated to `@fontsource-variable/*`; weights are no longer fetched from Google, the full weight range ships in one file).

### Canonical pattern (mirrors `nextnode-landing`)

Install the three variable packages:

```bash
pnpm add @fontsource-variable/dm-sans @fontsource-variable/plus-jakarta-sans @fontsource-variable/jetbrains-mono
```

Import them at the top of the global CSS (the same file that declares the `@theme` block):

```css
@import '@fontsource-variable/dm-sans/wght.css';
@import '@fontsource-variable/plus-jakarta-sans/wght.css';
@import '@fontsource-variable/jetbrains-mono/wght.css';
```

In an Astro layout, preload the latin woff2 files:

```astro
---
import dmSansLatin from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2'
import plusJakartaSansLatin from '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2'
---
<head>
  <link rel="preload" href={dmSansLatin} as="font" type="font/woff2" crossorigin />
  <link rel="preload" href={plusJakartaSansLatin} as="font" type="font/woff2" crossorigin />
</head>
```

Declare the families in `@theme` (verbatim from `nextnode-landing/src/styles/global.css`):

```css
@theme {
  --font-sans: 'DM Sans Variable', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Plus Jakarta Sans Variable', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, monospace;
}
```

### Next.js alternative

`next/font/google` remains acceptable on Next.js projects. Use the same CSS variable names (`--font-sans`, `--font-display`, `--font-mono`) so component classes stay portable.

## Tailwind Integration

`@nextnode-solutions/standards/tailwind` is **brand-agnostic** — it ships only `--breakpoint-xs` and maps **no** font family. The font mapping lives in the project's own `@theme` block (see Font Loading above), which gives you:

- `font-display` - Plus Jakarta Sans Variable (hero/display elements)
- `font-sans` - DM Sans Variable (default body text)
- `font-mono` - JetBrains Mono Variable (code)

## Rules

- NEVER use Plus Jakarta Sans for body text - it is display-only
- NEVER use DM Sans for hero/display titles - use Plus Jakarta Sans
- NEVER load font weights outside the prescribed ranges
- Always set DM Sans as the default `font-sans` / body font
- Code elements MUST use JetBrains Mono, never the body or display font
