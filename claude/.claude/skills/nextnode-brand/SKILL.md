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
