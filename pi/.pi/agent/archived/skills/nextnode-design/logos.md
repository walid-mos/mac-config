# Logos & Brand Assets

Logo system and usage rules. Based on Brand Guidelines v2.0 (December 2024).

## Logo Variants

### Icons (symbol only)

| Variant | Usage |
|---|---|
| Teal | Default - favicons, app icons, watermarks |
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
// Icon (symbol only): <category>/<asset>-<variant>.svg
import iconTeal from '@nextnode-solutions/brand-assets/icons/icon-teal.svg'

// Landscape logo, short variant: trailing -short
import logoShort from '@nextnode-solutions/brand-assets/logos-landscape/logo-landscape-teal-short.svg'

// Social avatar: dark | light
import avatarDark from '@nextnode-solutions/brand-assets/social/avatar-dark.svg'
```

Same pattern for `icons-text/`, `logos-square/`, `favicon/` (see Export Paths below).

PNG variants are also available (replace `.svg` with `.png` or `-mini.png`).

### Export Paths

| Export Path | Variants | Formats |
|---|---|---|
| `./icons/*` | teal, white, black | SVG, PNG, PNG mini |
| `./icons-text/*` | teal, white, black | SVG, PNG, PNG mini |
| `./logos-square/*` | teal, white, black | SVG, PNG, PNG mini |
| `./logos-landscape/*` | teal, white, black + short | SVG, PNG, PNG mini |
| `./social/*` | dark, light | SVG, PNG |
| `./favicon/*` | - | SVG, PNG, PNG mini |

## Minimum Sizes & Protection Zone

Minimums: 32x32px favicon, 48x48px social, 40px header height, 15x15mm print. Maintain a 25% clear space around the logo on all sides.

## Usage Rules - DO NOT

- Modify gradient colors
- Deform or stretch the logo
- Add effects (shadows, outlines, glows)
