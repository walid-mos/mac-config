# Typography

Three complementary font families with strict roles. Based on Brand Guidelines v2.0 (December 2024).

## Font Families

### Display — Plus Jakarta Sans

- **Role**: Hero titles and high-impact elements only
- **Weights**: 600 (semibold), 700 (bold), 800 (extrabold)
- **Character**: Geometric, modern
- **Google Fonts**: `Plus+Jakarta+Sans:wght@600;700;800`

### Body — DM Sans

- **Role**: All body content, navigation, buttons, labels, form elements
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Character**: Humanist, highly readable
- **Google Fonts**: `DM+Sans:wght@400;500;600;700`

### Code — JetBrains Mono

- **Role**: Code blocks, inline code, technical data, terminal output
- **Weights**: 400 (regular)
- **Character**: Monospace, designed for code readability
- **Google Fonts**: `JetBrains+Mono`

## Type Scale

| Token | Size | Font | Usage |
|---|---|---|---|
| Display | 48px (3rem) | Plus Jakarta Sans | Hero titles, landing page headings |
| H1 | 36px (2.25rem) | Plus Jakarta Sans | Page titles |
| H2 | 28px (1.75rem) | Plus Jakarta Sans or DM Sans 700 | Section headings |
| Body | 16px (1rem) | DM Sans | Default text, paragraphs |
| Small | 14px (0.875rem) | DM Sans | Captions, labels, helper text |

## Font Loading

In Next.js projects, use `next/font` for optimal loading:

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

## Tailwind Integration

The `@nextnode-solutions/standards/tailwind` theme maps these CSS variables to Tailwind font families. Use:

- `font-display` — Plus Jakarta Sans (hero/display elements)
- `font-body` or `font-sans` — DM Sans (default body text)
- `font-mono` — JetBrains Mono (code)

## Rules

- NEVER use Plus Jakarta Sans for body text — it is display-only
- NEVER use DM Sans for hero/display titles — use Plus Jakarta Sans
- NEVER load font weights outside the prescribed ranges
- Always set DM Sans as the default `font-sans` / body font
- Code elements MUST use JetBrains Mono, never the body or display font
