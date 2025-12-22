# NextNode Brand Guidelines

> STRICT ENFORCEMENT: When working on NextNode projects, these rules are MANDATORY.

## Identity

- **Company**: NextNode Solutions
- **Site**: nextnode.fr
- **Baseline**: Studio de developpement web sur-mesure
- **Brand Colors**: Teal (primary) + Orange (accent)

---

## Colors

### Primary Brand Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | #0D9488 | #14B8A6 | Buttons, links, CTAs |
| `accent` | #F97316 | #FB923C | Highlights, emphasis |
| `background` | #F8FAFC | #141A30 | Page background |
| `foreground` | #0F172A | #F8FAFC | Text color |
| `card` | #FFFFFF | #1E293B | Card backgrounds |
| `muted` | #F1F5F9 | #1E293B | Disabled states |
| `muted-foreground` | #64748B | #94A3B8 | Secondary text |
| `border` | #E2E8F0 | #334155 | Borders |
| `destructive` | #EF4444 | #F87171 | Errors, deletions |

### Dark Navy

The official dark mode background color from Brand Guidelines v2.0:

| Name | Hex | Usage |
|------|-----|-------|
| Dark Navy | #141A30 | Dark mode backgrounds, social avatars |

### Teal Scale

```
teal-50:  #F0FDFA    teal-500: #14B8A6
teal-100: #CCFBF1    teal-600: #0D9488  <- PRIMARY
teal-200: #99F6E4    teal-700: #0F766E
teal-300: #5EEAD4    teal-800: #115E59
teal-400: #2DD4BF    teal-900: #134E4A
```

### Orange Scale (Accent)

```
orange-50:  #FFF7ED   orange-400: #FB923C
orange-100: #FFEDD5   orange-500: #F97316  <- PRIMARY
orange-200: #FED7AA   orange-600: #EA580C
orange-300: #FDBA74   orange-700: #C2410C
```

### Logo Colors

| Element | Hex |
|---------|-----|
| Logo Front (N) | #4EA69A |
| Logo Back (N) | #4FA79B |

### Functional Colors

| Name | Hex | Usage |
|------|-----|-------|
| Success | #10B981 | Validations, confirmations |
| Warning | #F59E0B | Alerts, attention |
| Error | #EF4444 | Errors, deletions |
| Info | #3B82F6 | Information |

### RULES - COLORS

```tsx
// ALWAYS use semantic tokens
<div className="bg-background text-foreground" />
<button className="bg-primary text-primary-foreground" />
<div className="bg-card border-border" />
<p className="text-muted-foreground" />

// NEVER hardcode colors
<div className="bg-white text-black" />           // FORBIDDEN
<button className="bg-[#0D9488] text-white" />    // FORBIDDEN
<div className="bg-slate-50" />                    // FORBIDDEN (use bg-background)
```

---

## Typography

### Font Families

| Class | Font | Weights | Usage |
|-------|------|---------|-------|
| `font-display` | Plus Jakarta Sans | 600, 700, 800 | H1, H2, Hero titles |
| `font-body` | DM Sans | 400, 500, 600, 700 | Body, H3, H4, UI, buttons |
| `font-mono` | JetBrains Mono | 400, 500, 600 | Code blocks, technical data |

### Type Scale

| Level | Size | Font | Weight |
|-------|------|------|--------|
| Display | 48px / 3rem | Plus Jakarta Sans | 800 |
| H1 | 36px / 2.25rem | Plus Jakarta Sans | 700 |
| H2 | 28px / 1.75rem | Plus Jakarta Sans | 700 |
| H3 | 22px / 1.375rem | DM Sans | 600 |
| H4 | 18px / 1.125rem | DM Sans | 600 |
| Body | 16px / 1rem | DM Sans | 400 |
| Small | 14px / 0.875rem | DM Sans | 400 |
| XSmall | 12px / 0.75rem | DM Sans | 400 |
| Code | 14px / 0.875rem | JetBrains Mono | 400 |

### Google Fonts Import

```html
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### RULES - TYPOGRAPHY

```tsx
// H1, H2, Hero titles: ALWAYS font-display
<h1 className="font-display font-bold text-4xl" />
<h2 className="font-display font-bold text-2xl" />

// Body text: font-body (default, often no class needed)
<p className="font-body" />

// Code: ALWAYS font-mono
<code className="font-mono text-sm" />
<pre className="font-mono" />
```

---

## Tailwind CSS v4

### Key Difference from v3

**NO `tailwind.config.ts` for colors/fonts.** Everything is in CSS with `@theme {}`.

### CSS Structure

```css
/* Google Fonts */
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap");

/* Tailwind */
@import "tailwindcss";

/* Dark mode via class */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Fonts */
  --font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  /* Brand Colors - Teal */
  --color-teal-50: #F0FDFA;
  --color-teal-100: #CCFBF1;
  --color-teal-200: #99F6E4;
  --color-teal-300: #5EEAD4;
  --color-teal-400: #2DD4BF;
  --color-teal-500: #14B8A6;
  --color-teal-600: #0D9488;
  --color-teal-700: #0F766E;
  --color-teal-800: #115E59;
  --color-teal-900: #134E4A;

  /* Brand Colors - Orange */
  --color-orange-50: #FFF7ED;
  --color-orange-100: #FFEDD5;
  --color-orange-200: #FED7AA;
  --color-orange-300: #FDBA74;
  --color-orange-400: #FB923C;
  --color-orange-500: #F97316;
  --color-orange-600: #EA580C;
  --color-orange-700: #C2410C;

  /* Logo Colors */
  --color-logo-front: #4EA69A;
  --color-logo-back: #4FA79B;

  /* Functional */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  /* Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  --radius-2xl: 1rem;
}
```

### Semantic Tokens (Light Mode)

```css
:root {
  --background: #F8FAFC;
  --foreground: #0F172A;
  --card: #FFFFFF;
  --card-foreground: #0F172A;
  --popover: #FFFFFF;
  --popover-foreground: #0F172A;
  --primary: #0D9488;
  --primary-foreground: #FFFFFF;
  --secondary: #F1F5F9;
  --secondary-foreground: #0F172A;
  --muted: #F1F5F9;
  --muted-foreground: #64748B;
  --accent: #F97316;
  --accent-foreground: #FFFFFF;
  --destructive: #EF4444;
  --destructive-foreground: #FFFFFF;
  --border: #E2E8F0;
  --input: #E2E8F0;
  --ring: #0D9488;
}
```

### Semantic Tokens (Dark Mode)

```css
.dark {
  --background: #141A30;           /* Dark Navy - from Brand Guidelines v2.0 */
  --foreground: #F8FAFC;
  --card: #1E293B;
  --card-foreground: #F8FAFC;
  --popover: #1E293B;
  --popover-foreground: #F8FAFC;
  --primary: #14B8A6;
  --primary-foreground: #141A30;   /* Dark Navy */
  --secondary: #334155;
  --secondary-foreground: #F8FAFC;
  --muted: #1E293B;
  --muted-foreground: #94A3B8;
  --accent: #FB923C;
  --accent-foreground: #141A30;    /* Dark Navy */
  --destructive: #F87171;
  --destructive-foreground: #141A30; /* Dark Navy */
  --border: #334155;
  --input: #334155;
  --ring: #14B8A6;
}
```

---

## Dark Mode

### MANDATORY

ALL components must work in both light AND dark mode.

### Implementation

- Class-based: `.dark` class on root element (`<html>` or `<body>`)
- Use semantic tokens that switch automatically
- Test BOTH modes before commit

### Pattern

```tsx
// Tokens automatically switch based on .dark class
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Works in both modes
  </button>
</div>
```

---

## Logo

### Unified Gradient System (Brand Guidelines v2.0)

The NextNode logo uses a **unified gradient** across both N letters, merged into a single SVG path for smooth, professional rendering without overlap artifacts.

**Gradient Variants:**
1. Teal gradient (primary)
2. White (monochrome for dark backgrounds)
3. Black (monochrome for print)

### Logo Kit Structure

```
nextnode-brand-assets/
├── icons/           → 3 SVG (Teal, White, Black)
├── icons-text/      → 3 SVG (Symbol + "NextNode Solutions")
├── logos-square/    → 3 SVG (400×400, for profiles)
├── logos-landscape/ → 6 SVG (500×100, for headers)
├── social/          → 2 SVG (Dark #141A30, Light #F8FAFC backgrounds)
└── favicon/         → 1 SVG (32×32)
```

### Usage Rules

**DO:**
- Use original SVG files from the brand kit
- Respect original proportions
- Protection zone: 25% of logo height around it
- Choose variant appropriate for background contrast
- Use Black version for B&W print

**DON'T:**
- Modify the gradient colors
- Distort or stretch the logo
- Add effects (shadows, outlines, extra gradients)
- Place on low-contrast backgrounds
- Use below minimum size

### Minimum Sizes

| Context | Size |
|---------|------|
| Favicon | 32×32px |
| Social icons | 48×48px |
| Header | 40px height |
| Print | 15×15mm |

### Logo Versions

| Version | Usage | Background |
|---------|-------|------------|
| Teal (gradient) | Standard digital usage | Any with contrast |
| White | Dark backgrounds, photos | Dark Navy #141A30 |
| Black | B&W print, documents | Light #F8FAFC |

### Social Avatars (400×400)

Ready-to-use avatars with opaque backgrounds:
- **Dark**: #141A30 background
- **Light**: #F8FAFC background

---

## Quick Reference - Tailwind Classes

```tsx
// Backgrounds
className="bg-background"      // Page background
className="bg-card"            // Card background
className="bg-muted"           // Disabled state
className="bg-primary"         // Primary action
className="bg-accent"          // Accent/highlight

// Text
className="text-foreground"              // Main text
className="text-muted-foreground"        // Secondary text
className="text-primary"                 // Accent text (teal)
className="text-primary-foreground"      // Text on primary bg

// Interactive Elements
className="bg-primary text-primary-foreground"
className="bg-secondary text-secondary-foreground"
className="bg-accent text-accent-foreground"
className="bg-destructive text-destructive-foreground"

// Borders & Inputs
className="border-border"      // Standard borders
className="border-input"       // Input field borders
className="focus:ring-ring"    // Focus states

// Typography
className="font-display"       // Headings (Plus Jakarta Sans)
className="font-body"          // Body text (DM Sans)
className="font-mono"          // Code (JetBrains Mono)
```

---

## Checklist Before Commit

- [ ] Uses semantic color tokens (NOT hardcoded colors)
- [ ] Uses correct font families (display, body, mono)
- [ ] Works in light AND dark mode
- [ ] Responsive (mobile, tablet, desktop)
- [ ] No TypeScript errors
