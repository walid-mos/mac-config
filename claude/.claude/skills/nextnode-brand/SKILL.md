---
name: nextnode-brand
description: NextNode brand colors, typography, and design system. Use when working on NextNode projects or discussing brand guidelines.
user-invocable: true
allowed-tools: Read
---

# NextNode Brand Guidelines

STRICT enforcement on NextNode projects.

## Identity

- **Company**: NextNode Solutions
- **Site**: nextnode.fr
- **Brand Colors**: Teal (primary) + Orange (accent)

## Colors - Semantic Tokens ONLY

| Token | Light | Dark |
|-------|-------|------|
| `primary` | #0D9488 | #14B8A6 |
| `accent` | #F97316 | #FB923C |
| `background` | #F8FAFC | #141A30 |
| `foreground` | #0F172A | #F8FAFC |
| `card` | #FFFFFF | #1E293B |
| `muted-foreground` | #64748B | #94A3B8 |
| `border` | #E2E8F0 | #334155 |
| `destructive` | #EF4444 | #F87171 |

**Dark Navy Background**: #141A30

### RULES

```tsx
// ALWAYS use semantic tokens
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground" />
<div className="bg-card border-border" />

// NEVER hardcode colors
<div className="bg-white text-black" />           // FORBIDDEN
<button className="bg-[#0D9488] text-white" />    // FORBIDDEN
<div className="bg-slate-50" />                    // FORBIDDEN
```

## Typography - 3 Fonts ONLY

| Class | Font | Usage |
|-------|------|-------|
| `font-display` | Plus Jakarta Sans | H1, H2, Hero titles |
| `font-body` | DM Sans | Body, H3, H4, UI, buttons |
| `font-mono` | JetBrains Mono | Code only |

```tsx
// H1, H2, Hero: ALWAYS font-display
<h1 className="font-display font-bold text-4xl" />

// Body text: font-body (default)
<p className="font-body" />

// Code: ALWAYS font-mono
<code className="font-mono text-sm" />
```

## Tailwind v4

**NO `tailwind.config.ts` for colors/fonts.** Everything in CSS with `@theme {}`.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}
```

## Dark Mode

**MANDATORY**: ALL components must work in both light AND dark mode.

- Class-based: `.dark` class on root element
- Use semantic tokens that switch automatically
- Test BOTH modes before commit

## Quick Reference

```tsx
// Backgrounds
className="bg-background"      // Page
className="bg-card"            // Card
className="bg-primary"         // Action
className="bg-accent"          // Highlight

// Text
className="text-foreground"           // Main
className="text-muted-foreground"     // Secondary
className="text-primary"              // Accent

// Typography
className="font-display"  // Plus Jakarta Sans
className="font-body"     // DM Sans
className="font-mono"     // JetBrains Mono
```

## Checklist

- [ ] Uses semantic color tokens (NOT hardcoded)
- [ ] Uses correct font families
- [ ] Works in light AND dark mode
- [ ] Responsive

## SVG Logos

**Location**: `/Users/walid/Documents/NextNode/Branding/`

### Color Gradient Reference

| Name | Hex | Usage |
|------|-----|-------|
| Teal Dark | #0D9488 | Gradient start (primary) |
| Teal Light | #14B8A6 | Gradient end (primary) |
| Orange Dark | #F97316 | Gradient start (accent) |
| Orange Light | #FB923C | Gradient end (accent) |

### File Inventory (18 files)

| File | Description |
|------|-------------|
| `favicon-16.svg` | Favicon 16x16 |
| `favicon-32.svg` | Favicon 32x32 |
| `icon-gradient.svg` | Icon with gradient |
| `icon-orange.svg` | Icon in orange |
| `icon-teal.svg` | Icon in teal |
| `icon-white.svg` | Icon in white (dark backgrounds) |
| `logo-gradient.svg` | Full logo with gradient |
| `logo-orange.svg` | Full logo in orange |
| `logo-teal.svg` | Full logo in teal |
| `logo-white.svg` | Full logo in white (dark backgrounds) |
| `wordmark-gradient.svg` | Text only with gradient |
| `wordmark-orange.svg` | Text only in orange |
| `wordmark-teal.svg` | Text only in teal |
| `wordmark-white.svg` | Text only in white (dark backgrounds) |
| `og-image-gradient.svg` | Open Graph image with gradient |
| `og-image-orange.svg` | Open Graph image in orange |
| `og-image-teal.svg` | Open Graph image in teal |
| `og-image-white.svg` | Open Graph image in white |

### Usage Guidelines

| Context | Light Mode | Dark Mode |
|---------|------------|-----------|
| Header/Nav | `logo-teal.svg` | `logo-white.svg` |
| Footer | `logo-gradient.svg` | `logo-white.svg` |
| Favicon | `favicon-32.svg` | `favicon-32.svg` |
| Social/OG | `og-image-gradient.svg` | `og-image-gradient.svg` |
| App Icon | `icon-gradient.svg` | `icon-white.svg` |

**Rules:**
- Use `-white.svg` variants on dark backgrounds
- Use `-gradient.svg` for marketing/hero sections
- Use `-teal.svg` for standard brand presence
- Use `-orange.svg` sparingly for accent/CTA contexts
