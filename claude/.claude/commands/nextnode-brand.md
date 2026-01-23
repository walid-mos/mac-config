---
allowed-tools: Read
description: NextNode brand colors, typography, and design system
---

# /nextnode-brand

Complete NextNode brand guidelines. STRICT enforcement on NextNode projects.

---

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
Official dark mode background: **#141A30**

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

### Functional Colors
| Name | Hex | Usage |
|------|-----|-------|
| Success | #10B981 | Validations |
| Warning | #F59E0B | Alerts |
| Error | #EF4444 | Errors |
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
<div className="bg-slate-50" />                    // FORBIDDEN
```

---

## Typography

### Font Families

| Class | Font | Weights | Usage |
|-------|------|---------|-------|
| `font-display` | Plus Jakarta Sans | 600, 700, 800 | H1, H2, Hero titles |
| `font-body` | DM Sans | 400, 500, 600, 700 | Body, H3, H4, UI, buttons |
| `font-mono` | JetBrains Mono | 400, 500, 600 | Code blocks |

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

// Body text: font-body (default)
<p className="font-body" />

// Code: ALWAYS font-mono
<code className="font-mono text-sm" />
```

---

## Tailwind CSS v4

**NO `tailwind.config.ts` for colors/fonts.** Everything in CSS with `@theme {}`.

### CSS Structure

```css
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;600&display=swap");
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-display: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-body: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  --color-teal-600: #0D9488;
  --color-orange-500: #F97316;
  /* ... full scale */
}
```

### Semantic Tokens (Light)
```css
:root {
  --background: #F8FAFC;
  --foreground: #0F172A;
  --primary: #0D9488;
  --primary-foreground: #FFFFFF;
  --accent: #F97316;
  --accent-foreground: #FFFFFF;
  /* ... */
}
```

### Semantic Tokens (Dark)
```css
.dark {
  --background: #141A30;
  --foreground: #F8FAFC;
  --primary: #14B8A6;
  --primary-foreground: #141A30;
  --accent: #FB923C;
  --accent-foreground: #141A30;
  /* ... */
}
```

---

## Dark Mode

**MANDATORY**: ALL components must work in both light AND dark mode.

- Class-based: `.dark` class on root element
- Use semantic tokens that switch automatically
- Test BOTH modes before commit

```tsx
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Works in both modes
  </button>
</div>
```

---

## Logo

### Logo Kit Structure
```
nextnode-brand-assets/
├── icons/           -> 3 SVG (Teal, White, Black)
├── icons-text/      -> 3 SVG (Symbol + "NextNode Solutions")
├── logos-square/    -> 3 SVG (400x400, for profiles)
├── logos-landscape/ -> 6 SVG (500x100, for headers)
├── social/          -> 2 SVG (Dark #141A30, Light #F8FAFC backgrounds)
└── favicon/         -> 1 SVG (32x32)
```

### Usage Rules

**DO:**
- Use original SVG files
- Respect proportions
- Protection zone: 25% of logo height
- Choose appropriate variant for background

**DON'T:**
- Modify gradient colors
- Distort or stretch
- Add effects (shadows, outlines)
- Place on low-contrast backgrounds

---

## Quick Reference - Tailwind Classes

```tsx
// Backgrounds
className="bg-background"      // Page background
className="bg-card"            // Card background
className="bg-primary"         // Primary action
className="bg-accent"          // Accent/highlight

// Text
className="text-foreground"           // Main text
className="text-muted-foreground"     // Secondary text
className="text-primary"              // Accent text (teal)
className="text-primary-foreground"   // Text on primary bg

// Interactive Elements
className="bg-primary text-primary-foreground"
className="bg-accent text-accent-foreground"
className="bg-destructive text-destructive-foreground"

// Borders & Inputs
className="border-border"
className="border-input"
className="focus:ring-ring"

// Typography
className="font-display"  // Headings (Plus Jakarta Sans)
className="font-body"     // Body text (DM Sans)
className="font-mono"     // Code (JetBrains Mono)
```

---

## Checklist Before Commit

- [ ] Uses semantic color tokens (NOT hardcoded colors)
- [ ] Uses correct font families (display, body, mono)
- [ ] Works in light AND dark mode
- [ ] Responsive (mobile, tablet, desktop)
- [ ] No TypeScript errors
