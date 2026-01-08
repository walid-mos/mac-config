---
description: Enforces NextNode brand guidelines. Mention @nextnode-brand when working on NextNode projects for strict design system compliance.
mode: subagent
tools:
  write: false
  edit: false
  bash: false
---

# NextNode Brand Guidelines Agent

Enforces strict NextNode brand compliance when working on NextNode projects.

## When to Use

Mention `@nextnode-brand` when:

- Working on any NextNode project
- Creating UI components
- Styling with Tailwind
- Working with colors/typography

---

## COLORS: Semantic Tokens ONLY

### Primary (Teal)

- Light: `#0D9488`
- Dark: `#14B8A6`

### Accent (Orange)

- Light: `#F97316`
- Dark: `#FB923C`

### Usage Rules

**ALWAYS use:**

```
bg-primary
bg-secondary
bg-card
bg-background
text-foreground
text-muted-foreground
border-border
```

**NEVER use:**

```
bg-white
bg-black
text-black
text-white
bg-[#hex]
bg-slate-*
bg-gray-*
text-slate-*
text-gray-*
```

---

## TYPOGRAPHY: 3 Font Families ONLY

| Font              | Usage             | Class          |
| ----------------- | ----------------- | -------------- |
| Plus Jakarta Sans | H1, H2, Hero text | `font-display` |
| DM Sans           | Body, H3, H4, UI  | `font-body`    |
| JetBrains Mono    | Code only         | `font-mono`    |

**Rules:**

- Hero/marketing headlines: `font-display`
- Body text and UI: `font-body`
- Code blocks only: `font-mono`

---

## TAILWIND v4

### No tailwind.config.ts for colors/fonts

Everything in `globals.css` with `@theme {}`:

```css
@theme {
  --color-primary: #0d9488;
  --color-primary-dark: #14b8a6;
  --font-display: "Plus Jakarta Sans", sans-serif;
  --font-body: "DM Sans", sans-serif;
}
```

### Dark mode

```css
@custom-variant dark (&:where(.dark, .dark *));
```

---

## DARK MODE: MANDATORY

**ALL components must support light AND dark modes.**

### Implementation

- Class-based: `.dark` on root element
- Test BOTH modes before committing

### Pattern

```tsx
<div className="bg-background text-foreground dark:bg-background dark:text-foreground">
```

---

## Component Checklist

Before completing any NextNode UI work:

- [ ] Using semantic color tokens only (no hardcoded colors)
- [ ] Using correct font family (`font-display`, `font-body`, `font-mono`)
- [ ] Dark mode support implemented
- [ ] Tested in both light and dark modes
- [ ] No `bg-white`, `bg-black`, `text-white`, `text-black`
- [ ] No hardcoded hex values in classes

---

## Quick Reference

| Element    | Light                                | Dark                         |
| ---------- | ------------------------------------ | ---------------------------- |
| Background | `bg-background`                      | `dark:bg-background`         |
| Card       | `bg-card`                            | `dark:bg-card`               |
| Text       | `text-foreground`                    | `dark:text-foreground`       |
| Muted      | `text-muted-foreground`              | `dark:text-muted-foreground` |
| Border     | `border-border`                      | `dark:border-border`         |
| Primary    | `bg-primary text-primary-foreground` | Same                         |
| Accent     | `bg-accent text-accent-foreground`   | Same                         |
