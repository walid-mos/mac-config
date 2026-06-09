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

> **H2 is the only role that previously sat off the default scale** (28px / 1.75rem — the defaults jump 24px → 30px). It snaps to the default `text-3xl` (30px). If the brand genuinely requires 28px, define it once as a named token (e.g. `--text-h2`) in the project `@theme` mirroring `global.css` — rather than repeating an inline `text-[1.75rem]` everywhere.

## Font Loading

### Next.js

Use `next/font` for optimal loading:

```tsx
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google'

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-code',
})
```

Apply CSS variables on the root layout element:

```tsx
<body className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
```

### Astro

In Astro projects, preload fonts via `<link>` in the base layout (no framework-level font optimizer):

```astro
---
// src/layouts/BaseLayout.astro
---
<head>
  <!-- Preconnect to Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <!-- Load all three brand fonts in one request -->
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono&display=swap"
  />
</head>
```

Then in your global CSS (the same file that declares the `@theme` block):

```css
@layer base {
  :root {
    --font-display: 'Plus Jakarta Sans', sans-serif;
    --font-body:    'DM Sans', sans-serif;
    --font-code:    'JetBrains Mono', monospace;
  }
}
```

## Tailwind Integration

The `@nextnode-solutions/standards/tailwind` theme maps these CSS variables to Tailwind font families. Use:

- `font-display` - Plus Jakarta Sans (hero/display elements)
- `font-body` or `font-sans` - DM Sans (default body text)
- `font-mono` - JetBrains Mono (code)

## Rules

- NEVER use Plus Jakarta Sans for body text - it is display-only
- NEVER use DM Sans for hero/display titles - use Plus Jakarta Sans
- NEVER load font weights outside the prescribed ranges
- Default to the `text-*` scale; an arbitrary size (`text-[17px]`) is an occasional, deliberate exception, not the reflex — promote recurring off-scale sizes to named `@theme` tokens
- Always set DM Sans as the default `font-sans` / body font
- Code elements MUST use JetBrains Mono, never the body or display font
