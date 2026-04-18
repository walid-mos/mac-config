# Logos & Brand Assets

Logo system and usage rules. Based on Brand Guidelines v2.0 (December 2024).

## Logo Concept

The NN symbol is two fused N letters rendered as a **single SVG path** with a unified gradient. Three gradient variants exist (teal, white, black).

## Logo Variants

### Icons (symbol only)

| Variant | Usage |
|---|---|
| Teal | Default — favicons, app icons, watermarks |
| White | Dark backgrounds |
| Black | Print (B&W), high-contrast contexts |

### Square Logos (400x400)

Symbol + "NextNode Solutions" text. Three variants (teal on light, white on dark, black on light).

**Usage**: Social media profiles, email signatures.

### Landscape Logos (500x100)

Symbol + "NextNode Solutions" horizontal. Three background variants + short "NextNode" versions.

**Usage**: Website headers, documents, presentations.

### Social Avatars (400x400)

Opaque-background versions ready for direct upload.

| Variant | Background |
|---|---|
| Dark | `#141A30` |
| Light | `#F8FAFC` |

**Usage**: LinkedIn, Twitter/X, GitHub profile pictures.

## Package: `@nextnode-solutions/brand-assets`

All assets are distributed via the `@nextnode-solutions/brand-assets` npm package. Install it:

```bash
pnpm add @nextnode-solutions/brand-assets
```

### Import Examples

```tsx
// Icons (symbol only)
import iconTeal from '@nextnode-solutions/brand-assets/icons/icon-teal.svg'
import iconWhite from '@nextnode-solutions/brand-assets/icons/icon-white.svg'
import iconBlack from '@nextnode-solutions/brand-assets/icons/icon-black.svg'

// Icons with text
import iconTextTeal from '@nextnode-solutions/brand-assets/icons-text/icon-text-teal.svg'

// Square logos (400x400)
import logoSquare from '@nextnode-solutions/brand-assets/logos-square/logo-square-teal.svg'

// Landscape logos (500x100) — full + short variants
import logoFull from '@nextnode-solutions/brand-assets/logos-landscape/logo-landscape-teal.svg'
import logoShort from '@nextnode-solutions/brand-assets/logos-landscape/logo-landscape-teal-short.svg'

// Social avatars (400x400)
import avatarDark from '@nextnode-solutions/brand-assets/social/avatar-dark.svg'
import avatarLight from '@nextnode-solutions/brand-assets/social/avatar-light.svg'

// Favicon
import favicon from '@nextnode-solutions/brand-assets/favicon/favicon.svg'
```

PNG variants are also available (replace `.svg` with `.png` or `-mini.png`).

### Export Paths

| Export Path | Variants | Formats |
|---|---|---|
| `./icons/*` | teal, white, black | SVG, PNG, PNG mini |
| `./icons-text/*` | teal, white, black | SVG, PNG, PNG mini |
| `./logos-square/*` | teal, white, black | SVG, PNG, PNG mini |
| `./logos-landscape/*` | teal, white, black + short | SVG, PNG, PNG mini |
| `./social/*` | dark, light | SVG, PNG |
| `./favicon/*` | — | SVG, PNG, PNG mini |

## Minimum Sizes

| Context | Minimum Size |
|---|---|
| Favicon | 32x32px |
| Social | 48x48px |
| Header | 40px height |
| Print | 15x15mm |

## Protection Zone

Maintain a 25% clear space around the logo (25% of the logo's width/height on all sides).

## Usage Rules — DO

- Use original SVG files from the assets kit
- Respect the 25% protection zone
- Choose the variant that matches the background contrast
- Maintain original proportions
- Use Black variant for B&W print

## Usage Rules — DO NOT

- Modify gradient colors
- Deform or stretch the logo
- Add effects (shadows, outlines, glows)
- Place on low-contrast backgrounds
- Use below the minimum size
